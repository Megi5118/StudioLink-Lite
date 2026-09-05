<h1 align="center">StudioLink Lite</h1>

<p align="center"><b>Minimal browser-to-Roblox Studio AI bridge.</b></p>

<p align="center">
  <img src="assets/studiolink-hero.jpg" alt="StudioLink Lite" width="100%">
</p>

StudioLink Lite connects supported browser AI chats with Roblox Studio through a local StudioMCP bridge. No API key is required for browser providers.

## Requirements

- Python 3
- Chromium-based browser
- Roblox Studio
- StudioMCP

## Setup

1. Load `studiolink-lite-extension` as an unpacked browser extension.
2. Start the local bridge with `start.bat` on Windows or `MacOS_Start.command` on macOS.
3. Open Roblox Studio and a supported AI provider.
4. Select the provider in the extension and start the session.

**Supported providers:** ChatGPT, Gemini, DeepSeek, Kimi, GLM, Qwen, Arena, Meta AI and Hy4/WorkBuddy.

## Updating to 1.6.4

Replace your `studiolink-lite-extension` folder with the latest copy, reload StudioLink Lite on your browser's extensions page, and reload the ChatGPT tab. The extension should show version **1.6.4**. Start a new chat and click **Start Roblox agent**.

This update fixes incorrect full-message validation with ChatGPT's paragraph-based composer. Your local bridge configuration does not need to change.

## License

GPL-3.0-or-later. See `LICENSE` and `NOTICE.md`.
