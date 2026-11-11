import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { formatWalletAmount, WALLET_FLAG } from '../domain/wallet.rules';
import useWallet from '../hooks/useWallet';
import WalletPage from './WalletPage';

/**
 * @param {object} props
 * @param {number|string|null|undefined} props.userId
 * @param {'row'|'events'} [props.variant='row'] — row = Profile Account list; events = Upcoming Events header chip
 */
export default function WalletButton({ userId, variant = 'row' }) {
  const [open, setOpen] = useState(false);
  // Events card needs balance while closed; profile row keeps lazy load on open.
  const wallet = useWallet(variant === 'events' || open ? userId : null);

  if (!isFlagEnabled(WALLET_FLAG)) return null;

  const onOpen = () => {
    if (userId == null || String(userId).trim() === '') return;
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
    if (variant === 'events') {
      wallet.refresh?.();
    }
  };

  const balanceLabel = wallet.loading && !open
    ? 'Loading…'
    : `₹${formatWalletAmount(wallet.balance)}`;

  return (
    <div>
      {variant === 'events' ? (
        <TouchFeedbackButton
          onClick={onOpen}
          ariaLabel={`Wallet balance ${balanceLabel}. Tap to recharge`}
          className="inline-flex max-w-[11.5rem] items-center gap-1.5 rounded-xl border border-emerald-200 bg-white py-1.5 pl-1.5 pr-2 shadow-sm hover:bg-emerald-50 transition-colors sm:max-w-none"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
            <Wallet className="h-3.5 w-3.5 text-white" aria-hidden />
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-bold tabular-nums leading-tight text-gray-900">
              {balanceLabel}
            </span>
            <span className="block text-[10px] font-semibold text-emerald-700">
              Recharge
            </span>
          </span>
        </TouchFeedbackButton>
      ) : (
        <TouchFeedbackButton
          onClick={onOpen}
          ariaLabel="Wallet"
          className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-green-50 transition-colors"
        >
          <div className="p-2 rounded-full bg-green-50">
            <Wallet className="w-4 h-4 text-green-600" aria-hidden />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-gray-900">Wallet</p>
            <p className="text-xs text-gray-400">
              {open
                ? `Current Balance ₹${formatWalletAmount(wallet.balance)} · add cash with OTP`
                : 'Add cash after a Wellness Valley person shares the OTP'}
            </p>
          </div>
        </TouchFeedbackButton>
      )}
      {open ? (
        <WalletPage
          userId={userId}
          balance={wallet.balance}
          pendingRequest={wallet.pendingRequest}
          onClose={onClose}
          onBalanceChange={wallet.setBalance}
          onPendingChange={wallet.setPendingRequest}
        />
      ) : null}
    </div>
  );
}
