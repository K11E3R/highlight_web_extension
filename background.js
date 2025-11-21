const STORAGE_KEY = 'persistentHighlighterEntries';
const CATEGORIES_KEY = 'persistentHighlighterCategories';

async function getHighlightMap() {
  const stored = await chrome.storage.local.get([STORAGE_KEY]);
  return stored[STORAGE_KEY] || {};
}

async function getCategories() {
  const stored = await chrome.storage.local.get([CATEGORIES_KEY]);
  return stored[CATEGORIES_KEY] || [];
}

async function saveCategories(categories) {
  await chrome.storage.local.set({ [CATEGORIES_KEY]: categories });
}

async function addCategory(category) {
  const categories = await getCategories();
  if (!categories.includes(category)) {
    categories.push(category);
    await saveCategories(categories);
  }
  return categories;
}

async function deleteCategory(category) {
  const categories = await getCategories();
  const filtered = categories.filter(c => c !== category);
  await saveCategories(filtered);
  
  // Update all highlights with this category to "uncategorized"
  const map = await getHighlightMap();
  let updated = false;
  
  for (const [url, highlights] of Object.entries(map)) {
    if (Array.isArray(highlights)) {
      highlights.forEach(h => {
        if (h.category === category) {
          h.category = 'uncategorized';
          updated = true;
        }
      });
    }
  }
  
  if (updated) {
    await saveHighlightMap(map);
  }
  
  return filtered;
}

async function saveHighlightMap(map) {
  await chrome.storage.local.set({ [STORAGE_KEY]: map });
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch (error) {
    return url.split('#')[0];
  }
}

async function getHighlightsForUrl(url) {
  const map = await getHighlightMap();
  const cleanUrl = normalizeUrl(url);
  return map[cleanUrl] || [];
}

async function saveHighlight(highlight) {
  const map = await getHighlightMap();
  const cleanUrl = normalizeUrl(highlight.url);
  const existing = map[cleanUrl] || [];
  existing.push(highlight);
  map[cleanUrl] = existing;
  await saveHighlightMap(map);
  return highlight;
}

async function updateHighlight(url, updatedHighlight) {
  const map = await getHighlightMap();
  const cleanUrl = normalizeUrl(url);
  const list = map[cleanUrl] || [];
  const idx = list.findIndex((item) => item.id === updatedHighlight.id);

  if (idx === -1) {
    throw new Error('Highlight not found');
  }

  list[idx] = { ...list[idx], ...updatedHighlight };
  map[cleanUrl] = list;
  await saveHighlightMap(map);
  return list[idx];
}

async function deleteHighlight(url, id) {
  const map = await getHighlightMap();
  const cleanUrl = normalizeUrl(url);
  const list = map[cleanUrl] || [];
  const filtered = list.filter((item) => item.id !== id);

  if (filtered.length) {
    map[cleanUrl] = filtered;
  } else {
    delete map[cleanUrl];
  }

  await saveHighlightMap(map);
  return filtered;
}

async function clearHighlights(url) {
  const map = await getHighlightMap();
  const cleanUrl = normalizeUrl(url);

  if (map[cleanUrl]) {
    delete map[cleanUrl];
    await saveHighlightMap(map);
  }

  return [];
}

async function getAllHighlights() {
  const map = await getHighlightMap();
  const allHighlights = [];

  for (const [url, highlights] of Object.entries(map)) {
    if (Array.isArray(highlights)) {
      highlights.forEach(highlight => {
        allHighlights.push({
          ...highlight,
          sourceUrl: url
        });
      });
    }
  }

  return allHighlights;
}

// background.js
const pendingFocus = {}; // Maps tabId -> highlightId

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'persistentHighlighter.highlight',
    title: 'Highlight selection',
    contexts: ['selection'],
  });
  
  chrome.contextMenus.create({
    id: 'persistentHighlighter.unhighlight',
    title: 'Unhighlight selection',
    contexts: ['selection'],
  });
});

function isRestrictedUrl(url) {
  if (!url) {
    return { restricted: true, reason: 'No URL provided' };
  }

  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol;
    const hostname = parsed.hostname;

    if (protocol === 'chrome:' || protocol === 'chrome-extension:') {
      return {
        restricted: true,
        reason: 'Chrome internal pages are not supported',
        code: 'CHROME_INTERNAL'
      };
    }

    if (hostname === 'chrome.google.com' || hostname.includes('chromewebstore.google.com')) {
      return {
        restricted: true,
        reason: 'Chrome Web Store pages are not supported',
        code: 'CHROME_STORE'
      };
    }

    if (protocol === 'about:') {
      return {
        restricted: true,
        reason: 'about: pages are not supported',
        code: 'ABOUT_PAGE'
      };
    }

    if (url.includes('.pdf') || parsed.pathname.endsWith('.pdf') || parsed.searchParams.get('format') === 'pdf') {
      return {
        restricted: true,
        reason: 'PDF files are not supported. Use HTML version if available.',
        code: 'PDF_FILE',
        suggestion: 'Try the HTML version (e.g., arxiv.org/abs/ instead of arxiv.org/pdf/)'
      };
    }

    return { restricted: false };
  } catch (error) {
    return {
      restricted: true,
      reason: `Invalid URL: ${error.message}`,
      code: 'INVALID_URL'
    };
  }
}

async function ensureContentScript(tabId, url) {
  const restriction = isRestrictedUrl(url);

  if (restriction.restricted) {
    return {
      success: false,
      error: restriction.reason,
      code: restriction.code,
      suggestion: restriction.suggestion
    };
  }

  try {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['contentScript.js']
          }, (results) => {
            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                error: `Failed to inject: ${chrome.runtime.lastError.message}`,
                code: 'INJECTION_FAILED',
                details: chrome.runtime.lastError.message
              });
            } else {
              resolve({ success: true, injected: true });
            }
          });
        } else {
          resolve({ success: true, injected: false });
        }
      });
    });
  } catch (error) {
    return {
      success: false,
      error: `Error: ${error.message}`,
      code: 'INJECTION_ERROR',
      details: error.message
    };
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  
  const isHighlight = info.menuItemId === 'persistentHighlighter.highlight';
  const isUnhighlight = info.menuItemId === 'persistentHighlighter.unhighlight';
  
  if (!isHighlight && !isUnhighlight) return;
  
  const scriptStatus = await ensureContentScript(tab.id, tab.url);

  if (!scriptStatus.success) {
    // Use debug level for expected restrictions (known limitations)
    const isExpectedRestriction = ['CHROME_INTERNAL', 'CHROME_STORE', 'ABOUT_PAGE', 'PDF_FILE'].includes(scriptStatus.code);

    if (isExpectedRestriction) {
      // Silently handle expected restrictions - these are known limitations
      return;
    } else {
      // Only log actual errors (unexpected failures)
      console.warn('Persistent Highlighter:', scriptStatus.error);
      if (scriptStatus.code) {
        console.warn('Code:', scriptStatus.code);
      }
    }
    return;
  }

  if (scriptStatus.injected) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const messageType = isHighlight ? 'CREATE_HIGHLIGHT_AT_SELECTION' : 'REMOVE_HIGHLIGHT_AT_SELECTION';
  
  chrome.tabs.sendMessage(tab.id, { type: messageType }, (response) => {
    if (chrome.runtime.lastError) {
      const restriction = isRestrictedUrl(tab.url);
      // Only log if it's not an expected restriction
      if (!restriction.restricted) {
        console.warn('Persistent Highlighter: Failed to communicate with content script:', chrome.runtime.lastError.message);
      }
      return;
    }

    if (!response?.success) {
      console.warn(`Persistent Highlighter: Failed to ${isHighlight ? 'create' : 'remove'} highlight`);
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    if (message.type === 'CHECK_AND_INJECT') {
      const tabId = message.tabId || (sender.tab ? sender.tab.id : null);
      const url = message.url || (sender.tab ? sender.tab.url : null);

      if (!tabId || !url) {
        sendResponse({
          success: false,
          error: 'No tab ID or URL provided',
          code: 'MISSING_PARAMS'
        });
        return;
      }

      const result = await ensureContentScript(tabId, url);
      sendResponse(result);
      return;
    }

    switch (message.type) {
      case 'GET_HIGHLIGHTS': {
        const highlights = await getHighlightsForUrl(message.url);
        sendResponse({ success: true, highlights });
        break;
      }
      case 'SAVE_HIGHLIGHT': {
        const saved = await saveHighlight(message.highlight);
        sendResponse({ success: true, highlight: saved });
        break;
      }
      case 'UPDATE_HIGHLIGHT': {
        try {
          const updated = await updateHighlight(message.url, message.highlight);
          sendResponse({ success: true, highlight: updated });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
      }
      case 'DELETE_HIGHLIGHT': {
        const remaining = await deleteHighlight(message.url, message.id);
        sendResponse({ success: true, highlights: remaining });
        break;
      }
      case 'CLEAR_HIGHLIGHTS': {
        await clearHighlights(message.url);
        sendResponse({ success: true });
        break;
      }
      case 'GET_ALL_HIGHLIGHTS': {
        const allHighlights = await getAllHighlights();
        sendResponse({ success: true, highlights: allHighlights });
        break;
      }
      case 'GET_CATEGORIES': {
        const categories = await getCategories();
        sendResponse({ success: true, categories });
        break;
      }
      case 'ADD_CATEGORY': {
        try {
          const category = message.category;
          if (!category || typeof category !== 'string') {
            throw new Error('Invalid category name');
          }
          const categories = await addCategory(category.trim());
          sendResponse({ success: true, categories });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
      }
      case 'DELETE_CATEGORY': {
        try {
          const category = message.category;
          if (!category) {
            throw new Error('Category name required');
          }
          const categories = await deleteCategory(category);
          sendResponse({ success: true, categories });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
      }
      case 'IMPORT_HIGHLIGHTS': {
        try {
          const importedHighlights = message.highlights;
          if (!Array.isArray(importedHighlights)) {
            throw new Error('Invalid highlights data');
          }

          // Get current highlights map and categories
          const map = await getHighlightMap();
          const categories = await getCategories();
          const newCategories = new Set(categories);
          let importCount = 0;

          // Group imported highlights by URL
          const highlightsByUrl = {};
          for (const highlight of importedHighlights) {
            const url = highlight.url || highlight.sourceUrl;
            if (!url) continue;

            const cleanUrl = normalizeUrl(url);
            if (!highlightsByUrl[cleanUrl]) {
              highlightsByUrl[cleanUrl] = [];
            }
            highlightsByUrl[cleanUrl].push(highlight);
            
            // Collect new categories
            if (highlight.category && highlight.category !== 'uncategorized') {
              newCategories.add(highlight.category);
            }
          }

          // Merge with existing highlights
          for (const [url, highlights] of Object.entries(highlightsByUrl)) {
            const existing = map[url] || [];
            const existingIds = new Set(existing.map(h => h.id));

            // Add highlights that don't already exist
            for (const highlight of highlights) {
              if (!existingIds.has(highlight.id)) {
                existing.push({
                  id: highlight.id,
                  text: highlight.text,
                  note: highlight.note || '',
                  color: highlight.color,
                  category: highlight.category || 'uncategorized',
                  url: highlight.url || url,
                  title: highlight.title || '',
                  createdAt: highlight.createdAt || Date.now(),
                  range: highlight.range
                });
                importCount++;
              }
            }

            map[url] = existing;
          }

          // Save updated map and categories
          await saveHighlightMap(map);
          
          // Save any new categories discovered during import
          if (newCategories.size > categories.length) {
            await saveCategories(Array.from(newCategories));
          }

          sendResponse({ success: true, imported: importCount });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
      }
      case 'OPEN_AND_FOCUS_HIGHLIGHT': {
        // Store the pending focus request
        chrome.tabs.create({ url: message.url }, (tab) => {
          pendingFocus[tab.id] = message.id;
        });
        sendResponse({ success: true });
        break;
      }
      case 'CONTENT_SCRIPT_READY': {
        // Check if there's a pending focus for this tab
        const tabId = sender.tab.id;
        if (pendingFocus[tabId]) {
          const highlightId = pendingFocus[tabId];
          delete pendingFocus[tabId]; // Clear the pending task

          // Send the focus command now that we know the script is ready
          chrome.tabs.sendMessage(tabId, { type: 'FOCUS_HIGHLIGHT', id: highlightId });
        }
        sendResponse({ success: true });
        break;
      }
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  };

  handler();
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Support for SPAs: if URL changes without a reload
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, { type: 'UPDATE_HIGHLIGHTS_ON_NAV' }, () => {
      // Ignore errors if content script isn't ready or doesn't exist
      if (chrome.runtime.lastError) return;
    });
  }
});
