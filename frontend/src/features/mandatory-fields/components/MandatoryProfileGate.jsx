/**
 * One completion list for every outstanding mandatory profile field.
 * The user API is the source of truth. Fill opens the existing profile editors.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import { addAppStateListener } from '../../../shared/services/nativeLifecycle';
import {
  canSkipField,
  failureLocksApp,
  graceStatusText,
  reminderText,
  partitionOutstanding,
  rowsAfterVisitDismiss,
  rowsToShow,
  screenIsLocked,
  shouldReloadOnResume,
  skipAction,
  visitDismissAction,
} from '../domain/mandatoryPrompt.rules';
import { fetchUserMandatoryFields, skipUserMandatoryField } from '../services/mandatoryFields.api';
import MandatoryFieldFill from './MandatoryFieldFill';
import MandatoryRequiredScreen from './MandatoryRequiredScreen';

export default function MandatoryProfileGate({
  enabled,
  user,
  apiBaseUrl,
  appVersion,
  onLockChange,
  onStatus,
}) {
  const [userId, setUserId] = useState(user?.id || user?.UserId || user?.userId || null);
  const email = user?.email || user?.Email || '';
  const [evaluation, setEvaluation] = useState(null);
  const [failure, setFailure] = useState(null);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [editingKey, setEditingKey] = useState(null);
  const [skippingKey, setSkippingKey] = useState(null);
  const [rowError, setRowError] = useState('');
  const editingRef = useRef(null);
  editingRef.current = editingKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = (await getUserId(user)) || user?.id || user?.UserId || user?.userId || null;
      if (!cancelled) setUserId(id);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const load = useCallback(async () => {
    if (!enabled || (!userId && !email)) return;
    if (editingRef.current) return;
    try {
      const next = await fetchUserMandatoryFields({ userId, email, apiBaseUrl });
      setFailure(null);
      setEvaluation(next);
      setRowError('');
    } catch (err) {
      setFailure({
        status: err?.status || null,
        code: err?.code || null,
        message: err?.message || 'Could not check required profile fields.',
      });
    }
  }, [enabled, userId, email, apiBaseUrl]);

  useEffect(() => {
    if (!enabled) {
      setEvaluation(null);
      setFailure(null);
      setEditingKey(null);
      return;
    }
    load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (!shouldReloadOnResume({ enabled: true, editing: editingRef.current })) return;
      setDismissed(new Set());
      load();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }
    let handle = null;
    let cancelled = false;
    Promise.resolve(addAppStateListener(({ isActive }) => {
      if (!isActive) return;
      onVisible();
    })).then((next) => {
      if (cancelled) next?.remove?.();
      else handle = next;
    }).catch(() => {
      /* Native listener is optional. The page visibility listener still reloads. */
    });
    return () => {
      cancelled = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
      try { handle?.remove?.(); } catch { /* listener already gone */ }
    };
  }, [enabled, load]);

  const lockedByFailure = failureLocksApp(failure);
  const locked = lockedByFailure || screenIsLocked(evaluation);
  useEffect(() => {
    if (!enabled) {
      onLockChange?.(false);
      onStatus?.('idle');
      return;
    }
    if (!evaluation && !failure) {
      onLockChange?.(false);
      onStatus?.('checking');
      return;
    }
    onLockChange?.(locked);
    onStatus?.(locked ? 'blocked' : 'clear');
  }, [enabled, evaluation, failure, locked, onLockChange, onStatus]);

  const rows = lockedByFailure
    ? []
    : rowsAfterVisitDismiss(rowsToShow(evaluation), dismissed);
  const groups = partitionOutstanding(rows);

  const skip = async (field) => {
    const action = skipAction(field);
    if (action.kind !== 'skip') return;
    setSkippingKey(field.fieldKey);
    setRowError('');
    try {
      const next = await skipUserMandatoryField({
        userId,
        email,
        fieldKey: field.fieldKey,
        apiBaseUrl,
      });
      setEvaluation(next);
      setDismissed((prev) => new Set([...prev, field.fieldKey]));
      setEditingKey(null);
    } catch (err) {
      setRowError(err?.message || 'This field could not be skipped.');
    } finally {
      setSkippingKey(null);
    }
  };

  const dismissVisit = () => {
    const keys = rows
      .filter((field) => visitDismissAction(field).kind === 'visit-dismiss')
      .map((field) => field.fieldKey);
    setDismissed((prev) => new Set([...prev, ...keys]));
    setEditingKey(null);
  };

  if (!enabled || (!lockedByFailure && !failure && rows.length === 0)) return null;

  if (lockedByFailure || groups.requiredNow.length > 0) {
    return (
      <MandatoryRequiredScreen
        fields={groups.requiredNow}
        user={{ ...user, id: userId, email }}
        appVersion={appVersion}
        failure={lockedByFailure ? failure : null}
        onRetry={load}
        onDone={() => {
          editingRef.current = null;
          setEditingKey(null);
          load();
        }}
      />
    );
  }

  const shell = locked
    ? 'fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center'
    : 'fixed inset-x-0 bottom-0 z-[60] p-3';

  return (
    <div className={shell} role="dialog" aria-modal={locked} aria-labelledby="mandatory-profile-title">
      <div className="mx-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
        <h2 id="mandatory-profile-title" className="text-lg font-bold text-gray-900">
          Profile details still open
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          You can fill these now or continue. Skip does not mark a field complete, and it does not add extra grace days.
        </p>

        {groups.grace.length > 0 && (
          <ul className="mt-4 space-y-3">
            {groups.grace.map((field) => (
              <li key={field.fieldKey} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{field.label}</p>
                    <p className="text-xs text-gray-600">{graceStatusText(field)}</p>
                    <p className="text-xs text-gray-500">{reminderText(field)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    Grace period
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => setEditingKey(editingKey === field.fieldKey ? null : field.fieldKey)}
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 disabled:opacity-60"
                    disabled={skippingKey === field.fieldKey || !canSkipField(field)}
                    onClick={() => skip(field)}
                  >
                    {skippingKey === field.fieldKey ? 'Skipping…' : 'Skip'}
                  </button>
                </div>
                {editingKey === field.fieldKey && (
                  <MandatoryFieldFill
                    field={field}
                    user={{ ...user, id: userId, email }}
                    appVersion={appVersion}
                    onDone={() => {
                      editingRef.current = null;
                      setEditingKey(null);
                      load();
                    }}
                    onCancel={() => setEditingKey(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {rowError && <p className="mt-3 text-sm text-red-600" role="alert">{rowError}</p>}
        {!locked && rows.length > 0 && (
          <button
            type="button"
            className="mt-4 w-full rounded-lg border border-gray-300 py-2 text-sm font-semibold text-gray-800"
            onClick={dismissVisit}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
