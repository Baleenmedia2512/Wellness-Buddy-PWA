/**
 * Alarm-style swipe wheels for picking HH:mm (stored 24h, shown 12h AM/PM).
 * Shared by coach portfolio HoursPicker and club centre opening hours.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TouchFeedbackButton from './TouchFeedbackButton';

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const AMPM = ['AM', 'PM'];
const ITEM_H = 44;
const VISIBLE = 3;
const PAD = ITEM_H;

export function parseHhmm(value) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  if (!m) return { hour12: 9, minute: 0, ampm: 'AM' };
  const h24 = Number(m[1]);
  const minute = Math.max(0, Math.min(59, Number(m[2])));
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, ampm };
}

export function toHhmm(hour12, minute, ampm) {
  let h = Number(hour12) % 12;
  if (ampm === 'PM') h += 12;
  if (ampm === 'AM' && Number(hour12) === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatAlarmTimeDisplay(value) {
  if (!value) return 'Select';
  const { hour12, minute, ampm } = parseHhmm(value);
  return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

function SnapWheel({ options, value, onChange, formatLabel }) {
  const scrollerRef = useRef(null);
  const timerRef = useRef(null);
  const lockRef = useRef(false);
  const values = options;
  const [centerIdx, setCenterIdx] = useState(() => Math.max(0, values.indexOf(value)));

  const labelOf = (v) => (formatLabel ? formatLabel(v) : String(v));

  const idxFromScroll = () => {
    const el = scrollerRef.current;
    if (!el) return 0;
    return Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)));
  };

  const jumpTo = (idx, smooth) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    lockRef.current = true;
    el.scrollTo({ top: clamped * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
    setCenterIdx(clamped);
    window.setTimeout(() => { lockRef.current = false; }, smooth ? 280 : 40);
  };

  useEffect(() => {
    const idx = Math.max(0, values.indexOf(value));
    jumpTo(idx, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from parent value only
  }, [value]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const settle = () => {
    if (lockRef.current) return;
    const idx = idxFromScroll();
    const el = scrollerRef.current;
    if (el) el.scrollTop = idx * ITEM_H;
    setCenterIdx(idx);
    const next = values[idx];
    if (next !== value) onChange(next);
  };

  return (
    <div
      className="relative w-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-slate-100"
      style={{ height: ITEM_H * VISIBLE }}
    >
      <div
        className="pointer-events-none absolute inset-x-1.5 top-1/2 z-10 -translate-y-1/2 rounded-xl border-2 border-emerald-500 bg-white/55"
        style={{ height: ITEM_H - 4 }}
        aria-hidden
      />
      <div
        ref={scrollerRef}
        className="h-full overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'y mandatory',
          touchAction: 'pan-y',
        }}
        onScroll={() => {
          if (!lockRef.current) setCenterIdx(idxFromScroll());
          if (timerRef.current) window.clearTimeout(timerRef.current);
          timerRef.current = window.setTimeout(settle, 70);
        }}
      >
        <div style={{ height: PAD }} aria-hidden />
        {values.map((v, i) => (
          <div
            key={`${String(v)}-${i}`}
            role="option"
            aria-selected={i === centerIdx}
            onClick={() => {
              jumpTo(i, true);
              onChange(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                jumpTo(i, true);
                onChange(v);
              }
            }}
            tabIndex={-1}
            className={`flex w-full shrink-0 cursor-pointer items-center justify-center tabular-nums ${
              i === centerIdx || v === value
                ? 'text-[22px] font-extrabold text-emerald-950'
                : 'text-[15px] font-normal text-slate-400'
            }`}
            style={{
              height: ITEM_H,
              scrollSnapAlign: 'center',
              fontWeight: (i === centerIdx || v === value) ? 800 : 400,
            }}
          >
            {labelOf(v)}
          </div>
        ))}
        <div style={{ height: PAD }} aria-hidden />
      </div>
    </div>
  );
}

export function AlarmTimeSheet({ title, value, onConfirm, onCancel }) {
  const initial = parseHhmm(value);
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [ampm, setAmpm] = useState(initial.ampm);

  useEffect(() => {
    const next = parseHhmm(value);
    setHour12(next.hour12);
    setMinute(next.minute);
    setAmpm(next.ampm);
  }, [value]);

  const sheet = (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-center text-[14px] font-bold text-slate-900">{title}</p>
        <div className="flex items-center justify-center gap-2">
          <SnapWheel options={HOURS_12} value={hour12} onChange={setHour12} />
          <span className="text-xl font-bold text-slate-300" aria-hidden>:</span>
          <SnapWheel
            options={MINUTES}
            value={minute}
            onChange={setMinute}
            formatLabel={(m) => String(m).padStart(2, '0')}
          />
          <SnapWheel options={AMPM} value={ampm} onChange={setAmpm} />
        </div>
        <p className="mt-3 text-center text-sm font-semibold tabular-nums text-slate-800">
          {hour12}:{String(minute).padStart(2, '0')} {ampm}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <TouchFeedbackButton
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 py-2.5 text-[13px] font-semibold text-slate-600"
          >
            Cancel
          </TouchFeedbackButton>
          <TouchFeedbackButton
            type="button"
            onClick={() => onConfirm(toHhmm(hour12, minute, ampm))}
            className="rounded-xl bg-emerald-600 py-2.5 text-[13px] font-semibold text-white"
          >
            Done
          </TouchFeedbackButton>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(sheet, document.body);
}

/**
 * Button that shows the time and opens the alarm wheel sheet.
 */
export default function AlarmTimePicker({
  value = '',
  onChange,
  disabled = false,
  title = 'Select time',
  fallback = '09:00',
  className = '',
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || title}
        onClick={() => !disabled && setOpen(true)}
        className={
          className
          || 'flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-left text-sm font-semibold text-gray-900 disabled:opacity-60'
        }
      >
        {formatAlarmTimeDisplay(value)}
      </button>
      {open ? (
        <AlarmTimeSheet
          title={title}
          value={value || fallback}
          onCancel={() => setOpen(false)}
          onConfirm={(next) => {
            onChange?.(next);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
