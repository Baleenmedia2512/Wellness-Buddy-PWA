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
  const result = await client.query('SELECT COUNT(*) FROM activity_time_windows_table');
  console.log('Records:', result.rows[0].count);
  const data = await client.query('SELECT * FROM activity_time_windows_table LIMIT 10');
  console.table(data.rows);
} finally {
  client.release();
  await pool.end();
}
