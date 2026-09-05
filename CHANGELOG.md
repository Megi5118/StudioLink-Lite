# Changelog

## 1.6.4

- Fixed false "did not accept the complete message" startup failures caused by ChatGPT's ProseMirror paragraph spacing.
- Read logical composer text from paragraphs and hard breaks, preserving blank lines and code indentation while ignoring editor placeholder breaks.
- Kept complete-message validation: missing lines or truncated input still prevent submission.
- Added composer readback regression tests for the current paragraph layout and large multiline drafts.

## 1.6.3

- Fixed ChatGPT React editor replacement during large message injection.
- Kept fail-closed full-message readback validation.
- Added regression coverage for complete and partial editor replacement.

## 1.6.2

- Fixed ChatGPT integration for the current chatgpt.com layout.
- Improved startup/session reliability and response detection.
- Updated popup and overlay behavior.
- Added ChatGPT DOM, layout and startup regression tests.

## 1.6.0

- Rebranded the project as StudioLink Lite.
- Added the compact local bridge/session UI and Hy4/WorkBuddy support.
- Removed promotional, donation and community UI.
- Hardened localhost bridge and StudioMCP handling.
