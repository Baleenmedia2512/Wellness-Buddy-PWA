/**
 * AttendanceTable.js — hierarchical attendance report shell.
 *
 * Wires the view-model from `useAttendanceReport` into
 * `HierarchicalReportLayout` and renders either the `HierarchicalNode`
 * tree (with row renderers) or the `AttendanceEmptyState` placeholder.
 */
import React from 'react';
import HierarchicalReportLayout from '../../../shared/components/common/HierarchicalReportLayout';
import HierarchicalNode from '../../../shared/components/common/HierarchicalNode';
import {
  matchesFilter, matchesSearch,
} from '../services/attendanceReportFormatter';
import { getStatusStyle } from '../services/attendanceRowStyles';
import { renderStatus, renderExpandedDetails } from './AttendanceRowStatus';
import { renderStats as renderStatsBase } from './AttendanceRowStats';
import AttendanceEmptyState, { filterOptions } from './AttendanceFilters';

const AttendanceTable = ({ vm, onBack }) => {
  const subtitle = `${vm.teamCounts.coaches + vm.teamCounts.members} Members ï¿½ Last updated ${
    new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })}`;
  const renderStats = (node, level, isCurrentUser, coCoach = null) =>
    renderStatsBase(node, level, isCurrentUser, coCoach, vm.sortBy);

  return (
    <HierarchicalReportLayout
      title="Attendance Report"
      subtitle={subtitle}
      onBack={onBack}
      onRefresh={vm.handleManualRefresh}
      sortBy={vm.sortBy}
      sortOrder={vm.sortOrder}
      onSortChange={vm.handleSortChange}
      loading={vm.refreshing}
      error={vm.error}
      dateRange={vm.dateRange}
      onDateRangeChange={vm.setDateRange}
      customStartDate={vm.customStartDate}
      customEndDate={vm.customEndDate}
      onCustomDateSelect={vm.handleDateRangeSelect}
      searchQuery={vm.searchQuery}
      onSearchChange={vm.setSearchQuery}
      filter={vm.filter}
      onFilterChange={vm.setFilter}
      filterOptions={filterOptions}
      allowedDateRanges={['today', 'yesterday']}
      singleDayCustom
      summaryStats={vm.summaryStats}
      onExpandAll={vm.handleExpandAll}
      onCollapseAll={vm.handleCollapseAll}
      expandedState={vm.expandOverride}
      teamView={vm.teamView}
      onTeamViewChange={vm.setTeamView}
      onDownload={vm.handleDownload}
    >
      {vm.visibleHierarchy ? (
        <HierarchicalNode
          key={`hierarchy-${vm.teamView}`}
          node={vm.visibleHierarchy}
          level={0}
          isLastChild
          renderStatus={renderStatus}
          renderStats={renderStats}
          renderExpandedDetails={renderExpandedDetails}
          isCurrentUser
          showTeamCount
          showIndividualReports={false}
          getStatusStyle={getStatusStyle}
          searchQuery={vm.searchQuery}
          filter={vm.filter}
          matchesFilter={matchesFilter}
          matchesSearch={matchesSearch}
          forceExpandedState={vm.expandOverride}
          defaultExpanded={vm.expandOverride === 'expanded'}
          onProfileClick={vm.setProfileModalEmail}
        />
      ) : (
        <AttendanceEmptyState filter={vm.filter} searchQuery={vm.searchQuery} />
      )}
    </HierarchicalReportLayout>
  );
};

export default AttendanceTable;
