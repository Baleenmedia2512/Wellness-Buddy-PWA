/**
 * Offline analysis - Find likely problematic OTP records
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function analyzeOtpRecords() {
  console.log('🔍 Analyzing OTP records for potential issues...\n');

  const jsonPath = path.join(__dirname, '..', '..', 'otpTable.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  console.log(`📂 Total records in JSON: ${jsonData.length}\n`);

  let issues = [];

  // Check for duplicate IDs
  const idCounts = {};
  jsonData.forEach(record => {
    idCounts[record.ID] = (idCounts[record.ID] || 0) + 1;
  });

  const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('⚠️  Duplicate IDs found:');
    duplicates.forEach(([id, count]) => {
      console.log(`  ID ${id}: appears ${count} times`);
      issues.push({ type: 'duplicate', id: parseInt(id), count });
    });
    console.log('');
  }

  // Check for invalid dates
  const invalidDates = jsonData.filter(record => {
    const expires = record.ExpiresAt;
    const created = record.CreatedAt;
    return !expires || !created || expires === '0000-00-00 00:00:00' || created === '0000-00-00 00:00:00';
  });

  if (invalidDates.length > 0) {
    console.log('⚠️  Records with invalid dates:');
    invalidDates.forEach(record => {
      console.log(`  ID ${record.ID}: ExpiresAt=${record.ExpiresAt}, CreatedAt=${record.CreatedAt}`);
      issues.push({ type: 'invalid_date', id: record.ID, record });
    });
    console.log('');
  }

  // Check for missing required fields
  const missingFields = jsonData.filter(record => {
    return !record.Recipient || !record.ContactType || !record.OTPHash;
  });

  if (missingFields.length > 0) {
    console.log('⚠️  Records with missing required fields:');
    missingFields.forEach(record => {
      console.log(`  ID ${record.ID}:`);
      if (!record.Recipient) console.log(`    - Missing Recipient`);
      if (!record.ContactType) console.log(`    - Missing ContactType`);
      if (!record.OTPHash) console.log(`    - Missing OTPHash`);
      issues.push({ type: 'missing_fields', id: record.ID, record });
    });
    console.log('');
  }

  // Check for records with very long or special characters
  const specialChars = jsonData.filter(record => {
    return record.Recipient && (
      record.Recipient.length > 255 ||
      record.Recipient.includes('\0') ||
      record.Recipient.includes('\n')
    );
  });

  if (specialChars.length > 0) {
    console.log('⚠️  Records with special characters or too long:');
    specialChars.forEach(record => {
      console.log(`  ID ${record.ID}: Recipient="${record.Recipient.substring(0, 50)}..."`);
      issues.push({ type: 'special_chars', id: record.ID, record });
    });
    console.log('');
  }

  // Summary
  console.log('📊 Analysis Summary:');
  console.log(`  Total records: ${jsonData.length}`);
  console.log(`  Potential issues found: ${issues.length}`);
  console.log(`  Expected Supabase count: ${jsonData.length - issues.length}\n`);

  if (issues.length === 4) {
    console.log('✅ Found exactly 4 problematic records!');
    console.log('\nIDs of problematic records:', issues.map(i => i.id).join(', '));
    console.log('\nThese are likely the 4 records that failed to migrate.\n');
  } else if (issues.length > 0) {
    console.log(`\n💡 Found ${issues.length} potential issues.`);
    console.log('Some of these may have prevented insertion.\n');
  } else {
    console.log('🤔 No obvious issues found in the data.');
    console.log('The 4 missing records may be due to:');
    console.log('  - Network timeout during insertion');
    console.log('  - Constraint violations');
    console.log('  - Sequence/ID conflicts\n');
  }

  // List all IDs for manual verification
  const allIds = jsonData.map(r => r.ID).sort((a, b) => a - b);
  console.log('\n📋 Expected ID range: 1 to', Math.max(...allIds));
  
  // Check for gaps in sequence
  const gaps = [];
  for (let i = 1; i <= Math.max(...allIds); i++) {
    if (!allIds.includes(i)) {
      gaps.push(i);
    }
  }
  
  if (gaps.length > 0) {
    console.log(`\n⚠️  Found ${gaps.length} gaps in ID sequence: ${gaps.slice(0, 20).join(', ')}${gaps.length > 20 ? '...' : ''}`);
  }
}

analyzeOtpRecords();
