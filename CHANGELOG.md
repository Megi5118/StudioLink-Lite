# Changelog

## 1.6.2 - ChatGPT layout only

- Keep the StudioLink bar outside ChatGPT's native composer grid. A missing named `header` area can no longer create an implicit column that squeezes the input and send/voice controls.
- Anchor the bar across the top of the composer, reserve clearance above the input and wrap only the extension's controls on narrow widths.
- Remove the obsolete ChatGPT grid-area and bottom-padding overrides. No agent, bridge or other-provider behavior changes.
- Add a real-browser layout regression page covering old/new grids, empty/multiline input, narrow widths and editor replacement.

## 1.6.1 - ChatGPT adapter reliability patch

- Preserve ChatGPT's native Stop signal through long reasoning pauses; never auto-click Stop to unstick a send.
- Find the visible composer, support textarea input and verify the entire injected message before submitting.
- Respect both native and ARIA-disabled Send controls; report missing/blocked controls explicitly.
- Detect the lightweight, full-navigation ChatGPT shell and require the supported full interface instead of attempting a broken bootstrap.
- Reject incomplete startup responses and preserve that state across reloads and navigation; do not send delayed startup feedback into another chat.
- Refresh CodeMirror snapshots for equal-length code replacements and discard inaccessible stale snapshots.
- Add focused browser DOM and core startup regression tests. Bridge code, permissions and other providers are unchanged.

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
