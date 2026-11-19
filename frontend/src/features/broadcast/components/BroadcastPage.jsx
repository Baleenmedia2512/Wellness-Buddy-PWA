import React, { useState } from 'react';
import { ArrowLeft, CreditCard, Lock, Megaphone } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import BroadcastHowToPlayer from './BroadcastHowToPlayer';
import {
  BROADCAST_VIEWS,
  resolveBroadcastView,
} from '../domain/broadcast.rules';

function scrollBroadcastToTop() {
  const scrollBody = document.querySelector('.ios-scroll-body');
  if (scrollBody) scrollBody.scrollTop = 0;
}

function BroadcastIntro({ onMakePayment }) {
  return (
    <>
      <div className="mb-4">
        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
          Paid feature
        </div>
        <h1 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <Megaphone className="h-5 w-5 text-emerald-600" aria-hidden />
          BroadCast
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Watch how this screen works, then make a payment to recharge one campaign.
        </p>
      </div>

      <BroadcastHowToPlayer />

      <TouchFeedbackButton
        onClick={onMakePayment}
        ariaLabel="Make a payment"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
      >
        <CreditCard className="h-4 w-4" aria-hidden />
        Make a payment
      </TouchFeedbackButton>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 text-xs leading-relaxed text-gray-500">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        <p>
          Upload and Burst stay locked until your recharge is complete.
          After that, one picture can go to WhatsApp Status and an Instagram ad for your contacts.
        </p>
      </div>
    </>
  );
}

function BroadcastPayment({ onBack }) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        BroadCast
      </button>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
          <CreditCard className="h-5 w-5 text-emerald-600" aria-hidden />
        </div>
        <h1 className="text-base font-bold text-gray-900">Make a payment</h1>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          One recharge runs one campaign. When that campaign finishes, BroadCast stops
          until you recharge again.
        </p>

        <ol className="mt-4 space-y-2 text-sm text-gray-800">
          <li className="flex gap-2">
            <span className="font-bold text-emerald-700">1.</span>
            Complete this recharge.
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-emerald-700">2.</span>
            Upload the picture you want to share.
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-emerald-700">3.</span>
            Tap Burst to post it on your WhatsApp Status and run an Instagram ad for your contact numbers.
          </li>
        </ol>
      </div>

      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-900">
        Payment setup is in progress. Nothing is charged from this screen yet.
      </div>
    </>
  );
}

/**
 * BroadCast main screen. Campaign tools stay hidden until recharge is active.
 */
export default function BroadcastPage() {
  const [view, setView] = useState(BROADCAST_VIEWS.INTRO);
  const screen = resolveBroadcastView(view);

  const openPayment = () => {
    setView(BROADCAST_VIEWS.PAYMENT);
    scrollBroadcastToTop();
  };

  const backToIntro = () => {
    setView(BROADCAST_VIEWS.INTRO);
    scrollBroadcastToTop();
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-4">
      {screen === BROADCAST_VIEWS.PAYMENT ? (
        <BroadcastPayment onBack={backToIntro} />
      ) : (
        <BroadcastIntro onMakePayment={openPayment} />
      )}
    </div>
  );
}
