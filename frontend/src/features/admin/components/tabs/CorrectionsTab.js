/**
 * CorrectionsTab.js — inline editor for per-time-range USD pricing.
 *
 * Receives view-model + handler bag from `useCorrectionsController` (in the
 * orchestrator). USD inputs auto-recalculate the matching INR side. Save
 * commits to /api/token/correction and updates the live summary.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, IndianRupee } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';
import { formatCurrency } from '../../services/tokenCostMath';

const UsdInput = ({ label, value, placeholder, onChange }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <div className="relative">
      <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-sm text-gray-400">$</span>
      <input type="number" step="0.01" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-6 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
    </div>
  </div>
);

const InrPreview = ({ label, cost }) => (
  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
    <span className="text-xs text-gray-600">{label}</span>
    <span className="flex items-center text-sm font-semibold text-green-600">
      <IndianRupee className="w-3.5 h-3.5 mr-0.5" />
      {Number(cost).toFixed(4)}
    </span>
  </div>
);

export default function CorrectionsTab({
  perMillionInputs, exchangeRate, onChangeUsd,
  tokenCosts, savingCorrection, showSuccess,
  onSave, onClose,
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Token Cost Correction</h2>
          {exchangeRate && (
            <p className="text-xs text-gray-500 mt-1">Current Rate: $1 USD = ₹{exchangeRate.toFixed(2)} INR</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-green-500 text-white rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5" />
            <span className="font-medium">Token costs saved successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl">
          <UsdInput label="Input Token Cost (USD)"  value={perMillionInputs.inputPerMillion}  placeholder="0.10"
            onChange={(v) => onChangeUsd('inputPerMillion', v)} />
          <UsdInput label="Output Token Cost (USD)" value={perMillionInputs.outputPerMillion} placeholder="0.40"
            onChange={(v) => onChangeUsd('outputPerMillion', v)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InrPreview label="Input INR"  cost={tokenCosts.inputCost} />
          <InrPreview label="Output INR" cost={tokenCosts.outputCost} />
        </div>

        <div className="text-center text-sm text-gray-500">
          Total Corrected: <span className="font-bold text-gray-800">{formatCurrency(tokenCosts.inputCost + tokenCosts.outputCost)}</span>
        </div>
      </div>

      {!savingCorrection ? (
        <div className="flex gap-3 mt-6">
          <TouchFeedbackButton onClick={onClose} ariaLabel="Close without saving"
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium">
            Close
          </TouchFeedbackButton>
          <TouchFeedbackButton onClick={onSave} ariaLabel="Save token costs"
            className="flex-1 px-4 py-3 text-white rounded-xl transition-colors font-medium bg-green-600 hover:bg-green-700">
            Save
          </TouchFeedbackButton>
        </div>
      ) : (
        <div className="flex justify-center mt-6 text-gray-500 text-sm">Saving...</div>
      )}
    </div>
  );
}
