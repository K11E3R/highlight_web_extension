const STORAGE_KEY = 'persistentHighlighterEntries';

async function getHighlightMap() {
  const stored = await chrome.storage.local.get([STORAGE_KEY]);
  return stored[STORAGE_KEY] || {};
}

async function saveHighlightMap(map) {
  await chrome.storage.local.set({ [STORAGE_KEY]: map });
}

async function getHighlightsForUrl(url) {
  const map = await getHighlightMap();
  return map[url] || [];
}

async function saveHighlight(highlight) {
  const map = await getHighlightMap();
  const existing = map[highlight.url] || [];
  existing.push(highlight);
  map[highlight.url] = existing;
  await saveHighlightMap(map);
  return highlight;
}

async function updateHighlight(url, updatedHighlight) {
  const map = await getHighlightMap();
  const list = map[url] || [];
  const idx = list.findIndex((item) => item.id === updatedHighlight.id);
  if (idx === -1) {
    throw new Error('Highlight not found');
  }
  list[idx] = { ...list[idx], ...updatedHighlight };
  map[url] = list;
  await saveHighlightMap(map);
  return list[idx];
}

async function deleteHighlight(url, id) {
  const map = await getHighlightMap();
  const list = map[url] || [];
  const filtered = list.filter((item) => item.id !== id);
  map[url] = filtered;
  await saveHighlightMap(map);
  return filtered;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
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
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  };

  handler();
  return true;
});
