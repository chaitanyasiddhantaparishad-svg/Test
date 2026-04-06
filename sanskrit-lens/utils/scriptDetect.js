/**
 * utils/scriptDetect.js
 *
 * Detects the input script of a Sanskrit word.
 * Returns one of: 'devanagari' | 'iast' | 'ascii'
 */

// Devanagari Unicode block: U+0900–U+097F (and extended blocks)
const DEVANAGARI_RE = /[\u0900-\u097F\u0980-\u09FF]/;

// IAST-specific diacritic characters (won't appear in plain ASCII)
const IAST_DIACRITICS_RE =
  /[āīūṛṝḷṃḥṅñṭḍṇśṣḻĀĪŪṚṜḶṂḤṄÑṬḌṆŚṢḺ]/;

/**
 * Detects the script used in `word`.
 *
 * @param {string} word
 * @returns {'devanagari'|'iast'|'ascii'}
 */
export function detectScript(word) {
  if (DEVANAGARI_RE.test(word)) return 'devanagari';
  if (IAST_DIACRITICS_RE.test(word)) return 'iast';
  return 'ascii';
}

/**
 * Returns true if the word contains at least one Sanskrit-like character
 * (Devanagari, IAST diacritic, or alphabetic ASCII 2+ chars).
 *
 * Used by content.js to filter out purely numeric / punctuation selections.
 *
 * @param {string} word
 * @returns {boolean}
 */
export function looksLikeSanskrit(word) {
  if (!word || word.length < 2) return false;
  if (DEVANAGARI_RE.test(word)) return true;
  if (IAST_DIACRITICS_RE.test(word)) return true;
  // Plain ASCII: must be mostly letters (allow diacritics already caught above)
  return /^[a-zA-Z]{2,}$/.test(word.trim());
}
