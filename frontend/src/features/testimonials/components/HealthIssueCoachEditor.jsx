/**
 * HealthIssueCoachEditor.jsx
 * Transformation Health Issues editor — uses the same filter-style search as BCM
 * (chips inside the search field via DiseaseMultiSelect).
 *
 * - persist=false (member draft / edit mode): every change calls onSaved immediately
 * - persist=true  (coach live update): changes are local until Save
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import DiseaseMultiSelect from './DiseaseMultiSelect.jsx';
import { updateMemberHealthIssues } from '../services/testimonialApi.js';
import { uniqueConditions, issueKey } from '../utils/uniqueConditions.js';
import { recordRecentMedicalCondition } from '../domain/medicalConditionSearch.js';

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
  const savedIssues = useMemo(
    () => (Array.isArray(currentIssues) ? currentIssues.filter(Boolean) : []),
    [currentIssues],
  );
  const baselineIssues = useMemo(
    () => (Array.isArray(approvedIssues) ? approvedIssues : savedIssues),
    [approvedIssues, savedIssues],
  );

  const [draft, setDraft] = useState(savedIssues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraft(savedIssues);
  }, [savedIssues]);

  const displayValue = persist ? draft : savedIssues;
  const dirty = persist && (
    draft.length !== savedIssues.length
    || draft.some((issue, i) => issueKey(issue) !== issueKey(savedIssues[i] || ''))
    || savedIssues.some((issue, i) => issueKey(issue) !== issueKey(draft[i] || ''))
  );

  function rememberNew(next) {
    const prevKeys = new Set(displayValue.map(issueKey));
    for (const issue of next) {
      if (!prevKeys.has(issueKey(issue))) {
        recordRecentMedicalCondition(issue);
      }
    }
  }

  function handleChange(nextRaw) {
    const next = uniqueConditions(Array.isArray(nextRaw) ? nextRaw : []);
    setError(null);
    rememberNew(next);

    if (!persist) {
      onSaved?.(next);
      return;
    }

    setDraft(next);
  }

  async function handleSave() {
    if (!persist || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateMemberHealthIssues({
        coachId,
        userId,
        recoveredHealthIssues: draft,
      });
      onSaved?.(draft);
    } catch (err) {
      setError(err?.message || 'Could not save health issues');
    } finally {
      setSaving(false);
    }
  }

  // Silence unused — kept for caller API compatibility
  void baselineIssues;
  void knownHealthIssues;
  void allowRemove;
  void onRemove;

  return (
    <div className="space-y-2 relative z-20">
      <DiseaseMultiSelect
        value={displayValue}
        onChange={handleChange}
        disabled={saving}
      />

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      {persist && dirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save health issues'}
        </button>
      )}
    </div>
  );
}
