#!/usr/bin/env node
/**
 * Confirms the MySQL Prisma connection (MYSQL_DATABASE_URL) and rolls nothing forward.
 * backend/migrations/*.sql is PostgreSQL and is not executed.
 * Schema changes belong in backend/prisma/schema.prisma.
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRoot = path.resolve(__dirname, '../backend');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(backendRoot, '.env.local'));
loadEnvFile(path.join(backendRoot, '.env'));

async function main() {
  const url = process.env.MYSQL_DATABASE_URL;
  if (!url) throw new Error('MYSQL_DATABASE_URL is required');

  const requireBackend = createRequire(path.join(backendRoot, 'package.json'));
  const { PrismaClient } = requireBackend('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRawUnsafe('SELECT 1 AS ok');
    const dir = path.join(backendRoot, 'migrations');
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
    console.log(`MySQL Prisma dry-run ok. Skipped ${files.length} PostgreSQL files in backend/migrations/.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
