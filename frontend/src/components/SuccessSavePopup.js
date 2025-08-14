import React, { useState, useMemo, useEffect, useRef } from 'react';

const UNDO_SECONDS = 10;

// Inject styles once
const styles = `
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: translateY(0);} }
  .animate-fadeIn { animation: fadeIn 0.25s ease-out; }
  @keyframes stackExpand { from { transform: scale(0.95); opacity: 0.8;} to { transform: scale(1); opacity: 1;} }
  .animate-stackExpand { animation: stackExpand 0.25s ease-out; }
  @keyframes slideOut { from { transform: translateX(var(--swipe-x, 0)); opacity: 1;} to { transform: translateX(100%); opacity: 0;} }
  .animate-slideOut { animation: slideOut 0.3s ease-in-out forwards; }
  @keyframes slideOutLeft { from { transform: translateX(var(--swipe-x, 0)); opacity: 1;} to { transform: translateX(-100%); opacity: 0;} }
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
  onClose,              // (id?) => void        - closes/dismisses a card (not delete)
  onDelete,             // (id)  => void        - remove from parent list after delete
  onRestore,            // (id, popup) => void  - add back to parent list on undo (optional)
  nutritionData,        // legacy
  imagePreview          // legacy
}) => {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  const [expandedId, setExpandedId] = useState(null);
  const [isStackExpanded, setIsStackExpanded] = useState(false);
  const [swipeState, setSwipeState] = useState({});
  const [deletingId, setDeletingId] = useState(null);

  // Inline undo placeholders: { [pid]: { popup, expiresAt, index } }
  const [inlineUndos, setInlineUndos] = useState({});
  // Optimistic re-show when undo is clicked (until parent re-adds): { [popupId]: { popup, index } }
  const [pendingRestore, setPendingRestore] = useState({});

  // Expire inline undo placeholders precisely
  useEffect(() => {
    const timers = [];
    Object.entries(inlineUndos).forEach(([pid, { expiresAt }]) => {
      const ms = Math.max(0, expiresAt - Date.now());
      const t = setTimeout(() => {
        setInlineUndos(prev => {
          const n = { ...prev };
          delete n[pid];
          return n;
        });
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

  const isValidNutritionData = (data) => {
    if (!data) return false;
    if (typeof data === 'object' && Object.keys(data).length === 0) return false;
    if (Array.isArray(data) && data.length === 0) return false;
    const n = data.nutrition;
    return !!n && ((n.calories > 0) || (n.protein > 0) || (n.carbs > 0) || (n.fat > 0));
  };

  const effectivePopups = useMemo(() => {
    const valid = (p) => p && p.nutritionData && isValidNutritionData(p.nutritionData);
    if (popups) return popups.filter(valid);
    if (open && nutritionData && imagePreview && isValidNutritionData(nutritionData)) {
      return [{ id: 'legacy', imagePreview, nutritionData }];
    }
    return [];
  }, [popups, open, nutritionData, imagePreview]);

  // Compose what we render: base popups + any pending restores (if not already present) + inline undo placeholders at captured indices
  const composed = useMemo(() => {
    // Start with base list
    const base = [...effectivePopups];

    // Insert pending restored cards (so UNDO shows card immediately at the same spot)
    Object.values(pendingRestore).forEach(({ popup, index }) => {
      if (!base.find(p => p.id === popup.id)) {
        const i = Math.min(Math.max(0, index), base.length);
        base.splice(i, 0, popup);
      }
    });

    // Insert inline undo placeholders at their original indices
    const undoEntries = Object.entries(inlineUndos)
      .map(([pid, v]) => ({ pid, ...v }))
      .sort((a, b) => a.index - b.index);

    const out = [...base];
    let added = 0;
    for (const u of undoEntries) {
      // If the popup is already back (pending or parent), don't render the placeholder
      if (out.find(p => p.id === u.popup.id)) continue;
      const i = Math.min(Math.max(0, u.index + added), out.length);
      out.splice(i, 0, { __undo: true, pid: u.pid, entry: u });
      added++;
    }
    return out;
  }, [effectivePopups, inlineUndos, pendingRestore]);

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
      e.preventDefault();
    }
  };
  const handleTouchEnd = (id, e) => {
    const s = swipeState[id];
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.startX;
    const el = e.currentTarget;
    if (s.isSwiping && Math.abs(dx) > 100) {
      el.style.removeProperty('--swipe-x'); el.style.opacity = '';
      el.classList.add(dx > 0 ? 'animate-slideOut' : 'animate-slideOutLeft');
      setTimeout(() => onClose(id), 300);
    } else {
      el.style.removeProperty('--swipe-x'); el.style.opacity = '';
    }
    setSwipeState(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // ---- Render helpers -------------------------------------------------------

  const renderNutritionDetails = (data) => {
    const { nutrition, detailedItems = [] } = data;
    return (
      <div className="bg-white rounded-lg overflow-hidden">
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
                      <p className="text-[11px] text-gray-500">{item.portionDescription}</p>
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

  const renderCardShell = ({ children, index, total, id, touchHandlers }) => {
    const isTop = index === total - 1;
    const stackOffset = total > 1 ? (total - 1 - index) * 2 : 0;
    const scaleOffset = total > 1 ? (total - 1 - index) * 0.01 : 0;
    const opacityOffset = total > 1 ? Math.max(0.8, 1 - (total - 1 - index) * 0.08) : 1;
    const showFull = isStackExpanded || isTop || total === 1;
    const marginTop = isStackExpanded ? (index === 0 ? 0 : '4px') : (index === 0 ? 0 : `-${60 - (total - 1 - index) * 2}px`);
    const baseTransform = !isStackExpanded ? `translateY(-${stackOffset}px) scale(${1 - scaleOffset})` : '';

    return (
      <div
        key={id}
        className={`relative pointer-events-auto w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 ease-out
          ${showFull && isStackExpanded && total > 1 ? 'animate-stackExpand' : ''}`}
        style={{
          transform: `${baseTransform} translateX(var(--swipe-x, 0px))`.trim(),
          opacity: showFull ? 1 : opacityOffset,
          zIndex: 50 + index,
          marginTop,
          boxShadow:
            total > 1 && !isStackExpanded
              ? `0 ${Math.max(2, 6 - index)}px ${Math.max(4, 12 - index * 2)}px rgba(0,0,0,${Math.max(0.08, 0.15 - index * 0.03)})`
              : '0 4px 12px rgba(0,0,0,0.1)'
        }}
        {...touchHandlers}
      >
        {children}
      </div>
    );
  };

  // Inline UNDO card (replaces a deleted card at the same index)
  const UndoInline = ({ pid, entry, index, total }) => {
  const { popup, expiresAt, ttlSeconds = UNDO_SECONDS } = entry;

  // Text refresh only (doesn't touch the bar animation)
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 500); // lighter & smooth
    return () => clearInterval(iv);
  }, []);

  // Freeze animation config at mount so it never restarts on re-renders
  const { totalS, delayAtMount } = React.useMemo(() => {
    const totalS = Math.max(0, ttlSeconds);
    const startedAt = expiresAt - totalS * 1000;
    const elapsed = Math.min(totalS, Math.max(0, (Date.now() - startedAt) / 1000));
    return { totalS, delayAtMount: -elapsed }; // negative delay jumps to the correct point
  }, [expiresAt, ttlSeconds]);

  const remaining = Math.ceil(Math.max(0, expiresAt - now) / 1000);
  const title = popup?.nutritionData?.category?.name || 'Food';

  const handleUndo = async () => {
    // optimistically restore right where it was
    setInlineUndos(prev => { const n = { ...prev }; delete n[pid]; return n; });
    setPendingRestore(prev => ({ ...prev, [popup.id]: { popup, index } }));

    try {
      if (popup.analysisId) {
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/undo-deleted-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: popup.analysisId })
        });
        const data = await res.json();
        if (!data?.success) throw new Error(data?.message || 'Undo failed');
      }
      onRestore && onRestore(popup.id, popup);
    } catch (e) {
      // revert if server undo fails
      setPendingRestore(prev => { const n = { ...prev }; delete n[popup.id]; return n; });
      setInlineUndos(prev => ({ ...prev, [pid]: { popup, expiresAt, ttlSeconds, index } }));
      alert(e?.message || 'Failed to undo. Please try again.');
    }
  };

  // shell wrapper you already have:
  return renderCardShell({
    id: `undo-${pid}`,
    index,
    total,
    touchHandlers: {}, // no swipe on undo row
    children: (
      <div className="relative p-3 animate-fadeIn">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">🗑️</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 truncate">
              <span className="font-medium">Removed</span> “{title}”
            </p>
            <p className="text-[11px] text-amber-700/80">Undo available for {remaining}s</p>
          </div>
          <button
            onClick={handleUndo}
            className="px-3 py-1.5 rounded-full text-sm font-medium border border-amber-300 text-amber-800
                       hover:bg-amber-100 active:scale-95 transition"
          >
            Undo
          </button>
        </div>

        {/* smooth, GPU-accelerated cooldown bar */}
        <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200 overflow-hidden rounded-b-xl">
          <span
            key={pid} /* force one-time mount */
            className="block h-full bg-amber-600 origin-left will-change-transform"
            style={{
              transformOrigin: 'left',
              transform: 'translateZ(0)',             // GPU hint
              animation: `countdown-shrink ${totalS}s linear ${delayAtMount}s forwards`
            }}
          />
        </span>
      </div>
    )
  });
};


  const renderPopup = (popup, id, isSingle, index, total) => {
    const data  = isSingle ? nutritionData : popup.nutritionData;
    const image = isSingle ? imagePreview   : popup.imagePreview;
    if (!data || !isValidNutritionData(data)) return null;
    const isExpanded = expandedId === id;

    return renderCardShell({
      id,
      index,
      total,
      touchHandlers: {
        onClick: total > 1 ? handleStackClick : undefined,
        onTouchStart: (e) => handleTouchStart(id, e),
        onTouchMove:  (e) => handleTouchMove(id, e),
        onTouchEnd:   (e) => handleTouchEnd(id, e),
      },
      children: (
        <>
          <div className="p-3">
            <div className="flex items-start gap-3">
              {image && (
                <img src={image} alt="Food preview"
                  className="w-16 h-16 object-cover rounded-lg border border-gray-100 flex-shrink-0"/>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800 text-sm truncate">
                    {data?.category?.name || 'Food'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-green-50 text-xs text-green-600 font-medium whitespace-nowrap">
                    ✓ Saved
                  </span>
                  {total > 1 && index === total - 1 && !isStackExpanded && (
                    <span className="px-1.5 py-0.5 rounded-md bg-green-50 text-xs text-green-600 font-medium whitespace-nowrap">
                      +{Math.max(0, total - 1)} more
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500 mb-1.5">
                  <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                    <span>{data?.nutrition?.calories || 0} kcal</span>
                    <span>· {data?.nutrition?.protein || 0}g protein</span>
                    <span>· {data?.nutrition?.carbs || 0}g carbs</span>
                    <span>· {data?.nutrition?.fat || 0}g fat</span>
                  </div>
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
              {isExpanded && renderNutritionDetails(data)}
            </div>
          </div>

          {isExpanded && (
            <div className="px-3 pb-3">
              <button
                disabled={deletingId === id}
                onClick={async () => {
                  if (open && !popups) { onDelete(); return; } // legacy

                  const analysisId = popup.analysisId;
                  if (!analysisId) { onDelete(id); return; }

                  setDeletingId(id);
                  try {
                    const res = await fetch(`${apiBaseUrl}/api/delete-background-analysis`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: analysisId })
                    });
                    const json = await res.json();
                    if (!json?.success) throw new Error(json?.message || 'Failed to delete');

                    // remove from parent list
                    onDelete(id);

                    // create inline undo placeholder at this exact index
                    const pid = `undo-${id}-${Date.now()}`;
                    setInlineUndos(prev => ({
                      ...prev,
                      [pid]: { popup, expiresAt: Date.now() + UNDO_SECONDS * 1000, ttlSeconds: UNDO_SECONDS, index }
                    }));
                  } catch (e) {
                    alert(e?.message || 'Failed to delete. Please try again.');
                  } finally {
                    setDeletingId(null);
                  }
                }}
                className={`w-full text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5
                  ${deletingId === id ? 'bg-red-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deletingId === id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          )}
        </>
      )
    });
  };

  // --- Render root -----------------------------------------------------------

  const hasAnything = composed.length > 0 || Object.keys(inlineUndos).length > 0 || Object.keys(pendingRestore).length > 0;
  if (!hasAnything) return null;

  // Single legacy mode
  if (open && !popups) {
    return (
      <div className="fixed z-50 bottom-4 left-4 right-4 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm">
          {renderPopup({ id: 'legacy', imagePreview, nutritionData }, 'single', true, 0, 1)}
        </div>
      </div>
    );
  }

  // Stack mode with inline undo
  return (
    <div ref={containerRef} className="fixed z-50 bottom-4 left-4 right-4 flex justify-center pointer-events-none">
      <div className="relative w-full max-w-sm pointer-events-auto">
        {composed.map((item, idx) => {
          const total = composed.length;
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

        {isStackExpanded && composed.length > 1 && (
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
