// Height + Phone + Diet input fields used by CompleteProfilePage.
import React from 'react';
import { Phone, Ruler } from 'lucide-react';
import { DIET_OPTIONS } from '../../services/dietOptions';

const inputCls = (invalid) =>
  `w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none text-base bg-white ${
    invalid ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-green-400'
  }`;

const CompleteRequiredFields = ({
  missing, height, setHeight, heightValid,
  phone, setPhone, phoneValid, dietType, setDietType,
}) => (
  <>
    {missing.height && (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Height (cm) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input type="number" inputMode="decimal" value={height}
            onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 170"
            className={inputCls(height && !heightValid)} style={{ fontSize: '16px' }}
            min="50" max="250" />
        </div>
        <p className="text-xs text-gray-400 mt-1">Range: 50 - 250 cm</p>
      </div>
    )}
    {missing.phoneNumber && (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input type="tel" inputMode="tel" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 9876543210"
            className={inputCls(phone && !phoneValid)} style={{ fontSize: '16px' }} />
        </div>
        <p className="text-xs text-gray-400 mt-1">10-15 digits, with optional country code</p>
      </div>
    )}
    {missing.dietType && (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Diet Preference <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DIET_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setDietType(opt.value)}
              className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-center gap-1.5 ${
                dietType === opt.value
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
              }`}>
              <span style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", sans-serif', fontSize: '1.1em' }}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )}
  </>
);

export default CompleteRequiredFields;
