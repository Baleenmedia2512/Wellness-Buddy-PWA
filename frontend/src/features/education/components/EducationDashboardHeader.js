/**
 * EducationDashboardHeader.js — swipeable summary/trend panel.
 *
 * Hosts the swipe gesture, the active-panel toggle and the animated
 * height transition. Renders the two slides as a horizontal carousel.
 */
import React, { useEffect, useRef, useState } from 'react';
import EducationSummaryCards from './EducationSummaryCards';
import EducationTrendPanel from './EducationTrendPanel';

const PanelToggle = ({ active, label, onClick }) => (
  <button type="button" onClick={onClick}
    className={`px-2 py-0.5 text-[10px] rounded-full transition-all duration-300 ${
      active ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
    }`}>{label}</button>
);

const SlideDot = ({ active, label, onClick }) => (
  <button type="button" aria-label={label} onClick={onClick}
    className={`h-1.5 rounded-full transition-all duration-300 ${
      active ? 'w-6 bg-emerald-500' : 'w-2.5 bg-gray-300'
    }`} />
);

const EducationDashboardHeader = ({
  summary, summaryLoading, educationLogs,
  trendSeries, trendRangeDays, setTrendRangeDays,
}) => {
  const [active, setActive] = useState('summary');
  const [panelHeight, setPanelHeight] = useState(null);
  const swipeRef = useRef({ active: false, startX: 0, lastX: 0 });
  const summaryRef = useRef(null);
  const trendRef = useRef(null);

  const onPointerDown = (e) => {
    if (!e.isPrimary) return;
    swipeRef.current = { active: true, startX: e.clientX, lastX: e.clientX };
  };
  const onPointerMove = (e) => {
    if (!swipeRef.current.active || !e.isPrimary) return;
    swipeRef.current.lastX = e.clientX;
  };
  const onPointerEnd = () => {
    const s = swipeRef.current;
    if (!s.active) return;
    s.active = false;
    const dx = s.lastX - s.startX;
    if (Math.abs(dx) < 36) return;
    setActive(dx < 0 ? 'trend' : 'summary');
  };

  useEffect(() => {
    const measure = () => {
      const ref = active === 'summary' ? summaryRef : trendRef;
      if (ref.current) setPanelHeight(ref.current.scrollHeight);
    };
    const id = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', measure); };
  }, [active, summaryLoading, summary, educationLogs, trendSeries, trendRangeDays]);

  return (
    <div className="mt-3 md:mt-5 mb-4">
      <div
        className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onPointerLeave={onPointerEnd}
      >
        <div className="px-4 md:px-5 pt-4 md:pt-5 pb-2 flex items-center justify-between">
          <div className="text-xs md:text-sm text-gray-500">
            {active === 'summary' ? 'Education Summary' : `Education Trend (${trendRangeDays}D)`}
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
            <PanelToggle active={active === 'summary'} label="Summary" onClick={() => setActive('summary')} />
            <PanelToggle active={active === 'trend'} label="Trend" onClick={() => setActive('trend')} />
          </div>
        </div>

        <div className="overflow-hidden transition-[height] duration-400 ease-out"
          style={panelHeight ? { height: `${panelHeight}px` } : undefined}>
          <div className="flex items-start w-[200%] transition-transform duration-500 ease-out"
            style={{ transform: active === 'summary' ? 'translateX(0%)' : 'translateX(-50%)' }}>
            <EducationSummaryCards ref={summaryRef}
              summary={summary} summaryLoading={summaryLoading} educationLogs={educationLogs} />
            <EducationTrendPanel ref={trendRef}
              series={trendSeries} rangeDays={trendRangeDays} onRangeChange={setTrendRangeDays} />
          </div>
        </div>

        <div className="pb-3 md:pb-4 flex items-center justify-center gap-2">
          <SlideDot active={active === 'summary'} label="Go to education summary slide" onClick={() => setActive('summary')} />
          <SlideDot active={active === 'trend'} label="Go to education trend slide" onClick={() => setActive('trend')} />
        </div>
      </div>
    </div>
  );
};

export default EducationDashboardHeader;
