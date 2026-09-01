// SPDX-License-Identifier: GPL-3.0-or-later
const fs = require("fs");
const vm = require("vm");

const documentElement = {};
const document = {
  documentElement,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
};
class MutationObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
}

const context = vm.createContext({
  document,
  window: {},
  location: { pathname: "/app", search: "" },
  MutationObserver,
  Event,
  InputEvent: class {},
  KeyboardEvent: class {},
  setTimeout,
  clearTimeout,
  console,
});
const source = fs.readFileSync(`${__dirname}/providers/hy4.js`, "utf8");
vm.runInContext(source, context, { filename: "providers/hy4.js" });
const provider = vm.runInContext("ZSProvider", context);

const functions = [
  "init", "allItems", "isUserItem", "isAssistantItem", "itemText", "classifyText",
  "assistantCount", "userCount", "lastAssistant", "readAssistant", "streamLen", "snapshot",
  "getEditor", "editorText", "chatIsEmpty", "isFreshChat", "composerFrame", "barAnchor",
  "setInputLock", "typeAndSend", "stopGeneration", "isGenerating", "isBusyNow",
  "isHardGenerating", "enforceComposer", "ensureComposerReady", "turnHalted",
  "findContinueBtn", "clickContinueBtn", "scanError", "isTooLongMsg", "isBusyMsg",
  "attachImages", "clearAttachments", "conversationKey", "installSendHooks", "findToolBlockSpot",
];

if (provider.id !== "hy4") throw new Error(`unexpected provider id: ${provider.id}`);
if (provider.displayName !== "Hy4 (WorkBuddy)") throw new Error(`unexpected display name: ${provider.displayName}`);
for (const name of functions) {
  if (typeof provider[name] !== "function") throw new Error(`missing provider function: ${name}`);
}
if (provider.conversationKey() !== "") throw new Error("fresh WorkBuddy route must have a transient key");
if (!provider.chatIsEmpty()) throw new Error("empty fixture should be recognized as empty");
console.log("PASS  Hy4 provider contract");
