/**
 * sidepanel/tabs/Notebook.jsx
 *
 * Persistent saved-word history.
 * Each entry: { id, word, iast, devanagari, meanings, sourceUrl, timestamp }
 * Stored in chrome.storage.local under key 'notebook'.
 */

import React from 'react';

/**
 * @param {{ entries: NotebookEntry[], onDelete: (id: number) => void, onClearAll: () => void }} props
 * @typedef {{ id: number, word: string, iast: string, devanagari: string, meanings: string[], sourceUrl: string, timestamp: number }} NotebookEntry
 */
export default function Notebook({ entries, onDelete, onClearAll }) {
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📓</div>
        <h2>Your Notebook</h2>
        <p>Save words from the Meanings tab — they'll appear here with definitions and the source page.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="notebook-toolbar">
        <span className="notebook-count">{entries.length} saved word{entries.length !== 1 ? 's' : ''}</span>
        <button className="clear-all-btn" onClick={onClearAll}>Clear all</button>
      </div>

      {entries.slice().reverse().map((entry) => (
        <NotebookEntry key={entry.id} entry={entry} onDelete={onDelete} />
      ))}
    </div>
  );
}

function NotebookEntry({ entry, onDelete }) {
  const date = new Date(entry.timestamp);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="notebook-entry">
      <div className="nb-header">
        <div>
          {entry.devanagari && <div className="nb-word">{entry.devanagari}</div>}
          {entry.iast && <div className="nb-iast">{entry.iast}</div>}
        </div>
        <button
          className="nb-delete-btn"
          title="Remove entry"
          onClick={() => onDelete(entry.id)}
        >
          ×
        </button>
      </div>

      {entry.meanings?.length > 0 && (
        <div className="nb-meanings">
          {entry.meanings.slice(0, 3).map((m, i) => (
            <div key={i} style={{ marginBottom: i < entry.meanings.length - 1 ? 4 : 0 }}>
              {entry.meanings.length > 1 && (
                <span style={{ color: 'var(--text-faint)', marginRight: 4 }}>{i + 1}.</span>
              )}
              {m}
            </div>
          ))}
          {entry.meanings.length > 3 && (
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
              +{entry.meanings.length - 3} more
            </div>
          )}
        </div>
      )}

      <div className="nb-meta">
        <span>{dateStr} at {timeStr}</span>
        {entry.sourceUrl && (
          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="nb-source-link"
            title={entry.sourceUrl}
          >
            {truncateUrl(entry.sourceUrl)}
          </a>
        )}
      </div>
    </div>
  );
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return url.slice(0, 30);
  }
}
