import React, { useEffect, useState } from 'react';
import { Eye, RefreshCw, X } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import {
  listActivityReportHiddenUsers,
  unhideActivityReportUser,
} from '../services/activityReportHiddenUsers.api';

/**
 * Modal listing users hidden from the Activity Report for the current viewer.
 * Selecting a row unhides that member only.
 */
export default function ActivityReportHiddenUsersModal({
  isOpen,
  onClose,
  viewerUserId,
  onUnhidden,
}) {
  const [loading, setLoading] = useState(false);
  const [unhidingId, setUnhidingId] = useState(null);
  const [error, setError] = useState('');
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!isOpen || !viewerUserId) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');
    listActivityReportHiddenUsers(viewerUserId)
      .then((data) => {
        if (cancelled) return;
        setMembers(Array.isArray(data.members) ? data.members : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load hidden users');
        setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, viewerUserId]);

  if (!isOpen) return null;

  const handleUnhide = async (member) => {
    if (!member?.userId || unhidingId) return;
    setUnhidingId(member.userId);
    setError('');
    try {
      await unhideActivityReportUser(viewerUserId, member.userId);
      const remaining = members.filter((row) => row.userId !== member.userId);
      setMembers(remaining);
      // Parent restores only this member in the report; modal stays open.
      if (typeof onUnhidden === 'function') {
        void onUnhidden(member);
      }
    } catch (err) {
      setError(err?.message || 'Failed to unhide user');
    } finally {
      setUnhidingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Hidden Users"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close hidden users"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-t-2xl shadow-xl max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-green-700" />
            <h2 className="text-base font-bold text-gray-900">Hidden Users</h2>
          </div>
          <TouchFeedbackButton
            onClick={onClose}
            ariaLabel="Close"
            className="p-1.5 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-600" />
          </TouchFeedbackButton>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-6 h-6 text-green-600 animate-spin" />
            </div>
          )}

          {!loading && error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!loading && !error && members.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              No hidden users
            </p>
          )}

          {!loading && members.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {members.map((member) => (
                <li key={member.userId}>
                  <TouchFeedbackButton
                    onClick={() => handleUnhide(member)}
                    disabled={Boolean(unhidingId)}
                    ariaLabel={`Unhide ${member.memberName}`}
                    className="w-full text-left px-2 py-3 rounded-lg hover:bg-green-50 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {member.memberName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Community ID:{' '}
                          {member.communityId || '—'}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-green-700 flex-shrink-0">
                        {unhidingId === member.userId ? 'Restoring…' : 'Unhide'}
                      </span>
                    </div>
                  </TouchFeedbackButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
