import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'db.lnvvaeudhtazvxtmifeg.supabase.co',
  user: 'postgres',
  password: 'Wellness@123#@',
  database: 'postgres',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

const client = await pool.connect();
try {
  // Check if table exists
  const tableExists = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'ai_token_usage_table'
    )
  `);
  
  console.log('Table exists:', tableExists.rows[0].exists);
  
  if (tableExists.rows[0].exists) {
    // Get schema
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ai_token_usage_table'
      ORDER BY ordinal_position
    `);
    console.log('\nCurrent schema:');
    console.table(schema.rows);
    
    // Get record count
    const count = await client.query('SELECT COUNT(*) FROM ai_token_usage_table');
    console.log('\nRecord count:', count.rows[0].count);
    
    // Get sample records
    const sample = await client.query('SELECT * FROM ai_token_usage_table LIMIT 5');
    if (sample.rows.length > 0) {
      console.log('\nSample records:');
      console.table(sample.rows);
    }
  } else {
    console.log('\nTable does not exist. Will need to create it.');
  }
} finally {
  client.release();
  await pool.end();
}
