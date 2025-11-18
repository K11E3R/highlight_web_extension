# Persistent Highlighter

A Chrome extension that lets you highlight any text on the web, add contextual notes, and automatically restores those highlights when you revisit the page. Every page gets its own set of stored highlights, so you always pick up exactly where you left off.

## Features

- ✍️ **Create highlights** from the popup with a single click, complete with custom notes and color swatches.
- 🧠 **Automatic restore** – highlights are scoped per-URL and reapplied on load, so context is never lost.
- 🎨 **Polished editing UI** with live search, character counts, quick color chips, and inline note editing.
- 🔍 **Navigate fast** using “View on page” (smooth scroll + pulse animation) or copy highlight text to the clipboard.
- 🧹 **Full CRUD** controls including one-click clearing of all highlights on the current page.

## Development

1. Visit `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this repository folder.
4. Navigate to any page, select text, open the extension popup, and click **Highlight current selection**.
5. Use the popup to search, edit, or delete highlights. Click **View** to center a highlight on the page or **Clear page** to wipe them all.

All data lives in `chrome.storage.local`, so nothing leaves the device.

## Testing

Run the automated manifest/lint check with [`web-ext`](https://github.com/mozilla/web-ext):

```bash
npx web-ext lint --source-dir .
```

This validates the Manifest V3 wiring and ensures the extension loads without warnings.
