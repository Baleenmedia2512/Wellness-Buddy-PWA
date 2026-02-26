/* LEADERBOARD FUNCTIONALITY COMMENTED OUT
async function testOptimizedAPI() {
  console.log('🚀 Testing optimized leaderboard API...\n');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3000/api/leaderboard/get-global-leaderboard?topN=10');
    const data = await response.json();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('='.repeat(70));
    console.log('⚡ PERFORMANCE TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`Response Time: ${duration}ms`);
    console.log(`Success: ${data.success}`);
    console.log(`Top N: ${data.topN}`);
    console.log(`Total Eligible: ${data.totalEligible}`);
    console.log(`Data Returned: ${data.data?.length || 0} users`);
    console.log('='.repeat(70));
    
    if (duration < 500) {
      console.log('✅ EXCELLENT! API is very fast (<500ms)');
    } else if (duration < 1000) {
      console.log('✅ GOOD! API is fast (<1s)');
    } else if (duration < 2000) {
      console.log('⚠️  MODERATE - API is slower than ideal');
    } else {
      console.log('❌ SLOW - API needs optimization');
    }
    
    if (data.data && data.data.length > 0) {
      console.log('\n📊 TOP 10 LEADERBOARD:');
      console.log('='.repeat(70));
      data.data.forEach(user => {
        console.log(`${user.rank}. ${user.userName} - Lost ${user.weightLoss} kg (Coach: ${user.coachName})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testOptimizedAPI();
*/
