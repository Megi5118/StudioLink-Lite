const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(`${__dirname}/../studiolink-lite-extension/providers/hy4.js`, "utf8");

function harness(options = {}) {
  let time = 0;
  let value = "";
  let clicks = 0;
  let pastes = 0;
  let blocked = 0;
  let observer;
  let currentEditor;
  const listeners = {};
  const pending = [];
  const button = {
    disabled: false,
    getAttribute(name) {
      if (name === "aria-label") return "Send";
      if (name === "aria-disabled") return String(!value || options.disabled === true);
      return null;
    },
    closest: () => button,
    click() {
      clicks++;
      const event = { target: button, isTrusted: false, preventDefault() { this.defaultPrevented = true; } };
      listeners.click?.(event);
      if (!event.defaultPrevented && !options.unacknowledged) value = "";
    },
  };
  const frame = {
    querySelector: () => options.semanticOnly ? null : button,
    querySelectorAll: () => [button],
  };
  function makeEditor() {
    return {
      closest: (selector) => selector === ".cr-input-box" ? frame : null,
      contains: () => true,
      focus() {},
      get textContent() { return value; },
      set textContent(_) { throw new Error("Slate DOM must not be replaced"); },
      get children() {
        return value.split("\n").map((text) => ({
          getAttribute: () => "element",
          querySelectorAll: () => text ? [{ textContent: text }] : [],
        }));
      },
      dispatchEvent(event) {
        assert.equal(event.type, "paste");
        pastes++;
        if (!options.rejectPaste) value = event.clipboardData.getData("text/plain");
        if (options.truncate) value = value.slice(0, 12);
        if (options.remount) currentEditor = makeEditor();
        return false;
      },
    };
  }
  currentEditor = makeEditor();
  const document = {
    documentElement: {},
    querySelector: (selector) => selector === ".cr-input-box" ? frame : null,
    querySelectorAll: (selector) => selector.includes("data-slate-editor") ? [currentEditor] : [],
    addEventListener: (name, handler) => { listeners[name] = handler; },
    dispatchEvent() {},
    createRange: () => ({ selectNodeContents() {} }),
  };
  const context = vm.createContext({
    document,
    window: { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
    location: { pathname: "/app", search: "" },
    Event,
    ClipboardEvent: class { constructor(type, init) { Object.assign(this, { type }, init); } },
    DataTransfer: class {
      setData(type, text) { this[type] = text; }
      getData(type) { return this[type]; }
    },
    MutationObserver: class { constructor(callback) { observer = callback; } observe() {} },
    Date: { now: () => time },
    setTimeout(callback, ms) {
      if (ms === 200) pending.push(callback);
      else { time += ms; queueMicrotask(callback); }
      return 1;
    },
  });
  vm.runInContext(source, context);
  const provider = vm.runInContext("ZSProvider", context);
  provider.installSendHooks({
    isBlocked: () => true,
    isStarted: () => false,
    onBlockedAttempt: () => { blocked++; },
    onUserMessage: () => { blocked++; },
    onNativeStop: () => { blocked++; },
  });
  return {
    provider, pending,
    mutate: (own) => observer([{ target: { nodeType: 1, closest: () => own ? {} : null } }]),
    get clicks() { return clicks; },
    get pastes() { return pastes; },
    get blocked() { return blocked; },
    get value() { return value; },
  };
}

test("Slate paste sends a complete multiline prompt once during startup", async () => {
  const h = harness();
  await h.provider.typeAndSend('Hello\n\n{"command":"list_commands"}\n'.repeat(100));
  assert.equal(h.clicks, 1);
  assert.equal(h.pastes, 1);
  assert.equal(h.blocked, 0);
});

test("Reacquires the editor after a React remount and finds semantic Send", async () => {
  const h = harness({ remount: true, semanticOnly: true });
  await h.provider.typeAndSend("Complete prompt after remount");
  assert.equal(h.clicks, 1);
});

test("A disabled workspace does not trigger forced clicks or repeated pastes", async () => {
  const h = harness({ disabled: true });
  await assert.rejects(h.provider.typeAndSend("Complete prompt"), /Select Workspace/);
  assert.equal(h.clicks, 0);
  assert.equal(h.pastes, 1);
});

for (const options of [{ rejectPaste: true }, { truncate: true }]) {
  test(`Incomplete input is never sent: ${JSON.stringify(options)}`, async () => {
    const h = harness(options);
    await assert.rejects(h.provider.typeAndSend("Complete prompt with commands"), /complete message/);
    assert.equal(h.clicks, 0);
  });
}

test("An unacknowledged send fails without resending and releases the lock", async () => {
  const h = harness({ unacknowledged: true });
  await assert.rejects(h.provider.typeAndSend("Complete prompt"), /confirm sending/);
  assert.equal(h.clicks, 1);
  await assert.rejects(h.provider.typeAndSend("Second deliberate attempt"), /confirm sending/);
  assert.equal(h.clicks, 2);
});

test("Own toolbar mutations are ignored and page mutations are coalesced", () => {
  const h = harness();
  h.mutate(true);
  assert.equal(h.pending.length, 0);
  for (let i = 0; i < 100; i++) h.mutate(false);
  assert.equal(h.pending.length, 1);
});
