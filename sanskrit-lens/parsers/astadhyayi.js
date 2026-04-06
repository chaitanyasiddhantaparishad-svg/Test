/**
 * parsers/astadhyayi.js
 *
 * Parses HTML from astadhyayi.com for:
 *   1. Koshanveshanam (dictionary search)   → parseKoshanveshanam()
 *   2. Sutra pages                          → parseSutra()
 *   3. Dhātu / derivation pages             → parseDhatu()
 *
 * ── PATCHING GUIDE ────────────────────────────────────────────────────────────
 * All site-specific URL templates and CSS class names are declared as
 * constants at the top of each section. Update them here if the site changes.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Works without DOMParser (regex only) so it can run inside a
 * Chrome Manifest V3 service worker.
 */

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

export const ASTADHYAYI_BASE      = 'https://astadhyayi.com';
export const KOSHANVESHANAM_URL   = `${ASTADHYAYI_BASE}/koshanveshanam/`;
export const SUTRA_BASE_URL       = `${ASTADHYAYI_BASE}/sutra/`;
export const DHATU_BASE_URL       = `${ASTADHYAYI_BASE}/dhatu/`;

// ── HELPERS ───────────────────────────────────────────────────────────────────

/** Strips all HTML tags and decodes common HTML entities. */
function stripHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts all top-level blocks for a given tagName.
 * Does not recurse into nested same-tag blocks.
 */
function extractBlocks(html, tagName) {
  const blocks = [];
  const openRe = new RegExp(`<${tagName}(\\s[^>]*)?>`, 'gi');
  const closeTag = `</${tagName}>`;
  let m;
  while ((m = openRe.exec(html)) !== null) {
    const start = m.index;
    const closeIdx = html.indexOf(closeTag, start + m[0].length);
    if (closeIdx === -1) continue;
    blocks.push(html.slice(start, closeIdx + closeTag.length));
  }
  return blocks;
}

/** Returns the first regex match or empty string. */
function first(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : '';
}

// ── 1. KOSHANVESHANAM (dictionary search) ────────────────────────────────────

/**
 * Builds the Koshanveshanam search URL.
 * @param {string} word  Word in IAST or Devanagari
 * @returns {string}
 */
export function koshanveshanamUrl(word) {
  return `${KOSHANVESHANAM_URL}?q=${encodeURIComponent(word)}`;
}

/**
 * Parses astadhyayi.com/koshanveshanam search-result HTML.
 *
 * Expected structure (approximate):
 *   <table class="results">
 *     <tr>
 *       <td class="word">dharma</td>
 *       <td class="meaning">…</td>
 *       <td class="sutra"><a href="/sutra/1.1.1">1.1.1</a></td>
 *     </tr>
 *   </table>
 *
 * @param {string} html   Raw HTML from koshanveshanam page
 * @param {string} query  Original search term
 * @returns {{ results: KoshanEntry[], url: string, error: string|null }}
 *
 * @typedef {{ word: string, meaning: string, sutraRef: string, sutraUrl: string }} KoshanEntry
 */
export function parseKoshanveshanam(html, query) {
  try {
    const results = [];

    // Try table rows first
    const rows = extractBlocks(html, 'tr');
    for (const row of rows.slice(0, 20)) {
      const cells = extractBlocks(row, 'td');
      if (cells.length < 2) continue;

      const word    = stripHtml(cells[0] ?? '');
      const meaning = stripHtml(cells[1] ?? '');
      if (!word || !meaning || meaning.length < 3) continue;

      // Sutra reference (3rd cell or inline link)
      const sutraMatch = row.match(/href="([^"]*sutra[^"]*)"/i) ||
                         row.match(/href="([^"]*\d+\.\d+[^"]*)"/);
      const sutraUrl  = sutraMatch ? (sutraMatch[1].startsWith('http') ? sutraMatch[1] : `${ASTADHYAYI_BASE}${sutraMatch[1]}`) : '';
      const sutraRef  = stripHtml(cells[2] ?? '') || (sutraUrl ? sutraUrl.split('/').pop() : '');

      results.push({ word, meaning, sutraRef, sutraUrl });
    }

    // Fallback: look for definition/list items
    if (results.length === 0) {
      const items = [
        ...extractBlocks(html, 'li'),
        ...extractBlocks(html, 'div'),
      ].filter(b => b.length > 30 && b.length < 2000);

      for (const item of items.slice(0, 10)) {
        const text = stripHtml(item);
        if (text.length > 8) {
          results.push({ word: query, meaning: text, sutraRef: '', sutraUrl: '' });
        }
      }
    }

    return {
      results,
      url: koshanveshanamUrl(query),
      error: null,
    };
  } catch (err) {
    return { results: [], url: koshanveshanamUrl(query), error: String(err) };
  }
}

// ── 2. SUTRA PAGE ─────────────────────────────────────────────────────────────

/**
 * Builds the sutra page URL.
 * @param {string} sutraNumber  e.g. "1.1.1" or "1-1-1"
 * @returns {string}
 */
export function sutraUrl(sutraNumber) {
  return `${SUTRA_BASE_URL}${encodeURIComponent(sutraNumber)}`;
}

/**
 * Parses an astadhyayi.com sutra page.
 *
 * Expected structure (approximate):
 *   <h1 class="sutra-id">1.1.1</h1>
 *   <p  class="sutra-text">वृद्धिरादैच्</p>
 *   <div class="sutra-meaning">…English meaning…</div>
 *   <div class="sutra-commentary">…detailed commentary…</div>
 *
 * @param {string} html
 * @returns {{ sutras: SutraEntry[], error: string|null }}
 *
 * @typedef {{ number: string, text: string, meaning: string, commentary: string, url: string }} SutraEntry
 */
export function parseSutra(html, number) {
  try {
    const sutras = [];

    // Try to extract sutra number
    const numPatterns = [
      /<h1[^>]*class=["'][^"']*sutra[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
      /<h2[^>]*>([\s\S]*?)<\/h2>/i,
      /<span[^>]*class=["'][^"']*id[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    ];
    let foundNumber = number || '';
    for (const re of numPatterns) {
      const v = first(html, re);
      if (v && /\d+\.\d+/.test(v)) { foundNumber = stripHtml(v); break; }
    }

    // Try to extract Devanagari/IAST sutra text
    const textPatterns = [
      /<[^>]*class=["'][^"']*sutra-text[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
      /<[^>]*class=["'][^"']*devanagari[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
      /<[^>]*lang=["']sa["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    ];
    let sutraText = '';
    for (const re of textPatterns) {
      const v = first(html, re);
      if (v) { sutraText = stripHtml(v); break; }
    }

    // English meaning
    const meaningPatterns = [
      /<[^>]*class=["'][^"']*meaning[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
      /<[^>]*class=["'][^"']*translation[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    ];
    let meaning = '';
    for (const re of meaningPatterns) {
      const v = first(html, re);
      if (v) { meaning = stripHtml(v); break; }
    }

    // Commentary
    const commentaryPatterns = [
      /<[^>]*class=["'][^"']*commentary[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
      /<[^>]*class=["'][^"']*vrtti[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    ];
    let commentary = '';
    for (const re of commentaryPatterns) {
      const v = first(html, re);
      if (v) { commentary = stripHtml(v).slice(0, 400); break; }
    }

    // Fallback — grab first two meaningful paragraphs
    if (!meaning) {
      const paras = [];
      const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let pm;
      while ((pm = pRe.exec(html)) !== null) {
        const t = stripHtml(pm[1]);
        if (t.length > 15 && !/copyright|menu|nav/i.test(t)) {
          paras.push(t);
          if (paras.length >= 2) break;
        }
      }
      meaning = paras.join(' ');
    }

    sutras.push({
      number: foundNumber,
      text: sutraText,
      meaning,
      commentary,
      url: sutraUrl(foundNumber),
    });

    return { sutras, error: null };
  } catch (err) {
    return { sutras: [], error: String(err) };
  }
}

// ── 3. DHĀTU / DERIVATION PAGE ───────────────────────────────────────────────

/**
 * Builds the dhātu page URL.
 * @param {string} root  Root in SLP1 or IAST
 * @returns {string}
 */
export function dhatuUrl(root) {
  return `${DHATU_BASE_URL}${encodeURIComponent(root)}`;
}

/**
 * Parses an astadhyayi.com dhātu (root) page.
 *
 * Expected structure (approximate):
 *   <div class="dhatu">
 *     <span class="root">√bhū</span>
 *     <span class="gana">1</span>
 *     <span class="meaning">to become, to be</span>
 *     <div class="derivation">…</div>
 *   </div>
 *
 * @param {string} html
 * @param {string} root  The dhātu/root being looked up
 * @returns {{ roots: DhatuEntry[], error: string|null }}
 *
 * @typedef {{ root: string, gana: string, meaning: string, derivation: string, url: string }} DhatuEntry
 */
export function parseDhatu(html, root) {
  try {
    const roots = [];

    // Root blocks
    const blocks = [
      ...extractBlocks(html, 'tr'),
      ...extractBlocks(html, 'div'),
    ].filter(b =>
      b.includes('root') || b.includes('dhatu') || b.includes('gana') || b.includes('√')
    );

    for (const block of blocks.slice(0, 8)) {
      // Root symbol
      const rootMatch = block.match(/(?:class=["'][^"']*root[^"']*["'][^>]*>)([\s\S]*?)(?:<\/)/i) ||
                        block.match(/√([a-zA-Zāīūṛṝḷṃḥṅñṭḍṇśṣḻ]+)/i);
      const foundRoot = rootMatch ? stripHtml(rootMatch[1]).replace(/^√/, '') : root;

      // Gaṇa (conjugation class)
      const ganaMatch = block.match(/(?:class=["'][^"']*gana[^"']*["'][^>]*>)([\s\S]*?)(?:<\/)/i) ||
                        block.match(/\b([1-9]|10)P\b|\b([1-9]|10)Ā\b/);
      const gana = ganaMatch ? stripHtml(ganaMatch[1]) : '';

      // Meaning
      const meaningMatch =
        block.match(/(?:class=["'][^"']*meaning[^"']*["'][^>]*>)([\s\S]*?)(?:<\/)/i) ||
        block.match(/<td[^>]*>(to\s[\s\S]*?)<\/td>/i);
      const meaning = meaningMatch ? stripHtml(meaningMatch[1]) : '';

      // Derivation / suffix breakdown
      const derivMatch = block.match(/(?:class=["'][^"']*deriv[^"']*["'][^>]*>)([\s\S]*?)(?:<\/)/i);
      const derivation = derivMatch ? stripHtml(derivMatch[1]).slice(0, 300) : '';

      if (foundRoot || meaning) {
        roots.push({ root: foundRoot, gana, meaning, derivation, url: dhatuUrl(foundRoot) });
      }
    }

    // Fallback: extract from paragraphs
    if (roots.length === 0) {
      const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let pm;
      while ((pm = pRe.exec(html)) !== null) {
        const t = stripHtml(pm[1]);
        if (t.length > 10 && !/copyright|menu|nav/i.test(t)) {
          roots.push({ root, gana: '', meaning: t, derivation: '', url: dhatuUrl(root) });
          if (roots.length >= 4) break;
        }
      }
    }

    return { roots, error: null };
  } catch (err) {
    return { roots: [], error: String(err) };
  }
}

// ── SANDHI / ROOT HEURISTICS ─────────────────────────────────────────────────

/**
 * Very light heuristic: strips common Sanskrit suffixes to guess a root.
 * This is best-effort only — the Grammar tab exposes a manual override.
 *
 * @param {string} slp1  Word in SLP1
 * @returns {{ possibleRoots: string[], note: string }}
 */
export function guessDhatuFromSLP1(slp1) {
  const word = slp1.toLowerCase();
  const suffixes = [
    // Nominal suffixes (stripped to get stem)
    'asya','AyE','Anf','Anf','Anti','ante','ati','ate',
    'ita','ita','itum','itvA','ya','ana','ana','man','van',
    // Common taddhita / kṛt
    'tva','tA','ka','ika','iya','vat','mat','In',
    // Sandhi-common endings
    'aH','iH','uH','eH','AH','IH','UH',
    'am','im','um','em','om',
    'An','in','un',
  ];

  const candidates = new Set();
  for (const suf of suffixes) {
    if (word.endsWith(suf.toLowerCase()) && word.length - suf.length >= 2) {
      candidates.add(word.slice(0, word.length - suf.length));
    }
  }

  // Always include the raw word and a trimmed version
  candidates.add(word);
  if (word.endsWith('a') || word.endsWith('A')) candidates.add(word.slice(0, -1));

  return {
    possibleRoots: [...candidates].slice(0, 5),
    note: 'Automatic root detection is approximate. Use the search bar to override.',
  };
}
