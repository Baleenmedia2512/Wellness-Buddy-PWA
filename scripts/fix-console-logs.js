#!/usr/bin/env node
/**
 * fix-console-logs.js
 * Replaces console.log( with logger calls in backend and frontend files.
 *
 * Backend  → import logger from 'backend/shared/lib/logger.js'; logger.debug(...)
 * Frontend → import { debugLog } from 'frontend/src/shared/utils/logger'; debugLog(...)
 *
 * Run: node scripts/fix-console-logs.js
 */

const fs = require('fs');
const path = require('path');

const EXCLUDE = /(__tests__|\.test\.|\.spec\.|node_modules|build|\.next|out|dist|coverage)/;

// Files to SKIP (they define the loggers themselves or are legit)
const SKIP_FILES = new Set([
  path.resolve('backend/shared/lib/logger.js'),
  path.resolve('frontend/src/shared/utils/logger.js'),
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (EXCLUDE.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(path.resolve(p));
  }
}

// ---------------------------------------------------------------------------
// Backend files
// ---------------------------------------------------------------------------
function fixBackendFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes('console.log(')) return false;

  // Compute relative import path from this file to backend/shared/lib/logger.js
  const rel = path.relative(path.dirname(filePath), path.resolve('backend/shared/lib/logger.js'))
    .replace(/\\/g, '/');
  const importPath = rel.startsWith('.') ? rel : './' + rel;

  let out = src;

  // Add import if not present
  if (!out.includes("from '../../shared/lib/logger") && !out.includes('shared/lib/logger')) {
    // Insert after the last existing import block
    const lastImportIdx = findLastImportEnd(out);
    out = out.slice(0, lastImportIdx) +
      `import logger from '${importPath}';\n` +
      out.slice(lastImportIdx);
  }

  // Replace console.log( with logger.debug(
  out = out.replace(/console\.log\(/g, 'logger.debug(');

  if (out === src) return false;
  fs.writeFileSync(filePath, out, 'utf8');
  return true;
}

// ---------------------------------------------------------------------------
// Frontend files
// ---------------------------------------------------------------------------
function fixFrontendFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes('console.log(')) return false;

  // Compute relative import path from this file to frontend/src/shared/utils/logger.js
  const loggerAbsPath = path.resolve('frontend/src/shared/utils/logger.js');
  const rel = path.relative(path.dirname(filePath), loggerAbsPath)
    .replace(/\\/g, '/');
  const importPath = rel.startsWith('.') ? rel : './' + rel;

  let out = src;

  // Add import if not present
  const alreadyImported = out.includes('debugLog') && out.includes('logger');
  if (!out.includes('debugLog')) {
    const lastImportIdx = findLastImportEnd(out);
    out = out.slice(0, lastImportIdx) +
      `import { debugLog } from '${importPath}';\n` +
      out.slice(lastImportIdx);
  }

  // Replace console.log( with debugLog(
  out = out.replace(/console\.log\(/g, 'debugLog(');

  if (out === src) return false;
  fs.writeFileSync(filePath, out, 'utf8');
  return true;
}

// ---------------------------------------------------------------------------
// Find where to insert: after last import/require line
// ---------------------------------------------------------------------------
function findLastImportEnd(src) {
  const lines = src.split('\n');
  let lastImportLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^import\s/.test(l) || /^const\s.*=\s*require\(/.test(l)) {
      lastImportLine = i;
    }
  }
  // compute char offset to end of that line + newline
  let offset = 0;
  for (let i = 0; i <= lastImportLine; i++) {
    offset += lines[i].length + 1; // +1 for \n
  }
  return offset;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
let fixed = 0;

const backendFiles = [];
['backend/features', 'backend/pages'].forEach(s => fs.existsSync(s) && walk(s, backendFiles));
for (const f of backendFiles) {
  if (SKIP_FILES.has(f)) continue;
  if (fixBackendFile(f)) { console.log('Fixed (backend):', path.relative('.', f)); fixed++; }
}

const frontendFiles = [];
fs.existsSync('frontend/src') && walk('frontend/src', frontendFiles);
for (const f of frontendFiles) {
  if (SKIP_FILES.has(f)) continue;
  if (fixFrontendFile(f)) { console.log('Fixed (frontend):', path.relative('.', f)); fixed++; }
}

console.log(`\nDone. ${fixed} files updated.`);
