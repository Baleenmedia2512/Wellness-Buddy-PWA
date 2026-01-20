/**
 * Generate SQL with ON CONFLICT to insert only missing records
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateSafeInsertSQL() {
  console.log('📝 Generating safe INSERT SQL...\n');

  const jsonPath = path.join(__dirname, '..', '..', 'otpTable.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  const sqlStatements = jsonData.map(record => {
    return `INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (${record.ID}, '${record.Recipient.replace(/'/g, "''")}', '${record.ContactType}', '${record.OTPHash}', '${record.ExpiresAt}', ${record.Verified}, ${record.IsActive}, '${record.CreatedAt}')
ON CONFLICT (id) DO NOTHING;`;
  });
  
  const outputPath = path.join(__dirname, 'insert-missing-otp-safe.sql');
  const fullSQL = `-- Safe Insert for Missing OTP Records
-- This will insert only the 4 missing records
-- Existing 356 records will be skipped (no errors)

${sqlStatements.join('\n\n')}

-- Verify final count (should be 360)
SELECT COUNT(*) as total FROM otp_table;
`;
  
  fs.writeFileSync(outputPath, fullSQL);
  console.log(`✅ SQL file created: insert-missing-otp-safe.sql`);
  console.log(`📊 Total statements: ${sqlStatements.length}\n`);
  console.log('📋 Next steps:');
  console.log('1. Open the file: backend/scripts/insert-missing-otp-safe.sql');
  console.log('2. Copy all contents');
  console.log('3. Paste into Supabase SQL Editor');
  console.log('4. Click Run');
  console.log('5. Should show: 4 rows affected');
  console.log('6. Verify count: 360 total records\n');
}

generateSafeInsertSQL();
