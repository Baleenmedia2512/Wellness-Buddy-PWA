/**
 * SummaryStatsCard.js — three-stat card with cost/tokens swipe + dot toggles.
 *
 * Pure presentational. Parent owns active tab state; this component
 * receives both views and animates between them.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IndianRupee, Zap } from 'lucide-react';
import useSummarySwipe from '../../hooks/useSummarySwipe';
import { formatCurrency, formatNumber } from '../../services/tokenCostMath';

const Stat = ({ value, label, Icon, iconClass }) => (
  <div className="text-center">
    <p className="text-lg sm:text-2xl font-bold text-gray-800 mb-1">{value}</p>
    <div className="flex items-center justify-center space-x-1">
      <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${iconClass}`} />
      <span className="text-xs text-gray-400 whitespace-nowrap">{label}</span>
    </div>
  </div>
);

const CostView = ({ summary }) => (
  <motion.div key="cost" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="grid grid-cols-3 gap-2">
    <Stat value={formatCurrency(summary.totalCost || 0)}      label="Total Cost"  Icon={IndianRupee} iconClass="text-green-500" />
    <Stat value={formatCurrency(summary.totalInputCost || 0)} label="Input Cost"  Icon={IndianRupee} iconClass="text-blue-500" />
    <Stat value={formatCurrency(summary.totalOutputCost || 0)}label="Output Cost" Icon={IndianRupee} iconClass="text-purple-500" />
  </motion.div>
);

const TokenView = ({ summary }) => (
  <motion.div key="tokens" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="grid grid-cols-3 gap-2">
    <Stat value={formatNumber(summary.totalTokens || 0)}       label="Total Tokens"  Icon={Zap} iconClass="text-green-500" />
    <Stat value={formatNumber(summary.totalInputTokens || 0)}  label="Input Tokens"  Icon={Zap} iconClass="text-blue-500" />
    <Stat value={formatNumber(summary.totalOutputTokens || 0)} label="Output Tokens" Icon={Zap} iconClass="text-purple-500" />
  </motion.div>
);

const Dot = ({ active, onClick }) => (
  <button onClick={onClick}
    className={`h-2 rounded-full transition-all duration-300 ${active ? 'bg-green-500 w-4' : 'bg-gray-300 w-2'}`} />
);

export default function SummaryStatsCard({ summary, summaryTab, setSummaryTab }) {
  const cardRef = useSummarySwipe((dir) => setSummaryTab(dir === 'next' ? 'tokens' : 'cost'));
  return (
    <div ref={cardRef} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
      style={{ touchAction: 'pan-y', userSelect: 'none' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          {summaryTab === 'cost' ? 'Usage Summary' : 'Token Usage'}
        </h2>
      </div>
      <AnimatePresence mode="wait">
        {summaryTab === 'cost' ? <CostView summary={summary} /> : <TokenView summary={summary} />}
      </AnimatePresence>
      <div className="flex items-center justify-center gap-1.5 mt-3">
        <Dot active={summaryTab === 'cost'}   onClick={() => setSummaryTab('cost')} />
        <Dot active={summaryTab === 'tokens'} onClick={() => setSummaryTab('tokens')} />
      </div>
    </div>
  );
}
