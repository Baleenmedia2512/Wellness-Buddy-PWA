/**
 * Home Profile Community ID — create / co-sponsor with 24h sponsor OTP.
 */
import React, { useEffect } from 'react';
import { Hash } from 'lucide-react';
import {
  COMMUNITY_ID_MAX_LENGTH,
  COMMUNITY_ID_MIN_LENGTH,
  COMMUNITY_ID_PLACEHOLDER,
  sanitizeCommunityIdInput,
  validateCommunityId,
  communityIdPendingApprovalMessage,
} from '../../domain/communityId';
import { EMAIL_OTP_LENGTH } from '../../domain/otpLength';
import useOtpInput from '../../hooks/useOtpInput';
import OtpInputCells from '../../../../shared/components/OtpInputCells.jsx';

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';

const SEAT_LABEL = {
  sponsor: 'Sponsor',
  'co-sponsor': 'Co-Sponsor',
};

const CommunityIdField = ({
  communityId,
  setCommunityId,
  teamSeat = null,
  otpEnabled = false,
  pendingRequest = null,
  onCreate,
  onVerify,
  busy = false,
  error = '',
  sponsorName = '',
}) => {
  const otpCtl = useOtpInput(EMAIL_OTP_LENGTH);
  const confirmed = otpEnabled && !!teamSeat;
  const pending = otpEnabled && pendingRequest && pendingRequest.status === 'pending';
  const check = validateCommunityId(communityId);
  const canCreate = otpEnabled && !confirmed && !busy && check.valid && check.value;

  useEffect(() => {
    otpCtl.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when a new request arrives
  }, [pendingRequest?.id]);

  const handleVerify = (code) => {
    if (!onVerify || busy) return;
    onVerify(code);
  };

  if (!otpEnabled) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Community ID</label>
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={communityId || ''}
            onChange={(e) => setCommunityId && setCommunityId(
              sanitizeCommunityIdInput(e.target.value),
            )}
            maxLength={COMMUNITY_ID_MAX_LENGTH}
            placeholder={COMMUNITY_ID_PLACEHOLDER}
            className={`${inputCls} pl-9 font-mono tracking-wide uppercase`}
            style={{ fontSize: '16px' }}
          />
        </div>
        {teamSeat && (
          <p className="text-xs text-green-700 font-medium mt-1.5">
            Role: {SEAT_LABEL[teamSeat] || teamSeat}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Optional team code for Sponsor / Co-Sponsor. Tap Save Profile after editing.
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {(communityId || '').length}/{COMMUNITY_ID_MAX_LENGTH} · Min {COMMUNITY_ID_MIN_LENGTH} · Letters and numbers only
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Community ID</label>
      <div className="relative">
        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={communityId || ''}
          onChange={(e) => setCommunityId && setCommunityId(
            sanitizeCommunityIdInput(e.target.value),
          )}
          readOnly={confirmed}
          maxLength={COMMUNITY_ID_MAX_LENGTH}
          placeholder={COMMUNITY_ID_PLACEHOLDER}
          className={`${inputCls} pl-9 font-mono tracking-wide uppercase ${
            confirmed ? 'bg-gray-50 text-gray-700 cursor-not-allowed' : ''
          }`}
          style={{ fontSize: '16px' }}
        />
      </div>

      {confirmed && (
        <>
          {teamSeat && (
            <p className="text-xs text-green-700 font-medium mt-1.5">
              Role: {SEAT_LABEL[teamSeat] || teamSeat}
            </p>
          )}
         
        </>
      )}

      {!confirmed && !pending && (
        <>
          <p className="text-xs text-gray-500 mt-1">
            Enter a new code to become Sponsor, or an existing code to request Co-Sponsor.
            Your sponsor must approve with a 24-hour code.
          </p>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => onCreate && onCreate(check.value)}
            className="mt-2 w-full py-2 rounded-lg text-sm font-semibold text-white bg-green-600 disabled:bg-gray-300 disabled:text-gray-500"
          >
            {busy ? 'Sending…' : 'Create'}
          </button>
        </>
      )}

      {pending && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {communityIdPendingApprovalMessage({
              sponsorName: pendingRequest.approverName || sponsorName,
            })}
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
            disabled={busy || !canCreate}
            onClick={() => onCreate && onCreate(check.value)}
            className="w-full py-2 rounded-lg text-xs font-medium text-green-700 border border-green-200"
          >
            Resend code
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
      {!confirmed && (
        <p className="text-xs text-gray-400 mt-1">
          {(communityId || '').length}/{COMMUNITY_ID_MAX_LENGTH} · Min {COMMUNITY_ID_MIN_LENGTH} · Letters and numbers only
        </p>
      )}
    </div>
  );
};

export default CommunityIdField;
