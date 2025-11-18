# Persistent Highlighter

A Chrome extension that lets you highlight any text on the web, add contextual notes, and automatically restores those highlights when you revisit the page. Every page gets its own set of stored highlights, so you always pick up exactly where you left off.

## Features

- ✍️ **Create highlights** from any selection directly from the popup.
- 🗂 **Read** a structured list of all highlights saved for the current tab.
- ✏️ **Update** the note or color for any highlight.
- 🗑 **Delete** highlights you no longer need, instantly removing them from the page.
- ♻️ Highlights are persisted in `chrome.storage.local`, so they re-apply automatically the next time you load the same URL.

## Development

1. Visit `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this repository folder.
4. Navigate to any page, select text, open the extension popup, and click **Highlight selection**.

The popup shows all highlights for the active tab, lets you edit notes/colors (update), and remove items. Storage happens entirely on-device.
