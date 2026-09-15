# Changelog

## 2.0.2

- Read the full payload of WorkBuddy long-text chips when checking input and identifying sent messages.
- Preserve strict complete-message validation instead of comparing the collapsed preview.

## 2.0.1

- Fixed WorkBuddy/Hy4 startup by pasting through Slate instead of replacing its DOM.
- Respect disabled send controls, prevent self-interception and verify send acknowledgement.
- Coalesce WorkBuddy stream scans and ignore changes inside the extension toolbar.

## 2.0.0

- Published the complete StudioLink Lite package as the 2.0 release.
- Replaced the previous repository build with the uploaded 2.0 codebase.

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
