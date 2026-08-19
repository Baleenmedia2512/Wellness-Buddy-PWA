/**
 * HealthIssueCoachEditor.jsx
 * Search + suggestions for Health Issues (coach Transformation editor).
 * Typing "back" shows Back Pain, Lower Back Pain, Chronic Back Pain, etc.
 * Custom typed issues are remembered and shown in later suggestion searches.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, Search, X } from 'lucide-react';
import {
  getCustomMedicalConditions,
  recordRecentMedicalCondition,
  searchMedicalConditions,
  VISIBLE_SUGGESTION_CAP,
} from '../domain/medicalConditionSearch.js';
import {
  ALL_MEDICAL_CONDITIONS,
  POPULAR_MEDICAL_CONDITIONS,
} from '../data/medicalConditions.js';
import { updateMemberHealthIssues } from '../services/testimonialApi.js';
import { uniqueConditions, hasHealthIssue, issueKey, canAddCustomHealthIssue } from '../utils/uniqueConditions.js';
import { validateMedicalCondition } from '../domain/medicalConditionValidation.js';

/**
 * @param {{
 *   userId: number,
 *   coachId: number,
 *   currentIssues?: string[],
 *   approvedIssues?: string[],
 *   knownHealthIssues?: string[],
 *   persist?: boolean,
 *   allowRemove?: boolean,
 *   onSaved?: (issues: string[]) => void,
 *   onRemove?: (issue: string) => void,
 * }} props
 */
export default function HealthIssueCoachEditor({
  userId,
  coachId,
  currentIssues = [],
  approvedIssues,
  knownHealthIssues = [],
  persist = true,
  allowRemove = false,
  onSaved,
  onRemove,
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
    const learned = uniqueConditions([
      ...getCustomMedicalConditions(),
      ...knownHealthIssues,
    ]);
    if (q) {
      return searchMedicalConditions(q, {
        conditions: catalog,
        customConditions: learned,
      }).slice(0, VISIBLE_SUGGESTION_CAP);
    }
    const popular = catalog.filter((name) => POPULAR_MEDICAL_CONDITIONS.has(name));
    return uniqueConditions([...learned, ...popular]).slice(0, VISIBLE_SUGGESTION_CAP);
  }, [query, catalog, knownHealthIssues]);

  const savedIssues = Array.isArray(currentIssues) ? currentIssues : [];
  const baselineIssues = Array.isArray(approvedIssues) ? approvedIssues : savedIssues;
  const displayedIssues = pending
    ? uniqueConditions([...savedIssues, pending])
    : savedIssues;
  const alreadyCurrent = Boolean(pending)
    && savedIssues.some((issue) => issue.toLowerCase() === pending.toLowerCase());
  const canSave = Boolean(pending) && !alreadyCurrent && persist;

  const canAddCustom = canAddCustomHealthIssue(query, {
    suggestions,
    selected: savedIssues,
  });
  const listSize = suggestions.length + (canAddCustom ? 1 : 0);

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
    const check = validateMedicalCondition(issue);
    if (!check.valid) {
      setError(check.message);
      return;
    }
    const trimmed = check.value;
    setPending(trimmed);
    setQuery('');
    setError(null);
    closeDropdown();
    recordRecentMedicalCondition(trimmed);
    if (hasHealthIssue(savedIssues, trimmed)) {
      setPending(null);
      return;
    }
    const next = uniqueConditions([...savedIssues, trimmed]);
    if (!persist) {
      onSaved?.(next);
      setPending(null);
    }
  }, [closeDropdown, persist, onSaved, savedIssues]);

  const handleSave = useCallback(async () => {
    if (!pending || saving || !persist) return;
    setSaving(true);
    setError(null);
    try {
      const next = uniqueConditions([...savedIssues, pending]);
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
  }, [pending, saving, persist, coachId, userId, onSaved, savedIssues]);

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (listSize ? (prev + 1) % listSize : -1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (listSize ? (prev <= 0 ? listSize - 1 : prev - 1) : -1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlight >= 0 && highlight < suggestions.length && suggestions[highlight]) {
        selectIssue(suggestions[highlight]);
      } else if (canAddCustom && (highlight === suggestions.length || highlight < 0)) {
        selectIssue(query.trim());
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
            {suggestions.map((issue, idx) => (
              <li key={issue} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={highlight === idx}
                  onMouseDown={(e) => { e.preventDefault(); selectIssue(issue); }}
                  onMouseEnter={() => setHighlight(idx)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    highlight === idx ? 'bg-indigo-50 text-indigo-900' : 'text-gray-800 hover:bg-indigo-50/70'
                  }`}
                >
                  {issue}
                </button>
              </li>
            ))}
            {canAddCustom && (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={highlight === suggestions.length}
                  onMouseDown={(e) => { e.preventDefault(); selectIssue(query.trim()); }}
                  onMouseEnter={() => setHighlight(suggestions.length)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold transition-colors border-t border-gray-100 ${
                    highlight === suggestions.length
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  Add "{query.trim()}"
                </button>
              </li>
            )}
            {suggestions.length === 0 && !canAddCustom && (
              <li className="px-4 py-3 text-xs text-gray-400 italic">
                {query.trim() ? 'Type at least 2 characters to add a custom health issue' : 'Start typing to search health issues'}
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
        <span>Current Health Issues:</span>
        {displayedIssues.length > 0 ? displayedIssues.map((issue) => {
          const approved = hasHealthIssue(baselineIssues, issue);
          const isPendingAdd = Boolean(pending) && issueKey(issue) === issueKey(pending);
          const showCancel = !approved && (allowRemove || isPendingAdd);
          return (
            <span
              key={issue}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
                approved
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-green-50 border border-green-300 text-green-800'
              }`}
            >
              {issue}
              {showCancel && (
                <button
                  type="button"
                  onClick={() => {
                    if (isPendingAdd) {
                      setPending(null);
                      return;
                    }
                    onRemove?.(issue);
                  }}
                  className="p-0.5 rounded-full text-green-700 hover:bg-green-200"
                  aria-label={`Remove ${issue}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        }) : (
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
