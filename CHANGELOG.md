# Changelog

## 1.6.0 - StudioLink Lite

- Rebranded the user-facing project, extension, bridge, launchers and status messages.
- Replaced the promotional UI with a compact development popup and in-page panel.
- Removed donation, Robux, social, community, website and tutorial promotion.
- Added separate Bridge, Roblox Studio and Agent status states.
- Added popup provider selection and Start/Stop session controls.
- Added Tencent Hy4 support through the official WorkBuddy browser interface.
- Preserved all existing browser providers and the provider-independent agent loop.
- Kept localhost-only WebSocket transport, reconnect, heartbeat and stale-socket recovery.
- Added strict bridge origin, message, request ID, tool argument and timeout validation.
- Removed webpage-controlled MCP process add/remove and restricted local process launch to the bundled Roblox Studio launcher.
- Kept StudioMCP discovery, launch, command discovery, tool execution and restart recovery.
- Added StudioLink Lite artwork, setup documentation, runtime smoke coverage, security tests and release checks.

The original project history is preserved in `UPSTREAM_CHANGELOG.md`.
