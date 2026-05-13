/**
 * ScreenTimeStates.js — presentational.
 *
 * Empty/intermediate states for the screen-time card: web fallback,
 * permission gate, and the loading spinner. Render-only.
 */
import React from 'react';
import { Smartphone, RefreshCw, Shield } from 'lucide-react';

export function ScreenTimeWebFallback() {
  return (
    <ScreenCard>
      <Header icon={Smartphone} iconClass="text-blue-500" />
      <p className="text-sm text-gray-500">
        Screen time tracking is only available on Android devices.
      </p>
    </ScreenCard>
  );
}

export function ScreenPermissionGate({ issue, onRequest }) {
  return (
    <ScreenCard>
      <Header icon={Shield} iconClass="text-amber-500" />
      <p className="text-sm text-gray-600 mb-3">
        Grant usage access permission to track your daily screen time.
      </p>
      {issue && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mb-3">
          {issue}
        </p>
      )}
      <button
        onClick={onRequest}
        className="w-full py-2 px-4 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 active:bg-blue-700 transition-colors"
      >
        Open Usage Access Settings
      </button>
      <p className="text-[11px] text-gray-500 mt-2">
        If your phone is managed/restricted and does not allow Usage Access, this module cannot read device screen time.
      </p>
    </ScreenCard>
  );
}

export function ScreenTimeLoading() {
  return (
    <ScreenCard>
      <Header icon={Smartphone} iconClass="text-blue-500" />
      <div className="flex items-center justify-center py-4">
        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading...</span>
      </div>
    </ScreenCard>
  );
}

function ScreenCard({ children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      {children}
    </div>
  );
}

function Header({ icon: Icon, iconClass }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-5 h-5 ${iconClass}`} />
      <h3 className="font-semibold text-gray-800">Screen Time</h3>
    </div>
  );
}
