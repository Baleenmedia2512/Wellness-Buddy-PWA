/**
 * Test Script for Attendance Report API
 * Run with: node test-attendance-api.js
 */

const https = require('https');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://your-backend-domain.com';
const TEST_USER_ID = process.env.TEST_USER_ID || '1'; // Replace with your test user ID

// Get today's date in YYYY-MM-DD format
const today = new Date();
const dateStr = today.toISOString().split('T')[0];

console.log('🧪 Testing Attendance Report API...\n');
console.log('API URL:', API_BASE_URL);
console.log('User ID:', TEST_USER_ID);
console.log('Date:', dateStr);
console.log('=' .repeat(60));

// Make request
const url = `${API_BASE_URL}/api/coach/attendance-report?userId=${TEST_USER_ID}&startDate=${dateStr}&endDate=${dateStr}`;

fetch(url, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  }
})
.then(res => res.json())
.then(data => {
  console.log('\n✅ Response received:\n');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.success) {
    console.log('\n📊 Summary:');
    console.log(`- Team Size: ${data.data.teamSize}`);
    console.log(`- Members with data: ${data.data.members?.length || 0}`);
    
    if (data.data.members && data.data.members.length > 0) {
      console.log('\n👥 Sample Member Data:');
      const sample = data.data.members[0];
      console.log(`  Name: ${sample.userName}`);
      console.log(`  Discipline: ${sample.disciplinePercentage}%`);
      console.log(`  Attendance: ${sample.attendancePercentage}%`);
      console.log(`  Direct Team: ${sample.directTeamCount}`);
      console.log(`  Full Team: ${sample.fullTeamCount}`);
      console.log(`  Club Logs: ${sample.clubAttendance}`);
      console.log(`  Remote Logs: ${sample.remoteAttendance}`);
    }
  } else {
    console.error('\n❌ API returned error:', data.message);
  }
})
.catch(error => {
  console.error('\n❌ Request failed:', error.message);
});
