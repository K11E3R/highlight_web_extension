const HIGHLIGHT_CLASS = 'persistent-highlighter-span';
const HIGHLIGHT_PULSE_CLASS = 'persistent-highlighter-pulse';
const TOOLTIP_ID = 'persistent-highlighter-tooltip';
const DEFAULT_COLOR = '#FFEB3B'; // Better yellow with opacity

// --- Styles ---

function injectStyles() {
  if (document.getElementById('persistent-highlighter-style')) return;

  const style = document.createElement('style');
  style.id = 'persistent-highlighter-style';
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      border-radius: 2px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      padding: 1px 2px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      color: inherit;
    }
    .${HIGHLIGHT_CLASS}:hover {
      filter: brightness(0.95);
    }
    .${HIGHLIGHT_CLASS}.${HIGHLIGHT_PULSE_CLASS} {
      animation: phPulse 0.6s ease-in-out 4;
      position: relative;
      z-index: 2147483646;
      box-shadow: 0 0 0 2px var(--highlight-color);
    }
    @keyframes phPulse {
      0% { transform: scale(1); filter: brightness(1); box-shadow: 0 0 0 0 var(--highlight-color); }
      50% { transform: scale(1.05); filter: brightness(1.3); box-shadow: 0 0 12px 4px var(--highlight-color); }
      100% { transform: scale(1); filter: brightness(1); box-shadow: 0 0 0 0 var(--highlight-color); }
    }
    
    /* Floating Tooltip */
    #${TOOLTIP_ID} {
      position: absolute;
      z-index: 2147483647;
      background: #1e293b;
      border-radius: 8px;
      padding: 6px;
      display: flex;
      gap: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      transform: translateY(10px);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #${TOOLTIP_ID}.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    #${TOOLTIP_ID} button {
      background: transparent;
      border: none;
      color: #f8fafc;
      padding: 6px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.1s;
      width: 32px;
      height: 32px;
    }
    #${TOOLTIP_ID} button:hover {
      background: rgba(255,255,255,0.1);
    }
    #${TOOLTIP_ID} .divider {
      width: 1px;
      background: rgba(255,255,255,0.2);
      margin: 2px 0;
    }
    #${TOOLTIP_ID} .color-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid transparent;
    }
    #${TOOLTIP_ID} button.active .color-dot {
      border-color: white;
    }
  `;
  document.head.appendChild(style);
}

// --- DOM Helpers ---

function getXPathForNode(node) {
  if (node === document.body) return '/html/body';

  const parts = [];
  while (node && node.nodeType !== Node.DOCUMENT_NODE) {
    let index = 1;
    let sibling = node.previousSibling;

    while (sibling) {
      if (sibling.nodeName === node.nodeName) index++;
      sibling = sibling.previousSibling;
    }

    const tagName = node.nodeType === Node.TEXT_NODE ? 'text()' : node.nodeName.toLowerCase();
    parts.unshift(`${tagName}[${index}]`);
    node = node.parentNode;
  }
  return '/' + parts.join('/');
}

function getNodeFromXPath(xpath) {
  try {
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
  } catch (e) {
    return null;
  }
}

function serializeRange(range) {
  return {
    startXPath: getXPathForNode(range.startContainer),
    startOffset: range.startOffset,
    endXPath: getXPathForNode(range.endContainer),
    endOffset: range.endOffset,
  };
}

// --- Highlighting Logic ---

function getTextNodesInRange(range) {
  const textNodes = [];
  
  // Clone range to avoid modifying original
  const clonedRange = range.cloneRange();
  
  // Get start and end containers and offsets
  let startContainer = clonedRange.startContainer;
  let endContainer = clonedRange.endContainer;
  let startOffset = clonedRange.startOffset;
  let endOffset = clonedRange.endOffset;
  
  // If containers are not text nodes, find the actual text nodes
  if (startContainer.nodeType !== Node.TEXT_NODE) {
    // Try to find the text node at the offset
    if (startContainer.childNodes[startOffset] && startContainer.childNodes[startOffset].nodeType === Node.TEXT_NODE) {
      startContainer = startContainer.childNodes[startOffset];
      startOffset = 0;
    } else {
      // Walk through to find the text node
      const walker = document.createTreeWalker(startContainer, NodeFilter.SHOW_TEXT, null);
      let node = walker.nextNode();
      let charCount = 0;
      while (node) {
        const nodeLength = node.textContent.length;
        if (charCount + nodeLength > startOffset) {
          startContainer = node;
          startOffset = startOffset - charCount;
          break;
        }
        charCount += nodeLength;
        node = walker.nextNode();
      }
    }
  }
  
  if (endContainer.nodeType !== Node.TEXT_NODE) {
    if (endContainer.childNodes[endOffset] && endContainer.childNodes[endOffset].nodeType === Node.TEXT_NODE) {
      endContainer = endContainer.childNodes[endOffset];
      endOffset = 0;
    } else {
      const walker = document.createTreeWalker(endContainer, NodeFilter.SHOW_TEXT, null);
      let node = walker.nextNode();
      let charCount = 0;
      while (node) {
        const nodeLength = node.textContent.length;
        if (charCount + nodeLength >= endOffset) {
          endContainer = node;
          endOffset = endOffset - charCount;
          break;
        }
        charCount += nodeLength;
        node = walker.nextNode();
      }
    }
  }
  
  // Now collect text nodes between start and end
  if (!startContainer || !endContainer) return [];
  
  const walker = document.createTreeWalker(
    clonedRange.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let node = walker.nextNode();
  let collecting = false;
  
  while (node) {
    if (node === startContainer) {
      collecting = true;
    }
    
    if (collecting) {
      const nodeStart = node === startContainer ? startOffset : 0;
      const nodeEnd = node === endContainer ? endOffset : node.textContent.length;
      
      if (nodeStart < nodeEnd) {
        textNodes.push({
          node: node,
          startOffset: nodeStart,
          endOffset: nodeEnd
        });
      }
      
      if (node === endContainer) {
        break;
      }
    }
    
    node = walker.nextNode();
  }
  
  return textNodes;
}

function highlightRange(range, id, color) {
  // Clone range to avoid modifying the original selection
  const clonedRange = range.cloneRange();
  const textNodeData = getTextNodesInRange(clonedRange);
  const spans = [];

  if (textNodeData.length === 0) {
    // Fallback: use the range's extractContents method approach
    try {
      const contents = clonedRange.extractContents();
      const fragment = document.createDocumentFragment();
      const span = document.createElement('span');
      span.className = HIGHLIGHT_CLASS;
      span.dataset.highlightId = id;
      span.style.backgroundColor = color;
      span.style.setProperty('--highlight-color', color);
      span.appendChild(contents);
      clonedRange.insertNode(span);
      spans.push(span);
      return spans;
    } catch (e) {
      console.warn('Failed to highlight using extractContents:', e);
      return spans;
    }
  }

  textNodeData.forEach(({ node, startOffset, endOffset }) => {
    if (!node || !node.parentNode) return;
    
    // Skip empty text nodes
    if (node.textContent.length === 0) return;
    
    // Ensure offsets are valid
    const start = Math.max(0, Math.min(startOffset, node.textContent.length));
    const end = Math.max(start, Math.min(endOffset, node.textContent.length));
    
    if (start >= end) return; // No actual selection
    
    const span = document.createElement('span');
    span.className = HIGHLIGHT_CLASS;
    span.dataset.highlightId = id;
    // Use color-mix for transparency, fallback to rgba if needed
    span.style.setProperty('--highlight-color', color);
    // Apply semi-transparent background
    if (color.startsWith('#')) {
      // Convert hex to rgba with 40% opacity
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      span.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
    } else {
      span.style.backgroundColor = color;
    }

    // Split text node precisely at the selection boundaries
    let targetNode = node;
    
    // Case 1: Start is not at the beginning - split before
    if (start > 0) {
      targetNode = node.splitText(start);
    }
    
    // Case 2: End is not at the end - split after
    const actualEnd = end - start; // Adjust for the split if we did one
    if (actualEnd < targetNode.textContent.length) {
      targetNode.splitText(actualEnd);
    }

    // Wrap the target node
    const parent = targetNode.parentNode;
    if (parent && targetNode.textContent.length > 0) {
      parent.replaceChild(span, targetNode);
      span.appendChild(targetNode);
      spans.push(span);
    }
  });

  return spans;
}

function applyHighlightFromData(data) {
  const startNode = getNodeFromXPath(data.range.startXPath);
  const endNode = getNodeFromXPath(data.range.endXPath);

  if (!startNode || !endNode) return;

  const range = document.createRange();
  try {
    range.setStart(startNode, data.range.startOffset);
    range.setEnd(endNode, data.range.endOffset);
    const color = data.color || DEFAULT_COLOR;
    highlightRange(range, data.id, color);
  } catch (e) {
    console.warn('Failed to restore highlight:', e);
  }
}

function removeHighlight(id) {
  const spans = document.querySelectorAll(`.${HIGHLIGHT_CLASS}[data-highlight-id="${id}"]`);
  spans.forEach(span => {
    const parent = span.parentNode;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
    parent.normalize(); // Merge adjacent text nodes
  });
}

function getHighlightsInSelection(selection) {
  if (!selection || selection.isCollapsed) return [];
  
  const range = selection.getRangeAt(0);
  const highlightIds = new Set();
  
  // Check all highlight spans
  const allHighlights = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  allHighlights.forEach(span => {
    try {
      const spanRange = document.createRange();
      spanRange.selectNodeContents(span);
      
      // Check if selection overlaps with this highlight
      if (range.intersectsNode(span) || 
          (range.compareBoundaryPoints(Range.START_TO_START, spanRange) <= 0 && 
           range.compareBoundaryPoints(Range.END_TO_END, spanRange) >= 0)) {
        highlightIds.add(span.dataset.highlightId);
      }
    } catch (e) {
      // Ignore errors
    }
  });
  
  return Array.from(highlightIds);
}

async function removeHighlightsByIds(ids) {
  // Remove from DOM first
  ids.forEach(id => removeHighlight(id));
  
  // Also remove from storage
  const url = window.location.href.split('#')[0];
  for (const id of ids) {
    await safeRuntimeMessage({ 
      type: 'DELETE_HIGHLIGHT', 
      url,
      id 
    });
  }
}

// --- Tooltip UI ---

let tooltip = null;

function createTooltip() {
  if (document.getElementById(TOOLTIP_ID)) return document.getElementById(TOOLTIP_ID);

  const el = document.createElement('div');
  el.id = TOOLTIP_ID;
  el.innerHTML = `
    <button id="ph-btn-yellow" aria-label="Yellow Highlight"><div class="color-dot" style="background: #FFEB3B"></div></button>
    <button id="ph-btn-green" aria-label="Green Highlight"><div class="color-dot" style="background: #81C784"></div></button>
    <button id="ph-btn-blue" aria-label="Blue Highlight"><div class="color-dot" style="background: #64B5F6"></div></button>
    <button id="ph-btn-orange" aria-label="Orange Highlight"><div class="color-dot" style="background: #FFB74D"></div></button>
    <button id="ph-btn-purple" aria-label="Purple Highlight"><div class="color-dot" style="background: #BA68C8"></div></button>
    <div class="divider"></div>
    <button id="ph-btn-delete" aria-label="Remove"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
  `;

  document.body.appendChild(el);

  // Event Listeners
  el.querySelector('#ph-btn-yellow').onclick = () => createHighlight('#FFEB3B');
  el.querySelector('#ph-btn-green').onclick = () => createHighlight('#81C784');
  el.querySelector('#ph-btn-blue').onclick = () => createHighlight('#64B5F6');
  el.querySelector('#ph-btn-orange').onclick = () => createHighlight('#FFB74D');
  el.querySelector('#ph-btn-purple').onclick = () => createHighlight('#BA68C8');
  el.querySelector('#ph-btn-delete').onclick = () => {
    const selection = window.getSelection();
    if (!selection.isCollapsed) {
      // If selecting text, maybe we want to delete overlapping highlights?
      // For now, let's just hide tooltip
      hideTooltip();
    }
  };

  return el;
}

function showTooltip(x, y, selection) {
  if (!tooltip) tooltip = createTooltip();

  // Check if selection overlaps an existing highlight to show "Delete" or different options
  // For simplicity, we always show colors.

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  tooltip.classList.add('visible');
}

function hideTooltip() {
  if (tooltip) tooltip.classList.remove('visible');
}

function handleSelection() {
  const selection = window.getSelection();
  if (selection.isCollapsed || selection.toString().trim().length === 0) {
    hideTooltip();
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Calculate position (centered above selection)
  const x = rect.left + (rect.width / 2) - 80 + window.scrollX; // approximate center
  const y = rect.top + window.scrollY - 50;

  showTooltip(x, y, selection);
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function isExtensionContextValid() {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

async function safeRuntimeMessage(message) {
  if (!isExtensionContextValid()) {
    showContextInvalidatedToast();
    return { success: false, error: 'Extension context invalidated' };
  }

  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      showContextInvalidatedToast();
      return { success: false, error: 'Extension context invalidated' };
    }
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.runtime.lastError.message;
      if (errorMsg && errorMsg.includes('Extension context invalidated')) {
        showContextInvalidatedToast();
        return { success: false, error: 'Extension context invalidated' };
      }
      return { success: false, error: errorMsg };
    }
    return { success: false, error: error.message || 'Unknown error' };
  }
}

function safeRuntimeMessageCallback(message, callback) {
  if (!isExtensionContextValid()) {
    showContextInvalidatedToast();
    if (callback) callback({ success: false, error: 'Extension context invalidated' });
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        if (errorMsg && errorMsg.includes('Extension context invalidated')) {
          showContextInvalidatedToast();
          if (callback) callback({ success: false, error: 'Extension context invalidated' });
          return;
        }
        if (callback) callback({ success: false, error: errorMsg });
        return;
      }
      if (callback) callback(response);
    });
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      showContextInvalidatedToast();
      if (callback) callback({ success: false, error: 'Extension context invalidated' });
      return;
    }
    if (callback) callback({ success: false, error: error.message || 'Unknown error' });
  }
}

async function createHighlight(color) {
  // Proactive check for extension context
  if (!isExtensionContextValid()) {
    showContextInvalidatedToast();
    return;
  }

  const selection = window.getSelection();
  if (selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  
  // IMPORTANT: Capture text BEFORE modifying the DOM
  // Try multiple methods to ensure we get the text
  let selectedText = range.toString().trim();
  
  // Fallback: if toString() doesn't work, extract text manually
  if (!selectedText) {
    const clonedRange = range.cloneRange();
    const contents = clonedRange.extractContents();
    selectedText = contents.textContent.trim();
    // Put contents back
    clonedRange.insertNode(contents);
  }
  
  // Another fallback: use selection.toString()
  if (!selectedText) {
    selectedText = selection.toString().trim();
  }
  
  if (!selectedText) {
    console.warn('No text found in selection');
    return;
  }
  
  const id = generateUUID();
  const serialized = serializeRange(range);

  // Optimistic UI update (modifies DOM)
  highlightRange(range, id, color);
  selection.removeAllRanges();
  hideTooltip();

  // Save to storage
  const highlight = {
    id,
    color,
    text: selectedText,
    note: '',
    url: window.location.href.split('#')[0],
    title: document.title,
    createdAt: Date.now(),
    range: serialized
  };

  const response = await safeRuntimeMessage({ type: 'SAVE_HIGHLIGHT', highlight });
  if (!response?.success) {
    console.error('Failed to save highlight:', response?.error);
    // Remove the highlight from DOM if save failed
    removeHighlight(id);
    showToast('Failed to save highlight', 'error');
  } else {
    showToast('Highlight saved', 'success');
  }
}

// --- Initialization ---

function showToast(message, type = 'success') {
  const toastId = `ph-toast-${Date.now()}`;
  const existingToast = document.querySelector('.ph-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const isError = type === 'error';
  const isSuccess = type === 'success';
  const isInfo = type === 'info';
  
  const toast = document.createElement('div');
  toast.className = 'ph-toast';
  toast.id = toastId;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${isError ? '#ef4444' : isSuccess ? '#10b981' : isInfo ? '#3b82f6' : '#6b7280'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: phSlideIn 0.3s ease-out;
    max-width: 300px;
  `;

  const icon = isSuccess 
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <path d="M20 6L9 17l-5-5"/>
       </svg>`
    : isError
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <circle cx="12" cy="12" r="10"></circle>
         <line x1="12" y1="8" x2="12" y2="12"></line>
         <line x1="12" y1="16" x2="12.01" y2="16"></line>
       </svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <circle cx="12" cy="12" r="10"></circle>
         <line x1="12" y1="8" x2="12" y2="12"></line>
         <line x1="12" y1="16" x2="12.01" y2="16"></line>
       </svg>`;

  toast.innerHTML = `
    ${icon}
    <span>${message}</span>
  `;

  // Add slide-in animation style if not present
  if (!document.getElementById('ph-toast-style')) {
    const style = document.createElement('style');
    style.id = 'ph-toast-style';
    style.textContent = `
      @keyframes phSlideIn { 
        from { transform: translateX(100%); opacity: 0; } 
        to { transform: translateX(0); opacity: 1; } 
      }
      @keyframes phSlideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Auto remove after 3 seconds for success/info, 5 seconds for error
  const duration = isError ? 5000 : 3000;
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'phSlideOut 0.3s ease-out';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }
  }, duration);
}

function showContextInvalidatedToast() {
  showToast('Extension updated. Refresh page to save.', 'error');
}

function init() {
  injectStyles();

  document.addEventListener('mouseup', (e) => {
    // Wait slightly for selection to settle
    setTimeout(handleSelection, 10);
  });

  // Handle clicks on existing highlights
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains(HIGHLIGHT_CLASS)) {
      const id = e.target.dataset.highlightId;
      console.log('Clicked highlight:', id);
    }
  });

  // Load highlights
  safeRuntimeMessageCallback({ type: 'GET_HIGHLIGHTS', url: window.location.href.split('#')[0] }, (response) => {
    if (response && response.highlights) {
      response.highlights.forEach(applyHighlightFromData);
    }
  });

  // Notify background script that we are ready to receive focus commands
  safeRuntimeMessageCallback({ type: 'CONTENT_SCRIPT_READY' });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    // Don't show toast here as it might spam, just silently fail
    return false;
  }

  if (msg.type === 'PING') {
    sendResponse({ success: true, loaded: true });
  } else if (msg.type === 'REMOVE_HIGHLIGHT') {
    removeHighlight(msg.id);
    sendResponse({ success: true });
  } else if (msg.type === 'CLEAR_PAGE_HIGHLIGHTS') {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
      el.replaceWith(...el.childNodes);
    });
    sendResponse({ success: true });
  } else if (msg.type === 'FOCUS_HIGHLIGHT') {
    const attemptFocus = (retries = 0) => {
      const el = document.querySelector(`.${HIGHLIGHT_CLASS}[data-highlight-id="${msg.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add(HIGHLIGHT_PULSE_CLASS);
        setTimeout(() => el.classList.remove(HIGHLIGHT_PULSE_CLASS), 2500);
        return true;
      } else if (retries < 50) {
        // Retry every 100ms for up to 5 seconds
        setTimeout(() => attemptFocus(retries + 1), 100);
        return false;
      }
      return false;
    };

    if (attemptFocus()) {
      sendResponse({ success: true });
    } else {
      // If we started retrying, we can't sendResponse asynchronously easily in all cases
      // without returning true from the listener. 
      // For simplicity, we'll just send success: true immediately as we are handling it.
      sendResponse({ success: true, status: 'focusing' });
    }
  } else if (msg.type === 'CREATE_HIGHLIGHT_AT_SELECTION') {
    (async () => {
      const selection = window.getSelection();
      if (selection.isCollapsed) {
        sendResponse({ success: false, error: 'No selection' });
        return;
      }
      
      const highlightIds = getHighlightsInSelection(selection);
      if (highlightIds.length > 0) {
        // Already highlighted, show feedback
        showToast('Text is already highlighted', 'info');
        sendResponse({ success: true, action: 'already_highlighted', count: highlightIds.length });
      } else {
        // Create highlight (notification will be shown in createHighlight function)
        await createHighlight(DEFAULT_COLOR);
        sendResponse({ success: true, action: 'created' });
      }
    })();
    return true; // Indicate async response
  } else if (msg.type === 'REMOVE_HIGHLIGHT_AT_SELECTION') {
    (async () => {
      const selection = window.getSelection();
      if (selection.isCollapsed) {
        sendResponse({ success: false, error: 'No selection' });
        return;
      }
      
      const highlightIds = getHighlightsInSelection(selection);
      if (highlightIds.length > 0) {
        // Remove highlights
        await removeHighlightsByIds(highlightIds);
        showToast(`Removed ${highlightIds.length} highlight${highlightIds.length > 1 ? 's' : ''}`, 'success');
        sendResponse({ success: true, action: 'removed', count: highlightIds.length });
      } else {
        // Not highlighted, do nothing
        sendResponse({ success: true, action: 'not_highlighted' });
      }
    })();
    return true; // Indicate async response
  } else if (msg.type === 'TOGGLE_HIGHLIGHT_AT_SELECTION') {
    // Keep for backward compatibility
    (async () => {
      const selection = window.getSelection();
      if (selection.isCollapsed) {
        sendResponse({ success: false, error: 'No selection' });
        return;
      }
      
      const highlightIds = getHighlightsInSelection(selection);
      if (highlightIds.length > 0) {
        // Remove highlights
        await removeHighlightsByIds(highlightIds);
        sendResponse({ success: true, action: 'removed', count: highlightIds.length });
      } else {
        // Create highlight
        await createHighlight(DEFAULT_COLOR);
        sendResponse({ success: true, action: 'created' });
      }
    })();
    return true; // Indicate async response
  } else if (msg.type === 'CHECK_SELECTION_HIGHLIGHTED') {
    const selection = window.getSelection();
    const highlightIds = getHighlightsInSelection(selection);
    sendResponse({ 
      success: true, 
      isHighlighted: highlightIds.length > 0,
      highlightIds: highlightIds
    });
  } else if (msg.type === 'UPDATE_HIGHLIGHTS_ON_NAV') {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
      el.replaceWith(...el.childNodes);
    });
    safeRuntimeMessageCallback({ type: 'GET_HIGHLIGHTS', url: window.location.href.split('#')[0] }, (response) => {
      if (response && response.highlights) {
        response.highlights.forEach(applyHighlightFromData);
      }
    });
    sendResponse({ success: true });
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
