/**
 * HealthySnacksSubSelectModal — pick Soups / Salads / Sprouts, then continue
 * into the shared SmartFoodSearchModal food flow.
 */
import React from 'react';
import { Salad, Soup, Sprout, X } from 'lucide-react';
import { EmojiOrNative } from '../../shared/components/icons/EmojiImage';
import { isIOS } from '../../shared/utils/platform';
import {
  HEALTHY_SNACKS_SUBOPTIONS,
  HEALTHY_SNACKS_SUBTYPE,
} from '../domain/manualLogCategories';

const SUB_ICONS = {
  [HEALTHY_SNACKS_SUBTYPE.SOUPS]: Soup,
  [HEALTHY_SNACKS_SUBTYPE.SALADS]: Salad,
  [HEALTHY_SNACKS_SUBTYPE.SPROUTS]: Sprout,
};

/**
 * Prefer bundled Twemoji on iOS; fall back to Lucide when the asset is missing
 * (soup bowl) or when we want stroke icons that match Log-as tiles.
 */
function SubOptionLeading({ id, emoji }) {
  const Icon = SUB_ICONS[id];
  // Soup Twemoji (1f963) is not bundled — always Lucide for that row on iOS.
  if (isIOS() && id === HEALTHY_SNACKS_SUBTYPE.SOUPS && Icon) {
    return <Icon className="h-7 w-7 text-emerald-700" strokeWidth={2.1} aria-hidden />;
  }
  if (isIOS() && Icon && (id === HEALTHY_SNACKS_SUBTYPE.SALADS || id === HEALTHY_SNACKS_SUBTYPE.SPROUTS)) {
    return (
      <EmojiOrNative
        emoji={emoji}
        className="h-7 w-7"
        nativeClassName="text-2xl leading-none"
      />
    );
  }
  return <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>;
}

const BTN =
  'flex w-full items-center gap-3 rounded-xl border-2 border-emerald-200/90 bg-gradient-to-b from-white to-emerald-50/70 px-4 py-3.5 text-left shadow-[0_3px_0_0_rgba(6,95,70,0.22)] transition-[transform,box-shadow] duration-150 active:translate-y-[2px] active:shadow-[0_1px_0_0_rgba(6,95,70,0.18)]';

export default function HealthySnacksSubSelectModal({ isOpen, onClose, onPick }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="healthy-snacks-title"
    >
      <div className="flex w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between px-4 pb-2 pt-4">
          <div>
            <p
              id="healthy-snacks-title"
              className="text-sm font-bold leading-snug text-emerald-900"
            >
              Healthy Snacks &amp; Soups
            </p>
            <p className="mt-0.5 max-w-[240px] text-[11px] leading-snug text-emerald-700/70">
              Select one — Soups, Salads, or Sprouts
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-xl p-1.5 transition-colors hover:bg-emerald-50 active:bg-emerald-100"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-emerald-600/60" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5 px-4 pb-4 pt-1">
          {HEALTHY_SNACKS_SUBOPTIONS.map(({ id, label, emoji }) => (
            <button
              key={id}
              type="button"
              onClick={() => onPick?.(id)}
              className={BTN}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                <SubOptionLeading id={id} emoji={emoji} />
              </span>
              <span className="text-sm font-bold text-emerald-900">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
