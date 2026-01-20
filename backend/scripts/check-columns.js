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
  const result = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'activity_time_windows_table' 
    ORDER BY ordinal_position
  `);
  console.log('Table columns:');
  console.table(result.rows);
} finally {
  client.release();
  await pool.end();
}
