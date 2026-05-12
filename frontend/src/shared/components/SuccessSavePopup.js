// frontend/src/components/SuccessSavePopup.js
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
} from 'react';

const UNDO_SECONDS = 10;

// Prevents double fade in StrictMode
const UNDO_ANIMATED_ONCE = new Set();

// Inject styles once
const styles = `
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: translateY(0);} }
  .animate-fadeIn { animation: fadeIn 0.25s ease-out; }

  @keyframes stackExpand { from { transform: scale(0.95); opacity: 0.8;} to { transform: scale(1); opacity: 1;} }
  .animate-stackExpand { animation: stackExpand 0.25s ease-out; }

  /* Slide out uses base stack transform + the swipe offset captured at release */
  @keyframes slideOut {
    from { transform: var(--base-transform) translateX(var(--swipe-x, 0)); opacity: 1; }
    to   { transform: var(--base-transform) translateX(100%); opacity: 0; }
  }
  .animate-slideOut { animation: slideOut 0.3s ease-in-out forwards; }

  @keyframes slideOutLeft {
    from { transform: var(--base-transform) translateX(var(--swipe-x, 0)); opacity: 1; }
    to   { transform: var(--base-transform) translateX(-100%); opacity: 0; }
  }
  .animate-slideOutLeft { animation: slideOutLeft 0.3s ease-in-out forwards; }

  @keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
`;
if (typeof document !== 'undefined' && !document.getElementById('success-popup-styles')) {
  const style = document.createElement('style');
  style.id = 'success-popup-styles';
  style.textContent = styles;
  document.head.appendChild(style);
}

const SuccessSavePopup = ({
  open,                 // legacy single card
  popups,               // [{ id, imagePreview, nutritionData, analysisId? }]
  onClose,              // (id?) => void
  onDelete,             // (id)  => void
  onRestore,            // (id, popup, indexHint, meta) => void
  nutritionData,        // legacy
  imagePreview          // legacy
}) => {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  const [expandedId, setExpandedId] = useState(null);
  const [isStackExpanded, setIsStackExpanded] = useState(false);
  const [swipeState, setSwipeState] = useState({});
  const [deletingId, setDeletingId] = useState(null);

  // Inline undo placeholders: { [pid]: { popup, expiresAt, index, ttlSeconds?, baseIndex? } }
  const [inlineUndos, setInlineUndos] = useState({});
  // Optimistic re-show when undo is clicked: { [popupId]: { popup, index } }
  const [pendingRestore, setPendingRestore] = useState({});
  // Hide cards locally as soon as delete is tapped (before parent/DB confirm)
  const [locallyHidden, setLocallyHidden] = useState({});

  // NEW: control slide-out via React so re-renders don't kill the animation
  // { [id]: 'left' | 'right' }
  const [dismissDirById, setDismissDirById] = useState({});
  // Freeze the release offset in px: { [id]: number }
  const [dismissStartX, setDismissStartX] = useState({});

  // Expire UNDO rows
  useEffect(() => {
    const timers = [];
    Object.entries(inlineUndos).forEach(([pid, { expiresAt, popup }]) => {
      const ms = Math.max(0, expiresAt - Date.now());
      const t = setTimeout(() => {
        setInlineUndos(prev => { const n = { ...prev }; delete n[pid]; return n; });
        setLocallyHidden(prev => { const n = { ...prev }; delete n[popup?.id]; return n; });
        UNDO_ANIMATED_ONCE.delete(pid);
      }, ms);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [inlineUndos]);

  // If parent already re-added an undone popup, drop it from our pending overlay
  useEffect(() => {
    setPendingRestore(prev => {
      if (!popups?.length) return prev;
      const next = { ...prev };
      popups.forEach(p => { if (next[p.id]) delete next[p.id]; });
      return next;
    });
  }, [popups]);

  // Auto-expand only when an UNDO first appears
  const undoCount = Object.keys(inlineUndos).length;
  const prevUndoCount = useRef(0);
  useLayoutEffect(() => {
    if (prevUndoCount.current === 0 && undoCount > 0) setIsStackExpanded(true);
    prevUndoCount.current = undoCount;
  }, [undoCount]);

  const isValidNutritionData = (data) => {
    if (!data) return false;
    if (typeof data === 'object' && Object.keys(data).length === 0) return false;
    if (Array.isArray(data) && data.length === 0) return false;
    const n = data.nutrition;
    return !!n && ((n.calories > 0) || (n.protein > 0) || (n.carbs > 0) || (n.fat > 0));
  };

  const isValidWeightData = (data) => {
    return data && data.weightValue > 0;
  };

  const effectivePopups = useMemo(() => {
    const valid = (p) => {
      if (!p) return false;
      // Weight entry validation
      if (p.isWeight && p.weightData) return isValidWeightData(p.weightData);
      // Nutrition entry validation
      return p.nutritionData && isValidNutritionData(p.nutritionData);
    };
    const list = popups ? popups.filter(valid)
      : (open && nutritionData && imagePreview && isValidNutritionData(nutritionData))
        ? [{ id: 'legacy', imagePreview, nutritionData }]
        : [];
    // de-dupe by id (prevents bg dupes)
    return list.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
  }, [popups, open, nutritionData, imagePreview]);

  // Compose: base (minus locally hidden) + pending restores + inline undo placeholders
  const composed = useMemo(() => {
    const base = effectivePopups.filter(p => !locallyHidden[p.id]);

    Object.values(pendingRestore).forEach(({ popup, index }) => {
      if (!base.find(p => p.id === popup.id)) {
        const i = Math.min(Math.max(0, index), base.length);
        base.splice(i, 0, popup);
      }
    });

    const undoEntries = Object.entries(inlineUndos)
      .map(([pid, v]) => ({ pid, ...v }))
      .sort((a, b) => a.index - b.index);

    const out = [...base];
    let added = 0;
    for (const u of undoEntries) {
      if (out.find(p => p.id === u.popup.id)) continue; // avoid dup if restored
      const i = Math.min(Math.max(0, u.index + added), out.length);
      out.splice(i, 0, { __undo: true, pid: u.pid, entry: u });
      added++;
    }
    return out;
  }, [effectivePopups, inlineUndos, pendingRestore, locallyHidden]);

  const hasBgHead = useMemo(
    () => Boolean(popups?.[0]?.id?.startsWith('bg-')),
    [popups]
  );

  // Stack behavior helpers
  const containerRef = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsStackExpanded(false);
        setExpandedId(null);
      }
    };
    if (isStackExpanded) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [isStackExpanded]);

  const handleStackClick = (e) => {
    const t = e.target;
    const isToggleBtn = t.closest('button')?.textContent?.match(/details/i);
    const isCloseBtn  = t.closest('button')?.getAttribute('title') === 'Close';
    const isDeleteBtn = t.closest('button')?.textContent?.includes('Delete');
    const anySwipe    = Object.values(swipeState).some(s => s.isSwiping);
    if (!isToggleBtn && !isCloseBtn && !isDeleteBtn && !anySwipe) {
      setIsStackExpanded(v => !v);
      if (isStackExpanded) setExpandedId(null);
    }
  };

  const toggleExpanded = (id) => {
    if (!isStackExpanded && expandedId !== id) setIsStackExpanded(true);
    setExpandedId(expandedId === id ? null : id);
  };

  // Swipe-to-dismiss (not delete)
  const handleTouchStart = (id, e) => {
    const t = e.touches[0];
    setSwipeState(prev => ({ ...prev, [id]: { startX: t.clientX, startY: t.clientY, isSwiping: false } }));
  };

  const handleTouchMove = (id, e) => {
    const s = swipeState[id];
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      if (!s.isSwiping) setSwipeState(prev => ({ ...prev, [id]: { ...s, isSwiping: true } }));
      const el = e.currentTarget;
      el.style.setProperty('--swipe-x', `${dx}px`);
      el.style.opacity = String(1 - Math.min(Math.abs(dx) / 150, 1) * 0.5);
    }
  };

  const handleTouchEnd = (id, e) => {
    const s = swipeState[id];
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.startX;
    const el = e.currentTarget;

    if (s.isSwiping && Math.abs(dx) > 100) {
      // Let animation control opacity; keep the swipe offset frozen via state
      el.style.opacity = '';

      setDismissStartX(prev => ({ ...prev, [id]: dx }));
      setDismissDirById(prev => ({ ...prev, [id]: dx > 0 ? 'right' : 'left' }));
    } else {
      el.style.removeProperty('--swipe-x');
      el.style.opacity = '';
    }

    // Clear transient swipe state (doesn't affect animation now that it's state-driven)
    setSwipeState(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // ---- Render helpers -------------------------------------------------------

  const renderWeightDetails = (weightData) => {
    return (
      <div className="bg-white rounded-lg overflow-hidden mt-3">
        <div className="py-3 border-b border-gray-100">
          <h3 className="font-medium text-gray-900">Weight Details</h3>
        </div>

        {/* <div className="grid grid-cols-2 gap-px bg-gray-100"> */}
        <div className=" bg-gray-100">
          <div className="bg-white p-3 text-center">
            <p className="text-xs text-green-500 mb-1">Weight</p>
            <p className="font-bold text-lg">{weightData.weightValue} {weightData.unit}</p>
          </div>
          {weightData.bmi && (
            <div className="bg-white p-3 text-center">
              <p className="text-xs text-blue-500 mb-1">BMI</p>
              <p className="font-bold text-lg">{weightData.bmi}</p>
            </div>
          )}
          {weightData.bodyFat && (
            <div className="bg-white p-3 text-center">
              <p className="text-xs text-orange-500 mb-1">Body Fat</p>
              <p className="font-bold text-lg">{weightData.bodyFat}%</p>
            </div>
          )}
          {weightData.muscleMass && (
            <div className="bg-white p-3 text-center">
              <p className="text-xs text-green-500 mb-1">Muscle Mass</p>
              <p className="font-bold text-lg">{weightData.muscleMass} kg</p>
            </div>
          )}
          {weightData.bmr && (
            <div className="bg-white p-3 text-center">
              <p className="text-xs text-red-500 mb-1">BMR</p>
              <p className="font-bold text-lg">{weightData.bmr} cal</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNutritionDetails = (data) => {
    const { nutrition, detailedItems = [] } = data;
    return (
      <div className="bg-white rounded-lg overflow-hidden mt-3">
        <div className="py-3 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <h3 className="font-medium text-gray-900">Nutrition Summary</h3>
            <span className="text-sm bg-green-100 text-green-600 px-2 py-1 rounded">{nutrition.calories} kcal</span>
          </div>
        </div>

        {!!detailedItems.length && (
          <div className="p-3 bg-gray-50">
            <h4 className="text-xs font-semibold text-gray-500 mb-2 tracking-wide">FOOD ITEMS</h4>
            <div className="space-y-2">
              {detailedItems.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center text-xs font-medium text-gray-600">{i + 1}</div>
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-[11px] text-gray-500">{item.portionDescription || item.portion}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{item.calories} kcal</p>
                    <p className="text-[11px] text-gray-500">
                      <span className="text-blue-600">{item.protein}P</span> • <span className="text-orange-600">{item.carbs}C</span> • <span className="text-yellow-600">{item.fat}F</span> • <span className="text-green-600">{item.fiber}Fb</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-px bg-gray-100">
          <div className="bg-white p-2 text-center"><p className="text-xs text-blue-500">Protein</p><p className="font-medium">{nutrition.protein}g</p></div>
          <div className="bg-white p-2 text-center"><p className="text-xs text-orange-500">Carbs</p><p className="font-medium">{nutrition.carbs}g</p></div>
          <div className="bg-white p-2 text-center"><p className="text-xs text-yellow-500">Fat</p><p className="font-medium">{nutrition.fat}g</p></div>
          <div className="bg-white p-2 text-center"><p className="text-xs text-green-500">Fiber</p><p className="font-medium">{nutrition.fiber}g</p></div>
        </div>
      </div>
    );
  };

  // Shell wrapper with optional "flat" mode for Undo rows
  const renderCardShell = ({
    children,
    index,
    total,
    id,
    touchHandlers,
    forceFlat = false,
    zBoost = 0,
    dismissDir = null,     // 'left' | 'right' | null
    freezeX = 0            // px at release
  }) => {
    const isTop = index === total - 1;
    const stackOffset  = total > 1 ? (total - 1 - index) * 2    : 0;
    const scaleOffset  = total > 1 ? (total - 1 - index) * 0.01 : 0;
    const opacityOffset = total > 1 ? Math.max(0.8, 1 - (total - 1 - index) * 0.08) : 1;

    // Undo rows (forceFlat) do not participate in stack compression
    const showFull   = forceFlat || isStackExpanded || isTop || total === 1;
    const marginTop  = forceFlat
      ? (index === 0 ? 0 : '6px')
      : (isStackExpanded
          ? (index === 0 ? 0 : '4px')
          : (index === 0 ? 0 : `-${60 - (total - 1 - index) * 2}px`));

    const baseTransform = forceFlat
      ? ''
      : (!isStackExpanded ? `translateY(-${stackOffset}px) scale(${1 - scaleOffset})` : '');

    const slideClass =
      dismissDir === 'right' ? 'animate-slideOut'
      : dismissDir === 'left' ? 'animate-slideOutLeft'
      : '';

    return (
      <div
        key={id}
        className={`relative pointer-events-auto w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 ease-out
          ${showFull && isStackExpanded && total > 1 && !forceFlat ? 'animate-stackExpand' : ''} ${slideClass}`}
        style={{
          '--base-transform': baseTransform || 'none',
          '--swipe-x': dismissDir ? `${freezeX}px` : undefined,
          transform: `var(--base-transform) translateX(var(--swipe-x, 0px))`,
          opacity: showFull ? 1 : opacityOffset,
          zIndex: (forceFlat ? 1000 : 50) + index + zBoost,
          marginTop,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          willChange: 'transform'
        }}
        {...touchHandlers}
      >
        {children}
      </div>
    );
  };

  // Inline UNDO card (replaces a deleted card at the same index)
  const UndoInline = ({ pid, entry, index, total }) => {
    const { popup, expiresAt, ttlSeconds = UNDO_SECONDS, baseIndex } = entry;

    // Freeze index/total at mount
    const mountIndex = useRef(index);
    const mountTotal = useRef(total);

    // Only fade in once per pid
    const shouldFadeIn = useMemo(() => {
      if (UNDO_ANIMATED_ONCE.has(pid)) return false;
      UNDO_ANIMATED_ONCE.add(pid);
      return true;
    }, [pid]);

    // Text refresh
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
      const iv = setInterval(() => setNow(Date.now()), 500);
      return () => clearInterval(iv);
    }, []);

    // Progress bar negative delay
    const { totalS, delayAtMount } = useMemo(() => {
      const totalS = Math.max(0, ttlSeconds);
      const startedAt = expiresAt - totalS * 1000;
      const elapsed = Math.min(totalS, Math.max(0, (Date.now() - startedAt) / 1000));
      return { totalS, delayAtMount: -elapsed };
    }, [expiresAt, ttlSeconds]);

    const remaining = Math.ceil(Math.max(0, expiresAt - now) / 1000);
    const isWeight = popup?.isWeight;
    const title = isWeight 
      ? `${popup?.weightData?.weightValue || ''} ${popup?.weightData?.unit || 'kg'}`.trim() || 'Weight'
      : popup?.nutritionData?.category?.name || 'Food';

    const handleUndo = async () => {
      setInlineUndos(prev => { const n = { ...prev }; delete n[pid]; return n; });
      UNDO_ANIMATED_ONCE.delete(pid);

      setLocallyHidden(prev => { const n = { ...prev }; delete n[popup.id]; return n; });

      // Show immediately where it was until parent re-adds
      setPendingRestore(prev => ({ ...prev, [popup.id]: { popup, index: mountIndex.current } }));

      try {
        if (popup.analysisId) {
          // Use different API endpoint for weight entries vs nutrition entries
          const isWeightEntry = popup.isWeight;
          const undoUrl = isWeightEntry 
            ? `${apiBaseUrl}/api/weight/undo`
            : `${apiBaseUrl}/api/background-analysis/undo`;
          
          const undoBody = isWeightEntry
            ? { id: popup.analysisId, userId: popup.userId }
            : { id: popup.analysisId, userId: popup.userId };

          const res = await fetch(undoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(undoBody)
          });
          const data = await res.json();
          if (!data?.success) throw new Error(data?.message || 'Undo failed');
        }
        onRestore && onRestore(popup.id, popup, (baseIndex ?? index), { hasBgHead });
      } catch (e) {
        setPendingRestore(prev => { const n = { ...prev }; delete n[popup.id]; return n; });
        setInlineUndos(prev => ({ ...prev, [pid]: { popup, expiresAt, ttlSeconds, index: mountIndex.current } }));
        setLocallyHidden(prev => ({ ...prev, [popup.id]: true }));
        alert(e?.message || 'Failed to undo. Please try again.');
      }
    };

    return renderCardShell({
      id: `undo-${pid}`,
      index: mountIndex.current,
      total: mountTotal.current,
      touchHandlers: {}, // no swipe on undo row
      forceFlat: true,
      children: (
        <div className={`relative p-3 ${shouldFadeIn ? 'animate-fadeIn' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">🗑️</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">
                <span className="font-medium">Removed{isWeight ? ':' : ''}</span> {isWeight ? title : `"${title}"`}
              </p>
              <p className="text-[11px] text-amber-700/80">Undo available for {remaining}s</p>
            </div>
            <button
              onClick={handleUndo}
              className="px-3 py-1.5 rounded-full text-sm font-medium border border-amber-300 text-amber-800 hover:bg-amber-100 active:scale-95 transition"
            >
              Undo
            </button>
          </div>

          {/* progress bar */}
          <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200 overflow-hidden rounded-b-xl">
            <span
              key={pid}
              className="block h-full bg-amber-600 origin-left will-change-transform"
              style={{
                transformOrigin: 'left',
                transform: 'translateZ(0)',
                animation: `countdown-shrink ${totalS}s linear ${delayAtMount}s forwards`
              }}
            />
          </span>
        </div>
      )
    });
  };

  const renderPopup = (popup, id, isSingle, index, total) => {
    const isWeight = popup.isWeight;
    const weightData = popup.weightData;
    const data  = isSingle ? nutritionData : popup.nutritionData;
    const image = isSingle ? imagePreview   : popup.imagePreview;
    
    // Validate based on entry type
    if (isWeight && (!weightData || !isValidWeightData(weightData))) return null;
    if (!isWeight && (!data || !isValidNutritionData(data))) return null;
    
    const isExpanded = expandedId === id;

    // slide-out control for this card
    const dismissDir = dismissDirById[id] || null;
    const freezeX = dismissStartX[id] ?? 0;

    const callOnClose = () => (isSingle ? onClose() : onClose(id));

    return renderCardShell({
      id,
      index,
      total,
      dismissDir,
      freezeX,
      touchHandlers: {
        onClick: total > 1 ? handleStackClick : undefined,
        onTouchStart: (e) => handleTouchStart(id, e),
        onTouchMove:  (e) => handleTouchMove(id, e),
        onTouchEnd:   (e) => handleTouchEnd(id, e),
        onAnimationEnd: (e) => {
          // Only react to our slide-out animations
          if (e.animationName === 'slideOut' || e.animationName === 'slideOutLeft') {
            // cleanup
            setDismissDirById(prev => { const n = { ...prev }; delete n[id]; return n; });
            setDismissStartX(prev => { const n = { ...prev }; delete n[id]; return n; });
            // remove the CSS var so future renders start clean
            e.currentTarget.style.removeProperty('--swipe-x');
            callOnClose();
          }
        }
      },
      children: (
        <>
          <div className="p-3">
            <div className="flex items-start gap-3">
              {image && (
                <img
                  src={image}
                  alt="Food preview"
                  className="w-16 h-16 object-cover rounded-lg border border-gray-100 flex-shrink-0"
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800 text-sm truncate">
                    {isWeight ? 'Weight Entry' : (data?.category?.name || 'Food')}
                  </span>
                  <span className={`px-1.5 py-0.5  text-xs font-medium whitespace-nowrap ${isWeight ? ' text-green-600' : ' text-green-600'}`}>
                    ✓ Saved
                  </span>
                  {total > 1 && index === total - 1 && !isStackExpanded && (
                    <span className="px-1.5 py-0.5  text-xs text-green-600 font-medium whitespace-nowrap">
                      +{Math.max(0, total - 1)} more
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500 mb-1.5">
                  {isWeight ? (
                    <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                      <span className="font-semibold text-gray-600">{weightData.weightValue} {weightData.unit}</span>
                      {weightData.bmi && <span>· BMI: {weightData.bmi}</span>}
                      {weightData.bodyFat && <span>· Body Fat: {weightData.bodyFat}%</span>}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                      <span>{data?.nutrition?.calories || 0} kcal</span>
                      <span>· {data?.nutrition?.protein || 0}g protein</span>
                      <span>· {data?.nutrition?.carbs || 0}g carbs</span>
                      <span>· {data?.nutrition?.fat || 0}g fat</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => toggleExpanded(id)}
                  className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors flex items-center gap-1"
                >
                  {isExpanded ? 'Hide details' : 'View details'}
                  <svg className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <button
                onClick={() => (open && !popups ? onClose() : onClose(id))}
                className="p-1 hover:bg-gray-50 rounded-md transition-colors flex-shrink-0"
                title="Close"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {isExpanded && (isWeight ? renderWeightDetails(weightData) : renderNutritionDetails(data))}
            </div>
          </div>

          {isExpanded && (
            <div className="px-3 pb-3">
              <button
                disabled={deletingId === id}
                onClick={async () => {
                  // Legacy single-card path
                  if (open && !popups) { onDelete(); return; }

                  const analysisId = popup.analysisId;
                  if (!analysisId) { onDelete(id); return; }

                  if (deletingId === id) return;
                  setDeletingId(id);

                  // OPTIMISTIC: hide card + insert UNDO at this exact index
                  setIsStackExpanded(true); // expand to avoid restack flicker
                  setLocallyHidden(prev => ({ ...prev, [id]: true }));

                  const baseIndex = effectivePopups.findIndex(p => p.id === id);

                  const pid = `undo-${id}-${Date.now()}`;
                  setInlineUndos(prev => ({
                    ...prev,
                    [pid]: {
                      pid,
                      popup,
                      expiresAt: Date.now() + UNDO_SECONDS * 1000,
                      ttlSeconds: UNDO_SECONDS,
                      index,     // UI index (composed)
                      baseIndex, // original index in effectivePopups
                    }
                  }));

                  try { if ('vibrate' in navigator) navigator.vibrate(8); } catch {}

                  try {
                    // Use different API endpoint for weight entries vs nutrition entries
                    const isWeightEntry = popup.isWeight;
                    const deleteUrl = isWeightEntry 
                      ? `${apiBaseUrl}/api/weight/delete`
                      : `${apiBaseUrl}/api/background-analysis`;
                    
                    const deleteBody = isWeightEntry
                      ? { userId: popup.userId, entryId: analysisId }
                      : { id: analysisId, userId: popup.userId };

                    const res = await fetch(deleteUrl, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(deleteBody)
                    });
                    const json = await res.json();

                    if (!(res.ok || res.status === 404 || res.status === 410) || json?.success === false) {
                      throw new Error(json?.message || 'Failed to delete.');
                    }

                    onDelete(id);
                  } catch (e) {
                    setLocallyHidden(prev => { const n = { ...prev }; delete n[id]; return n; });
                    setInlineUndos(prev => { const n = { ...prev }; delete n[pid]; return n; });
                    UNDO_ANIMATED_ONCE.delete(pid);
                    alert(e?.message || 'Failed to delete. Please try again.');
                  } finally {
                    setDeletingId(null);
                  }
                }}
                className={`w-full text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5
                  ${deletingId === id ? 'bg-red-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deletingId === id ? 'Removing' : 'Remove'}
              </button>
            </div>
          )}
        </>
      )
    });
  };

  // --- Render root -----------------------------------------------------------

  const hasAnything =
    composed.length > 0 ||
    Object.keys(inlineUndos).length > 0 ||
    Object.keys(pendingRestore).length > 0;

  if (!hasAnything) return null;

  // Legacy mode (single)
  if (open && !popups) {
    return (
      <div className="fixed z-50 bottom-4 left-4 right-4 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm">
          {renderPopup({ id: 'legacy', imagePreview, nutritionData }, 'single', true, 0, 1)}
        </div>
      </div>
    );
  }

  // Split composed into "stack items" and "undo items" depending on expanded state.
  // When collapsed -> undo rows are rendered in a floating overlay on top of the stack.
  // When expanded   -> undo rows are rendered inline at their captured indices.
  const stackItems   = isStackExpanded ? composed : composed.filter(x => !x.__undo);
  const overlayUndos = isStackExpanded ? []       : composed.filter(x => x.__undo);

  return (
    <div ref={containerRef} className="fixed z-50 bottom-4 left-4 right-4 flex justify-center pointer-events-none">
      <div className="relative w-full max-w-sm pointer-events-auto">

        {/* Normal stack items (cards + inline undo if expanded) */}
        {stackItems.map((item, idx) => {
          const total = stackItems.length;
          if (item.__undo) {
            return (
              <UndoInline
                key={item.pid}
                pid={item.pid}
                entry={item.entry}
                index={idx}
                total={total}
              />
            );
          }
          return renderPopup(item, item.id, false, idx, total);
        })}

        {/* Floating Undo overlay (only when collapsed) */}
        {!isStackExpanded && overlayUndos.length > 0 && (
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{ zIndex: 2000 }}
          >
            {overlayUndos.map((item, idx) => (
              <div key={item.pid} className="pointer-events-auto">
                <UndoInline
                  pid={item.pid}
                  entry={item.entry}
                  index={idx}                    // visual order inside overlay stack
                  total={overlayUndos.length}    // used only for spacing; rows are flat
                />
              </div>
            ))}
          </div>
        )}

        {isStackExpanded && stackItems.length > 1 && (
          <div className="text-center mt-2">
            <button
              onClick={() => { setIsStackExpanded(false); setExpandedId(null); }}
              className="inline-flex items-center gap-2 text-xs text-gray-600 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-gray-200/50 hover:bg-gray-50 hover:shadow-xl transition-all duration-200 active:scale-95"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Tap to collapse
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuccessSavePopup;
