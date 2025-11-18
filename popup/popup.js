const NOTE_MAX_LENGTH = 280;
const noteInput = document.getElementById('noteInput');
const colorInput = document.getElementById('colorInput');
const colorChips = Array.from(document.querySelectorAll('.color-chip'));
const createBtn = document.getElementById('createHighlight');
const feedback = document.getElementById('feedback');
const highlightList = document.getElementById('highlightList');
const highlightCount = document.getElementById('highlightCount');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearHighlights');
const pageMeta = document.getElementById('pageMeta');
const pageHost = document.getElementById('pageHost');
const refreshBtn = document.getElementById('refreshHighlights');

const emptyStateHeading = emptyState?.querySelector('h3');
const emptyStateCopy = emptyState?.querySelector('p');
const defaultEmptyHeading = emptyStateHeading?.textContent || '';
const defaultEmptyCopy = emptyStateCopy?.textContent || '';

let activeTabId = null;
let currentUrl = null;
let highlights = [];
let searchTerm = '';

const runtimeMessage = (message) =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });

const CONNECTION_ERROR_FRAGMENT = 'Could not establish connection';

const sendMessageToTab = (tabId, message) =>
  new Promise((resolve) => {
    if (!tabId) {
      resolve({ success: false, error: 'Missing active tab' });
      return;
    }
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });

async function ensureContentScript(tabId) {
  if (!tabId || !chrome?.scripting) {
    return { success: false, error: 'Unable to load highlighter on this page.' };
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['contentScript.js'],
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to inject the highlighter script.',
    };
  }
}

async function tabMessage(tabId, message) {
  const initialResponse = await sendMessageToTab(tabId, message);
  if (
    initialResponse?.success ||
    !initialResponse?.error ||
    !initialResponse.error.includes(CONNECTION_ERROR_FRAGMENT)
  ) {
    return initialResponse;
  }

  const injection = await ensureContentScript(tabId);
  if (!injection.success) {
    return {
      success: false,
      error: injection.error || initialResponse.error,
    };
  }

  return sendMessageToTab(tabId, message);
}

function setFeedback(message, isError = false) {
  if (!feedback) return;
  feedback.textContent = message || '';
  feedback.style.color = isError ? '#dc2626' : '#0f766e';
}

function autoResize(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(textarea.scrollHeight, 48)}px`;
}

function getCleanUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch (error) {
    return url?.split('#')[0];
  }
}

function updatePageMeta(url) {
  if (!pageMeta || !pageHost) return;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    pageMeta.textContent = `${host}${parsed.pathname}`;
    pageHost.textContent = host || 'this page';
  } catch (error) {
    pageMeta.textContent = url || 'Unknown page';
    pageHost.textContent = 'this page';
  }
}

function setActiveChip(color) {
  if (!color) return;
  const normalized = color.toLowerCase();
  colorChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.color?.toLowerCase() === normalized);
  });
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch (error) {
    return new Date(timestamp).toLocaleString();
  }
}

function filterHighlights() {
  if (!searchTerm) {
    return highlights.slice();
  }
  const term = searchTerm.toLowerCase();
  return highlights.filter((item) => {
    return [item.text, item.note, item.title]
      .filter((field) => typeof field === 'string' && field.trim().length)
      .some((field) => field.toLowerCase().includes(term));
  });
}

function createActionButton(label, className) {
  const button = document.createElement('button');
  button.textContent = label;
  if (className) {
    button.classList.add(className);
  }
  return button;
}

function updateEmptyState(isFiltered) {
  if (!emptyState || !highlightList) return;
  const hasHighlights = highlightList.children.length > 0;
  emptyState.style.display = hasHighlights ? 'none' : 'block';
  if (!hasHighlights && emptyStateHeading && emptyStateCopy) {
    if (isFiltered) {
      emptyStateHeading.textContent = 'No highlights match your search';
      emptyStateCopy.textContent = 'Try searching with different keywords or clear the filter.';
    } else {
      emptyStateHeading.textContent = defaultEmptyHeading;
      emptyStateCopy.textContent = defaultEmptyCopy;
    }
  }
}

function updateClearButton() {
  if (clearBtn) {
    clearBtn.disabled = !highlights.length;
  }
}

function renderHighlights() {
  if (!highlightList || !highlightCount) return;
  const filtered = filterHighlights().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  highlightList.innerHTML = '';
  highlightCount.textContent = highlights.length.toString();
  updateClearButton();

  if (filtered.length === 0) {
    updateEmptyState(Boolean(searchTerm));
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((item) => {
    const li = document.createElement('li');
    li.dataset.id = item.id;

    const card = document.createElement('article');
    card.className = 'highlight-card';

    const preview = document.createElement('div');
    preview.className = 'highlight-preview';

    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = item.color || '#fff176';

    const text = document.createElement('div');
    text.className = 'highlight-text';
    text.textContent = item.text || '—';

    preview.append(dot, text);

    const meta = document.createElement('div');
    meta.className = 'highlight-meta';
    const leftMeta = document.createElement('span');
    leftMeta.textContent = formatTimestamp(item.createdAt);
    const rightMeta = document.createElement('span');
    rightMeta.textContent = item.title || 'This page';
    meta.append(leftMeta, rightMeta);

    const noteField = document.createElement('textarea');
    noteField.className = 'note-input';
    noteField.placeholder = 'Add a note';
    noteField.maxLength = NOTE_MAX_LENGTH;
    noteField.value = item.note || '';
    autoResize(noteField);
    noteField.addEventListener('input', () => autoResize(noteField));

    const highlightControls = document.createElement('div');
    highlightControls.className = 'highlight-controls';

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = item.color || '#fff176';
    colorPicker.addEventListener('input', () => {
      dot.style.background = colorPicker.value;
    });

    const noteHint = document.createElement('span');
    noteHint.className = 'note-hint';
    noteHint.textContent = `${noteField.value.length}/${NOTE_MAX_LENGTH}`;
    noteField.addEventListener('input', () => {
      noteHint.textContent = `${noteField.value.length}/${NOTE_MAX_LENGTH}`;
    });

    noteField.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        handleUpdate(item.id, noteField.value, colorPicker.value);
      }
    });

    highlightControls.append(colorPicker, noteHint);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const viewBtn = createActionButton('View', 'view');
    viewBtn.addEventListener('click', () => focusHighlight(item.id));

    const copyBtn = createActionButton('Copy text', 'secondary');
    copyBtn.addEventListener('click', () => copyHighlightText(item.text));

    const updateBtn = createActionButton('Save', 'secondary');
    updateBtn.addEventListener('click', () =>
      handleUpdate(item.id, noteField.value, colorPicker.value, updateBtn)
    );

    const deleteBtn = createActionButton('Delete', 'delete');
    deleteBtn.addEventListener('click', () => handleDelete(item.id, deleteBtn));

    actions.append(viewBtn, copyBtn, updateBtn, deleteBtn);
    card.append(preview, meta, noteField, highlightControls, actions);
    li.appendChild(card);
    fragment.appendChild(li);
  });

  highlightList.appendChild(fragment);
  updateEmptyState(false);
}

async function handleCreate() {
  if (!activeTabId) {
    setFeedback('Unable to determine active tab.', true);
    return;
  }
  if (!createBtn) return;
  createBtn.disabled = true;
  setFeedback('Saving highlight...');
  const response = await tabMessage(activeTabId, {
    type: 'CREATE_HIGHLIGHT',
    note: (noteInput?.value || '').trim(),
    color: colorInput?.value || '#fff176',
  });

  if (!response?.success) {
    setFeedback(response?.error || 'Please select text to highlight.', true);
    createBtn.disabled = false;
    return;
  }

  const saveResponse = await runtimeMessage({
    type: 'SAVE_HIGHLIGHT',
    highlight: response.highlight,
  });
  createBtn.disabled = false;

  if (!saveResponse?.success) {
    setFeedback(saveResponse?.error || 'Failed to save highlight.', true);
    return;
  }

  highlights.push(response.highlight);
  renderHighlights();
  if (noteInput) {
    noteInput.value = '';
    autoResize(noteInput);
  }
  setFeedback('Highlight saved!');
}

async function handleUpdate(id, note, color, triggerBtn) {
  if (triggerBtn) {
    triggerBtn.disabled = true;
  }
  const response = await runtimeMessage({
    type: 'UPDATE_HIGHLIGHT',
    url: currentUrl,
    highlight: { id, note: note.trim(), color },
  });
  if (!response?.success) {
    setFeedback(response?.error || 'Unable to update highlight.', true);
    if (triggerBtn) triggerBtn.disabled = false;
    return;
  }
  highlights = highlights.map((item) =>
    item.id === id ? { ...item, note: note.trim(), color } : item
  );
  renderHighlights();
  if (activeTabId) {
    await tabMessage(activeTabId, {
      type: 'UPDATE_HIGHLIGHT_STYLE',
      id,
      color,
    });
  }
  if (triggerBtn) {
    triggerBtn.disabled = false;
  }
  setFeedback('Highlight updated.');
}

async function handleDelete(id, triggerBtn) {
  if (triggerBtn) {
    triggerBtn.disabled = true;
  }
  const response = await runtimeMessage({
    type: 'DELETE_HIGHLIGHT',
    url: currentUrl,
    id,
  });
  if (!response?.success) {
    setFeedback(response?.error || 'Unable to delete highlight.', true);
    if (triggerBtn) triggerBtn.disabled = false;
    return;
  }
  highlights = highlights.filter((item) => item.id !== id);
  renderHighlights();
  if (activeTabId) {
    await tabMessage(activeTabId, { type: 'REMOVE_HIGHLIGHT', id });
  }
  if (triggerBtn) {
    triggerBtn.disabled = false;
  }
  setFeedback('Highlight deleted.');
}

async function focusHighlight(id) {
  const response = await tabMessage(activeTabId, {
    type: 'FOCUS_HIGHLIGHT',
    id,
  });
  if (!response?.success) {
    setFeedback('Could not locate that highlight on the page.', true);
    return;
  }
  setFeedback('Centered highlight on page.');
}

async function copyHighlightText(text) {
  if (!text) {
    setFeedback('Nothing to copy yet.', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setFeedback('Highlight copied to clipboard.');
  } catch (error) {
    setFeedback('Clipboard access was blocked.', true);
  }
}

async function handleClearAll() {
  if (!highlights.length) {
    setFeedback('No highlights to clear.', true);
    return;
  }
  if (clearBtn) {
    clearBtn.disabled = true;
  }
  const response = await runtimeMessage({
    type: 'CLEAR_HIGHLIGHTS',
    url: currentUrl,
  });
  if (!response?.success) {
    setFeedback(response?.error || 'Unable to clear highlights.', true);
    if (clearBtn) clearBtn.disabled = false;
    return;
  }
  highlights = [];
  renderHighlights();
  if (activeTabId) {
    await tabMessage(activeTabId, { type: 'CLEAR_PAGE_HIGHLIGHTS' });
  }
  if (clearBtn) {
    clearBtn.disabled = false;
  }
  setFeedback('Cleared highlights for this page.');
}

function setRefreshState(isLoading) {
  if (!refreshBtn) return;
  refreshBtn.disabled = Boolean(isLoading);
  refreshBtn.classList.toggle('spinning', Boolean(isLoading));
}

async function loadHighlights(showToast = false) {
  if (!currentUrl) return;
  setRefreshState(true);
  const response = await runtimeMessage({ type: 'GET_HIGHLIGHTS', url: currentUrl });
  setRefreshState(false);
  if (!response?.success) {
    setFeedback('Unable to load highlights for this page.', true);
    return;
  }
  highlights = response.highlights || [];
  renderHighlights();
  if (showToast) {
    setFeedback('Highlights refreshed.');
  }
}

const getActiveTab = () =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0]);
    });
  });

async function init() {
  if (noteInput) {
    noteInput.maxLength = NOTE_MAX_LENGTH;
    autoResize(noteInput);
  }
  const tab = await getActiveTab();
  if (!tab || !tab.id || !tab.url) {
    setFeedback('Please open a regular tab to use the extension.', true);
    return;
  }
  activeTabId = tab.id;
  currentUrl = getCleanUrl(tab.url);
  updatePageMeta(currentUrl);
  if (colorInput) {
    setActiveChip(colorInput.value);
  }
  await loadHighlights();
}

if (createBtn) {
  createBtn.addEventListener('click', () => handleCreate());
}

if (searchInput) {
  searchInput.addEventListener('input', (event) => {
    searchTerm = event.target.value;
    renderHighlights();
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => handleClearAll());
}

if (refreshBtn) {
  refreshBtn.addEventListener('click', () => loadHighlights(true));
}

if (noteInput) {
  noteInput.addEventListener('input', () => autoResize(noteInput));
}

if (colorInput) {
  colorInput.addEventListener('input', (event) => {
    setActiveChip(event.target.value);
  });
}

colorChips.forEach((chip) => {
  chip.style.setProperty('--chip-color', chip.dataset.color);
  chip.addEventListener('click', () => {
    const color = chip.dataset.color;
    if (colorInput) {
      colorInput.value = color;
    }
    setActiveChip(color);
  });
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
