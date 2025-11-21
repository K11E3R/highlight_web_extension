# Persistent Highlighter

A Chrome extension that lets you highlight text on web pages, organize with categories, and share with others.

## Features

- 🎨 Highlight text with custom colors
- 📝 Add notes to highlights
- 📁 **Organize with categories**
- 🔍 **Filter by category**
- 📤 **Selective export** - Export specific categories
- 📥 **Smart import** - Assign categories during import
- 💾 Auto-save across sessions
- 🌙 Dark mode support

## Installation

1. Clone this repository
2. Run `npm install` to generate icons
3. Open `chrome://extensions` in Chrome
4. Enable "Developer mode"
5. Click "Load unpacked" and select this folder

## Usage

### Basic Highlighting
- Select text on any page
- Choose a color from the floating toolbar
- Or right-click and select "Highlight selection"

### Categories (NEW!)
1. **Create categories**: Click + button → Enter name → Add
2. **Assign to highlights**: Use dropdown in each highlight card
3. **Filter**: Select category from top dropdown
4. **Manage**: Click + button to open category manager

### Export/Import (NEW!)
**Export:**
- Click Export button
- Select which categories to export (checkboxes)
- Download JSON file

**Import:**
- Click Import button
- Select JSON file
- Choose category assignment or keep originals
- Highlights merge with existing ones

## File Format

Exports create JSON files in this format:

```json
{
  "version": "1.0",
  "exportDate": "2025-11-21T...",
  "categories": ["Work", "Research"],
  "count": 10,
  "highlights": [
    {
      "id": "...",
      "text": "Highlighted text",
      "note": "Your note",
      "color": "#FFEB3B",
      "category": "Work",
      "url": "https://...",
      "createdAt": 1700000000,
      "range": { /* position data */ }
    }
  ]
}
```

## Use Cases

- **Research**: Organize highlights by project or topic
- **Work**: Separate work and personal highlights
- **Learning**: Categorize by subject or language
- **Collaboration**: Export specific categories to share with team
- **Backup**: Export all highlights for safekeeping

## Development

```bash
npm install              # Generate icons
npm run generate:icons   # Regenerate icons
```

## License

MIT
