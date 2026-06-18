/**
 * Test script to verify inactive user detection flow
 * 
 * Run: node test-inactive-user-flow.js
 */

const email = "leenah.grace@gmail.com"; // Replace with the inactive user's email
const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3000"; // Or your backend URL

// For testing, try multiple possible API URLs
const possibleUrls = [
  "http://localhost:3000",
  "http://localhost:3001", 
  "https://wellness-buddy-pwa.vercel.app",
  // Add your production URL here
];

async function testInactiveUserFlow() {
  console.log("🧪 Testing Inactive User Flow");
  console.log("==============================\n");

  let workingUrl = null;
  
  // Try to find a working API URL
  console.log("🔍 Finding working API endpoint...");
  for (const url of possibleUrls) {
    try {
      console.log(`   Trying: ${url}`);
      const testResponse = await fetch(`${url}/api/health`, { 
        method: "GET",
        signal: AbortSignal.timeout(3000) 
      }).catch(() => null);
      
      if (testResponse && testResponse.ok) {
        workingUrl = url;
        console.log(`   ✅ Found working API: ${url}\n`);
        break;
      }
    } catch (err) {
      // Try next URL
    }
  }

  if (!workingUrl) {
    console.error("❌ Could not find a working API endpoint!");
    console.error("   Make sure your backend is running.");
    console.error("\n💡 To start the backend:");
    console.error("   cd backend && npm run dev");
    console.error("\n   Or update the `possibleUrls` array with your API URL.");
    return;
  }

  // Step 1: Check user status via /api/user/lookup
  console.log("📡 Step 1: Checking user status via /api/user/lookup");
  console.log(`   Email: ${email}`);
  console.log(`   API: ${workingUrl}`);
  
  try {
    const lookupResponse = await fetch(`${workingUrl}/api/user/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!lookupResponse.ok) {
      console.error(`❌ Lookup API returned ${lookupResponse.status}`);
      return;
    }

    const lookupData = await lookupResponse.json();
    console.log("\n📊 Lookup Response:");
    console.log(JSON.stringify(lookupData, null, 2));
    
    console.log("\n🔍 Analysis:");
    console.log(`   - success: ${lookupData.success}`);
    console.log(`   - status: ${lookupData.status}`);
    console.log(`   - isActive: ${lookupData.isActive}`);
    console.log(`   - userNotFound: ${lookupData.userNotFound}`);
    
    if (lookupData.isActive === false) {
      console.log("\n✅ User is correctly detected as INACTIVE");
      console.log("   → Modal SHOULD appear after OTP verification");
    } else if (lookupData.isActive === true) {
      console.log("\n⚠️  User is detected as ACTIVE");
      console.log("   → Modal will NOT appear");
    } else {
      console.log("\n❓ isActive field is undefined or null");
      console.log("   → This might cause the modal to not appear");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  console.log("\n==============================");
  console.log("📝 Next Steps:");
  console.log("1. If user is ACTIVE but should be INACTIVE:");
  console.log("   → Update Status in team_table: UPDATE team_table SET \"Status\" = 'Inactive' WHERE \"Email\" = 'leenah.grace@gmail.com';");
  console.log("\n2. If isActive is undefined:");
  console.log("   → Check backend /api/user/lookup endpoint");
  console.log("\n3. To test the full OTP flow:");
  console.log("   → Use the frontend login with this email");
  console.log("   → Check browser console for debug logs starting with 🔍 [handleOtpVerified]");
}

testInactiveUserFlow();
