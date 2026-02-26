async function checkServerTime() {
  console.log('🕐 Checking server date/time calculations...\n');
  
  // Local time
  const now = new Date();
  console.log('Local System Time:');
  console.log('  Full: ', now.toString());
  console.log('  ISO: ', now.toISOString());
  console.log('  Date:', now.toISOString().split('T')[0]);
  
  // Calculate today
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  console.log('\nToday Calculation:');
  console.log('  Start:', todayStart.toISOString());
  console.log('  Date:', todayStart.toISOString().split('T')[0]);
  
  // Calculate yesterday
  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  console.log('\nYesterday Calculation:');
  console.log('  Start:', yesterdayStart.toISOString());
  console.log('  Date:', yesterdayStart.toISOString().split('T')[0]);
  
  // Check what the API returns
  console.log('\n' + '='.repeat(70));
  console.log('What the API returns:');
  console.log('='.repeat(70));
  
  try {
    const response = await fetch('http://localhost:3000/api/leaderboard/check-data');
    const data = await response.json();
    console.log('  Today:', data.dates.today);
    console.log('  Yesterday:', data.dates.yesterday);
    
    if (data.dates.today !== todayStart.toISOString().split('T')[0]) {
      console.log('\n⚠️  WARNING: API date mismatch!');
      console.log('  Expected today:', todayStart.toISOString().split('T')[0]);
      console.log('  API says today:', data.dates.today);
    }
  } catch (error) {
    console.error('Error fetching from API:', error.message);
  }
}

checkServerTime();
