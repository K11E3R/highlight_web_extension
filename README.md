# Persistent Highlighter

A **modern, minimal Chrome extension** that lets you highlight text, organize with categories, and share with others.

## ✨ Features

### Core Features
- 🎨 **Clean Highlighting** - Select text and highlight with custom colors
- 📝 **Smart Notes** - Add contextual notes to your highlights
- 📁 **Horizontal Categories** - Quick filter with scrollable chips
- 🔍 **One-Tap Filtering** - See all categories at a glance
- 💾 **Auto-save** - Highlights persist across sessions

### Modern Design
- 🎯 **Minimal UI** - Clean, no clutter, content-first
- ⚡ **Fast & Light** - Subtle animations, instant feedback
- 🎨 **Coral Accent** - Warm, professional color scheme
- 📱 **Compact Cards** - See more highlights at once
- 🌙 **Dark Mode** - Automatic dark theme support
- 💫 **Smooth Interactions** - Hover states, fade-ins, transitions
- 🎀 **Ribbon Mode** - Beautiful decorative ribbons (toggleable!)

## Installation

1. **Clone this repository**
   ```bash
   git clone https://github.com/K11E3R/highlight_web_extension.git
   cd highlight_web_extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   This automatically generates the extension icons.

3. **Load in Chrome**
   - Open `chrome://extensions`
   - Enable **"Developer mode"** (toggle in top right)
   - Click **"Load unpacked"**
   - Select this repository folder

4. **Enjoy!** 🎉
   - Pin the extension to your toolbar
   - Visit any webpage and start highlighting

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

### Advanced Features
- 📤 **Selective Export** - Choose specific categories to export
- 📥 **Smart Import** - Assign categories during import
- 🎀 **Ribbon Decorations** - Toggle beautiful corner/banner ribbons
- ✨ **Custom Cursor** - Special cursor when ribbon mode is active
- 🌟 **4 Ribbon Styles** - Automatic style rotation
**Export:**
- Click Export button
- Select which categories to export (checkboxes)
- Download JSON file

**Import:**
- Click Import button
- Select JSON file
- Choose category assignment or keep originals
- Highlights merge with existing ones

## 🎨 Design Philosophy

**Modern Minimalism**
- Clean, uncluttered interface
- Content-first approach
- Subtle, purposeful effects
- Fast and responsive

**Key Features:**
- **Horizontal Category Chips** - All visible, one-tap selection
- **Compact Cards** - See more content at once
- **Fade-in Actions** - Clean until you need them
- **Light Shadows** - Just enough depth
- **Coral Accent** - Warm, professional, friendly

See `NEW_MINIMAL_DESIGN.md` for complete design documentation.

---

## 📚 Documentation

- **[Ribbon Feature Guide](./RIBBON_FEATURE.md)** - Complete ribbon mode documentation
- **[Architecture](./architecture.md)** - Technical architecture and data flow

---

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
