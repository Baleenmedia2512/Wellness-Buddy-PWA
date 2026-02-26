async function checkLeaderboard() {
  try {
    console.log('Checking leaderboard API...');
    
    const response = await fetch('http://localhost:3000/api/leaderboard/get-global-leaderboard?topN=3');
    const data = await response.json();
    
    console.log('\n=== LEADERBOARD RESPONSE ===');
    console.log('Success:', data.success);
    console.log('Data Count:', data.data?.length || 0);
    console.log('Top N:', data.topN);
    console.log('Total Eligible:', data.totalEligible);
    console.log('Message:', data.message || 'N/A');
    
    if (data.data && data.data.length > 0) {
      console.log('\n=== LEADERBOARD DATA ===');
      data.data.forEach(user => {
        console.log(`${user.rank}. ${user.userName} - ${user.weightLoss} kg (Coach: ${user.coachName})`);
      });
    } else {
      console.log('\n⚠️  NO DATA AVAILABLE');
      console.log('This means no users have both today\'s weight AND yesterday\'s weight recorded.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkLeaderboard();
