/**
 * One-off codemod: replace getISTTimestamp/convertToIST with UTC helpers.
 * Run: node scripts/migrate-ist-timestamps.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'scripts') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.js')) files.push(p);
  }
  return files;
}

function datetimeImportFor(file) {
  const rel = path.relative(path.dirname(file), path.join(backendRoot, 'shared/lib/datetime/index.js'));
  return rel.split(path.sep).join('/');
}

function ensureImport(content, file, symbols) {
  const needed = symbols.filter((s) => content.includes(s));
  if (needed.length === 0) return content;
  if (content.includes('shared/lib/datetime/index.js')) return content;
  const importLine = `import { ${needed.join(', ')} } from '${datetimeImportFor(file)}';\n`;
  const firstImport = content.match(/^import .+;\r?\n/m);
  if (firstImport) {
    return content.replace(firstImport[0], firstImport[0] + importLine);
  }
  return importLine + content;
}

let count = 0;
for (const file of walk(backendRoot)) {
  if (file.includes('migrate-ist-timestamps.js')) continue;
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes('getISTTimestamp') && !s.includes('convertToIST')) continue;
  const orig = s;

  s = s.replace(/getISTTimestamp\(\)/g, 'nowUtc()');
  s = s.replace(/convertToIST\(([^)]+)\)\.istTimestamp/g, 'parseClientTimestampToUtc($1).utcIso');
  s = s.replace(/import \{ getSupabaseClient, getISTTimestamp, convertToIST \} from ([^;]+);/g, 'import { getSupabaseClient } from $1;');
  s = s.replace(/import \{ getSupabaseClient, getISTTimestamp \} from ([^;]+);/g, 'import { getSupabaseClient } from $1;');
  s = s.replace(/import \{ convertToIST, getISTTimestamp \} from ([^;]+);/g, '');
  s = s.replace(/import \{ getISTTimestamp \} from ([^;]+);/g, '');
  s = s.replace(/,\s*getISTTimestamp/g, '');
  s = s.replace(/getISTTimestamp,\s*/g, '');
  s = s.replace(/export \{ getISTTimestamp, convertToIST \};\r?\n?/g, '');
  s = s.replace(/export \{ getISTTimestamp \};\r?\n?/g, '');
  s = s.replace(/const \{ getISTTimestamp, convertToIST \} = repo;\r?\n?/g, '');
  s = s.replace(/const \{ getISTTimestamp \} = repo;\r?\n?/g, '');
  s = s.replace(/from '\.\.\/\.\.\/utils\/supabaseClient\.js';\r?\nimport \{\r?\n  getISTTimestamp,\r?\n  convertToIST,\r?\n\} from '\.\.\/\.\.\/utils\/supabaseClient\.js';/g, "from '../../utils/supabaseClient.js';");

  if (s !== orig) {
    s = ensureImport(s, file, ['nowUtc', 'parseClientTimestampToUtc']);
    fs.writeFileSync(file, s);
    count += 1;
    console.log('updated', path.relative(backendRoot, file));
  }
}
console.log('total updated:', count);
