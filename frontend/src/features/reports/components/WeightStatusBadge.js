/**
 * WeightStatusBadge.js — Presentational pill for weight status.
 */
import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle, HelpCircle } from 'lucide-react';

const CONFIG = {
  above_ideal: {
    label:     'Above Ideal',
    Icon:      TrendingUp,
    bg:        'bg-orange-100',
    text:      'text-orange-700',
    iconClass: 'text-orange-500',
  },
  below_ideal: {
    label:     'Below Ideal',
    Icon:      TrendingDown,
    bg:        'bg-blue-100',
    text:      'text-blue-700',
    iconClass: 'text-blue-500',
  },
  on_track: {
    label:     'On Track',
    Icon:      CheckCircle,
    bg:        'bg-green-100',
    text:      'text-green-700',
    iconClass: 'text-green-500',
  },
  no_weight: {
    label:     'No Weight',
    Icon:      HelpCircle,
    bg:        'bg-gray-100',
    text:      'text-gray-500',
    iconClass: 'text-gray-400',
  },
  no_height: {
    label:     'No Height',
    Icon:      HelpCircle,
    bg:        'bg-gray-100',
    text:      'text-gray-500',
    iconClass: 'text-gray-400',
  },
};

export default function WeightStatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.no_height;
  const { label, Icon, bg, text, iconClass } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${bg} ${text}`}>
      <Icon className={`h-3 w-3 ${iconClass}`} />
      {label}
    </span>
  );
}
