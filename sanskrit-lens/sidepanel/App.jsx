/**
 * sidepanel/App.jsx
 *
 * Root React component for the Sanskrit Lens side panel.
 *
 * State sources:
 *  - chrome.storage.session  → current lookup (updated by background.js)
 *  - chrome.storage.local    → notebook entries + knowledge level preference
 *
 * Progressive rendering: the lookup object in session storage is updated
 * incrementally as each fetch resolves, so the UI populates in real time.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import Meanings  from './tabs/Meanings.jsx';
import Grammar   from './tabs/Grammar.jsx';
import Notebook  from './tabs/Notebook.jsx';

// ── Constants ──────────────────────────────────────────────────────────────────

const SESSION_KEY  = 'currentLookup';
const NOTEBOOK_KEY = 'notebook';
const LEVEL_KEY    = 'knowledgeLevel';
const TABS         = ['Meanings', 'Grammar', 'Notebook'];

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [lookup,         setLookup]         = useState(null);
  const [activeTab,      setActiveTab]      = useState(0);
  const [knowledgeLevel, setKnowledgeLevel] = useState('beginner');
  const [notebook,       setNotebook]       = useState([]);
  // Track whether the current word is already saved to notebook
  const [savedId,        setSavedId]        = useState(null);

  // ── Bootstrap: read persisted preferences and last lookup ─────────────────

  useEffect(() => {
    chrome.storage.local.get([NOTEBOOK_KEY, LEVEL_KEY], (data) => {
      if (data[NOTEBOOK_KEY]) setNotebook(data[NOTEBOOK_KEY]);
      if (data[LEVEL_KEY])    setKnowledgeLevel(data[LEVEL_KEY]);
    });

    chrome.storage.session.get(SESSION_KEY, (data) => {
      if (data[SESSION_KEY]) setLookup(data[SESSION_KEY]);
    });
  }, []);

  // ── Listen for session storage changes (progressive updates from bg.js) ───

  useEffect(() => {
    const onChange = (changes, area) => {
      if (area === 'session' && changes[SESSION_KEY]) {
        const next = changes[SESSION_KEY].newValue;
        setLookup(next ?? null);
        // New word — reset saved state and switch to Meanings tab
        setSavedId(null);
        setActiveTab(prev => prev === 2 ? prev : 0); // stay on Notebook if user is there
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  // ── Knowledge level toggle ─────────────────────────────────────────────────

  const handleLevelChange = useCallback((level) => {
    setKnowledgeLevel(level);
    chrome.storage.local.set({ [LEVEL_KEY]: level });
  }, []);

  // ── Manual search (from Grammar tab or header search bar) ─────────────────

  const handleSearch = useCallback((word) => {
    if (!word.trim()) return;
    chrome.runtime.sendMessage({ type: 'MANUAL_SEARCH', word: word.trim() });
    setActiveTab(0); // jump to Meanings after manual search
  }, []);

  // ── Notebook: save current lookup ─────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!lookup) return;

    const meanings = (lookup.wisdomlib?.definitions ?? [])
      .slice(0, 5)
      .map(d => d.meaning)
      .filter(Boolean);

    const entry = {
      id:          Date.now(),
      word:        lookup.word,
      iast:        lookup.iast,
      devanagari:  lookup.devanagari,
      meanings,
      sourceUrl:   lookup.sourceUrl,
      timestamp:   lookup.timestamp ?? Date.now(),
    };

    setNotebook(prev => {
      const next = [...prev, entry];
      chrome.storage.local.set({ [NOTEBOOK_KEY]: next });
      return next;
    });
    setSavedId(entry.id);
  }, [lookup]);

  // ── Notebook: delete one entry ─────────────────────────────────────────────

  const handleDelete = useCallback((id) => {
    setNotebook(prev => {
      const next = prev.filter(e => e.id !== id);
      chrome.storage.local.set({ [NOTEBOOK_KEY]: next });
      return next;
    });
    if (id === savedId) setSavedId(null);
  }, [savedId]);

  // ── Notebook: clear all ───────────────────────────────────────────────────

  const handleClearAll = useCallback(() => {
    if (!window.confirm('Clear all saved words?')) return;
    setNotebook([]);
    setSavedId(null);
    chrome.storage.local.set({ [NOTEBOOK_KEY]: [] });
  }, []);

  // ── Header search bar state ────────────────────────────────────────────────

  const [searchVal, setSearchVal] = useState('');
  const handleHeaderSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      handleSearch(searchVal.trim());
      setSearchVal('');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isSaved = savedId !== null;

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="header">
        <div className="header-brand">Sanskrit Lens</div>

        {lookup && (
          <div className="word-display">
            {lookup.devanagari && (
              <span className="word-devanagari">{lookup.devanagari}</span>
            )}
            {lookup.iast && (
              <span className="word-iast">{lookup.iast}</span>
            )}
            {lookup.script && (
              <span className="word-script-badge">{lookup.script}</span>
            )}
          </div>
        )}

        {/* Header search bar */}
        <form className="search-bar" onSubmit={handleHeaderSearch}>
          <input
            className="search-input"
            type="text"
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder="Search any Sanskrit word…"
          />
          <button type="submit" className="search-btn">Go</button>
        </form>
      </div>

      {/* ── Knowledge level toggle ──────────────────────────────────────── */}
      <div className="level-toggle">
        {['beginner', 'intermediate', 'advanced'].map(lvl => (
          <button
            key={lvl}
            className={`level-btn${knowledgeLevel === lvl ? ' active' : ''}`}
            onClick={() => handleLevelChange(lvl)}
          >
            {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="tab-bar">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={`tab-btn${activeTab === i ? ' active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
            {tab === 'Notebook' && notebook.length > 0 && (
              <span style={{
                marginLeft: 5,
                fontSize: 10,
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 8,
                padding: '0 5px',
                verticalAlign: 'middle',
              }}>
                {notebook.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="tab-content">
        {activeTab === 0 && (
          <Meanings
            lookup={lookup}
            knowledgeLevel={knowledgeLevel}
            onSave={handleSave}
            saved={isSaved}
          />
        )}
        {activeTab === 1 && (
          <Grammar
            lookup={lookup}
            knowledgeLevel={knowledgeLevel}
            onSearch={handleSearch}
          />
        )}
        {activeTab === 2 && (
          <Notebook
            entries={notebook}
            onDelete={handleDelete}
            onClearAll={handleClearAll}
          />
        )}
      </div>
    </div>
  );
}

// ── Mount ──────────────────────────────────────────────────────────────────────

const root = createRoot(document.getElementById('root'));
root.render(<App />);
