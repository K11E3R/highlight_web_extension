// Utilities inlined for simplicity

// We'll need to create utils.js or just inline it since it's small
// For simplicity, I'll inline the logic or use standard chrome APIs directly here.

const state = {
  highlights: [],
  currentUrl: '',
  view: 'page' // 'page' or 'all'
};

// DOM Elements
const elements = {
  list: document.getElementById('highlightsList'),
  emptyState: document.getElementById('emptyState'),
  countBadge: document.getElementById('countBadge'),
  clearBtn: document.getElementById('clearAllBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  pdfWarning: document.getElementById('pdfWarning'),
  viewPageBtn: document.getElementById('viewPageBtn'),
  viewAllBtn: document.getElementById('viewAllBtn')
};

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return;

  // Check for PDF
  if (tab.url.endsWith('.pdf') || tab.title.endsWith('.pdf')) {
    elements.pdfWarning.classList.remove('hidden');
  }

  state.currentUrl = tab.url;
  loadHighlights();

  // Listeners
  elements.refreshBtn.addEventListener('click', loadHighlights);
  elements.clearBtn.addEventListener('click', clearAll);

  elements.viewPageBtn.addEventListener('click', () => switchView('page'));
  elements.viewAllBtn.addEventListener('click', () => switchView('all'));
}

function switchView(view) {
  state.view = view;
  elements.viewPageBtn.classList.toggle('active', view === 'page');
  elements.viewAllBtn.classList.toggle('active', view === 'all');
  loadHighlights();
}

async function loadHighlights() {
  // Spin icon
  elements.refreshBtn.classList.add('spinning');

  try {
    let response;
    if (state.view === 'page') {
      response = await chrome.runtime.sendMessage({
        type: 'GET_HIGHLIGHTS',
        url: state.currentUrl
      });
    } else {
      response = await chrome.runtime.sendMessage({
        type: 'GET_ALL_HIGHLIGHTS'
      });
    }

    if (response && response.highlights) {
      state.highlights = response.highlights;
      render();
    }
  } catch (e) {
    console.error('Failed to load highlights', e);
  } finally {
    setTimeout(() => elements.refreshBtn.classList.remove('spinning'), 500);
  }
}

function render() {
  // Clear list (except empty state which we toggle)
  Array.from(elements.list.children).forEach(child => {
    if (child.id !== 'emptyState') child.remove();
  });

  const count = state.highlights.length;
  elements.countBadge.textContent = count;
  elements.clearBtn.disabled = count === 0 || state.view === 'all'; // Disable clear all in global view for safety

  if (count === 0) {
    elements.emptyState.style.display = 'block';
    elements.emptyState.querySelector('h3').textContent = state.view === 'page' ? 'No highlights yet' : 'No saved highlights';
    return;
  }

  elements.emptyState.style.display = 'none';

  state.highlights.forEach(h => {
    const card = createCard(h);
    elements.list.appendChild(card);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function createCard(highlight) {
  const div = document.createElement('div');
  div.className = 'highlight-card';

  const sourceUrlHtml = state.view === 'all' && highlight.sourceUrl
    ? `<div class="source-url" title="${escapeHtml(highlight.sourceUrl)}">${escapeHtml(new URL(highlight.sourceUrl).hostname)}</div>`
    : '';

  const highlightText = highlight.text ? escapeHtml(highlight.text.trim()) : 'No text captured';
  const noteText = highlight.note ? escapeHtml(highlight.note) : '';

  div.innerHTML = `
    ${sourceUrlHtml}
    <div class="card-header">
      <div class="color-indicator" style="background-color: ${escapeHtml(highlight.color || '#FFEB3B')}"></div>
      <div class="card-actions">
        <button class="icon-btn-small locate-btn" title="Scroll to highlight">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        <button class="icon-btn-small delete-btn" title="Delete highlight">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="highlight-text">${highlightText}</div>
    <textarea class="note-area" placeholder="Add a note...">${noteText}</textarea>
  `;

  // Events
  const deleteBtn = div.querySelector('.delete-btn');
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteHighlight(highlight.id, highlight.sourceUrl || state.currentUrl);
  };

  const locateBtn = div.querySelector('.locate-btn');
  locateBtn.onclick = (e) => {
    e.stopPropagation();
    if (state.view === 'all' && highlight.sourceUrl && highlight.sourceUrl !== state.currentUrl) {
      chrome.runtime.sendMessage({
        type: 'OPEN_AND_FOCUS_HIGHLIGHT',
        url: highlight.sourceUrl,
        id: highlight.id
      });
    } else {
      scrollToHighlight(highlight.id);
    }
  };

  const noteArea = div.querySelector('.note-area');
  noteArea.onclick = (e) => e.stopPropagation();
  noteArea.onchange = (e) => updateNote(highlight.id, e.target.value, highlight.sourceUrl || state.currentUrl);

  // Click card to scroll (fallback)
  div.onclick = () => {
    if (state.view === 'all' && highlight.sourceUrl && highlight.sourceUrl !== state.currentUrl) {
      chrome.runtime.sendMessage({
        type: 'OPEN_AND_FOCUS_HIGHLIGHT',
        url: highlight.sourceUrl,
        id: highlight.id
      });
    } else {
      scrollToHighlight(highlight.id);
    }
  };

  return div;
}

async function deleteHighlight(id, url) {
  await chrome.runtime.sendMessage({
    type: 'DELETE_HIGHLIGHT',
    url: url,
    id
  });

  // Update local state
  state.highlights = state.highlights.filter(h => h.id !== id);
  render();

  // Notify content script to remove from DOM
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'REMOVE_HIGHLIGHT', id });
    } catch (e) {
      console.log('Content script not ready or not available on this page');
    }
  }
}

async function updateNote(id, note, url) {
  const highlight = state.highlights.find(h => h.id === id);
  if (highlight) {
    highlight.note = note;
    await chrome.runtime.sendMessage({
      type: 'UPDATE_HIGHLIGHT',
      url: url,
      highlight
    });
  }
}

async function clearAll() {
  if (!confirm('Are you sure you want to clear all highlights on this page?')) return;

  await chrome.runtime.sendMessage({
    type: 'CLEAR_HIGHLIGHTS',
    url: state.currentUrl
  });

  state.highlights = [];
  render();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_PAGE_HIGHLIGHTS' });
    } catch (e) {
      console.log('Content script not ready');
    }
  }
}

async function scrollToHighlight(id) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'FOCUS_HIGHLIGHT', id });
    } catch (e) {
      console.log('Content script not ready');
      // Fallback: maybe the content script isn't loaded.
      // We could try injecting it, but for now just logging is safer.
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
