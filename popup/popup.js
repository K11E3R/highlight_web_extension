// State management
const state = {
  highlights: [],
  currentUrl: '',
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
  importExportDate: document.getElementById('importExportDate'),
  ribbonToggle: document.getElementById('ribbonToggle'),
  ribbonIndicator: document.querySelector('.ribbon-mode-indicator')
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
  
  // Load ribbon mode state from storage
  await loadRibbonMode();

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
  if (state.view === view) return; // Already in this view
  
  // Add exit animation
  if (elements.list) {
    elements.list.classList.add('view-switching');
  }
  
  // Wait for exit animation, then switch
  setTimeout(() => {
  state.view = view;
  if (elements.viewPageBtn) {
    elements.viewPageBtn.classList.toggle('active', view === 'page');
  }
  if (elements.viewAllBtn) {
    elements.viewAllBtn.classList.toggle('active', view === 'all');
  }
    
    // Load highlights (will trigger entrance animation)
  loadHighlights();
    
    // Remove switching class after a brief delay
    setTimeout(() => {
      if (elements.list) {
        elements.list.classList.remove('view-switching');
      }
    }, 100);
  }, 400); // Match viewFadeOut duration
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
  div.className = 'highlight-card';
  div.title = 'Click to view and blink this highlight';

  // Get color name for display
  const colorName = highlight.colorName || getColorNameFromHex(highlight.color);
  const accentColor = highlight.color || '#ffd43b';
  
  // Set custom property for card accent color
  div.style.setProperty('--card-accent-color', accentColor);

  // Format timestamp
  const timestamp = highlight.createdAt ? formatTimestamp(highlight.createdAt) : 'Recently';
  
  // Get page info for 'all' view
  let pageInfoHtml = '';
  if (state.view === 'all' && highlight.sourceUrl) {
    try {
      const urlObj = new URL(highlight.sourceUrl);
      const hostname = urlObj.hostname;
      const pageTitle = highlight.title || hostname;
      pageInfoHtml = `
        <div class="page-info" title="${escapeHtml(highlight.sourceUrl)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <span class="page-hostname">${escapeHtml(hostname)}</span>
        </div>
      `;
    } catch (e) {
      pageInfoHtml = '';
    }
  }

  const highlightText = highlight.text ? escapeHtml(highlight.text.trim()) : 'No text captured';
  const noteText = highlight.note ? escapeHtml(highlight.note) : '';
  const categoryValue = highlight.category || 'uncategorized';

  // Word count
  const wordCount = highlightText.split(/\s+/).filter(w => w.length > 0).length;

  // Create category options HTML
  const categoryOptionsHtml = ['uncategorized', ...state.categories]
    .map(cat => {
      const displayName = cat === 'uncategorized' ? 'Uncategorized' : cat;
      const isSelected = cat === categoryValue ? 'selected' : '';
      return `<option value="${escapeHtml(cat)}" ${isSelected}>${escapeHtml(displayName)}</option>`;
    })
    .join('');

  div.innerHTML = `
    <div class="card-top">
      <div class="card-meta">
        <div class="color-badge" style="background-color: ${escapeHtml(accentColor)};" title="${escapeHtml(colorName)}"></div>
        <div class="card-timestamp">${escapeHtml(timestamp)}</div>
        ${pageInfoHtml}
      </div>
      <select class="highlight-category-select" data-highlight-id="${highlight.id}" title="Change category">
        ${categoryOptionsHtml}
      </select>
    </div>
    
    <div class="highlight-text" title="${highlightText}">${highlightText}</div>
    
    <div class="card-footer">
      <div class="card-info-left">
        <span class="word-count">${wordCount} word${wordCount !== 1 ? 's' : ''}</span>
      </div>
      <div class="card-actions">
        <button class="card-action-btn locate-btn" title="View on page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        <button class="card-action-btn delete-btn" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Spotlight effect - track mouse movement
  div.addEventListener('mousemove', (e) => {
    const rect = div.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    div.style.setProperty('--mouse-x', `${x}px`);
    div.style.setProperty('--mouse-y', `${y}px`);
    // Use card accent color with low opacity for spotlight
    const accentColorWithAlpha = accentColor + '20'; // Add alpha in hex
    div.style.setProperty('--spotlight-color', hexToRgba(accentColor, 0.12));
  });

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

  // Category selector change event
  const categorySelect = div.querySelector('.highlight-category-select');
  if (categorySelect) {
    categorySelect.onclick = (e) => {
      e.stopPropagation(); // Prevent card click
    };
    
    categorySelect.onchange = async (e) => {
      e.stopPropagation();
      const newCategory = e.target.value;
      
      // Show loading state
      categorySelect.disabled = true;
      categorySelect.style.opacity = '0.6';
      
      try {
        // Update highlight category via background script
        const targetUrl = highlight.sourceUrl || state.currentUrl;
        
        // Create updated highlight object
        const updatedHighlight = {
          id: highlight.id,
          category: newCategory
        };
        
        // Send update request to background script
        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_HIGHLIGHT',
          url: targetUrl,
          highlight: updatedHighlight
        });
        
        if (response && response.success) {
          // Success feedback animation
          categorySelect.style.transform = 'scale(1.15)';
          categorySelect.style.background = 'linear-gradient(135deg, rgba(81, 207, 102, 0.9), rgba(81, 207, 102, 0.7))';
          categorySelect.style.borderColor = 'rgba(81, 207, 102, 0.8)';
          categorySelect.style.boxShadow = '0 0 0 4px rgba(81, 207, 102, 0.2), 0 4px 16px rgba(81, 207, 102, 0.3)';
          categorySelect.style.color = 'white';
          
          setTimeout(async () => {
            // Reset styles
            categorySelect.style.transform = '';
            categorySelect.style.background = '';
            categorySelect.style.borderColor = '';
            categorySelect.style.boxShadow = '';
            categorySelect.style.color = '';
            categorySelect.disabled = false;
            categorySelect.style.opacity = '';
            
            // Reload highlights from background to ensure data consistency
            await loadHighlights();
          }, 400);
        } else {
          // Error feedback
          categorySelect.style.borderColor = 'rgba(255, 107, 107, 0.8)';
          categorySelect.style.boxShadow = '0 0 0 4px rgba(255, 107, 107, 0.2)';
          
          setTimeout(() => {
            categorySelect.style.borderColor = '';
            categorySelect.style.boxShadow = '';
            categorySelect.disabled = false;
            categorySelect.style.opacity = '';
            
            // Revert to old value
            categorySelect.value = highlight.category || 'uncategorized';
          }, 500);
          
          console.error('Failed to update category:', response?.error);
        }
      } catch (error) {
        console.error('Error updating category:', error);
        
        // Error feedback
        categorySelect.style.borderColor = 'rgba(255, 107, 107, 0.8)';
        categorySelect.style.boxShadow = '0 0 0 4px rgba(255, 107, 107, 0.2)';
        
        setTimeout(() => {
          categorySelect.style.borderColor = '';
          categorySelect.style.boxShadow = '';
          categorySelect.disabled = false;
          categorySelect.style.opacity = '';
          
          // Revert to old value
          categorySelect.value = highlight.category || 'uncategorized';
        }, 500);
      }
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
  // Update category chips
  const chipsContainer = document.getElementById('categoryChips');
  if (chipsContainer) {
    const addBtn = chipsContainer.querySelector('.add-category-btn');
    
    // Clear existing chips (keep add button)
    chipsContainer.innerHTML = '';
    
    // Add "All" chip
    const allChip = document.createElement('button');
    allChip.className = 'category-chip' + (state.selectedCategory === 'all' ? ' active' : '');
    allChip.textContent = 'All';
    allChip.onclick = () => {
      if (state.selectedCategory === 'all') return; // Already selected
      state.selectedCategory = 'all';
      updateCategoryFilters();
      animateColorFilterChange(); // Use same animation
    };
    chipsContainer.appendChild(allChip);
    
    // Add "Uncategorized" chip if there are any
    const uncategorizedCount = state.highlights.filter(h => !h.category || h.category === 'uncategorized').length;
    if (uncategorizedCount > 0 || state.selectedCategory === 'uncategorized') {
      const uncatChip = document.createElement('button');
      uncatChip.className = 'category-chip' + (state.selectedCategory === 'uncategorized' ? ' active' : '');
      uncatChip.textContent = 'Uncategorized';
      uncatChip.onclick = () => {
        if (state.selectedCategory === 'uncategorized') return; // Already selected
        state.selectedCategory = 'uncategorized';
        updateCategoryFilters();
        animateColorFilterChange(); // Use same animation
      };
      chipsContainer.appendChild(uncatChip);
    }
    
    // Add category chips
    state.categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'category-chip' + (state.selectedCategory === cat ? ' active' : '');
      chip.textContent = cat;
      chip.onclick = () => {
        if (state.selectedCategory === cat) return; // Already selected
        state.selectedCategory = cat;
        updateCategoryFilters();
        animateColorFilterChange(); // Use same animation
      };
      chipsContainer.appendChild(chip);
    });
    
    // Re-add the add button
    if (addBtn) {
      chipsContainer.appendChild(addBtn);
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

// Ribbon Mode Functions
let ribbonIndicatorTimeout = null;
let ribbonTrail = null;

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
      
      // Show indicator immediately
      elements.ribbonIndicator.style.opacity = '1';
      elements.ribbonIndicator.style.transform = 'translateY(0) scale(1)';
      
      // Hide after 1 second
      ribbonIndicatorTimeout = setTimeout(() => {
        elements.ribbonIndicator.style.opacity = '0';
        elements.ribbonIndicator.style.transform = 'translateY(20px) scale(0.8)';
      }, 1000);
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
      elements.ribbonIndicator.style.opacity = '0';
      elements.ribbonIndicator.style.transform = 'translateY(20px) scale(0.8)';
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
  const cards = document.querySelectorAll('.highlight-card');
  cards.forEach((card) => {
    // Clear any existing ribbon elements
    card.querySelectorAll('.ribbon-corner, .ribbon-banner, .ribbon-wave, .ribbon-shimmer, .ribbon-fold').forEach(el => el.remove());
    // Don't add has-ribbon class to prevent visual decorations
    card.classList.remove('has-ribbon');
  });
}

function removeRibbonsFromCards() {
  const cards = document.querySelectorAll('.highlight-card');
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
  
  // Initialize ribbon trail with adaptive colors
  ribbonTrail = new window.RibbonTrail({
    colors: ['#ffffff'], // Will adapt automatically
    baseThickness: 25,
    maxAge: 400,
    pointCount: 40,
    speedMultiplier: 0.5,
    baseSpring: 0.03,
    baseFriction: 0.88,
    adaptiveColors: true // Enable color adaptation
  });
  
  // Initialize on body
  ribbonTrail.init(document.body);
  
  // Track mouse movement
  document.addEventListener('mousemove', handleRibbonMouseMove);
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
}

// Color Filter Functions
function setupColorFilters() {
  const colorChips = document.querySelectorAll('.color-chip, .color-chip-all');
  colorChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const color = chip.getAttribute('data-color');
      
      // If same color, do nothing
      if (state.selectedColor === color) return;
      
      state.selectedColor = color;
      
      // Update active state with smooth animation
      colorChips.forEach(c => {
        c.classList.remove('active');
      });
      chip.classList.add('active');
      
      // Animate cards out, then in with new filter
      animateColorFilterChange();
    });
  });
}

function animateColorFilterChange() {
  const cards = document.querySelectorAll('.highlight-card');
  
  if (cards.length === 0) {
    render();
    return;
  }
  
  // Phase 1: Fade out all cards with stagger
  cards.forEach((card, index) => {
    card.style.animation = 'none';
    setTimeout(() => {
      card.style.animation = `cardFadeOut 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards`;
      card.style.animationDelay = `${index * 0.02}s`;
    }, 10);
  });
  
  // Phase 2: After fade out, re-render with new filter and fade in
  const totalFadeOutTime = (cards.length * 20) + 300; // stagger + animation duration
  
  setTimeout(() => {
    render();
    
    // Fade in new cards with stagger
    setTimeout(() => {
      const newCards = document.querySelectorAll('.highlight-card');
      newCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.animation = 'none';
        setTimeout(() => {
          card.style.animation = `cardFadeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`;
          card.style.animationDelay = `${index * 0.04}s`;
        }, 10);
      });
    }, 10);
  }, totalFadeOutTime);
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
