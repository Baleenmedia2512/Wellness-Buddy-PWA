/**
 * HealthIssueCoachEditor.jsx
 * Search + suggestions for Recovery Health Issue.
 * Typing "back" shows Back Pain, Lower Back Pain, Chronic Back Pain, etc.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeartPulse, Save, Search, X } from 'lucide-react';
import {
  recordRecentMedicalCondition,
  searchMedicalConditions,
  VISIBLE_SUGGESTION_CAP,
} from '../domain/medicalConditionSearch.js';
import {
  ALL_MEDICAL_CONDITIONS,
  POPULAR_MEDICAL_CONDITIONS,
} from '../data/medicalConditions.js';
import { updateMemberHealthIssues } from '../services/testimonialApi.js';

function uniqueConditions(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const label = String(item || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

function HighlightMatch({ text, query }) {
  const q = String(query || '').trim();
  if (!q) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-green-200 text-green-900 rounded-sm px-0.5 font-semibold">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/**
 * @param {{
 *   userId: number,
 *   coachId: number,
 *   currentIssues?: string[],
 *   knownHealthIssues?: string[],
 *   persist?: boolean,
 *   onSaved?: (issues: string[]) => void,
 * }} props
 */
export default function HealthIssueCoachEditor({
  userId,
  coachId,
  currentIssues = [],
  knownHealthIssues = [],
  persist = true,
  onSaved,
}) {
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const catalog = useMemo(
    () => uniqueConditions([...ALL_MEDICAL_CONDITIONS, ...knownHealthIssues]),
    [knownHealthIssues],
  );

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (q) {
      return searchMedicalConditions(q, { conditions: catalog }).slice(0, VISIBLE_SUGGESTION_CAP);
    }
    const popular = catalog.filter((name) => POPULAR_MEDICAL_CONDITIONS.has(name));
    return uniqueConditions([...knownHealthIssues, ...popular]).slice(0, VISIBLE_SUGGESTION_CAP);
  }, [query, catalog, knownHealthIssues]);

  const displayedIssues = pending
    ? [pending]
    : (Array.isArray(currentIssues) ? currentIssues : []);
  const alreadyCurrent = Array.isArray(currentIssues)
    && currentIssues.length === 1
    && currentIssues[0] === pending;
  const canSave = Boolean(pending) && !alreadyCurrent && persist;

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  useEffect(() => {
    function onOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [closeDropdown]);

  const selectIssue = useCallback((issue) => {
    const trimmed = String(issue || '').trim();
    if (!trimmed) return;
    setPending(trimmed);
    setQuery('');
    setError(null);
    closeDropdown();
    recordRecentMedicalCondition(trimmed);
    if (!persist) {
      onSaved?.([trimmed]);
    }
  }, [closeDropdown, persist, onSaved]);

  const handleSave = useCallback(async () => {
    if (!pending || saving || !persist) return;
    setSaving(true);
    setError(null);
    try {
      const next = [pending];
      await updateMemberHealthIssues({
        coachId,
        userId,
        recoveredHealthIssues: next,
      });
      onSaved?.(next);
      setPending(null);
    } catch (err) {
      setError(err?.message || 'Could not save health issue');
    } finally {
      setSaving(false);
    }
  }, [pending, saving, persist, coachId, userId, onSaved]);

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (suggestions.length ? (prev + 1) % suggestions.length : -1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (suggestions.length ? (prev <= 0 ? suggestions.length - 1 : prev - 1) : -1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) {
        selectIssue(suggestions[highlight]);
      } else if (query.trim().length >= 2) {
        selectIssue(query.trim());
      }
      return;
    }
    if (event.key === 'Escape') {
      closeDropdown();
    }
  };

  return (
    <div ref={wrapRef} className="space-y-2 relative z-20">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search health issue..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(-1);
            setError(null);
          }}
          onFocus={() => {
            setOpen(true);
            setHighlight(-1);
          }}
          onKeyDown={handleKeyDown}
          className="w-full h-11 pl-10 pr-9 text-sm text-gray-800 placeholder-gray-500 bg-white border border-green-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          aria-label="Search health issue"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {query ? (
          <button
            type="button"
            onClick={() => { setQuery(''); setOpen(true); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        {open && (
          <ul
            role="listbox"
            aria-label="Health issue suggestions"
            className="absolute left-0 right-0 z-[80] mt-1 bg-white border border-green-200 rounded-2xl shadow-xl overflow-y-auto"
            style={{ maxHeight: '240px' }}
          >
            {suggestions.length > 0 ? suggestions.map((issue, idx) => (
              <li key={issue} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={highlight === idx}
                  onMouseDown={(e) => { e.preventDefault(); selectIssue(issue); }}
                  onMouseEnter={() => setHighlight(idx)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    highlight === idx ? 'bg-green-50 text-green-900' : 'text-gray-800 hover:bg-green-50/70'
                  }`}
                >
                  <HeartPulse className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <HighlightMatch text={issue} query={query} />
                </button>
              </li>
            )) : (
              <li className="px-4 py-3 text-xs text-gray-400 italic">
                {query.trim() ? 'No matching health issues' : 'Start typing to search health issues'}
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
        <span>Current Health Issue:</span>
        {displayedIssues.length > 0 ? displayedIssues.map((issue) => (
          <span
            key={issue}
            className="inline-block bg-red-50 border border-red-200 text-red-800 rounded-full px-2.5 py-0.5 font-semibold"
          >
            {issue}
          </span>
        )) : (
          <span className="italic text-gray-400">Not added yet</span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      {pending && canSave && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save health issue'}
        </button>
      )}
    </div>
  );
}
