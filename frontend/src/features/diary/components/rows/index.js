/**
 * frontend/src/features/diary/components/rows/index.js
 *
 * Interactive card components for the Diary feed (PR-D / ADR-0003).
 *
 * Each row renders a single entry from the `listDiaryEntries` response,
 * receiving exactly the projected `payload` shape from
 * `backend/features/background-analysis/diary.service.js :: toDiaryEntry`.
 *
 * Design constraints:
 *   - Interactive with swipe-to-delete gestures matching original dashboard tabs
 *   - Visual chrome mirrors the existing per-tab cards (glassmorphism
 *     + image thumb + right-aligned primary value)
 *   - Uses shared useSwipeToDelete hook (§2.4)
 *   - Each row is stateless; delete callbacks are passed from parent DiaryFeed
 */

import React, { useState, useRef, useEffect } from 'react';
import { Smartphone, GraduationCap, HelpCircle, Share2, ArrowUp, ArrowDown } from 'lucide-react';
import { useSwipeToDelete } from '../../../../shared/hooks/useSwipeToDelete';
import { parseAnalysisData, recalculateTotals, getMealCategory } from '../../../nutrition/services/nutritionDashboard/analysisHelpers';
import { captureAndShare } from '../../../../shared/utils/shareUtils';
import { formatBusinessTime, DEFAULT_BUSINESS_TIMEZONE } from '../../../../shared/utils/datetimeUtils';
import { DIARY_FOOD_ACTIVITY } from '../../domain/activityType';
import { resolveFoodRowPresentation } from '../../domain/foodRowDisplay';
import {
  buildDiaryShareSuffix,
  resolveWeightDeltaDisplay,
} from '../../domain/share';
import { resolveDiaryThumbSource } from '../../utils/diaryThumbUrl';

/** Red up / green down arrow for weight delta (SVG — avoids blue emoji squares). */
function WeightDeltaArrow({ direction, className = '' }) {
  if (direction === 'up') {
    return <ArrowUp className={`inline-block w-3 h-3 shrink-0 ${className}`} aria-hidden="true" strokeWidth={2.5} />;
  }
  if (direction === 'down') {
    return <ArrowDown className={`inline-block w-3 h-3 shrink-0 ${className}`} aria-hidden="true" strokeWidth={2.5} />;
  }
  return null;
}
/** Swipe-to-delete affordance; disabled when parent passes canDelete={false}. */
function useDiaryRowSwipe({ canDelete = true, onDelete, entry }) {
  const swipeEnabled = canDelete !== false;
  const swipe = useSwipeToDelete({
    onDelete: swipeEnabled ? () => onDelete?.(entry) : undefined,
  });
  return { swipe, swipeEnabled };
}

function resolveFoodShareTotals(payload, foodData) {
  const t = payload?.totals || {};
  const n = foodData?.nutrition || {};
  const fromItems = foodData?.detailedItems?.length
    ? recalculateTotals(foodData.detailedItems)
    : null;

  const pick = (key) => t[key] ?? n[key] ?? fromItems?.[key] ?? 0;

  return {
    calories: pick('calories'),
    protein: pick('protein'),
    carbs: pick('carbs'),
    fat: pick('fat'),
    fiber: pick('fiber'),
    sugar: pick('sugar'),
    sodium: pick('sodium'),
    cholesterol: pick('cholesterol'),
  };
}

const WeighingScaleIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    <path d="M6 10 C6 7, 18 7, 18 10" />
    <line x1="12" y1="12" x2="12" y2="9" />
  </svg>
);

// ─── shared chrome ──────────────────────────────────────────────────────────

function formatTime(iso, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  return formatBusinessTime(iso, timezoneIana);
}

const MEAL_BADGE_BY_CATEGORY = {
  breakfast: { label: 'Breakfast', cls: 'text-orange-600 bg-orange-50' },
  'morning-snack': { label: 'Snack', cls: 'text-blue-600 bg-blue-50' },
  lunch: { label: 'Lunch', cls: 'text-emerald-600 bg-emerald-50' },
  'evening-snack': { label: 'Snack', cls: 'text-blue-600 bg-blue-50' },
  dinner: { label: 'Dinner', cls: 'text-purple-600 bg-purple-50' },
  'late-night': { label: 'Snack', cls: 'text-blue-600 bg-blue-50' },
};

/** Returns a meal-type badge based on capturedAt in the owner's business timezone. */
function getMealLabel(iso, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  if (!iso) return null;
  const category = getMealCategory(iso, timezoneIana);
  return MEAL_BADGE_BY_CATEGORY[category] || MEAL_BADGE_BY_CATEGORY['late-night'];
}

function Thumb({
  imageBase64,
  imagePath,
  imageUrl = null,
  imageUrlFormat = null,
  fallback,
  hasImage = false,
}) {
  const [lazySrc, setLazySrc] = useState(null);

  useEffect(() => {
    if (imageBase64 && String(imageBase64).trim() !== '') {
      setLazySrc(null);
      return undefined;
    }
    if (imagePath && (String(imagePath).startsWith('http') || String(imagePath).startsWith('data:'))) {
      setLazySrc(null);
      return undefined;
    }
    if (!imageUrl) {
      setLazySrc(null);
      return undefined;
    }

    if (imageUrlFormat === 'raw' || imageUrlFormat === 'data') {
      setLazySrc(imageUrl);
      return undefined;
    }

    // weight / education return JSON { image | imageBase64 }
    let cancelled = false;
    setLazySrc(null);
    fetch(imageUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const b64 = json.image || json.imageBase64 || json?.data?.imageBase64;
        if (!b64 || String(b64).trim() === '') return;
        const raw = String(b64);
        setLazySrc(raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`);
      })
      .catch(() => { /* non-critical thumb */ });
    return () => { cancelled = true; };
  }, [imageBase64, imagePath, imageUrl, imageUrlFormat]);

  const src =
    imageBase64 && String(imageBase64).trim() !== ''
      ? (String(imageBase64).startsWith('data:image')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`)
      : (lazySrc
        || (imagePath && (String(imagePath).startsWith('http') || String(imagePath).startsWith('data:'))
          ? imagePath
          : null));
  const showPlaceholder = !src && hasImage;

  return (
    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : showPlaceholder ? (
        <span className="w-full h-full bg-gray-200 animate-pulse" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{fallback}</span>
      )}
    </div>
  );
}

/** Build Thumb props from a diary entry + owner context. */
function thumbPropsFromEntry(entry, { ownerUserId, viewerUserId } = {}) {
  const p = entry?.payload || {};
  const { src, format } = resolveDiaryThumbSource(entry, { ownerUserId, viewerUserId });
  return {
    imageBase64: p.imageBase64 || null,
    imagePath: p.imagePath || null,
    imageUrl: src,
    imageUrlFormat: format,
    hasImage: Boolean(p.hasImage || p.imageBase64 || p.imagePath || src),
  };
}

/**
 * Keeps list-slot height stable while the tile slides away horizontally.
 * Collapsing to 0 made the row below jump up before the inline undo card
 * mounted — undo must stay in the same card slot.
 */
function SwipeDeleteShell({ swipe, enabled = true, children }) {
  const leaving = enabled && swipe.leaving;

  return (
    <div
      className="relative w-full"
      style={{
        touchAction: (swipe.dragging && enabled) ? 'none' : 'pan-y',
        minHeight: 84,
        overflow: 'hidden',
        overflowAnchor: 'none',
        pointerEvents: leaving ? 'none' : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** Card transform — horizontal slide only (no scale → no vertical shift). */
function swipeCardStyle(swipe, { enabled = true } = {}) {
  if (!enabled) return undefined;
  return {
    transform: `translateX(${swipe.dx}px)`,
    transformOrigin: 'left center',
    transition: swipe.animating ? 'transform 220ms ease-out' : 'none',
    willChange: 'transform',
  };
}

// ─── kind: food ─────────────────────────────────────────────────────────────

export function FoodRow({
  entry,
  onOpen,
  onDelete,
  canDelete = true,
  hideTime = false,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
  ownerUserId = null,
  viewerUserId = null,
}) {
  const p = entry.payload || {};
  const cal = p.totals?.calories ?? 0;
  const { swipe, swipeEnabled } = useDiaryRowSwipe({ canDelete, onDelete, entry });
  const [isSharing, setIsSharing] = useState(false);
  const [shareImgSrc, setShareImgSrc] = useState(null);
  const shareCardRef = useRef(null);
  const thumb = thumbPropsFromEntry(entry, { ownerUserId, viewerUserId });

  // Prefer lean listSummary from paginated API; fall back to legacy analysisData.
  const listSummary = p.listSummary || null;
  const foodData = listSummary
    ? {
        name: listSummary.name || 'Food',
        nutrition: {
          calories: cal,
          protein: p.totals?.protein ?? 0,
          carbs: p.totals?.carbs ?? 0,
          fat: p.totals?.fat ?? 0,
          fiber: p.totals?.fiber ?? 0,
          sugar: p.totals?.sugar ?? null,
          sodium: p.totals?.sodium ?? null,
          cholesterol: p.totals?.cholesterol ?? null,
          glycemic_index: p.totals?.glycemicIndex ?? null,
        },
        detailedItems: Array.isArray(listSummary.items)
          ? listSummary.items.map((item) => ({
              name: item.name,
              calories: item.calories,
              volume_ml: listSummary.volumeMl,
              scoops: listSummary.scoops,
            }))
          : [],
      }
    : parseAnalysisData(p.analysisData);
  const mealName = foodData.name || listSummary?.name || 'Food';
  const meal = getMealLabel(entry.capturedAt, timezoneIana);
  const processedByForType = p.processedBy
    || (listSummary?.activityType === 'water' ? 'water_preset'
      : listSummary?.activityType === 'afresh' ? 'afresh_preset'
        : listSummary?.activityType === 'shake' ? 'shake_calculator'
          : null);
  const presentation = resolveFoodRowPresentation({
    processedBy: processedByForType,
    analysisData: listSummary ? null : p.analysisData,
    foodData,
    calories: cal,
    mealLabel: meal?.label || null,
    glycemicIndex: p.totals?.glycemicIndex ?? foodData?.nutrition?.glycemic_index ?? null,
  });
  const {
    activityType,
    showMealBadge,
    thumbFallback,
    primaryValue,
    primaryUnit,
    ariaValue,
    secondaryLabel,
    shareText,
  } = presentation;
  const isWater = activityType === DIARY_FOOD_ACTIVITY.WATER;
  const isAfresh = activityType === DIARY_FOOD_ACTIVITY.AFRESH;
  const isShake = activityType === DIARY_FOOD_ACTIVITY.SHAKE;
  const showNutritionShare = !isWater && !isAfresh;
  const foodItems = Array.isArray(foodData.detailedItems) ? foodData.detailedItems : [];

  // Lazy-hydrate share card image once (on share or when thumb URL is raw).
  useEffect(() => {
    if (thumb.imageBase64) {
      const raw = String(thumb.imageBase64);
      setShareImgSrc(raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`);
      return undefined;
    }
    if (thumb.imageUrlFormat === 'raw' && thumb.imageUrl) {
      setShareImgSrc(thumb.imageUrl);
      return undefined;
    }
    if (thumb.imageUrlFormat === 'json' && thumb.imageUrl) {
      let cancelled = false;
      fetch(thumb.imageUrl)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (cancelled || !json) return;
          const b64 = json.image || json.imageBase64;
          if (!b64) return;
          const raw = String(b64);
          setShareImgSrc(raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }
    setShareImgSrc(thumb.imagePath || null);
    return undefined;
  }, [thumb.imageBase64, thumb.imageUrl, thumb.imageUrlFormat, thumb.imagePath]);

  const imgSrc = shareImgSrc;
  const t = resolveFoodShareTotals(p, foodData);
  const macros = [
    { label: 'Calories', value: Math.round(t.calories ?? 0), unit: 'kcal', color: '#f97316' },
    { label: 'Protein',  value: Math.round(t.protein  ?? 0), unit: 'g',    color: '#3b82f6' },
    { label: 'Carbs',    value: Math.round(t.carbs    ?? 0), unit: 'g',    color: '#eab308' },
    { label: 'Fat',      value: Math.round(t.fat      ?? 0), unit: 'g',    color: '#ef4444' },
    { label: 'Fiber',    value: Math.round(t.fiber    ?? 0), unit: 'g',    color: '#22c55e' },
    { label: 'Sugar',    value: Math.round(t.sugar    ?? 0), unit: 'g',    color: '#a855f7' },
  ];
  const shareTime = entry.capturedAt
    ? new Date(entry.capturedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : '';

  // Share taps the full off-screen nutrition card, not the compact row
  const handleShare = async (e) => {
    e.stopPropagation();
    if (swipe.dragging || swipe.leaving || isSharing) return;
    const target = shareCardRef.current || swipe.elRef.current;
    if (!target) return;
    setIsSharing(true);
    try {
      await captureAndShare(target, {
        title: mealName,
        text: shareText,
        fileName: `wellness-${activityType}-${Date.now()}.png`,
      });
    } catch (err) {
      if (!err?.message?.toLowerCase().includes('cancel')) {
        console.error('[FoodRow] Share failed:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SwipeDeleteShell swipe={swipe} enabled={swipeEnabled}>
      {/* Off-screen full nutrition share card — captured by html2canvas on share tap */}
      <div
        ref={shareCardRef}
        aria-hidden="true"
        style={{ position: 'fixed', left: '-9999px', top: 0, width: 500, background: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', padding: '16px 20px 12px' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0, letterSpacing: 0.3 }}>WELLNESS VALLEY · {shareTime}</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '4px 0 0', lineHeight: 1.2 }}>{mealName}</p>
          {showMealBadge && meal && (
            <span style={{ display: 'inline-block', marginTop: 5, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              {meal.label}
            </span>
          )}
        </div>
        {/* Food photo — include whenever available (water / afresh / food) */}
        {imgSrc && (
          <img src={imgSrc} alt="" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 420, objectFit: 'contain', background: '#f9fafb' }} />
        )}
        {/* Activity-specific body */}
        {isWater && (
          <div style={{ padding: '28px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 40, margin: 0 }} aria-hidden="true">💧</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#0ea5e9', margin: '8px 0 0' }}>
              {primaryValue}{primaryUnit ? ` ${primaryUnit}` : ''}
            </p>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 0 0', fontWeight: 600 }}>Water Intake</p>
          </div>
        )}
        {isAfresh && (
          <div style={{ padding: '28px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 40, margin: 0 }} aria-hidden="true">🥤</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#ea580c', margin: '8px 0 0' }}>
              {primaryValue}{primaryUnit ? ` ${primaryUnit}` : ''}
            </p>
            {secondaryLabel ? (
              <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0', fontWeight: 600 }}>{secondaryLabel}</p>
            ) : null}
            <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0', fontWeight: 600 }}>Afresh</p>
          </div>
        )}
        {showNutritionShare && (
          <>
            {/* Macro grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '14px 14px 8px' }}>
              {macros.map((m) => (
                <div key={m.label} style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 6px', textAlign: 'center', border: '1px solid #f3f4f6' }}>
                  <p style={{ fontSize: 17, fontWeight: 700, color: m.color, margin: 0, lineHeight: 1 }}>
                    {m.value}<span style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af' }}> {m.unit}</span>
                  </p>
                  <p style={{ fontSize: 9, color: '#6b7280', margin: '3px 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{m.label}</p>
                </div>
              ))}
            </div>
            {/* Food items */}
            {foodItems.length > 0 && (
              <div style={{ padding: '0 14px 14px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {isShake ? 'Shake' : 'Foods Detected'}
                </p>
                {foodItems.slice(0, 8).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontSize: 12, color: '#374151', margin: 0, flex: 1 }}>{item.name || 'Item'}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0, fontWeight: 500 }}>
                      {Math.round(item.calories ?? item.nutrition?.calories ?? 0)} kcal
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {/* Footer */}
        <div style={{ background: '#f0fdf4', padding: '8px 14px', borderTop: '1px solid #dcfce7' }}>
          <p style={{ fontSize: 9, color: '#16a34a', margin: 0, textAlign: 'center', fontWeight: 600, letterSpacing: 0.3 }}>Track your wellness journey • Wellness Valley</p>
        </div>
      </div>
      {swipeEnabled && (
        <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
          <div
            className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
            style={{
              opacity: swipe.progress,
              transform: `scale(${0.6 + swipe.progress * 0.4})`,
              transition: swipe.dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
            }}
          >
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              style={{ transform: `rotate(${swipe.armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: swipe.armed ? 2.2 : 2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            </svg>
          </div>
        </div>
      )}

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`${mealName}, ${ariaValue}`}
        data-testid="diary-row-food"
        data-activity={activityType}
        {...(swipeEnabled ? swipe.touchHandlers : {})}
        {...(swipeEnabled ? swipe.pointerHandlers : {})}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={swipeCardStyle(swipe, { enabled: swipeEnabled })}
      >
        {swipeEnabled && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
            style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />
        )}

        <Thumb {...thumb} fallback={thumbFallback} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-semibold text-gray-900 truncate">{mealName}</h4>
            {showMealBadge && meal && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${meal.cls}`}>
                {meal.label}
              </span>
            )}
          </div>
          {!hideTime && (
            <p className="text-xs text-gray-500">{formatTime(entry.capturedAt, timezoneIana)}</p>
          )}
          {secondaryLabel && (
            <p className="text-[10px] text-gray-400 mt-0.5">{secondaryLabel}</p>
          )}
          {!isWater && !isAfresh && (p.totals?.protein > 0 || p.totals?.carbs > 0 || p.totals?.fat > 0) && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              P {Math.round(p.totals?.protein ?? 0)}g · C {Math.round(p.totals?.carbs ?? 0)}g · F {Math.round(p.totals?.fat ?? 0)}g
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-base text-gray-900">{primaryValue}</p>
          {primaryUnit ? (
            <p className="text-[11px] text-gray-500 -mt-0.5">{primaryUnit}</p>
          ) : null}
        </div>
        {/* Share button — stopPropagation prevents opening the detail modal */}
        <button
          aria-label={`Share this ${activityType} entry`}
          onClick={handleShare}
          disabled={isSharing}
          className="shrink-0 ml-1 p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          {isSharing
            ? <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            : <Share2 className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
    </SwipeDeleteShell>
  );
}

// ─── kind: weight ───────────────────────────────────────────────────────────

export function WeightRow({
  entry,
  onOpen,
  onDelete,
  canDelete = true,
  hideTime = false,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
  previousWeight = null,
  ownerUserId = null,
  viewerUserId = null,
}) {
  const p = entry.payload || {};
  const { swipe, swipeEnabled } = useDiaryRowSwipe({ canDelete, onDelete, entry });
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef(null);
  const thumb = thumbPropsFromEntry(entry, { ownerUserId, viewerUserId });
  const delta = resolveWeightDeltaDisplay(previousWeight, p.weight);
  const shareText = buildDiaryShareSuffix('weight', {
    previousWeight,
    currentWeight: p.weight,
  });
  const shareTime = entry.capturedAt
    ? new Date(entry.capturedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : '';

  const handleShare = async (e) => {
    e.stopPropagation();
    if (swipe.dragging || swipe.leaving || isSharing) return;
    const target = shareCardRef.current || swipe.elRef.current;
    if (!target) return;
    setIsSharing(true);
    try {
      await captureAndShare(target, {
        title: `Weight ${p.weight} kg`,
        text: shareText,
        fileName: `wellness-weight-${Date.now()}.png`,
      });
    } catch (err) {
      if (!err?.message?.toLowerCase().includes('cancel')) {
        console.error('[WeightRow] Share failed:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SwipeDeleteShell swipe={swipe} enabled={swipeEnabled}>
      {/* Off-screen weight share card */}
      <div
        ref={shareCardRef}
        aria-hidden="true"
        style={{ position: 'fixed', left: '-9999px', top: 0, width: 420, background: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
      >
        <div style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', padding: '16px 20px 12px' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0, letterSpacing: 0.3 }}>WELLNESS VALLEY · {shareTime}</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '4px 0 0', lineHeight: 1.2 }}>⚖️ Weight Update</p>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Previous Weight</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
              {previousWeight != null && Number.isFinite(Number(previousWeight))
                ? `${Number(previousWeight)} kg`
                : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Current Weight</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{p.weight} kg</span>
          </div>
          {delta.label && (
            <p style={{
              margin: 0,
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: delta.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}>
              <WeightDeltaArrow direction={delta.direction} className="" />
              <span style={{ color: delta.color }}>{delta.label}</span>
            </p>
          )}
        </div>
        <div style={{ background: '#f0fdf4', padding: '8px 14px', borderTop: '1px solid #dcfce7' }}>
          <p style={{ fontSize: 9, color: '#16a34a', margin: 0, textAlign: 'center', fontWeight: 600, letterSpacing: 0.3 }}>Track your wellness journey • Wellness Valley</p>
        </div>
      </div>

      {swipeEnabled && (
        <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
          <div
            className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
            style={{
              opacity: swipe.progress,
              transform: `scale(${0.6 + swipe.progress * 0.4})`,
              transition: swipe.dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
            }}
          >
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              style={{ transform: `rotate(${swipe.armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: swipe.armed ? 2.2 : 2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            </svg>
          </div>
        </div>
      )}

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`Weight, ${p.weight} kilograms`}
        data-testid="diary-row-weight"
        {...(swipeEnabled ? swipe.touchHandlers : {})}
        {...(swipeEnabled ? swipe.pointerHandlers : {})}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={swipeCardStyle(swipe, { enabled: swipeEnabled })}
      >
        {swipeEnabled && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
            style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />
        )}

        <Thumb {...thumb} fallback={<WeighingScaleIcon className="w-6 h-6 text-emerald-600" />} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">Weight</h4>
          {!hideTime && (
            <p className="text-xs text-gray-500">
              {formatTime(entry.capturedAt, timezoneIana)}
            </p>
          )}
          {delta.label && (
            <p className={`text-[10px] mt-0.5 font-medium ${delta.className} flex items-center gap-0.5`}>
              <WeightDeltaArrow direction={delta.direction} className={delta.className} />
              <span>{delta.label}</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-base text-gray-900">{p.weight}</p>
          <p className="text-[11px] text-gray-500 -mt-0.5">kg</p>
        </div>
        {/* Share button — stopPropagation prevents opening the detail modal */}
        <button
          aria-label="Share this weight entry"
          onClick={handleShare}
          disabled={isSharing}
          className="shrink-0 ml-1 p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          {isSharing
            ? <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            : <Share2 className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
    </SwipeDeleteShell>
  );
}

// ─── kind: education ────────────────────────────────────────────────────────

export function EducationRow({
  entry,
  onOpen,
  onDelete,
  canDelete = true,
  hideTime = false,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
  ownerUserId = null,
  viewerUserId = null,
}) {
  const p = entry.payload || {};
  const { swipe, swipeEnabled } = useDiaryRowSwipe({ canDelete, onDelete, entry });
  const thumb = thumbPropsFromEntry(entry, { ownerUserId, viewerUserId });
  const [isSharing, setIsSharing] = useState(false);
  const shareText = buildDiaryShareSuffix('education', {
    platform: p.platform,
    session: p.topic,
  });

  const handleShare = async (e) => {
    e.stopPropagation();
    if (swipe.dragging || swipe.leaving || isSharing || !swipe.elRef.current) return;
    setIsSharing(true);
    try {
      await captureAndShare(swipe.elRef.current, {
        title: `Education - ${p.topic || 'Session'}`,
        text: shareText,
        fileName: `wellness-education-${Date.now()}.png`,
      });
    } catch (err) {
      if (!err?.message?.toLowerCase().includes('cancel')) {
        console.error('[EducationRow] Share failed:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SwipeDeleteShell swipe={swipe} enabled={swipeEnabled}>
      {swipeEnabled && (
        <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
          <div
            className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
            style={{
              opacity: swipe.progress,
              transform: `scale(${0.6 + swipe.progress * 0.4})`,
              transition: swipe.dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
            }}
          >
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              style={{ transform: `rotate(${swipe.armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: swipe.armed ? 2.2 : 2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            </svg>
          </div>
        </div>
      )}

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`Education, ${p.topic || 'session'}`}
        data-testid="diary-row-education"
        {...(swipeEnabled ? swipe.touchHandlers : {})}
        {...(swipeEnabled ? swipe.pointerHandlers : {})}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={swipeCardStyle(swipe, { enabled: swipeEnabled })}
      >
        {swipeEnabled && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
            style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />
        )}

        <Thumb {...thumb} fallback={<GraduationCap className="w-6 h-6 text-indigo-600" />} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">{p.topic || 'Education'}</h4>
          {!hideTime && (
            <p className="text-xs text-gray-500">
              {formatTime(entry.capturedAt, timezoneIana)}
              {p.platform ? ` · ${p.platform}` : ''}
            </p>
          )}
        </div>
        <button
          aria-label="Share this education entry"
          onClick={handleShare}
          disabled={isSharing}
          className="shrink-0 ml-1 p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          {isSharing
            ? <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            : <Share2 className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
    </SwipeDeleteShell>
  );
}

// ─── kind: watch ────────────────────────────────────────────────────────────

export function WatchRow({ entry, onOpen, onDelete, canDelete = true, hideTime = false, timezoneIana = DEFAULT_BUSINESS_TIMEZONE }) {
  const p = entry.payload || {};
  const { swipe, swipeEnabled } = useDiaryRowSwipe({ canDelete, onDelete, entry });

  return (
    <SwipeDeleteShell swipe={swipe} enabled={swipeEnabled}>
      {swipeEnabled && (
        <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
          <div
            className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
            style={{
              opacity: swipe.progress,
              transform: `scale(${0.6 + swipe.progress * 0.4})`,
              transition: swipe.dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
            }}
          >
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              style={{ transform: `rotate(${swipe.armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: swipe.armed ? 2.2 : 2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            </svg>
          </div>
        </div>
      )}

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`Smartwatch activity, ${p.kcal} kilocalories burned`}
        data-testid="diary-row-watch"
        {...(swipeEnabled ? swipe.touchHandlers : {})}
        {...(swipeEnabled ? swipe.pointerHandlers : {})}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={swipeCardStyle(swipe, { enabled: swipeEnabled })}
      >
        {swipeEnabled && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
            style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />
        )}

        <Thumb imageBase64={p.imageBase64} imagePath={p.imagePath} hasImage={p.hasImage} fallback={<Smartphone className="w-6 h-6 text-amber-600" aria-hidden="true" />} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">Smartwatch</h4>
          {!hideTime && (
            <p className="text-xs text-gray-500">{formatTime(entry.capturedAt, timezoneIana)}</p>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-base text-gray-900">{p.kcal}</p>
          <p className="text-[11px] text-gray-500 -mt-0.5">kcal burned</p>
        </div>
      </div>
    </SwipeDeleteShell>
  );
}

// ─── kind: unknown (the "Other" card) ───────────────────────────────────────
// Supports both swipe-to-delete (quick removal) and tap-to-open.
//
// When `isAnalyzing` is true (Dashboard is running AI before opening the
// modal) the card displays an inline loading state, disables tap, and
// prevents duplicate AI requests. Swipe-to-delete is also disabled during
// analysis to avoid race conditions with the pending AI request.

/** Format elapsed seconds as M:SS (e.g. 0:05, 1:23). */
function formatElapsed(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format remaining seconds as a user-friendly countdown.
 * >60 s → “~2m”  |  ≤60 s → “~45s”  |  0 → “…”
 */
function formatRemaining(secs) {
  if (secs <= 0) return '…';
  if (secs >= 60) return `~${Math.ceil(secs / 60)}m`;
  return `~${secs}s`;
}

/**
 * Total worst-case budget for all 3 Phase-1 attempts including back-off
 * (3 × 40 s timeout + 1.5 s + 3 s back-off) + 15 s Manual Log grace.
 */
const TOTAL_BUDGET_SECS = 140;

export function OtherRow({
  entry,
  onOpen,
  onDelete,
  canDelete = true,
  isAnalyzing = false,
  isBackgroundPending = false,
  needsClassify = false,
  hideTime = false,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
  currentAttempt = null,
  totalAttempts = null,
  ownerUserId = null,
  viewerUserId = null,
}) {
  const p = entry.payload || {};
  const thumb = thumbPropsFromEntry(entry, { ownerUserId, viewerUserId });
  const { swipe, swipeEnabled: canSwipeDelete } = useDiaryRowSwipe({ canDelete, onDelete, entry });
  const swipeEnabled = canSwipeDelete && !isAnalyzing;
  const showBackgroundHint = isBackgroundPending && !isAnalyzing;
  const showNeedsClassify = needsClassify && !isAnalyzing && !showBackgroundHint;

  // Elapsed-time ticker — active for both isAnalyzing and isBackgroundPending.
  //   isAnalyzing      (user re-detect tap)   → starts from Date.now()
  //   isBackgroundPending (camera capture flow) → starts from entry.capturedAt
  //     so the timer reflects total analysis time, not just elapsed in this render.
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const startRef = useRef(null);
  useEffect(() => {
    const active = isAnalyzing || isBackgroundPending;
    if (!active) {
      setElapsedSecs(0);
      startRef.current = null;
      return undefined;
    }
    if (isBackgroundPending && !isAnalyzing && entry.capturedAt) {
      const t = new Date(entry.capturedAt).getTime();
      startRef.current = Number.isFinite(t) ? t : Date.now();
    } else {
      startRef.current = Date.now();
    }
    setElapsedSecs(Math.max(0, Math.floor((Date.now() - startRef.current) / 1_000)));
    const id = setInterval(() => {
      setElapsedSecs(Math.max(0, Math.floor((Date.now() - startRef.current) / 1_000)));
    }, 1_000);
    return () => clearInterval(id);
  }, [isAnalyzing, isBackgroundPending, entry.capturedAt]);

  return (
    <SwipeDeleteShell swipe={swipe} enabled={swipeEnabled}>
      {swipeEnabled && (
        <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
          <div
            className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
            style={{
              opacity: swipe.progress,
              transform: `scale(${0.6 + swipe.progress * 0.4})`,
              transition: swipe.dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
            }}
          >
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              style={{ transform: `rotate(${swipe.armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: swipe.armed ? 2.2 : 2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            </svg>
          </div>
        </div>
      )}

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={isAnalyzing ? -1 : 0}
        aria-disabled={isAnalyzing}
        aria-label={
          isAnalyzing
            ? 'AI is analysing this photo — please wait'
            : showBackgroundHint
            ? 'Photo uploaded — AI analysis in progress'
            : showNeedsClassify
            ? 'Photo saved — tap to choose type or analyze'
            : swipeEnabled
            ? 'Unrecognised capture, tap to identify or swipe to delete'
            : 'Unrecognised capture, tap to identify'
        }
        data-testid="diary-row-unknown"
        onClick={() => {
          if (isAnalyzing) return;
          if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry);
        }}
        onKeyDown={(e) => {
          if (isAnalyzing || swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        {...(swipeEnabled ? swipe.touchHandlers : {})}
        {...(swipeEnabled ? swipe.pointerHandlers : {})}
        className={[
          'relative z-10 rounded-xl shadow-sm p-3 flex items-center gap-3 select-none overflow-hidden transition-shadow',
          isAnalyzing
            ? 'bg-emerald-50/80 border border-emerald-200 cursor-wait'
            : showBackgroundHint
            ? 'bg-emerald-50/80 border border-emerald-200 cursor-pointer hover:shadow-md'
            : showNeedsClassify
            ? 'bg-amber-50/70 border border-amber-200 cursor-pointer hover:shadow-md'
            : `bg-white/70 backdrop-blur-xl border border-gray-200/80 cursor-pointer hover:shadow-md ${swipe.leaving ? 'pointer-events-none' : ''}`,
        ].join(' ')}
        style={swipeCardStyle(swipe, { enabled: swipeEnabled })}
      >
        {swipeEnabled && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
            style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />
        )}

        {/* AI analysis indeterminate progress bar across the card top */}
        {(isAnalyzing || showBackgroundHint) && (
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl overflow-hidden bg-emerald-100" aria-hidden="true">
            <div className="h-full bg-emerald-500 w-2/5 animate-shimmer" />
          </div>
        )}

        <Thumb {...thumb} fallback={<HelpCircle className="w-6 h-6 text-gray-500" />} />

        <div className="flex-1 min-w-0">
          {isAnalyzing ? (
            <>
              <h4 className="font-semibold text-emerald-700 truncate">
                Detecting entry…
                {currentAttempt != null && totalAttempts != null && (
                  <span className="ml-1.5 text-xs font-medium text-emerald-600/60">
                    {currentAttempt}/{totalAttempts}
                  </span>
                )}
                <span className="ml-1.5 font-mono font-normal text-emerald-600/70" aria-live="polite" aria-label={`~${Math.max(0, TOTAL_BUDGET_SECS - elapsedSecs)} seconds remaining`}>
                  {formatRemaining(Math.max(0, TOTAL_BUDGET_SECS - elapsedSecs))}
                </span>
              </h4>
              <p className="text-xs text-emerald-600/80">
                {hideTime ? 'AI is analysing your photo' : `${formatTime(entry.capturedAt, timezoneIana)} · AI is analysing`}
              </p>
            </>
          ) : showBackgroundHint ? (
            <>
              <h4 className="font-semibold text-emerald-700 truncate">
                Analyzing…
                {currentAttempt != null && totalAttempts != null && (
                  <span className="ml-1.5 text-xs font-medium text-emerald-600/60">
                    {currentAttempt}/{totalAttempts}
                  </span>
                )}
                <span className="ml-1.5 font-mono font-normal text-emerald-600/70" aria-live="polite" aria-label={`~${Math.max(0, TOTAL_BUDGET_SECS - elapsedSecs)} seconds remaining`}>
                  {formatRemaining(Math.max(0, TOTAL_BUDGET_SECS - elapsedSecs))}
                </span>
              </h4>
              <p className="text-xs text-emerald-600/80">
                {hideTime ? 'AI is analysing your photo' : `${formatTime(entry.capturedAt, timezoneIana)} · AI is analysing`}
              </p>
            </>
          ) : showNeedsClassify ? (
            <>
              <h4 className="font-semibold text-amber-800 truncate">Needs logging</h4>
              <p className="text-xs text-amber-700/80">
                {hideTime
                  ? 'Tap to choose type or analyze'
                  : `${formatTime(entry.capturedAt, timezoneIana)} · tap to choose type`}
              </p>
            </>
          ) : (
            <>
              <h4 className="font-semibold text-gray-900 truncate">Other</h4>
              <p className="text-xs text-gray-500">
                {hideTime
                  ? "couldn't identify"
                  : `${formatTime(entry.capturedAt, timezoneIana)} · couldn't identify`}
              </p>
            </>
          )}
        </div>

        {isAnalyzing ? (
          <div
            className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin shrink-0"
            aria-hidden="true"
          />
        ) : showBackgroundHint ? (
          <div
            className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin shrink-0"
            aria-hidden="true"
          />
        ) : showNeedsClassify ? (
          <span className="text-xs text-amber-700 font-medium" aria-hidden="true">Choose type</span>
        ) : (
          <span className="text-xs text-amber-600 font-medium" aria-hidden="true">Manual Log</span>
        )}
      </div>
    </SwipeDeleteShell>
  );
}

// Default export — small registry so DiaryFeed dispatches via a lookup,
// not a switch statement that duplicates kind enums.
const ROWS_BY_KIND = Object.freeze({
  food:      FoodRow,
  weight:    WeightRow,
  education: EducationRow,
  watch:     WatchRow,
  unknown:   OtherRow,
});

export default ROWS_BY_KIND;
