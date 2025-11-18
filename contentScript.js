const HIGHLIGHT_CLASS = 'persistent-highlighter-span';

function getXPathForNode(node) {
  if (node === document.body) {
    return '/html/body';
  }
  const parts = [];
  while (node && node.nodeType !== Node.DOCUMENT_NODE) {
    let index = 1;
    let sibling = node.previousSibling;
    while (sibling) {
      if (sibling.nodeName === node.nodeName) {
        index += 1;
      }
      sibling = sibling.previousSibling;
    }
    const tagName = node.nodeType === Node.TEXT_NODE ? 'text()' : node.nodeName.toLowerCase();
    parts.unshift(`${tagName}[${index}]`);
    node = node.parentNode;
  }
  return `/${parts.join('/')}`;
}

function getNodeFromXPath(xpath) {
  try {
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
  } catch (error) {
    console.warn('Persistent highlighter: failed to resolve XPath', xpath, error);
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

function createHighlightElement(id, color) {
  const span = document.createElement('mark');
  span.className = HIGHLIGHT_CLASS;
  span.dataset.highlightId = id;
  span.style.backgroundColor = color || '#fffd54';
  span.style.padding = '0 1px';
  span.style.borderRadius = '2px';
  return span;
}

function applyRangeToDom(range, highlightId, color) {
  const highlight = createHighlightElement(highlightId, color);
  try {
    range.surroundContents(highlight);
  } catch (error) {
    const fragment = range.extractContents();
    highlight.appendChild(fragment);
    range.insertNode(highlight);
  }
  return highlight.textContent;
}

function applyHighlightFromData(data) {
  const startNode = getNodeFromXPath(data.range.startXPath);
  const endNode = getNodeFromXPath(data.range.endXPath);
  if (!startNode || !endNode) {
    return;
  }
  const range = document.createRange();
  try {
    range.setStart(startNode, data.range.startOffset);
    range.setEnd(endNode, data.range.endOffset);
  } catch (error) {
    console.warn('Persistent highlighter: could not recreate range', error);
    return;
  }
  applyRangeToDom(range, data.id, data.color);
}

function removeHighlightFromDom(id) {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}[data-highlight-id="${id}"]`).forEach((node) => {
    const parent = node.parentNode;
    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }
    parent.removeChild(node);
    parent.normalize();
  });
}

function updateHighlightColor(id, color) {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}[data-highlight-id="${id}"]`).forEach((node) => {
    node.style.backgroundColor = color;
  });
}

async function bootstrapHighlights() {
  const url = window.location.href.split('#')[0];
  chrome.runtime.sendMessage({ type: 'GET_HIGHLIGHTS', url }, (response) => {
    if (response?.success) {
      response.highlights.forEach(applyHighlightFromData);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CREATE_HIGHLIGHT') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      sendResponse({ success: false, error: 'Please select text to highlight.' });
      return;
    }
    const range = selection.getRangeAt(0).cloneRange();
    const id = crypto.randomUUID();
    const text = applyRangeToDom(range, id, message.color || '#fffd54');
    const serializedRange = serializeRange(range);
    selection.removeAllRanges();
    sendResponse({
      success: true,
      highlight: {
        id,
        text,
        color: message.color || '#fffd54',
        note: message.note || '',
        url: window.location.href.split('#')[0],
        createdAt: Date.now(),
        range: serializedRange,
      },
    });
  } else if (message.type === 'REMOVE_HIGHLIGHT') {
    removeHighlightFromDom(message.id);
    sendResponse({ success: true });
  } else if (message.type === 'UPDATE_HIGHLIGHT_STYLE') {
    updateHighlightColor(message.id, message.color);
    sendResponse({ success: true });
  }
  return true;
});

bootstrapHighlights();
