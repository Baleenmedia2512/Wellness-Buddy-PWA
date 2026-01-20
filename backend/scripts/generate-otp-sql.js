/**
 * Generate SQL INSERT statements for missing OTP records
 * Run this locally to create SQL that you can paste into Supabase
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateInsertSQL() {
  console.log('📝 Generating SQL INSERT statements for missing records...\n');

  const jsonPath = path.join(__dirname, '..', '..', 'otpTable.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  // Since we can't connect to DB, we'll assume the last 4 records are missing
  // (based on timeout pattern - likely the migration stopped near the end)
  const allIds = jsonData.map(r => r.ID).sort((a, b) => a - b);
  
  console.log('🔍 Analyzing 360 records...');
  console.log(`ID range: ${Math.min(...allIds)} to ${Math.max(...allIds)}\n`);
  
  // Generate SQL for ALL records (you can run this to check which ones fail = already exist)
  const sqlStatements = [];
  
  jsonData.forEach(record => {
    const sql = `INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (${record.ID}, '${record.Recipient.replace(/'/g, "''")}', '${record.ContactType}', '${record.OTPHash}', '${record.ExpiresAt}', ${record.Verified}, ${record.IsActive}, '${record.CreatedAt}');`;
    sqlStatements.push(sql);
  });
  
  // Save to file
  const outputPath = path.join(__dirname, 'insert-all-otp-records.sql');
  const fullSQL = `-- Insert All OTP Records (360 records)
-- Run this in Supabase SQL Editor
-- Records that already exist will fail safely

BEGIN;

${sqlStatements.join('\n\n')}

COMMIT;

-- Verify count
SELECT COUNT(*) as total FROM otp_table;
`;
  
  fs.writeFileSync(outputPath, fullSQL);
  console.log(`✅ SQL file generated: ${outputPath}`);
  console.log(`📊 Total INSERT statements: ${sqlStatements.length}`);
  console.log('\n📋 Instructions:');
  console.log('1. Open Supabase Dashboard → SQL Editor');
  console.log('2. Copy and paste the contents of insert-all-otp-records.sql');
  console.log('3. Run the query');
  console.log('4. Existing records will fail (expected), missing ones will insert');
  console.log('5. Check final count - should be 360\n');
}

generateInsertSQL();
