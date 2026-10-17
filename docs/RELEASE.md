# Release Guide

1. Update `version` in `manifest.json`.
2. Update `CHANGELOG.md`.
3. Run validation:

```bash
node --check src/content.js
node --check src/background.js
node --check popup/popup.js
python3 -m json.tool manifest.json > /dev/null
```

4. Create and push a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

5. Package the extension:

```bash
zip -r x-timeline-notebook-v0.1.0.zip . -x ".git/*" ".github/*" "docs/*" "*.DS_Store"
```

6. Publish on GitHub Releases, or submit the ZIP to the Chrome Web Store if
   distribution through the store is desired.
