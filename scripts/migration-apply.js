#!/usr/bin/env node
/**
 * migration-apply.js — apply numbered SQL files in backend/migrations.
 * Forward-only (claude.md §2.7). Tracks applied migrations in `_migrations` table.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const dir = path.resolve('backend/migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS _migrations (name text primary key, applied_at timestamptz default now())`);
  const { rows } = await client.query('SELECT name FROM _migrations');
  const done = new Set(rows.map(r => r.name));
  for (const f of files) {
    if (done.has(f)) { console.log('· skip', f); continue; }
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log('→ apply', f);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _migrations(name) VALUES ($1)', [f]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('FAIL', f, e.message);
      process.exit(1);
    }
  }
  await client.end();
  console.log('Migrations OK.');
})().catch(e => { console.error(e); process.exit(1); });
