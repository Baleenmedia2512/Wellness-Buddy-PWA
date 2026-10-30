import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { formatWalletAmount, WALLET_FLAG } from '../domain/wallet.rules';
import useWallet from '../hooks/useWallet';
import WalletPage from './WalletPage';

export default function WalletButton({ userId }) {
  const [open, setOpen] = useState(false);
  const wallet = useWallet(open ? userId : null);

  if (!isFlagEnabled(WALLET_FLAG)) return null;

  const onOpen = () => {
    if (userId == null || String(userId).trim() === '') return;
    setOpen(true);
  };

  return (
    <div>
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
              ? `Balance ₹${formatWalletAmount(wallet.balance)} · add cash with OTP`
              : 'Add cash after a Wellness Valley person shares the OTP'}
          </p>
        </div>
      </TouchFeedbackButton>
      {open ? (
        <WalletPage
          userId={userId}
          balance={wallet.balance}
          pendingRequest={wallet.pendingRequest}
          onClose={() => setOpen(false)}
          onBalanceChange={wallet.setBalance}
          onPendingChange={wallet.setPendingRequest}
        />
      ) : null}
    </div>
  );
}
