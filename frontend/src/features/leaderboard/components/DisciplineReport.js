/**
 * DisciplineReport.js — slice orchestrator.
 *
 * Composes `useDisciplineReport` with the OverviewTab summary card,
 * the TeamTab hierarchy and the modal pair (settings + profile).
 * Renders `LoadingSkeleton` while the initial fetch resolves.
 */
import React from 'react';
import HierarchicalReportLayout, {
  LoadingSkeleton,
} from '../../../shared/components/common/HierarchicalReportLayout';
import TimeWindowSettingsModal from '../../../shared/components/TimeWindowSettingsModal';
import { TeamMemberProfileModal } from '../../../shared/components/TeamMemberProfileModal';
import { useDisciplineReport } from '../hooks/useDisciplineReport';
import { filterOptions } from '../services/disciplineReportFormatter';
import OverviewTab from '../tabs/OverviewTab';
import TeamTab from '../tabs/TeamTab';

const formatSubtitle = (count) => {
  const time = new Date()
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .replace(/\s?(AM|PM)/i, '');
  return `${count} member • ${time}`;
};

const DisciplineReport = ({ user, onBack }) => {
  const vm = useDisciplineReport({ user });
  if (vm.loading) return <LoadingSkeleton />;

  return (
    <HierarchicalReportLayout
      title="Discipline Report"
      subtitle={formatSubtitle(vm.teamCounts.total)}
      onBack={onBack}
      onRefresh={vm.handleManualRefresh}
      onDownload={vm.handleDownload}
      onSettings={vm.handleSettings}
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
      summaryStats={vm.hierarchySummaryStats}
      onExpandAll={vm.handleExpandAll}
      onCollapseAll={vm.handleCollapseAll}
      expandedState={vm.expandOverride}
      onTeamViewChange={vm.setTeamView}
      teamView={vm.teamView}
      topContent={<OverviewTab summaryStats={vm.summaryStats} />}
    >
      <TeamTab vm={vm} />
      <TimeWindowSettingsModal
        isOpen={vm.showSettings}
        onClose={() => vm.setShowSettings(false)}
        onUpdate={vm.handleSettingsUpdate}
        userEmail={user?.email}
      />
      <TeamMemberProfileModal
        isOpen={!!vm.profileModalEmail}
        onClose={() => vm.setProfileModalEmail(null)}
        memberEmail={vm.profileModalEmail}
      />
    </HierarchicalReportLayout>
  );
};

export default DisciplineReport;
