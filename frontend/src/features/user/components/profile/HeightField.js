/**
 * Home Profile Height — first save free; locked after that with pencil → OTP.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import {
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  heightsDiffer,
  isHeightLocked,
  validateHeightCm,
} from '../../domain/heightChange';
import { EMAIL_OTP_LENGTH } from '../../domain/otpLength';
import useOtpInput from '../../hooks/useOtpInput';
import OtpInputCells from '../../../../shared/components/OtpInputCells.jsx';

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';

const iconBtnCls =
  'absolute top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none';

const HeightField = ({
  height,
  setHeight,
  otpEnabled = false,
  lockedHeight = null,
  onRequestOtp,
  onVerifyOtp,
  busy = false,
  error = '',
  otpPending = false,
  destinationMasked = '',
}) => {
  const otpCtl = useOtpInput(EMAIL_OTP_LENGTH);
  const inputRef = useRef(null);
  const baselineRef = useRef('');
  const locked = otpEnabled && isHeightLocked(lockedHeight);
  const [isChanging, setIsChanging] = useState(false);

  const check = validateHeightCm(height);
  const differsFromBaseline = Boolean(
    baselineRef.current
    && heightsDiffer(baselineRef.current, height),
  );
  const editingLocked = locked && (isChanging || differsFromBaseline);
  const fieldEditable = !locked || editingLocked;
  const canFinishUnchangedEdit = locked && isChanging && !differsFromBaseline;
  const canSubmit = otpEnabled
    && locked
    && !busy
    && check.valid
    && (
      differsFromBaseline
      || (otpPending && isChanging)
    );
  const tickEnabled = canSubmit || canFinishUnchangedEdit;
  const showPencil = (locked && !editingLocked && !otpPending)
    || (otpPending && !isChanging);
  const showTick = locked && (
    (editingLocked && !otpPending)
    || (otpPending && isChanging)
  );
  const showCancelIcon = (editingLocked || (otpPending && isChanging)) && !busy;

  useEffect(() => {
    otpCtl.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when OTP step appears
  }, [otpPending]);

  useEffect(() => {
    if (!locked) {
      baselineRef.current = '';
      setIsChanging(false);
      return;
    }
    const saved = String(lockedHeight ?? '').trim();
    baselineRef.current = saved;
    if (!otpPending) {
      setIsChanging(false);
      if (saved && !heightsDiffer(height, saved)) {
        setHeight && setHeight(saved);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settle on lock / pending
  }, [locked, lockedHeight, otpPending]);

  useEffect(() => {
    if ((editingLocked || (otpPending && isChanging)) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingLocked, otpPending, isChanging]);

  const handleStartChange = () => {
    if (busy) return;
    setIsChanging(true);
  };

  const handleCancelChange = () => {
    setIsChanging(false);
    if (baselineRef.current) {
      setHeight && setHeight(baselineRef.current);
    }
  };

  const handleSubmit = () => {
    if (canFinishUnchangedEdit) {
      setIsChanging(false);
      return;
    }
    if (!canSubmit || !onRequestOtp || !check.valid) return;
    setIsChanging(false);
    onRequestOtp(check.value);
  };

  const handleVerify = (code) => {
    if (!onVerifyOtp || busy) return;
    onVerifyOtp(code);
  };

  if (!otpEnabled) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Height (cm) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="e.g. 170"
          min={HEIGHT_MIN_CM}
          max={HEIGHT_MAX_CM}
          className={inputCls}
          style={{ fontSize: '16px' }}
        />
      </div>
    );
  }

  const rightPad = showCancelIcon ? 'pr-20' : (showPencil || showTick ? 'pr-11' : '');

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Height (cm) <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*"
          value={height}
          onChange={(e) => setHeight && setHeight(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (canSubmit || canFinishUnchangedEdit)) {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === 'Escape' && (editingLocked || (otpPending && isChanging))) {
              e.preventDefault();
              handleCancelChange();
            }
          }}
          readOnly={!fieldEditable}
          placeholder="e.g. 170"
          min={HEIGHT_MIN_CM}
          max={HEIGHT_MAX_CM}
          className={`${inputCls} ${rightPad} ${!fieldEditable ? 'bg-gray-50 text-gray-700' : ''}`}
          style={{ fontSize: '16px' }}
          aria-label="Height in centimetres"
        />

        {showPencil && (
          <button
            type="button"
            disabled={busy}
            onClick={handleStartChange}
            className={`${iconBtnCls} right-2 text-green-700 hover:bg-green-50`}
            aria-label="Edit height"
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
            aria-label="Cancel height change"
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
                ? 'Sending verification code'
                : canFinishUnchangedEdit
                  ? 'Done editing height'
                  : (locked || otpPending ? 'Send height change code' : 'Confirm height')
            }
            title={
              busy
                ? 'Sending…'
                : canFinishUnchangedEdit
                  ? 'Done'
                  : (locked || otpPending ? 'Send code' : 'Confirm')
            }
          >
            <Check className="w-4 h-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {locked && editingLocked && !differsFromBaseline && !otpPending && (
        <p className="text-xs text-gray-500 mt-1.5">
          Tap the tick when done, or change the value to get a verification code.
        </p>
      )}

      {!locked && (
        <p className="text-xs text-gray-500 mt-1">
          Save Profile once to lock height. After that, changes need a verification code.
        </p>
      )}

      {otpPending && !isChanging && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            We sent a 4-digit code
            {destinationMasked ? ` to ${destinationMasked}` : ''}. Enter it to update your height.
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
            {busy ? 'Checking…' : 'Confirm height'}
          </button>
          <button
            type="button"
            disabled={busy || !check.valid}
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
      {!error && !check.valid && (editingLocked || !locked) && height && check.message && (
        <p className="text-xs text-red-600 mt-2">{check.message}</p>
      )}
    </div>
  );
};

export default HeightField;
