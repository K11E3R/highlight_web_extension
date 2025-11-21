# Extension Architecture

## Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Tab                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Content Script (contentScript.js)       │  │
│  │  - Injects highlighting UI                        │  │
│  │  - Manages DOM modifications                      │  │
│  │  - Handles text selection                         │  │
│  │  - Restores highlights on page load               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↕️ Messages
┌─────────────────────────────────────────────────────────┐
│          Background Service Worker (background.js)      │
│  - Manages storage operations                           │
│  - Handles categories CRUD                              │
│  - Context menu integration                             │
│  - Cross-tab communication                              │
└─────────────────────────────────────────────────────────┘
                          ↕️ Storage API
┌─────────────────────────────────────────────────────────┐
│              Chrome Local Storage                       │
│  - persistentHighlighterEntries (highlights by URL)     │
│  - persistentHighlighterCategories (category list)      │
└─────────────────────────────────────────────────────────┘
                          ↕️ Messages
┌─────────────────────────────────────────────────────────┐
│               Popup UI (popup.html/js)                  │
│  - Display highlights list                              │
│  - Category management                                  │
│  - Export/Import functionality                          │
│  - Filter and search                                    │
└─────────────────────────────────────────────────────────┘
```

## Message Flow

### Creating a Highlight
```
User selects text
  → Content Script shows tooltip
  → User clicks color
  → Content Script highlights DOM
  → Content Script → Background: SAVE_HIGHLIGHT
  → Background → Storage: Save data
  → Background → Content Script: Success
```

### Loading Highlights
```
Page loads
  → Content Script initializes
  → Content Script → Background: GET_HIGHLIGHTS
  → Background → Storage: Retrieve by URL
  → Background → Content Script: Highlight data
  → Content Script applies highlights to DOM
```

### Category Operations
```
User creates category
  → Popup → Background: ADD_CATEGORY
  → Background → Storage: Save categories
  → Background → Popup: Updated list
  → Popup refreshes UI
```

### Export with Categories
```
User clicks Export
  → Popup shows category selection modal
  → User selects categories
  → Popup → Background: GET_HIGHLIGHTS
  → Background → Storage: Retrieve data
  → Popup filters by selected categories
  → Popup generates JSON file
  → Browser downloads file
```

### Import with Categories
```
User selects file
  → Popup reads and validates JSON
  → Popup shows import modal
  → User selects category assignment
  → Popup → Background: IMPORT_HIGHLIGHTS
  → Background merges data with existing
  → Background → Storage: Save updated data
  → Popup → Content Script: Refresh highlights
  → Content Script reloads highlights
```

## Storage Structure

```javascript
// Chrome Local Storage
{
  "persistentHighlighterEntries": {
    "https://example.com": [
      {
        "id": "uuid",
        "text": "highlighted text",
        "note": "user note",
        "color": "#FFEB3B",
        "category": "Work",
        "url": "https://example.com",
        "title": "Page Title",
        "createdAt": 1700000000000,
        "range": {
          "startXPath": "...",
          "startOffset": 0,
          "endXPath": "...",
          "endOffset": 10
        }
      }
    ]
  },
  "persistentHighlighterCategories": [
    "Work",
    "Research",
    "Personal"
  ]
}
```

## Key Technologies

- **Manifest V3** - Modern extension architecture
- **Chrome Storage API** - Local data persistence
- **XPath** - DOM node positioning
- **Context Menus API** - Right-click integration
- **Chrome Scripting API** - Dynamic content script injection

