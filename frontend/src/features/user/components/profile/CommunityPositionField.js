/**
 * Profile Community Position — catalog role below Community ID.
 * Choosing a role does not email anyone. Send verification code emails the
 * coach. The role is saved after the member enters the code the coach shares.
 */
import React, { useEffect, useRef, useState } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { EMAIL_OTP_LENGTH } from '../../domain/otpLength';
import { communityPositionDraftAfterSync, positionUsageLine, readHeldCommunityPosition, rememberConfirmedCommunityPosition } from '../../domain/communityPosition';
import useOtpInput from '../../hooks/useOtpInput';
import OtpInputCells from '../../../../shared/components/OtpInputCells.jsx';
import {
  listCommunityPositions,
  requestCommunityPosition,
  verifyCommunityPositionOtp,
} from '../../services/communityPosition.api';

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-gray-900 disabled:bg-gray-50';

export default function CommunityPositionField({
  userId = null,
  email = '',
  confirmedCode = '',
  pendingRequest = null,
  otpEnabled = false,
  disabled = false,
  onChange,
  onSettled,
}) {
  const otpCtl = useOtpInput(EMAIL_OTP_LENGTH);
  const settledCodeRef = useRef('');
  const choosingRef = useRef(false);
  const [positions, setPositions] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState(
    pendingRequest?.positionCode || confirmedCode || readHeldCommunityPosition(userId) || '',
  );
  const [pending, setPending] = useState(pendingRequest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // After OTP verify, ignore stale parent pendingRequest until confirmedCode catches up.
  const optimisticCodeRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    listCommunityPositions()
      .then((rows) => {
        if (!cancelled) setPositions(rows);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || 'Could not load community positions.');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (choosingRef.current) return;
    const next = communityPositionDraftAfterSync({
      settledCode: settledCodeRef.current || readHeldCommunityPosition(userId),
      confirmedCode,
      pendingRequest,
    });
    if (next.clearSettled) settledCodeRef.current = '';
    setPending(next.pending);
    setDraft(next.draft);
  }, [pendingRequest, confirmedCode, pendingRequest?.id, pendingRequest?.positionCode, userId]);

  useEffect(() => {
    otpCtl.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when a new request arrives
  }, [pending?.id]);

  const applyConfirmed = (code, settlePayload = null) => {
    const saved = String(code || '').trim();
    if (!saved) return;
    optimisticCodeRef.current = saved;
    setPending(null);
    setDraft(saved);
    onChange?.(saved);
    onSettled?.(settlePayload || {
      positionCode: saved,
      eventLevel: saved,
      communityPositionRequest: null,
    });
  };

  const selected = positions.find((row) => row.code === draft) || null;
  const usage = positionUsageLine(selected);
  const pendingForDraft = Boolean(
    otpEnabled && pending && pending.status === 'pending' && pending.positionCode === draft,
  );
  const heldCode = readHeldCommunityPosition(userId);
  const needsSend = Boolean(
    otpEnabled && draft && draft !== (confirmedCode || '') && draft !== heldCode && !pendingForDraft,
  );
  const options = [...positions];
  [confirmedCode, pending?.positionCode, draft].forEach((code) => {
    if (code && !options.some((row) => row.code === code)) {
      options.push({ code, label: code, featureKey: '', usageNote: '' });
    }
  });

  const sendRequest = async (code, { force = false } = {}) => {
    if (!otpEnabled) {
      onChange?.(code);
      return;
    }
    if (!code || busy) return;
    if (!force && code === (confirmedCode || '') && !pending) return;
    if (!force && pending?.status === 'pending' && pending.positionCode === code) return;
    setBusy(true);
    setError('');
    try {
      const data = await requestCommunityPosition({
        userId: userId || undefined,
        email: email || undefined,
        positionCode: code,
      });
      if (data.alreadyHeld) {
        const saved = data.positionCode || code;
        rememberConfirmedCommunityPosition(userId, saved);
        choosingRef.current = false;
        settledCodeRef.current = saved;
        setPending(null);
        setDraft(saved);
        onChange?.(saved);
        onSettled?.();
        return;
      }
      optimisticCodeRef.current = '';
      setPending(data.communityPositionRequest || null);
      if (data.communityPositionRequest?.positionCode) {
        setDraft(data.communityPositionRequest.positionCode);
      }
    } catch (err) {
      setError(err?.message || 'Could not send the approval request.');
      setDraft(pending?.positionCode || confirmedCode || '');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (otp) => {
    if (!otp || busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await verifyCommunityPositionOtp({
        userId: userId || undefined,
        email: email || undefined,
        otp,
      });
      const saved = data.positionCode || draft;
        rememberConfirmedCommunityPosition(userId, saved);
      choosingRef.current = false;
      settledCodeRef.current = saved;
      setPending(null);
      setDraft(saved);
      onChange?.(saved);
      onSettled?.();
    } catch (err) {
      setError(err?.message || 'That approval code did not match.');
    } finally {
      setBusy(false);
    }
  };

  const approver = String(pending?.approverName || 'your coach').trim();
  const approverEmail = String(pending?.approverEmail || '').trim();

  return (
    <div>
      <label htmlFor="profile-community-position" className="block text-sm font-medium text-gray-700 mb-1">
        Community Position
      </label>
      <select
        id="profile-community-position"
        value={draft || ''}
        disabled={disabled || busy || (positions.length === 0 && !confirmedCode)}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) {
            setDraft(pending?.positionCode || confirmedCode || '');
            return;
          }
          setError('');
          choosingRef.current = Boolean(next && next !== (confirmedCode || readHeldCommunityPosition(userId)));
          if (settledCodeRef.current && next !== settledCodeRef.current) {
            settledCodeRef.current = '';
          }
          setDraft(next);
          if (!otpEnabled) onChange?.(next);
        }}
        className={selectClass}
        style={{ fontSize: '16px' }}
      >
        <option value="">Choose community position</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label || option.code}
          </option>
        ))}
      </select>
      {usage && (
        <p className="text-xs text-gray-500 mt-1">{usage}</p>
      )}
      {needsSend && confirmedCode && (
        <p className="text-xs text-gray-500 mt-1">
          Current position: {confirmedCode}. Send a verification code to request {draft}.
        </p>
      )}
      {otpEnabled && !draft && (
        <p className="text-xs text-gray-400 mt-1">
          Choose a role, then send a verification code to your coach.
        </p>
      )}
      {needsSend && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => sendRequest(draft)}
          className="mt-2 w-full py-2 rounded-lg text-sm font-semibold text-white bg-green-600 disabled:bg-gray-300 disabled:text-gray-500"
        >
          {busy ? 'Sending…' : 'Send verification code'}
        </button>
      )}
      {!otpEnabled && (
        <p className="text-xs text-gray-400 mt-1">
          Saved with your profile. Each role is used by the feature named on it.
        </p>
      )}
      {pendingForDraft && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            We sent an approval code to your coach <strong>{approver}</strong>
            {approverEmail ? ` (${approverEmail})` : ''}. Enter the code they give you.
          </p>
          <OtpInputCells
            otpCtl={otpCtl}
            length={EMAIL_OTP_LENGTH}
            emailOtp
            disabled={busy}
            onComplete={handleVerify}
            cellClassName="w-10 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg"
          />
          <button
            type="button"
            disabled={busy || !otpCtl.isComplete}
            onClick={() => handleVerify(otpCtl.value)}
            className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-green-600 disabled:bg-gray-300 disabled:text-gray-500"
          >
            {busy ? 'Checking…' : 'Confirm code'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => sendRequest(draft, { force: true })}
            className="w-full py-2 rounded-lg text-xs font-medium text-green-700 border border-green-200"
          >
            Resend code
          </button>
        </div>
      )}
      {(error || loadError) && (
        <p className="text-xs text-red-600 mt-2">{error || loadError}</p>
      )}
    </div>
  );
}
