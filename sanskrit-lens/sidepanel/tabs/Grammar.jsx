/**
 * sidepanel/tabs/Grammar.jsx
 *
 * Displays:
 *  - Guessed root(s) with clickable chips (triggers re-lookup)
 *  - Dhātu (root) information from astadhyayi.com
 *  - Governing Pāṇini sūtra with deep-link
 *  - Koshanveshanam results with deep-link
 *  - Manual search bar to override auto-detection
 */

import React, { useState } from 'react';

/**
 * @param {{ lookup: object|null, knowledgeLevel: string, onSearch: (word: string) => void }} props
 */
export default function Grammar({ lookup, knowledgeLevel, onSearch }) {
  const [manualWord, setManualWord] = useState('');

  if (!lookup) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🪬</div>
        <h2>Grammar Analysis</h2>
        <p>Select a Sanskrit word to see root detection and Pāṇinian analysis.</p>
        <ManualSearchBar value={manualWord} onChange={setManualWord} onSearch={onSearch} />
      </div>
    );
  }

  const { dhatu, sutra, koshanveshanam, possibleRoots, rootNote, slp1, iast } = lookup;

  const handleRootChip = (root) => {
    onSearch(root);
  };

  return (
    <div>
      {/* Manual override search bar */}
      <ManualSearchBar value={manualWord} onChange={setManualWord} onSearch={onSearch} />

      <hr className="divider" />

      {/* Root detection */}
      {possibleRoots?.length > 0 && (
        <>
          <div className="section-title">Detected Possible Roots</div>
          <div className="root-list">
            {possibleRoots.map((r) => (
              <button
                key={r}
                className="root-chip"
                title="Click to look up this root"
                onClick={() => handleRootChip(r)}
              >
                √{r}
              </button>
            ))}
          </div>
          {rootNote && <div className="note-box">{rootNote}</div>}
        </>
      )}

      {/* SLP1 internal form */}
      {slp1 && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>
          Internal (SLP1): <code style={{ fontFamily: 'monospace', background: 'var(--bg-hover)', padding: '1px 4px', borderRadius: 3 }}>{slp1}</code>
        </div>
      )}

      {/* Dhātu section */}
      <div className="section-title">Dhātu / Root Information</div>
      {dhatu === null && (
        <div className="loading-row">
          <div className="spinner" />
          <span>Looking up dhātu on astadhyayi.com…</span>
        </div>
      )}
      {dhatu?.error && (dhatu.roots?.length ?? 0) === 0 && (
        <div className="error-box">
          {dhatu.error}
          {dhatu.fetchUrl && (
            <> — <a href={dhatu.fetchUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>open directly ↗</a></>
          )}
        </div>
      )}
      {(dhatu?.roots ?? []).map((r, i) => (
        <DhatuCard key={i} root={r} level={knowledgeLevel} />
      ))}
      {dhatu !== null && (dhatu.roots ?? []).length === 0 && !dhatu?.error && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          No dhātu data found. Try clicking a root chip above or using the manual search.
        </div>
      )}

      {/* Koshanveshanam section */}
      <div className="section-title">Koshanveshanam (Dictionary)</div>
      {koshanveshanam === null && (
        <div className="loading-row">
          <div className="spinner" />
          <span>Searching koshanveshanam…</span>
        </div>
      )}
      {koshanveshanam?.error && (koshanveshanam.results?.length ?? 0) === 0 && (
        <div className="error-box">{koshanveshanam.error}</div>
      )}
      {(koshanveshanam?.results ?? []).slice(0, 6).map((r, i) => (
        <KoshanCard key={i} result={r} />
      ))}
      {koshanveshanam?.url && (
        <a href={koshanveshanam.url} target="_blank" rel="noreferrer" className="external-link-btn">
          Open Koshanveshanam ↗
        </a>
      )}

      {/* Sutra section */}
      <div className="section-title" style={{ marginTop: 18 }}>Governing Pāṇini Sūtra</div>
      {sutra === null && (
        <div className="loading-row">
          <div className="spinner" />
          <span>Searching for relevant sūtra…</span>
        </div>
      )}
      {sutra?.error && (sutra.sutras?.length ?? 0) === 0 && (
        <div className="error-box">{sutra.error}</div>
      )}
      {(sutra?.sutras ?? []).slice(0, 3).map((s, i) => (
        <SutraCard key={i} sutra={s} level={knowledgeLevel} />
      ))}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ManualSearchBar({ value, onChange, onSearch }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
      onChange('');
    }
  };
  return (
    <form className="search-bar" onSubmit={handleSubmit} style={{ marginBottom: 4, marginTop: 4 }}>
      <input
        className="search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search dictionary form (e.g. dharma, √bhū)"
      />
      <button type="submit" className="search-btn">Look up</button>
    </form>
  );
}

function DhatuCard({ root, level }) {
  const showDerivation = level !== 'beginner' && root.derivation;
  return (
    <div className="grammar-card" style={{ marginBottom: 10 }}>
      <div className="root-display">√{root.root}</div>
      {root.gana && <div className="root-gana">Gaṇa {root.gana} (conjugation class)</div>}
      <div className="root-meaning">{root.meaning}</div>
      {showDerivation && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: 8 }}>
          <strong>Derivation:</strong> {root.derivation}
        </div>
      )}
      {root.url && (
        <a href={root.url} target="_blank" rel="noreferrer" className="def-link">
          View on astadhyayi.com ↗
        </a>
      )}
    </div>
  );
}

function KoshanCard({ result }) {
  return (
    <div className="grammar-card" style={{ marginBottom: 8 }}>
      {result.word && (
        <div style={{ fontFamily: 'var(--font-sk)', fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
          {result.word}
        </div>
      )}
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{result.meaning}</div>
      {result.sutraRef && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          Sūtra:{' '}
          {result.sutraUrl ? (
            <a href={result.sutraUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)' }}>
              {result.sutraRef}
            </a>
          ) : (
            result.sutraRef
          )}
        </div>
      )}
    </div>
  );
}

function SutraCard({ sutra, level }) {
  const showCommentary = level === 'advanced' && sutra.commentary;
  return (
    <div className="grammar-card" style={{ marginBottom: 10 }}>
      {sutra.number && <div className="sutra-number">{sutra.number}</div>}
      {sutra.text && <div className="sutra-text">{sutra.text}</div>}
      {sutra.meaning && <div className="sutra-meaning">{sutra.meaning}</div>}
      {showCommentary && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: 8, lineHeight: 1.6 }}>
          {sutra.commentary}
        </div>
      )}
      {sutra.url && (
        <a href={sutra.url} target="_blank" rel="noreferrer" className="def-link">
          View sūtra ↗
        </a>
      )}
    </div>
  );
}
