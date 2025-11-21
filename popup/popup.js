// State management
const state = {
  highlights: [],
  currentUrl: '',
  view: 'page', // 'page' or 'all'
  categories: [],
  selectedCategory: 'all', // Filter by category
  importFileData: null // Temporary storage for import data
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
  viewAllBtn: document.getElementById('viewAllBtn'),
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
  importExportDate: document.getElementById('importExportDate')
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

// Main initialization
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return;

  // Check for PDF
  if (tab.url.endsWith('.pdf') || tab.title.endsWith('.pdf')) {
    if (elements.pdfWarning) {
      elements.pdfWarning.classList.remove('hidden');
    }
  }

  state.currentUrl = tab.url;
  await loadCategories();
  await loadHighlights();

  // Listeners
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', () => loadHighlights());
  }
  if (elements.clearBtn) {
    elements.clearBtn.addEventListener('click', clearAll);
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
  if (elements.categoryFilter) {
    elements.categoryFilter.addEventListener('change', (e) => {
      state.selectedCategory = e.target.value;
      render();
    });
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
  state.view = view;
  if (elements.viewPageBtn) {
    elements.viewPageBtn.classList.toggle('active', view === 'page');
  }
  if (elements.viewAllBtn) {
    elements.viewAllBtn.classList.toggle('active', view === 'all');
  }
  loadHighlights();
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
}

function createCard(highlight) {
  const div = document.createElement('div');
  div.className = 'highlight-card';

  const sourceUrlHtml = state.view === 'all' && highlight.sourceUrl
    ? `<div class="source-url" title="${escapeHtml(highlight.sourceUrl)}">${escapeHtml(new URL(highlight.sourceUrl).hostname)}</div>`
    : '';

  const highlightText = highlight.text ? escapeHtml(highlight.text.trim()) : 'No text captured';
  const noteText = highlight.note ? escapeHtml(highlight.note) : '';
  const categoryValue = highlight.category || 'uncategorized';

  // Build category options
  let categoryOptions = '<option value="uncategorized">Uncategorized</option>';
  state.categories.forEach(cat => {
    const selected = cat === categoryValue ? 'selected' : '';
    categoryOptions += `<option value="${escapeHtml(cat)}" ${selected}>${escapeHtml(cat)}</option>`;
  });

  div.innerHTML = `
    ${sourceUrlHtml}
    <select class="highlight-category-select" data-highlight-id="${escapeHtml(highlight.id)}">
      ${categoryOptions}
    </select>
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

  // Category selector
  const categorySelect = div.querySelector('.highlight-category-select');
  categorySelect.onclick = (e) => e.stopPropagation();
  categorySelect.onchange = (e) => {
    e.stopPropagation();
    updateCategory(highlight.id, e.target.value, highlight.sourceUrl || state.currentUrl);
  };

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
  // Update main category filter
  if (elements.categoryFilter) {
    const currentValue = elements.categoryFilter.value;
    elements.categoryFilter.innerHTML = '<option value="all">All Categories</option><option value="uncategorized">Uncategorized</option>';
    
    state.categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      elements.categoryFilter.appendChild(option);
    });
    
    // Restore selected value if it still exists
    if (currentValue && (currentValue === 'all' || currentValue === 'uncategorized' || state.categories.includes(currentValue))) {
      elements.categoryFilter.value = currentValue;
    }
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
    elements.categoryList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 13px; padding: 20px;">No categories yet. Create your first one!</p>';
    return;
  }
  
  state.categories.forEach(cat => {
    // Count highlights in this category
    const count = state.highlights.filter(h => h.category === cat).length;
    
    const item = document.createElement('div');
    item.className = 'category-item';
    item.innerHTML = `
      <div class="category-item-name">
        ${escapeHtml(cat)}
        <span class="category-item-count">${count}</span>
      </div>
      <div class="category-item-actions">
        <button class="delete-category-btn" title="Delete category">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
    
    const deleteBtn = item.querySelector('.delete-category-btn');
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
  item.className = 'export-category-item';
  item.innerHTML = `
    <input type="checkbox" id="export-cat-${escapeHtml(value)}" value="${escapeHtml(value)}" ${checked ? 'checked' : ''}>
    <label for="export-cat-${escapeHtml(value)}" class="export-category-label">
      <span>${escapeHtml(label)}</span>
      <span class="export-category-count">${count} highlight${count !== 1 ? 's' : ''}</span>
    </label>
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
    const importData = JSON.parse(text);

    // Validate import data
    if (!importData.highlights || !Array.isArray(importData.highlights)) {
      throw new Error('Invalid import file: missing highlights array');
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
    showNotification('Import failed: ' + error.message, 'error');
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
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideDown 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

// Add animation styles for notifications
if (!document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideDown {
      from { transform: translate(-50%, -100%); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translate(-50%, 0); opacity: 1; }
      to { transform: translate(-50%, -100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', init);
