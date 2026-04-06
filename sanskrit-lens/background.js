/**
 * background.js — Sanskrit Lens service worker
 *
 * Responsibilities:
 *  1. Receive WORD_SELECTED / MANUAL_SEARCH messages from content / sidepanel
 *  2. Detect script, normalise to SLP1
 *  3. Open the side panel for the originating tab
 *  4. Fire 4 parallel fetches, parse HTML, write results into chrome.storage.session
 *  5. Sidepanel reads / watches chrome.storage.session for reactive updates
 *
 * All fetch + parse logic lives here so the sidepanel stays CORS-free.
 */

import { detectScript }   from './utils/scriptDetect.js';
import { toSLP1, slp1ToIAST, slp1ToDevanagari } from './utils/normalize.js';
import { parseWisdomlib, wisdomlibSearchUrl }     from './parsers/wisdomlib.js';
import {
  parseKoshanveshanam, koshanveshanamUrl,
  parseSutra,         sutraUrl,
  parseDhatu,         dhatuUrl,
  guessDhatuFromSLP1,
} from './parsers/astadhyayi.js';

// ── Setup ─────────────────────────────────────────────────────────────────────

// Allow opening the panel via the toolbar action button too.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => { /* not available in all Chrome versions */ });

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION_KEY = 'currentLookup';

/** Merge a partial update into the stored lookup object. */
async function updateLookup(patch) {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  const current = stored[SESSION_KEY] ?? {};
  await chrome.storage.session.set({ [SESSION_KEY]: { ...current, ...patch } });
}

/** Fetch a URL and return its text, or null on failure. */
async function safeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        // Identify ourselves; good practice
        'User-Agent': 'SanskritLens/1.0 Chrome Extension',
      },
      // Some sites redirect; follow up to 5 hops
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ── Core lookup logic ─────────────────────────────────────────────────────────

/**
 * Processes a word: normalises, stores initial state, opens panel,
 * then fires 4 parallel fetches and progressively updates storage.
 *
 * @param {string} rawWord   The word as selected / typed by the user
 * @param {number|null} tabId  Chrome tab ID (null for manual sidepanel searches)
 * @param {string} sourceUrl   URL of the page where the word was found
 */
async function processWord(rawWord, tabId, sourceUrl) {
  const word   = rawWord.trim();
  if (!word) return;

  const script  = detectScript(word);
  const slp1    = toSLP1(word, script);
  const iast    = slp1ToIAST(slp1);
  const devanagari = script === 'devanagari' ? word : slp1ToDevanagari(slp1);

  const { possibleRoots, note: rootNote } = guessDhatuFromSLP1(slp1);
  const primaryRoot = possibleRoots[0] ?? slp1;

  // Initialise lookup record (loading state)
  const initial = {
    word,
    slp1,
    iast,
    devanagari,
    script,
    sourceUrl,
    timestamp: Date.now(),
    possibleRoots,
    rootNote,
    // Data buckets — null = not yet loaded
    wisdomlib:     null,
    koshanveshanam: null,
    sutra:         null,
    dhatu:         null,
  };
  await chrome.storage.session.set({ [SESSION_KEY]: initial });

  // Open the side panel (requires Chrome 116+)
  if (tabId != null) {
    chrome.sidePanel.open({ tabId }).catch(() => {
      // Graceful fallback if gesture requirement blocks auto-open
    });
  }

  // Determine query strings
  const iastQuery = iast || word;
  const rootQuery = slp1ToIAST(primaryRoot) || primaryRoot;

  // ── 4 parallel fetches ────────────────────────────────────────────────────

  const wlUrl    = wisdomlibSearchUrl(iastQuery);
  const kvUrl    = koshanveshanamUrl(iastQuery);
  // We don't know the sutra number yet; fetch an index / search page instead
  const sutraSearchUrl = `https://astadhyayi.com/sutra/?q=${encodeURIComponent(iastQuery)}`;
  const dhatuSearchUrl = `https://astadhyayi.com/dhatu/?q=${encodeURIComponent(rootQuery)}`;

  const fetchAndUpdate = async (key, url, parser) => {
    const html   = await safeFetch(url);
    const result = html ? parser(html) : { error: 'Network error or empty response' };
    await updateLookup({ [key]: { ...result, fetchUrl: url } });
  };

  await Promise.allSettled([
    fetchAndUpdate('wisdomlib',      wlUrl,          html => parseWisdomlib(html, iastQuery)),
    fetchAndUpdate('koshanveshanam', kvUrl,          html => parseKoshanveshanam(html, iastQuery)),
    fetchAndUpdate('sutra',          sutraSearchUrl, html => parseSutra(html, '')),
    fetchAndUpdate('dhatu',          dhatuSearchUrl, html => parseDhatu(html, rootQuery)),
  ]);
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId     = sender?.tab?.id ?? null;
  const sourceUrl = sender?.tab?.url ?? '';

  if (message.type === 'WORD_SELECTED') {
    processWord(message.word, tabId, sourceUrl);
    return false; // synchronous handler
  }

  if (message.type === 'MANUAL_SEARCH') {
    // Triggered from the sidepanel search bar; no tabId needed for panel re-open
    processWord(message.word, null, sourceUrl);
    return false;
  }
});
