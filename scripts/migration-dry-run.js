#!/usr/bin/env node
/**
 * migration-dry-run.js — claude.md §10.1
 * Applies migrations inside a transaction and rolls back.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const dir = path.resolve('backend/migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('BEGIN');
  try {
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      console.log('→ dry-apply', f);
      await client.query(sql);
    }
    await client.query('ROLLBACK');
    console.log('Dry-run OK (rolled back).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Dry-run FAILED:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})().catch(e => { console.error(e); process.exit(1); });
