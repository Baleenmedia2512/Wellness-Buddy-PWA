/**
 * BcmPhoneExistsModal.jsx
 *
 * Shown when the coach enters a phone that already belongs to a team member
 * (non-activated). Offers Reuse vs Create new.
 */
import React from 'react';
import { BCM_PHONE_EXISTS_CHOICE_MESSAGE } from '../domain/formValidation.rules.js';

/**
 * @param {{
 *   isOpen: boolean,
 *   isBusy?: boolean,
 *   onReuse: () => void,
 *   onCreateNew: () => void,
 * }} props
 */
export default function BcmPhoneExistsModal({
  isOpen,
  isBusy = false,
  onReuse,
  onCreateNew,
}) {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="bcm-phone-exists-title"
      aria-describedby="bcm-phone-exists-desc"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onCreateNew();
      }}
    >
      <div
        className="w-full max-w-[420px] overflow-hidden rounded-[10px] border border-green-700/40 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-green-100 bg-gradient-to-r from-green-600 to-green-600 px-4 py-3.5">
          <h2
            id="bcm-phone-exists-title"
            className="m-0 text-sm font-semibold leading-snug text-white"
          >
            Number already exists
          </h2>
        </div>

        <div className="border-b border-green-100 px-4 py-4">
          <p
            id="bcm-phone-exists-desc"
            className="m-0 text-[13px] font-normal leading-relaxed text-gray-600"
          >
            {BCM_PHONE_EXISTS_CHOICE_MESSAGE}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-4 py-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={onCreateNew}
            className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-[13px] font-medium text-gray-700 disabled:opacity-50 hover:bg-gray-50"
          >
            Create new
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onReuse}
            className="rounded-md border border-green-600 bg-gradient-to-r from-green-600 to-green-600 px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            Reuse
          </button>
        </div>
      </div>
    </div>
  );
}
