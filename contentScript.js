const HIGHLIGHT_CLASS = 'persistent-highlighter-span';
const HIGHLIGHT_PULSE_CLASS = 'persistent-highlighter-pulse';
const TOOLTIP_ID = 'persistent-highlighter-tooltip';
const DEFAULT_COLOR = '#ffd43b'; // Yellow - matches CSS palette

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
      color: var(--highlight-text-color, inherit);
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
    
    .${HIGHLIGHT_CLASS}.persistent-highlighter-blink {
      animation: phBlink 0.4s ease-in-out 5;
      position: relative;
      z-index: 2147483646;
    }
    @keyframes phBlink {
      0%, 100% { 
        filter: brightness(1); 
        box-shadow: 0 0 0 0 var(--highlight-color);
      }
      50% { 
        filter: brightness(1.5); 
        box-shadow: 0 0 16px 6px var(--highlight-color);
        transform: scale(1.02);
      }
    }
    
    /* Wave highlight animation */
    .${HIGHLIGHT_CLASS}.persistent-highlighter-wave {
      animation: phWave 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      position: relative;
      z-index: 2147483646;
    }
    @keyframes phWave {
      0% { 
        filter: brightness(1);
        box-shadow: 0 0 0 0 var(--highlight-color);
        transform: scale(1) translateY(0);
      }
      15% {
        filter: brightness(1.8);
        box-shadow: 0 0 20px 8px var(--highlight-color);
        transform: scale(1.08) translateY(-3px);
      }
      30% {
        filter: brightness(1.2);
        box-shadow: 0 0 10px 4px var(--highlight-color);
        transform: scale(0.98) translateY(2px);
      }
      45% {
        filter: brightness(1.6);
        box-shadow: 0 0 16px 6px var(--highlight-color);
        transform: scale(1.04) translateY(-1px);
      }
      60% {
        filter: brightness(1.1);
        box-shadow: 0 0 6px 2px var(--highlight-color);
        transform: scale(1) translateY(1px);
      }
      75% {
        filter: brightness(1.3);
        box-shadow: 0 0 12px 4px var(--highlight-color);
        transform: scale(1.02) translateY(0);
      }
      100% { 
        filter: brightness(1);
        box-shadow: 0 0 0 0 var(--highlight-color);
        transform: scale(1) translateY(0);
      }
    }
    
    /* +1 Notification */
    .persistent-highlighter-plus-one {
      position: fixed;
      z-index: 2147483647;
      font-size: 32px;
      font-weight: 800;
      color: #4ade80;
      text-shadow: 
        0 0 20px rgba(74, 222, 128, 0.9),
        0 0 40px rgba(74, 222, 128, 0.6),
        0 4px 8px rgba(0, 0, 0, 0.4);
      pointer-events: none;
      animation: phPlusOne 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      letter-spacing: -1px;
    }
    @keyframes phPlusOne {
      0% { 
        opacity: 0;
        transform: translateX(-50%) translateY(20px) scale(0.5) rotate(-10deg);
        filter: blur(4px);
      }
      15% { 
        opacity: 1;
        transform: translateX(-50%) translateY(-5px) scale(1.3) rotate(5deg);
        filter: blur(0);
      }
      30% {
        transform: translateX(-50%) translateY(-15px) scale(1.1) rotate(-2deg);
      }
      50% {
        opacity: 1;
        transform: translateX(-50%) translateY(-25px) scale(1.2) rotate(0deg);
      }
      70% {
        opacity: 0.8;
        transform: translateX(-50%) translateY(-35px) scale(1) rotate(2deg);
      }
      100% { 
        opacity: 0;
        transform: translateX(-50%) translateY(-50px) scale(0.8) rotate(0deg);
        filter: blur(2px);
      }
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

function getContrastTextColor(bgColor) {
  // Convert hex to RGB
  let r, g, b;
  
  if (bgColor.startsWith('#')) {
    const hex = bgColor.replace('#', '');
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (bgColor.startsWith('rgb')) {
    const matches = bgColor.match(/\d+/g);
    if (matches && matches.length >= 3) {
      r = parseInt(matches[0]);
      g = parseInt(matches[1]);
      b = parseInt(matches[2]);
    } else {
      return '#000000'; // Default to black
    }
  } else {
    return '#000000'; // Default to black
  }
  
  // Calculate relative luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

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
      
      // Set text color for contrast
      const textColor = getContrastTextColor(color);
      span.style.setProperty('--highlight-text-color', textColor);
      
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
    
    // Extract the text to highlight
    const textToHighlight = node.textContent.substring(start, end);
    
    // Split text node at boundaries first
    let targetNode = node;
    
    // Case 1: Start is not at the beginning - split before
    if (start > 0) {
      targetNode = node.splitText(start);
    }
    
    // Case 2: End is not at the end - split after
    const actualEnd = end - start;
    if (actualEnd < targetNode.textContent.length) {
      targetNode.splitText(actualEnd);
    }
    
    // Now split the target node into words and spaces
    // Pattern: Match words (non-space) OR spaces (any length)
    const parts = textToHighlight.match(/\S+|\s+/g) || [];
    
    if (parts.length === 0) return;
    
    const parent = targetNode.parentNode;
    if (!parent) return;
    
    const fragment = document.createDocumentFragment();
    
    // Process each part and preserve ALL characters
    parts.forEach((part) => {
      // Check if this part is a word (contains non-whitespace)
      const isWord = /\S/.test(part);
      
      // ONLY highlight words - NEVER highlight any whitespace (single space, multiple spaces, newlines, etc.)
      if (isWord) {
        // Highlight the word only
        const span = document.createElement('span');
        span.className = HIGHLIGHT_CLASS;
        span.dataset.highlightId = id;
        span.style.setProperty('--highlight-color', color);
        
        // Apply semi-transparent background
        if (color.startsWith('#')) {
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          span.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
        } else {
          span.style.backgroundColor = color;
        }
        
        // Set text color for contrast
        const textColor = getContrastTextColor(color);
        span.style.setProperty('--highlight-text-color', textColor);
        
        span.textContent = part;
        fragment.appendChild(span);
        spans.push(span);
      } else {
        // This is whitespace (single space, multiple spaces, newlines, tabs, etc.)
        // IMPORTANT: Don't highlight - add as plain text to preserve spacing
        const textNode = document.createTextNode(part);
        fragment.appendChild(textNode);
      }
    });
    
    // Verify we're preserving all content before replacing
    const fragmentText = Array.from(fragment.childNodes).map(n => n.textContent).join('');
    if (fragmentText !== textToHighlight) {
      console.warn('Text mismatch! Original:', textToHighlight, 'Fragment:', fragmentText);
      // Fallback: just wrap everything in a single span if reconstruction failed
      const fallbackSpan = document.createElement('span');
      fallbackSpan.className = HIGHLIGHT_CLASS;
      fallbackSpan.dataset.highlightId = id;
      fallbackSpan.style.setProperty('--highlight-color', color);
      if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        fallbackSpan.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
      } else {
        fallbackSpan.style.backgroundColor = color;
      }
      fallbackSpan.textContent = textToHighlight;
      const fallbackFragment = document.createDocumentFragment();
      fallbackFragment.appendChild(fallbackSpan);
      parent.replaceChild(fallbackFragment, targetNode);
      spans.push(fallbackSpan);
      return;
    }
    
    // Replace the original text node with the fragment
    parent.replaceChild(fragment, targetNode);
   });
 
   // Apply wave animation to all spans
   if (spans.length > 0) {
     // Add wave animation with staggered delay
     spans.forEach((span, index) => {
       span.classList.add('persistent-highlighter-wave');
       span.style.animationDelay = `${index * 0.05}s`; // Stagger by 50ms
       
       // Remove wave class after animation
       setTimeout(() => {
         span.classList.remove('persistent-highlighter-wave');
         span.style.animationDelay = '';
       }, 800 + (index * 50));
     });
     
     // Show +1 notification near the first span
     showPlusOneNotification(spans[0]);
   }
 
   return spans;
 }
 
 function showPlusOneNotification(element) {
   const rect = element.getBoundingClientRect();
   const notification = document.createElement('div');
   notification.className = 'persistent-highlighter-plus-one';
   notification.textContent = '+1';
   
   // Position near the highlight (centered)
   notification.style.left = `${rect.left + rect.width / 2}px`;
   notification.style.top = `${rect.top - 10}px`;
   
   document.body.appendChild(notification);
   
   // Remove after animation
   setTimeout(() => {
     if (notification.parentNode) {
       notification.parentNode.removeChild(notification);
     }
   }, 1200);
   
   // Send message to background to blink badge
   chrome.runtime.sendMessage({ 
     type: 'HIGHLIGHT_CREATED',
     timestamp: Date.now()
   });
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
    <button id="ph-btn-yellow" aria-label="Yellow Highlight"><div class="color-dot" style="background: #ffd43b"></div></button>
    <button id="ph-btn-green" aria-label="Green Highlight"><div class="color-dot" style="background: #51cf66"></div></button>
    <button id="ph-btn-blue" aria-label="Blue Highlight"><div class="color-dot" style="background: #4dabf7"></div></button>
    <button id="ph-btn-purple" aria-label="Purple Highlight"><div class="color-dot" style="background: #9775fa"></div></button>
    <button id="ph-btn-pink" aria-label="Pink Highlight"><div class="color-dot" style="background: #ff6ba7"></div></button>
    <div class="divider"></div>
    <button id="ph-btn-delete" aria-label="Remove"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
  `;

  document.body.appendChild(el);

  // Event Listeners
  el.querySelector('#ph-btn-yellow').onclick = () => createHighlight('#ffd43b', 'yellow');
  el.querySelector('#ph-btn-green').onclick = () => createHighlight('#51cf66', 'green');
  el.querySelector('#ph-btn-blue').onclick = () => createHighlight('#4dabf7', 'blue');
  el.querySelector('#ph-btn-purple').onclick = () => createHighlight('#9775fa', 'purple');
  el.querySelector('#ph-btn-pink').onclick = () => createHighlight('#ff6ba7', 'pink');
  el.querySelector('#ph-btn-delete').onclick = async () => {
    const selection = window.getSelection();
    if (!selection.isCollapsed) {
      const highlightIds = getHighlightsInSelection(selection);
      if (highlightIds.length > 0) {
        await removeHighlightsByIds(highlightIds);
        showToast(`Removed ${highlightIds.length} highlight${highlightIds.length > 1 ? 's' : ''}`, 'success');
      } else {
        showToast('No highlights in selection', 'info');
      }
      selection.removeAllRanges();
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

function trimRange(range) {
  // Clone the range to avoid modifying the original
  const trimmedRange = range.cloneRange();
  
  // Helper function to move range start forward past whitespace
  function trimStart(range) {
    let startContainer = range.startContainer;
    let startOffset = range.startOffset;
    
    // If start is in an element node, find the first text node
    if (startContainer.nodeType !== Node.TEXT_NODE) {
      const walker = document.createTreeWalker(
        startContainer,
        NodeFilter.SHOW_TEXT,
        null
      );
      let node = walker.nextNode();
      if (node) {
        startContainer = node;
        startOffset = 0;
      }
    }
    
    // If we're in a text node, skip leading whitespace
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const text = startContainer.textContent;
      while (startOffset < text.length && /\s/.test(text[startOffset])) {
        startOffset++;
      }
      
      // If we've consumed the entire text node, move to next text node
      if (startOffset >= text.length) {
        const walker = document.createTreeWalker(
          range.commonAncestorContainer,
          NodeFilter.SHOW_TEXT,
          null
        );
        walker.currentNode = startContainer;
        let nextNode = walker.nextNode();
        
        while (nextNode && nextNode !== range.endContainer) {
          const nextText = nextNode.textContent;
          const firstNonWhitespace = nextText.search(/\S/);
          
          if (firstNonWhitespace !== -1) {
            startContainer = nextNode;
            startOffset = firstNonWhitespace;
            break;
          }
          nextNode = walker.nextNode();
        }
      }
      
      range.setStart(startContainer, startOffset);
    }
  }
  
  // Helper function to move range end backward past whitespace
  function trimEnd(range) {
    let endContainer = range.endContainer;
    let endOffset = range.endOffset;
    
    // If end is in an element node, find the last text node
    if (endContainer.nodeType !== Node.TEXT_NODE) {
      const walker = document.createTreeWalker(
        endContainer,
        NodeFilter.SHOW_TEXT,
        null
      );
      let node = walker.lastChild();
      if (node) {
        endContainer = node;
        endOffset = node.textContent.length;
      }
    }
    
    // If we're in a text node, skip trailing whitespace
    if (endContainer.nodeType === Node.TEXT_NODE) {
      const text = endContainer.textContent;
      while (endOffset > 0 && /\s/.test(text[endOffset - 1])) {
        endOffset--;
      }
      
      // If we've gone to the start of this text node, move to previous text node
      if (endOffset === 0) {
        const walker = document.createTreeWalker(
          range.commonAncestorContainer,
          NodeFilter.SHOW_TEXT,
          null
        );
        walker.currentNode = endContainer;
        let prevNode = walker.previousNode();
        
        while (prevNode && prevNode !== range.startContainer) {
          const prevText = prevNode.textContent;
          const lastNonWhitespace = prevText.search(/\S(?=\s*$)/);
          
          if (lastNonWhitespace !== -1) {
            endContainer = prevNode;
            endOffset = lastNonWhitespace + 1;
            break;
          }
          prevNode = walker.previousNode();
        }
      }
      
      range.setEnd(endContainer, endOffset);
    }
  }
  
  // Trim both ends
  trimStart(trimmedRange);
  trimEnd(trimmedRange);
  
  // Validate the range
  if (trimmedRange.collapsed || !trimmedRange.toString().trim()) {
    return null;
  }
  
  return trimmedRange;
}

async function createHighlight(color, colorName = 'yellow') {
  // Proactive check for extension context
  if (!isExtensionContextValid()) {
    showContextInvalidatedToast();
    return;
  }

  const selection = window.getSelection();
  if (selection.isCollapsed) return;

  let range = selection.getRangeAt(0);
  
  // TRIM WHITESPACE FROM RANGE BOUNDARIES
  // This ensures we never highlight leading/trailing spaces
  const trimmedRange = trimRange(range);
  
  if (!trimmedRange) {
    console.warn('No valid range after trimming');
    return;
  }
  
  range = trimmedRange;
  
  // Get the trimmed text
  let selectedText = range.toString().trim();
  
  if (!selectedText) {
    console.warn('No text found in selection after trimming');
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
    color: colorName, // Save color name (yellow, green, blue, purple, pink)
    hexColor: color, // Save hex value for display
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
  } else if (msg.type === 'BLINK_HIGHLIGHT') {
    // Blink all spans with this highlight ID
    const attemptBlink = (retries = 0) => {
      const elements = document.querySelectorAll(`.${HIGHLIGHT_CLASS}[data-highlight-id="${msg.id}"]`);
      if (elements.length > 0) {
        // Scroll to first element
        elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Blink all spans
        elements.forEach(el => {
          el.classList.add('persistent-highlighter-blink');
          el.style.setProperty('--highlight-color', el.style.backgroundColor || '#FFEB3B');
        });
        
        // Remove blink class after animation
        setTimeout(() => {
          elements.forEach(el => el.classList.remove('persistent-highlighter-blink'));
        }, 2000); // 5 blinks * 400ms = 2000ms
        
        return true;
      } else if (retries < 50) {
        // Retry every 100ms for up to 5 seconds
        setTimeout(() => attemptBlink(retries + 1), 100);
        return false;
      }
      return false;
    };

    if (attemptBlink()) {
      sendResponse({ success: true });
    } else {
      sendResponse({ success: true, status: 'blinking' });
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