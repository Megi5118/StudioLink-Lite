// SPDX-License-Identifier: GPL-3.0-or-later
// Run: node --test tests/test_chatgpt_startup.js
// Exercise the real core functions with a deterministic clock and a minimal
// provider. No browser, external service, or npm dependency is required.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const core = fs.readFileSync(path.join(__dirname, "../studiolink-lite-extension/core/main.js"), "utf8");
function functionSource(name) {
  const match = core.match(new RegExp(`^  (?:async )?function ${name}\\([^]*?^  }`, "m"));
  assert.ok(match, `Core function ${name} is available to test`);
  return match[0];
}
const sessionStart = core.indexOf("  const startedSessions = new Set();");
const sessionEnd = core.indexOf(functionSource("syncSessionState")) + functionSource("syncSessionState").length;
assert.ok(sessionStart >= 0 && sessionEnd > sessionStart);
const sessionSource = core.slice(sessionStart, sessionEnd);

function harness(options = {}) {
  const page = { path: "", empty: true, marker: false };
  const writes = [];
  const banners = [];
  const toasts = [];
  const storage = { ...(options.storage || {}) };
  const state = {
    running: false, starting: false, started: false, injecting: false,
    stopping: false, stop: false, startGen: 0, startingKey: null,
    toolList: [], toolNames: new Set(), sendToken: "old-reply",
  };
  let time = 1000;
  let sends = 0;
  let readResponse = async () => ({ kind: "text", text: "Ready" });
  const context = {
    A: state,
    P: {
      strictStartup: true, displayName: "ChatGPT", id: "chatgpt",
      composerStatus: () => ({ ready: true }),
      chatIsEmpty: () => page.empty,
      conversationKey: () => page.path,
      allItems: () => page.marker ? [{ textContent: "__SYSTEM_PROMPT__" }] : [],
      lastAssistantId: () => "new-reply", lastAssistant: () => null,
      setInputLock() {}, ensureComposerReady: async () => ({ ready: true }),
      isBusyNow: () => false, assistantCount: () => 0, userCount: () => 0,
      streamLen: () => 0, editorText: () => "pending message",
      typeAndSend: async () => { sends++; },
    },
    ZS: { SYS_MARKER: "__SYSTEM_PROMPT__" },
    ui: {
      banner: (...args) => banners.push(args), toast: (...args) => toasts.push(args),
      setStarting() {}, updateStartGate() {}, inputCover() {}, setStarted() {},
    },
    decorate: { sweep() {}, toolBox() {} },
    chrome: { storage: { local: {
      get: (_keys, callback) => callback(storage),
      set: (value) => { Object.assign(storage, value); writes.push(value); },
    } } },
    ensureTools: async () => { state.toolList = [{ name: "list_commands" }]; },
    systemPrompt: () => "__SYSTEM_PROMPT__",
    submitAndGetBase: async () => {
      sends++;
      Object.assign(page, { path: "/c/startup-test", empty: false, marker: true });
      return 0;
    },
    waitForResponse: (...args) => readResponse(...args),
    runTool: async () => "Tool catalogue",
    diag() {}, log() {}, scheduleSweep() {}, captureSendToken() {},
    jitterBeforeSend: async () => {},
    waitFor: async (predicate) => predicate(),
    document: { hidden: false },
    Date: { now: () => time },
    sleep: async (ms) => {
      time += ms;
      if (options.onSleep) options.onSleep(time, state);
      assert.ok(time < 1000000, "A response must not wait indefinitely in a fixture");
    },
    setTimeout: () => 1,
  };
  Object.assign(page, options.page || {});
  Object.assign(context.P, options.provider || {});
  vm.createContext(context);
  vm.runInContext(`${sessionSource}\n${functionSource("startSession")}\n` +
    "globalThis.sessionTest = { startSession, syncSessionState, rememberSession, startedSessions, failedStartupSessions };", context);
  return {
    context, page, state, storage, writes, banners, toasts, ...context.sessionTest,
    get sends() { return sends; }, get time() { return time; },
    setResponse: (fn) => { readResponse = fn; },
    useCoreFunction(name) { vm.runInContext(`${functionSource(name)}\nglobalThis.${name} = ${name};`, context); },
  };
}

for (const kind of ["empty", "context_limit", "parse_error", "timeout", "truncated"]) {
  test(`ChatGPT startup rejects ${kind} and does not reactivate from its prompt`, async () => {
    const h = harness();
    h.setResponse(async () => ({ kind, detail: "Startup failed in fixture" }));
    await h.startSession();
    assert.equal(h.state.started, false);
    assert.equal(h.state.starting, false);
    assert.ok(h.failedStartupSessions.has("/c/startup-test"));
    assert.equal(h.startedSessions.has("/c/startup-test"), false);
    h.syncSessionState();
    assert.equal(h.state.started, false, "The visible system prompt cannot undo failure");
    assert.equal(h.toasts.length, 0, "A failed startup must not show Agent ready");
    assert.ok(h.banners.some((args) => args[1] === "Startup failed"));

    const restored = harness({ storage: h.storage, page: { ...h.page } });
    restored.syncSessionState();
    assert.equal(restored.state.started, false, "Failure survives reloading the page");
  });
}

test("A failure after list_commands also prevents the ready state", async () => {
  const h = harness();
  const replies = [
    { kind: "tool", calls: [{ tool: "list_commands" }], item: {} },
    { kind: "context_limit", detail: "Quota exhausted" },
  ];
  h.setResponse(async () => replies.shift());
  await h.startSession();
  assert.equal(h.sends, 2, "The failure occurred after sending the tool catalogue");
  assert.equal(h.state.started, false);
  h.syncSessionState();
  assert.equal(h.state.started, false);
  assert.ok(h.failedStartupSessions.has("/c/startup-test"));
});

test("A completed ChatGPT bootstrap is remembered and restored", async () => {
  const h = harness();
  await h.startSession();
  assert.equal(h.state.started, true);
  assert.ok(h.startedSessions.has("/c/startup-test"));
  assert.equal(h.failedStartupSessions.has("/c/startup-test"), false);
  const restored = harness({ storage: h.storage, page: { ...h.page, marker: false } });
  restored.syncSessionState();
  assert.equal(restored.state.started, true, "A successful session survives virtualized prompt removal");
});

test("A failed-session record wins even if persisted success and a marker coexist", () => {
  const h = harness({
    storage: { zsStartedSessions: ["/c/failed"], zsFailedStartupSessions: ["/c/failed"] },
    page: { path: "/c/failed", empty: false, marker: true },
  });
  h.syncSessionState();
  assert.equal(h.state.started, false);
  assert.ok(h.failedStartupSessions.has("/c/failed"));
});

test("A manually stopped bootstrap cannot reactivate from its prompt", async () => {
  const h = harness();
  h.setResponse(async () => ({ kind: "stopped" }));
  await h.startSession();
  h.syncSessionState();
  assert.equal(h.state.started, false);
  assert.ok(h.failedStartupSessions.has("/c/startup-test"));
});

test("Leaving an unfinished bootstrap cannot activate it when returning later", async () => {
  const h = harness();
  let resolveResponse;
  let notifyWaiting;
  const waiting = new Promise((resolve) => { notifyWaiting = resolve; });
  h.setResponse(() => {
    notifyWaiting();
    return new Promise((resolve) => { resolveResponse = resolve; });
  });
  const startup = h.startSession();
  await waiting;
  h.syncSessionState(); // Pin the actual conversation id while bootstrap is live.
  assert.equal(h.state.startingKey, "/c/startup-test");
  Object.assign(h.page, { path: "", empty: true, marker: false });
  h.syncSessionState();
  resolveResponse({ kind: "empty" });
  await startup;
  Object.assign(h.page, { path: "/c/startup-test", empty: false, marker: true });
  h.syncSessionState();
  assert.equal(h.state.started, false, "A superseded bootstrap never completed successfully");
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("Pinning an in-progress bootstrap prevents reload activation and success clears the record", async () => {
  const h = harness();
  const waiting = deferred();
  const response = deferred();
  h.setResponse(() => { waiting.resolve(); return response.promise; });
  const startup = h.startSession();
  await waiting.promise;
  h.syncSessionState();
  assert.equal(h.state.startingKey, "/c/startup-test");
  assert.ok(h.failedStartupSessions.has("/c/startup-test"));
  const restored = harness({ storage: h.storage, page: { ...h.page } });
  restored.syncSessionState();
  assert.equal(restored.state.started, false, "Reloading before a reply is not successful startup");
  response.resolve({ kind: "text", text: "Ready" });
  await startup;
  assert.equal(h.state.started, true);
  assert.equal(h.failedStartupSessions.has("/c/startup-test"), false);
  assert.ok(h.startedSessions.has("/c/startup-test"));
  assert.equal(h.storage.zsFailedStartupSessions.includes("/c/startup-test"), false);
});

test("Switching to an existing chat while list_commands runs prevents sending its result there", async () => {
  const h = harness();
  const runningTool = deferred();
  const toolResult = deferred();
  h.setResponse(async () => ({ kind: "tool", calls: [{ tool: "list_commands" }], item: {} }));
  h.context.runTool = () => { runningTool.resolve(); return toolResult.promise; };
  const startup = h.startSession();
  await runningTool.promise;
  h.syncSessionState();
  Object.assign(h.page, { path: "/c/existing-other-chat", empty: false, marker: false });
  h.syncSessionState();
  assert.equal(h.state.starting, false, "A non-empty destination also supersedes ChatGPT startup");
  toolResult.resolve("Tool catalogue from the original chat");
  await startup;
  assert.equal(h.sends, 1, "Only the original bootstrap prompt was sent");
  assert.equal(h.page.path, "/c/existing-other-chat");
  assert.equal(h.state.started, false);
  assert.ok(h.failedStartupSessions.has("/c/startup-test"));
  assert.equal(h.failedStartupSessions.has("/c/existing-other-chat"), false);
});

test("Navigation during the second submit prevents waiting for a reply in the destination chat", async () => {
  const h = harness();
  const submittingResult = deferred();
  const resultSubmitted = deferred();
  const originalSubmit = h.context.submitAndGetBase;
  let submitCalls = 0;
  let responseCalls = 0;
  h.context.submitAndGetBase = async (...args) => {
    if (++submitCalls === 1) return originalSubmit(...args);
    submittingResult.resolve();
    await resultSubmitted.promise;
    return 0;
  };
  h.setResponse(async () => {
    responseCalls++;
    return { kind: "tool", calls: [{ tool: "list_commands" }], item: {} };
  });
  const startup = h.startSession();
  await submittingResult.promise;
  h.syncSessionState();
  Object.assign(h.page, { path: "/c/existing-other-chat", empty: false, marker: false });
  h.syncSessionState();
  resultSubmitted.resolve();
  await startup;
  assert.equal(submitCalls, 2);
  assert.equal(responseCalls, 1, "Do not consume the other chat's reply as bootstrap confirmation");
  assert.equal(h.state.started, false);
  assert.equal(h.startedSessions.has("/c/existing-other-chat"), false);
  assert.ok(h.failedStartupSessions.has("/c/startup-test"));
});

test("Four unaccepted ChatGPT sends reject instead of starting a response wait", async () => {
  const h = harness();
  h.useCoreFunction("submitAndGetBase");
  await assert.rejects(h.context.submitAndGetBase("prompt"), /did not accept the message/);
  assert.equal(h.sends, 4);
});

test("Strict startup validation leaves the legacy provider behavior unchanged", async () => {
  const h = harness({ provider: { strictStartup: false } });
  h.setResponse(async () => ({ kind: "empty" }));
  await h.startSession();
  assert.equal(h.state.started, true);
  assert.equal(h.failedStartupSessions.size, 0);
});

function responseHarness(authoritative = true) {
  const h = harness();
  const item = {};
  const active = () => h.time < 61000;
  Object.assign(h.context, {
    T: { RESPONSE_TIMEOUT_MS: 300000, STABLE_MS: 9000, WARMUP_MS: 45000, REASON_NOREPLY_MS: 90000 },
    ZSParse: {
      hasOpenToolBlock: () => false, hasToolSignature: () => false,
      DSML_RE: /DOES_NOT_MATCH/, LUA_END_RE: /DOES_NOT_MATCH/, LUA_START_RE: /DOES_NOT_MATCH/,
    },
  });
  Object.assign(h.context.P, {
    reliableCounts: true, isGenerating: active,
    hasActiveGeneration: authoritative ? active : undefined,
    readAssistant: () => ({ item, reply: active() ? "Working on the answer" : "Completed answer", thinking: "" }),
    scanError: () => null, isTooLongMsg: () => false, findContinueBtn: () => null,
  });
  h.useCoreFunction("waitForResponse");
  return h;
}

test("A visible ChatGPT Stop outlives 60 seconds of unchanged answer text", async () => {
  const h = responseHarness();
  const result = await h.context.waitForResponse(0);
  assert.equal(result.kind, "text");
  assert.equal(result.text, "Completed answer", "Do not finalize the partial text after STABLE_MS");
  assert.ok(h.time >= 61000);
});

test("The stability fallback is retained for providers without an authoritative Stop", async () => {
  const h = responseHarness(false);
  const result = await h.context.waitForResponse(0);
  assert.equal(result.kind, "text");
  assert.equal(result.text, "Working on the answer");
  assert.ok(h.time < 61000);
});
