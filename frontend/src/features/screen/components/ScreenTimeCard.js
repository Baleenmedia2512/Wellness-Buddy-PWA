/**
 * ScreenTimeCard.js — orchestrator.
 *
 * Composes presentational sub-components with the data + permission +
 * metrics hooks. Contains no math or async logic of its own.
 */
import React, { useState } from 'react';
import { Smartphone, RefreshCw } from 'lucide-react';
import { useScreenPermission } from '../hooks/useScreenPermission';
import { useScreenTimeData } from '../hooks/useScreenTimeData';
import { useScreenMetrics } from '../hooks/useScreenMetrics';
import ScreenUsageSummary from './ScreenUsageSummary';
import ScreenUsageChart from './ScreenUsageChart';
import ScreenAppBreakdown from './ScreenAppBreakdown';
import {
  ScreenTimeWebFallback, ScreenPermissionGate, ScreenTimeLoading,
} from './ScreenTimeStates';

const ScreenTimeCard = ({ userId }) => {
  const permission = useScreenPermission();
  const data = useScreenTimeData({
    userId,
    isNative: permission.isNative,
    permissionGranted: permission.granted,
  });
  const metrics = useScreenMetrics({
    todayData: data.todayData,
    historyData: data.historyData,
    selectedPeriod: data.selectedPeriod,
  });

  const [showAppBreakdown, setShowAppBreakdown] = useState(false);

  if (!permission.isNative) return <ScreenTimeWebFallback />;
  if (permission.checked && !permission.granted) {
    return <ScreenPermissionGate issue={permission.issue} onRequest={permission.request} />;
  }
  if (data.isLoading) return <ScreenTimeLoading />;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-800">Screen Time</h3>
        </div>
        <button
          onClick={data.refresh}
          disabled={data.isRefreshing}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${data.isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {data.error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-600">{data.error}</p>
        </div>
      )}

      <ScreenUsageSummary
        todaySeconds={metrics.todaySeconds}
        avgSeconds={metrics.avgSeconds}
        selectedPeriod={data.selectedPeriod}
        onPeriodChange={data.setSelectedPeriod}
      />

      {metrics.hasChart && <ScreenUsageChart bars={metrics.chartBars} />}

      <ScreenAppBreakdown
        appUsage={metrics.appUsage}
        trackedApps={metrics.trackedApps}
        otherApps={metrics.otherApps}
        totalSeconds={metrics.todaySeconds}
        isOpen={showAppBreakdown}
        onToggle={() => setShowAppBreakdown((v) => !v)}
      />
    </div>
  );
};

export default ScreenTimeCard;
