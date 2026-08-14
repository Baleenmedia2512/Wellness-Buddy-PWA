/**
 * HealthIssueCoachEditor.jsx
 * Coach-only search + save for a member's recovered health issue.
 * Suggestions come from the shared medical-condition catalog plus issues
 * already stored on user transformation records.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeartPulse, Save, Search, X } from 'lucide-react';
import { useDebounce } from '../../../shared/hooks/useDebounce.js';
import {
  recordRecentMedicalCondition,
  searchMedicalConditions,
  VISIBLE_SUGGESTION_CAP,
} from '../domain/medicalConditionSearch.js';
import { ALL_MEDICAL_CONDITIONS } from '../data/medicalConditions.js';
import { updateMemberHealthIssues } from '../services/testimonialApi.js';

const SEARCH_DEBOUNCE_MS = 200;

function uniqueConditions(extra = []) {
  const seen = new Set();
  const result = [];
  for (const item of [...ALL_MEDICAL_CONDITIONS, ...extra]) {
    const label = String(item || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

/**
 * @param {{
 *   userId: number,
 *   coachId: number,
 *   currentIssues?: string[],
 *   knownHealthIssues?: string[],
 *   onSaved?: (issues: string[]) => void,
 * }} props
 */
export default function HealthIssueCoachEditor({
  userId,
  coachId,
  currentIssues = [],
  knownHealthIssues = [],
  onSaved,
}) {
  const inputRef = useRef(null);
  const dropRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const catalog = useMemo(() => uniqueConditions(knownHealthIssues), [knownHealthIssues]);

  const suggestions = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return searchMedicalConditions(debouncedQuery, { conditions: catalog }).slice(0, VISIBLE_SUGGESTION_CAP);
  }, [debouncedQuery, catalog]);

  const displayedIssues = pending ? [pending] : (Array.isArray(currentIssues) ? currentIssues : []);
  const alreadyCurrent = Array.isArray(currentIssues)
    && currentIssues.length === 1
    && currentIssues[0] === pending;
  const canSave = Boolean(pending) && !alreadyCurrent;

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  useEffect(() => {
    function onOutside(event) {
      if (
        dropRef.current && !dropRef.current.contains(event.target)
        && inputRef.current && !inputRef.current.contains(event.target)
      ) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [closeDropdown]);

  const selectIssue = useCallback((issue) => {
    const trimmed = String(issue || '').trim();
    if (!trimmed) return;
    setPending(trimmed);
    setQuery('');
    setError(null);
    closeDropdown();
    recordRecentMedicalCondition(trimmed);
  }, [closeDropdown]);

  const handleSave = useCallback(async () => {
    if (!pending || saving) return;
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
  }, [pending, saving, coachId, userId, onSaved]);

  const handleKeyDown = (event) => {
    if (!open && event.key === 'ArrowDown' && query.trim()) {
      setOpen(true);
      setHighlight(0);
      event.preventDefault();
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((prev) => (suggestions.length ? (prev + 1) % suggestions.length : -1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((prev) => (suggestions.length ? (prev <= 0 ? suggestions.length - 1 : prev - 1) : -1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) {
        selectIssue(suggestions[highlight]);
      }
      return;
    }
    if (event.key === 'Escape') {
      closeDropdown();
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search health issue..."
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(-1);
            setError(null);
          }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
          aria-label="Search health issue"
        />
        {query ? (
          <button
            type="button"
            onClick={() => { setQuery(''); closeDropdown(); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {open && query.trim() && (
          <div
            ref={dropRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden"
            style={{ maxHeight: '220px', overflowY: 'auto' }}
          >
            {suggestions.length > 0 ? suggestions.map((issue, idx) => (
              <button
                key={issue}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectIssue(issue); }}
                onMouseEnter={() => setHighlight(idx)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-medium transition-colors ${
                  highlight === idx ? 'bg-green-50 text-green-800' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <HeartPulse className="h-3 w-3 text-rose-400 shrink-0" />
                {issue}
              </button>
            )) : (
              <p className="px-4 py-3 text-xs text-gray-400 italic">No matching health issues</p>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-600">
        Current Health Issue:{' '}
        {displayedIssues.length > 0 ? (
          <span className="font-bold text-gray-900">{displayedIssues.join(', ')}</span>
        ) : (
          <span className="italic text-gray-400">Not added yet</span>
        )}
      </p>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      {pending && canSave && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSave}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save health issue'}
        </button>
      )}
    </div>
  );
}
