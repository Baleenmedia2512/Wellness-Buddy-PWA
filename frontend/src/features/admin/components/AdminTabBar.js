/**
 * AdminTabBar.js — horizontal tab nav for the admin dashboard.
 */
import React from 'react';
import { DollarSign, Users, Edit3 } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

export const ADMIN_TABS = [
  { id: 'tokens',      label: 'Tokens',      Icon: DollarSign },
  { id: 'users',       label: 'Users',       Icon: Users },
  { id: 'corrections', label: 'Corrections', Icon: Edit3 },
];

export default function AdminTabBar({ activeTab, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1"
      style={{ WebkitOverflowScrolling: 'touch' }}>
      {ADMIN_TABS.map(({ id, label, Icon }) => {
        const active = activeTab === id;
        return (
          <TouchFeedbackButton key={id} onClick={() => onChange(id)} ariaLabel={`Open ${label} tab`}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all focus:outline-none ${
              active ? 'bg-green-600 text-white shadow-md shadow-green-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </TouchFeedbackButton>
        );
      })}
    </div>
  );
}
