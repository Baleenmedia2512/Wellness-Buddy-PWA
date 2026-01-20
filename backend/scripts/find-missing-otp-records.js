/**
 * Find missing OTP records between JSON and Supabase
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  host: 'db.lnvvaeudhtazvxtmifeg.supabase.co',
  user: 'postgres',
  password: 'Wellness@123#@',
  database: 'postgres',
  port: 5432,
  connectionTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false
  }
});

async function findMissingRecords() {
  const client = await pool.connect();

  try {
    console.log('🔍 Finding missing OTP records...\n');

    // Read JSON file
    const jsonPath = path.join(__dirname, '..', '..', 'otpTable.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`📂 JSON file has: ${jsonData.length} records`);

    // Get all IDs from Supabase
    const supabaseIds = await client.query(
      'SELECT id FROM otp_table ORDER BY id'
    );
    console.log(`📊 Supabase has: ${supabaseIds.rows.length} records\n`);

    // Create sets for comparison
    const jsonIds = new Set(jsonData.map(r => r.ID));
    const dbIds = new Set(supabaseIds.rows.map(r => r.id));

    // Find missing IDs
    const missingIds = [];
    for (const id of jsonIds) {
      if (!dbIds.has(id)) {
        missingIds.push(id);
      }
    }

    if (missingIds.length === 0) {
      console.log('✅ All records are present!');
    } else {
      console.log(`❌ Missing ${missingIds.length} records with IDs: ${missingIds.join(', ')}\n`);

      // Get details of missing records
      console.log('📋 Details of missing records:\n');
      for (const id of missingIds) {
        const record = jsonData.find(r => r.ID === id);
        console.log(`ID ${id}:`);
        console.log(`  Recipient: ${record.Recipient}`);
        console.log(`  ContactType: ${record.ContactType}`);
        console.log(`  ExpiresAt: ${record.ExpiresAt}`);
        console.log(`  Verified: ${record.Verified}`);
        console.log(`  CreatedAt: ${record.CreatedAt}`);
        console.log('');
      }

      // Try to insert missing records
      console.log('💾 Attempting to insert missing records...\n');
      for (const id of missingIds) {
        const record = jsonData.find(r => r.ID === id);
        try {
          await client.query(`
            INSERT INTO otp_table 
            (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            record.ID,
            record.Recipient,
            record.ContactType,
            record.OTPHash,
            record.ExpiresAt,
            record.Verified,
            record.IsActive,
            record.CreatedAt
          ]);
          console.log(`✅ Inserted record ID ${id}`);
        } catch (err) {
          console.log(`❌ Failed to insert ID ${id}: ${err.message}`);
        }
      }

      // Verify final count
      const finalCount = await client.query('SELECT COUNT(*) FROM otp_table');
      console.log(`\n📊 Final count in Supabase: ${finalCount.rows[0].count}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

findMissingRecords().catch(console.error);
