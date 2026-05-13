/**
 * useWeightDashboard.js — orchestrator hook for the weight dashboard slice.
 *
 * Composes data, undo actions and panel layout, derives memoised view-model
 * pieces (monthly groups, previous-weight map, trend series) and exposes a
 * single object consumed by `WeightDashboard`.
 */
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useWeightHistoryData } from './useWeightHistoryData';
import { useWeightUndoActions } from './useWeightUndoActions';
import {
  buildMonthlyGroups, buildPreviousWeightMap, buildTrendSeries,
} from '../services/weightDashboardFormatter';

export function useWeightDashboard({ user, apiBaseUrl }) {
  const data = useWeightHistoryData({ user, apiBaseUrl });

  const [weightTrendRangeDays, setWeightTrendRangeDays] = useState(7);
  const [activeWeightPanel, setActiveWeightPanel] = useState('summary');
  const [weightPanelHeight, setWeightPanelHeight] = useState(null);
  const [weightTrendChartWidth, setWeightTrendChartWidth] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const weightSummaryRef = useRef(null);
  const weightTrendRef = useRef(null);
  const weightTrendChartRef = useRef(null);
  const weightSwipeRef = useRef({ active: false, startX: 0, lastX: 0 });

  const undo = useWeightUndoActions({
    user,
    apiBaseUrl,
    userIdRef: data.userIdRef,
    setWeightHistory: data.setWeightHistory,
    setSelectedEntry,
  });

  const monthlyGroups = useMemo(
    () => buildMonthlyGroups(data.weightHistory), [data.weightHistory],
  );
  const previousWeightMap = useMemo(
    () => buildPreviousWeightMap(data.weightHistory), [data.weightHistory],
  );
  const weightTrendSeries = useMemo(
    () => buildTrendSeries(data.weightHistory, weightTrendRangeDays),
    [data.weightHistory, weightTrendRangeDays],
  );

  // Panel height auto-fit
  useEffect(() => {
    const update = () => {
      const ref = activeWeightPanel === 'summary' ? weightSummaryRef : weightTrendRef;
      if (ref.current) setWeightPanelHeight(ref.current.scrollHeight);
    };
    const id = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', update); };
  }, [activeWeightPanel, weightTrendSeries, weightTrendRangeDays,
    data.globalStats, data.weightHistory]);

  // Chart width tracking
  useEffect(() => {
    const c = weightTrendChartRef.current;
    if (!c) return undefined;
    const update = () => {
      const w = Math.floor(c.clientWidth || 0);
      setWeightTrendChartWidth((prev) => (prev === w ? prev : w));
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(update); obs.observe(c);
      return () => obs.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [activeWeightPanel, weightTrendRangeDays, weightTrendSeries.length]);

  const onPointerDown = (e) => {
    if (!e.isPrimary) return;
    weightSwipeRef.current = { active: true, startX: e.clientX, lastX: e.clientX };
  };
  const onPointerMove = (e) => {
    if (!weightSwipeRef.current.active || !e.isPrimary) return;
    weightSwipeRef.current.lastX = e.clientX;
  };
  const onPointerEnd = () => {
    const swipe = weightSwipeRef.current;
    if (!swipe.active) return;
    swipe.active = false;
    const dx = swipe.lastX - swipe.startX;
    if (Math.abs(dx) < 36) return;
    setActiveWeightPanel(dx < 0 ? 'trend' : 'summary');
  };

  const handleViewEntry = (entry) => { setSelectedEntry(entry); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSelectedEntry(null); };

  const modalPreviousWeight = () => {
    if (!selectedEntry) return null;
    const idx = data.weightHistory.findIndex((e) => e.ID === selectedEntry.ID);
    const prev = idx > 0 && idx + 1 < data.weightHistory.length
      ? data.weightHistory[idx + 1] : null;
    return prev && prev.Weight ? prev.Weight : null;
  };

  return {
    ...data,
    monthlyGroups, previousWeightMap, weightTrendSeries,
    weightTrendRangeDays, setWeightTrendRangeDays,
    activeWeightPanel, setActiveWeightPanel,
    weightPanelHeight, weightTrendChartWidth,
    weightSummaryRef, weightTrendRef, weightTrendChartRef,
    selectedEntry, showModal,
    onPointerDown, onPointerMove, onPointerEnd,
    handleViewEntry, closeModal, modalPreviousWeight,
    ...undo,
  };
}
