/**
 * TeamTab.js — hierarchical team panel for the discipline report.
 *
 * Renders the `HierarchicalNode` tree (or empty-state placeholder) and
 * supplies the score-pill, three-column stats strip and per-row styling
 * callbacks consumed by the shared hierarchical components.
 */
import React from 'react';
import { Users } from 'lucide-react';
import HierarchicalNode from '../../../shared/components/common/HierarchicalNode';
import { SelfLogo, DirectLogo, FullTeamLogo } from '../../../shared/components/common/DisciplineScoreLogos';
import {
  matchesFilter, matchesSearch, getStatusStyle, filterOptions,
} from '../services/disciplineReportFormatter';
import { renderExpandedDetails } from './TrendTab';

const renderStatus = (node) => {
  const score = node.periodDiscipline?.percentage || 0;
  let cls = 'bg-red-50 border-red-200 text-red-600';
  if (score >= 80) cls = 'bg-green-50 border-green-300 text-green-700';
  else if (score >= 50) cls = 'bg-yellow-50 border-yellow-300 text-yellow-700';
  const [bg, border, text] = cls.split(' ');
  return (
    <div className={`px-3 py-1.5 rounded-full ${bg} border ${border}`}>
      <span className={`text-sm font-bold ${text}`}>{score}%</span>
    </div>
  );
};

const StatCol = ({ Logo, color, label, score, padding, isSingle }) => (
  <div className={`flex-1 flex flex-col items-center gap-0.5 ${isSingle ? '' : padding}`}>
    <Logo className={`${isSingle ? 'w-5 h-5' : 'w-4 h-4'} ${color}`} />
    <span className={`text-[8px] font-semibold ${color} uppercase tracking-wide leading-none`}>{label}</span>
    <span className={`${isSingle ? 'text-base sm:text-lg' : 'text-sm sm:text-base'} font-bold text-gray-900`}>
      {score}%
    </span>
  </div>
);

const SelfPair = ({ node, coCoach, selfScore, coCoachScore }) => (
  <>
    <div className="flex-1 flex flex-col items-center gap-0.5 pr-1">
      <SelfLogo className="w-4 h-4 text-blue-500" />
      <span className="text-[8px] font-semibold text-blue-500 uppercase tracking-wide leading-none">
        {node.userName || node.name}
      </span>
      <span className="text-sm sm:text-base font-bold text-gray-900">{selfScore}%</span>
    </div>
    <div className="flex-1 flex flex-col items-center gap-0.5 pr-2">
      <SelfLogo className="w-4 h-4 text-purple-500" />
      <span className="text-[8px] font-semibold text-purple-500 uppercase tracking-wide leading-none">
        {coCoach.userName || coCoach.name}
      </span>
      <span className="text-sm sm:text-base font-bold text-gray-900">{coCoachScore}%</span>
    </div>
  </>
);

const buildStats = (node, coCoach, sortBy) => {
  const selfScore = node.periodDiscipline?.percentage || 0;
  const directScore = node.directTeamDiscipline?.percentage || 0;
  const fullScore = node.fullTeamDiscipline?.percentage || 0;
  const coCoachScore = coCoach?.periodDiscipline?.percentage || 0;
  const cols = [
    { key: 'self', score: selfScore, Logo: SelfLogo, color: 'text-blue-500', label: 'Self', padding: 'pr-2' },
    { key: 'direct', score: directScore, Logo: DirectLogo, color: 'text-green-500', label: 'Direct', padding: 'px-2' },
    { key: 'full', score: fullScore, Logo: FullTeamLogo, color: 'text-purple-500', label: 'Full', padding: 'pl-2' },
  ];
  const isSingle = sortBy !== 'all';
  const visible = isSingle ? cols.filter((c) => c.key === sortBy) : cols;
  return { isSingle, visible, selfScore, directScore, fullScore, coCoachScore };
};

const buildRenderStats = (sortBy) => (node, _level, _isCurrent, coCoach = null) => {
  const { isSingle, visible, selfScore, directScore, fullScore, coCoachScore } = buildStats(node, coCoach, sortBy);
  if (!isSingle && coCoach) return (
    <>
      <SelfPair node={node} coCoach={coCoach} selfScore={selfScore} coCoachScore={coCoachScore} />
      <StatCol Logo={DirectLogo} color="text-green-500" label="Direct" score={directScore} padding="px-2" isSingle={false} />
      <StatCol Logo={FullTeamLogo} color="text-purple-500" label="Full" score={fullScore} padding="pl-2" isSingle={false} />
    </>
  );
  return <>{visible.map((c) => <StatCol key={c.key} {...c} isSingle={isSingle} />)}</>;
};

const EmptyState = ({ filter, searchQuery }) => {
  let detail = 'No team members to display.';
  if (filter !== 'all') detail = `No members match the "${filterOptions.find((f) => f.value === filter)?.label}" filter.`;
  else if (searchQuery) detail = `No members match "${searchQuery}".`;
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No members found</h3>
      <p className="text-sm text-gray-500 max-w-sm">{detail}</p>
    </div>
  );
};

const TeamTab = ({ vm }) => {
  if (!vm.visibleHierarchy) return <EmptyState filter={vm.filter} searchQuery={vm.searchQuery} />;
  return (
    <HierarchicalNode
      key={`hierarchy-${vm.teamView}`}
      node={vm.visibleHierarchy}
      level={0}
      isLastChild
      renderStatus={renderStatus}
      renderStats={buildRenderStats(vm.sortBy)}
      renderExpandedDetails={renderExpandedDetails}
      isCurrentUser
      showTeamCount
      getStatusStyle={getStatusStyle}
      searchQuery={vm.searchQuery}
      filter={vm.filter}
      matchesFilter={matchesFilter}
      matchesSearch={matchesSearch}
      forceExpandedState={vm.expandOverride}
      defaultExpanded={vm.expandOverride === 'expanded'}
      onProfileClick={vm.setProfileModalEmail}
    />
  );
};

export default TeamTab;
