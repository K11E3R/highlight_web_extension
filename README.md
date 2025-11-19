# Persistent Highlighter

A modern Chrome extension that lets you highlight any text on the web, add notes, and automatically restore highlights when you revisit pages.

## Features

- 🎨 **Beautiful UI** - Clean, modern interface with smooth animations
- ✍️ **Smart Highlighting** - Select text and highlight with custom colors
- 📝 **Notes** - Add contextual notes to your highlights
- 🔍 **Search** - Quickly find highlights by text or notes
- 💾 **Auto-save** - Highlights persist across sessions
- 🎯 **Quick Actions** - View, copy, edit, or delete highlights instantly
- 🌙 **Dark Mode** - Automatic dark mode support

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
   This will automatically generate the extension icons.

3. Load the extension in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select this repository folder

## Usage

1. **Create a highlight:**
   - Select text on any webpage
   - Open the extension popup
   - Click "Highlight Selection"

2. **Add notes:**
   - Click on any highlight in the popup
   - Type your note in the text area
   - Click "Save" or press Ctrl/Cmd + Enter

3. **Change colors:**
   - Use the color chips or color picker
   - Changes auto-save after 500ms

4. **Search highlights:**
   - Use the search box to filter highlights by text or notes

5. **Context menu:**
   - Right-click selected text
   - Choose "Highlight selection"

## Limitations

- PDF files are not supported (use HTML versions when available)
- Chrome internal pages (`chrome://`) are not supported
- Some pages may restrict content script execution

## Development

```bash
# Generate icons
npm run generate:icons

# Lint extension
npx web-ext lint --source-dir .
```

## License

MIT
