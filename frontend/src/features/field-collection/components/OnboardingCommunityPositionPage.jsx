/**
 * Community Position — first field. Nothing else is asked until this is saved.
 * App 3.5.6+ with ff.community-position-otp: Continue sends a coach approval
 * code and opens an OTP popup. Older / flag-off: save on profile.
 */
import React, { useEffect, useState } from 'react';
import { isFlagEnabled } from '../../../config/featureFlags';
import { saveProfile } from '../../user/services/profileService';
import { EVENT_LEVEL_OPTIONS } from '../../user/domain/eventProfilePrefs';
import {
  COMMUNITY_POSITION_OTP_FLAG,
  rememberConfirmedCommunityPosition,
} from '../../user/domain/communityPosition';
import { EMAIL_OTP_LENGTH } from '../../user/domain/otpLength';
import useOtpInput from '../../user/hooks/useOtpInput';
import OtpInputCells from '../../../shared/components/OtpInputCells.jsx';
import {
  listCommunityPositions,
  requestCommunityPosition,
  verifyCommunityPositionOtp,
} from '../../user/services/communityPosition.api';

export default function OnboardingCommunityPositionPage({ user, onComplete }) {
  const otpEnabled = isFlagEnabled(COMMUNITY_POSITION_OTP_FLAG);
  const [position, setPosition] = useState('');
  const [options, setOptions] = useState(() => [...EVENT_LEVEL_OPTIONS]);
  const [pending, setPending] = useState(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [otpError, setOtpError] = useState('');
  const otpCtl = useOtpInput(EMAIL_OTP_LENGTH);
  const email = user?.email || user?.Email || '';
  const userId = user?.id || user?.UserId || user?.userId;

  useEffect(() => {
    if (!otpEnabled) return undefined;
    let cancelled = false;
    listCommunityPositions()
      .then((rows) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        setOptions(rows.map((row) => ({
          code: row.code,
          label: row.label || row.code,
        })));
      })
      .catch(() => {
        // Keep legacy EVENT_LEVEL_OPTIONS so the screen still works offline.
      });
    return () => { cancelled = true; };
  }, [otpEnabled]);

  useEffect(() => {
    otpCtl.reset();
    setOtpError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when a new approval arrives
  }, [pending?.id, pending?.positionCode]);

  const optionList = options.map((item) => (
    typeof item === 'string' ? { code: item, label: item } : item
  ));

  const saveLegacy = async () => {
    if (!EVENT_LEVEL_OPTIONS.includes(position)) {
      setError('Choose your community position to continue.');
      return;
    }
    if (!email && !userId) {
      setError('Unable to identify your account. Please re-login.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { eventLevel: position };
      if (userId) payload.userId = userId;
      else if (email) payload.email = email;
      await saveProfile(payload);
      await onComplete?.(position);
    } catch (err) {
      setError(err?.message || 'Could not save community position.');
    } finally {
      setSaving(false);
    }
  };

  const sendApproval = async ({ force = false } = {}) => {
    if (!position) {
      setError('Choose your community position to continue.');
      return;
    }
    if (!email && !userId) {
      setError('Unable to identify your account. Please re-login.');
      return;
    }
    setSaving(true);
    setError('');
    setOtpError('');
    try {
      const data = await requestCommunityPosition({
        userId: userId || undefined,
        email: email || undefined,
        positionCode: position,
      });
      if (data.alreadyHeld) {
        const saved = data.positionCode || position;
        rememberConfirmedCommunityPosition(userId, saved);
        setOtpOpen(false);
        setPending(null);
        await onComplete?.(saved);
        return;
      }
      setPending(data.communityPositionRequest || null);
      if (data.communityPositionRequest?.positionCode) {
        setPosition(data.communityPositionRequest.positionCode);
      }
      setOtpOpen(true);
      if (force) {
        setOtpError('');
      }
    } catch (err) {
      const message = err?.message || 'Could not send the approval request.';
      if (otpOpen) setOtpError(message);
      else setError(message);
    } finally {
      setSaving(false);
    }
  };

  const confirmCode = async (otp) => {
    if (!otp || saving) return;
    setSaving(true);
    setOtpError('');
    try {
      const data = await verifyCommunityPositionOtp({
        userId: userId || undefined,
        email: email || undefined,
        otp,
      });
      const saved = data.positionCode || position;
      rememberConfirmedCommunityPosition(userId, saved);
      setPending(null);
      setOtpOpen(false);
      await onComplete?.(saved);
    } catch (err) {
      setOtpError(err?.message || 'That approval code did not match.');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    if (otpEnabled) {
      sendApproval();
      return;
    }
    saveLegacy();
  };

  const awaitingCode = Boolean(otpEnabled && otpOpen && pending?.status === 'pending');
  const approver = String(pending?.approverName || 'your coach').trim();
  const approverEmail = String(pending?.approverEmail || '').trim();

  return (
    <div className="fixed inset-0 z-[10060] bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-5 pt-12 pb-6 text-white">
        <h1 className="text-xl font-bold">Community Position</h1>
        <p className="text-sm text-green-100 mt-1">Required before the rest of your profile.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          {optionList.map((option) => {
            const selected = position === option.code;
            return (
              <button
                key={option.code}
                type="button"
                disabled={saving}
                onClick={() => {
                  setPosition(option.code);
                  setError('');
                  setOtpError('');
                  setPending(null);
                  setOtpOpen(false);
                }}
                className={`w-full text-left rounded-xl border px-3 py-3 text-sm font-semibold disabled:opacity-60 ${
                  selected
                    ? 'border-green-500 bg-green-50 text-green-800'
                    : 'border-gray-200 bg-white text-gray-800'
                }`}
              >
                {option.label}
              </button>
            );
          })}
          {error ? <p className="text-sm text-red-600 pt-2">{error}</p> : null}
        </div>
      </div>
      <div className="px-4 pb-5 pt-2 bg-gray-50">
        <button
          type="button"
          onClick={handleContinue}
          disabled={saving || !position}
          className="max-w-md mx-auto block w-full py-3.5 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50"
        >
          {saving && !awaitingCode ? 'Sending…' : 'Continue'}
        </button>
      </div>

      {awaitingCode ? (
        <div
          className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/50 px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="community-position-otp-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-gray-100 p-5 space-y-4">
            <div>
              <h2 id="community-position-otp-title" className="text-lg font-bold text-gray-900">
                Enter approval code
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                We sent a code to your coach <strong>{approver}</strong>
                {approverEmail ? ` (${approverEmail})` : ''}. Ask them for the code, then tap OK.
              </p>
            </div>
            <OtpInputCells
              otpCtl={otpCtl}
              length={EMAIL_OTP_LENGTH}
              emailOtp
              disabled={saving}
              onComplete={confirmCode}
              cellClassName="w-10 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg"
            />
            {otpError ? <p className="text-sm text-red-600">{otpError}</p> : null}
            <button
              type="button"
              disabled={saving || !otpCtl.isComplete}
              onClick={() => confirmCode(otpCtl.value)}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50"
            >
              {saving ? 'Checking…' : 'OK'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => sendApproval({ force: true })}
              className="w-full py-2 rounded-xl border border-green-200 text-green-700 text-sm font-semibold disabled:opacity-50"
            >
              Resend code
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setOtpOpen(false);
                setOtpError('');
              }}
              className="w-full py-2 text-sm font-medium text-gray-500 disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
