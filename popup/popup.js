const noteInput = document.getElementById('noteInput');
const colorInput = document.getElementById('colorInput');
const createBtn = document.getElementById('createHighlight');
const feedback = document.getElementById('feedback');
const highlightList = document.getElementById('highlightList');
const highlightCount = document.getElementById('highlightCount');
const emptyState = document.getElementById('emptyState');

let activeTabId = null;
let currentUrl = null;
let highlights = [];

function setFeedback(message, isError = false) {
  feedback.textContent = message || '';
  feedback.style.color = isError ? '#b91c1c' : '#0f766e';
}

function getCleanUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch (error) {
    return url.split('#')[0];
  }
}

function renderHighlights() {
  highlightList.innerHTML = '';
  highlightCount.textContent = highlights.length.toString();
  emptyState.style.display = highlights.length ? 'none' : 'block';

  highlights
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((item) => {
      const li = document.createElement('li');
      li.dataset.id = item.id;

      const card = document.createElement('div');
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

      const noteField = document.createElement('textarea');
      noteField.className = 'note-input';
      noteField.value = item.note || '';
      noteField.placeholder = 'Add a note';

      const controls = document.createElement('div');
      controls.className = 'controls';
      const colorLabel = document.createElement('label');
      colorLabel.textContent = 'Color:';
      const colorPicker = document.createElement('input');
      colorPicker.type = 'color';
      colorPicker.value = item.color || '#fff176';
      colorLabel.appendChild(colorPicker);
      controls.appendChild(colorLabel);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const updateBtn = document.createElement('button');
      updateBtn.className = 'secondary';
      updateBtn.textContent = 'Update';
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete';
      deleteBtn.textContent = 'Delete';

      updateBtn.addEventListener('click', () => {
        handleUpdate(item.id, noteField.value, colorPicker.value);
      });
      deleteBtn.addEventListener('click', () => {
        handleDelete(item.id);
      });

      actions.append(updateBtn, deleteBtn);
      card.append(preview, noteField, controls, actions);
      li.appendChild(card);
      highlightList.appendChild(li);
    });
}

function handleCreate() {
  if (!activeTabId) {
    setFeedback('Unable to determine active tab.', true);
    return;
  }
  setFeedback('Saving highlight...');
  chrome.tabs.sendMessage(
    activeTabId,
    {
      type: 'CREATE_HIGHLIGHT',
      note: noteInput.value.trim(),
      color: colorInput.value,
    },
    (response) => {
      if (!response || !response.success) {
        setFeedback(response?.error || 'Could not create highlight.', true);
        return;
      }
      const highlight = response.highlight;
      chrome.runtime.sendMessage(
        { type: 'SAVE_HIGHLIGHT', highlight },
        (saveResponse) => {
          if (!saveResponse?.success) {
            setFeedback(saveResponse?.error || 'Failed to save highlight.', true);
            return;
          }
          highlights.push(highlight);
          renderHighlights();
          noteInput.value = '';
          setFeedback('Highlight saved!');
        }
      );
    }
  );
}

function handleUpdate(id, note, color) {
  chrome.runtime.sendMessage(
    {
      type: 'UPDATE_HIGHLIGHT',
      url: currentUrl,
      highlight: { id, note, color },
    },
    (response) => {
      if (!response?.success) {
        setFeedback(response?.error || 'Unable to update highlight.', true);
        return;
      }
      highlights = highlights.map((item) =>
        item.id === id ? { ...item, note, color } : item
      );
      renderHighlights();
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, {
          type: 'UPDATE_HIGHLIGHT_STYLE',
          id,
          color,
        });
      }
      setFeedback('Highlight updated.');
    }
  );
}

function handleDelete(id) {
  chrome.runtime.sendMessage(
    {
      type: 'DELETE_HIGHLIGHT',
      url: currentUrl,
      id,
    },
    (response) => {
      if (!response?.success) {
        setFeedback(response?.error || 'Unable to delete highlight.', true);
        return;
      }
      highlights = highlights.filter((item) => item.id !== id);
      renderHighlights();
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, {
          type: 'REMOVE_HIGHLIGHT',
          id,
        });
      }
      setFeedback('Highlight deleted.');
    }
  );
}

function loadHighlights() {
  chrome.runtime.sendMessage(
    { type: 'GET_HIGHLIGHTS', url: currentUrl },
    (response) => {
      if (!response?.success) {
        setFeedback('Unable to load highlights for this page.', true);
        return;
      }
      highlights = response.highlights || [];
      renderHighlights();
    }
  );
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !tab.url) {
    setFeedback('Please open a regular tab to use the extension.', true);
    return;
  }
  activeTabId = tab.id;
  currentUrl = getCleanUrl(tab.url);
  loadHighlights();
}

createBtn.addEventListener('click', handleCreate);

document.addEventListener('DOMContentLoaded', init);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
}
