/**
 * Migrate otp_table data from otpTable.json to Supabase
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
  query_timeout: 30000,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateOtpTable() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration of otp_table...\n');

    // Read JSON file
    const jsonPath = path.join(__dirname, '..', '..', 'otpTable.json');
    console.log(`📂 Reading file: ${jsonPath}`);
    
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`✅ Found ${jsonData.length} OTP records in JSON file\n`);

    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'otp_table'
      )
    `);

    if (tableExists.rows[0].exists) {
      console.log('📋 Table already exists, checking current records...');
      const currentCount = await client.query('SELECT COUNT(*) FROM otp_table');
      console.log(`Current records: ${currentCount.rows[0].count}\n`);
      
      console.log('📋 Dropping existing table...');
      await client.query('DROP TABLE IF EXISTS otp_table CASCADE');
      console.log('✅ Table dropped\n');
    }

    // Create table
    console.log('📋 Creating otp_table...');
    await client.query(`
      CREATE TABLE otp_table (
        id SERIAL PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        contact_type VARCHAR(50) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ otp_table created\n');

    // Create indexes for performance
    console.log('📋 Creating indexes...');
    await client.query('CREATE INDEX idx_otp_recipient ON otp_table(recipient)');
    await client.query('CREATE INDEX idx_otp_contact_type ON otp_table(contact_type)');
    await client.query('CREATE INDEX idx_otp_expires_at ON otp_table(expires_at)');
    await client.query('CREATE INDEX idx_otp_verified ON otp_table(verified)');
    await client.query('CREATE INDEX idx_otp_is_active ON otp_table(is_active)');
    console.log('✅ Indexes created\n');

    // Insert records in batches
    console.log('💾 Inserting OTP records...');
    let inserted = 0;
    let skipped = 0;

    for (const record of jsonData) {
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
        
        inserted++;
        if (inserted % 50 === 0) {
          const progress = Math.round((inserted / jsonData.length) * 100);
          console.log(`  Progress: ${inserted}/${jsonData.length} (${progress}%)`);
        }
      } catch (err) {
        console.log(`  ⚠️  Skipped record ${record.ID}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`\n✅ Inserted ${inserted} records`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} records\n`);
    }

    // Update sequence to continue from correct ID
    console.log('\n📋 Updating ID sequence...');
    await client.query(`
      SELECT setval('otp_table_id_seq', 
        (SELECT COALESCE(MAX(id), 1) FROM otp_table), true)
    `);
    console.log('✅ Sequence updated\n');

    // Verify migration
    console.log('🔍 Verifying migration...\n');
    
    const count = await client.query('SELECT COUNT(*) FROM otp_table');
    console.log(`Total records in Supabase: ${count.rows[0].count}`);

    // Summary statistics
    const summary = await client.query(`
      SELECT 
        COUNT(*) as total_otps,
        COUNT(DISTINCT recipient) as unique_recipients,
        SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified_otps,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_otps,
        MIN(created_at) as oldest_otp,
        MAX(created_at) as newest_otp
      FROM otp_table
    `);
    
    console.log('\n📊 Summary Statistics:');
    console.table(summary.rows);

    // By contact type
    const byContactType = await client.query(`
      SELECT 
        contact_type,
        COUNT(*) as total_otps,
        SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified
      FROM otp_table
      GROUP BY contact_type
      ORDER BY total_otps DESC
    `);
    
    console.log('\n📊 By Contact Type:');
    console.table(byContactType.rows);

    // Top recipients
    const topRecipients = await client.query(`
      SELECT 
        recipient,
        COUNT(*) as otp_count,
        SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified_count
      FROM otp_table
      GROUP BY recipient
      ORDER BY otp_count DESC
      LIMIT 10
    `);
    
    console.log('\n📊 Top 10 Recipients:');
    console.table(topRecipients.rows);

    // Sample recent records
    const samples = await client.query(`
      SELECT 
        id,
        recipient,
        contact_type,
        verified,
        is_active,
        created_at
      FROM otp_table
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log('\n📋 Most Recent OTPs:');
    console.table(samples.rows);

    console.log('\n✅ Migration completed successfully!');
    console.log(`🎉 Migrated ${inserted} OTP records to Supabase`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateOtpTable().catch(console.error);
