// PDF Viewer with Highlighting Support
(function() {
  'use strict';

  // Set PDF.js worker (local file)
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdfViewer/pdf.worker.min.js');

  // State
  const state = {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
    pdfUrl: null,
    originalPdfUrl: null,
    highlights: [],
    renderedPages: new Set(),
    pageCanvases: {},
    pageTextLayers: {}
  };

  // DOM Elements
  const elements = {
    viewer: document.getElementById('viewer'),
    viewerContainer: document.getElementById('viewerContainer'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingProgress: document.getElementById('loadingProgress'),
    errorOverlay: document.getElementById('errorOverlay'),
    errorMessage: document.getElementById('errorMessage'),
    fileName: document.getElementById('fileName'),
    pageInput: document.getElementById('pageInput'),
    totalPages: document.getElementById('totalPages'),
    zoomLevel: document.getElementById('zoomLevel'),
    highlightToolbar: document.getElementById('highlightToolbar'),
    toast: document.getElementById('toast')
  };

  // Initialize
  async function init() {
    // Get PDF URL from query params
    const params = new URLSearchParams(window.location.search);
    state.originalPdfUrl = params.get('file');
    
    if (!state.originalPdfUrl) {
      showError('No PDF file specified');
      return;
    }

    // Use original URL as the key for highlights
    state.pdfUrl = state.originalPdfUrl;
    
    // Update filename display
    try {
      const url = new URL(state.originalPdfUrl);
      const pathParts = url.pathname.split('/');
      const fileName = decodeURIComponent(pathParts[pathParts.length - 1] || 'document.pdf');
      elements.fileName.textContent = fileName;
      elements.fileName.title = state.originalPdfUrl;
      document.title = `${fileName} - Persistent Highlighter`;
    } catch (e) {
      elements.fileName.textContent = 'PDF Document';
    }

    // Setup event listeners
    setupEventListeners();
    
    // Load saved highlights
    await loadHighlights();
    
    // Load PDF
    await loadPDF(state.originalPdfUrl);
  }

  function setupEventListeners() {
    // Navigation
    document.getElementById('prevPage').addEventListener('click', () => goToPage(state.currentPage - 1));
    document.getElementById('nextPage').addEventListener('click', () => goToPage(state.currentPage + 1));
    elements.pageInput.addEventListener('change', (e) => goToPage(parseInt(e.target.value)));
    elements.pageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') goToPage(parseInt(e.target.value));
    });

    // Zoom
    document.getElementById('zoomOut').addEventListener('click', () => setZoom(state.scale - 0.25));
    document.getElementById('zoomIn').addEventListener('click', () => setZoom(state.scale + 0.25));
    document.getElementById('fitWidth').addEventListener('click', fitWidth);

    // Open original
    document.getElementById('openOriginal').addEventListener('click', openOriginalPDF);
    document.getElementById('openOriginalError')?.addEventListener('click', openOriginalPDF);
    document.getElementById('retryBtn')?.addEventListener('click', () => loadPDF(state.originalPdfUrl));

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeydown);

    // Text selection for highlighting
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('mousedown', hideHighlightToolbar);

    // Highlight toolbar buttons
    elements.highlightToolbar.querySelectorAll('.highlight-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = btn.dataset.color;
        createHighlightFromSelection(color);
      });
    });

    // Scroll handling for lazy loading
    elements.viewerContainer.addEventListener('scroll', handleScroll);
  }

  async function loadPDF(url) {
    showLoading();
    
    try {
      const loadingTask = pdfjsLib.getDocument({
        url: url,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });

      loadingTask.onProgress = (progress) => {
        if (progress.total > 0) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          elements.loadingProgress.textContent = `${percent}%`;
        }
      };

      state.pdfDoc = await loadingTask.promise;
      state.totalPages = state.pdfDoc.numPages;
      
      elements.totalPages.textContent = state.totalPages;
      elements.pageInput.max = state.totalPages;
      
      hideLoading();
      
      // Initial render
      await renderAllPages();
      
      // Apply saved highlights
      applyHighlights();
      
    } catch (error) {
      console.error('PDF load error:', error);
      showError(`Failed to load PDF: ${error.message}`);
    }
  }

  async function renderAllPages() {
    elements.viewer.innerHTML = '';
    state.renderedPages.clear();
    state.pageCanvases = {};
    state.pageTextLayers = {};

    for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
      const pageContainer = document.createElement('div');
      pageContainer.className = 'page-container';
      pageContainer.dataset.page = pageNum;
      
      // Placeholder with estimated size
      const page = await state.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: state.scale });
      
      pageContainer.style.width = `${viewport.width}px`;
      pageContainer.style.height = `${viewport.height}px`;
      pageContainer.style.setProperty('--scale-factor', state.scale);
      
      elements.viewer.appendChild(pageContainer);
      
      // Render visible pages immediately
      await renderPage(pageNum, pageContainer);
    }
  }

  async function renderPage(pageNum, container) {
    if (state.renderedPages.has(pageNum)) return;
    
    try {
      const page = await state.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: state.scale });

      // Update container size and set scale factor for PDF.js text layer
      container.style.width = `${viewport.width}px`;
      container.style.height = `${viewport.height}px`;
      container.style.setProperty('--scale-factor', state.scale);

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-canvas';
      const context = canvas.getContext('2d');
      
      canvas.width = viewport.width * window.devicePixelRatio;
      canvas.height = viewport.height * window.devicePixelRatio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      
      context.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Create text layer
      const textLayer = document.createElement('div');
      textLayer.className = 'text-layer';
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;

      // Clear and add elements
      container.innerHTML = '';
      container.appendChild(canvas);
      container.appendChild(textLayer);

      // Render canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Render text layer
      const textContent = await page.getTextContent();
      
      // Use PDF.js text layer rendering
      pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayer,
        viewport: viewport,
        textDivs: []
      });

      state.renderedPages.add(pageNum);
      state.pageCanvases[pageNum] = canvas;
      state.pageTextLayers[pageNum] = textLayer;

      // Apply highlights for this page
      applyHighlightsToPage(pageNum);

    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
    }
  }

  function handleScroll() {
    // Update current page based on scroll position
    const containers = elements.viewer.querySelectorAll('.page-container');
    const scrollTop = elements.viewerContainer.scrollTop;
    const containerHeight = elements.viewerContainer.clientHeight;
    
    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      const viewerRect = elements.viewerContainer.getBoundingClientRect();
      
      if (rect.top < viewerRect.bottom && rect.bottom > viewerRect.top) {
        const pageNum = parseInt(container.dataset.page);
        if (pageNum !== state.currentPage) {
          state.currentPage = pageNum;
          elements.pageInput.value = pageNum;
        }
        break;
      }
    }
  }

  function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > state.totalPages) return;
    
    state.currentPage = pageNum;
    elements.pageInput.value = pageNum;
    
    const container = elements.viewer.querySelector(`[data-page="${pageNum}"]`);
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function setZoom(newScale) {
    newScale = Math.max(0.25, Math.min(4, newScale));
    state.scale = newScale;
    elements.zoomLevel.textContent = `${Math.round(newScale * 100)}%`;
    
    // Re-render all pages
    state.renderedPages.clear();
    await renderAllPages();
    applyHighlights();
  }

  async function fitWidth() {
    if (!state.pdfDoc) return;
    
    const page = await state.pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = elements.viewerContainer.clientWidth - 40; // Padding
    const newScale = containerWidth / viewport.width;
    
    await setZoom(newScale);
  }

  function openOriginalPDF() {
    if (state.originalPdfUrl) {
      window.open(state.originalPdfUrl, '_blank');
    }
  }

  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT') return;
    
    switch (e.key) {
      case 'ArrowLeft':
      case 'PageUp':
        goToPage(state.currentPage - 1);
        break;
      case 'ArrowRight':
      case 'PageDown':
        goToPage(state.currentPage + 1);
        break;
      case 'Home':
        goToPage(1);
        break;
      case 'End':
        goToPage(state.totalPages);
        break;
      case '+':
      case '=':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom(state.scale + 0.25);
        }
        break;
      case '-':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom(state.scale - 0.25);
        }
        break;
    }
  }

  // Highlighting functionality
  function handleTextSelection(e) {
    // Small delay to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection();
      
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        hideHighlightToolbar();
        return;
      }

      // Check if selection is within text layer
      const range = selection.getRangeAt(0);
      const textLayer = range.commonAncestorContainer.closest?.('.text-layer') || 
                        range.commonAncestorContainer.parentElement?.closest('.text-layer');
      
      if (!textLayer) {
        hideHighlightToolbar();
        return;
      }

      // Show highlight toolbar
      showHighlightToolbar(selection);
    }, 10);
  }

  function showHighlightToolbar(selection) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    elements.highlightToolbar.style.top = `${rect.top + window.scrollY - 45}px`;
    elements.highlightToolbar.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 75}px`;
    elements.highlightToolbar.classList.remove('hidden');
  }

  function hideHighlightToolbar(e) {
    if (e && e.target.closest('#highlightToolbar')) return;
    elements.highlightToolbar.classList.add('hidden');
  }

  async function createHighlightFromSelection(color) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    
    // Find the page number
    const textLayer = range.commonAncestorContainer.closest?.('.text-layer') || 
                      range.commonAncestorContainer.parentElement?.closest('.text-layer');
    const pageContainer = textLayer?.closest('.page-container');
    const pageNum = pageContainer ? parseInt(pageContainer.dataset.page) : state.currentPage;

    // Create highlight data
    const highlight = {
      id: generateId(),
      text: text,
      color: color,
      note: '',
      category: 'uncategorized',
      url: state.pdfUrl,
      title: document.title.replace(' - Persistent Highlighter', ''),
      createdAt: Date.now(),
      range: {
        pageNum: pageNum,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        // Store text context for restoration
        startText: range.startContainer.textContent?.substring(0, 50),
        endText: range.endContainer.textContent?.substring(0, 50)
      }
    };

    // Apply visual highlight
    applyHighlightToRange(range, highlight.id, color);

    // Save highlight
    state.highlights.push(highlight);
    await saveHighlight(highlight);

    // Clear selection
    selection.removeAllRanges();
    hideHighlightToolbar();
    
    showToast('Highlight saved', 'success');
  }

  function applyHighlightToRange(range, highlightId, color) {
    // Get all text nodes in range
    const textNodes = getTextNodesInRange(range);
    
    textNodes.forEach(({ node, start, end }) => {
      const text = node.textContent;
      const before = text.substring(0, start);
      const highlighted = text.substring(start, end);
      const after = text.substring(end);

      const parent = node.parentNode;
      const fragment = document.createDocumentFragment();

      if (before) {
        fragment.appendChild(document.createTextNode(before));
      }

      const mark = document.createElement('mark');
      mark.className = 'pdf-highlight';
      mark.dataset.highlightId = highlightId;
      mark.style.backgroundColor = hexToRgba(color, 0.4);
      mark.textContent = highlighted;
      mark.addEventListener('click', (e) => handleHighlightClick(e, highlightId));
      fragment.appendChild(mark);

      if (after) {
        fragment.appendChild(document.createTextNode(after));
      }

      parent.replaceChild(fragment, node);
    });
  }

  function getTextNodesInRange(range) {
    const textNodes = [];
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
      textNodes.push({
        node: startContainer,
        start: range.startOffset,
        end: range.endOffset
      });
    } else {
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      let inRange = false;

      while ((node = walker.nextNode())) {
        if (node === startContainer) {
          inRange = true;
          textNodes.push({
            node: node,
            start: range.startOffset,
            end: node.textContent.length
          });
        } else if (node === endContainer) {
          textNodes.push({
            node: node,
            start: 0,
            end: range.endOffset
          });
          break;
        } else if (inRange) {
          textNodes.push({
            node: node,
            start: 0,
            end: node.textContent.length
          });
        }
      }
    }

    return textNodes;
  }

  function handleHighlightClick(e, highlightId) {
    e.stopPropagation();
    
    // Show context menu or delete option
    if (confirm('Delete this highlight?')) {
      removeHighlight(highlightId);
    }
  }

  async function removeHighlight(highlightId) {
    // Remove from DOM
    document.querySelectorAll(`[data-highlight-id="${highlightId}"]`).forEach(mark => {
      const parent = mark.parentNode;
      const text = mark.textContent;
      const textNode = document.createTextNode(text);
      parent.replaceChild(textNode, mark);
      parent.normalize();
    });

    // Remove from state
    state.highlights = state.highlights.filter(h => h.id !== highlightId);

    // Remove from storage
    await chrome.runtime.sendMessage({
      type: 'DELETE_HIGHLIGHT',
      url: state.pdfUrl,
      id: highlightId
    });

    showToast('Highlight removed', 'success');
  }

  // Storage functions
  async function loadHighlights() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_HIGHLIGHTS',
        url: state.pdfUrl
      });

      if (response?.success && response.highlights) {
        state.highlights = response.highlights;
      }
    } catch (error) {
      console.error('Failed to load highlights:', error);
    }
  }

  async function saveHighlight(highlight) {
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_HIGHLIGHT',
        highlight: highlight
      });
    } catch (error) {
      console.error('Failed to save highlight:', error);
      showToast('Failed to save highlight', 'error');
    }
  }

  function applyHighlights() {
    state.highlights.forEach(highlight => {
      if (highlight.range?.pageNum) {
        applyHighlightsToPage(highlight.range.pageNum);
      }
    });
  }

  function applyHighlightsToPage(pageNum) {
    const textLayer = state.pageTextLayers[pageNum];
    if (!textLayer) return;

    const pageHighlights = state.highlights.filter(h => h.range?.pageNum === pageNum);
    
    pageHighlights.forEach(highlight => {
      // Find text in the text layer
      const textSpans = textLayer.querySelectorAll('span');
      let found = false;

      textSpans.forEach(span => {
        if (found) return;
        
        const text = span.textContent;
        const highlightText = highlight.text;
        
        // Check if this span contains the highlight text
        const index = text.indexOf(highlightText);
        if (index !== -1) {
          // Create highlight
          const before = text.substring(0, index);
          const after = text.substring(index + highlightText.length);

          span.textContent = '';
          
          if (before) {
            span.appendChild(document.createTextNode(before));
          }

          const mark = document.createElement('mark');
          mark.className = 'pdf-highlight';
          mark.dataset.highlightId = highlight.id;
          mark.style.backgroundColor = hexToRgba(highlight.color, 0.4);
          mark.textContent = highlightText;
          mark.addEventListener('click', (e) => handleHighlightClick(e, highlight.id));
          span.appendChild(mark);

          if (after) {
            span.appendChild(document.createTextNode(after));
          }

          found = true;
        }
      });

      // If not found in single span, try to find across multiple spans
      if (!found) {
        highlightAcrossSpans(textLayer, highlight);
      }
    });
  }

  function highlightAcrossSpans(textLayer, highlight) {
    // Build full text content with span references
    const spans = Array.from(textLayer.querySelectorAll('span'));
    let fullText = '';
    const spanMap = [];

    spans.forEach(span => {
      const start = fullText.length;
      fullText += span.textContent;
      const end = fullText.length;
      spanMap.push({ span, start, end });
    });

    // Find highlight text
    const index = fullText.indexOf(highlight.text);
    if (index === -1) return;

    const highlightEnd = index + highlight.text.length;

    // Find affected spans
    spanMap.forEach(({ span, start, end }) => {
      if (end <= index || start >= highlightEnd) return;

      const spanText = span.textContent;
      const localStart = Math.max(0, index - start);
      const localEnd = Math.min(spanText.length, highlightEnd - start);

      if (localStart >= localEnd) return;

      const before = spanText.substring(0, localStart);
      const highlighted = spanText.substring(localStart, localEnd);
      const after = spanText.substring(localEnd);

      span.textContent = '';

      if (before) {
        span.appendChild(document.createTextNode(before));
      }

      const mark = document.createElement('mark');
      mark.className = 'pdf-highlight';
      mark.dataset.highlightId = highlight.id;
      mark.style.backgroundColor = hexToRgba(highlight.color, 0.4);
      mark.textContent = highlighted;
      mark.addEventListener('click', (e) => handleHighlightClick(e, highlight.id));
      span.appendChild(mark);

      if (after) {
        span.appendChild(document.createTextNode(after));
      }
    });
  }

  // Utility functions
  function generateId() {
    return 'pdf-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function showLoading() {
    elements.loadingOverlay.classList.remove('hidden');
    elements.errorOverlay.classList.add('hidden');
  }

  function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
  }

  function showError(message) {
    elements.loadingOverlay.classList.add('hidden');
    elements.errorOverlay.classList.remove('hidden');
    elements.errorMessage.textContent = message;
  }

  function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.remove('hidden');
    
    setTimeout(() => {
      elements.toast.classList.add('hidden');
    }, 2000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
