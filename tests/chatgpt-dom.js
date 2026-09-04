// SPDX-License-Identifier: GPL-3.0-or-later
// Serve the repository locally, open tests/chatgpt-dom.html, click Run tests.
// Exercises the actual provider with Chromium's editing pipeline, not a DOM mock.
/* global ZSProvider */
(function () {
  const P = ZSProvider;
  const fixture = document.getElementById("fixture");
  const results = document.getElementById("results");
  const nativeExec = document.execCommand;
  const realNow = Date.now;
  let passed = 0, failed = 0, clicks = 0;
  const assert = (ok, detail) => { if (!ok) throw new Error(detail); };
  const normalize = (s) => s.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  function mount(editor = '<div id="prompt-textarea" contenteditable="true"></div>', button = '') {
    P.setInputLock(false);
    clicks = 0;
    fixture.innerHTML = `<form><div data-composer-surface>${editor}<button type="button" id="composer-submit-button" data-testid="send-button" ${button}>Send</button></div></form>`;
    fixture.querySelector("form").addEventListener("submit", (e) => e.preventDefault());
    fixture.querySelector("button").addEventListener("click", () => clicks++);
    return P.getEditor();
  }
  async function rejects(action, pattern) {
    try { await action(); } catch (e) {
      assert(pattern.test(e.message), `Unexpected error: ${e.message}`);
      assert(clicks === 0, "No submit or Stop click is allowed on failure");
      return;
    }
    throw new Error("Expected an explicit rejection");
  }
  async function test(name, action) {
    try { await action(); passed++; results.textContent += `PASS ${name}\n`; }
    catch (e) { failed++; results.textContent += `FAIL ${name}: ${e.message}\n`; }
    finally { document.execCommand = nativeExec; Date.now = realNow; P.setInputLock(false); }
  }
  document.getElementById("run").addEventListener("click", async function () {
    this.disabled = true;
    passed = failed = 0;
    results.textContent = "";
    try {
      await test("hidden obsolete editor is skipped; bar stays outside native grid", () => {
        const ed = mount('<div hidden id="prompt-textarea" contenteditable="true">stale</div><div data-testid="prompt-textarea" contenteditable="true"></div>');
        assert(ed && ed.dataset.testid === "prompt-textarea", "Must select visible editor");
        assert(!P.barMount && P.barAnchor().hasAttribute("data-composer-surface"), "Bar must anchor outside the native grid");
      });
      await test("contenteditable multiline text, blank lines and spaces are sent intact", async () => {
        const ed = mount();
        ed.textContent = "old draft";
        const text = '###LUA###\nlocal n = 1\n\n  print("a  b")\n###END_LUA###';
        await P.typeAndSend(text);
        assert(normalize(P.editorText()) === text, `Readback mismatch: ${JSON.stringify(P.editorText())}`);
        assert(clicks === 1, "Exactly one Send click expected");
      });
      await test("contenteditable lock is restored after successful injection", async () => {
        const ed = mount(); P.setInputLock(true);
        await P.typeAndSend("hello");
        assert(ed.getAttribute("contenteditable") === "false", "Lock not restored");
        assert(clicks === 1, "Expected one send");
      });
      await test("textarea uses native value setter and input event; preserves lock", async () => {
        const ed = mount('<textarea data-testid="prompt-textarea"></textarea>', 'aria-disabled="true"');
        let sawValue = "";
        ed.addEventListener("input", () => {
          sawValue = ed.value;
          fixture.querySelector("button").removeAttribute("aria-disabled");
        });
        P.setInputLock(true);
        await P.typeAndSend("line 1\n\n  line 3");
        assert(sawValue === "line 1\n\n  line 3", "Controlled input did not see new value");
        assert(P.editorText() === sawValue && ed.readOnly && clicks === 1, "Textarea value/lock/send mismatch");
      });
      await test("Lexical fallback is recognized only as a visible editable element", async () => {
        const ed = mount('<div data-lexical-editor="true" contenteditable="true"></div>');
        assert(ed, "Lexical editor not recognized");
        await P.typeAndSend("hello lexical");
        assert(clicks === 1, "Fallback send failed");
      });
      await test("ignored browser edit fails without submitting and restores lock", async () => {
        const ed = mount(); ed.textContent = "original"; P.setInputLock(true);
        document.execCommand = () => false;
        await rejects(() => P.typeAndSend("replacement"), /did not accept the complete message/);
        assert(ed.getAttribute("contenteditable") === "false", "Lock not restored on error");
      });
      await test("editor replaced by page during input is not submitted", async () => {
        const ed = mount();
        ed.addEventListener("input", () => ed.replaceWith(ed.cloneNode(true)), { once: true });
        await rejects(() => P.typeAndSend("new text"), /did not accept the complete message/);
      });
      await test("aria-disabled Send is never clicked", async () => {
        mount(undefined, 'aria-disabled="true"');
        await rejects(() => P.typeAndSend("hello"), /disabled Send/);
      });
      await test("native disabled Send is never clicked", async () => {
        mount(undefined, "disabled");
        await rejects(() => P.typeAndSend("hello"), /disabled Send/);
      });
      await test("missing Send button causes an error, not a synthetic Enter", async () => {
        const ed = mount(); fixture.querySelector("button").remove();
        let keys = 0; ed.addEventListener("keydown", () => keys++);
        await rejects(() => P.typeAndSend("hello"), /Send button is unavailable/);
        assert(keys === 0, "Should not attempt blind Enter fallback");
      });
      await test("native Stop remains authoritative after 60 seconds without text", async () => {
        const ed = mount(); ed.textContent = "untouched draft";
        const b = fixture.querySelector("button"); b.dataset.testid = "stop-button";
        fixture.insertAdjacentHTML("afterbegin", '<div data-message-author-role="assistant" data-message-id="reply"><div class="markdown">Thinking...</div></div>');
        assert(P.isGenerating(), "Initial generation not detected");
        const start = realNow(); Date.now = () => start + 60000;
        assert(P.isGenerating() && P.hasActiveGeneration(), "Long reasoning incorrectly treated as a wedge");
        await rejects(() => P.typeAndSend("do not send yet"), /still generating/);
        assert(P.editorText() === "untouched draft", "Draft changed during active generation");
        P.stopGeneration(); assert(clicks === 1, "Explicit user Stop path must remain available");
      });
      await test("lightweight full-navigation shell is rejected before editing", async () => {
        P.setInputLock(false); clicks = 0;
        fixture.innerHTML = '<form data-mobile-composer data-logged-out action="/unauth-mweb/conversation" method="post"><textarea id="mobile-composer-prompt" name="prompt">draft</textarea><button data-composer-submit type="submit">Send</button></form><div data-web-mobile-optimistic-turn hidden><li data-message-role="assistant" data-message-streaming></li></div>';
        fixture.querySelector("form").addEventListener("submit", (e) => e.preventDefault());
        fixture.querySelector("button").addEventListener("click", () => clicks++);
        assert(!P.composerStatus().ready && P.barAnchor() === fixture.querySelector("form"), "Missing readiness warning or bar anchor");
        await rejects(() => P.typeAndSend("hello"), /lightweight ChatGPT page/);
        assert(P.editorText() === "draft", "Unsupported page must keep user's draft");
      });
      await test("hidden lightweight template does not block a full editor", () => {
        mount(); fixture.insertAdjacentHTML("afterbegin", '<form hidden data-mobile-composer></form>');
        assert(P.composerStatus().ready, "Hidden template should not block startup");
      });
      await test("missing input gives actionable readiness status", () => {
        fixture.innerHTML = "";
        assert(!P.composerStatus().ready && /reload/.test(P.composerStatus().detail), "Missing readiness message");
      });
      await test("CodeMirror equal-length replacement refreshes complete code", () => {
        fixture.innerHTML = '<div class="cm-content"><div class="cm-line">truncated</div></div>';
        const c = fixture.firstElementChild;
        const doc = (text) => ({ length: text.length, toString: () => text });
        c.cmTile = { view: { state: { doc: doc("return 1") } } };
        const sync = () => document.dispatchEvent(new CustomEvent("zs-cm-sync"));
        sync(); assert(c.getAttribute("data-zs-cm") === "return 1", "Initial sync missing");
        c.cmTile.view.state.doc = doc("return 2"); sync();
        assert(c.getAttribute("data-zs-cm") === "return 2", "Equal-length code remained stale");
        let writes = 0; const set = c.setAttribute.bind(c);
        c.setAttribute = (...args) => { writes++; return set(...args); }; sync();
        assert(writes === 0, "Unchanged document should not churn attributes");
        c.cmTile = null; sync();
        assert(!c.hasAttribute("data-zs-cm") && !c.hasAttribute("data-zs-cm-len"), "Lost editor retained stale code");
        c.cmTile = { view: { state: { doc: doc("return 3") } } }; sync();
        c.cmTile.view.state.doc = { length: 8, toString() { throw new Error("disposed"); } }; sync();
        assert(!c.hasAttribute("data-zs-cm"), "Unreadable document retained stale code");
      });
    } finally {
      fixture.innerHTML = "";
      results.textContent += `\n${passed} passed, ${failed} failed\n`;
      results.className = failed ? "fail" : "pass";
      document.body.dataset.testResult = failed ? "fail" : "pass";
      this.disabled = false;
    }
  });
})();
