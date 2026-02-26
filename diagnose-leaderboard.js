/* LEADERBOARD FUNCTIONALITY COMMENTED OUT
async function diagnose() {
  try {
    console.log('🔍 Diagnosing leaderboard issue...\n');
    
    // Check what data exists
    const response = await fetch('http://localhost:3000/api/leaderboard/check-data');
    const data = await response.json();
    
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Active Users: ${data.summary.totalActiveUsers}`);
    console.log(`Users with Today Weight: ${data.summary.usersWithTodayWeight}`);
    console.log(`Users with Yesterday Weight: ${data.summary.usersWithYesterdayWeight}`);
    console.log(`Eligible for Leaderboard: ${data.summary.eligibleForLeaderboard}`);
    console.log(`\nToday Date: ${data.dates.today}`);
    console.log(`Yesterday Date: ${data.dates.yesterday}`);
    
    // Find users 339 and 347 specifically
    console.log('\n🔎 CHECKING USERS 339 & 347 (from screenshot)');
    console.log('='.repeat(70));
    const user339 = data.users.find(u => u.userId === 339);
    const user347 = data.users.find(u => u.userId === 347);
    
    if (user339) {
      console.log('\n✅ User 339 FOUND:');
      console.log(`   Name: ${user339.userName}`);
      console.log(`   Email: ${user339.email}`);
      console.log(`   Coach: ${user339.coach}`);
      console.log(`   Has Today Weight: ${user339.hasTodayWeight} ${user339.todayWeight ? `(${user339.todayWeight} kg)` : ''}`);
      console.log(`   Has Yesterday Weight: ${user339.hasYesterdayWeight} ${user339.yesterdayWeight ? `(${user339.yesterdayWeight} kg)` : ''}`);
      console.log(`   Can Show In Leaderboard: ${user339.canShowInLeaderboard}`);
    } else {
      console.log('\n❌ User 339 NOT FOUND in active users');
      console.log('   → This user might not have Status="Active" in team_table');
    }
    
    if (user347) {
      console.log('\n✅ User 347 FOUND:');
      console.log(`   Name: ${user347.userName}`);
      console.log(`   Email: ${user347.email}`);
      console.log(`   Coach: ${user347.coach}`);
      console.log(`   Has Today Weight: ${user347.hasTodayWeight} ${user347.todayWeight ? `(${user347.todayWeight} kg)` : ''}`);
      console.log(`   Has Yesterday Weight: ${user347.hasYesterdayWeight} ${user347.yesterdayWeight ? `(${user347.yesterdayWeight} kg)` : ''}`);
      console.log(`   Can Show In Leaderboard: ${user347.canShowInLeaderboard}`);
    } else {
      console.log('\n❌ User 347 NOT FOUND in active users');
      console.log('   → This user might not have Status="Active" in team_table');
    }
    
    // Show any users that DO have weight data
    console.log('\n📋 USERS WITH ANY WEIGHT DATA');
    console.log('='.repeat(70));
    const usersWithData = data.users.filter(u => u.hasTodayWeight || u.hasYesterdayWeight).slice(0, 10);
    
    if (usersWithData.length === 0) {
      console.log('❌ NO USERS have weight data for today or yesterday!');
      console.log('\nPossible reasons:');
      console.log('1. No Active users have entered weight yet');
      console.log('2. Weight records exist but users Status != "Active"');
      console.log('3. Date range issue (check timezone or date format)');
    } else {
      usersWithData.forEach(user => {
        const status = user.canShowInLeaderboard ? '✅' : '⚠️';
        console.log(`${status} User ${user.userId}: ${user.userName || 'No Name'}`);
        console.log(`   Today: ${user.hasTodayWeight ? '✓ ' + user.todayWeight + 'kg' : '✗'} | Yesterday: ${user.hasYesterdayWeight ? '✓ ' + user.yesterdayWeight + 'kg' : '✗'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

diagnose();
*/
