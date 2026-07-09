// Editable name / height / phone / BMR / communityId fields + read-only email.
import React from 'react';
import { Flame, Mail, Hash } from 'lucide-react';

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
  communityId, setCommunityId,
}) => (
  <div className="space-y-4">
    {/* Email — editable for phone users; read-only hint shown for Google users */}
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
    <Field label="Height (cm)" required>
      <input type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)}
        placeholder="e.g. 170" min="50" max="198" className={inputCls} style={{ fontSize: '16px' }} />
    </Field>
    <Field label="Phone Number" required>
      <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
        placeholder="e.g. +91 9876543210" className={inputCls} style={{ fontSize: '16px' }} />
    </Field>
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
        <Flame className="w-4 h-4 text-orange-500" /> BMR (kcal)
      </label>
      <input type="number" inputMode="numeric" value={bmr} onChange={(e) => setBmr(e.target.value)}
        placeholder="e.g. 2200" style={{ fontSize: '16px' }}
        className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
    </div>

    {/* Community ID — optional */}
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
        <Hash className="w-4 h-4 text-blue-500" /> Community ID
        <span className="text-gray-400 text-xs font-normal ml-1">(optional)</span>
      </label>
      <input
        type="text"
        value={communityId || ''}
        onChange={(e) => setCommunityId(e.target.value)}
        placeholder="Enter your community ID"
        className={inputCls}
        style={{ fontSize: '16px' }}
      />
    </div>
  </div>
);

export default UserProfileFields;
