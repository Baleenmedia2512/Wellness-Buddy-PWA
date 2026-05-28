/**
 * WeightDashboard.js — slice orchestrator.
 *
 * Wires `useWeightDashboard` to the panel-card layout: header (label +
 * `WeightPanelToggle`), height-animated slide track holding
 * `WeightSummaryCards` and `WeightChart`, dot navigator, history list and
 * the lazy `WeightCardModal`. Both `hideHeader` branches are preserved.
 */
import React, { lazy, Suspense } from 'react';
import { useWeightDashboard } from '../hooks/useWeightDashboard';
import WeightSummaryCards from './WeightSummaryCards';
import WeightChart from './WeightChart';
import WeightHistoryList from './WeightHistoryList';
import { WeightPanelToggle, WeightPanelDots } from './WeightActions';
import '../../../LazyLoadStyles.css';

const WeightCardModal = lazy(() => import('./WeightCardModal'));

const KEYFRAMES = `
  @keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
`;

const LoadingSkeleton = () => (
  <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 animate-pulse overflow-x-hidden">
    <div className="px-4 md:px-6">
      <div className="mb-6 mt-2">
        <div className="w-full h-64 bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5 flex items-end justify-between gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={`bar-${i}`} className="w-full bg-gray-200 rounded-t-lg animate-pulse"
              style={{ height: `${Math.random() * 60 + 20}%` }} />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={`row-${i}`} className="bg-white rounded-xl p-4 flex justify-between items-center shadow-sm border border-gray-100">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ModalFallback = () => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-6 shadow-xl">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-300 border-t-emerald-600" />
    </div>
  </div>
);

const Overview = (vm) => {
  const latestWeight = vm.weightHistory.length > 0 ? vm.weightHistory[0] : null;
  const previousWeight = vm.weightHistory.length > 1 ? vm.weightHistory[1].Weight : null;
  return (
    <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 overflow-x-hidden">
      <div className="px-3 md:px-4">
        <div className="mt-3 md:mt-5 mb-4">
          <div
            className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-md overflow-hidden"
            onPointerDown={vm.onPointerDown}
            onPointerMove={vm.onPointerMove}
            onPointerUp={vm.onPointerEnd}
            onPointerCancel={vm.onPointerEnd}
            onPointerLeave={vm.onPointerEnd}
          >
            <div className="px-4 md:px-5 pt-4 md:pt-5 pb-2 flex items-center justify-between">
              <div className="text-xs md:text-sm text-gray-500">
                {vm.activeWeightPanel === 'summary'
                  ? 'Weight Summary'
                  : `Weight Trend (${vm.weightTrendRangeDays}D)`}
              </div>
              <WeightPanelToggle active={vm.activeWeightPanel} onChange={vm.setActiveWeightPanel} />
            </div>
            <div
              className="overflow-hidden transition-[height] duration-400 ease-out"
              style={vm.weightPanelHeight ? { height: `${vm.weightPanelHeight}px` } : undefined}
            >
              <div
                className="flex items-start w-[200%] transition-transform duration-500 ease-out"
                style={{ transform: vm.activeWeightPanel === 'summary' ? 'translateX(0%)' : 'translateX(-50%)' }}
              >
                <WeightSummaryCards
                  summaryRef={vm.weightSummaryRef}
                  latestWeight={latestWeight}
                  previousWeight={previousWeight}
                  globalStats={vm.globalStats}
                />
                <WeightChart
                  trendRef={vm.weightTrendRef}
                  chartRef={vm.weightTrendChartRef}
                  weightTrendSeries={vm.weightTrendSeries}
                  weightTrendChartWidth={vm.weightTrendChartWidth}
                  weightTrendRangeDays={vm.weightTrendRangeDays}
                  setWeightTrendRangeDays={vm.setWeightTrendRangeDays}
                />
              </div>
            </div>
            <WeightPanelDots active={vm.activeWeightPanel} onSelect={vm.setActiveWeightPanel} />
          </div>
        </div>
        <WeightHistoryList {...vm} user={vm.user} apiBaseUrl={vm.apiBaseUrl} />
      </div>
    </div>
  );
};

const Modal = ({ vm }) => (
  <Suspense fallback={<ModalFallback />}>
    <WeightCardModal
      data={vm.selectedEntry}
      onClose={vm.closeModal}
      onDelete={vm.handleDeleteEntry}
      onUpdate={vm.handleUpdateEntry}
      apiBaseUrl={vm.apiBaseUrl}
      userId={vm.userIdRef.current}
      previousWeight={vm.modalPreviousWeight()}
    />
  </Suspense>
);

const WeightDashboard = ({ user, apiBaseUrl, hideHeader, initialEntryId = null }) => {
  const vm = useWeightDashboard({ user, apiBaseUrl, initialEntryId });
  const view = vm.loading ? <LoadingSkeleton /> : <Overview {...vm} user={user} apiBaseUrl={apiBaseUrl} />;
  const body = (
    <>
      <style>{KEYFRAMES}</style>
      {view}
      {vm.showModal && vm.selectedEntry && <Modal vm={{ ...vm, apiBaseUrl }} />}
    </>
  );
  if (!hideHeader) return <div className="min-h-screen bg-gray-50">{body}</div>;
  return body;
};

export default WeightDashboard;
