import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Search, Wallet } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import NativeInput from '../../../shared/components/NativeInput.jsx';
import {
  buildCashAddedMessage,
  extractWalletOtp,
  formatWalletAmount,
  interpolateWalletBalance,
  isValidWalletOtp,
  isWalletOtpLockedError,
  parseWalletAmount,
  resolveWalletRechargeGuide,
  WALLET_BALANCE_COUNT_MS,
  WALLET_OTP_LENGTH,
  WALLET_OTP_LOCKED_MESSAGE,
  WALLET_SEARCH_MIN_CHARS,
} from '../domain/wallet.rules';
import {
  cancelWalletRequest,
  fetchWallet,
  requestWalletCash,
  resendWalletOtp,
  searchWalletPeople,
  verifyWalletOtp,
} from '../services/walletApi';
import WalletCashAddedAnimation from './WalletCashAddedAnimation';

const WALLET_OTP_RESEND_WAIT_MS = 30 * 1000;

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export default function WalletPage({
  userId,
  balance,
  pendingRequest,
  onClose,
  onBalanceChange,
  onPendingChange,
}) {
  const [amount, setAmount] = useState('');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [addedAmount, setAddedAmount] = useState(null);
  const [otpShake, setOtpShake] = useState(0);
  const [otpLocked, setOtpLocked] = useState(false);
  /** Wizard UI only: amount → person → send (one screen at a time). */
  const [wizardStep, setWizardStep] = useState('amount');
  /** Hold old Balance during success popup, then count up to the new amount. */
  const [heldBalance, setHeldBalance] = useState(null);
  const [animatedBalance, setAnimatedBalance] = useState(null);
  const [balanceCounting, setBalanceCounting] = useState(false);
  const balanceAnimRef = useRef(null);
  const heldBalanceRef = useRef(null);
  const targetBalanceRef = useRef(null);

  const pending = pendingRequest;
  const pendingId = pending?.id;
  const emailSent = Boolean(pending?.emailSent);
  const resendLocked = resendSeconds > 0;

  useEffect(() => {
    if (!pendingId) {
      setResendSeconds(0);
      return undefined;
    }
    const sentAt = new Date(pending?.requestedAt || Date.now()).getTime();
    const anchor = Number.isFinite(sentAt) ? sentAt : Date.now();
    const tick = () => {
      const left = Math.max(0, Math.ceil((WALLET_OTP_RESEND_WAIT_MS - (Date.now() - anchor)) / 1000));
      setResendSeconds(left);
      return left;
    };
    if (tick() <= 0) return undefined;
    const timer = setInterval(() => {
      if (tick() <= 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [pendingId, pending?.requestedAt]);

  const displayBalance = animatedBalance != null
    ? animatedBalance
    : heldBalance != null
      ? heldBalance
      : balance;

  const finishBalanceCount = useCallback(() => {
    if (balanceAnimRef.current != null) {
      cancelAnimationFrame(balanceAnimRef.current);
      balanceAnimRef.current = null;
    }
    setAnimatedBalance(null);
    setHeldBalance(null);
    setBalanceCounting(false);
    heldBalanceRef.current = null;
    targetBalanceRef.current = null;
  }, []);

  const startBalanceCountUp = useCallback((fromAmount, toAmount) => {
    if (balanceAnimRef.current != null) {
      cancelAnimationFrame(balanceAnimRef.current);
      balanceAnimRef.current = null;
    }
    const from = Number(fromAmount);
    const to = Number(toAmount);
    if (!Number.isFinite(to) || !Number.isFinite(from) || from === to || prefersReducedMotion()) {
      finishBalanceCount();
      return;
    }
    setBalanceCounting(true);
    setAnimatedBalance(from);
    const startedAt = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / WALLET_BALANCE_COUNT_MS);
      setAnimatedBalance(interpolateWalletBalance(from, to, progress));
      if (progress < 1) {
        balanceAnimRef.current = requestAnimationFrame(tick);
        return;
      }
      balanceAnimRef.current = null;
      finishBalanceCount();
    };
    balanceAnimRef.current = requestAnimationFrame(tick);
  }, [finishBalanceCount]);

  const clearAddedAmount = useCallback(() => {
    setAddedAmount(null);
    const from = heldBalanceRef.current;
    const to = targetBalanceRef.current;
    if (from == null || to == null) {
      finishBalanceCount();
      return;
    }
    startBalanceCountUp(from, to);
  }, [finishBalanceCount, startBalanceCountUp]);

  useEffect(() => () => {
    if (balanceAnimRef.current != null) {
      cancelAnimationFrame(balanceAnimRef.current);
    }
  }, []);

  // OTP card already shows name/email — hide leftover footer success text.
  useEffect(() => {
    if (pending) setSuccess('');
  }, [pending]);

  // Guide copy follows the one screen the user is on (not all fields at once).
  const stepGuide = pending
    ? resolveWalletRechargeGuide({ pending, otpLocked })
    : wizardStep === 'amount'
      ? resolveWalletRechargeGuide({ amount: '', selected: null })
      : wizardStep === 'person'
        ? resolveWalletRechargeGuide({ amount: amount || '1', selected: null })
        : resolveWalletRechargeGuide({
          amount: amount || '1',
          selected: selected || { userId: 1 },
        });

  useEffect(() => {
    const onKey = (event) => {
      // Always allow leaving Wallet (e.g. back to Upcoming Events) even if a request is in flight.
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!pendingId || emailSent || otpLocked || userId == null) return undefined;
    let cancelled = false;
    let tries = 0;
    let timer = null;
    const poll = async () => {
      tries += 1;
      try {
        const data = await fetchWallet(userId);
        if (cancelled) return;
        const next = data?.pendingRequest || null;
        if (!next) {
          onPendingChange?.(null);
          setSuccess('');
          setMessage('Could not email the code. Try again.');
          return;
        }
        if (Number(next.id) !== Number(pendingId)) {
          onPendingChange?.(next);
          return;
        }
        if (next.emailSent) {
          onPendingChange?.(next);
          setSuccess('');
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (!cancelled && tries < 20) {
        timer = setTimeout(poll, tries < 6 ? 800 : 1500);
      }
    };
    timer = setTimeout(poll, 600);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pendingId, emailSent, otpLocked, userId, onPendingChange]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < WALLET_SEARCH_MIN_CHARS || selected) {
      setPeople([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await searchWalletPeople({ userId, q });
        setPeople(rows);
      } catch {
        setPeople([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, selected, userId]);

  const onSubmitRequest = async () => {
    if (busy) return;
    const parsed = parseWalletAmount(amount);
    if (parsed == null) {
      setMessage('Enter an amount of at least ₹1');
      return;
    }
    if (!selected?.userId) {
      setMessage('Select a person in Wellness Valley');
      return;
    }
    setBusy(true);
    setMessage('');
    setSuccess('');
    try {
      const data = await requestWalletCash({
        userId,
        amount: parsed,
        approverUserId: selected.userId,
      });
      onPendingChange?.(data?.pendingRequest || null);
      setOtp('');
      setSuccess('');
    } catch (err) {
      setMessage(err?.message || 'Could not send the code');
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    if (busy) return;
    const code = extractWalletOtp(otp) || String(otp).trim();
    if (!isValidWalletOtp(code)) {
      setMessage('Enter the 4-digit code');
      setOtpShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setMessage('');
    setSuccess('');
    try {
      const waitingAmount = Number(pending?.amount);
      const data = await verifyWalletOtp({ userId, otp: code });
      const credited = Number(data?.creditedAmount);
      const shownAmount = Number.isFinite(credited) && credited > 0
        ? credited
        : waitingAmount;
      const nextBalance = Number(data?.balance) || 0;
      // Keep showing the old Balance during the success popup; count up after it closes.
      // Parent balance still updates now so chips / reopen stay correct if the page closes.
      const previousBalance = Number(balance) || 0;
      heldBalanceRef.current = previousBalance;
      setHeldBalance(previousBalance);
      targetBalanceRef.current = nextBalance;
      onBalanceChange?.(nextBalance);
      onPendingChange?.(null);
      setOtp('');
      setAmount('');
      setSelected(null);
      setQuery('');
      setWizardStep('amount');
      setSuccess(buildCashAddedMessage(shownAmount) || data?.message || 'Successfully added');
      if (Number.isFinite(shownAmount) && shownAmount > 0) {
        setAddedAmount(shownAmount);
      } else {
        finishBalanceCount();
      }
    } catch (err) {
      setOtp('');
      setMessage(err?.message || 'Could not verify the code');
      setOtpShake((n) => n + 1);
      if (isWalletOtpLockedError(err)) {
        setOtpLocked(true);
        setMessage(WALLET_OTP_LOCKED_MESSAGE);
      }
    } finally {
      setBusy(false);
    }
  };

  const clearPendingForm = (data) => {
    onPendingChange?.(null);
    if (data && Number.isFinite(Number(data.balance))) {
      onBalanceChange?.(Number(data.balance));
    }
    setOtp('');
    setOtpLocked(false);
    setSuccess('');
    setMessage('');
    setWizardStep('amount');
  };

  const goNextFromAmount = () => {
    if (parseWalletAmount(amount) == null) {
      setMessage('Enter an amount of at least ₹1');
      return;
    }
    setMessage('');
    setSuccess('');
    setWizardStep('person');
  };

  const goWizardBack = () => {
    setMessage('');
    setSuccess('');
    if (wizardStep === 'person') {
      setSelected(null);
      setQuery('');
      setPeople([]);
      setWizardStep('amount');
      return;
    }
    if (wizardStep === 'send') {
      setSelected(null);
      setQuery('');
      setPeople([]);
      setWizardStep('person');
    }
  };

  /** OTP step → cancel pending request, return to previous recharge step. */
  const onBackFromOtp = async () => {
    if (busy) return;
    const restoreAmount = pending?.amount;
    setBusy(true);
    setMessage('');
    try {
      const data = await cancelWalletRequest({ userId });
      onPendingChange?.(null);
      if (data && Number.isFinite(Number(data.balance))) {
        onBalanceChange?.(Number(data.balance));
      }
      setOtp('');
      setOtpLocked(false);
      setSuccess('');
      if (restoreAmount != null && Number(restoreAmount) > 0) {
        setAmount(String(restoreAmount));
      }
      if (selected?.userId) {
        setWizardStep('send');
      } else {
        setSelected(null);
        setQuery('');
        setPeople([]);
        setWizardStep(
          restoreAmount != null && Number(restoreAmount) > 0 ? 'person' : 'amount',
        );
      }
    } catch (err) {
      setMessage(err?.message || 'Could not go back');
    } finally {
      setBusy(false);
    }
  };

  const onCancelPending = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await cancelWalletRequest({ userId });
      clearPendingForm(data);
    } catch (err) {
      setMessage(err?.message || 'Could not cancel');
    } finally {
      setBusy(false);
    }
  };

  const onSendNewRequest = async () => {
    if (busy) return;
    const previousAmount = pending?.amount;
    setBusy(true);
    try {
      const data = await cancelWalletRequest({ userId });
      clearPendingForm(data);
      if (previousAmount != null && Number(previousAmount) > 0) {
        setAmount(String(previousAmount));
        setWizardStep('person');
      } else {
        setWizardStep('amount');
      }
    } catch (err) {
      setOtpLocked(false);
      onPendingChange?.(null);
      setMessage(err?.message || 'Could not start a new request');
    } finally {
      setBusy(false);
    }
  };

  const handleOtpInput = (raw) => {
    const extracted = extractWalletOtp(raw);
    setOtp(extracted ?? String(raw ?? '').replace(/\D/g, '').slice(0, WALLET_OTP_LENGTH));
    setMessage('');
    setResendNote('');
  };

  const onResendOtp = async () => {
    if (busy || !emailSent || resendSeconds > 0) return;
    setBusy(true);
    setResending(true);
    setMessage('');
    setResendNote('');
    try {
      const data = await resendWalletOtp({
        userId,
        amount: pending?.amount,
        approverUserId: pending?.approverId,
      });
      if (data?.pendingRequest) onPendingChange?.(data.pendingRequest);
      setOtp('');
      setResendNote('Code sent again.');
    } catch (err) {
      setMessage(err?.message || 'Could not resend the code');
    } finally {
      setResending(false);
      setBusy(false);
    }
  };

  const page = (
    <div
      className="fixed inset-0 z-[70] bg-gray-50 flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-title"
    >
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 pt-4 pb-16">
        <div className="flex items-center gap-3">
          <TouchFeedbackButton
            type="button"
            onClick={() => onClose?.()}
            ariaLabel="Back"
            className="p-2 -ml-2 rounded-full text-white hover:bg-green-700"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden />
          </TouchFeedbackButton>
          <h1 id="wallet-title" className="text-lg font-bold text-white">Wallet</h1>
        </div>
        <p className="mt-3 ml-1 text-green-50 text-sm">
          Add cash in 4 easy taps
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 -mt-10 pb-4">
        <div className="bg-white rounded-2xl shadow-md border border-green-100 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
              <Wallet className="w-6 h-6 text-white" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-500">Current Balance</p>
            <p
              className={`mt-1 text-4xl font-bold tabular-nums transition-colors duration-300 ${
                balanceCounting ? 'text-emerald-600' : 'text-gray-900'
              }`}
              aria-live="polite"
            >
              ₹{formatWalletAmount(displayBalance)}
            </p>
          </div>

          <div
            className="mx-5 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-semibold text-emerald-900 leading-snug">
              {stepGuide.step > 0 ? `${stepGuide.step}. ` : ''}{stepGuide.title}
            </p>
          </div>

          {pending ? (
            <div className="px-5 py-4 space-y-3">
              {otpLocked ? (
                <>
                  <p className="text-sm font-medium text-red-600" role="alert">{WALLET_OTP_LOCKED_MESSAGE}</p>
                  <TouchFeedbackButton
                    onClick={onSendNewRequest}
                    disabled={busy}
                    ariaLabel="Send a new request"
                    className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white py-3.5 text-sm font-semibold shadow-md disabled:opacity-60"
                  >
                    {busy ? 'Opening...' : 'Send a new request'}
                  </TouchFeedbackButton>
                  <TouchFeedbackButton
                    onClick={onCancelPending}
                    disabled={busy}
                    ariaLabel="Cancel request"
                    className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                  >
                    Cancel this request
                  </TouchFeedbackButton>
                  <TouchFeedbackButton
                    type="button"
                    onClick={onBackFromOtp}
                    disabled={busy}
                    ariaLabel="Back to previous step"
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 disabled:opacity-60"
                  >
                    {busy ? 'Please wait...' : 'Back'}
                  </TouchFeedbackButton>
                </>
              ) : (
                <>
              <ol className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 space-y-2.5 text-sm text-gray-800 leading-relaxed list-none">
                <li className="grid grid-cols-[1.25rem_1fr] gap-x-1.5">
                  <span className="font-semibold text-emerald-800">1.</span>
                  <span>
                    Pay ₹{pending.amountLabel || formatWalletAmount(pending.amount)} to{' '}
                    <span className="font-semibold">{pending.approverName || 'selected person'}</span>
                    {' '}using CASH, UPI, or CARD.
                  </span>
                </li>
                <li className="grid grid-cols-[1.25rem_1fr] gap-x-1.5">
                  <span className="font-semibold text-emerald-800">2.</span>
                  <span className="min-w-0">
                    After payment, ask them for the OTP sent to
                    <span className="mt-0.5 block font-semibold break-all text-gray-900">
                      {pending.approverEmail || 'their email'}
                    </span>
                  </span>
                </li>
                <li className="grid grid-cols-[1.25rem_1fr] gap-x-1.5">
                  <span className="font-semibold text-emerald-800">3.</span>
                  <span>Enter that OTP below.</span>
                </li>
              </ol>
              <NativeInput
                key={otpShake}
                otp
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={WALLET_OTP_LENGTH}
                placeholder="_ _ _ _"
                value={otp}
                autoFocus
                aria-invalid={Boolean(message)}
                onChange={(e) => handleOtpInput(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  handleOtpInput(e.clipboardData?.getData('text') ?? '');
                }}
                className={`w-full text-center text-2xl font-bold tracking-[0.4em] border-2 rounded-xl py-3 focus:outline-none bg-white ${
                  message
                    ? 'border-red-500 text-red-700 focus:ring-2 focus:ring-red-400 bg-red-50 animate-shake'
                    : 'border-green-300 focus:ring-2 focus:ring-green-400'
                }`}
              />
              {message ? (
                <p className="text-sm font-medium text-red-600" role="alert">{message}</p>
              ) : null}
              {resendNote ? (
                <p className="text-sm font-medium text-emerald-700" role="status">{resendNote}</p>
              ) : null}
              <TouchFeedbackButton
                onClick={onVerify}
                disabled={busy || otp.length !== WALLET_OTP_LENGTH}
                ariaLabel="Approve and add cash"
                className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white py-3.5 text-sm font-semibold shadow-md disabled:opacity-60"
              >
                {busy && !resending ? 'Checking...' : 'Add to my wallet'}
              </TouchFeedbackButton>
              <TouchFeedbackButton
                type="button"
                onClick={onResendOtp}
                disabled={busy || !emailSent || resendLocked}
                ariaLabel={resendLocked ? `Resend OTP in ${resendSeconds} seconds` : 'Resend OTP'}
                className="w-full rounded-xl border border-green-200 bg-white py-3 text-sm font-semibold text-green-700 disabled:opacity-60"
              >
                {resending
                  ? 'Sending...'
                  : resendLocked
                    ? `Resend OTP in ${resendSeconds}s`
                    : 'Resend OTP'}
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={onCancelPending}
                disabled={busy}
                ariaLabel="Cancel request"
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
              >
                Cancel this request
              </TouchFeedbackButton>
              <TouchFeedbackButton
                type="button"
                onClick={onBackFromOtp}
                disabled={busy}
                ariaLabel="Back to previous step"
                className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 disabled:opacity-60"
              >
                {busy ? 'Please wait...' : 'Back'}
              </TouchFeedbackButton>
                </>
              )}
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">
              {wizardStep === 'amount' ? (
                <>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Amount (₹)</span>
                    <NativeInput
                      type="text"
                      inputMode="decimal"
                      placeholder="Enter amount"
                      value={amount}
                      autoFocus
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setMessage('');
                        setSuccess('');
                      }}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </label>
                  <TouchFeedbackButton
                    type="button"
                    onClick={goNextFromAmount}
                    ariaLabel="Next step"
                    className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white py-3.5 text-sm font-semibold shadow-md"
                  >
                    Next
                  </TouchFeedbackButton>
                  <TouchFeedbackButton
                    type="button"
                    onClick={() => onClose?.()}
                    ariaLabel="Back"
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700"
                  >
                    Back
                  </TouchFeedbackButton>
                </>
              ) : null}

              {wizardStep === 'person' ? (
                <>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-sm text-gray-700">
                      Amount{' '}
                      <span className="font-semibold text-gray-900">
                        ₹{formatWalletAmount(parseWalletAmount(amount) ?? amount)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Who will you pay?</span>
                    <div className="mt-2">
                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
                        <input
                          type="search"
                          name="wallet-person-search"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search name or email"
                          autoFocus
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                      </div>
                      {searching ? (
                        <p className="text-xs text-gray-400 mt-2">Searching...</p>
                      ) : null}
                      {people.length > 0 ? (
                        <ul className="mt-2 max-h-48 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-100">
                          {people.map((person) => (
                            <li key={person.userId}>
                              <TouchFeedbackButton
                                type="button"
                                onClick={() => {
                                  setSelected(person);
                                  setQuery(person.userName);
                                  setPeople([]);
                                  setMessage('');
                                  setWizardStep('send');
                                }}
                                ariaLabel={`Select ${person.userName}`}
                                className="w-full text-left px-3 py-3 hover:bg-green-50"
                              >
                                <p className="text-sm font-medium text-gray-900">{person.userName}</p>
                                <p className="text-xs text-gray-500">{person.email}</p>
                              </TouchFeedbackButton>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                  <TouchFeedbackButton
                    type="button"
                    onClick={goWizardBack}
                    ariaLabel="Back to amount"
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700"
                  >
                    Back
                  </TouchFeedbackButton>
                </>
              ) : null}

              {wizardStep === 'send' ? (
                <>
                  <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                    <p className="text-sm text-gray-700">
                      Amount{' '}
                      <span className="font-semibold text-gray-900">
                        ₹{formatWalletAmount(parseWalletAmount(amount) ?? amount)}
                      </span>
                    </p>
                    <div className="border-t border-gray-200 pt-2 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{selected?.userName}</p>
                      <p className="text-xs text-gray-500 truncate">{selected?.email}</p>
                    </div>
                  </div>
                  <TouchFeedbackButton
                    type="button"
                    onClick={onSubmitRequest}
                    disabled={busy}
                    ariaLabel="Send approval code"
                    className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white py-3.5 text-sm font-semibold shadow-md disabled:opacity-60"
                  >
                    {busy ? 'Sending code...' : 'Send OTP'}
                  </TouchFeedbackButton>
                  <TouchFeedbackButton
                    type="button"
                    onClick={goWizardBack}
                    disabled={busy}
                    ariaLabel="Back to person"
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 disabled:opacity-60"
                  >
                    Back
                  </TouchFeedbackButton>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* While OTP is pending, details stay inside the card — no extra footer line. */}
        {pending ? (
          message ? (
            <p className="text-xs text-red-600 mt-4 px-1" role="alert">{message}</p>
          ) : null
        ) : message ? (
          <p className="text-xs text-red-600 mt-4 px-1" role="alert">{message}</p>
        ) : success ? (
          <p className="text-xs text-green-700 mt-4 px-1">{success}</p>
        ) : null}
      </div>
      {addedAmount != null ? (
        <WalletCashAddedAnimation amount={addedAmount} onDone={clearAddedAmount} />
      ) : null}
    </div>
  );

  if (typeof document === 'undefined') return page;
  return createPortal(page, document.body);
}
