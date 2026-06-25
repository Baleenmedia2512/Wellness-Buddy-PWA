/**
 * StepCounterControls.js — top-of-page banners + permission prompt.
 *
 * Renders three independent banners (any combination may be visible):
 *   - Generic error toast
 *   - Wrong device date warning (with dismiss)
 *   - Anti-cheat suspicious activity warning (with dismiss)
 *   - Sensor permission ask card
 *
 * All actions delegated upward via callbacks; no business logic here.
 */
import React from 'react';
import { ShieldAlert, Calendar } from 'lucide-react';

const ErrorBanner = ({ error }) => (
  <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5">
    <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-red-700">{error}</p>
  </div>
);

const WrongDateBanner = ({ wrongDateWarning, onDismiss }) => (
  <div className="bg-orange-50 border border-orange-300 rounded-2xl p-4 flex items-start gap-3">
    <Calendar className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-orange-900">Wrong Device Date Detected</p>
      <p className="text-xs text-orange-700 mt-0.5">
        Your device date appears incorrect. The actual date is{' '}
        <span className="font-bold">{wrongDateWarning}</span>.
        Step data shown may not match the correct day.
      </p>
      <p className="text-xs text-orange-600 mt-1">Please correct your device date in Settings → Date &amp; Time.</p>
    </div>
    <button onClick={onDismiss} aria-label="Dismiss"
      className="text-orange-400 hover:text-orange-600 active:text-orange-700 text-lg leading-none font-bold flex-shrink-0 -mt-0.5">×</button>
  </div>
);

const SuspiciousBanner = ({ suspiciousActivity, onDismiss }) => {
  const fake = suspiciousActivity === 'fake_detected';
  return (
    <div className={`border rounded-2xl p-4 flex items-start gap-3 ${fake ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
      <ShieldAlert className={`w-5 h-5 flex-shrink-0 mt-0.5 ${fake ? 'text-red-500' : 'text-amber-500'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${fake ? 'text-red-900' : 'text-amber-900'}`}>
          {fake ? '⚠ Fake Steps Detected — Saving Reduced' : 'Unusual Step Rate'}
        </p>
        <p className={`text-xs mt-0.5 ${fake ? 'text-red-700' : 'text-amber-700'}`}>
          {fake
            ? 'Movement patterns are inconsistent with real walking (phone shaking or automated tool detected). Suspicious steps are being quarantined and not saved to your history.'
            : 'Step rate is above normal human limits. Activity is being monitored.'}
        </p>
      </div>
      <button onClick={onDismiss} aria-label="Dismiss"
        className="text-gray-400 hover:text-gray-600 text-lg leading-none font-bold flex-shrink-0 -mt-0.5">×</button>
    </div>
  );
};

const PermissionAsk = ({ onRequest }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
    <div className="flex items-start gap-3">
      <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900 mb-1">Permission Required</p>
        <p className="text-xs text-amber-700 mb-3">Allow activity recognition to track your steps.</p>
        <button onClick={onRequest}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors">
          Grant Permission
        </button>
      </div>
    </div>
  </div>
);

export default function StepCounterControls({
  error, wrongDateWarning, onDismissWrongDate,
  suspiciousActivity, onDismissSuspicious, isViewingOther,
  showPermissionAsk, onRequestPermission,
}) {
  return (
    <>
      {error && <ErrorBanner error={error} />}
      {wrongDateWarning && <WrongDateBanner wrongDateWarning={wrongDateWarning} onDismiss={onDismissWrongDate} />}
      {suspiciousActivity && suspiciousActivity !== 'vehicle_detected' && !isViewingOther && (
        <SuspiciousBanner suspiciousActivity={suspiciousActivity} onDismiss={onDismissSuspicious} />
      )}
      {showPermissionAsk && <PermissionAsk onRequest={onRequestPermission} />}
    </>
  );
}
