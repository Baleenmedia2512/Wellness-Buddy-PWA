/**
 * UserCard.js — single user spending row with expandable token breakdown.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowDown, ArrowUp } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../services/tokenCostMath';

const TokenSide = ({ Icon, label, color, tokens, cost }) => (
  <div className={`flex flex-col items-center p-3 rounded-lg bg-white border border-${color}-100`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border bg-${color}-50 border-${color}-200 text-${color}-700 mb-2`}>
      <Icon className="w-5 h-5" />
    </div>
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</span>
    <span className="text-sm font-bold text-gray-800 mt-1">{formatNumber(tokens || 0)}</span>
    <span className={`text-xs text-${color}-600 font-semibold mt-0.5`}>{formatCurrency(cost || 0)}</span>
  </div>
);

export default function UserCard({ user, expanded, onToggle }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} layout
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div onClick={onToggle}
        className="p-3 sm:p-4 flex items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors">
        <div className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold border-2 bg-gradient-to-br from-green-50 to-green-100 border-green-200 text-green-700">
          {(user.userName || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm sm:text-[15px] leading-tight break-words">{user.userName}</h3>
          <p className="text-[10px] sm:text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 font-medium mt-0.5">{formatNumber(user.totalTokens)} tokens</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="text-right">
            <div className="text-base sm:text-lg font-bold text-green-600 leading-tight">{formatCurrency(user.totalCost)}</div>
            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider text-right">Cost</div>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-300 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-50 bg-gray-50/30">
            <div className="p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Token Breakdown</h4>
              <div className="grid grid-cols-2 gap-3">
                <TokenSide Icon={ArrowDown} label="Input"  color="blue"   tokens={user.inputTokens}  cost={user.inputCost} />
                <TokenSide Icon={ArrowUp}   label="Output" color="purple" tokens={user.outputTokens} cost={user.outputCost} />
              </div>
            </div>
            <div className="px-4 pb-4 pt-0 text-center">
              <p className="text-[11px] sm:text-xs text-gray-400 font-medium">
                Total: {formatNumber(user.totalTokens)} tokens • {formatCurrency(user.totalCost)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
