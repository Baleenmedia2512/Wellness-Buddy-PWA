import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Search, Wallet } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import NativeInput from '../../../shared/components/NativeInput.jsx';
import {
  buildCashAddedMessage,
  extractWalletOtp,
  formatWalletAmount,
  isValidWalletOtp,
  isWalletOtpLockedError,
  parseWalletAmount,
  WALLET_OTP_LENGTH,
  WALLET_OTP_LOCKED_MESSAGE,
  WALLET_SEARCH_MIN_CHARS,
} from '../domain/wallet.rules';
import {
  cancelWalletRequest,
  fetchWallet,
  requestWalletCash,
  searchWalletPeople,
  verifyWalletOtp,
} from '../services/walletApi';
import WalletCashAddedAnimation from './WalletCashAddedAnimation';

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
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [addedAmount, setAddedAmount] = useState(null);
  const [otpShake, setOtpShake] = useState(0);
  const [otpLocked, setOtpLocked] = useState(false);

  const pending = pendingRequest;
  const pendingId = pending?.id;
  const emailSent = Boolean(pending?.emailSent);
  const clearAddedAmount = useCallback(() => setAddedAmount(null), []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

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
          setSuccess(`Code sent to ${next.approverName || 'the selected person'}. Ask them for the 4-digit code.`);
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
      setSuccess(data?.message || 'Enter the code. We are emailing it now.');
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
      onBalanceChange?.(Number(data?.balance) || 0);
      onPendingChange?.(null);
      setOtp('');
      setAmount('');
      setSelected(null);
      setQuery('');
      setSuccess(buildCashAddedMessage(shownAmount) || data?.message || 'Successfully added');
      if (Number.isFinite(shownAmount) && shownAmount > 0) {
        setAddedAmount(shownAmount);
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
            onClick={onClose}
            disabled={busy}
            ariaLabel="Close wallet"
            className="p-2 -ml-2 rounded-full text-white hover:bg-green-700"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden />
          </TouchFeedbackButton>
          <h1 id="wallet-title" className="text-lg font-bold text-white">Wallet</h1>
        </div>
        <p className="mt-3 ml-1 text-green-50 text-sm">
          Your unique Wellness Valley wallet
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 -mt-10 pb-4">
        <div className="bg-white rounded-2xl shadow-md border border-green-100 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
              <Wallet className="w-6 h-6 text-white" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-500">Balance</p>
            <p className="mt-1 text-4xl font-bold text-gray-900">₹{formatWalletAmount(balance)}</p>
          </div>

          {pending ? (
            <div className="px-5 py-4 space-y-3">
              {otpLocked ? (
                <>
                  <p className="text-sm font-semibold text-gray-900">5 attempts used</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    ₹{pending.amountLabel || formatWalletAmount(pending.amount)} was not added. This code can no longer be used.
                  </p>
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
                    className="w-full rounded-xl text-sm text-gray-500 py-2"
                  >
                    Cancel this request
                  </TouchFeedbackButton>
                </>
              ) : (
                <>
              <p className="text-sm font-semibold text-gray-900">Enter the code</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                ₹{pending.amountLabel || formatWalletAmount(pending.amount)} is waiting.
                {emailSent
                  ? ` Ask ${pending.approverName || 'the selected person'} for the 4-digit code sent to their Wellness Valley email.`
                  : ` We are emailing the 4-digit code to ${pending.approverName || 'the selected person'}. You can enter it as soon as they share it.`}
              </p>
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
              <TouchFeedbackButton
                onClick={onVerify}
                disabled={busy || otp.length !== WALLET_OTP_LENGTH}
                ariaLabel="Approve and add cash"
                className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white py-3.5 text-sm font-semibold shadow-md disabled:opacity-60"
              >
                {busy ? 'Checking...' : 'Add to my wallet'}
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={onCancelPending}
                disabled={busy}
                ariaLabel="Cancel request"
                className="w-full rounded-xl text-sm text-gray-500 py-2"
              >
                Cancel this request
              </TouchFeedbackButton>
                </>
              )}
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Amount (₹)</span>
                <NativeInput
                  type="text"
                  inputMode="decimal"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setMessage('');
                    setSuccess('');
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </label>

              <div>
                <span className="text-sm font-medium text-gray-700">Select a person</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  OTP goes to their Wellness Valley email
                </p>
                {selected ? (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selected.userName}</p>
                      <p className="text-xs text-gray-500">{selected.email}</p>
                    </div>
                    <TouchFeedbackButton
                      onClick={() => {
                        setSelected(null);
                        setQuery('');
                      }}
                      disabled={busy}
                      ariaLabel="Change person"
                      className="text-xs font-semibold text-green-700"
                    >
                      Change
                    </TouchFeedbackButton>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name or email"
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
                              onClick={() => {
                                setSelected(person);
                                setQuery(person.userName);
                                setPeople([]);
                                setMessage('');
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
                )}
              </div>

              <TouchFeedbackButton
                onClick={onSubmitRequest}
                disabled={busy}
                ariaLabel="Send approval code"
                className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white py-3.5 text-sm font-semibold shadow-md disabled:opacity-60"
              >
                {busy ? 'Sending code...' : 'Send OTP'}
              </TouchFeedbackButton>
            </div>
          )}
        </div>

        {pending && message ? null : message ? (
          <p className="text-xs text-red-600 mt-4 px-1" role="alert">{message}</p>
        ) : success ? (
          <p className="text-xs text-green-700 mt-4 px-1">{success}</p>
        ) : (
          <p className="text-xs text-gray-400 mt-4 px-1">
            Cash is added only after you enter the code from the selected person.
          </p>
        )}
      </div>
      {addedAmount != null ? (
        <WalletCashAddedAnimation amount={addedAmount} onDone={clearAddedAmount} />
      ) : null}
    </div>
  );

  if (typeof document === 'undefined') return page;
  return createPortal(page, document.body);
}
