// State management
const state = {
  highlights: [],
  currentUrl: '',
  currentPdfUrl: null, // Store PDF URL when on a PDF page
  view: 'page', // 'page' or 'all'
  categories: [],
  selectedCategory: 'all', // Filter by category
  selectedColor: 'all', // Filter by color
  importFileData: null, // Temporary storage for import data
  ribbonMode: false // Ribbon decorations active
};

// DOM Elements
const elements = {
  list: document.getElementById('highlightsList'),
  emptyState: document.getElementById('emptyState'),
  countBadge: document.getElementById('countBadge'),
  clearBtn: document.getElementById('clearAllBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  pdfBanner: document.getElementById('pdfBanner'),
  openPdfViewer: document.getElementById('openPdfViewer'),
  viewPageBtn: document.getElementById('viewPageBtn'),
  viewAllBtn: document.getElementById('viewAllBtn'),
  viewTitle: document.getElementById('viewTitle'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importFileInput: document.getElementById('importFileInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  manageCategoriesBtn: document.getElementById('manageCategoriesBtn'),
  categoryModal: document.getElementById('categoryModal'),
  closeCategoryModal: document.getElementById('closeCategoryModal'),
  newCategoryInput: document.getElementById('newCategoryInput'),
  addCategoryBtn: document.getElementById('addCategoryBtn'),
  categoryList: document.getElementById('categoryList'),
  exportModal: document.getElementById('exportModal'),
  closeExportModal: document.getElementById('closeExportModal'),
  exportCategoryList: document.getElementById('exportCategoryList'),
  confirmExportBtn: document.getElementById('confirmExportBtn'),
  cancelExportBtn: document.getElementById('cancelExportBtn'),
  importModal: document.getElementById('importModal'),
  closeImportModal: document.getElementById('closeImportModal'),
  importCategorySelect: document.getElementById('importCategorySelect'),
  confirmImportBtn: document.getElementById('confirmImportBtn'),
  cancelImportBtn: document.getElementById('cancelImportBtn'),
  importFileName: document.getElementById('importFileName'),
  importHighlightCount: document.getElementById('importHighlightCount'),
  importExportDate: document.getElementById('importExportDate'),
  ribbonToggle: document.getElementById('ribbonToggle'),
  ribbonIndicator: document.getElementById('ribbonIndicator'),
  toast: document.getElementById('toast')
};

// Utility functions for messaging
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

// Helper functions
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check if URL is a PDF
function isPdfUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return url.includes('.pdf') || 
           parsed.pathname.endsWith('.pdf') || 
           parsed.searchParams.get('format') === 'pdf';
  } catch {
    return false;
  }
}

// Open current PDF in our custom viewer
async function openPdfInViewer() {
  if (!state.currentPdfUrl) return;
  
  try {
    await chrome.runtime.sendMessage({
      type: 'OPEN_PDF_IN_VIEWER',
      pdfUrl: state.currentPdfUrl
    });
    // Close the popup after opening
    window.close();
  } catch (e) {
    console.error('Failed to open PDF in viewer:', e);
    showNotification('Failed to open PDF viewer', 'error');
  }
}

// Extract original PDF URL from viewer URL if applicable
function getActualUrl(url) {
  if (url.includes('pdfViewer/viewer.html')) {
    try {
      const viewerUrl = new URL(url);
      const pdfUrl = viewerUrl.searchParams.get('file');
      if (pdfUrl) return pdfUrl;
    } catch (e) {
      console.error('Failed to parse PDF viewer URL:', e);
    }
  }
  return url;
}

// Main initialization
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return;

  // Check if this is a PDF (but not already in our viewer)
  const isInOurViewer = tab.url.includes('pdfViewer/viewer.html');
  const isRegularPdf = !isInOurViewer && isPdfUrl(tab.url);
  
  // Show PDF banner with option to open in our viewer
  if (isRegularPdf && elements.pdfBanner) {
    elements.pdfBanner.classList.remove('hidden');
    state.currentPdfUrl = tab.url; // Store for the button
  }

  // Use original PDF URL for highlights if in viewer
  state.currentUrl = getActualUrl(tab.url);
  await loadCategories();
  await loadHighlights();
  
  // Load ribbon mode state from storage
  await loadRibbonMode();

  // Listeners
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', () => loadHighlights());
  }
  if (elements.clearBtn) {
    elements.clearBtn.addEventListener('click', clearAll);
  }
  if (elements.openPdfViewer) {
    elements.openPdfViewer.addEventListener('click', openPdfInViewer);
  }
  if (elements.viewPageBtn) {
    elements.viewPageBtn.addEventListener('click', () => switchView('page'));
  }
  if (elements.viewAllBtn) {
    elements.viewAllBtn.addEventListener('click', () => switchView('all'));
  }
  if (elements.exportBtn) {
    elements.exportBtn.addEventListener('click', exportHighlights);
  }
  if (elements.importBtn) {
    elements.importBtn.addEventListener('click', () => {
      if (elements.importFileInput) {
        elements.importFileInput.click();
      }
    });
  }
  if (elements.importFileInput) {
    elements.importFileInput.addEventListener('change', handleImportFile);
  }
  if (elements.manageCategoriesBtn) {
    elements.manageCategoriesBtn.addEventListener('click', openCategoryModal);
  }
  if (elements.closeCategoryModal) {
    elements.closeCategoryModal.addEventListener('click', closeCategoryModal);
  }
  if (elements.addCategoryBtn) {
    elements.addCategoryBtn.addEventListener('click', addCategory);
  }
  if (elements.newCategoryInput) {
    elements.newCategoryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addCategory();
    });
  }
  if (elements.closeExportModal) {
    elements.closeExportModal.addEventListener('click', closeExportModal);
  }
  if (elements.confirmExportBtn) {
    elements.confirmExportBtn.addEventListener('click', confirmExport);
  }
  if (elements.cancelExportBtn) {
    elements.cancelExportBtn.addEventListener('click', closeExportModal);
  }
  if (elements.closeImportModal) {
    elements.closeImportModal.addEventListener('click', closeImportModal);
  }
  if (elements.confirmImportBtn) {
    elements.confirmImportBtn.addEventListener('click', confirmImport);
  }
  if (elements.cancelImportBtn) {
    elements.cancelImportBtn.addEventListener('click', closeImportModal);
  }
  // Ribbon toggle
  if (elements.ribbonToggle) {
    elements.ribbonToggle.addEventListener('click', toggleRibbonMode);
  }
  // Color filter chips
  setupColorFilters();
  // Blur text animation for title
  setupBlurTextAnimation();
  // Hover-to-charge effect for import/export
  setupHoverToCharge();
  // Close modals on background click
  if (elements.categoryModal) {
    elements.categoryModal.addEventListener('click', (e) => {
      if (e.target === elements.categoryModal) closeCategoryModal();
    });
  }
  if (elements.exportModal) {
    elements.exportModal.addEventListener('click', (e) => {
      if (e.target === elements.exportModal) closeExportModal();
    });
  }
  if (elements.importModal) {
    elements.importModal.addEventListener('click', (e) => {
      if (e.target === elements.importModal) closeImportModal();
    });
  }
}

function switchView(view) {
  if (state.view === view) return;
  
  // Update state immediately
  state.view = view;
  
  // Update toggle buttons
  if (elements.viewPageBtn) {
    elements.viewPageBtn.classList.toggle('active', view === 'page');
  }
  if (elements.viewAllBtn) {
    elements.viewAllBtn.classList.toggle('active', view === 'all');
  }
  
  // Update title
  if (elements.viewTitle) {
    elements.viewTitle.textContent = view === 'page' ? 'This Page' : 'All Pages';
  }
  
  // Add loading state
  if (elements.list) {
    elements.list.classList.add('loading');
  }
  
  // Load highlights immediately
  loadHighlights().then(() => {
    if (elements.list) {
      elements.list.classList.remove('loading');
    }
  });
}

async function loadHighlights() {
  if (!elements.refreshBtn) return;
  
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
    setTimeout(() => {
      if (elements.refreshBtn) {
        elements.refreshBtn.classList.remove('spinning');
      }
    }, 500);
  }
}

function render() {
  if (!elements.list) return;
  
  // Clear list (except empty state which we toggle)
  Array.from(elements.list.children).forEach(child => {
    if (child.id !== 'emptyState') child.remove();
  });

  // Filter highlights by category
  let filteredHighlights = state.highlights;
  if (state.selectedCategory !== 'all') {
    if (state.selectedCategory === 'uncategorized') {
      filteredHighlights = state.highlights.filter(h => !h.category || h.category === 'uncategorized');
    } else {
      filteredHighlights = state.highlights.filter(h => h.category === state.selectedCategory);
    }
  }
  
  // Filter by color
  if (state.selectedColor !== 'all') {
    filteredHighlights = filteredHighlights.filter(h => h.color === state.selectedColor);
  }

  const count = filteredHighlights.length;
  
  if (elements.countBadge) {
    elements.countBadge.textContent = count;
  }
  
  if (elements.clearBtn) {
    elements.clearBtn.disabled = count === 0 || state.view === 'all'; // Disable clear all in global view for safety
  }

  if (count === 0) {
    if (elements.emptyState) {
      elements.emptyState.style.display = 'block';
      const heading = elements.emptyState.querySelector('h3');
      if (heading) {
        heading.textContent = state.view === 'page' ? 'No highlights yet' : 'No saved highlights';
      }
    }
    return;
  }

  if (elements.emptyState) {
    elements.emptyState.style.display = 'none';
  }

  filteredHighlights.forEach(h => {
    const card = createCard(h);
    elements.list.appendChild(card);
  });
  
  // Apply ribbons if ribbon mode is active
  if (state.ribbonMode) {
    setTimeout(() => addRibbonsToCards(), 50);
  }
}

function createCard(highlight) {
  const div = document.createElement('div');
  div.className = 'card';
  div.dataset.id = highlight.id;

  const accentColor = highlight.color || '#ffd43b';
  div.style.setProperty('--card-color', accentColor);

  const timestamp = highlight.createdAt ? formatTimestamp(highlight.createdAt) : 'Recently';
  const highlightText = highlight.text ? escapeHtml(highlight.text.trim()) : 'No text captured';
  const noteText = highlight.note || '';
  const categoryValue = highlight.category || 'uncategorized';
  const highlightUrl = highlight.sourceUrl || state.currentUrl;

  // Build category options
  const categoryOptions = ['uncategorized', ...state.categories].map(cat => 
    `<option value="${escapeHtml(cat)}" ${cat === categoryValue ? 'selected' : ''}>${cat === 'uncategorized' ? 'No category' : escapeHtml(cat)}</option>`
  ).join('');

  // Source section for 'all' view
  let sourceHtml = '';
  if (state.view === 'all' && highlight.sourceUrl) {
    try {
      const urlObj = new URL(highlight.sourceUrl);
      sourceHtml = `
        <div class="card-source">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <a href="${escapeHtml(highlight.sourceUrl)}" class="source-link" title="${escapeHtml(highlight.sourceUrl)}">${escapeHtml(urlObj.hostname)}</a>
        </div>
      `;
    } catch (e) {}
  }

  div.innerHTML = `
    <div class="card-text" title="Click to view">${highlightText}</div>
    
    <div class="card-toolbar">
      <select class="card-category-select" title="Change category">
        ${categoryOptions}
      </select>
      <button class="card-action note-btn ${noteText ? 'has-note' : ''}" title="${noteText ? 'Edit note' : 'Add note'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="card-action locate-btn" title="View on page">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
      </button>
      <button class="card-action delete delete-btn" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
    
    <div class="card-note-section ${noteText ? 'has-note' : 'hidden'}">
      <textarea class="card-note-input" placeholder="Add a note...">${escapeHtml(noteText)}</textarea>
      <div class="card-note-actions">
        <button class="card-note-save">Save</button>
        <button class="card-note-cancel">Cancel</button>
      </div>
    </div>
    
    <div class="card-footer">
      <span class="card-date">${escapeHtml(timestamp)}</span>
    </div>
    ${sourceHtml}
  `;

  // Category change handler
  const categorySelect = div.querySelector('.card-category-select');
  categorySelect.onclick = (e) => e.stopPropagation();
  categorySelect.onchange = async (e) => {
    e.stopPropagation();
    const newCategory = e.target.value;
    await updateCategory(highlight.id, newCategory, highlightUrl);
    highlight.category = newCategory;
    updateCategoryFilters();
  };

  // Note button handler
  const noteBtn = div.querySelector('.note-btn');
  const noteSection = div.querySelector('.card-note-section');
  const noteInput = div.querySelector('.card-note-input');
  const noteSave = div.querySelector('.card-note-save');
  const noteCancel = div.querySelector('.card-note-cancel');
  
  noteBtn.onclick = (e) => {
    e.stopPropagation();
    noteSection.classList.remove('hidden');
    noteInput.focus();
  };
  
  noteSave.onclick = async (e) => {
    e.stopPropagation();
    const newNote = noteInput.value.trim();
    await updateNote(highlight.id, newNote, highlightUrl);
    highlight.note = newNote;
    noteSection.classList.toggle('has-note', !!newNote);
    noteSection.classList.add('hidden');
    noteBtn.classList.toggle('has-note', !!newNote);
    if (!newNote) noteSection.classList.add('hidden');
    showNotification('Note saved', 'success');
  };
  
  noteCancel.onclick = (e) => {
    e.stopPropagation();
    noteInput.value = highlight.note || '';
    if (!highlight.note) noteSection.classList.add('hidden');
  };
  
  noteInput.onclick = (e) => e.stopPropagation();

  // Card click - open and blink highlight
  div.onclick = (e) => {
    // Don't trigger if clicking on interactive elements
    if (e.target.closest('button') || e.target.closest('textarea') || e.target.closest('select')) {
      return;
    }
    
    if (state.view === 'all' && highlight.sourceUrl && highlight.sourceUrl !== state.currentUrl) {
      // Open page and blink
      chrome.runtime.sendMessage({
        type: 'OPEN_AND_BLINK_HIGHLIGHT',
        url: highlight.sourceUrl,
        id: highlight.id
      });
    } else {
      // Same page - just blink
      blinkHighlight(highlight.id);
    }
  };

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

  // Source link click handler
  const sourceLink = div.querySelector('.source-link');
  if (sourceLink) {
    sourceLink.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: 'OPEN_AND_BLINK_HIGHLIGHT',
        url: highlight.sourceUrl,
        id: highlight.id
      });
    };
  }

  return div;
}


// Helper function to get color name from hex
function getColorNameFromHex(hex) {
  const colorMap = {
    '#ffd43b': 'Yellow',
    '#51cf66': 'Green',
    '#4dabf7': 'Blue',
    '#9775fa': 'Purple',
    '#ff6ba7': 'Pink'
  };
  return colorMap[hex] || 'Custom';
}

// Helper function to convert hex color to rgba
function hexToRgba(hex, alpha = 1) {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper function to format timestamp
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  const currentYear = now.getFullYear();
  
  if (year === currentYear) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${year}`;
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

async function updateCategory(id, category, url) {
  const highlight = state.highlights.find(h => h.id === id);
  if (highlight) {
    highlight.category = category;
    await chrome.runtime.sendMessage({
      type: 'UPDATE_HIGHLIGHT',
      url: url,
      highlight
    });
    showNotification('Category updated', 'success');
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
      await tabMessage(tab.id, { type: 'FOCUS_HIGHLIGHT', id });
    } catch (e) {
      console.log('Content script not ready');
    }
  }
}

async function blinkHighlight(id) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      await tabMessage(tab.id, { type: 'BLINK_HIGHLIGHT', id });
    } catch (e) {
      console.log('Content script not ready');
    }
  }
}

// Category Management
async function loadCategories() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' });
    if (response && response.categories) {
      state.categories = response.categories;
      updateCategoryFilters();
    }
  } catch (e) {
    console.error('Failed to load categories', e);
  }
}

function updateCategoryFilters() {
  // Update category tabs
  const chipsContainer = document.getElementById('categoryChips');
  if (chipsContainer) {
    chipsContainer.innerHTML = '';
    
    // Add "All" tab
    const allTab = document.createElement('button');
    allTab.className = 'category-tab' + (state.selectedCategory === 'all' ? ' active' : '');
    allTab.textContent = 'All';
    allTab.onclick = () => {
      if (state.selectedCategory === 'all') return;
      state.selectedCategory = 'all';
      updateCategoryFilters();
      animateColorFilterChange();
    };
    chipsContainer.appendChild(allTab);
    
    // Add "Uncategorized" tab if there are any
    const uncategorizedCount = state.highlights.filter(h => !h.category || h.category === 'uncategorized').length;
    if (uncategorizedCount > 0 || state.selectedCategory === 'uncategorized') {
      const uncatTab = document.createElement('button');
      uncatTab.className = 'category-tab' + (state.selectedCategory === 'uncategorized' ? ' active' : '');
      uncatTab.textContent = 'Uncategorized';
      uncatTab.onclick = () => {
        if (state.selectedCategory === 'uncategorized') return;
        state.selectedCategory = 'uncategorized';
        updateCategoryFilters();
        animateColorFilterChange();
      };
      chipsContainer.appendChild(uncatTab);
    }
    
    // Add category tabs
    state.categories.forEach(cat => {
      const tab = document.createElement('button');
      tab.className = 'category-tab' + (state.selectedCategory === cat ? ' active' : '');
      tab.textContent = cat;
      tab.onclick = () => {
        if (state.selectedCategory === cat) return;
        state.selectedCategory = cat;
        updateCategoryFilters();
        animateColorFilterChange();
      };
      chipsContainer.appendChild(tab);
    });
  }

  // Update import category selector
  if (elements.importCategorySelect) {
    elements.importCategorySelect.innerHTML = '<option value="">Keep original categories</option><option value="uncategorized">Uncategorized</option>';
    
    state.categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      elements.importCategorySelect.appendChild(option);
    });
  }
}

function openCategoryModal() {
  if (elements.categoryModal) {
    elements.categoryModal.classList.remove('hidden');
    renderCategoryList();
  }
}

function closeCategoryModal() {
  if (elements.categoryModal) {
    elements.categoryModal.classList.add('hidden');
    if (elements.newCategoryInput) {
      elements.newCategoryInput.value = '';
    }
  }
}

async function addCategory() {
  const input = elements.newCategoryInput;
  if (!input) return;
  
  const categoryName = input.value.trim();
  if (!categoryName) {
    showNotification('Please enter a category name', 'warning');
    return;
  }
  
  if (state.categories.includes(categoryName)) {
    showNotification('Category already exists', 'warning');
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ADD_CATEGORY',
      category: categoryName
    });
    
    if (response && response.success) {
      state.categories.push(categoryName);
      updateCategoryFilters();
      renderCategoryList();
      input.value = '';
      showNotification('Category added', 'success');
    }
  } catch (e) {
    console.error('Failed to add category', e);
    showNotification('Failed to add category', 'error');
  }
}

async function deleteCategory(categoryName) {
  if (!confirm(`Delete category "${categoryName}"?\n\nHighlights in this category will become uncategorized.`)) {
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DELETE_CATEGORY',
      category: categoryName
    });
    
    if (response && response.success) {
      state.categories = state.categories.filter(c => c !== categoryName);
      
      // Reset filter if deleted category was selected
      if (state.selectedCategory === categoryName) {
        state.selectedCategory = 'all';
      }
      
      updateCategoryFilters();
      renderCategoryList();
      await loadHighlights(); // Reload to show updated highlights
      showNotification('Category deleted', 'success');
    }
  } catch (e) {
    console.error('Failed to delete category', e);
    showNotification('Failed to delete category', 'error');
  }
}

function renderCategoryList() {
  if (!elements.categoryList) return;
  
  elements.categoryList.innerHTML = '';
  
  if (state.categories.length === 0) {
    elements.categoryList.innerHTML = '<li style="text-align: center; color: var(--navy-500); font-size: 13px; padding: 20px;">No categories yet</li>';
    return;
  }
  
  state.categories.forEach(cat => {
    const count = state.highlights.filter(h => h.category === cat).length;
    
    const item = document.createElement('li');
    item.innerHTML = `
      <span class="cat-name">${escapeHtml(cat)} (${count})</span>
      <button class="cat-delete" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;
    
    const deleteBtn = item.querySelector('.cat-delete');
    deleteBtn.onclick = () => deleteCategory(cat);
    
    elements.categoryList.appendChild(item);
  });
}

// Export/Import Functionality
async function exportHighlights() {
  // Show export modal with category selection
  openExportModal();
}

function openExportModal() {
  if (!elements.exportModal) return;
  
  // Render export category list
  if (elements.exportCategoryList) {
    elements.exportCategoryList.innerHTML = '';
    
    // Add "All" option
    const allCount = state.highlights.length;
    addExportCategoryOption('all', 'All Highlights', allCount, true);
    
    // Add "Uncategorized" option
    const uncategorizedCount = state.highlights.filter(h => !h.category || h.category === 'uncategorized').length;
    if (uncategorizedCount > 0) {
      addExportCategoryOption('uncategorized', 'Uncategorized', uncategorizedCount, true);
    }
    
    // Add each category
    state.categories.forEach(cat => {
      const count = state.highlights.filter(h => h.category === cat).length;
      if (count > 0) {
        addExportCategoryOption(cat, cat, count, false);
      }
    });
  }
  
  elements.exportModal.classList.remove('hidden');
}

function addExportCategoryOption(value, label, count, checked) {
  const item = document.createElement('div');
  item.className = 'checkbox-item';
  item.innerHTML = `
    <input type="checkbox" id="export-cat-${escapeHtml(value)}" value="${escapeHtml(value)}" ${checked ? 'checked' : ''}>
    <label for="export-cat-${escapeHtml(value)}">${escapeHtml(label)} (${count})</label>
  `;
  
  elements.exportCategoryList.appendChild(item);
}

function closeExportModal() {
  if (elements.exportModal) {
    elements.exportModal.classList.add('hidden');
  }
}

async function confirmExport() {
  try {
    // Get selected categories
    const checkboxes = elements.exportCategoryList.querySelectorAll('input[type="checkbox"]:checked');
    const selectedCategories = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedCategories.length === 0) {
      showNotification('Please select at least one category', 'warning');
      return;
    }
    
    let response;
    let filename;
    
    if (state.view === 'page') {
      response = await chrome.runtime.sendMessage({
        type: 'GET_HIGHLIGHTS',
        url: state.currentUrl
      });
      
      const urlObj = new URL(state.currentUrl);
      const hostname = urlObj.hostname.replace(/[^a-z0-9]/gi, '_');
      filename = `highlights_${hostname}_${Date.now()}.json`;
    } else {
      response = await chrome.runtime.sendMessage({
        type: 'GET_ALL_HIGHLIGHTS'
      });
      filename = `highlights_all_${Date.now()}.json`;
    }

    if (!response || !response.highlights || response.highlights.length === 0) {
      closeExportModal();
      showNotification('No highlights to export', 'warning');
      return;
    }

    // Filter highlights by selected categories
    let filteredHighlights = response.highlights;
    
    if (!selectedCategories.includes('all')) {
      filteredHighlights = response.highlights.filter(h => {
        const category = h.category || 'uncategorized';
        return selectedCategories.includes(category) || selectedCategories.includes('uncategorized');
      });
    }
    
    if (filteredHighlights.length === 0) {
      closeExportModal();
      showNotification('No highlights in selected categories', 'warning');
      return;
    }

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      source: state.view === 'page' ? 'page' : 'all',
      url: state.view === 'page' ? state.currentUrl : null,
      categories: selectedCategories,
      count: filteredHighlights.length,
      highlights: filteredHighlights.map(h => ({
        id: h.id,
        text: h.text,
        note: h.note || '',
        color: h.color,
        category: h.category || 'uncategorized',
        url: h.url || h.sourceUrl,
        title: h.title || '',
        createdAt: h.createdAt,
        range: h.range
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    closeExportModal();
    showNotification(`Exported ${filteredHighlights.length} highlight${filteredHighlights.length > 1 ? 's' : ''}`, 'success');
  } catch (error) {
    console.error('Export failed:', error);
    closeExportModal();
    showNotification('Export failed: ' + error.message, 'error');
  }
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    
    // Parse JSON
    let importData;
    try {
      importData = JSON.parse(text);
    } catch (parseError) {
      throw new Error('Invalid JSON file format');
    }

    // Validate import data structure
    if (!importData || typeof importData !== 'object') {
      throw new Error('Invalid import file: must be a JSON object');
    }
    
    if (!importData.highlights) {
      throw new Error('Invalid import file: missing "highlights" field');
    }
    
    if (!Array.isArray(importData.highlights)) {
      throw new Error('Invalid import file: "highlights" must be an array');
    }
    
    if (importData.highlights.length === 0) {
      throw new Error('Import file contains no highlights');
    }

    // Validate that highlights have required fields
    const requiredFields = ['id', 'text', 'color'];
    const invalidHighlights = importData.highlights.filter(h => 
      !requiredFields.every(field => h.hasOwnProperty(field))
    );
    
    if (invalidHighlights.length > 0) {
      throw new Error(`Invalid highlight format: ${invalidHighlights.length} highlight(s) missing required fields (id, text, color)`);
    }

    // Store import data for modal
    state.importFileData = {
      file: file,
      data: importData
    };

    // Show import modal
    openImportModal(file.name, importData);
  } catch (error) {
    console.error('Import file read failed:', error);
    showNotification(error.message || 'Import failed', 'error');
    elements.importFileInput.value = '';
  }
}

function openImportModal(fileName, importData) {
  if (!elements.importModal) return;
  
  // Populate modal info
  if (elements.importFileName) {
    elements.importFileName.textContent = fileName;
  }
  if (elements.importHighlightCount) {
    elements.importHighlightCount.textContent = `${importData.count || importData.highlights.length} highlight${importData.highlights.length !== 1 ? 's' : ''}`;
  }
  if (elements.importExportDate) {
    const date = new Date(importData.exportDate);
    elements.importExportDate.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
  
  elements.importModal.classList.remove('hidden');
}

function closeImportModal() {
  if (elements.importModal) {
    elements.importModal.classList.add('hidden');
    state.importFileData = null;
    elements.importFileInput.value = '';
  }
}

async function confirmImport() {
  if (!state.importFileData) return;
  
  try {
    const importData = state.importFileData.data;
    const selectedCategory = elements.importCategorySelect.value;
    
    // Process highlights with category assignment
    let highlights = importData.highlights.map(h => ({
      ...h,
      category: selectedCategory || h.category || 'uncategorized'
    }));
    
    // Import highlights
    const response = await chrome.runtime.sendMessage({
      type: 'IMPORT_HIGHLIGHTS',
      highlights: highlights
    });

    if (response && response.success) {
      const count = response.imported || highlights.length;
      closeImportModal();
      showNotification(`Imported ${count} highlight${count !== 1 ? 's' : ''}`, 'success');
      
      // Reload categories and highlights
      await loadCategories();
      await loadHighlights();
      
      // Refresh the current page if it matches imported highlights
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_HIGHLIGHTS_ON_NAV' });
        } catch (e) {
          console.log('Content script not ready');
        }
      }
    } else {
      throw new Error(response?.error || 'Import failed');
    }
  } catch (error) {
    console.error('Import failed:', error);
    closeImportModal();
    showNotification('Import failed: ' + error.message, 'error');
  }
}

function showNotification(message, type = 'info') {
  const toast = elements.toast;
  if (!toast) return;
  
  // Clear any existing timeout
  if (toast.hideTimeout) {
    clearTimeout(toast.hideTimeout);
  }
  
  // Set content and type
  toast.textContent = message;
  toast.className = `toast ${type} visible`;
  
  // Hide after delay
  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 3000);
}

// Ribbon Mode Functions
let ribbonIndicatorTimeout = null;
let ribbonTrail = null;
let splashCursor = null;

async function loadRibbonMode() {
  const result = await chrome.storage.local.get('ribbonMode');
  if (result.ribbonMode === true) {
    state.ribbonMode = true;
    document.body.classList.add('ribbon-mode');
    if (elements.ribbonToggle) {
      elements.ribbonToggle.classList.add('active');
    }
    // Apply ribbons to cards after render
    setTimeout(() => addRibbonsToCards(), 100);
    // Start ribbon trail effect
    startRibbonTrail();
  }
}

function toggleRibbonMode() {
  state.ribbonMode = !state.ribbonMode;
  
  // Save ribbon mode state to storage
  chrome.storage.local.set({ ribbonMode: state.ribbonMode });
  
  // Toggle body class for custom cursor
  if (state.ribbonMode) {
    document.body.classList.add('ribbon-mode');
    elements.ribbonToggle.classList.add('active');
    
    // Show indicator briefly
    if (elements.ribbonIndicator) {
      // Clear any existing timeout
      if (ribbonIndicatorTimeout) {
        clearTimeout(ribbonIndicatorTimeout);
      }
      
      // Show indicator
      elements.ribbonIndicator.classList.add('visible');
      
      // Hide after 1.5 seconds
      ribbonIndicatorTimeout = setTimeout(() => {
        elements.ribbonIndicator.classList.remove('visible');
      }, 1500);
    }
    
    // Add ribbons to all cards
    addRibbonsToCards();
    
    // Start ribbon trail effect
    startRibbonTrail();
  } else {
    document.body.classList.remove('ribbon-mode');
    elements.ribbonToggle.classList.remove('active');
    
    // Hide indicator immediately when turning off
    if (elements.ribbonIndicator) {
      if (ribbonIndicatorTimeout) {
        clearTimeout(ribbonIndicatorTimeout);
      }
      elements.ribbonIndicator.classList.remove('visible');
    }
    
    // Remove ribbons from all cards
    removeRibbonsFromCards();
    
    // Stop ribbon trail effect
    stopRibbonTrail();
  }
}

function addRibbonsToCards() {
  // Ribbon decorations disabled - only subtle glow effect remains in CSS
  // No "NEW" badges or corner ribbons will be added
  const cards = document.querySelectorAll('.card');
  cards.forEach((card) => {
    // Clear any existing ribbon elements
    card.querySelectorAll('.ribbon-corner, .ribbon-banner, .ribbon-wave, .ribbon-shimmer, .ribbon-fold').forEach(el => el.remove());
    // Don't add has-ribbon class to prevent visual decorations
    card.classList.remove('has-ribbon');
  });
}

function removeRibbonsFromCards() {
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.classList.remove('has-ribbon');
    card.querySelectorAll('.ribbon-corner, .ribbon-banner, .ribbon-wave, .ribbon-shimmer, .ribbon-fold').forEach(el => el.remove());
  });
}

// Ribbon Trail Effect Functions
function startRibbonTrail() {
  if (ribbonTrail) {
    ribbonTrail.destroy();
  }
  
  // Initialize ribbon trail with adaptive colors (if available)
  if (window.RibbonTrail) {
    ribbonTrail = new window.RibbonTrail({
      colors: ['#ffffff'],
      baseThickness: 17,
      maxAge: 470,
      pointCount: 40,
      speedMultiplier: 0.6,
      baseSpring: 0.03,
      baseFriction: 0.88,
      adaptiveColors: true
    });
    
    ribbonTrail.init(document.body);
    document.addEventListener('mousemove', handleRibbonMouseMove);
  }
  
  // Initialize splash cursor WebGL effect (if available)
  if (splashCursor) {
    splashCursor.destroy();
  }
  
  if (window.SplashCursor) {
    splashCursor = new window.SplashCursor({
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 1024,
      DENSITY_DISSIPATION: 3.5,
      VELOCITY_DISSIPATION: 2,
      PRESSURE: 0.1,
      PRESSURE_ITERATIONS: 20,
      CURL: 3,
      SPLAT_RADIUS: 0.2,
      SPLAT_FORCE: 6000,
      SHADING: true,
      COLOR_UPDATE_SPEED: 10,
      TRANSPARENT: true
    });
    splashCursor.init();
  }
}

function handleRibbonMouseMove(e) {
  if (ribbonTrail) {
    ribbonTrail.updateMouse(e.clientX, e.clientY);
  }
}

function stopRibbonTrail() {
  if (ribbonTrail) {
    ribbonTrail.destroy();
    ribbonTrail = null;
  }
  document.removeEventListener('mousemove', handleRibbonMouseMove);
  
  // Destroy splash cursor WebGL effect
  if (splashCursor) {
    splashCursor.destroy();
    splashCursor = null;
  }
}

// Color Filter Functions
function setupColorFilters() {
  const colorPills = document.querySelectorAll('.color-pill');
  colorPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const color = pill.getAttribute('data-color');
      
      if (state.selectedColor === color) return;
      
      state.selectedColor = color;
      
      colorPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      
      animateColorFilterChange();
    });
  });
}

function animateColorFilterChange() {
  const cards = document.querySelectorAll('.card');
  
  if (cards.length === 0) {
    render();
    return;
  }
  
  // Fade out cards
  cards.forEach(card => {
    card.style.transition = 'opacity 0.15s, transform 0.15s';
    card.style.opacity = '0';
    card.style.transform = 'translateY(8px)';
  });
  
  // Re-render after fade out
  setTimeout(() => {
    render();
  }, 150);
}

// Blur Text Animation for Title
function setupBlurTextAnimation() {
  const title = document.getElementById('appTitle');
  if (!title) return;
  
  let isAnimating = false;
  
  title.addEventListener('click', () => {
    if (isAnimating) return;
    
    isAnimating = true;
    const text = title.getAttribute('data-text') || title.textContent;
    const words = text.split(' ');
    
    // Clear current content
    title.innerHTML = '';
    title.classList.add('animating');
    
    // Create word spans
    words.forEach((word, index) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      wordSpan.textContent = word;
      title.appendChild(wordSpan);
      
      // Trigger animation with delay
      setTimeout(() => {
        wordSpan.classList.add('blur-animate');
      }, index * 150); // 150ms delay between words
    });
    
    // Reset after animation completes
    const totalDuration = words.length * 150 + 800; // delay + animation duration
    setTimeout(() => {
      title.classList.remove('animating');
      isAnimating = false;
      console.log('Blur animation completed! ✨');
    }, totalDuration);
  });
}

// Hover-to-Charge Effect for Import/Export Buttons
function setupHoverToCharge() {
  const chargeDuration = 2000; // 2 seconds to fully charge
  let exportChargeTimeout = null;
  let importChargeTimeout = null;
  let exportCharged = false;
  let importCharged = false;
  
  // Export button
  if (elements.exportBtn) {
    elements.exportBtn.addEventListener('mouseenter', function() {
      if (exportCharged) return;
      
      this.classList.add('charging');
      
      // Start charging
      exportChargeTimeout = setTimeout(() => {
        // Fully charged
        this.classList.remove('charging');
        this.classList.add('fully-charged');
        exportCharged = true;
        
        // Trigger export action immediately
        exportHighlights();
        
        // Reset after visual feedback
        setTimeout(() => {
          this.classList.remove('fully-charged');
          exportCharged = false;
        }, 600);
      }, chargeDuration);
    });
    
    elements.exportBtn.addEventListener('mouseleave', function() {
      if (exportChargeTimeout) {
        clearTimeout(exportChargeTimeout);
        exportChargeTimeout = null;
      }
      if (!exportCharged) {
        this.classList.remove('charging');
      }
    });
  }
  
  // Import button - requires click after charging
  if (elements.importBtn) {
    elements.importBtn.addEventListener('mouseenter', function() {
      if (importCharged) return;
      
      this.classList.add('charging');
      
      // Start charging
      importChargeTimeout = setTimeout(() => {
        // Fully charged - ready for click
        this.classList.remove('charging');
        this.classList.add('fully-charged', 'ready-to-click');
        importCharged = true;
      }, chargeDuration);
    });
    
    elements.importBtn.addEventListener('mouseleave', function() {
      if (importChargeTimeout) {
        clearTimeout(importChargeTimeout);
        importChargeTimeout = null;
      }
      if (!importCharged) {
        this.classList.remove('charging');
      }
    });
    
    // Click handler - only works when fully charged
    elements.importBtn.addEventListener('click', function(e) {
      if (importCharged) {
        // Trigger import file picker with user gesture
        if (elements.importFileInput) {
          elements.importFileInput.click();
        }
        
        // Reset after triggering
        setTimeout(() => {
          this.classList.remove('fully-charged', 'ready-to-click');
          importCharged = false;
        }, 600);
      } else {
        // Not charged yet - show hint
        e.preventDefault();
        this.classList.add('charging-hint');
        setTimeout(() => {
          this.classList.remove('charging-hint');
        }, 1000);
      }
    });
  }
}

// Drag-to-scroll functionality for highlights list
function setupDragToScroll() {
  const container = elements.list;
  if (!container) return;

  let isDown = false;
  let startY = 0;
  let scrollTop = 0;
  let velocity = 0;
  let rafId = null;

  // Apply momentum scrolling
  function applyMomentum() {
    if (Math.abs(velocity) > 0.5) {
      container.scrollTop += velocity;
      velocity *= 0.95; // Friction
      rafId = requestAnimationFrame(applyMomentum);
    } else {
      velocity = 0;
      cancelAnimationFrame(rafId);
    }
  }

  container.addEventListener('mousedown', (e) => {
    // Don't interfere with interactive elements
    if (e.target.closest('button') || e.target.closest('textarea') || e.target.closest('select') || e.target.closest('a')) {
      return;
    }

    isDown = true;
    startY = e.pageY - container.offsetTop;
    scrollTop = container.scrollTop;
    velocity = 0;
    
    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    container.classList.add('dragging');
    container.style.cursor = 'grabbing';
    e.preventDefault();
  });

  container.addEventListener('mouseleave', () => {
    if (isDown) {
      isDown = false;
      container.classList.remove('dragging');
      container.style.cursor = '';
      applyMomentum();
    }
  });

  container.addEventListener('mouseup', () => {
    if (isDown) {
      isDown = false;
      container.classList.remove('dragging');
      container.style.cursor = '';
      applyMomentum();
    }
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    
    e.preventDefault();
    const y = e.pageY - container.offsetTop;
    const walk = (y - startY) * 1.5; // Scroll speed multiplier
    const newScrollTop = scrollTop - walk;
    
    velocity = container.scrollTop - newScrollTop;
    container.scrollTop = newScrollTop;
  });

  // Touch support
  let touchStartY = 0;
  let touchScrollTop = 0;

  container.addEventListener('touchstart', (e) => {
    if (e.target.closest('button') || e.target.closest('textarea') || e.target.closest('select') || e.target.closest('a')) {
      return;
    }
    
    touchStartY = e.touches[0].pageY;
    touchScrollTop = container.scrollTop;
    velocity = 0;
    
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    const y = e.touches[0].pageY;
    const walk = (touchStartY - y) * 1.2;
    container.scrollTop = touchScrollTop + walk;
  }, { passive: true });

  container.addEventListener('touchend', () => {
    applyMomentum();
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', setupDragToScroll);
