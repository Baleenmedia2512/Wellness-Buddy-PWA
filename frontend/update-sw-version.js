/**
 * Update Service Worker Version
 * Replaces BUILD_TIMESTAMP with actual build time
 * Run this after build to ensure unique cache names
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, 'build', 'service-worker.js');

// Check if file exists
if (!fs.existsSync(SW_PATH)) {
  console.log('⚠️  Service worker not found in build folder. Skipping version update.');
  process.exit(0);
}

// Read service worker file
let swContent = fs.readFileSync(SW_PATH, 'utf8');

// Generate unique version based on current timestamp
const buildTimestamp = Date.now();
const buildDate = new Date().toISOString();

// Replace BUILD_TIMESTAMP with actual timestamp
swContent = swContent.replace(
  'BUILD_TIMESTAMP',
  buildTimestamp.toString()
);

// Write updated content back
fs.writeFileSync(SW_PATH, swContent, 'utf8');

console.log('✅ Service Worker version updated:');
console.log(`   Build Time: ${buildDate}`);
console.log(`   Version: 2.3.${buildTimestamp}`);
console.log('   Cache will be automatically cleared on deployment!');
