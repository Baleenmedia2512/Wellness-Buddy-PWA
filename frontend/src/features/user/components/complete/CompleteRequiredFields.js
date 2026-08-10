// Name, email, gender, height, diet, conditional body fat.
import React from 'react';
import { Mail, Percent, Ruler, User } from 'lucide-react';
import { DIET_OPTIONS } from '../../services/dietOptions';
import DietIcon from '../../../../shared/components/icons/DietIcon';
import {
  VALID_GENDERS,
  MIN_BODY_FAT_PCT,
  MAX_BODY_FAT_PCT,
} from '../../domain/profileCompleteness';

const inputCls = (invalid) =>
  `w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none text-base bg-white ${
    invalid ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-green-400'
  }`;

const CompleteRequiredFields = ({
  name, setName, nameValid,
  email, setEmail, emailValid, emailLocked,
  gender, setGender, showGender,
  height, setHeight, heightValid,
  dietType, setDietType,
  bodyFat, setBodyFat, showBodyFat, bodyFatValid,
}) => (
  <>
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Full Name <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your full name"
          className={inputCls(name && !nameValid)}
          style={{ fontSize: '16px' }}
        />
      </div>
    </div>

    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Email <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={emailLocked}
          className={`${inputCls(email && !emailValid)} ${emailLocked ? 'bg-gray-50 text-gray-600' : ''}`}
          style={{ fontSize: '16px' }}
        />
      </div>
      {emailLocked && (
        <p className="text-xs text-gray-400 mt-1">Email from your login account</p>
      )}
    </div>

    {showGender && (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Gender <span className="text-red-500">*</span>
        </label>
        <select
          value={gender || ''}
          onChange={(e) => setGender(e.target.value)}
          required
          className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none text-base bg-white appearance-none ${
            !gender
              ? 'border-gray-200 focus:border-green-400 text-gray-400'
              : 'border-gray-200 focus:border-green-400 text-gray-800'
          }`}
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
      </div>
    )}

    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Height (cm) <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="e.g. 170"
          className={inputCls(height && !heightValid)}
          style={{ fontSize: '16px' }}
          min="50"
          max="250"
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">Range: 50 - 250 cm</p>
    </div>

    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Diet Preference <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        {DIET_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDietType(opt.value)}
            className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-center gap-1.5 ${
              dietType === opt.value
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
            }`}
          >
            <DietIcon value={opt.value} emojiClassName="text-lg" />
            {opt.label}
          </button>
        ))}
      </div>
    </div>

    {showBodyFat && (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Body Fat (%) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            inputMode="decimal"
            value={bodyFat || ''}
            onChange={(e) => setBodyFat(e.target.value)}
            placeholder="e.g. 22"
            className={inputCls(bodyFat && !bodyFatValid)}
            style={{ fontSize: '16px' }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Required for BMR. Range: {MIN_BODY_FAT_PCT}–{MAX_BODY_FAT_PCT}%
        </p>
      </div>
    )}
  </>
);

export default CompleteRequiredFields;
