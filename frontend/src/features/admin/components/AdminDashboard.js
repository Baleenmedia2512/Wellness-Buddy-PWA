/**
 * AdminDashboard.js — orchestrator (post-refactor).
 *
 * Wires every hook to the tab bar and renders the active tab. Keeps the
 * sticky header + global time-range filter visible across all tabs so
 * filters apply consistently. Public contract `{ user, onClose }` is
 * unchanged so external call sites (App.js, features/admin/index.js)
 * don't need updates.
 */
import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import AdminHeader from './AdminHeader';
import AdminTabBar from './AdminTabBar';
import DateRangePicker from './DateRangePicker';
import TimeRangeFilter from './shared/TimeRangeFilter';

import TokensTab from './tabs/TokensTab';
import UsersTab from './tabs/UsersTab';
import CorrectionsTab from './tabs/CorrectionsTab';

import useAdminFilters from '../hooks/useAdminFilters';
import useTokenManagement from '../hooks/useTokenManagement';
import useAdminReports from '../hooks/useAdminReports';
import useAdminBackButton from '../hooks/useAdminBackButton';
import useCorrectionsController from '../hooks/useCorrectionsController';

const AdminDashboard = ({ user, onClose }) => {
  const [activeTab, setActiveTab] = useState('tokens');
  const filters = useAdminFilters();

  const tokens = useTokenManagement({
    email: user?.email,
    timeRange: filters.timeRange,
    customStartDate: filters.customStartDate,
    customEndDate: filters.customEndDate,
  });

  const reports = useAdminReports({
    tokenData: tokens.tokenData,
    searchQuery: filters.searchQuery,
    sortField: filters.sortField,
    sortDirection: filters.sortDirection,
    timeRange: filters.timeRange,
    customStartDate: filters.customStartDate,
    customEndDate: filters.customEndDate,
  });

  const corrections = useCorrectionsController({
    email: user?.email,
    timeRange: filters.timeRange,
    customStartDate: filters.customStartDate,
    customEndDate: filters.customEndDate,
    tokenData: tokens.tokenData,
    applyCorrectionToSummary: tokens.applyCorrectionToSummary,
    isActive: activeTab === 'corrections',
  });

  useAdminBackButton(onClose);

  const skel = { loading: tokens.loading, apiError: tokens.apiError };

  return (
    <div className="fixed inset-0 z-50 bg-green-50 overflow-y-auto">
      <AdminHeader onClose={onClose} onRefresh={tokens.refetch}
        refreshing={tokens.refreshing} savedFlash={corrections.savedFlash} />

      <div className="max-w-lg mx-auto p-4 space-y-4 pb-20">
        <AdminTabBar activeTab={activeTab} onChange={setActiveTab} />
        <TimeRangeFilter
          timeRange={filters.timeRange} onSelectRange={filters.selectTimeRange}
          showDatePicker={filters.showDatePicker}
          onToggleDatePicker={() => filters.setShowDatePicker(!filters.showDatePicker)}
          customRangeLabel={reports.dateRangeLabel}
        />
        <AnimatePresence>
          {filters.showDatePicker && (
            <DateRangePicker
              startDate={filters.customStartDate} endDate={filters.customEndDate}
              onSelect={filters.selectCustomRange} onClose={() => filters.setShowDatePicker(false)} />
          )}
        </AnimatePresence>

        {activeTab === 'tokens' && (
          <TokensTab {...skel}
            summary={reports.summary}
            userCount={reports.userSpending.length}
            timeRange={filters.timeRange}
            dateRangeLabel={reports.dateRangeLabel}
            customStartDate={filters.customStartDate}
            customEndDate={filters.customEndDate}
          />
        )}
        {activeTab === 'users' && (
          <UsersTab {...skel}
            filteredAndSortedUsers={reports.filteredAndSortedUsers}
            searchQuery={filters.searchQuery} setSearchQuery={filters.setSearchQuery}
            sortField={filters.sortField} sortDirection={filters.sortDirection}
            onToggleSort={filters.handleSort} />
        )}
        {activeTab === 'corrections' && (
          <CorrectionsTab
            perMillionInputs={corrections.perMillionInputs}
            exchangeRate={corrections.exchangeRate}
            onChangeUsd={corrections.onChangeUsd}
            tokenCosts={corrections.tokenCosts}
            savingCorrection={corrections.savingCorrection}
            showSuccess={corrections.showSuccess}
            onSave={corrections.onSave}
            onClose={() => setActiveTab('tokens')}
          />
        )}
        {tokens.lastUpdated && (
          <div className="text-center text-xs text-gray-400">
            Last updated: {tokens.lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
