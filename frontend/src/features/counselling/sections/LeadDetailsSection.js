/**
 * LeadDetailsSection.js — presentational section.
 * Captures ONLY the identifying contact details for a prospective member
 * (lead) who does not yet have an app account.
 *
 * Intentionally minimal — just Name + Mobile.
 * All health, eating, sleep and medication data is captured by the
 * counselling form's existing sections (EatingHabitsSection already
 * includes diet type; HealthProblemSection captures health conditions).
 * When the lead downloads the app and registers with the same mobile
 * number, their profile is pre-populated from those counselling sections.
 */
import React from 'react';
import { User, Phone } from 'lucide-react';

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm';

export default function LeadDetailsSection({ leadDetails, onChange }) {
  const set = (field) => (e) => onChange({ ...leadDetails, [field]: e.target.value });

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2">
        <User size={18} className="text-green-600 sm:w-5 sm:h-5" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-800">Lead Contact</h3>
        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
          New Lead
        </span>
      </div>
      <p className="text-xs text-gray-500">
        Enter name and mobile so this counselling data can pre-fill the lead's profile when they download the app.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Name */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
            <User size={14} className="text-gray-400" />
            Full Name <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={leadDetails.name || ''}
            onChange={set('name')}
            placeholder="e.g. Priya Sharma"
            className={inputCls}
            style={{ fontSize: '16px' }}
          />
        </div>

        {/* Mobile */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
            <Phone size={14} className="text-gray-400" />
            Mobile Number <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={leadDetails.phone || ''}
            onChange={set('phone')}
            placeholder="e.g. +91 9876543210"
            className={inputCls}
            style={{ fontSize: '16px' }}
          />
        </div>
      </div>
    </div>
  );
}
