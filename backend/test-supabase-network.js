/**
 * Test Supabase using REST API (doesn't require direct DB connection)
 * This will help determine if the issue is network/firewall or database credentials
 */

const https = require('https');

// Extract from your connection string: db.lnvvaeudhtazvxtmifeg.supabase.co
// Project reference: lnvvaeudhtazvxtmifeg
const SUPABASE_URL = 'https://lnvvaeudhtazvxtmifeg.supabase.co';

// You need to get this from Supabase Dashboard → Settings → API
// For now, we'll test if the endpoint is reachable
const SUPABASE_ANON_KEY = 'GET_THIS_FROM_SUPABASE_DASHBOARD';

console.log('🔍 Testing Supabase REST API availability...\n');
console.log('Project URL:', SUPABASE_URL);
console.log('Testing if Supabase project is accessible via HTTPS...\n');

// Test 1: Check if project endpoint is reachable
https.get(SUPABASE_URL + '/rest/v1/', (res) => {
  console.log('✅ SUPABASE PROJECT IS REACHABLE via HTTPS');
  console.log('Status Code:', res.statusCode);
  console.log('Status Message:', res.statusMessage);
  
  if (res.statusCode === 401 || res.statusCode === 400) {
    console.log('\n✅ This is GOOD! The API is responding (authentication error is expected without API key)');
    console.log('✅ This means your Supabase project is ACTIVE and NOT PAUSED');
    console.log('\n⚠️  The database connection timeout is likely due to:');
    console.log('   1. IP restrictions enabled in Supabase Database settings');
    console.log('   2. Firewall blocking PostgreSQL ports 5432/6543');
    console.log('   3. ISP blocking database connections');
    console.log('\n💡 Next steps:');
    console.log('   1. Go to Supabase Dashboard → Settings → Database');
    console.log('   2. Under "Connection Pooling" - disable IP restrictions');
    console.log('   3. Or add your IP to the allowlist');
    console.log('\n🌐 To find your IP: https://whatismyipaddress.com/');
  } else if (res.statusCode === 200) {
    console.log('✅ Project is active and accessible');
  }
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse body (first 200 chars):', data.substring(0, 200));
  });
  
}).on('error', (err) => {
  console.log('❌ SUPABASE PROJECT IS NOT REACHABLE');
  console.log('Error:', err.message);
  console.log('\n⚠️  Possible issues:');
  console.log('   1. Database/Project is PAUSED (free tier)');
  console.log('   2. Project URL is incorrect');
  console.log('   3. Complete network blockage');
  console.log('\n💡 Go to https://supabase.com/dashboard and check if project is paused');
});

// Test 2: Check if direct database host is reachable via ping/tcp
const net = require('net');

console.log('\n' + '='.repeat(60));
console.log('🔌 Testing TCP connection to database host...');
console.log('Host: db.lnvvaeudhtazvxtmifeg.supabase.co');
console.log('='.repeat(60) + '\n');

function testPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000;
    
    socket.setTimeout(timeout);
    console.log(`⏳ Testing port ${port}...`);
    
    socket.on('connect', () => {
      console.log(`✅ Port ${port} is OPEN and accepting connections`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log(`❌ Port ${port} timed out after ${timeout}ms`);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (err) => {
      console.log(`❌ Port ${port} connection error: ${err.message}`);
      resolve(false);
    });
    
    socket.connect(port, 'db.lnvvaeudhtazvxtmifeg.supabase.co');
  });
}

async function testPorts() {
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for HTTP test
  
  const port5432Open = await testPort(5432);
  const port6543Open = await testPort(6543);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TCP CONNECTIVITY SUMMARY');
  console.log('='.repeat(60));
  console.log(`Port 5432: ${port5432Open ? '✅ OPEN' : '❌ BLOCKED/CLOSED'}`);
  console.log(`Port 6543: ${port6543Open ? '✅ OPEN' : '❌ BLOCKED/CLOSED'}`);
  
  if (!port5432Open && !port6543Open) {
    console.log('\n❌ BOTH PORTS ARE BLOCKED');
    console.log('\n⚠️  This indicates:');
    console.log('   1. Firewall blocking PostgreSQL ports');
    console.log('   2. ISP blocking database connections');
    console.log('   3. Database IP restrictions enabled');
    console.log('   4. Network policy preventing outbound DB connections');
    console.log('\n💡 Solutions:');
    console.log('   1. Try using a VPN');
    console.log('   2. Try from mobile hotspot');
    console.log('   3. Contact network admin if on corporate network');
    console.log('   4. Check Supabase IP restrictions settings');
  } else {
    console.log('\n✅ At least one port is accessible!');
    console.log('   The issue might be with authentication or database configuration');
  }
  
  console.log('\n' + '='.repeat(60));
}

testPorts();
