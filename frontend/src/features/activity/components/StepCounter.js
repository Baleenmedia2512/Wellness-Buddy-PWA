/**
 * StepCounter.js — page orchestrator (post-refactor).
 *
 * All Capacitor integration, persistence, anti-cheat, GPS, drift detection
 * and DB sync now live in `useStepCounter` + its sub-hooks. This file is a
 * thin presentational shell that destructures the view-model and renders
 * the four section components.
 */
import React from 'react';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import LocationGuard from '../../../shared/components/LocationGuard';
import { useStepCounter } from '../hooks/useStepCounter';
import StepCounterHeader from './StepCounterHeader';
import StepCounterControls from './StepCounterControls';
import StepCounterStats from './StepCounterStats';
import StepCounterChart from './StepCounterChart';

const StepCounter = ({ onBack, userId, userRole = 'user', user }) => {
  const vm = useStepCounter({ userId, user, userRole });

  if (vm.loading && !vm.ready) return <LoadingSpinner context="steps" />;

  return (
    <LocationGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/40">
        <StepCounterHeader
          onBack={onBack}
          isViewingOther={vm.isViewingOther}
          selectedMember={vm.selectedMember}
          refreshing={vm.refreshing}
          refreshDone={vm.refreshDone}
          saving={vm.saving}
          onRefresh={vm.handleManualRefresh}
        />

        <div className="max-w-lg mx-auto px-4 pt-5 pb-8 space-y-4 sm:space-y-5">
          <StepCounterControls
            error={vm.error}
            wrongDateWarning={vm.wrongDateWarning}
            onDismissWrongDate={vm.dismissWrongDate}
            suspiciousActivity={vm.suspiciousActivity}
            onDismissSuspicious={() => vm.setSuspiciousActivity(null)}
            isViewingOther={vm.isViewingOther}
            showPermissionAsk={!vm.isViewingOther && vm.isNativePlatform && vm.sensorAvailable && !vm.permissionGranted}
            onRequestPermission={vm.requestPermission}
          />

          <StepCounterStats
            displaySteps={vm.displaySteps}
            displayCalories={vm.displayCalories}
            displayLoading={vm.displayLoading}
            stepProgress={vm.stepProgress}
            ringOffset={vm.ringOffset}
            progressPct={vm.progressPct}
            reached={vm.reached}
          />

          <StepCounterChart
            historyData={vm.historyData}
            historyView={vm.historyView}
            onHistoryViewChange={vm.setHistoryView}
            displaySteps={vm.displaySteps}
            displayCalories={vm.displayCalories}
          />
        </div>
      </div>
    </LocationGuard>
  );
};

export default StepCounter;
