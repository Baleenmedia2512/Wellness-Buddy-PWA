/**
 * ErrorBanner.js — top-of-tab API error banner.
 */
import React from 'react';
import { motion } from 'framer-motion';

export default function ErrorBanner({ apiError }) {
  if (!apiError) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 border border-red-200 rounded-xl p-4">
      <p className="text-red-700 font-medium text-sm">Failed to load data</p>
      <p className="text-red-600 text-xs mt-1">{apiError}</p>
    </motion.div>
  );
}
