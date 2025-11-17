const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  // Try multiple password combinations
  const configs = [
    { host: 'localhost', user: 'root', password: '', database: 'baleeed5_wellness' },
    { host: 'localhost', user: 'root', password: 'Easy@2Work@123', database: 'baleeed5_wellness' },
    { host: '103.191.208.228', user: 'baleeed5_wellness', password: 'Wellness@123#', database: 'baleeed5_wellness' }
  ];

  for (const config of configs) {
    try {
      console.log(`\n🔄 Trying connection: ${config.user}@${config.host}...`);
      const conn = await mysql.createConnection(config);

      console.log('✅ Connected to database: baleeed5_wellness');

      // Check if table exists
      const [tables] = await conn.query("SHOW TABLES LIKE '%weight%'");
      console.log('\n📋 Tables with "weight" in name:', tables);

      // If table doesn't exist, create it
      if (tables.length === 0) {
        console.log('\n🔨 Creating weight_records_table...');
        const sql = fs.readFileSync('../sql/create_weight_records_table.sql', 'utf8');
        
        // Split SQL statements and execute them separately
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        for (const statement of statements) {
          if (statement.trim()) {
            await conn.query(statement);
          }
        }
        console.log('✅ Table created successfully!');
      } else {
        console.log('✅ Table already exists!');
      }

      await conn.end();
      return; // Exit if successful
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
    }
  }

  console.error('\n❌ All connection attempts failed!');
  process.exit(1);
})();
