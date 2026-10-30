/**
 * Wallet-only overlay after OTP cash-in succeeds.
 * Does not change shared celebration or other screens.
 */
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { buildCashAddedMessage, formatWalletAmount } from '../domain/wallet.rules';

const SHOW_MS = 2400;
const REDUCE_MS = 1600;

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export default function WalletCashAddedAnimation({ amount, onDone }) {
  const [open, setOpen] = useState(true);
  const message = buildCashAddedMessage(amount);
  const reduce = prefersReducedMotion();

  useEffect(() => {
    if (!message) {
      onDone?.();
      return undefined;
    }
    const timer = setTimeout(() => {
      setOpen(false);
    }, reduce ? REDUCE_MS : SHOW_MS);
    return () => clearTimeout(timer);
  }, [message, onDone, reduce]);

  if (!message) return null;

  return (
    <AnimatePresence onExitComplete={() => onDone?.()}>
      {open ? (
        <motion.div
          className="absolute inset-0 z-[80] flex items-center justify-center px-6"
          style={{ background: 'rgba(6, 78, 59, 0.55)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.15 : 0.25 }}
          role="status"
          aria-live="polite"
          aria-label={message}
        >
          <motion.div
            className="w-full max-w-xs bg-white rounded-3xl px-6 py-8 text-center shadow-md"
            initial={reduce ? { opacity: 0 } : { scale: 0.72, opacity: 0, y: 16 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.92, opacity: 0 }}
            transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 260, damping: 18 }}
          >
            <motion.div
              className="mx-auto h-16 w-16 rounded-full bg-green-500 flex items-center justify-center"
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 14, delay: 0.08 }}
            >
              <Check className="w-8 h-8 text-white" strokeWidth={3} aria-hidden />
            </motion.div>
            <p className="mt-5 text-sm font-semibold text-green-700">Successfully added</p>
            <motion.p
              className="mt-1 text-4xl font-bold text-gray-900"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.18, duration: 0.25 }}
            >
              ₹{formatWalletAmount(amount)}
            </motion.p>
            <p className="mt-2 text-xs text-gray-400">to your wallet</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
