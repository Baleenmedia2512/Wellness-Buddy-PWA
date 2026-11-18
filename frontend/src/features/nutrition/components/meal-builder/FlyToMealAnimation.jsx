/**
 * “Fly to Your Meal” chip — pop → arc → soft land in the tray.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { foodThumbTone } from './FoodThumb';
import { rectCenter, resolveFlyTargetPoint, bottomTrayFallbackPoint } from './flyToMeal.geometry';

export { rectCenter, resolveFlyTargetPoint, bottomTrayFallbackPoint };

const CHIP = 48; // px — easier to follow than the old 32px chip

/**
 * @param {{ id: string, name: string, from: {x:number,y:number}, to: {x:number,y:number}, onDone: (id: string) => void }} props
 */
function FlyChip({ id, name, from, to, onDone }) {
  const nodeRef = useRef(null);
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const label = String(name || '').trim();
  const short = label.length > 14 ? `${label.slice(0, 13)}…` : label;
  const tone = foodThumbTone(name);

  useEffect(() => {
    const el = nodeRef.current;
    if (!el || typeof el.animate !== 'function') {
      const t = setTimeout(() => onDone?.(id), 0);
      return () => clearTimeout(t);
    }

    const half = CHIP / 2;
    const startX = from.x - half;
    const startY = from.y - half;
    const endX = to.x - half;
    const endY = to.y - half;
    // High arc so the path reads clearly on phone screens
    const midX = startX + (endX - startX) * 0.5;
    const midY = Math.min(startY, endY) - Math.max(72, Math.abs(endY - startY) * 0.22);

    const anim = el.animate(
      [
        {
          transform: `translate(${startX}px, ${startY}px) scale(0.55)`,
          opacity: 0,
        },
        {
          transform: `translate(${startX}px, ${startY - 14}px) scale(1.2)`,
          opacity: 1,
          offset: 0.14,
        },
        {
          transform: `translate(${startX}px, ${startY - 8}px) scale(1.05)`,
          opacity: 1,
          offset: 0.28,
        },
        {
          transform: `translate(${midX}px, ${midY}px) scale(1)`,
          opacity: 1,
          offset: 0.58,
        },
        {
          transform: `translate(${endX}px, ${endY - 10}px) scale(0.85)`,
          opacity: 1,
          offset: 0.82,
        },
        {
          transform: `translate(${endX}px, ${endY}px) scale(0.55)`,
          opacity: 0,
        },
      ],
      {
        duration: 1250,
        easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
        fill: 'forwards',
      },
    );
    const finish = () => onDone?.(id);
    anim.addEventListener('finish', finish);
    return () => {
      anim.removeEventListener('finish', finish);
      anim.cancel();
    };
  }, [id, from.x, from.y, to.x, to.y, onDone]);

  return (
    <div
      ref={nodeRef}
      className="fixed left-0 top-0 z-[10050] pointer-events-none will-change-transform"
      aria-hidden="true"
    >
      <div
        className={`flex items-center gap-1.5 pl-1.5 pr-2.5 h-12 max-w-[11rem] ${tone} rounded-2xl shadow-xl ring-2 ring-white border border-green-600/20`}
        style={{ minWidth: CHIP }}
      >
        <span className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center text-sm font-extrabold text-green-900 flex-shrink-0">
          {letter}
        </span>
        <span className="text-[11px] font-bold text-green-950 truncate leading-tight">
          {short}
        </span>
      </div>
    </div>
  );
}

/**
 * @param {{ flights: Array<{ id: string, name: string, from: {x:number,y:number}, to: {x:number,y:number} }>, onFlightDone: (id: string) => void }} props
 */
export default function FlyToMealAnimation({ flights = [], onFlightDone }) {
  if (typeof document === 'undefined' || !flights.length) return null;
  return createPortal(
    <>
      {flights.map((flight) => (
        <FlyChip
          key={flight.id}
          id={flight.id}
          name={flight.name}
          from={flight.from}
          to={flight.to}
          onDone={onFlightDone}
        />
      ))}
    </>,
    document.body,
  );
}
