// Editable name / height / phone / community ID / gender fields + email.
// BMR is display-only when bmrReadOnly (profile page) — calculated from weight/formula.
import React from 'react';
import { Flame, Hash, Mail } from 'lucide-react';
import {
  COMMUNITY_ID_MAX_LENGTH,
  COMMUNITY_ID_MIN_LENGTH,
  COMMUNITY_ID_PLACEHOLDER,
  sanitizeCommunityIdInput,
} from '../../domain/communityId';
import PhysicalActivityField from './PhysicalActivityField';
import { VALID_GENDERS } from '../../domain/profileCompleteness';

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const UserProfileFields = ({
  email, setEmail,
  name, setName, height, setHeight, phone, setPhone, bmr, setBmr,
  bmrReadOnly = false,
  gender, setGender,
  physicalActivityLevel, setPhysicalActivityLevel,
  communityId, setCommunityId,
}) => (
  <div className="space-y-4">
    <Field label="Email" required>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email || ''}
          onChange={(e) => setEmail && setEmail(e.target.value)}
          readOnly={!setEmail}
          placeholder="e.g. yourname@gmail.com"
          className={`w-full pl-9 pr-3 py-2 border rounded-lg text-base outline-none ${
            !setEmail
              ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
              : 'border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500'
          }`}
          style={{ fontSize: '16px' }}
        />
      </div>
      {!setEmail && (
        <p className="text-xs text-gray-400 mt-1">Linked to your sign-in account</p>
      )}
    </Field>

    <Field label="Name" required>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Enter your name" className={inputCls} style={{ fontSize: '16px' }} />
    </Field>

    <Field label="Gender" required>
      <select
        value={gender || ''}
        onChange={(e) => setGender(e.target.value)}
        required
        className={`${inputCls} ${!gender ? 'text-gray-400' : 'text-gray-800'}`}
        style={{ fontSize: '16px' }}
      >
        <option value="" disabled>
          Select gender
        </option>
        {VALID_GENDERS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </Field>

    <Field label="Height (cm)" required>
      <input type="text" inputMode="decimal" pattern="[0-9]*" value={height} onChange={(e) => setHeight(e.target.value)}
        placeholder="e.g. 170" min="50" max="198" className={inputCls} style={{ fontSize: '16px' }} />
    </Field>
    <Field label="Phone Number" required>
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={phone} onChange={(e) => setPhone(e.target.value)}
        placeholder="e.g. +91 9876543210" className={inputCls} style={{ fontSize: '16px' }} />
    </Field>
    <Field label="Community ID">
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
        Enter your Community ID
      </p>
      <p className="text-xs text-gray-400 mt-0.5">
        {(communityId || '').length}/{COMMUNITY_ID_MAX_LENGTH} · Min {COMMUNITY_ID_MIN_LENGTH} · Letters and numbers only
      </p>
    </Field>
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
        <Flame className="w-4 h-4 text-orange-500" /> BMR (kcal)
      </label>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={bmr}
        onChange={bmrReadOnly ? undefined : (e) => setBmr(e.target.value)}
        readOnly={bmrReadOnly}
        placeholder={bmrReadOnly ? 'Calculated automatically' : 'e.g. 2200'}
        style={{ fontSize: '16px' }}
        className={
          bmrReadOnly
            ? 'w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-600 rounded-lg cursor-not-allowed outline-none'
            : 'w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none'
        }
      />
      {bmrReadOnly && (
        <p className="text-xs text-gray-400 mt-1">Auto-calculated from your weight and body fat — not editable</p>
      )}
    </div>

    <PhysicalActivityField
      value={physicalActivityLevel}
      onChange={setPhysicalActivityLevel}
    />
  </div>
);

export default UserProfileFields;
