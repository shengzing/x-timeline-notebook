# Contributing

Thank you for your interest in X Timeline Notebook.

## Project principles

- Work only with information the user’s own browser can already display.
- Do not add login bypasses, verification bypasses, rate-limit avoidance, or
  access-control circumvention.
- Do not add remote data upload, telemetry, or account systems.
- Keep the project local-first and privacy-preserving.
- Prefer defensive DOM parsing so page changes fail safely.

## Local development

1. Install Node.js for syntax checks and packaging.
2. Open `chrome://extensions/` and enable Developer mode.
3. Click **Load unpacked** and select this repository.
4. Open an X profile page and test your changes.

## Before opening a PR

```bash
node --check src/content.js
node --check src/background.js
node --check popup/popup.js
python3 -m json.tool manifest.json > /dev/null
```

## Pull request guidelines

- Keep changes focused and describe how you tested them.
- Do not include personal accounts, private data, or exported notes.
- For DOM-related changes, describe the X page structure you tested against.
- Do not propose features intended for bulk harvesting or platform abuse.
