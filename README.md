# StudioLink Lite

Minimal browser-to-Roblox Studio AI bridge.

## Requirements

- Python 3
- Chromium-based browser
- Roblox Studio
- StudioMCP

## Setup

1. Load `studiolink-lite-extension` as an unpacked browser extension.
2. Start the local bridge with `start.bat` on Windows or `MacOS_Start.command` on macOS.
3. Open Roblox Studio and your supported AI provider.
4. Select the provider in the extension and start the session.

Supported browser providers include ChatGPT, Gemini, DeepSeek, Kimi, GLM, Qwen, Arena, Meta AI and Hy4/WorkBuddy.

The bridge communicates locally with Roblox Studio through StudioMCP. No API key is required for browser providers.

## License

GPL-3.0-or-later. See `LICENSE` and `NOTICE.md`.
