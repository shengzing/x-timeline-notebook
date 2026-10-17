# X Timeline Notebook

A local-first Chrome MV3 extension for keeping personal reading notes about
posts you read on X / Twitter profile timelines.

![Platform](https://img.shields.io/badge/platform-Chrome%20MV3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## What it does

While you read an X profile page, X Timeline Notebook saves the information you
are already seeing in your own browser:

- publication time
- post text
- links included in the post
- image and video URLs
- post URL
- author handle and display name

It is designed for personal reading notes, research logs, and local reference.

## Features

- Saves timeline information while you read
- Keeps a local notebook per profile
- Page-by-page reading mode with a manual stop button
- Live total and session counters on the page and in the popup
- Deduplicates posts by status ID
- JSONL and CSV export
- No analytics, no remote upload, no account system

## Use within the rules

This extension does not bypass login, rate limits, verification systems, or
any other access control. It only works with information your own browser can
already display.

You are responsible for:

- complying with X’s Terms of Service, Developer Policy, and applicable law;
- respecting copyright and other people’s rights;
- obtaining permission before using or republishing content where required.

Please use this project only for lawful personal notes and research. Do not use
it to build spam, harassment, surveillance, or bulk data products.

## Data Fields

| Field | Description |
|---|---|
| `publishedAt` | Post timestamp |
| `author.handle` / `author.name` | Author information |
| `content` | Post text |
| `links` | Links found in the post |
| `media` | Image and video URLs |
| `tweetUrl` | Post URL |
| `statusId` | Post status ID |
| `sourceUrl` | Page where the note was saved |
| `savedAt` | Save timestamp |

## Installation

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository’s root directory.
5. Open a profile such as `https://x.com/wquguru`.

## Usage

### While reading

Open an X profile and read it normally. Timeline information shown in your
browser is saved to your local notebook.

### Assisted reading mode

1. Click the extension icon.
2. Enter the number of posts you plan to review.
3. Click **开始**.
4. The extension advances the timeline page by page until it reaches your
   review target.
5. Click **停止** to stop at any time.

Assisted reading is intentionally paced, requires user action to start, and
includes a manual stop. It is not designed to bypass platform controls.

### Export

Click **导出** in the popup to export:

- Current profile as JSONL
- Current profile as CSV
- All notes as JSONL
- All notes as CSV

## Local data

All data is stored only in `chrome.storage.local`. The extension keeps up to
5000 notes. You can clear the current profile’s notes or all notes from the
popup at any time.

## Limitations

- X frequently changes its page structure. Selectors may need updates.
- Protected accounts and restricted pages remain inaccessible if your browser
  cannot legitimately view them.
- Some dynamically loaded media URLs may not be available until the post is
  visible.

## Development

```bash
node --check src/content.js
node --check src/background.js
node --check popup/popup.js
python3 -m json.tool manifest.json > /dev/null
```

## Privacy

See [PRIVACY.md](PRIVACY.md).

## Security

See [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
