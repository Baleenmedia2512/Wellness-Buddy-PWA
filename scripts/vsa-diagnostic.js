#!/usr/bin/env node
/**
 * VSA Diagnostic Analyzer (one-shot)
 * - Walks backend/features/<feature>/ and frontend/src/features/<feature>/
 * - Counts non-blank, non-comment-only "code" lines per file
 * - Detects cross-feature imports and shared/* usage
 * - Emits ./reports/vsa-diagnostic.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND_FEATURES = path.join(ROOT, 'backend', 'features');
const FRONTEND_FEATURES = path.join(ROOT, 'frontend', 'src', 'features');
const FRONTEND_SHARED = path.join(ROOT, 'frontend', 'src', 'shared');
const BACKEND_UTILS = path.join(ROOT, 'backend', 'utils');
const BACKEND_SHARED = path.join(ROOT, 'backend', 'shared');

const SOURCE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const SKIP_DIR = new Set(['node_modules', '.next', 'build', 'dist', '__tests__', '__mocks__', 'coverage']);

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIR.has(e.name)) continue;
        stack.push(full);
      } else if (e.isFile() && SOURCE_EXT.has(path.extname(e.name))) {
        out.push(full);
      }
    }
  }
  return out;
}

function countCodeLines(text) {
  let stripped = text.replace(/\/\*[\s\S]*?\*\//g, '');
  let total = 0, code = 0;
  for (const raw of stripped.split(/\r?\n/)) {
    total++;
    const t = raw.trim();
    if (!t) continue;
    if (t.startsWith('//')) continue;
    code++;
  }
  return { total, code };
}

const IMPORT_RE = /(?:import\s[^'"`;]*?from\s*|import\s*|require\s*\(\s*)['"`]([^'"`]+)['"`]/g;

function extractImports(text) {
  const out = [];
  let m;
  while ((m = IMPORT_RE.exec(text)) !== null) out.push(m[1]);
  return out;
}

function resolveSpec(spec, fromFile) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null;
  return path.resolve(path.dirname(fromFile), spec);
}

function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }

function classifyTarget(absPath) {
  const r = rel(absPath);
  if (r.startsWith('backend/features/')) {
    const parts = r.split('/');
    return { kind: 'backend-feature', feature: parts[2], rel: r };
  }
  if (r.startsWith('frontend/src/features/')) {
    const parts = r.split('/');
    return { kind: 'frontend-feature', feature: parts[3], rel: r };
  }
  if (r.startsWith('backend/utils/') || r.startsWith('backend/shared/')) return { kind: 'backend-shared', rel: r };
  if (r.startsWith('frontend/src/shared/')) return { kind: 'frontend-shared', rel: r };
  return { kind: 'other', rel: r };
}

function tryResolveFile(abs) {
  if (fs.existsSync(abs)) {
    const st = fs.statSync(abs);
    if (st.isFile()) return abs;
    if (st.isDirectory()) {
      for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
        const idx = path.join(abs, 'index' + ext);
        if (fs.existsSync(idx)) return idx;
      }
    }
  }
  for (const ext of ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']) {
    if (fs.existsSync(abs + ext)) return abs + ext;
  }
  return null;
}

function analyzeArea(label, featuresRoot, lineLimit) {
  const result = { label, featuresRoot: rel(featuresRoot), lineLimit, features: {} };
  if (!fs.existsSync(featuresRoot)) return result;
  const featureDirs = fs.readdirSync(featuresRoot, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name).sort();
  for (const feat of featureDirs) {
    const dir = path.join(featuresRoot, feat);
    const files = walk(dir);
    const fileEntries = [];
    const crossFeature = [];
    const sharedUsage = new Set();
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      const { total, code } = countCodeLines(text);
      const violation = code > lineLimit;
      const status = violation ? (code > lineLimit * 2 ? 'CRITICAL' : 'VIOLATION') : 'OK';
      fileEntries.push({ rel: rel(f), totalLines: total, codeLines: code, status });
      const imports = extractImports(text);
      for (const spec of imports) {
        const absSpec = resolveSpec(spec, f);
        if (!absSpec) continue;
        const resolved = tryResolveFile(absSpec) || absSpec;
        const cls = classifyTarget(resolved);
        if (cls.kind === 'backend-feature' || cls.kind === 'frontend-feature') {
          if (cls.feature && cls.feature !== feat) {
            crossFeature.push({ from: rel(f), to: cls.rel, otherFeature: cls.feature });
          }
        } else if (cls.kind === 'backend-shared' || cls.kind === 'frontend-shared') {
          sharedUsage.add(cls.rel);
        }
      }
    }
    fileEntries.sort((a, b) => b.codeLines - a.codeLines);
    result.features[feat] = {
      fileCount: fileEntries.length,
      totalCodeLines: fileEntries.reduce((s, f) => s + f.codeLines, 0),
      files: fileEntries,
      violationCount: fileEntries.filter(f => f.status !== 'OK').length,
      crossFeatureImports: crossFeature,
      sharedUsage: [...sharedUsage].sort(),
    };
  }
  return result;
}

const backend = analyzeArea('backend', BACKEND_FEATURES, 150);
const frontend = analyzeArea('frontend', FRONTEND_FEATURES, 150);

const report = {
  generatedAt: new Date().toISOString(),
  backend,
  frontend,
};

fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'vsa-diagnostic.json'), JSON.stringify(report, null, 2));
console.log('Wrote reports/vsa-diagnostic.json');
