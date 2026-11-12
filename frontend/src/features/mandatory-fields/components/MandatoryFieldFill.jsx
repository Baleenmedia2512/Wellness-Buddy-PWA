/**
 * Opens the existing profile editor for one mandatory field.
 * OTP fields use the same request and verify calls as Home Profile.
 */
import React, { useState } from 'react';
import { isFlagEnabled } from '../../../config/featureFlags';
import {
  hasValidBodyFatPercent,
  hasValidProfileName,
  VALID_GENDERS,
} from '../../user/domain/profileCompleteness';
import { validateCommunityId, COMMUNITY_ID_OTP_FLAG } from '../../user/domain/communityId';
import { COMMUNITY_POSITION_OTP_FLAG } from '../../user/domain/communityPosition';
import { HEIGHT_CHANGE_OTP_FLAG, validateHeightCm } from '../../user/domain/heightChange';
import CommunityIdField from '../../user/components/profile/CommunityIdField';
import CommunityPositionField from '../../user/components/profile/CommunityPositionField';
import DietDropdown from '../../user/components/profile/DietDropdown';
import HeightField from '../../user/components/profile/HeightField';
import PhysicalActivityField from '../../user/components/profile/PhysicalActivityField';
import ProfileEmailKycSection from '../../user/components/profile/ProfileEmailKycSection';
import {
  requestCommunityId,
  saveProfile,
  verifyCommunityIdOtp,
  verifyHeightChangeOtp,
} from '../../user/services/profileService';
import { editorPlan } from '../domain/fieldEditors';
import { isBelowEditorVersion } from '../domain/mandatoryPrompt.rules';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-base';

function phoneDigitsOk(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export default function MandatoryFieldFill({ field, user, appVersion, onDone, onCancel, embedded = false }) {
  const userId = user?.id || user?.UserId || user?.userId || null;
  const email = user?.email || user?.Email || '';
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otpPending, setOtpPending] = useState(false);
  const [destinationMasked, setDestinationMasked] = useState('');
  const [communityPending, setCommunityPending] = useState(null);

  if (isBelowEditorVersion(appVersion, field.editorMinAppVersion)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p>
          {field.label} needs app {field.editorMinAppVersion} or newer.
          This install cannot open that editor.
        </p>
        <button type="button" className="mt-2 font-semibold underline" onClick={onCancel}>Close</button>
      </div>
    );
  }

  const saveSimple = async (payload) => {
    setBusy(true);
    setError('');
    try {
      await saveProfile({ userId, email, ...payload });
      onDone();
    } catch (err) {
      setError(err?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  let editor = null;
  if (field.fieldKey === 'email') {
    editor = (
      <ProfileEmailKycSection
        userId={userId}
        userName={user?.userName || user?.username || ''}
        verifiedEmail={email}
        onVerified={() => onDone()}
      />
    );
  } else if (field.fieldKey === 'communityId') {
    editor = (
      <CommunityIdField
        communityId={value}
        setCommunityId={setValue}
        otpEnabled={isFlagEnabled(COMMUNITY_ID_OTP_FLAG)}
        pendingRequest={communityPending}
        busy={busy}
        error={error}
        onCreate={async (communityId) => {
          const check = validateCommunityId(communityId);
          if (!check.valid) {
            setError(check.message || 'Enter a valid Community ID.');
            return;
          }
          setBusy(true);
          setError('');
          try {
            if (!isFlagEnabled(COMMUNITY_ID_OTP_FLAG)) {
              await saveProfile({ userId, email, communityId: check.value });
              onDone();
              return;
            }
            const data = await requestCommunityId({ userId, email, communityId: check.value });
            setCommunityPending(data.communityIdRequest || data.pendingRequest || { status: 'pending' });
          } catch (err) {
            setError(err?.message || 'Could not send the approval code.');
          } finally {
            setBusy(false);
          }
        }}
        onVerify={async (otp) => {
          setBusy(true);
          setError('');
          try {
            await verifyCommunityIdOtp({ userId, email, otp });
            onDone();
          } catch (err) {
            setError(err?.message || 'That code was not accepted.');
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  } else if (field.fieldKey === 'communityPosition') {
    const allowed = field.positionScope === 'specific' ? field.positionCodes || [] : null;
    editor = (
      <div>
        {allowed && (
          <p className="mb-2 text-xs text-gray-600">Accepted positions: {allowed.join(', ')}</p>
        )}
        <CommunityPositionField
          userId={userId}
          email={email}
          otpEnabled={isFlagEnabled(COMMUNITY_POSITION_OTP_FLAG)}
          onChange={(code) => {
            if (!isFlagEnabled(COMMUNITY_POSITION_OTP_FLAG)) {
              saveSimple({ eventLevel: code });
            }
          }}
          onSettled={() => onDone()}
        />
      </div>
    );
  } else if (field.fieldKey === 'height') {
    editor = (
      <HeightField
        height={value}
        setHeight={setValue}
        otpEnabled={isFlagEnabled(HEIGHT_CHANGE_OTP_FLAG)}
        lockedHeight={null}
        busy={busy}
        error={error}
        otpPending={otpPending}
        destinationMasked={destinationMasked}
        onRequestOtp={async (height) => {
          const check = validateHeightCm(height);
          if (!check.valid) {
            setError(check.message || 'Enter a valid height.');
            return;
          }
          setBusy(true);
          setError('');
          try {
            await saveProfile({ userId, email, height: check.value });
            onDone();
          } catch (err) {
            setError(err?.message || 'Could not save height.');
          } finally {
            setBusy(false);
          }
        }}
        onVerifyOtp={async (otp) => {
          const check = validateHeightCm(value);
          if (!check.valid) {
            setError(check.message || 'Enter a valid height.');
            return;
          }
          setBusy(true);
          setError('');
          try {
            await verifyHeightChangeOtp({ userId, email, height: check.value, otp });
            onDone();
          } catch (err) {
            setError(err?.message || 'That code was not accepted.');
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  } else if (field.fieldKey === 'diet') {
    editor = <DietDropdown value={value} onChange={setValue} />;
  } else if (field.fieldKey === 'physicalActivity') {
    editor = <PhysicalActivityField value={value} onChange={setValue} />;
  } else if (field.fieldKey === 'gender') {
    editor = (
      <select className={inputCls} value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">Select gender</option>
        {VALID_GENDERS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  } else if (field.fieldKey === 'name' || field.fieldKey === 'phone' || field.fieldKey === 'bmr' || field.fieldKey === 'bodyFat') {
    editor = (
      <input
        className={inputCls}
        value={value}
        inputMode={field.fieldKey === 'phone' || field.fieldKey === 'bmr' || field.fieldKey === 'bodyFat' ? 'decimal' : 'text'}
        placeholder={field.label}
        onChange={(e) => setValue(e.target.value)}
      />
    );
  } else if (!editorPlan(field.fieldKey)) {
    editor = <p className="text-sm text-gray-700">This field cannot be edited in this app.</p>;
  }

  const saveCurrent = () => {
    if (field.fieldKey === 'name') {
      if (!hasValidProfileName(value, { email, phoneNumber: user?.phoneNumber || user?.phone })) {
        setError('Enter the name you want on your profile.');
        return;
      }
      saveSimple({ name: value.trim() });
      return;
    }
    if (field.fieldKey === 'gender') {
      if (!VALID_GENDERS.includes(value)) {
        setError('Select Male or Female.');
        return;
      }
      saveSimple({ gender: value });
      return;
    }
    if (field.fieldKey === 'diet') {
      if (!String(value).trim()) {
        setError('Select a diet.');
        return;
      }
      saveSimple({ dietType: value });
      return;
    }
    if (field.fieldKey === 'physicalActivity') {
      if (!value) {
        setError('Select an activity level.');
        return;
      }
      saveSimple({ physicalActivityLevel: value });
      return;
    }
    if (field.fieldKey === 'phone') {
      if (!phoneDigitsOk(value)) {
        setError('Enter a phone number with 10 to 15 digits.');
        return;
      }
      saveSimple({ phoneNumber: value.trim() });
      return;
    }
    if (field.fieldKey === 'bmr') {
      const n = parseFloat(value);
      if (!Number.isFinite(n) || n <= 0) {
        setError('Enter a BMR greater than zero.');
        return;
      }
      saveSimple({ bmr: n });
      return;
    }
    if (field.fieldKey === 'bodyFat') {
      if (!hasValidBodyFatPercent(value)) {
        setError('Enter a body fat percent from 1 to 70.');
        return;
      }
      saveSimple({ bodyFat: parseFloat(value) });
      return;
    }
    if (field.fieldKey === 'height' && !isFlagEnabled(HEIGHT_CHANGE_OTP_FLAG)) {
      const check = validateHeightCm(value);
      if (!check.valid) {
        setError(check.message || 'Enter a valid height.');
        return;
      }
      saveSimple({ height: check.value });
    }
  };

  const showSave = ['name', 'gender', 'diet', 'physicalActivity', 'phone', 'bmr', 'bodyFat'].includes(field.fieldKey)
    || (field.fieldKey === 'height' && !isFlagEnabled(HEIGHT_CHANGE_OTP_FLAG));

  return (
    <div className={embedded ? '' : 'mt-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3'}>
      {editor}
      {error && !['communityId', 'height'].includes(field.fieldKey) && (
        <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>
      )}
      {(showSave || !embedded) && (
        <div className="mt-3 flex gap-2">
          {showSave && (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={busy}
              onClick={saveCurrent}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
          {!embedded && (
            <button type="button" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" onClick={onCancel}>
              Close
            </button>
          )}
        </div>
      )}
    </div>
  );
}
