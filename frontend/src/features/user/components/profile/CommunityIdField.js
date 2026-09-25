/**
 * Home Profile Community ID — create / co-sponsor with 24h sponsor OTP.
 * Confirmed / pending: pencil inside the field to edit; tick to send / resend OTP.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, Hash, Pencil, X } from 'lucide-react';
import {
  COMMUNITY_ID_MAX_LENGTH,
  COMMUNITY_ID_MIN_LENGTH,
  COMMUNITY_ID_PLACEHOLDER,
  sanitizeCommunityIdInput,
  validateCommunityId,
  communityIdPendingApprovalParts,
  formatCommunityIdPairLabel,
} from '../../domain/communityId';
import { EMAIL_OTP_LENGTH } from '../../domain/otpLength';
import useOtpInput from '../../hooks/useOtpInput';
import OtpInputCells from '../../../../shared/components/OtpInputCells.jsx';

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';

const iconBtnCls =
  'absolute top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none';

function resolveApproverEmail(pendingRequest, sponsorEmailProp) {
  const fromRequest = String(
    pendingRequest?.approverEmail
    || pendingRequest?.approver_email
    || '',
  ).trim();
  if (fromRequest.includes('@')) return fromRequest;
  const fromProp = String(sponsorEmailProp || '').trim();
  return fromProp.includes('@') ? fromProp : '';
}

const CommunityIdField = ({
  communityId,
  setCommunityId,
  teamSeat = null,
  otpEnabled = false,
  pendingRequest = null,
  communityIdPair = null,
  onCreate,
  onVerify,
  busy = false,
  error = '',
  sponsorName = '',
  sponsorEmail = '',
}) => {
  const otpCtl = useOtpInput(EMAIL_OTP_LENGTH);
  const inputRef = useRef(null);
  const confirmed = otpEnabled && !!teamSeat;
  const pending = otpEnabled && pendingRequest && pendingRequest.status === 'pending';
  const [isChanging, setIsChanging] = useState(false);
  const baselineRef = useRef('');
  const check = validateCommunityId(communityId);
  // Compare raw sanitized input (not only valid check.value). Otherwise a too-short
  // edit like YASHEER12MM0 → M0 looks "unchanged", tick just closes edit, no OTP.
  const sanitizedInput = sanitizeCommunityIdInput(communityId || '');
  const differsFromBaseline = Boolean(
    baselineRef.current
    && sanitizedInput !== baselineRef.current,
  );
  const editingConfirmed = confirmed && (isChanging || differsFromBaseline);
  // Pending OTP: keep the code locked until the user taps the pencil.
  const editingPending = pending && isChanging;
  const fieldEditable = (!confirmed && !pending)
    || editingConfirmed
    || editingPending;
  const canFinishUnchangedEdit = confirmed && isChanging && !differsFromBaseline;
  const canSubmit = otpEnabled
    && !busy
    && check.valid
    && check.value
    && (
      (!confirmed && !pending)
      || (confirmed && differsFromBaseline)
      || editingPending
    );
  const tickEnabled = canSubmit || canFinishUnchangedEdit;
  const showPencil = (
    (confirmed && !editingConfirmed && !pending)
    || (pending && !isChanging)
  );
  const showTick = (
    ((!confirmed || editingConfirmed) && !pending)
    || editingPending
  );
  const showCancelIcon = (editingConfirmed || editingPending) && !busy;
  const pairLabel = formatCommunityIdPairLabel(communityIdPair || {});
  const pendingParts = communityIdPendingApprovalParts({
    sponsorName: pendingRequest?.approverName || sponsorName,
    sponsorEmail: resolveApproverEmail(pendingRequest, sponsorEmail),
  });

  useEffect(() => {
    otpCtl.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when a new request arrives
  }, [pendingRequest?.id]);

  // Snapshot the confirmed / pending code; restore pending code if the field was cleared.
  // When a pending OTP request arrives, always exit edit mode so the OTP cells show
  // (otherwise Change → tick leaves isChanging=true and hides verify UI).
  useEffect(() => {
    if (!confirmed && !pending) {
      baselineRef.current = '';
      setIsChanging(false);
      return;
    }
    if (pending && pendingRequest?.communityId) {
      const pendingCode = sanitizeCommunityIdInput(pendingRequest.communityId);
      baselineRef.current = pendingCode;
      setIsChanging(false);
      if (pendingCode) {
        setCommunityId && setCommunityId(pendingCode);
      }
      return;
    }
    if (confirmed && !pending) {
      baselineRef.current = sanitizeCommunityIdInput(communityId || '');
      setIsChanging(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settle baseline on seat/pending changes
  }, [confirmed, pending, teamSeat, pendingRequest?.id, pendingRequest?.communityId]);

  useEffect(() => {
    if ((editingConfirmed || editingPending) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingConfirmed, editingPending]);

  const handleVerify = (code) => {
    if (!onVerify || busy) return;
    onVerify(code);
  };

  const handleStartChange = () => {
    if (busy) return;
    setIsChanging(true);
  };

  const handleCancelChange = () => {
    setIsChanging(false);
    if (baselineRef.current) {
      setCommunityId && setCommunityId(baselineRef.current);
    }
  };

  const handleSubmit = () => {
    // Same code while editing a confirmed ID → just close edit mode (no OTP).
    if (canFinishUnchangedEdit) {
      setIsChanging(false);
      return;
    }
    if (!canSubmit || !onCreate) return;
    // Leave edit mode before the request returns so OTP entry is visible for
    // both first-time create and change-of-existing Community ID.
    setIsChanging(false);
    onCreate(check.value);
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
        <p className="text-xs text-gray-500 mt-1">
          Optional team code for joint coaching account (up to 2 people). Tap Save Profile after editing.
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {(communityId || '').length}/{COMMUNITY_ID_MAX_LENGTH} · Min {COMMUNITY_ID_MIN_LENGTH} · Letters and numbers only
        </p>
      </div>
    );
  }

  const rightPad = showCancelIcon ? 'pr-20' : (showPencil || showTick ? 'pr-11' : '');

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Community ID</label>
      <div className="relative">
        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={communityId || ''}
          onChange={(e) => setCommunityId && setCommunityId(
            sanitizeCommunityIdInput(e.target.value),
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (canSubmit || canFinishUnchangedEdit)) {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === 'Escape' && (editingConfirmed || editingPending)) {
              e.preventDefault();
              handleCancelChange();
            }
          }}
          readOnly={!fieldEditable}
          maxLength={COMMUNITY_ID_MAX_LENGTH}
          placeholder={COMMUNITY_ID_PLACEHOLDER}
          className={`${inputCls} pl-9 ${rightPad} font-mono tracking-wide uppercase ${
            !fieldEditable ? 'bg-gray-50 text-gray-700' : ''
          }`}
          style={{ fontSize: '16px' }}
          aria-label="Community ID"
        />

        {showPencil && (
          <button
            type="button"
            disabled={busy}
            onClick={handleStartChange}
            className={`${iconBtnCls} right-2 text-green-700 hover:bg-green-50`}
            aria-label="Edit Community ID"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {showCancelIcon && (
          <button
            type="button"
            disabled={busy}
            onClick={handleCancelChange}
            className={`${iconBtnCls} right-10 text-gray-500 hover:bg-gray-100`}
            aria-label="Cancel Community ID change"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {showTick && (
          <button
            type="button"
            disabled={!tickEnabled}
            onClick={handleSubmit}
            className={`${iconBtnCls} right-2 ${
              tickEnabled
                ? 'text-green-700 hover:bg-green-50'
                : 'text-gray-300'
            }`}
            aria-label={
              busy
                ? 'Sending approval request'
                : canFinishUnchangedEdit
                  ? 'Done editing Community ID'
                  : (confirmed || pending ? 'Request Community ID change' : 'Create Community ID')
            }
            title={
              busy
                ? 'Sending…'
                : canFinishUnchangedEdit
                  ? 'Done'
                  : (confirmed || pending ? 'Request change' : 'Create')
            }
          >
            <Check className="w-4 h-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {pairLabel ? (
        <p className="text-sm font-semibold text-gray-800 mt-3 tracking-wide">
          {pairLabel}
        </p>
      ) : null}

      {confirmed && editingConfirmed && !differsFromBaseline && !pending && (
        <p className={`text-xs text-gray-500 ${pairLabel ? 'mt-1.5' : 'mt-3'}`}>
          Tap the tick when done, or change the code to request a new sponsor approval.
        </p>
      )}

      {pending && !editingPending && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {pendingParts.before}
            <strong>{pendingParts.highlight}</strong>
            {pendingParts.after}
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
            disabled={busy || !canSubmit}
            onClick={handleSubmit}
            className="w-full py-2 rounded-lg text-xs font-medium text-green-700 border border-green-200"
          >
            Resend code
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
      {!error && !check.valid && (editingConfirmed || editingPending || (!confirmed && !pending)) && check.message && (
        <p className="text-xs text-red-600 mt-2">{check.message}</p>
      )}
      {((!confirmed && !pending) || editingConfirmed || editingPending || (pending && !editingPending)) && (
        <p className="text-xs text-gray-400 mt-1">
          {(communityId || '').length}/{COMMUNITY_ID_MAX_LENGTH} · Min {COMMUNITY_ID_MIN_LENGTH} · Letters and numbers only
        </p>
      )}
    </div>
  );
};

export default CommunityIdField;
