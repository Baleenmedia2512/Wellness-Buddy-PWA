/* LEADERBOARD FUNCTIONALITY COMMENTED OUT
async function findEligibleUsers() {
  try {
    console.log('🔍 Finding users closest to leaderboard eligibility...\n');
    
    const response = await fetch('http://localhost:3000/api/leaderboard/check-data');
    const data = await response.json();
    
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Active Users: ${data.summary.totalActiveUsers}`);
    console.log(`Eligible for Leaderboard: ${data.summary.eligibleForLeaderboard}`);
    console.log(`Date Range: ${data.dates.yesterday} to ${data.dates.today}\n`);
    
    // Find users with EITHER today OR yesterday weight (close to eligible)
    const hasToday = data.users.filter(u => u.hasTodayWeight);
    const hasYesterday = data.users.filter(u => u.hasYesterdayWeight);
    const hasBoth = data.users.filter(u => u.canShowInLeaderboard);
    
    console.log('🎯 USERS WITH WEIGHT DATA:');
    console.log('='.repeat(70));
    console.log(`✅ Users with BOTH today & yesterday: ${hasBoth.length} (ELIGIBLE!)`);
    console.log(`⚠️  Users with ONLY today: ${hasToday.length - hasBoth.length}`);
    console.log(`⚠️  Users with ONLY yesterday: ${hasYesterday.length - hasBoth.length}\n`);
    
    if (hasBoth.length > 0) {
      console.log('✅ ELIGIBLE USERS (will show on leaderboard):');
      console.log('='.repeat(70));
      hasBoth.forEach(u => {
        const loss = u.yesterdayWeight - u.todayWeight;
        console.log(`User ${u.userId}: ${u.userName || 'No Name'}`);
        console.log(`  Today: ${u.todayWeight} kg | Yesterday: ${u.yesterdayWeight} kg`);
        console.log(`  Weight Change: ${loss > 0 ? 'LOST ' + loss.toFixed(2) : 'GAINED ' + Math.abs(loss).toFixed(2)} kg`);
        console.log(`  Coach: ${u.coach || 'None'}`);
        console.log('');
      });
    }
    
    if (hasToday.length - hasBoth.length > 0) {
      console.log('⚠️  USERS WITH ONLY TODAY\'S WEIGHT (need yesterday weight):');
      console.log('='.repeat(70));
      hasToday.filter(u => !u.hasYesterdayWeight).slice(0, 5).forEach(u => {
        console.log(`User ${u.userId}: ${u.userName || 'No Name'} (Today: ${u.todayWeight} kg)`);
      });
      console.log('');
    }
    
    if (hasYesterday.length - hasBoth.length > 0) {
      console.log('⚠️  USERS WITH ONLY YESTERDAY\'S WEIGHT (need today weight):');
      console.log('='.repeat(70));
      hasYesterday.filter(u => !u.hasTodayWeight).slice(0, 5).forEach(u => {
        console.log(`User ${u.userId}: ${u.userName || 'No Name'} (Yesterday: ${u.yesterdayWeight} kg)`);
      });
      console.log('');
    }
    
    if (hasBoth.length === 0) {
      console.log('❌ NO ELIGIBLE USERS FOUND');
      console.log('='.repeat(70));
      console.log('None of your active users have weight entries for BOTH dates.');
      console.log('For the leaderboard to show real data, users need to:');
      console.log('1. Have weight entry for Feb 24, 2026 (yesterday)');
      console.log('2. Have weight entry for Feb 25, 2026 (today)');
      console.log('3. Have Status = "Active" in team_table');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findEligibleUsers();
*/
