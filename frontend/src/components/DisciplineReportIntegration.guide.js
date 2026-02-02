/**
 * INTEGRATION GUIDE: Adding Hierarchical Team Structure to Discipline Report
 * 
 * This file contains the modifications needed to add "My Teams" and "All Teams" tabs
 * with hierarchical team structure to the existing DisciplineReport component.
 * 
 * IMPLEMENTATION STEPS:
 * =====================
 * 
 * 1. Add new state variables to DisciplineReport component (around line 318):
 */

// Add these state variables:
const [activeTab, setActiveTab] = useState('myTeam'); // 'myTeam' | 'allTeams'
const [hierarchyData, setHierarchyData] = useState(null);
const [hierarchyLoading, setHierarchyLoading] = useState(false);

/**
 * 2. Import the new components at the top of DisciplineReport.js:
 */

// Add these imports:
import HierarchicalTeamView from './HierarchicalTeamView';
import { teamHierarchyService } from '../services/teamHierarchyService';
import { Users } from 'lucide-react'; // If not already imported

/**
 * 3. Add function to load hierarchy data (add after loadDisciplineReportCallback):
 */

const loadHierarchyData = React.useCallback(async () => {
  if (!user?.id) return;
  
  setHierarchyLoading(true);
  try {
    const data = await teamHierarchyService.getTeamHierarchy(user.id, false);
    setHierarchyData(data);
  } catch (err) {
    console.error('Failed to load team hierarchy:', err);
  } finally {
    setHierarchyLoading(false);
  }
}, [user?.id]);

// Add useEffect to load hierarchy when switching to All Teams tab
useEffect(() => {
  if (activeTab === 'allTeams' && !hierarchyData) {
    loadHierarchyData();
  }
}, [activeTab, hierarchyData, loadHierarchyData]);

/**
 * 4. Add Tab Navigation UI (insert after the header, around line 545):
 * 
 * Replace the existing header section or add tabs below it.
 * Insert this code after the date range selector and before the summary stats:
 */

// {/* Tab Navigation - My Teams vs All Teams */}

<div className="bg-white border-b border-gray-100">
  <div className="max-w-3xl mx-auto px-4">
    <div className="flex gap-2">
      <button
        onClick={() => {
          setActiveTab('myTeam');
          setTeamFilter('myTeam'); // Reset to My Team filter
        }}
        className={`flex-1 py-3 px-4 text-sm font-semibold transition-all border-b-2 ${
          activeTab === 'myTeam'
            ? 'border-green-600 text-green-700 bg-green-50/50'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <Users className="w-4 h-4" />
          <span>My Teams</span>
        </div>
      </button>
      <button
        onClick={() => {
          setActiveTab('allTeams');
          setTeamFilter('all'); // Reset to All filter
        }}
        className={`flex-1 py-3 px-4 text-sm font-semibold transition-all border-b-2 ${
          activeTab === 'allTeams'
            ? 'border-blue-600 text-blue-700 bg-blue-50/50'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <Users className="w-4 h-4" />
          <span>All Teams</span>
        </div>
      </button>
    </div>
  </div>
</div>

/**
 * 5. Modify the main content area to show different views based on active tab.
 * 
 * Replace the existing member list section (around line 750-900) with conditional rendering:
 */

{/* Content Area - Conditional based on active tab */}
<div className="max-w-3xl mx-auto px-4 py-6 relative z-10">
  {activeTab === 'myTeam' ? (
    // MY TEAMS VIEW - Existing flat list with filters
    <>
      {/* Summary Stats - Compact Dashboard Strip */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        {/* Your existing summary stats component */}
      </div>

      {/* Search Bar */}
      <div className="flex gap-3 mb-4">
        {/* Your existing search and filter UI */}
      </div>

      {/* Team Filter Pills */}
      {teamData?.coachFilters && teamData.coachFilters.length > 0 && (
        <div className="mb-4">
          <TeamFilterPills
            filters={teamData.coachFilters}
            activeFilter={teamFilter}
            onChange={setTeamFilter}
          />
        </div>
      )}

      {/* Member List - Your existing implementation */}
      <div className="space-y-3">
        {/* Your existing member cards */}
      </div>
    </>
  ) : (
    // ALL TEAMS VIEW - Hierarchical tree view
    <>
      {/* Hierarchy Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Team Hierarchy</h2>
        <p className="text-sm text-gray-600">
          Expand coaches and co-coaches to see their team members
        </p>
        
        {hierarchyData && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  {hierarchyData.stats?.totalCoaches || 0}
                </div>
                <div className="text-xs text-gray-500">Coaches</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  {hierarchyData.stats?.totalMembers || 0}
                </div>
                <div className="text-xs text-gray-500">Members</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hierarchical View */}
      {hierarchyLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : hierarchyData ? (
        <HierarchicalTeamView
          hierarchy={hierarchyData.hierarchy}
          onNodeClick={(node) => {
            console.log('Node clicked:', node);
            // Optional: Navigate to member detail or show discipline scores
          }}
          showDisciplineScores={false} // Set to true if you want to show scores in hierarchy
          disciplineScores={{}} // Map of userId -> discipline percentage
          emptyMessage="No team structure found"
        />
      ) : (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Failed to load team hierarchy</p>
          <button
            onClick={loadHierarchyData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </>
  )}
</div>

/**
 * 6. OPTIONAL: To show discipline scores in the hierarchy view
 * 
 * If you want to display discipline percentages in the All Teams hierarchy,
 * create a mapping from the existing teamData:
 */

const disciplineScoresMap = React.useMemo(() => {
  if (!teamData) return {};
  
  const scores = {};
  
  // Add coach score
  if (teamData.coachPerformance) {
    scores[teamData.coachPerformance.userId] = 
      teamData.coachPerformance.periodDiscipline?.percentage || 0;
  }
  
  // Add team member scores
  if (teamData.teamMembers) {
    teamData.teamMembers.forEach(member => {
      scores[member.userId] = member.periodDiscipline?.percentage || 0;
    });
  }
  
  return scores;
}, [teamData]);

// Then pass this to HierarchicalTeamView:
// <HierarchicalTeamView
//   ...
//   showDisciplineScores={true}
//   disciplineScores={disciplineScoresMap}
// />

/**
 * 7. ADVANCED FEATURES (Optional):
 * 
 * A. Clickable nodes to filter discipline report:
 */

const handleNodeClick = (node) => {
  // Switch to My Teams tab and filter by the clicked node
  setActiveTab('myTeam');
  setTeamFilter(node.userId.toString());
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**
 * B. Search within hierarchy:
 */

const [hierarchySearchQuery, setHierarchySearchQuery] = useState('');

const handleHierarchySearch = async () => {
  if (!hierarchySearchQuery.trim()) {
    loadHierarchyData();
    return;
  }
  
  try {
    const results = await teamHierarchyService.searchInHierarchy(
      user.id,
      hierarchySearchQuery
    );
    // Display search results or highlight matching nodes
    console.log('Search results:', results);
  } catch (err) {
    console.error('Hierarchy search failed:', err);
  }
};

/**
 * 8. Styling considerations:
 * 
 * The HierarchicalTeamView component uses Tailwind CSS classes compatible
 * with your existing styling. Colors used:
 * - Blue for coaches: bg-blue-50, border-blue-200, text-blue-700
 * - Yellow for admins: bg-yellow-50, border-yellow-200, text-yellow-700  
 * - Purple for co-coaches: border-l-purple-500, bg-purple-100
 * - Green for high scores: text-green-600
 * 
 * Adjust colors in HierarchicalTeamView.js if needed to match your theme.
 */

/**
 * 9. Testing checklist:
 * 
 * □ Tabs switch correctly between My Teams and All Teams
 * □ My Teams shows existing flat list with filters
 * □ All Teams loads and displays hierarchy
 * □ Expand/Collapse works for all nodes
 * □ Co-coaches are visually distinguished
 * □ Different roles (admin/coach/user) show correct styling
 * □ Empty states display properly
 * □ Loading states work correctly
 * □ Refresh button reloads both views
 * □ Back button navigates properly
 * □ Mobile responsive layout works
 */

export default DisciplineReport;
