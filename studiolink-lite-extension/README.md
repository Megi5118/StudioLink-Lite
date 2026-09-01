# StudioLink Lite extension

This folder is the unpacked Chromium Manifest V3 extension.

## Install

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `studiolink-lite-extension` folder.

The Python bridge must be running on `ws://127.0.0.1:17613`.

## Internal architecture

```text
background.js             MV3 WebSocket owner, reconnect, heartbeat, status cache
core/config.js            common prompt and feedback messages
core/parser.js            pure command parsing and malformed-call recovery
core/main.js              agent loop, result injection, dedupe, cancel, session UI
providers/*.js            one DOM adapter per supported AI website
popup.html / popup.js     Bridge, Studio and Agent status plus session controls
```

Every provider exports the same `ZSProvider` contract. The legacy global name is retained as an internal compatibility boundary; visible product naming is StudioLink Lite.

## Provider contract

A browser provider supplies:

- conversation turn enumeration and role classification
- composer lookup, text insertion and submission
- generation and completion signals
- response extraction without reasoning/tool chrome
- stop/continue controls
- SPA conversation identity
- send interception and command-block placement

`providers/hy4.js` implements Tencent Hy4 access through WorkBuddy's official web interface. The verified WorkBuddy composer is Slate-based. Turn collection uses semantic DOM roles plus mutation/state observation because WorkBuddy does not publish stable message class names.

## Local protocol

Content scripts can request only status, tool discovery, a validated MCP tool call, StudioMCP restart or WebSocket reconnect. They cannot provide shell commands, add MCP processes or change local bridge configuration. The bridge accepts only the fixed `roblox` configuration entry and always launches the bundled StudioMCP discovery script.

See the project root [README](../README.md) for setup, use, limitations and license attribution.
