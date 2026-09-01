// SPDX-License-Identifier: GPL-3.0-or-later
// providers/hy4.js - Tencent Hy4 through the official WorkBuddy web app.
//
// Verified against https://www.workbuddy.ai/app on 2026-08-31:
//   - Slate editor: [data-slate-editor=true][role=textbox][contenteditable=true]
//   - send control: button.cr-send-button[aria-label=Send]
//   - composer surface: .cr-input-box
// WorkBuddy does not publish stable message class names. Turn discovery therefore
// uses semantic roles/attributes and DOM order, with a MutationObserver-driven
// stream sampler; it does not depend on guessed private endpoints or fixed waits.
// eslint-disable-next-line no-unused-vars
const ZSProvider = (() => {
  "use strict";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let diag = () => {};
  let sentText = "";
  const learnedRoles = new WeakMap();

  const S = {
    editor: '[data-slate-editor="true"][role="textbox"][contenteditable="true"]',
    composer: ".cr-input-box",
    send: 'button.cr-send-button[aria-label="Send"]',
    semanticTurns: 'article, [role="listitem"], [data-role], [data-author]',
    error: '[role="alert"]',
  };

  const timings = {
    GEN_IDLE_MS: 1800,
    REASON_IDLE_MS: 12000,
    WARMUP_MS: 45000,
    REASON_NOREPLY_MS: 90000,
    STABLE_MS: 9000,
    RESPONSE_TIMEOUT_MS: 300000,
  };

  const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim();
  const getEditor = () => [...document.querySelectorAll(S.editor)].find((el) => !el.closest("#zs-root")) || null;
  const composerFrame = () => {
    const editor = getEditor();
    return (editor && editor.closest(S.composer)) || document.querySelector(S.composer);
  };
  const barAnchor = composerFrame;
  const editorText = () => normalize(getEditor() && getEditor().textContent);

  function explicitRole(element) {
    if (!element) return null;
    const raw = [
      element.getAttribute && element.getAttribute("data-role"),
      element.getAttribute && element.getAttribute("data-author"),
      element.getAttribute && element.getAttribute("aria-label"),
      element.className,
    ].filter(Boolean).join(" ").toLowerCase();
    if (/(^|[\s_-])(user|human)([\s_-]|$)/.test(raw)) return "user";
    if (/(^|[\s_-])(assistant|bot)([\s_-]|$)/.test(raw)) return "assistant";
    return null;
  }

  function rawCandidates() {
    const main = document.querySelector("main");
    if (!main) return [];
    return [...main.querySelectorAll(S.semanticTurns)].filter((element) => {
      if (element.closest("#zs-root") || element.closest(S.composer)) return false;
      if (/wb-home-route__ex-bubble/.test(String(element.className || ""))) return false;
      // Keep only the outermost matching semantic node for each message.
      return !element.parentElement || !element.parentElement.closest(S.semanticTurns);
    });
  }

  function learnRoles() {
    const candidates = rawCandidates();
    for (const element of candidates) {
      const role = explicitRole(element);
      if (role) learnedRoles.set(element, role);
    }
    if (sentText) {
      const wanted = normalize(sentText);
      let userIndex = -1;
      for (let index = candidates.length - 1; index >= 0; index--) {
        const text = normalize(candidates[index].textContent);
        const stablePrefix = wanted.slice(0, 96);
        if (text === wanted ||
            (wanted.length > 24 && (text.includes(wanted) ||
              (text.length > 32 && wanted.includes(text)) ||
              (stablePrefix.length > 32 && text.includes(stablePrefix))))) {
          learnedRoles.set(candidates[index], "user");
          userIndex = index;
          break;
        }
      }
      if (userIndex >= 0) {
        for (let index = userIndex + 1; index < candidates.length; index++) {
          if (!learnedRoles.get(candidates[index])) learnedRoles.set(candidates[index], "assistant");
        }
      }
    }
    return candidates.filter((element) => learnedRoles.has(element));
  }

  const allItems = learnRoles;
  const isUserItem = (item) => learnedRoles.get(item) === "user" || explicitRole(item) === "user";
  const isAssistantItem = (item) => learnedRoles.get(item) === "assistant" || explicitRole(item) === "assistant";
  const itemText = (item) => {
    if (!item) return "";
    const clone = item.cloneNode(true);
    clone.querySelectorAll(".zs-chip, button, [aria-hidden=true]").forEach((node) => node.remove());
    return (clone.innerText || clone.textContent || "").trim();
  };
  const classifyText = (item, excludeSelector) => {
    if (!item) return "";
    const clone = item.cloneNode(true);
    clone.querySelectorAll(`.zs-chip${excludeSelector ? `, ${excludeSelector}` : ""}`).forEach((node) => node.remove());
    return (clone.innerText || clone.textContent || "").trim();
  };
  const assistantItems = () => allItems().filter(isAssistantItem);
  const assistantCount = () => assistantItems().length;
  const userCount = () => allItems().filter(isUserItem).length;
  const lastAssistant = () => assistantItems().at(-1) || null;
  const chatIsEmpty = () => allItems().length === 0;
  const isFreshChat = () => /^\/app\/?$/.test(location.pathname) && chatIsEmpty() && !!getEditor();

  let streamNode = null;
  let streamLength = 0;
  let streamChangedAt = 0;
  function sampleStream() {
    const node = lastAssistant();
    const length = itemText(node).length;
    if (node !== streamNode || length !== streamLength) {
      streamNode = node;
      streamLength = length;
      streamChangedAt = Date.now();
    }
  }
  new MutationObserver(sampleStream).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  const streamLen = () => { sampleStream(); return streamLength; };

  function semanticButton(pattern) {
    const frame = composerFrame() || document;
    return [...frame.querySelectorAll("button")].find((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`;
      return pattern.test(label);
    }) || null;
  }
  const stopButton = () => semanticButton(/stop|cancel/i);
  function isGenerating() {
    sampleStream();
    return !!stopButton() || (streamLength > 0 && Date.now() - streamChangedAt < timings.GEN_IDLE_MS);
  }
  const isBusyNow = isGenerating;
  const isHardGenerating = () => !!stopButton();

  function readAssistant() {
    const item = lastAssistant();
    return item
      ? { present: true, reply: itemText(item), thinking: "", item }
      : { present: false, reply: "", thinking: "", item: null };
  }
  const snapshot = () => ({ th: 0, rp: itemText(lastAssistant()).length });

  function setInputLock(on) {
    const editor = getEditor();
    if (!editor) return;
    editor.dataset.sllLocked = on ? "1" : "";
    editor.setAttribute("aria-busy", on ? "true" : "false");
  }

  function replaceSlateText(editor, text) {
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    let inserted = false;
    try { inserted = document.execCommand("insertText", false, text); } catch {}
    if (!inserted || normalize(editor.textContent) !== normalize(text)) {
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }
  }

  const sendButton = () => {
    const frame = composerFrame() || document;
    return frame.querySelector(S.send) || document.querySelector(S.send);
  };
  async function typeAndSend(text) {
    const editor = getEditor();
    if (!editor) throw new Error("WorkBuddy input box not found");
    sentText = text;
    replaceSlateText(editor, text);
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const button = sendButton();
      if (button && !button.disabled && normalize(editor.textContent)) {
        button.click();
        diag("hy4.send", { registered: true });
        return;
      }
      await sleep(100);
    }
    throw new Error("WorkBuddy did not enable its Send button");
  }
  function stopGeneration() {
    const button = stopButton();
    if (button) button.click();
  }

  const enforceComposer = () => ({ ready: !!getEditor() });
  async function ensureComposerReady(reason) {
    diag("mode_ready", { reason, provider: "hy4" });
    return { ready: !!getEditor() };
  }
  const turnHalted = () => false;
  const findContinueBtn = () => [...document.querySelectorAll("button")].find((b) => /^(continue|resume)$/i.test(normalize(b.textContent))) || null;
  const clickContinueBtn = () => { const button = findContinueBtn(); if (button) button.click(); return !!button; };
  function scanError() {
    for (const element of document.querySelectorAll(S.error)) {
      const text = normalize(element.textContent);
      if (text.length > 8 && text.length < 500) return text;
    }
    if (!getEditor()) return "WorkBuddy's input box is unavailable. Sign in or return to /app.";
    return null;
  }
  const isTooLongMsg = (text) => /context|conversation.{0,20}(too long|limit)|maximum.{0,20}tokens/i.test(text || "");
  const isBusyMsg = (text) => /server is busy|try again later|something went wrong/i.test(text || "");
  const attachImages = async () => false;
  const clearAttachments = () => {};
  const conversationKey = () => (/^\/app\/?$/.test(location.pathname) ? "" : location.pathname + location.search);

  function installSendHooks(handlers) {
    document.addEventListener("keydown", (event) => {
      const editor = getEditor();
      if (!editor || !editor.contains(event.target) || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      if (!editorText()) return;
      if (handlers.isBlocked()) { event.preventDefault(); return; }
      if (!handlers.isStarted()) {
        if (chatIsEmpty()) handlers.onBlockedAttempt();
        return;
      }
      handlers.onUserMessage(assistantCount());
    }, true);
    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest && event.target.closest("button");
      if (!button) return;
      if (button === stopButton()) { handlers.onNativeStop(); return; }
      if (button !== sendButton() || button.disabled || !editorText()) return;
      if (handlers.isBlocked()) { event.preventDefault(); return; }
      if (!handlers.isStarted()) {
        if (chatIsEmpty()) handlers.onBlockedAttempt();
        return;
      }
      handlers.onUserMessage(assistantCount());
    }, true);
  }

  const COMMAND = /"(?:command|tool)"\s*:\s*"|###\s*lua|###mcp_tool###/i;
  function findToolBlockSpot(item) {
    if (!item) return null;
    for (const block of item.querySelectorAll("pre, code")) {
      if (COMMAND.test(block.textContent || "")) {
        const wrapper = block.closest("pre") || block;
        wrapper.classList.add("zs-tool-hide");
        item.classList.add("zs-cmd-mask");
        return { parent: wrapper.parentElement, ref: wrapper };
      }
    }
    return null;
  }

  return {
    id: "hy4",
    displayName: "Hy4 (WorkBuddy)",
    supportsVision: false,
    timings,
    reliableCounts: false,
    chipAtItemLevel: true,
    chipAppend: true,
    unstableWarning:
      "WorkBuddy is Tencent's official Hy4 access path, but model availability and routing depend on your WorkBuddy account. Select Hy4 in WorkBuddy when that option is shown.",
    init({ diag: value } = {}) { if (value) diag = value; },
    allItems, isUserItem, isAssistantItem, itemText, classifyText,
    assistantCount, userCount, lastAssistant, readAssistant, streamLen, snapshot,
    getEditor, editorText, chatIsEmpty, isFreshChat, composerFrame, barAnchor,
    setInputLock, typeAndSend, stopGeneration,
    isGenerating, isBusyNow, isHardGenerating,
    enforceComposer, ensureComposerReady,
    turnHalted, findContinueBtn, clickContinueBtn,
    scanError, isTooLongMsg, isBusyMsg,
    attachImages, clearAttachments, conversationKey,
    installSendHooks, findToolBlockSpot,
  };
})();
