/* LEADERBOARD FUNCTIONALITY COMMENTED OUT
async function testLeaderboard() {
  try {
    console.log('🏆 Testing Leaderboard API after status update...\n');
    
    const response = await fetch('http://localhost:3000/api/leaderboard/get-global-leaderboard?topN=3');
    const data = await response.json();
    
    console.log('='.repeat(70));
    console.log('API Response:');
    console.log('  Success:', data.success);
    console.log('  Total Eligible Users:', data.totalEligible);
    console.log('  Data Returned:', data.data?.length || 0, 'users');
    console.log('='.repeat(70));
    
    if (data.data && data.data.length > 0) {
      console.log('\n✅ SUCCESS! Real data is now showing:\n');
      data.data.forEach(user => {
        console.log(`  🏅 Rank ${user.rank}: ${user.userName}`);
        console.log(`     Weight Loss: ${user.weightLoss} kg`);
        console.log(`     Coach: ${user.coachName}`);
        console.log(`     Today: ${user.todayWeight} kg | Yesterday: ${user.yesterdayWeight} kg`);
        console.log('');
      });
    } else {
      console.log('\n⚠️  Still no data available');
      console.log('Message:', data.message);
      console.log('\nThis means users 339 & 347 might not have weight records for');
      console.log('BOTH today (Feb 25) AND yesterday (Feb 24).');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLeaderboard();
*/
