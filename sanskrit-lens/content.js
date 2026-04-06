/**
 * content.js — Sanskrit Lens content script
 *
 * Listens for text selection (mouseup) on any page.
 * If the selected text looks like a Sanskrit word, it is sent to
 * the background service worker for processing.
 *
 * Bundled to content.bundle.js by esbuild (see build.js).
 * ES-module imports are fine here — esbuild flattens them.
 */

import { looksLikeSanskrit } from './utils/scriptDetect.js';

// Minimum / maximum selection lengths to bother processing
const MIN_LEN = 2;
const MAX_LEN = 80;

// Debounce — avoid firing on every tiny mouse movement
let debounceTimer = null;

document.addEventListener('mouseup', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(handleSelection, 120);
});

// Also support keyboard-driven selection
document.addEventListener('keyup', (e) => {
  if (e.shiftKey || e.key === 'End' || e.key === 'Home') {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(handleSelection, 200);
  }
});

function handleSelection() {
  const selection = window.getSelection();
  if (!selection) return;

  const word = selection.toString().trim();
  if (word.length < MIN_LEN || word.length > MAX_LEN) return;

  // Only forward if it looks like Sanskrit (not arbitrary English, numbers…)
  if (!looksLikeSanskrit(word)) return;

  // Avoid sending the same word twice in rapid succession
  if (word === handleSelection._last) return;
  handleSelection._last = word;
  setTimeout(() => { handleSelection._last = null; }, 3000);

  try {
    chrome.runtime.sendMessage({ type: 'WORD_SELECTED', word });
  } catch {
    // Extension context may have been invalidated (e.g. after reload)
  }
}
handleSelection._last = null;
