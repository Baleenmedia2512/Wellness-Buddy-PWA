/**
 * Profile Team Code card — show existing Sponsor/Co-Sponsor code, or let
 * activated members who skipped onboarding claim a Team Code later.
 */
import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { getApiBaseUrl } from '../../../../config/api.config.js';
import { apiFetch } from '../../../../shared/services/apiFetch.js';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';

const SEAT_LABEL = {
  sponsor: 'Sponsor',
  'co-sponsor': 'Co-Sponsor',
};

function formatTeamId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 100);
}

function isValidTeamId(id) {
  return /^[A-Z0-9]{4,100}$/.test(id);
}

export default function ProfileTeamCodeSection({
  email,
  userId,
  teamId: initialTeamId = null,
  teamSeat: initialSeat = null,
  canClaimTeamCode = false,
  onClaimed,
}) {
  const [teamId, setTeamId] = useState('');
  const [status, setStatus] = useState(null);
  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const displayTeamId = initialTeamId || null;
  const displaySeat = initialSeat || null;
  const showClaimForm = canClaimTeamCode && !displayTeamId;

  useEffect(() => {
    if (!showClaimForm || !isValidTeamId(teamId) || (!email && !userId)) {
      setStatus(null);
      setInfo(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setChecking(true);
      setError('');
      try {
        const apiBase = getApiBaseUrl();
        const params = new URLSearchParams({ teamId });
        if (email) params.set('email', email);
        if (userId) params.set('userId', String(userId));
        const res = await apiFetch(
          `${apiBase}/api/team/check-availability?${params.toString()}`,
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || 'Failed to check Team Code');
          setStatus(null);
          return;
        }
        setStatus(data.status);
        setInfo(data);
      } catch (err) {
        setError(err.message || 'Failed to check Team Code');
        setStatus(null);
      } finally {
        setChecking(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [teamId, email, userId, showClaimForm]);

  const handleClaim = async () => {
    if (claiming) return;
    if (!isValidTeamId(teamId)) {
      setError('Team Code must be at least 4 letters or numbers');
      return;
    }
    if (status === 'taken') {
      setError('This Team Code is full. Enter another code.');
      return;
    }
    if (status !== 'new' && status !== 'available' && status !== 'taken-by-you') {
      setError('Wait for Team Code check to finish');
      return;
    }

    setClaiming(true);
    setError('');
    setSuccess('');
    try {
      const apiBase = getApiBaseUrl();
      const body = { teamId };
      if (email) body.email = email;
      else if (userId) body.userId = userId;
      const res = await apiFetch(`${apiBase}/api/team/claim-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to claim Team Code');
        return;
      }
      setSuccess(data.message || 'Team Code saved');
      if (typeof onClaimed === 'function') {
        onClaimed({
          teamId: data.teamId || teamId,
          teamSeat: data.seat || null,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to claim Team Code');
    } finally {
      setClaiming(false);
    }
  };

  const canSubmit =
    (status === 'new' || status === 'available' || status === 'taken-by-you') &&
    !claiming &&
    !checking;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Users className="w-4 h-4 text-green-600" />
        <h2 className="text-sm font-semibold text-gray-700">Sponsor Team Code</h2>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          This code controls Sponsor / Co-Sponsor seats and shared team visibility.
          It is separate from Display Community ID in Personal Details.
        </p>
        {displayTeamId ? (
          <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-3">
            <p className="text-xs text-green-700 font-medium">Your Team Code</p>
            <p className="text-lg font-mono font-bold tracking-widest text-green-900 mt-0.5">
              {displayTeamId}
            </p>
            {displaySeat && (
              <p className="text-xs text-green-700 mt-1">
                Role: {SEAT_LABEL[displaySeat] || displaySeat}
              </p>
            )}
          </div>
        ) : showClaimForm ? (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              You skipped Team Code during setup. Create a new code as Sponsor, or join an
              open seat as Co-Sponsor.
            </p>
            <input
              type="text"
              className={`w-full py-3.5 bg-gray-50 rounded-xl text-center text-xl font-mono tracking-widest border-2 focus:outline-none ${
                status === 'new'
                  ? 'border-blue-500 text-blue-700'
                  : status === 'available'
                    ? 'border-green-500 text-green-700'
                    : status === 'taken'
                      ? 'border-red-300 text-red-600'
                      : 'border-transparent text-gray-700'
              }`}
              value={teamId}
              onChange={(e) => {
                setTeamId(formatTeamId(e.target.value));
                setError('');
                setSuccess('');
              }}
              placeholder="W112072XXX"
              maxLength={100}
              autoCapitalize="characters"
            />
            <p className="text-center text-xs text-gray-400">{teamId.length} · Min 4 · Letters & numbers only</p>

            {checking && (
              <p className="text-xs text-gray-500 text-center">Checking availability…</p>
            )}
            {status === 'new' && (
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                New code — you will become the Sponsor.
              </p>
            )}
            {status === 'available' && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                Open seat — you will join as Co-Sponsor
                {info?.existingCoach?.name ? ` with ${info.existingCoach.name}` : ''}.
              </p>
            )}
            {status === 'taken' && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                Team is full (Sponsor and Co-Sponsor already assigned).
              </p>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="text-xs text-green-600">{success}</p>}

            <TouchFeedbackButton
              onClick={handleClaim}
              disabled={!canSubmit}
              ariaLabel="Claim Team Code"
              className="w-full py-3 bg-green-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {claiming ? 'Saving…' : 'Save Team Code'}
            </TouchFeedbackButton>
          </>
        ) : (
          <p className="text-xs text-gray-500">
            No Team Code on this account. Shared team membership still follows your guide when they have a team.
          </p>
        )}
      </div>
    </div>
  );
}
