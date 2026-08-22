/**
 * Food thumbnail chip for meal tray — letter avatar when no image.
 */
import React from 'react';

const PALETTE = [
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-sky-100 text-sky-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
  'bg-lime-100 text-lime-800',
];

export function foodThumbTone(name) {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i) * (i + 1)) % PALETTE.length;
  return PALETTE[h];
}

export function FoodThumb({ name, size = 'md', className = '' }) {
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const tone = foodThumbTone(name);
  const dim = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div
      className={`${dim} ${tone} rounded-xl flex items-center justify-center font-bold shadow-sm ring-2 ring-white ${className}`}
      title={name}
    >
      {letter}
    </div>
  );
}

export default FoodThumb;
