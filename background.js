const STORAGE_KEY = 'persistentHighlighterEntries';

async function getHighlightMap() {
  const stored = await chrome.storage.local.get([STORAGE_KEY]);
  return stored[STORAGE_KEY] || {};
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
      case 'CLEAR_HIGHLIGHTS': {
        await clearHighlights(message.url);
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
