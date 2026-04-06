/**
 * parsers/wisdomlib.js
 *
 * Parses HTML from wisdomlib.org search results.
 *
 * Target URL:
 *   https://www.wisdomlib.org/search?q={iast_word}
 *
 * ── PATCHING GUIDE ────────────────────────────────────────────────────────────
 * If wisdomlib.org changes its HTML structure, update the selectors in the
 * SELECTOR CONSTANTS section below. All parsing logic is isolated here.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Works without DOMParser (regex only) so it can run inside a
 * Chrome Manifest V3 service worker.
 */

// ── CONSTANTS (patch here if site structure changes) ─────────────────────────

/** Base URL for wisdomlib */
export const WISDOMLIB_BASE = 'https://www.wisdomlib.org';

/** Search endpoint — append `?q={query}` */
export const WISDOMLIB_SEARCH = `${WISDOMLIB_BASE}/search`;

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

/** Extracts the value of an HTML attribute from a tag string. */
function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : '';
}

/**
 * Very light HTML "block" extractor.
 * Returns all substrings that start with `<tagName …>` and end with `</tagName>`.
 * Handles one level of nesting.
 */
function extractBlocks(html, tagName) {
  const blocks = [];
  const openRe = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, 'gi');
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

// ── KNOWLEDGE-LEVEL TAGGING ──────────────────────────────────────────────────

// Categories shown to each level (cumulative)
const LEVEL_CATEGORIES = {
  beginner:     ['hinduism', 'general', 'buddhism', 'jainism', 'yoga'],
  intermediate: ['ayurveda', 'shaivism', 'vaishnavism', 'purana', 'kavya'],
  advanced:     ['vyakarana', 'mimamsa', 'vedanta', 'tantra', 'agama', 'kosha'],
};

/**
 * Assigns a knowledge level tag to a definition entry based on its category.
 * @param {string} category
 * @returns {'beginner'|'intermediate'|'advanced'}
 */
function categoriseLevel(category) {
  const cat = (category || '').toLowerCase();
  for (const [level, cats] of Object.entries(LEVEL_CATEGORIES)) {
    if (cats.some(c => cat.includes(c))) return level;
  }
  return 'beginner'; // default
}

// ── MAIN PARSER ───────────────────────────────────────────────────────────────

/**
 * Parses wisdomlib.org search-result HTML.
 *
 * wisdomlib search results typically look like:
 *
 *   <div class="results">
 *     <div class="result">
 *       <h4><a href="/definition/dharma-1">Dharma</a></h4>
 *       <p class="definition">…definition text…</p>
 *       <span class="subject">Hinduism</span>
 *     </div>
 *     …
 *   </div>
 *
 * @param {string} html   Raw HTML from wisdomlib search page
 * @param {string} query  Original search word (for display)
 * @returns {{ definitions: WisdomlibEntry[], error: string|null }}
 *
 * @typedef {{ word: string, meaning: string, category: string, level: string, url: string }} WisdomlibEntry
 */
export function parseWisdomlib(html, query) {
  try {
    const definitions = [];

    // ── Strategy 1: structured result blocks ─────────────────────────────────
    // Try to find result container blocks.  wisdomlib uses a variety of layouts;
    // we try several patterns and take the first that yields results.

    const resultBlocks = [
      ...extractBlocks(html, 'article'),
      ...extractBlocks(html, 'li'),
    ].filter(b =>
      b.includes('definition') ||
      b.includes('meaning') ||
      b.includes('href="/definition/')
    );

    for (const block of resultBlocks.slice(0, 12)) {
      // Extract link
      const linkMatch = block.match(/href="(\/definition\/[^"]+)"/i);
      const url = linkMatch ? `${WISDOMLIB_BASE}${linkMatch[1]}` : WISDOMLIB_SEARCH;

      // Extract heading (word)
      const headingMatch = block.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
      const word = headingMatch ? stripHtml(headingMatch[1]) : query;

      // Extract definition paragraph
      const defMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const meaning = defMatch ? stripHtml(defMatch[1]) : '';

      // Extract category / subject tag
      const catMatch = block.match(/class=["'][^"']*(?:subject|category|tag)[^"']*["'][^>]*>([\s\S]*?)<\//i);
      const category = catMatch ? stripHtml(catMatch[1]) : 'General';

      if (meaning.length > 8) {
        definitions.push({
          word,
          meaning,
          category,
          level: categoriseLevel(category),
          url,
        });
      }
    }

    // ── Strategy 2: fallback — scan for any definition paragraphs ────────────
    if (definitions.length === 0) {
      const defParas = [];
      const defRe = /<p[^>]*class=["'][^"']*definition[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi;
      let m;
      while ((m = defRe.exec(html)) !== null) {
        const text = stripHtml(m[1]);
        if (text.length > 10) defParas.push(text);
      }

      // Also try plain paragraphs near definition links
      if (defParas.length === 0) {
        const sections = html.split(/href="\/definition\//i);
        for (const section of sections.slice(1, 8)) {
          const pMatch = section.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          if (pMatch) {
            const text = stripHtml(pMatch[1]);
            if (text.length > 10) defParas.push(text);
          }
        }
      }

      for (const meaning of defParas.slice(0, 8)) {
        definitions.push({
          word: query,
          meaning,
          category: 'General',
          level: 'beginner',
          url: `${WISDOMLIB_SEARCH}?q=${encodeURIComponent(query)}`,
        });
      }
    }

    return { definitions, error: null };
  } catch (err) {
    return { definitions: [], error: String(err) };
  }
}

/**
 * Builds the wisdomlib search URL for a given query.
 * @param {string} iastWord  Word in IAST (wisdomlib prefers IAST or English)
 * @returns {string}
 */
export function wisdomlibSearchUrl(iastWord) {
  return `${WISDOMLIB_SEARCH}?q=${encodeURIComponent(iastWord)}`;
}
