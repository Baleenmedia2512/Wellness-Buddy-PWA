/**
 * QUICK START: Minimal Integration Example
 * 
 * This file shows the minimum changes needed to add hierarchical team structure
 * to your existing DisciplineReport component.
 * 
 * Copy and paste these sections into your DisciplineReport.js
 */

// ============================================================================
// STEP 1: Add imports at the top of DisciplineReport.js
// ============================================================================

import HierarchicalTeamView from './HierarchicalTeamView';
import { teamHierarchyService } from '../services/teamHierarchyService';
import { Users } from 'lucide-react';

// ============================================================================
// STEP 2: Add state variables (around line 318 in existing file)
// ============================================================================

const [activeTab, setActiveTab] = useState('myTeam'); // 'myTeam' | 'allTeams'
const [hierarchyData, setHierarchyData] = useState(null);
const [hierarchyLoading, setHierarchyLoading] = useState(false);

// ============================================================================
// STEP 3: Add data loading function (after loadDisciplineReportCallback)
// ============================================================================

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

useEffect(() => {
  if (activeTab === 'allTeams' && !hierarchyData) {
    loadHierarchyData();
  }
}, [activeTab, hierarchyData, loadHierarchyData]);

// ============================================================================
// STEP 4: Add tab navigation UI (insert after the header section)
// Find this line in your code (around line 545):
//   </div>
// </div>
// And add the tabs section right after it, BEFORE the summary stats:
// ============================================================================

{/* Tab Navigation - My Teams vs All Teams */}
<div className="bg-white border-b border-gray-100">
  <div className="max-w-3xl mx-auto px-4">
    <div className="flex gap-2">
      <button
        onClick={() => {
          setActiveTab('myTeam');
          setTeamFilter('myTeam');
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
          setTeamFilter('all');
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

// ============================================================================
// STEP 5: Wrap existing content in conditional rendering
// Find the line: <div className="max-w-3xl mx-auto px-4 py-6 relative z-10">
// Replace its content with:
// ============================================================================

<div className="max-w-3xl mx-auto px-4 py-6 relative z-10">
  {activeTab === 'myTeam' ? (
    <>
      {/* ===== YOUR EXISTING CODE GOES HERE ===== */}
      {/* Summary Stats */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        {/* ... existing summary stats ... */}
      </div>

      {/* Search Bar */}
      <div className="flex gap-3 mb-4">
        {/* ... existing search and filter ... */}
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

      {/* Member List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredAndSortedMembers.map((member) => (
            /* ... existing member cards ... */
          ))}
        </AnimatePresence>
        
        {/* No members message */}
        {filteredAndSortedMembers.length === 0 && (
          /* ... existing empty state ... */
        )}
      </div>
      {/* ===== END OF YOUR EXISTING CODE ===== */}
    </>
  ) : (
    <>
      {/* ===== NEW ALL TEAMS HIERARCHICAL VIEW ===== */}
      
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
          <span className="ml-3 text-gray-600">Loading team hierarchy...</span>
        </div>
      ) : hierarchyData ? (
        <HierarchicalTeamView
          hierarchy={hierarchyData.hierarchy}
          onNodeClick={(node) => {
            console.log('Node clicked:', node);
            // Optional: Switch to My Teams and filter by this coach
            // setActiveTab('myTeam');
            // setTeamFilter(node.userId.toString());
          }}
          showDisciplineScores={false}
          disciplineScores={{}}
          emptyMessage="No team structure found"
        />
      ) : (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Failed to load team hierarchy</p>
          <button
            onClick={loadHierarchyData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </>
  )}
</div>

// ============================================================================
// THAT'S IT! Your hierarchical team structure is now integrated.
// ============================================================================

// ============================================================================
// OPTIONAL: Show discipline scores in hierarchy
// Add this before the return statement if you want to show scores
// ============================================================================

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

// Then update the HierarchicalTeamView component:
// <HierarchicalTeamView
//   hierarchy={hierarchyData.hierarchy}
//   onNodeClick={...}
//   showDisciplineScores={true}  // ← Change to true
//   disciplineScores={disciplineScoresMap}  // ← Use the computed scores
//   emptyMessage="No team structure found"
// />

// ============================================================================
// OPTIONAL: Click node to filter My Teams view
// Replace the onNodeClick handler with this:
// ============================================================================

const handleNodeClick = (node) => {
  // Switch to My Teams tab and filter by the clicked coach/member
  setActiveTab('myTeam');
  setTeamFilter(node.userId.toString());
  
  // Scroll to top smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Then use it in HierarchicalTeamView:
// <HierarchicalTeamView
//   hierarchy={hierarchyData.hierarchy}
//   onNodeClick={handleNodeClick}  // ← Use this handler
//   ...
// />

// ============================================================================
// TESTING CHECKLIST
// ============================================================================

/*
□ Run the backend: npm run dev (in backend folder)
□ Run the frontend: npm start (in frontend folder)
□ Login as a coach
□ Navigate to Discipline Report
□ Click "All Teams" tab
□ Verify hierarchy loads
□ Click chevron to expand/collapse nodes
□ Click "Expand All" button
□ Click "Collapse All" button
□ Try clicking on a node (should log to console)
□ Switch back to "My Teams" tab
□ Verify existing functionality still works
□ Test on mobile device or responsive mode
*/

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

/*
Issue: "Cannot read property 'hierarchy' of null"
Fix: Make sure hierarchyData is loaded before rendering HierarchicalTeamView

Issue: Tabs don't switch
Fix: Check that activeTab state is being updated correctly

Issue: API returns 404
Fix: Verify the backend API file exists at:
     backend/pages/api/coach/team-hierarchy.js

Issue: No data shown in hierarchy
Fix: Check browser console for errors
     Verify user has team members in database
     Check Network tab for API response

Issue: Styles look broken
Fix: Ensure Tailwind CSS is configured
     Check that lucide-react icons are installed
     Verify framer-motion is installed for animations
*/

// ============================================================================
// DEPENDENCIES REQUIRED
// ============================================================================

/*
Make sure these packages are installed:

npm install lucide-react framer-motion axios

Or if using yarn:

yarn add lucide-react framer-motion axios
*/

export default DisciplineReport;
