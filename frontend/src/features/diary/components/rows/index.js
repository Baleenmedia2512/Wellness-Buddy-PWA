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

import React, { useState, useRef } from 'react';
import { Smartphone, GraduationCap, HelpCircle, Share2 } from 'lucide-react';
import { useSwipeToDelete } from '../../../../shared/hooks/useSwipeToDelete';
import { parseAnalysisData, recalculateTotals, getMealCategory } from '../../../nutrition/services/nutritionDashboard/analysisHelpers';
import { captureAndShare } from '../../../../shared/utils/shareUtils';
import { formatBusinessTime, DEFAULT_BUSINESS_TIMEZONE } from '../../../../shared/utils/datetimeUtils';

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

function Thumb({ imageBase64, imagePath, fallback }) {
  const src =
    imageBase64 && imageBase64.trim() !== ''
      ? imageBase64.startsWith('data:image')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`
      : imagePath || null;

  return (
    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <span aria-hidden="true">{fallback}</span>
      )}
    </div>
  );
}

// ─── kind: food ─────────────────────────────────────────────────────────────

export function FoodRow({ entry, onOpen, onDelete, hideTime = false, timezoneIana = DEFAULT_BUSINESS_TIMEZONE }) {
  const p = entry.payload || {};
  const cal = p.totals?.calories ?? 0;
  const swipe = useSwipeToDelete({ onDelete: () => onDelete?.(entry) });
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef(null);

  // Parse analysisData to extract meal name and item details
  const foodData = parseAnalysisData(p.analysisData);
  const mealName = foodData.name || 'Food';
  const meal = getMealLabel(entry.capturedAt, timezoneIana);
  // Individual food items for the share card
  const foodItems = Array.isArray(foodData.detailedItems) ? foodData.detailedItems : [];

  // Resolve image src for share card
  const imgSrc = p.imageBase64 && p.imageBase64.trim() !== ''
    ? (p.imageBase64.startsWith('data:image') ? p.imageBase64 : `data:image/jpeg;base64,${p.imageBase64}`)
    : (p.imagePath || null);

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
        fileName: `wellness-food-${Date.now()}.png`,
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
    <div
      className="relative w-full"
      style={{ touchAction: swipe.dragging ? 'none' : 'pan-y', minHeight: 84 }}
    >
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
          {meal && <span style={{ display: 'inline-block', marginTop: 5, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>{meal.label}</span>}
        </div>
        {/* Food photo — full natural aspect ratio, no crop */}
        {imgSrc && (
          <img src={imgSrc} alt="" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 420, objectFit: 'contain', background: '#f9fafb' }} />
        )}
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
            <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Foods Detected</p>
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
        {/* Footer */}
        <div style={{ background: '#f0fdf4', padding: '8px 14px', borderTop: '1px solid #dcfce7' }}>
          <p style={{ fontSize: 9, color: '#16a34a', margin: 0, textAlign: 'center', fontWeight: 600, letterSpacing: 0.3 }}>Track your wellness journey • Wellness Valley</p>
        </div>
      </div>
      {/* Swipe-delete background */}
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

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`${mealName}, ${Math.round(cal)} kilocalories`}
        data-testid="diary-row-food"
        {...swipe.touchHandlers}
        {...swipe.pointerHandlers}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${swipe.dx}px) scale(${swipe.scale})`,
          transition: swipe.animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
        }}
      >
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />

        <Thumb imageBase64={p.imageBase64} imagePath={p.imagePath} fallback="🍽️" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-semibold text-gray-900 truncate">{mealName}</h4>
            {meal && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${meal.cls}`}>
                {meal.label}
              </span>
            )}
          </div>
          {!hideTime && (
            <p className="text-xs text-gray-500">{formatTime(entry.capturedAt, timezoneIana)}</p>
          )}
          {(p.totals?.protein > 0 || p.totals?.carbs > 0 || p.totals?.fat > 0) && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              P {Math.round(p.totals?.protein ?? 0)}g · C {Math.round(p.totals?.carbs ?? 0)}g · F {Math.round(p.totals?.fat ?? 0)}g
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-base text-gray-900">{Math.round(cal)}</p>
          <p className="text-[11px] text-gray-500 -mt-0.5">kcal</p>
        </div>
        {/* Share button — stopPropagation prevents opening the detail modal */}
        <button
          aria-label="Share this food entry"
          onClick={handleShare}
          disabled={isSharing}
          className="shrink-0 ml-1 p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          {isSharing
            ? <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            : <Share2 className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

// ─── kind: weight ───────────────────────────────────────────────────────────

export function WeightRow({ entry, onOpen, onDelete, hideTime = false, timezoneIana = DEFAULT_BUSINESS_TIMEZONE }) {
  const p = entry.payload || {};
  const swipe = useSwipeToDelete({ onDelete: () => onDelete?.(entry) });
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async (e) => {
    e.stopPropagation();
    if (swipe.dragging || swipe.leaving || isSharing || !swipe.elRef.current) return;
    setIsSharing(true);
    try {
      await captureAndShare(swipe.elRef.current, {
        title: `Weight ${p.weight} kg`,
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
    <div
      className="relative w-full"
      style={{ touchAction: swipe.dragging ? 'none' : 'pan-y', minHeight: 84 }}
    >
      {/* Swipe-delete background */}
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

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`Weight, ${p.weight} kilograms`}
        data-testid="diary-row-weight"
        {...swipe.touchHandlers}
        {...swipe.pointerHandlers}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${swipe.dx}px) scale(${swipe.scale})`,
          transition: swipe.animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
        }}
      >
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />

        <Thumb imageBase64={p.imageBase64} fallback={<WeighingScaleIcon className="w-6 h-6 text-emerald-600" />} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">Weight</h4>
          {!hideTime && (
            <p className="text-xs text-gray-500">
              {formatTime(entry.capturedAt, timezoneIana)}
              {typeof p.bmi === 'number' ? ` · BMI ${p.bmi.toFixed(1)}` : ''}
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
    </div>
  );
}

// ─── kind: education ────────────────────────────────────────────────────────

export function EducationRow({ entry, onOpen, onDelete, hideTime = false, timezoneIana = DEFAULT_BUSINESS_TIMEZONE }) {
  const p = entry.payload || {};
  const swipe = useSwipeToDelete({ onDelete: () => onDelete?.(entry) });

  return (
    <div
      className="relative w-full"
      style={{ touchAction: swipe.dragging ? 'none' : 'pan-y', minHeight: 84 }}
    >
      {/* Swipe-delete background */}
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

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`Education, ${p.topic || 'session'}`}
        data-testid="diary-row-education"
        {...swipe.touchHandlers}
        {...swipe.pointerHandlers}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${swipe.dx}px) scale(${swipe.scale})`,
          transition: swipe.animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
        }}
      >
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />

        <Thumb imageBase64={p.imageBase64} fallback={<GraduationCap className="w-6 h-6 text-indigo-600" />} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">{p.topic || 'Education'}</h4>
          {!hideTime && (
            <p className="text-xs text-gray-500">
              {formatTime(entry.capturedAt, timezoneIana)}
              {p.platform ? ` · ${p.platform}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── kind: watch ────────────────────────────────────────────────────────────

export function WatchRow({ entry, onOpen, onDelete, hideTime = false, timezoneIana = DEFAULT_BUSINESS_TIMEZONE }) {
  const p = entry.payload || {};
  const swipe = useSwipeToDelete({ onDelete: () => onDelete?.(entry) });

  return (
    <div
      className="relative w-full"
      style={{ touchAction: swipe.dragging ? 'none' : 'pan-y', minHeight: 84 }}
    >
      {/* Swipe-delete background */}
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

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`Smartwatch activity, ${p.kcal} kilocalories burned`}
        data-testid="diary-row-watch"
        {...swipe.touchHandlers}
        {...swipe.pointerHandlers}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${swipe.dx}px) scale(${swipe.scale})`,
          transition: swipe.animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
        }}
      >
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />

        <Thumb imageBase64={p.imageBase64} imagePath={p.imagePath} fallback={<Smartphone className="w-6 h-6 text-amber-600" aria-hidden="true" />} />
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
    </div>
  );
}

// ─── kind: unknown (the "Other" card) ───────────────────────────────────────
// Supports both swipe-to-delete (quick removal) and tap-to-open.
//
// When `isAnalyzing` is true (Dashboard is running AI before opening the
// modal) the card displays an inline loading state, disables tap, and
// prevents duplicate AI requests. Swipe-to-delete is also disabled during
// analysis to avoid race conditions with the pending AI request.

export function OtherRow({ entry, onOpen, onDelete, isAnalyzing = false, isBackgroundPending = false, hideTime = false, timezoneIana = DEFAULT_BUSINESS_TIMEZONE }) {
  const p = entry.payload || {};
  const swipe = useSwipeToDelete({ onDelete: () => onDelete?.(entry) });
  const showBackgroundHint = isBackgroundPending && !isAnalyzing;

  return (
    <div
      className="relative w-full"
      style={{ touchAction: (swipe.dragging && !isAnalyzing) ? 'none' : 'pan-y', minHeight: 84 }}
    >
      {/* Swipe-delete background — hidden while analyzing */}
      {!isAnalyzing && (
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
            : 'Unrecognised capture, tap to identify or swipe to delete'
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
        {...(isAnalyzing ? {} : swipe.touchHandlers)}
        {...(isAnalyzing ? {} : swipe.pointerHandlers)}
        className={[
          'relative z-10 rounded-xl shadow-sm p-3 flex items-center gap-3 select-none overflow-hidden transition-shadow',
          isAnalyzing
            ? 'bg-emerald-50/80 border border-emerald-200 cursor-wait'
            : showBackgroundHint
            ? 'bg-emerald-50/80 border border-emerald-200 cursor-pointer hover:shadow-md'
            : `bg-white/70 backdrop-blur-xl border border-gray-200/80 cursor-pointer hover:shadow-md ${swipe.leaving ? 'pointer-events-none' : ''}`,
        ].join(' ')}
        style={{
          transform: isAnalyzing ? 'none' : `translateX(${swipe.dx}px) scale(${swipe.scale})`,
          transition: swipe.animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
        }}
      >
        {/* Swipe progress bar */}
        {!isAnalyzing && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
            style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />
        )}

        {/* AI analysis indeterminate progress bar across the card top */}
        {(isAnalyzing || showBackgroundHint) && (
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl overflow-hidden bg-emerald-100" aria-hidden="true">
            <div className="h-full bg-emerald-500 w-2/5 animate-shimmer" />
          </div>
        )}

        <Thumb imageBase64={p.imageBase64} imagePath={p.imagePath} fallback={<HelpCircle className="w-6 h-6 text-gray-500" />} />

        <div className="flex-1 min-w-0">
          {isAnalyzing ? (
            <>
              <h4 className="font-semibold text-emerald-700 truncate">Detecting entry…</h4>
              <p className="text-xs text-emerald-600/80">
                {hideTime ? 'AI is analysing your photo' : `${formatTime(entry.capturedAt, timezoneIana)} · AI is analysing`}
              </p>
            </>
          ) : showBackgroundHint ? (
            <>
              <h4 className="font-semibold text-emerald-700 truncate">Analyzing…</h4>
              <p className="text-xs text-emerald-600/80">
                {hideTime
                  ? 'Your photo is being analyzed'
                  : `${formatTime(entry.capturedAt, timezoneIana)} · AI analysis in progress`}
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
        ) : (
          <span className="text-xs text-amber-600 font-medium" aria-hidden="true">Manual Log</span>
        )}
      </div>
    </div>
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
