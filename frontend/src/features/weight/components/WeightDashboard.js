// src/components/WeightDashboard.js
import React, { useState, useEffect, useMemo, lazy, Suspense, useRef, useCallback } from 'react';
import { 
  Scale,
  RotateCcw,
  Calendar,
  TrendingUp,
  TrendingDown, 
  Minus,
  ScaleIcon,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { getUserId } from '../../../services/getUserId';
import { istToLocalDate, formatISTToLocalDate } from '../../../utils/timezoneUtils';
import '../../../LazyLoadStyles.css';

// ✅ LAZY LOADING: Load heavy components only when needed
const WeightCard = lazy(() => import('./WeightCard'));
const WeightCardModal = lazy(() => import('./WeightCardModal'));

const UNDO_SECONDS = 10; // undo countdown duration

/**
//  * ✅ PERFORMANCE: LazyLoadWrapper - Only render children when visible in viewport
 */
const LazyLoadWrapper = ({ children, fallback, rootMargin = '100px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Once visible, stop observing
        }
      },
      { rootMargin, threshold: 0 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
};

/**
 * UndoRow - Inline undo component with countdown
 */
const UndoRow = ({ pid, originalEntry, expiresAt, ttlSeconds = UNDO_SECONDS, onRestore, onExpire }) => {
  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState(false);

  // Update countdown text every 250ms
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  // Freeze animation config at mount
  const { total, delayAtMount } = useMemo(() => {
    const total = Math.max(0, ttlSeconds);
    const startedAt = expiresAt - total * 1000;
    const elapsedAtMount = Math.min(total, Math.max(0, (Date.now() - startedAt) / 1000));
    return { total, delayAtMount: -elapsedAtMount };
  }, [expiresAt, ttlSeconds]);

  // Expire precisely at expiresAt
  useEffect(() => {
    const msLeft = Math.max(0, expiresAt - Date.now());
    const t = setTimeout(() => {
      onExpire();
    }, msLeft);
    return () => clearTimeout(t);
  }, [expiresAt, onExpire]);

  const remainingSecs = Math.ceil(Math.max(0, expiresAt - now) / 1000);
  // const weightDisplay = originalEntry?.Weight ? `${originalEntry.Weight} kg` : 'Weight';
  const weightDisplay = originalEntry?.Weight ? `${originalEntry.Weight} kg` : 'Weight';

  return (
    <div className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm" style={{ height: 84 }}>
      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><circle cx="12" cy="12" r="3" /></svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">Removed weight:</span> {weightDisplay}
        </p>
        <p className="text-[11px] text-amber-700/80">Undo available for {remainingSecs}s</p>
      </div>

      <button
        disabled={undoing}
        onClick={async () => {
          if (undoing) return;
          setUndoing(true);
          await onRestore(pid, originalEntry);
          setUndoing(false);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-sm font-medium
          ${undoing ? 'text-amber-500 bg-amber-50 cursor-not-allowed' : 'text-amber-800 hover:bg-amber-100/60 active:scale-95 transition'}`}
      >
        {undoing ? (
          <>
            <span className="inline-block h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            Restoring…
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4" />
            Undo
          </>
        )}
      </button>

      {/* Animated countdown progress bar */}
      <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200/70 overflow-hidden rounded-b-xl">
        <span
          key={pid}
          className="block h-full bg-amber-600 origin-left will-change-transform"
          style={{
            transformOrigin: 'left',
            animation: `countdown-shrink ${total}s linear ${delayAtMount}s forwards`
          }}
        />
      </span>
    </div>
  );
};

/**
 * Weight Dashboard - Unified component for weight tracking and insights
 * Monthly view with month-wise categorization
 */
const WeightDashboard = ({ user, apiBaseUrl, hideHeader }) => {
  const isIOS = Capacitor.getPlatform() === 'ios';
  // Weight history states
  const [weightHistory, setWeightHistory] = useState([]);
  const [globalStats, setGlobalStats] = useState(null); // Global min/max from ALL data
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null); // eslint-disable-line no-unused-vars
  const [weightTrendRangeDays, setWeightTrendRangeDays] = useState(7);
  const [activeWeightPanel, setActiveWeightPanel] = useState('summary');
  const [weightPanelHeight, setWeightPanelHeight] = useState(null);
  const [weightTrendChartWidth, setWeightTrendChartWidth] = useState(0);

  // UI state - viewMode fixed to 'overview' since camera was removed
  const [viewMode] = useState('overview');

  // Modal and delete states
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Profile display
  const [savedUserName, setSavedUserName] = useState(null);
  const [savedProfileImage, setSavedProfileImage] = useState(null);
  
  // Undo placeholders: key -> { originalEntry, expiresAt, ttlSeconds }
  const [undoState, setUndoState] = useState({});

  // ✅ CACHE: Store userId to avoid repeated lookups
  const userIdRef = useRef(null);
  const weightSwipeRef = useRef({ active: false, startX: 0, lastX: 0 });
  const weightSummaryRef = useRef(null);
  const weightTrendRef = useRef(null);
  const weightTrendChartRef = useRef(null);

  /**
   * ✅ MEMOIZED: Group weight entries by month
   * Note: Placeholders are handled separately in the render logic
   */
  const monthlyGroups = useMemo(() => {
    const grouped = {};
    
    // console.log('📊 Processing weightHistory:', weightHistory.length, 'entries');
    
    // Process all entries including placeholders
    weightHistory.forEach(entry => {
      // Skip invalid entries but allow placeholders
      if (!entry || !entry.CreatedAt || !entry.Weight) return;
      
      // Convert IST to user's local time
      const date = istToLocalDate(entry.CreatedAt);
      // Check if date is valid
      if (!date || isNaN(date.getTime())) return;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey, // Store the key for proper sorting
          monthName,
          entries: [],
          // Use first day of month for consistent sorting
          sortDate: new Date(date.getFullYear(), date.getMonth(), 1)
        };
      }
      
      // Include both regular entries and placeholders
      grouped[monthKey].entries.push(entry);
    });
    
    // Sort months in descending order (most recent first) using sortDate
    const result = Object.values(grouped).sort((a, b) => b.sortDate - a.sortDate);
    // console.log('📊 Monthly groups:', result.map(g => ({ month: g.monthName, count: g.entries.length })));
    return result;
  }, [weightHistory]);

  /**
   * ✅ MEMOIZED: Pre-compute previous weight map for O(1) lookup
   */
  const previousWeightMap = useMemo(() => {
    const map = new Map();
    const sorted = weightHistory
      .filter(e => e && !e.isUndoPlaceholder && e.Weight && e.CreatedAt)
      .sort((a, b) => {
        const dateA = istToLocalDate(a.CreatedAt);
        const dateB = istToLocalDate(b.CreatedAt);
        return dateB - dateA;
      });
    
    for (let i = 0; i < sorted.length; i++) {
      const prevEntry = i < sorted.length - 1 ? sorted[i + 1] : null;
      map.set(sorted[i].ID, prevEntry ? prevEntry.Weight : null);
    }
    return map;
  }, [weightHistory]);

  /**
   * Calculate month statistics
   */
  const getMonthStats = (entries) => {
    if (!entries || entries.length === 0) return null;
    
    // Filter out invalid entries
    const validEntries = entries.filter(e => e && e.Weight && !isNaN(parseFloat(e.Weight)));
    if (validEntries.length === 0) return null;
    
    const weights = validEntries.map(e => parseFloat(e.Weight));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const avgWeight = (totalWeight / weights.length).toFixed(1);
    const minWeight = Math.min(...weights).toFixed(1);
    const maxWeight = Math.max(...weights).toFixed(1);
    
    // Calculate weight change (first entry vs last entry)
    const firstEntry = validEntries[validEntries.length - 1];
    const lastEntry = validEntries[0];
    const weightChange = (parseFloat(lastEntry.Weight) - parseFloat(firstEntry.Weight)).toFixed(1);
    
    return {
      avgWeight,
      minWeight,
      maxWeight,
      weightChange,
      count: validEntries.length
    };
  };

  const toDateKey = (value) => {
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const isSmallChartDevice = () =>
    typeof window !== 'undefined' && window.innerWidth < 380;

  const weightTrendSeries = useMemo(() => {
    const sorted = (weightHistory || [])
      .filter((entry) => entry && !entry.isUndoPlaceholder && entry.CreatedAt && entry.Weight)
      .map((entry) => ({
        createdAt: istToLocalDate(entry.CreatedAt),
        weight: Number.parseFloat(entry.Weight),
      }))
      .filter((entry) => !Number.isNaN(entry.createdAt.getTime()) && Number.isFinite(entry.weight))
      .sort((a, b) => a.createdAt - b.createdAt);

    if (sorted.length === 0) return [];

    const latestByDate = new Map();
    sorted.forEach((entry) => {
      latestByDate.set(toDateKey(entry.createdAt), entry.weight);
    });

    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - (weightTrendRangeDays - 1));

    const startKey = toDateKey(start);
    const firstKnownInRange = Array.from(latestByDate.entries())
      .filter(([key]) => key >= startKey)
      .sort((a, b) => a[0].localeCompare(b[0]))[0]?.[1];

    let lastKnownWeight = sorted
      .filter((entry) => toDateKey(entry.createdAt) <= startKey)
      .slice(-1)[0]?.weight;

    if (!Number.isFinite(lastKnownWeight)) {
      lastKnownWeight = firstKnownInRange;
    }

    const points = [];
    for (let i = 0; i < weightTrendRangeDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toDateKey(d);
      const hasRecorded = latestByDate.has(key);

      if (hasRecorded) {
        lastKnownWeight = latestByDate.get(key);
      }

      points.push({
        key,
        date: d,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        compactLabel: `${d.toLocaleDateString('en-US', { month: 'short' }).slice(0, 1)} ${d.toLocaleDateString('en-US', { day: 'numeric' })}`,
        hasRecorded,
        value: Number.isFinite(lastKnownWeight) ? lastKnownWeight : null,
      });
    }

    return points;
  }, [weightHistory, weightTrendRangeDays]);

  const handleWeightPanelPointerDown = (e) => {
    if (!e.isPrimary) return;
    weightSwipeRef.current.active = true;
    weightSwipeRef.current.startX = e.clientX;
    weightSwipeRef.current.lastX = e.clientX;
  };

  const handleWeightPanelPointerMove = (e) => {
    if (!weightSwipeRef.current.active || !e.isPrimary) return;
    weightSwipeRef.current.lastX = e.clientX;
  };

  const handleWeightPanelPointerEnd = () => {
    const swipe = weightSwipeRef.current;
    if (!swipe.active) return;
    swipe.active = false;

    const deltaX = swipe.lastX - swipe.startX;
    if (Math.abs(deltaX) < 36) return;
    if (deltaX < 0) {
      setActiveWeightPanel('trend');
    } else {
      setActiveWeightPanel('summary');
    }
  };

  useEffect(() => {
    const updateWeightPanelHeight = () => {
      const activeRef = activeWeightPanel === 'summary' ? weightSummaryRef : weightTrendRef;
      if (activeRef.current) {
        setWeightPanelHeight(activeRef.current.scrollHeight);
      }
    };

    const rafId = requestAnimationFrame(updateWeightPanelHeight);
    window.addEventListener('resize', updateWeightPanelHeight);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateWeightPanelHeight);
    };
  }, [activeWeightPanel, weightTrendSeries, weightTrendRangeDays, globalStats, weightHistory]);

  useEffect(() => {
    const container = weightTrendChartRef.current;
    if (!container) return;

    const updateChartWidth = () => {
      const nextWidth = Math.floor(container.clientWidth || 0);
      setWeightTrendChartWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateChartWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateChartWidth);
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateChartWidth);
    return () => window.removeEventListener('resize', updateChartWidth);
  }, [activeWeightPanel, weightTrendRangeDays, weightTrendSeries.length]);

  // Fetch saved user profile (name + photo) once when user changes
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.email) return;
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(user.email)}&_t=${Date.now()}`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }
        );
        if (response.ok) {
          const d = await response.json();
          if (d.success && d.data) {
            if (d.data.userName) setSavedUserName(d.data.userName);
            if (d.data.profileImage) setSavedProfileImage(d.data.profileImage);
          }
        }
      } catch (err) {
        console.error('Error fetching profile for WeightDashboard:', err);
      }
    };
    fetchProfile();
  }, [user?.email, apiBaseUrl]);

  /**
   * Fetch ALL weight history on mount and when user changes
   */
  useEffect(() => {
    // Clear cached userId when user changes
    userIdRef.current = null;
    fetchWeightHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email]);

  /**
   * Fetch ALL weight history (no pagination)
   */
  const fetchWeightHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use cached userId or fetch once
      if (!userIdRef.current) {
        userIdRef.current = user?.id || await getUserId(user);
      }
      const userId = userIdRef.current;
      
      if (!userId) {
        throw new Error('User not authenticated or not found in database');
      }
      
      // Include images so they display in the weight cards
      const params = new URLSearchParams({ 
        userId, 
        includeImage: 'true',
        _t: Date.now() 
      });
      
      const response = await fetch(`${apiBaseUrl}/api/weight/history?${params}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch weight history');
      }

      // Set all weight history data
      // console.log('📊 Weight history loaded:', data.data?.length, 'entries');
      // console.log('📊 Sample entries:', data.data?.slice(0, 3));
      setWeightHistory(data.data || []);
      setGlobalStats(data.stats || null);

    } catch (err) {
      console.error('❌ Fetch weight history error:', err);
      setError(err.message || 'Failed to load weight history');
    } finally {
      setLoading(false);
    }
  };

  // Camera functionality removed - images are processed from main page upload

  /**
   * Handle view weight entry in modal
   */
  const handleViewEntry = (entry) => {
    setSelectedEntry(entry);
    setShowModal(true);
  };

  /**
   * Handle delete with immediate backend soft-delete (like nutrition tab)
   * Allows undo via restore API within timer window
   */
  const handleDeleteEntry = async (entryToDelete) => {
    const placeholder = {
      ID: `undo-${entryToDelete.ID}`,
      isUndoPlaceholder: true,
      CreatedAt: entryToDelete.CreatedAt,
      Weight: entryToDelete.Weight
    };

    // Replace entry in-place with placeholder (no flicker)
    setWeightHistory(prev => {
      const idx = prev.findIndex(e => e.ID === entryToDelete.ID);
      if (idx === -1) return prev;
      const next = prev.slice();
      next.splice(idx, 1, placeholder);
      return next;
    });

    // Store undo state
    setUndoState(prev => ({
      ...prev,
      [placeholder.ID]: {
        originalEntry: entryToDelete,
        expiresAt: Date.now() + UNDO_SECONDS * 1000,
        ttlSeconds: UNDO_SECONDS
      }
    }));

    // Immediately soft-delete in backend (like nutrition tab)
    try {
      const userId = userIdRef.current || user?.id;
      
      const response = await fetch(`${apiBaseUrl}/api/weight/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId,
          entryId: entryToDelete.ID
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete entry');
      }

      // console.log('✅ Entry soft-deleted immediately:', entryToDelete.ID);

    } catch (err) {
      console.error('❌ Delete error:', err);
      // Rollback on backend failure
      setWeightHistory(prev => {
        const idx = prev.findIndex(e => e.ID === placeholder.ID);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, entryToDelete);
        return next;
      });
      setUndoState(prev => {
        const next = { ...prev };
        delete next[placeholder.ID];
        return next;
      });
      alert(err.message || 'Failed to delete. Please try again.');
    }
  };

  /**
   * Handle undo restore - called when user clicks Undo button
   */
  const handleUndoRestore = async (pid, originalEntry) => {
    // Optimistic restore - replace placeholder with original entry
    setWeightHistory(prev => {
      const idx = prev.findIndex(e => e.ID === pid);
      if (idx === -1) return prev.concat(originalEntry);
      const next = prev.slice();
      next.splice(idx, 1, originalEntry);
      return next;
    });
    setUndoState(prev => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });

    // Call backend undo API to restore entry
    try {
      const userId = userIdRef.current || user?.id;
      
      const response = await fetch(`${apiBaseUrl}/api/weight/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: originalEntry.ID,
          userId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to restore entry');
      }

      // console.log('✅ Entry restored via API:', originalEntry.ID);

    } catch (err) {
      console.error('❌ Undo restore error:', err);
      // Rollback on backend failure - put placeholder back
      setWeightHistory(prev => {
        const idx = prev.findIndex(e => e.ID === originalEntry.ID);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, { 
          ID: pid, 
          isUndoPlaceholder: true, 
          CreatedAt: originalEntry.CreatedAt,
          Weight: originalEntry.Weight
        });
        return next;
      });
      setUndoState(prev => ({
        ...prev,
        [pid]: {
          originalEntry,
          expiresAt: Date.now() + UNDO_SECONDS * 1000,
          ttlSeconds: UNDO_SECONDS
        }
      }));
      alert(err.message || 'Failed to restore. Please try again.');
    }
  };

  /**
   * Handle weight edit/update - updates both backend and local state
   */
  const handleUpdateEntry = async (entryId, newWeight) => {
    const userId = userIdRef.current || user?.id;
    const response = await fetch(`${apiBaseUrl}/api/weight/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, entryId, weightValue: newWeight })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update weight');
    }
    // Update local weight history
    setWeightHistory(prev =>
      prev.map(e => String(e.ID ?? e.id) === String(entryId) ? { ...e, Weight: String(newWeight) } : e)
    );
    // Keep modal in sync
    setSelectedEntry(prev =>
      prev && String(prev.ID ?? prev.id) === String(entryId) ? { ...prev, Weight: String(newWeight) } : prev
    );
  };

  /**
   * Handle undo expiration - called when timer runs out
   * Just remove placeholder (backend already deleted)
   */
  const handleUndoExpire = async (pid, originalEntry) => {
    // Remove placeholder from UI
    setWeightHistory(prev => prev.filter(e => e.ID !== pid));
    setUndoState(prev => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });

    // console.log('⏱️ Undo timer expired, entry remains deleted:', originalEntry.ID);
  };

  // Weight saving removed - entries are added via main page image upload

  /**
   * Render overview mode
   */
  const renderOverview = () => {
    if (loading) {
      return (
        <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 animate-pulse overflow-x-hidden">
          <div className="px-4 md:px-6">
            {/* Chart Skeleton */}
            <div className="mb-6 mt-2">
              <div className="w-full h-64 bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5 flex items-end justify-between gap-2">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="w-full bg-gray-200 rounded-t-lg animate-pulse" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
                ))}
              </div>
            </div>

            {/* List Skeletons */}
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-4 flex justify-between items-center shadow-sm border border-gray-100">
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Get latest weight entry
    const latestWeight = weightHistory.length > 0 ? weightHistory[0] : null;
    const previousWeight = weightHistory.length > 1 ? weightHistory[1].Weight : null;
    
    // Get current month's entries for statistics
    const currentMonthEntries = monthlyGroups.length > 0 ? monthlyGroups[0].entries : [];
    const currentMonthStats = getMonthStats(currentMonthEntries);

    return (
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 overflow-x-hidden">
        <div className="px-3 md:px-4">


          {/* Current Month Header */}
          {/* <div className="mt-5 mb-6"> */}
            {/* <div className="flex items-rigth justify-between"> */}
              {/* <div>
                <h2 className="text-2xl font-bold text-gray-800">{currentMonth}</h2>
                <p className="text-sm text-gray-500 mt-1">Weight tracking history</p>
              </div> */}
              {/* <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full p-3">
                <Scale className="w-6 h-6 text-white" />
              </div> */}
            {/* </div> */}
          {/* </div> */}

          <div className="mt-3 md:mt-5 mb-4">
            <div
              className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-md overflow-hidden"
              onPointerDown={handleWeightPanelPointerDown}
              onPointerMove={handleWeightPanelPointerMove}
              onPointerUp={handleWeightPanelPointerEnd}
              onPointerCancel={handleWeightPanelPointerEnd}
              onPointerLeave={handleWeightPanelPointerEnd}
            >
              <div className="px-4 md:px-5 pt-4 md:pt-5 pb-2 flex items-center justify-between">
                <div className="text-xs md:text-sm text-gray-500">
                  {activeWeightPanel === 'summary' ? 'Weight Summary' : `Weight Trend (${weightTrendRangeDays}D)`}
                </div>
                <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                  <button
                    type="button"
                    onClick={() => setActiveWeightPanel('summary')}
                    className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                      activeWeightPanel === 'summary'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-white'
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveWeightPanel('trend')}
                    className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                      activeWeightPanel === 'trend'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-white'
                    }`}
                  >
                    Trend
                  </button>
                </div>
              </div>

              <div
                className="overflow-hidden transition-[height] duration-400 ease-out"
                style={weightPanelHeight ? { height: `${weightPanelHeight}px` } : undefined}
              >
                <div
                  className="flex items-start w-[200%] transition-transform duration-500 ease-out"
                  style={{ transform: activeWeightPanel === 'summary' ? 'translateX(0%)' : 'translateX(-50%)' }}
                >
                  <div ref={weightSummaryRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5 text-black">
                    <div className="flex items-start justify-between mb-4 md:mb-5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] xs:text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Current Weight</p>
                        <div className="flex items-baseline flex-wrap">
                          <span className="text-xl xs:text-2xl sm:text-3xl font-bold text-black">{latestWeight ? latestWeight.Weight : '-'}</span>
                          <span className="text-xs xs:text-sm sm:text-base font-normal ml-0.5 sm:ml-1 text-gray-600">kg</span>
                        </div>
                        <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5 sm:mt-1">
                          {latestWeight
                            ? istToLocalDate(latestWeight.CreatedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : new Date().toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                        </p>
                      </div>

                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-[10px] xs:text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Previous Weight</p>
                        <div className="flex items-baseline justify-end flex-wrap">
                          <span className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-500">{previousWeight !== null ? previousWeight : '-'}</span>
                          <span className="text-xs xs:text-sm sm:text-base font-normal ml-0.5 sm:ml-1 text-gray-600">kg</span>
                        </div>
                        {latestWeight && previousWeight !== null ? (
                          (() => {
                            const diff = (parseFloat(latestWeight.Weight) - parseFloat(previousWeight)).toFixed(2);
                            const diffNum = parseFloat(diff);
                            if (diffNum > 0) {
                              return (
                                <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-red-500 font-medium mt-0.5 sm:mt-1">
                                  <TrendingUp className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                                  +{diff} kg
                                </p>
                              );
                            } else if (diffNum < 0) {
                              return (
                                <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-green-600 font-medium mt-0.5 sm:mt-1">
                                  <TrendingDown className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                                  {diff} kg
                                </p>
                              );
                            }
                            return (
                              <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-gray-500 font-medium mt-0.5 sm:mt-1">
                                <Minus className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                                0.00 kg
                              </p>
                            );
                          })()
                        ) : (
                          <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-gray-400 font-medium mt-0.5 sm:mt-1">
                            <Minus className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                            - kg
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4">
                      <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 text-center border border-white/40">
                        <p className="text-[10px] xs:text-xs text-gray-600 mb-0.5 sm:mb-1">Lowest</p>
                        <p className="text-lg xs:text-xl font-bold text-gray-900">
                          {globalStats?.minWeight !== null && globalStats?.minWeight !== undefined
                            ? globalStats.minWeight.toFixed(1)
                            : '-'}
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-500">kg</p>
                        {globalStats?.minWeight !== null && globalStats?.minWeight !== undefined ? (
                          <TrendingDown className="w-3 h-3 xs:w-4 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-green-600" />
                        ) : (
                          <Minus className="w-4 h-3 xs:w-5 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-gray-400" />
                        )}
                      </div>

                      <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 text-center border border-white/40">
                        <p className="text-[10px] xs:text-xs text-gray-600 mb-0.5 sm:mb-1">Highest</p>
                        <p className="text-lg xs:text-xl font-bold text-gray-900">
                          {globalStats?.maxWeight !== null && globalStats?.maxWeight !== undefined
                            ? globalStats.maxWeight.toFixed(1)
                            : '-'}
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-500">kg</p>
                        {globalStats?.maxWeight !== null && globalStats?.maxWeight !== undefined ? (
                          <TrendingUp className="w-3 h-3 xs:w-4 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-red-500" />
                        ) : (
                          <Minus className="w-4 h-3 xs:w-5 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div ref={weightTrendRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5">
                    {(() => {
                      const numericValues = weightTrendSeries
                        .map((point) => point.value)
                        .filter((value) => Number.isFinite(value));
                      const latestValue = numericValues.length
                        ? numericValues[numericValues.length - 1]
                        : null;
                      const firstValue = numericValues.length ? numericValues[0] : null;
                      const avgValue = numericValues.length
                        ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
                        : null;
                      const deltaValue =
                        Number.isFinite(latestValue) && Number.isFinite(firstValue)
                          ? latestValue - firstValue
                          : null;
                      const trendStatus =
                        deltaValue === null || Math.abs(deltaValue) < 0.05
                          ? { label: 'Stable', className: 'bg-slate-50 text-slate-700' }
                          : deltaValue > 0
                            ? { label: 'Trending Up', className: 'bg-rose-50 text-rose-700' }
                            : { label: 'Trending Down', className: 'bg-emerald-50 text-emerald-700' };

                      return (
                        <>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs md:text-sm text-gray-500">Weight Trend</p>
                        <p className="text-sm md:text-base font-semibold text-gray-900">Last {weightTrendRangeDays} days</p>
                      </div>
                      <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                        {[7, 14, 30].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setWeightTrendRangeDays(days)}
                            className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                              weightTrendRangeDays === days
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-white'
                            }`}
                          >
                            {days}D
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                      <div className="rounded-lg bg-sky-50 px-2 py-1.5">
                        <p className="text-[10px] text-sky-700">Average</p>
                        <p className="text-xs md:text-sm font-semibold text-sky-900">
                          {Number.isFinite(avgValue) ? avgValue.toFixed(1) : '-'} kg
                        </p>
                      </div>
                      <div className={`rounded-lg px-2 py-1.5 ${trendStatus.className}`}>
                        <p className="text-[10px]">Direction</p>
                        <p className="text-xs md:text-sm font-semibold">{trendStatus.label}</p>
                      </div>
                      <div className="rounded-lg bg-indigo-50 px-2 py-1.5">
                        <p className="text-[10px] text-indigo-700">Net Change</p>
                        <p className="text-xs md:text-sm font-semibold text-indigo-900">
                          {Number.isFinite(deltaValue)
                            ? `${deltaValue > 0 ? '+' : ''}${deltaValue.toFixed(1)} kg`
                            : '-'}
                        </p>
                      </div>
                    </div>

                    {weightTrendSeries.filter((point) => Number.isFinite(point.value)).length === 0 ? (
                      <div className="h-36 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500">
                        No weight trend data
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const chartWidth = Math.max(weightTrendChartWidth, 1);
                          const chartHeight = 132;
                          const numericValues = weightTrendSeries
                            .map((point) => point.value)
                            .filter((value) => Number.isFinite(value));
                          const maxValue = Math.max(...numericValues);
                          const minValue = Math.min(...numericValues);
                          const spread = Math.max(maxValue - minValue, 0.5);
                          const plotLeft = 30;
                          const plotRight = 14;
                          const plotTopPad = 8;
                          const plotBottomPad = 10;
                          const plottableHeight = chartHeight - plotTopPad - plotBottomPad;
                          const stepX =
                            weightTrendSeries.length > 1
                              ? (chartWidth - plotLeft - plotRight) / (weightTrendSeries.length - 1)
                              : 0;

                          const points = weightTrendSeries.map((point, index) => {
                            const hasValue = Number.isFinite(point.value);
                            const value = hasValue ? point.value : null;
                            const x = plotLeft + index * stepX;
                            const y = hasValue
                              ? plotTopPad + plottableHeight - ((value - minValue) / spread) * plottableHeight
                              : null;
                            return { ...point, value, hasValue, x, y };
                          });

                          const axisLevels = [maxValue, minValue + spread / 2, minValue]
                            .map((value) => Number(value.toFixed(1)));

                          const markerCountTarget = Math.min(7, points.length);
                          const sampledMarkerIndices = new Set(
                            (() => {
                              if (markerCountTarget <= 1) return [points.length - 1];
                              if (points.length <= markerCountTarget) {
                                return Array.from({ length: points.length }, (_, i) => i);
                              }

                              // Evenly sample and always include first/last to avoid side gaps.
                              return Array.from(
                                { length: markerCountTarget },
                                (_, i) => Math.round((i * (points.length - 1)) / (markerCountTarget - 1))
                              );
                            })()
                          );
                          const sampledIndices = Array.from(sampledMarkerIndices).sort((a, b) => a - b);
                          const dateLabelIndices = new Set(sampledIndices);
                          const orderedDateLabelIndices = Array.from(dateLabelIndices).sort((a, b) => a - b);

                          const shouldRenderMarker = (point, index) => {
                            if (!point.hasValue) return false;
                            return sampledMarkerIndices.has(index);
                          };

                          const firstVisibleIndex = points.findIndex((point, index) => shouldRenderMarker(point, index));
                          const lastVisibleIndex = (() => {
                            for (let i = points.length - 1; i >= 0; i--) {
                              if (shouldRenderMarker(points[i], i)) return i;
                            }
                            return -1;
                          })();
                          const firstDateLabelIndex = orderedDateLabelIndices[0] ?? -1;
                          const lastDateLabelIndex =
                            orderedDateLabelIndices[orderedDateLabelIndices.length - 1] ?? -1;

                          const renderIndices = sampledIndices;
                          const plottedPoints = renderIndices
                            .map((index) => points[index])
                            .filter((point) => point.hasValue);
                          const linePath = plottedPoints
                            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
                            .join(' ');

                          return (
                            <div ref={weightTrendChartRef} className="w-full overflow-hidden pb-1">
                              <svg
                                viewBox={`0 -24 ${chartWidth} ${chartHeight + 52}`}
                                className="block"
                                style={{
                                  width: '100%',
                                  height: `${chartHeight + 52}px`,
                                  overflow: 'visible'
                                }}
                                preserveAspectRatio="none"
                              >
                                <defs>
                                  <linearGradient id="weightTrendArea" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#16a34a" stopOpacity="0.16" />
                                    <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
                                  </linearGradient>
                                </defs>

                                <path
                                  d={linePath}
                                  fill="none"
                                  stroke="#16a34a"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                {points.map((point, index) => {
                                  if (!shouldRenderMarker(point, index)) return null;
                                  if (!point.hasValue) return null;

                                  return (
                                    <circle
                                      key={`weight-point-${point.key}`}
                                      cx={point.x}
                                      cy={point.y}
                                      r={isSmallChartDevice() ? 2.8 : 3.4}
                                      fill={point.hasRecorded ? '#16a34a' : '#ffffff'}
                                      stroke="#16a34a"
                                      strokeWidth={point.hasRecorded ? 0 : 1.2}
                                    />
                                  );
                                })}
                                {axisLevels.map((level, index) => {
                                  const y = plotTopPad + plottableHeight - ((level - minValue) / spread) * plottableHeight;
                                  return (
                                    <text
                                      key={`weight-axis-${index}`}
                                      x={0}
                                      y={y + 3}
                                      textAnchor="start"
                                      fontSize={isSmallChartDevice() ? 7 : 8}
                                      fontWeight="500"
                                      fill="#94a3b8"
                                    >
                                      {level.toFixed(1)}
                                    </text>
                                  );
                                })}
                                {points.map((point, index) => {
                                  if (!shouldRenderMarker(point, index)) return null;
                                  if (!point.hasRecorded) return null;

                                  const isFirst = index === firstVisibleIndex;
                                  const isLast = index === lastVisibleIndex;
                                  const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
                                  const labelX = isFirst ? point.x + 4 : isLast ? point.x - 4 : point.x;
                                  const labelY = Math.max(point.y - 14, -16);
                                  const labelText = `${point.value.toFixed(1)} kg`;
                                  const labelColor = '#9ca3af';
                                  return (
                                    <text
                                      key={`${point.key}-value`}
                                      x={labelX}
                                      y={isSmallChartDevice() ? Math.max(point.y - 12, -16) : labelY}
                                      textAnchor={textAnchor}
                                      fontSize={isSmallChartDevice() ? 7 : 9}
                                      fontWeight="600"
                                      fill={labelColor}
                                    >
                                      {labelText}
                                    </text>
                                  );
                                })}
                              </svg>

                              <div
                                className={`relative mt-2 h-4 text-gray-500 ${isSmallChartDevice() ? 'text-[8px]' : 'text-[10px] md:text-xs'}`}
                                style={{
                                  width: '100%'
                                }}
                              >
                                {points.map((point, index) => {
                                  if (!dateLabelIndices.has(index)) return null;
                                  const isFirst = index === firstDateLabelIndex;
                                  const isLast = index === lastDateLabelIndex;

                                  return (
                                    <span
                                      key={`${point.key}-label`}
                                      className="absolute whitespace-nowrap"
                                      style={{
                                        left: `${(point.x / chartWidth) * 100}%`,
                                        transform: isFirst
                                          ? 'translateX(0)'
                                          : isLast
                                            ? 'translateX(-100%)'
                                            : 'translateX(-50%)'
                                      }}
                                    >
                                      {point.label}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
{/* 
                        {weightTrendRangeDays >= 14 ? (
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                              increased vs previous sampled day
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                              decreased vs previous sampled day
                            </span>
                          </div>
                        ) : null} */}

                        <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                          <span>
                            Latest: {Number.isFinite(latestValue)
                              ? latestValue.toFixed(1)
                              : '-'} kg
                          </span>
                          <span>
                            Avg: {Number.isFinite(avgValue) ? avgValue.toFixed(1) : '-'} kg
                          </span>
                        </div>  

                        {/* <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                            lower or stable vs previous
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                            higher vs previous
                          </span>
                        </div> */}
                      </>
                    )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="pb-3 md:pb-4 flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  aria-label="Go to weight summary slide"
                  onClick={() => setActiveWeightPanel('summary')}
                  style={{ width: 7, height: 7, minWidth: 0, minHeight: 0, padding: 0 }}
                  className={`rounded-full transition-all duration-300 ${
                    activeWeightPanel === 'summary'
                      ? 'bg-emerald-500'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
                <button
                  type="button"
                  aria-label="Go to weight trend slide"
                  onClick={() => setActiveWeightPanel('trend')}
                  style={{ width: 7, height: 7, minWidth: 0, minHeight: 0, padding: 0 }}
                  className={`rounded-full transition-all duration-300 ${
                    activeWeightPanel === 'trend'
                      ? 'bg-emerald-500'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              </div>
            </div>
          </div>

        {/* New user message - only show when no entries */}
        {monthlyGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-white/60 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100">
            {isIOS ? (
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Scale className="w-9 h-9 text-gray-400" />
              </div>
            ) : (
              <div className="text-6xl mb-4">⚖️</div>
            )}
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Weight Entries</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              Take a photo of your weighing scale to start tracking your weight.
            </p>
          </div>
        )}

        {/* Weight Entries Grouped by Month */}
        <div className="space-y-6">
          {monthlyGroups.length > 0 && (
            monthlyGroups.map((monthGroup) => {
              const monthStats = getMonthStats(monthGroup.entries);
              
              return (
                <div key={monthGroup.monthKey} className="mb-6">
                  {/* Month Header */}
                  {/* <div className="bg-white rounded-xl  p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-emerald-500" />
                        {monthGroup.monthName}
                      </h3>
                      <span className="text-sm text-gray-500">{monthStats.count} entries</span>
                    </div>
                  </div> */}

{/* Month and Entries */}
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-600" />
      <span className="text-sm font-semibold text-gray-600">
        {monthGroup.monthName}
      </span>
    </div>
    {/* <span className="text-sm text-gray-600">
      {currentMonthStats.count} {currentMonthStats.count === 1 ? 'entry' : 'entries'}
    </span> */}
  </div>
                  {/* Month Entries */}
                  <div className="space-y-3">
                    {monthGroup.entries
                      .filter(entry => entry && entry.ID && entry.CreatedAt && entry.Weight)
                      .sort((a, b) => {
                        const dateA = istToLocalDate(a.CreatedAt);
                        const dateB = istToLocalDate(b.CreatedAt);
                        return dateB - dateA;
                      })
                      .map((entry, index) => {
                        // Show undo row if this is a placeholder
                        if (entry.isUndoPlaceholder) {
                          const undoEntry = undoState[entry.ID];
                          if (!undoEntry || !undoEntry.originalEntry) return null;
                          return (
                            <UndoRow
                              key={entry.ID}
                              pid={entry.ID}
                              originalEntry={undoEntry.originalEntry}
                              expiresAt={undoEntry.expiresAt}
                              ttlSeconds={undoEntry.ttlSeconds ?? UNDO_SECONDS}
                              onRestore={handleUndoRestore}
                              onExpire={() => handleUndoExpire(entry.ID, undoEntry.originalEntry)}
                            />
                          );
                        }

                        // ✅ OPTIMIZED: Use pre-computed previousWeightMap for O(1) lookup
                        const prevWeight = previousWeightMap.get(entry.ID);
                        
                        // Skeleton placeholder for lazy loading
                        const skeleton = (
                          <div className="bg-white rounded-xl p-2.5 xs:p-3 sm:p-4 animate-pulse" style={{ minHeight: 72 }}>
                            <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-200 rounded-lg"></div>
                              <div className="flex-1 space-y-1.5 sm:space-y-2">
                                <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-1/2"></div>
                              </div>
                              <div className="h-6 sm:h-8 bg-gray-200 rounded w-12 sm:w-16"></div>
                            </div>
                          </div>
                        );

                        // ✅ PERFORMANCE: First 10 items render immediately, rest lazy load on scroll
                        if (index < 10) {
                          return (
                            <Suspense key={entry.ID} fallback={skeleton}>
                              <WeightCard
                                data={entry}
                                previousWeight={prevWeight}
                                onDelete={handleDeleteEntry}
                                onView={handleViewEntry}
                                index={index}
                                userName={savedUserName || user?.displayName || user?.name || 'User'}
                                profileImage={savedProfileImage || null}
                              />
                            </Suspense>
                          );
                        }

                        // Lazy load items beyond the first 5
                        return (
                          <LazyLoadWrapper key={entry.ID} fallback={skeleton} rootMargin="200px">
                            <Suspense fallback={skeleton}>
                              <WeightCard
                                data={entry}
                                previousWeight={prevWeight}
                                onDelete={handleDeleteEntry}
                                onView={handleViewEntry}
                                index={index}
                                userName={savedUserName || user?.displayName || user?.name || 'User'}
                                profileImage={savedProfileImage || null}
                              />
                            </Suspense>
                          </LazyLoadWrapper>
                        );
                      })}
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
    );
  };

  /**
   * Render capture mode
   */
  // Camera capture view removed - images are processed from main page

  // Main render
  if (!hideHeader) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* CSS keyframes for countdown animation and weight card animations */}
        <style>{`
          @keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
          @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        {viewMode === 'overview' && renderOverview()}
        
        {/* Weight Card Modal */}
        {showModal && selectedEntry && (
          <Suspense fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 shadow-xl">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-300 border-t-emerald-600"></div>
              </div>
            </div>
          }>
            <WeightCardModal
              data={selectedEntry}
              onClose={() => {
                setShowModal(false);
                setSelectedEntry(null);
              }}
              onDelete={handleDeleteEntry}
              onUpdate={handleUpdateEntry}
              apiBaseUrl={apiBaseUrl}
              previousWeight={(() => {
                const index = weightHistory.findIndex(e => e.ID === selectedEntry.ID);
                const prevEntry = index > 0 && index + 1 < weightHistory.length ? weightHistory[index + 1] : null;
                return prevEntry && prevEntry.Weight ? prevEntry.Weight : null;
              })()}
            />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <>
      {/* CSS keyframes for animations */}
      <style>{`
        @keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      {viewMode === 'overview' && renderOverview()}
      
      {/* Weight Card Modal */}
      {showModal && selectedEntry && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-300 border-t-emerald-600"></div>
            </div>
          </div>
        }>
          <WeightCardModal
            data={selectedEntry}
            onClose={() => {
              setShowModal(false);
              setSelectedEntry(null);
            }}
            onDelete={handleDeleteEntry}
            onUpdate={handleUpdateEntry}
            apiBaseUrl={apiBaseUrl}
            previousWeight={(() => {
              const index = weightHistory.findIndex(e => e.ID === selectedEntry.ID);
              const prevEntry = index > 0 && index + 1 < weightHistory.length ? weightHistory[index + 1] : null;
              return prevEntry && prevEntry.Weight ? prevEntry.Weight : null;
            })()}
          />
        </Suspense>
      )}
    </>
  );
};

export default WeightDashboard;
