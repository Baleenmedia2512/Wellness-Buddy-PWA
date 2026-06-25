/**
 * WaterTracker.js — slice-level container.
 *
 * Composes the water UI from three dumb sub-components and the
 * useWaterTracker hook. No business logic, no fetch, no calculations
 * live in this file — everything is delegated.
 *
 * Public surface (default export) is preserved so existing callers
 * `import { WaterTracker } from 'features/water'` keep working.
 */
import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { useWaterTracker } from '../hooks/useWaterTracker';
import WaterGlass from './WaterGlass';
import WaterControls from './WaterControls';
import WaterHistory from './WaterHistory';

export default function WaterTracker({ user, userId }) {
  const vm = useWaterTracker({ user, userId });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
      <WaterGlass
        goalSubtitle={vm.goalSubtitle}
        totalLabel={vm.totalLabel}
        requiredLabel={vm.requiredLabel}
        remainingLabel={vm.remainingLabel}
        progressPercent={vm.progressPercent}
        achieved={vm.achieved}
        hasData={vm.hasData}
        loading={vm.loading}
        onRefresh={vm.refresh}
      />

      {vm.error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{vm.error}</span>
        </div>
      )}
      {vm.saveSuccessLabel && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{vm.saveSuccessLabel}</span>
        </div>
      )}

      <WaterControls
        saving={vm.saving}
        onLog={vm.logWater}
        showCustom={vm.showCustom}
        customMl={vm.customMl}
        onCustomChange={vm.setCustomMl}
        onOpenCustom={vm.openCustom}
        onSubmitCustom={vm.submitCustom}
        onCloseCustom={vm.closeCustom}
      />

      <WaterHistory logs={vm.logs} />

      {vm.loading && !vm.hasData && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-gray-100 rounded-full w-3/4" />
          <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        </div>
      )}
    </div>
  );
}
