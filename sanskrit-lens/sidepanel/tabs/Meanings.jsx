/**
 * sidepanel/tabs/Meanings.jsx
 *
 * Displays wisdomlib definitions filtered by knowledge level.
 * Rendered progressively — shows a spinner while fetching,
 * then populates cards as data arrives via storage.
 */

import React from 'react';

// Level ordering for filter logic
const LEVELS = ['beginner', 'intermediate', 'advanced'];

/**
 * @param {{ lookup: object|null, knowledgeLevel: string, onSave: () => void, saved: boolean }} props
 */
export default function Meanings({ lookup, knowledgeLevel, onSave, saved }) {
  if (!lookup) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📖</div>
        <h2>Select a Sanskrit word</h2>
        <p>Highlight any Sanskrit text on the page — definitions will appear here.</p>
      </div>
    );
  }

  const wisdomlib = lookup.wisdomlib;

  // Filter definitions by knowledge level
  const levelIndex = LEVELS.indexOf(knowledgeLevel);
  const visibleLevels = new Set(LEVELS.slice(0, levelIndex + 1));

  const definitions = wisdomlib?.definitions ?? [];
  const filtered = definitions.filter(
    (d) => visibleLevels.has(d.level) || !d.level
  );
  // Show all if nothing matches the level filter
  const toShow = filtered.length > 0 ? filtered : definitions;

  return (
    <div>
      {/* Word header (source URL) */}
      {lookup.sourceUrl && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10, wordBreak: 'break-all' }}>
          Found on:{' '}
          <a
            href={lookup.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-faint)' }}
          >
            {truncateUrl(lookup.sourceUrl)}
          </a>
        </div>
      )}

      {/* Loading state */}
      {wisdomlib === null && (
        <div className="loading-row">
          <div className="spinner" />
          <span>Fetching definitions from wisdomlib.org…</span>
        </div>
      )}

      {/* Error state */}
      {wisdomlib?.error && toShow.length === 0 && (
        <div className="error-box">
          Could not load definitions: {wisdomlib.error}
          {wisdomlib.fetchUrl && (
            <> — <a href={wisdomlib.fetchUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
              try opening directly ↗
            </a></>
          )}
        </div>
      )}

      {/* Definition cards */}
      {toShow.length > 0 && (
        <>
          <div className="section-title">
            Definitions
            {definitions.length > toShow.length && (
              <span style={{ fontWeight: 400, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                (showing {toShow.length} of {definitions.length} — raise level for more)
              </span>
            )}
          </div>

          {toShow.map((def, i) => (
            <DefCard key={i} def={def} />
          ))}
        </>
      )}

      {/* No results */}
      {wisdomlib !== null && toShow.length === 0 && !wisdomlib?.error && (
        <div className="empty-state" style={{ height: 'auto', paddingTop: 20 }}>
          <div className="empty-state-icon">🔍</div>
          <p>No definitions found for <em>{lookup.iast}</em>.</p>
          <p style={{ marginTop: 6 }}>
            Try the Grammar tab for root detection, or adjust the knowledge level.
          </p>
        </div>
      )}

      {/* Save to notebook button */}
      {wisdomlib !== null && toShow.length > 0 && (
        <>
          <hr className="divider" />
          <button
            className={`save-btn${saved ? ' saved' : ''}`}
            onClick={!saved ? onSave : undefined}
            disabled={saved}
          >
            {saved ? '✓ Saved to Notebook' : '+ Save to Notebook'}
          </button>
        </>
      )}

      {/* Deep link to wisdomlib */}
      {wisdomlib?.fetchUrl && (
        <div style={{ marginTop: 10 }}>
          <a
            href={wisdomlib.fetchUrl}
            target="_blank"
            rel="noreferrer"
            className="external-link-btn"
          >
            Open on wisdomlib.org ↗
          </a>
        </div>
      )}
    </div>
  );
}

function DefCard({ def }) {
  return (
    <div className="def-card">
      <div className="def-card-header">
        {def.word && <span className="def-word">{def.word}</span>}
        {def.level && (
          <span className={`level-badge ${def.level}`}>
            {def.level}
          </span>
        )}
        {def.category && (
          <span className="cat-badge">{def.category}</span>
        )}
      </div>
      <div className="def-meaning">{def.meaning}</div>
      {def.url && (
        <a href={def.url} target="_blank" rel="noreferrer" className="def-link">
          Source ↗
        </a>
      )}
    </div>
  );
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 1 ? u.pathname.slice(0, 30) + '…' : '');
  } catch {
    return url.slice(0, 40);
  }
}
