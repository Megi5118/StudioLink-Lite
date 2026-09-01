// SPDX-License-Identifier: GPL-3.0-or-later
// Minimal runtime smoke test for core/main.js initialization outside Chromium.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const here = __dirname;
const ids = new Map();

class FakeClassList {
  constructor(owner) { this.owner = owner; this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); this.sync(); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); this.sync(); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const on = force === undefined ? !this.values.has(name) : !!force;
    if (on) this.values.add(name); else this.values.delete(name);
    this.sync();
    return on;
  }
  sync() { this.owner._className = [...this.values].join(" "); }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.value = "";
    this.isConnected = false;
    this.classList = new FakeClassList(this);
    this._className = "";
    this._id = "";
    this._attrs = new Map();
    this._innerHTML = "";
  }
  set id(value) { this._id = value; if (value) ids.set(value, this); }
  get id() { return this._id; }
  set className(value) {
    this._className = String(value || "");
    this.classList.values = new Set(this._className.split(/\s+/).filter(Boolean));
  }
  get className() { return this._className; }
  set innerHTML(value) {
    this._innerHTML = String(value || "");
    for (const match of this._innerHTML.matchAll(/<([a-z0-9-]+)[^>]*\sid="([^"]+)"[^>]*>/gi)) {
      const child = new FakeElement(match[1]);
      child.id = match[2];
      this.appendChild(child);
    }
  }
  get innerHTML() { return this._innerHTML; }
  get firstChild() { return this.children[0] || null; }
  get firstElementChild() { return this.firstChild; }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return this.parentElement.children[index + 1] || null;
  }
  appendChild(child) {
    if (child.parentElement) child.parentElement.children = child.parentElement.children.filter((item) => item !== child);
    child.parentElement = this;
    child.isConnected = this.isConnected;
    this.children.push(child);
    return child;
  }
  insertBefore(child, before) {
    if (!before) return this.appendChild(child);
    if (child.parentElement) child.parentElement.children = child.parentElement.children.filter((item) => item !== child);
    const index = Math.max(0, this.children.indexOf(before));
    child.parentElement = this;
    child.isConnected = this.isConnected;
    this.children.splice(index, 0, child);
    return child;
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((item) => item !== this);
    this.parentElement = null;
    this.isConnected = false;
  }
  querySelector(selector) {
    if (selector.startsWith("#")) return ids.get(selector.slice(1)) || null;
    return null;
  }
  querySelectorAll() { return []; }
  addEventListener() {}
  removeEventListener() {}
  contains(node) { return node === this || this.children.includes(node); }
  closest() { return null; }
  setAttribute(name, value) { this._attrs.set(name, String(value)); }
  getAttribute(name) { return this._attrs.get(name) || null; }
  getBoundingClientRect() { return new DOMRect(0, 0, 0, 0); }
}

global.DOMRect = class DOMRect {
  constructor(left, top, width, height) {
    this.left = left; this.top = top; this.width = width; this.height = height;
    this.right = left + width; this.bottom = top + height;
  }
};

const documentElement = new FakeElement("html");
documentElement.isConnected = true;
const body = new FakeElement("body");
body.isConnected = true;
documentElement.appendChild(body);
global.document = {
  documentElement,
  body,
  hidden: false,
  activeElement: null,
  createElement: (tag) => new FakeElement(tag),
  getElementById: (id) => ids.get(id) || null,
  addEventListener() {},
  removeEventListener() {},
};
global.window = { innerWidth: 1280, innerHeight: 720, open() {} };
global.location = { pathname: "/", reload() {} };
global.getComputedStyle = () => ({
  backgroundColor: "rgb(255, 255, 255)", colorScheme: "light",
  overflowX: "visible", overflowY: "visible", borderRadius: "0px",
});
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
global.setInterval = () => 1;
global.clearInterval = () => {};
global.MutationObserver = class MutationObserver { observe() {} disconnect() {} };

let messageListener = null;
global.chrome = {
  runtime: {
    lastError: null,
    getManifest: () => ({ version: "1.6.0" }),
    onMessage: { addListener: (listener) => { messageListener = listener; } },
    sendMessage(message, callback) {
      const response = message.type === "status"
        ? { connected: true, mcpAlive: true, studio: true, studioApp: true,
            studioProc: true, tools: 3, servers: [{ id: "roblox", alive: true, tools: 3 }] }
        : { ok: true };
      callback(response);
    },
  },
  storage: { local: { get: (_key, callback) => callback({}), set() {} } },
};

const emptyElement = new FakeElement("div");
global.ZSProvider = {
  id: "smoke", displayName: "Smoke Provider", timings: { RESPONSE_TIMEOUT_MS: 1000, STABLE_MS: 10 },
  supportsVision: false,
  init() {}, snapshot: () => ({}), isGenerating: () => false, isHardGenerating: () => false,
  isBusyNow: () => false, isFreshChat: () => true, chatIsEmpty: () => true,
  conversationKey: () => "", allItems: () => [], assistantCount: () => 0, userCount: () => 0,
  lastAssistant: () => null, lastAssistantId: () => null, itemText: () => "", streamLen: () => 0,
  classifyText: () => "", isUserItem: () => false, isAssistantItem: () => false,
  getEditor: () => null, composerFrame: () => null, editorText: () => "",
  enforceComposer() {}, setInputLock() {}, installSendHooks() {},
  findToolBlockSpot: () => null, turnHalted: () => false,
  itemKey: () => null, stopGeneration() {},
  get emptyElement() { return emptyElement; },
};

for (const file of ["core/config.js", "core/parser.js", "core/main.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(here, file), "utf8"), { filename: file });
}

setImmediate(() => {
  if (!document.getElementById("zs-root")) throw new Error("core UI did not initialize");
  if (typeof messageListener !== "function") throw new Error("runtime listener was not registered");
  let status;
  messageListener({ type: "sll-session-status" }, {}, (value) => { status = value; });
  if (!status || status.provider !== "smoke" || status.active !== false) {
    throw new Error("session status contract failed");
  }
  console.log("PASS  core/main runtime initialization");
});
