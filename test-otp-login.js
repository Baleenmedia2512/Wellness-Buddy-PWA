#!/usr/bin/env node
/**
 * OTP Login API Test Script
 * Tests both email and phone OTP authentication flows
 */

const API_BASE_URL = 'https://wellness-valley-pwa-backend-test.vercel.app';
// const API_BASE_URL = 'http://localhost:3000'; // Uncomment for local testing

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

async function testSendOTP(recipient, contactType = 'email') {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Testing: Send OTP to ${contactType.toUpperCase()}${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    console.log(`\n📤 Sending OTP to: ${recipient}`);
    
    const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, contactType }),
    });

    const data = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`📦 Response:`, JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`${colors.green}✅ OTP sent successfully!${colors.reset}`);
      
      // Show OTP if returned (dev/test mode)
      if (data.otp) {
        console.log(`${colors.yellow}🔑 TEST OTP: ${data.otp}${colors.reset}`);
      } else {
        console.log(`${colors.yellow}📧 Check your ${contactType} for the OTP code${colors.reset}`);
      }
      
      // Show config gaps if any
      if (data.missingConfig && data.missingConfig.length > 0) {
        console.log(`${colors.yellow}⚠️  Missing config: ${data.missingConfig.join(', ')}${colors.reset}`);
      }
      
      return { success: true, data };
    } else {
      console.log(`${colors.red}❌ Failed: ${data.message}${colors.reset}`);
      return { success: false, data };
    }
  } catch (error) {
    console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function testVerifyOTP(recipient, otp, contactType = 'email') {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Testing: Verify OTP${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    console.log(`\n🔐 Verifying OTP: ${otp}`);
    console.log(`📧 For: ${recipient}`);
    
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, otp, contactType }),
    });

    const data = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`📦 Response:`, JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`${colors.green}✅ OTP verified successfully!${colors.reset}`);
      console.log(`\n👤 User Details:`);
      console.log(`   ID: ${data.user.id}`);
      console.log(`   Username: ${data.user.username}`);
      console.log(`   Email: ${data.user.email}`);
      console.log(`   Phone: ${data.user.phone || 'N/A'}`);
      console.log(`   Status: ${data.user.status}`);
      return { success: true, data };
    } else {
      console.log(`${colors.red}❌ Verification failed: ${data.message}${colors.reset}`);
      return { success: false, data };
    }
  } catch (error) {
    console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function interactiveTest() {
  console.log(`${colors.green}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.green}║   OTP Login API Interactive Test      ║${colors.reset}`);
  console.log(`${colors.green}╚════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nAPI Base URL: ${API_BASE_URL}`);

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => new Promise((resolve) => readline.question(query, resolve));

  try {
    // Step 1: Choose login type
    console.log(`\n${colors.yellow}Login Options:${colors.reset}`);
    console.log('1. Email OTP');
    console.log('2. Phone OTP');
    
    const choice = await question('\nSelect option (1 or 2): ');
    
    let recipient, contactType;
    
    if (choice === '1') {
      contactType = 'email';
      recipient = await question('\n📧 Enter your email address: ');
    } else if (choice === '2') {
      contactType = 'phone';
      recipient = await question('\n📱 Enter phone number (with country code, e.g., +919876543210): ');
    } else {
      console.log(`${colors.red}Invalid choice. Exiting.${colors.reset}`);
      readline.close();
      return;
    }

    // Step 2: Send OTP
    const sendResult = await testSendOTP(recipient, contactType);
    
    if (!sendResult.success) {
      console.log(`${colors.red}\n❌ Failed to send OTP. Exiting.${colors.reset}`);
      readline.close();
      return;
    }

    // Step 3: Get OTP from user
    console.log(`\n${colors.yellow}⏳ Waiting for OTP...${colors.reset}`);
    const otpCode = await question('Enter the 6-digit OTP you received: ');

    // Step 4: Verify OTP
    const verifyResult = await testVerifyOTP(recipient, otpCode, contactType);
    
    if (verifyResult.success) {
      console.log(`\n${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.green}✅ LOGIN SUCCESSFUL!${colors.reset}`);
      console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`\n💡 You can now save this user data to localStorage:`);
      console.log(`   localStorage.setItem('user', JSON.stringify(${JSON.stringify(verifyResult.data.user)}));`);
    } else {
      console.log(`\n${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.red}❌ LOGIN FAILED${colors.reset}`);
      console.log(`${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    }

  } catch (error) {
    console.log(`${colors.red}\n❌ Error: ${error.message}${colors.reset}`);
  } finally {
    readline.close();
  }
}

// Run modes
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Interactive mode
    await interactiveTest();
  } else if (args[0] === '--email' && args[1]) {
    // Quick email test
    await testSendOTP(args[1], 'email');
  } else if (args[0] === '--phone' && args[1]) {
    // Quick phone test
    await testSendOTP(args[1], 'phone');
  } else if (args[0] === '--verify' && args[1] && args[2]) {
    // Quick verify test
    const contactType = args[3] || 'email';
    await testVerifyOTP(args[1], args[2], contactType);
  } else {
    console.log('Usage:');
    console.log('  node test-otp-login.js                              # Interactive mode');
    console.log('  node test-otp-login.js --email user@example.com     # Send email OTP');
    console.log('  node test-otp-login.js --phone +919876543210        # Send phone OTP');
    console.log('  node test-otp-login.js --verify user@example.com 123456 [email|phone]');
  }
}

main();
