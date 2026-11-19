/**
 * Publish blocked — show every missing Profile field in one popup.
 */
import React from 'react';
import { ListChecks, X } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

export default function RequiredProfileFieldsModal({
  items = [],
  onClose,
}) {
  const list = (Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean);
  if (!list.length) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-required-profile-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close required fields"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl shadow-slate-900/20 sm:rounded-3xl">
        <div className="bg-gradient-to-br from-rose-600 to-rose-700 px-5 pb-5 pt-4 text-white">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <ListChecks className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 id="portfolio-required-profile-title" className="text-[15px] font-bold tracking-tight">
                  Complete these in Profile
                </h2>
                <p className="text-[11px] text-white/85">Required before you can publish</p>
              </div>
            </div>
            <TouchFeedbackButton
              onClick={onClose}
              ariaLabel="Close"
              className="rounded-xl p-2 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </TouchFeedbackButton>
          </div>
        </div>
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-slate-600">
            Fill the items below on your Profile, then come back and publish again.
          </p>
          <ul className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50/70 p-3.5">
            {list.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm font-semibold text-rose-800">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <TouchFeedbackButton
            onClick={onClose}
            className="w-full rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm shadow-emerald-600/20"
          >
            OK
          </TouchFeedbackButton>
        </div>
      </div>
    </div>
  );
}
