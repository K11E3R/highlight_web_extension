<p align="center">
  <img src="icons/icon128_0.png" alt="Highlighter Pro Logo" width="100" height="100">
</p>

<h1 align="center">✨ Highlighter Pro</h1>

<p align="center">
  <strong>A powerful, beautiful Chrome extension for highlighting, organizing, and managing web content</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#settings">Settings</a> •
  <a href="#shortcuts">Shortcuts</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Version-2.0-success?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License">
</p>

---

## 🎬 Demo

<p align="center">
  <img src="https://via.placeholder.com/800x450/1a1a2e/ffffff?text=Demo+Video+Coming+Soon" alt="Demo Video" width="100%">
</p>

> **📹 Video Demo**: [Watch on YouTube](https://youtube.com) *(Coming Soon)*

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center">
      <img src="https://via.placeholder.com/380x280/667eea/ffffff?text=Popup+Dashboard" alt="Dashboard">
      <br><strong>Dashboard View</strong>
    </td>
    <td align="center">
      <img src="https://via.placeholder.com/380x280/764ba2/ffffff?text=Highlight+Cards" alt="Cards">
      <br><strong>Highlight Cards</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="https://via.placeholder.com/380x280/f093fb/ffffff?text=Quick+Mode" alt="Quick Mode">
      <br><strong>Quick Mode Effects</strong>
    </td>
    <td align="center">
      <img src="https://via.placeholder.com/380x280/4facfe/ffffff?text=Settings+Panel" alt="Settings">
      <br><strong>Settings Panel</strong>
    </td>
  </tr>
</table>

---

## ✨ Features

### 🎨 **Core Highlighting**
| Feature | Description |
|---------|-------------|
| **Multi-Color Palette** | 8 beautiful colors + custom color picker |
| **Smart Selection** | Automatic tooltip appears on text selection |
| **Continuous Highlights** | Clean, unbroken highlight marks |
| **Note Attachments** | Add context with personal notes |
| **Category Organization** | Organize highlights into custom categories |

### 🖥️ **Modern Interface**
| Feature | Description |
|---------|-------------|
| **Glassmorphic Design** | Stunning frosted glass UI with depth |
| **Premium Cards** | 3D perspective tilt, animated borders |
| **Sidebar Navigation** | Quick access to all views |
| **Dashboard Analytics** | Visual stats with color/category charts |
| **Dark/Light Themes** | Automatic system theme detection |

### ⚡ **Quick Mode**
| Feature | Description |
|---------|-------------|
| **One-Click Activation** | Toggle via brand icon |
| **Ribbon Trail Effect** | Colorful cursor trail animation |
| **Splash Cursor** | WebGL fluid simulation effect |
| **Individual Controls** | Enable/disable each effect separately |

### 🔧 **Advanced Features**
| Feature | Description |
|---------|-------------|
| **20+ Settings** | Full customization of behavior |
| **Import/Export** | JSON backup and sharing |
| **PDF Support** | Highlight PDF documents |
| **Search & Sort** | Find highlights instantly |
| **Date Filters** | Filter by time range |
| **Favorites** | Star important highlights |

---

## 📥 Installation

### From Source (Developer Mode)

```bash
# 1. Clone the repository
git clone https://github.com/K11E3R/highlight_web_extension.git
cd highlight_web_extension

# 2. Install dependencies
npm install

# 3. Load in Chrome
# - Open chrome://extensions
# - Enable "Developer mode" (top right toggle)
# - Click "Load unpacked"
# - Select the repository folder
```

### Quick Start
1. **Pin the extension** to your toolbar for easy access
2. **Visit any webpage** and select text
3. **Choose a color** from the floating tooltip
4. **Open the popup** to manage your highlights

---

## 🎯 Usage

### Basic Highlighting

1. **Select text** on any webpage
2. **Color tooltip appears** automatically
3. **Click a color** to highlight
4. **Add notes** via the popup panel

### Quick Mode (Power User Feature)

1. **Click the pen icon** in the popup header
2. **Cursor effects activate** (ribbon trail + splash)
3. **Highlight faster** with enhanced visual feedback
4. **Toggle effects** individually in Settings

### Managing Highlights

| Action | How To |
|--------|--------|
| **View All** | Click extension icon |
| **Edit Note** | Click pencil icon on card |
| **Change Category** | Use dropdown on card |
| **Delete** | Click trash icon |
| **Locate on Page** | Click card to scroll to highlight |
| **Copy Text** | Click copy icon |
| **Toggle Favorite** | Click star icon |

### Categories

```
📁 Default Categories:
├── 📚 Uncategorized (default)
├── 💼 Work
├── 🔬 Research
├── 📖 Personal
└── ➕ Create Custom...
```

### Import/Export

**Export:**
- Open popup → Click sidebar → Export
- Select categories to include
- Download JSON file

**Import:**
- Open popup → Click sidebar → Import
- Select JSON file
- Choose category assignment
- Highlights merge with existing

---

## ⚙️ Settings

### Display Settings
| Setting | Default | Description |
|---------|---------|-------------|
| Expand cards by default | ❌ | Show full card content |
| Show note preview | ✅ | Display notes on cards |
| Show source URL | ✅ | Display page URL |
| Show timestamp | ✅ | Display creation date |
| Show word count | ❌ | Display text length |
| Card animations | ✅ | Enable hover effects |

### Behavior Settings
| Setting | Default | Description |
|---------|---------|-------------|
| Quick mode effects | ✅ | Master toggle for cursor effects |
| ├─ Ribbon trail | ✅ | Colorful ribbon cursor |
| └─ Splash cursor | ✅ | WebGL fluid effect |
| Confirm before delete | ❌ | Ask before removing |
| Auto-save | ✅ | Save changes instantly |
| Click to open | ✅ | Navigate to highlight on click |
| Selection tooltip | ✅ | Show color picker on selection |

### Filter Settings
| Setting | Default | Description |
|---------|---------|-------------|
| Color filter | ✅ | Filter by highlight color |
| Category filter | ✅ | Filter by category |
| Date filter | ✅ | Filter by time range |
| Search | ✅ | Enable search bar |
| Sort options | ✅ | Enable sorting |

---

## ⌨️ Shortcuts

| Shortcut | Action |
|----------|--------|
| `Click` extension icon | Open popup |
| `Select text` | Show highlight tooltip |
| `Ctrl + Click` card | Open source page |
| `Esc` | Close modals/dropdowns |

---

## 🏗️ Architecture

```
highlight_web_extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (data management)
├── contentScript.js       # Page injection (highlighting logic)
├── popup/
│   ├── popup.html         # Popup UI structure
│   ├── popup.js           # Popup logic & state
│   ├── popup.css          # Styles (2000+ lines)
│   ├── ribbons.js         # Ribbon trail effect
│   └── splashCursor.js    # WebGL fluid simulation
├── pdfViewer/             # PDF support
│   ├── viewer.html
│   ├── viewer.js
│   └── viewer.css
├── icons/                 # Extension icons
└── scripts/               # Build tools
```

### Data Flow
```
User Action → Content Script → Background Service → Chrome Storage
                    ↓                    ↓
              DOM Highlight         Popup Update
```

---

## 🎨 Design System

### Color Palette
| Color | Hex | Usage |
|-------|-----|-------|
| Yellow | `#ffd43b` | Default highlight |
| Orange | `#ff922b` | Warm highlight |
| Red | `#ff6b6b` | Important |
| Pink | `#f06595` | Creative |
| Purple | `#cc5de8` | Ideas |
| Blue | `#4dabf7` | Reference |
| Green | `#51cf66` | Verified |
| Teal | `#20c997` | Notes |

### UI Components
- **Glassmorphic cards** with backdrop blur
- **Animated gradient borders** on hover
- **3D perspective tilt** effects
- **Smooth spring animations**
- **Multi-layer shadows** for depth

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **WebGL Fluid Simulation** - Inspired by [Pavel Dobryakov](https://github.com/PavelDoGreat)
- **Ribbon Effect** - Custom implementation
- **Icons** - Generated with custom script

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/K11E3R">K11E3R</a>
</p>

<p align="center">
  <a href="https://github.com/K11E3R/highlight_web_extension/issues">Report Bug</a> •
  <a href="https://github.com/K11E3R/highlight_web_extension/issues">Request Feature</a>
</p>
