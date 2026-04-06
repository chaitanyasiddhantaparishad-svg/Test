/**
 * utils/normalize.js
 *
 * Converts Sanskrit text between scripts.
 * Internal canonical form is SLP1 (ASCII, unambiguous).
 *
 * SLP1 reference:
 *   Vowels : a A i I u U f F x X e E o O
 *   Nasals / specials: M (anusvara) H (visarga)
 *   Velar  : k K g G N
 *   Palatal: c C j J Y
 *   Retroflex: w W q Q R
 *   Dental : t T d D n
 *   Labial : p P b B m
 *   Semivowels: y r l v
 *   Sibilants: S z s
 *   Aspirate: h
 *   Retroflex-L: L
 */

// ─── Devanagari → SLP1 ────────────────────────────────────────────────────────

const DEV_TO_SLP1 = {
  // Independent vowels
  'अ': 'a', 'आ': 'A', 'इ': 'i', 'ई': 'I', 'उ': 'u', 'ऊ': 'U',
  'ऋ': 'f', 'ॠ': 'F', 'ऌ': 'x', 'ए': 'e', 'ऐ': 'E', 'ओ': 'o', 'औ': 'O',
  // Vowel diacritics (mātrās)
  'ा': 'A', 'ि': 'i', 'ी': 'I', 'ु': 'u', 'ू': 'U',
  'ृ': 'f', 'ॄ': 'F', 'ॢ': 'x', 'े': 'e', 'ै': 'E', 'ो': 'o', 'ौ': 'O',
  // Anusvara / visarga / chandrabindu
  'ं': 'M', 'ः': 'H', 'ँ': 'M',
  // Virama — suppresses inherent 'a'; map to empty
  '्': '',
  // Consonants
  'क': 'k', 'ख': 'K', 'ग': 'g', 'घ': 'G', 'ङ': 'N',
  'च': 'c', 'छ': 'C', 'ज': 'j', 'झ': 'J', 'ञ': 'Y',
  'ट': 'w', 'ठ': 'W', 'ड': 'q', 'ढ': 'Q', 'ण': 'R',
  'त': 't', 'थ': 'T', 'द': 'd', 'ध': 'D', 'न': 'n',
  'प': 'p', 'फ': 'P', 'ब': 'b', 'भ': 'B', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'S', 'ष': 'z', 'स': 's', 'ह': 'h',
  'ळ': 'L', 'ऴ': 'L',
  // Digits
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  // Punctuation / danda — pass through
  '।': '|', '॥': '||',
};

/**
 * Converts Devanagari text to SLP1.
 * Each consonant without an explicit vowel sign gets the inherent 'a',
 * except before virama.
 *
 * @param {string} text
 * @returns {string}
 */
export function devanagariToSLP1(text) {
  // NFC normalise first
  text = text.normalize('NFC');
  let result = '';
  const chars = [...text]; // handle multi-byte Unicode chars correctly

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1] ?? '';

    if (ch in DEV_TO_SLP1) {
      const mapped = DEV_TO_SLP1[ch];
      // If this is a consonant (mapped is a lowercase/uppercase consonant letter),
      // add inherent 'a' unless next char is a vowel diacritic or virama.
      const isConsonant =
        mapped.length === 1 &&
        'kKgGNcCjJYwWqQRtTdDnpPbBmyrlvSzshL'.includes(mapped);
      const nextIsVowelOrVirama =
        next === '्' || next in { 'ा':1,'ि':1,'ी':1,'ु':1,'ू':1,'ृ':1,'ॄ':1,'ॢ':1,'े':1,'ै':1,'ो':1,'ौ':1,'ं':1,'ः':1 };

      result += mapped;
      if (isConsonant && !nextIsVowelOrVirama) {
        result += 'a'; // inherent vowel
      }
    } else {
      result += ch; // pass through unknown chars
    }
  }
  return result;
}

// ─── IAST → SLP1 ─────────────────────────────────────────────────────────────
//
// Order matters: longer / diacritic patterns must precede shorter ones.

const IAST_TO_SLP1_MAP = [
  // Digraph aspirates (must come before single-char mappings)
  ['kh', 'K'], ['gh', 'G'],
  ['ch', 'C'], ['jh', 'J'],
  ['ṭh', 'W'], ['ḍh', 'Q'],
  ['th', 'T'], ['dh', 'D'],
  ['ph', 'P'], ['bh', 'B'],
  // Long vowels / diphthongs
  ['ai', 'E'], ['au', 'O'],
  ['ā',  'A'], ['ī',  'I'], ['ū',  'U'],
  ['ṛ',  'f'], ['ṝ',  'F'], ['ḷ',  'x'],
  // Special consonants
  ['ṃ',  'M'], ['ḥ',  'H'],
  ['ṅ',  'N'], ['ñ',  'Y'],
  ['ṭ',  'w'], ['ḍ',  'q'], ['ṇ',  'R'],
  ['ś',  'S'], ['ṣ',  'z'], ['ḻ',  'L'],
  // Plain ASCII pass-throughs
  ['a','a'],['i','i'],['u','u'],['e','e'],['o','o'],
  ['k','k'],['g','g'],['c','c'],['j','j'],['ṅ','N'],
  ['t','t'],['d','d'],['n','n'],
  ['p','p'],['b','b'],['m','m'],
  ['y','y'],['r','r'],['l','l'],['v','v'],
  ['s','s'],['h','h'],
];

/**
 * Converts IAST-encoded text to SLP1.
 * @param {string} text
 * @returns {string}
 */
export function iastToSLP1(text) {
  text = text.normalize('NFC').toLowerCase();
  let result = '';
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const [iast, slp1] of IAST_TO_SLP1_MAP) {
      if (text.startsWith(iast, i)) {
        result += slp1;
        i += iast.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += text[i++];
    }
  }
  return result;
}

// ─── ASCII (approx. Harvard-Kyoto) → SLP1 ────────────────────────────────────

const ASCII_TO_SLP1_MAP = [
  // Digraphs first
  ['kh', 'K'], ['gh', 'G'], ['Gh', 'G'],
  ['ch', 'C'], ['Ch', 'C'],
  ['jh', 'J'], ['Jh', 'J'],
  ['Th', 'W'], ['Dh', 'Q'],
  ['th', 'T'], ['dh', 'D'],
  ['ph', 'P'], ['bh', 'B'],
  ['sh', 'S'], ['Sh', 'z'],
  // Long vowels (doubled)
  ['aa', 'A'], ['ii', 'I'], ['uu', 'U'],
  ['ri', 'f'],  // ṛ approximation
  ['ai', 'E'], ['au', 'O'],
  // HK-style uppercase for retroflex
  ['T', 'w'], ['D', 'q'], ['N', 'R'],
  ['S', 'S'], ['z', 'z'],
  ['M', 'M'], ['H', 'H'],
  // Plain
  ['a','a'],['A','A'],['i','i'],['I','I'],['u','u'],['U','U'],
  ['e','e'],['o','o'],
  ['k','k'],['g','g'],['c','c'],['j','j'],
  ['t','t'],['d','d'],['n','n'],
  ['p','p'],['b','b'],['m','m'],
  ['y','y'],['r','r'],['l','l'],['v','v'],['w','v'],
  ['s','s'],['h','h'],
];

/**
 * Converts ASCII (Harvard-Kyoto approximation) to SLP1.
 * This mapping is inherently lossy for ambiguous letters.
 * @param {string} text
 * @returns {string}
 */
export function asciiToSLP1(text) {
  let result = '';
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const [ascii, slp1] of ASCII_TO_SLP1_MAP) {
      if (text.startsWith(ascii, i)) {
        result += slp1;
        i += ascii.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += text[i++];
    }
  }
  return result;
}

// ─── SLP1 → IAST (for display) ───────────────────────────────────────────────

const SLP1_TO_IAST = {
  'a':'a','A':'ā','i':'i','I':'ī','u':'u','U':'ū',
  'f':'ṛ','F':'ṝ','x':'ḷ','X':'ḹ',
  'e':'e','E':'ai','o':'o','O':'au',
  'M':'ṃ','H':'ḥ',
  'k':'k','K':'kh','g':'g','G':'gh','N':'ṅ',
  'c':'c','C':'ch','j':'j','J':'jh','Y':'ñ',
  'w':'ṭ','W':'ṭh','q':'ḍ','Q':'ḍh','R':'ṇ',
  't':'t','T':'th','d':'d','D':'dh','n':'n',
  'p':'p','P':'ph','b':'b','B':'bh','m':'m',
  'y':'y','r':'r','l':'l','v':'v',
  'S':'ś','z':'ṣ','s':'s','h':'h','L':'ḻ',
};

/**
 * Converts SLP1 to IAST for human-readable display.
 * @param {string} slp1
 * @returns {string}
 */
export function slp1ToIAST(slp1) {
  return [...slp1].map(c => SLP1_TO_IAST[c] ?? c).join('');
}

// ─── SLP1 → Devanagari ───────────────────────────────────────────────────────

const SLP1_TO_DEV_VOWELS = {
  'a':'अ','A':'आ','i':'इ','I':'ई','u':'उ','U':'ऊ',
  'f':'ऋ','F':'ॠ','x':'ऌ',
  'e':'ए','E':'ऐ','o':'ओ','O':'औ',
};
const SLP1_TO_DEV_MATRAS = {
  'A':'ा','i':'ि','I':'ी','u':'ु','U':'ू',
  'f':'ृ','F':'ॄ','x':'ॢ',
  'e':'े','E':'ै','o':'ो','O':'ौ',
};
const SLP1_TO_DEV_CONSONANTS = {
  'k':'क','K':'ख','g':'ग','G':'घ','N':'ङ',
  'c':'च','C':'छ','j':'ज','J':'झ','Y':'ञ',
  'w':'ट','W':'ठ','q':'ड','Q':'ढ','R':'ण',
  't':'त','T':'थ','d':'द','D':'ध','n':'न',
  'p':'प','P':'फ','b':'ब','B':'भ','m':'म',
  'y':'य','r':'र','l':'ल','v':'व',
  'S':'श','z':'ष','s':'स','h':'ह','L':'ळ',
};
const SLP1_CONSONANT_SET = new Set(Object.keys(SLP1_TO_DEV_CONSONANTS));

/**
 * Converts SLP1 to Devanagari.
 * Handles consonant clusters with virama insertion.
 * @param {string} slp1
 * @returns {string}
 */
export function slp1ToDevanagari(slp1) {
  let result = '';
  const chars = [...slp1];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (ch in SLP1_TO_DEV_VOWELS && !SLP1_CONSONANT_SET.has(ch)) {
      // Stand-alone vowel
      result += SLP1_TO_DEV_VOWELS[ch];
      i++;
    } else if (SLP1_CONSONANT_SET.has(ch)) {
      result += SLP1_TO_DEV_CONSONANTS[ch];
      i++;
      // Check next char
      const next = chars[i] ?? '';
      if (next in SLP1_TO_DEV_MATRAS) {
        result += SLP1_TO_DEV_MATRAS[next];
        i++;
      } else if (next === 'a') {
        // inherent 'a' — no mātrā needed
        i++;
      } else if (next === 'M') {
        result += 'ं'; i++;
      } else if (next === 'H') {
        result += 'ः'; i++;
      } else if (SLP1_CONSONANT_SET.has(next) || next === '') {
        // Consonant cluster or end of word — add virama
        result += '्';
      }
      // else: leave as-is (unknown char)
    } else if (ch === 'M') {
      result += 'ं'; i++;
    } else if (ch === 'H') {
      result += 'ः'; i++;
    } else {
      result += ch; i++;
    }
  }
  return result;
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Normalises any Sanskrit input to SLP1.
 * @param {string} word
 * @param {'devanagari'|'iast'|'ascii'} script
 * @returns {string}
 */
export function toSLP1(word, script) {
  switch (script) {
    case 'devanagari': return devanagariToSLP1(word);
    case 'iast':       return iastToSLP1(word);
    case 'ascii':      return asciiToSLP1(word);
    default:           return word;
  }
}
