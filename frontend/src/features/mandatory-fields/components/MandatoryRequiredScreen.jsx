/**
 * Grace-limit 0 fields, shown in the same full-screen profile layout
 * as Complete Your Profile. Editors stay open on one form. No Skip.
 */
import React from 'react';
import { User } from 'lucide-react';
import CompleteProfileChecklist from '../../user/components/complete/CompleteProfileChecklist';
import MandatoryFieldFill from './MandatoryFieldFill';

export default function MandatoryRequiredScreen({
  fields,
  user,
  appVersion,
  failure,
  onRetry,
  onDone,
}) {
  const checks = (fields || []).map((field) => ({ label: field.label, done: false, mark: true }));
  const names = checks.map((item) => item.label);
  const subtitle = names.length === 0
    ? 'Checking required profile details.'
    : names.length === 1
      ? `${names[0]} is required.`
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are required.`;

  return (
    <div className="fixed inset-0 bg-gray-50 overflow-y-auto" style={{ zIndex: 9999 }}>
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-white/20 rounded-full p-2"><User className="w-6 h-6 text-white" /></div>
          <h1 className="text-2xl font-bold text-white">Complete Your Profile</h1>
        </div>
        <p className="text-green-100 text-sm">{subtitle}</p>
      </div>
      <div className="max-w-md mx-auto p-5 space-y-5">
        <CompleteProfileChecklist loading={false} checks={checks} />
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 space-y-4">
          {failure && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <p className="text-sm text-red-600">{failure.message || 'Profile could not be loaded. Please try again.'}</p>
              <button type="button" className="mt-2 text-sm font-semibold text-red-700 underline" onClick={onRetry}>
                Try again
              </button>
            </div>
          )}
          {(fields || []).map((field) => (
            <MandatoryFieldFill
              key={field.fieldKey}
              field={field}
              user={user}
              appVersion={appVersion}
              embedded
              onDone={onDone}
              onCancel={() => {}}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
