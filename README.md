# Persistent Highlighter

A Chrome extension that lets you highlight any text on the web, add contextual notes, and automatically restores those highlights when you revisit the page. Every page gets its own set of stored highlights, so you always pick up exactly where you left off.

## Features

- ✍️ **Create highlights** from the popup with a single click, complete with custom notes and color swatches.
- 🧠 **Automatic restore** – highlights are scoped per-URL and reapplied on load, so context is never lost.
- 🎨 **Polished editing UI** with live search, character counts, quick color chips, and inline note editing.
- 🔍 **Navigate fast** using “View on page” (smooth scroll + pulse animation) or copy highlight text to the clipboard.
- 🧹 **Full CRUD** controls including one-click clearing of all highlights on the current page.
- 🖼️ **Custom icon set** so the extension looks at home in Chrome’s toolbar, action menu, and Web Store listing.
  The icons are procedurally generated to keep the repo binary-free—see [Icon generation](#icon-generation).

## Development

1. **Install dependencies & generate icons**

   ```bash
   npm install
   ```

   The repository can’t store binary assets, so installing will automatically run `npm run generate:icons` (via a `postinstall` hook) to draw the highlighter artwork into `icons/icon*.png`.

2. Visit `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this repository folder.
5. Navigate to any page, select text, open the extension popup, and click **Highlight current selection**.
6. Use the popup to search, edit, or delete highlights. Click **View** to center a highlight on the page or **Clear page** to wipe them all.

All data lives in `chrome.storage.local`, so nothing leaves the device. If you ever want to refresh the branding, re-run `npm run generate:icons` to regenerate the PNGs.

## Icon generation

The repository intentionally avoids binary blobs (some tooling rejects them), so the toolbar/Web Store art is generated on-demand. The `scripts/generate-icons.js` helper draws the layered highlighter motif using [`pngjs`](https://github.com/lukeapage/pngjs) and exports the required 16/32/48/128 px PNGs. Run `npm run generate:icons` whenever you want to tweak colors or regenerate the files—Chrome will automatically pick up the updated artwork the next time you reload the unpacked extension.

## Testing

Run the automated manifest/lint check with [`web-ext`](https://github.com/mozilla/web-ext) (requires Node.js) to validate the manifest and icons (be sure the generated icons exist first by running `npm install`):

```bash
npx web-ext lint --source-dir .
```

This validates the Manifest V3 wiring and ensures the extension loads without warnings.
