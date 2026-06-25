// Editable name / height / phone / BMR fields.
import React from 'react';
import { Flame } from 'lucide-react';

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
  name, setName, height, setHeight, phone, setPhone, bmr, setBmr,
}) => (
  <div className="space-y-4">
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
  </div>
);

export default UserProfileFields;
