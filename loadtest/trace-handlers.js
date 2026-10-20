/**
 * Follows a route into the helpers it calls.
 * A confident trace names required query fields and any write,
 * redirect, paid call, or unbounded table read in those helpers.
 * GET by itself is never approval.
 */
const fs = require('fs');
const path = require('path');

const EXTERNAL_RE = /sendMdtSms|sendTransactionalMail|createTransport\s*\(|getGenAI|GoogleGenerativeAI|GEMINI_API_KEY/;
const WRITE_RE = /\.(insert|upsert)\s*\(|\.update\s*\(|\.delete\(\s*\)/;
const REDIRECT_RE = /res\.redirect\s*\(|httpStatus:\s*302|\.status\(\s*302\s*\)|sendImageRedirect\s*\(/;
const SKIP_FILE = /(?:^|\/)(?:handler|logger|feature-flags|ValidationError|client-app-version|clientMeta|readJsonBody)\.js$|datetime\/index\.js$|enforce-api\.handler\.js$/;

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  let target = path.resolve(path.dirname(fromFile), spec);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.js');
  }
  if (!target.endsWith('.js')) target += '.js';
  return fs.existsSync(target) ? target : null;
}

function parseImports(text) {
  const named = {};
  const namespaces = {};
  let match;
  const namedRe = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
  while ((match = namedRe.exec(text))) {
    const spec = match[2];
    match[1].split(',').forEach(function (part) {
      const bits = part.trim().split(/\s+as\s+/);
      const imported = (bits[0] || '').trim();
      const local = (bits[1] || bits[0] || '').trim();
      if (local && imported) named[local] = { spec: spec, imported: imported };
    });
  }
  const nsRe = /import\s+\*\s+as\s+([\w$]+)\s+from\s+['"](\.[^'"]+)['"]/g;
  while ((match = nsRe.exec(text))) {
    namespaces[match[1]] = match[2];
  }
  return { named: named, namespaces: namespaces };
}

function extractFunction(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = source.search(new RegExp('(?:export\\s+)?(?:async\\s+)?function\\s+' + escaped + '\\s*\\('));
  if (start < 0) return null;
  const paren = source.indexOf('(', start);
  if (paren < 0) return null;
  let depth = 0;
  let cursor = paren;
  for (; cursor < source.length; cursor += 1) {
    if (source[cursor] === '(') depth += 1;
    else if (source[cursor] === ')') {
      depth -= 1;
      if (depth === 0) {
        cursor += 1;
        break;
      }
    }
  }
  const brace = source.indexOf('{', cursor);
  if (brace < 0) return null;
  depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function reexportTarget(text, name) {
  const re = /export\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = re.exec(text))) {
    const spec = match[2];
    const parts = match[1].split(',');
    for (let i = 0; i < parts.length; i += 1) {
      const bits = parts[i].trim().split(/\s+as\s+/);
      const original = (bits[0] || '').trim();
      const exported = (bits[1] || bits[0] || '').trim();
      if (exported === name && original) return { spec: spec, imported: original };
    }
  }
  return null;
}

function normalizeParam(name) {
  if (name === 'UserId') return 'userId';
  if (name === 'CoachId') return 'coachId';
  if (name === 'Email') return 'email';
  if (name === 'Phone') return 'phone';
  return name;
}

function addParam(set, raw) {
  const name = normalizeParam(String(raw || '').trim());
  if (!/^[A-Za-z_][\w]*$/.test(name)) return;
  if (/^(body|req|res|error|message|success|data|Missing|Invalid|Request|is|must|parameter)$/.test(name)) return;
  if (name === 'Query') return;
  set.add(name);
}

const QUERY_KEYS = new Set([
  'userId', 'viewerUserId', 'ownerUserId', 'coachId', 'email', 'phone', 'phoneNumber',
  'date', 'activityType', 'dateRange', 'token', 'captureId', 'id', 'ids', 'name',
  'query', 'teamId', 'requesterUserId', 'requesterEmail', 'prefix', 'version', 'jobId',
]);

function requiredNames(functionText) {
  const names = new Set();
  if (!functionText) return [];
  const patterns = [
    /['"]Missing required (?:field|parameter)s?:\s*([^'"]+)['"]/g,
    /['"]([A-Za-z_][\w]*) is required['"]/g,
    /['"]([A-Za-z_][\w]*) must be (?:a |an )?(?:positive integer|valid)/g,
    /throw new ValidationError\([^)]*['"]([^'"]+)['"]/g,
  ];
  patterns.forEach(function (pattern) {
    let match;
    while ((match = pattern.exec(functionText))) {
      const phrase = String(match[1]).replace(/\bis\s*$/i, '').trim();
      if (!/required|must be/i.test(phrase) && !/required|must be/i.test(match[0])) {
        if (!QUERY_KEYS.has(normalizeParam(phrase))) continue;
      }
      phrase.split(/,|\bor\b/i).forEach(function (part) {
        const trimmed = part.replace(/\b(is|are|must|be|a|an|positive|integer|valid|number|required)\b/ig, ' ').trim();
        if (/coach\s+id/i.test(part)) {
          addParam(names, 'coachId');
          return;
        }
        const token = (trimmed.split(/\s+/)[0] || '').trim();
        addParam(names, token);
      });
    }
  });
  if (/\{[^}]*\bteamId\b[^}]*\}\s*=\s*req\.query/.test(functionText) && /if\s*\(\s*!teamId\b/.test(functionText)) {
    addParam(names, 'teamId');
  }
  if (/Coach ID or email required/.test(functionText)) {
    addParam(names, 'coachId');
    addParam(names, 'email');
  }
  return Array.from(names).filter(function (name) { return QUERY_KEYS.has(name); });
}

function joiRequiredNames(moduleText, body) {
  const names = new Set();
  const ref = /([A-Za-z_][\w]*)\.validate\s*\(/.exec(body || '');
  if (!ref || !moduleText) return [];
  const start = moduleText.indexOf('const ' + ref[1] + ' =');
  if (start < 0) return [];
  const brace = moduleText.indexOf('{', start);
  if (brace < 0) return [];
  let depth = 0;
  let end = brace;
  for (; end < moduleText.length; end += 1) {
    if (moduleText[end] === '{') depth += 1;
    else if (moduleText[end] === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  const objectText = moduleText.slice(brace, end);
  const pattern = /([A-Za-z_][\w]*)\s*:\s*Joi[\s\S]{0,240}?\.required\(\)/g;
  let match;
  while ((match = pattern.exec(objectText))) addParam(names, match[1]);
  return Array.from(names);
}

function hasDbWrite(text) {
  return WRITE_RE.test(text || '');
}

function isUnboundedRead(text) {
  if (!text) return false;
  if (/fetchAllSupabaseRows\s*\(/.test(text)) return true;
  if (/\.from\s*\(/.test(text) && !/\.limit\s*\(/.test(text)) return true;
  return false;
}

function calledSymbols(text, imports) {
  const symbols = [];
  Object.keys(imports.named).forEach(function (local) {
    const escaped = local.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('(?:\\b|\\.)' + escaped + '\\s*\\(').test(text)) {
      symbols.push({ spec: imports.named[local].spec, imported: imports.named[local].imported });
    }
  });
  Object.keys(imports.namespaces).forEach(function (alias) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + escaped + '\\.([A-Za-z_][\\w]*)\\s*\\(', 'g');
    let match;
    while ((match = re.exec(text))) {
      symbols.push({ spec: imports.namespaces[alias], imported: match[1] });
    }
  });
  return symbols;
}

function resolveSymbol(fromFile, spec, name, depth, seen, files) {
  if (depth > 3) return null;
  const file = resolveImport(fromFile, spec);
  if (!file) return null;
  const key = file + '#' + name;
  if (seen.has(key)) return null;
  seen.add(key);
  if (SKIP_FILE.test(file.replace(/\\/g, '/'))) return null;
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return null;
  }
  files.push(file);
  const body = extractFunction(text, name);
  if (body) return { file: file, name: name, body: body, text: text };
  const next = reexportTarget(text, name);
  if (!next) return null;
  return resolveSymbol(file, next.spec, next.imported, depth + 1, seen, files);
}

function traceRouteFile(routeFile) {
  let routeText = '';
  try {
    routeText = fs.readFileSync(routeFile, 'utf8');
  } catch (err) {
    return {
      confident: false,
      getOnly: false,
      requiredQuery: [],
      writes: false,
      external: false,
      redirects: false,
      unbounded: false,
      files: [],
      usesQuery: false,
    };
  }
  const files = [routeFile];
  const required = new Set(requiredNames(routeText));
  let writes = hasDbWrite(routeText);
  let external = EXTERNAL_RE.test(routeText);
  let redirects = REDIRECT_RE.test(routeText);
  let unbounded = isUnboundedRead(routeText);
  let sawHelper = false;
  const seen = new Set();

  function walk(fromFile, moduleText, scanText, depth) {
    if (depth > 3) return;
    const imports = parseImports(moduleText);
    calledSymbols(scanText, imports).forEach(function (symbol) {
      const resolved = resolveSymbol(fromFile, symbol.spec, symbol.imported, 0, seen, files);
      if (!resolved) return;
      sawHelper = true;
      requiredNames(resolved.body).forEach(function (name) { required.add(name); });
      joiRequiredNames(resolved.text, resolved.body).forEach(function (name) { required.add(name); });
      if (hasDbWrite(resolved.body)) writes = true;
      if (EXTERNAL_RE.test(resolved.body)) external = true;
      if (REDIRECT_RE.test(resolved.body)) redirects = true;
      if (isUnboundedRead(resolved.body)) unbounded = true;
      walk(resolved.file, resolved.text, resolved.body, depth + 1);
    });
  }

  walk(routeFile, routeText, routeText, 0);
  const usesQuery = /req\.query/.test(routeText);
  const getOnly = /req\.method\s*!==\s*['"]GET['"]/.test(routeText)
    && !/req\.method\s*===\s*['"]POST['"]/.test(routeText)
    && !/['"]PUT['"]/.test(routeText)
    && !/['"]DELETE['"]/.test(routeText);
  const confident = sawHelper || required.size > 0 || (!usesQuery && getOnly);
  return {
    confident: confident,
    getOnly: getOnly,
    requiredQuery: Array.from(required).sort(),
    writes: writes,
    external: external,
    redirects: redirects,
    unbounded: unbounded,
    files: Array.from(new Set(files)),
    usesQuery: usesQuery,
  };
}

module.exports = {
  traceRouteFile: traceRouteFile,
  requiredNames: requiredNames,
  extractFunction: extractFunction,
  hasDbWrite: hasDbWrite,
  isUnboundedRead: isUnboundedRead,
  decideLoadTest: decideLoadTest,
  QUERY_KEYS: QUERY_KEYS,
};

const SAFE_REVIEW = {
  '/api/dry-salad/search': {
    requiredQuery: [],
    staticQuery: {},
    note: 'GET searchDrySalad reads the approved dry-salad catalog with a limit of 50 when query is omitted, or 20 when a term is present. validateSearch does not require an account id. No insert, update, SMS, email, or Gemini call is in that path.',
  },
  '/api/nutrition-knowledge/search': {
    requiredQuery: ['query'],
    staticQuery: { query: 'rice' },
    note: 'GET searchMaster requires a search term and reads approved master profiles with a limit, plus in-code seeds. userId is optional and unused by the read. The literal query=rice is a food name, not an account id. No Gemini call is in searchMaster.',
  },
  '/api/nutrition-knowledge/resolve': {
    requiredQuery: ['name'],
    staticQuery: { name: 'rice' },
    note: 'GET resolveProfile requires a food name and reads one approved profile, with a bounded alias fallback. The literal name=rice is a food name, not an account id. No Gemini call is in resolveProfile.',
  },
};

function sameParams(left, right) {
  return JSON.stringify(left.slice().sort()) === JSON.stringify(right.slice().sort());
}

function stagingQuery(params) {
  const set = new Set(params);
  if (set.has('userId')) {
    set.delete('email');
    set.delete('phone');
    set.delete('phoneNumber');
  } else if (set.has('coachId')) {
    set.delete('email');
  }
  return Array.from(set).sort();
}

function decideLoadTest(route, trace) {
  const files = trace.files || [];
  const params = trace.requiredQuery || [];
  const base = {
    files: files,
    requiredQuery: params,
    writes: trace.writes === true,
    external: trace.external === true,
    redirects: trace.redirects === true || route.mayRedirect === true,
    unbounded: trace.unbounded === true,
  };
  if (route.inventoryClass === 4 || route.inventoryClass === 2 || route.inventoryClass === 3) {
    return Object.assign(base, {
      decision: 'manual-review',
      reason: 'Security-sensitive, write, or paid route. The handler was traced and stays blocked.',
    });
  }
  if (trace.writes || trace.external) {
    return Object.assign(base, {
      decision: 'manual-review',
      reason: 'A followed helper contains a database write or an SMS, email, or Gemini call. The route stays blocked.',
    });
  }
  if (base.redirects) {
    return Object.assign(base, {
      decision: 'manual-review',
      reason: 'The traced path can redirect, including image redirects. The route stays blocked.',
    });
  }
  if (params.indexOf('token') !== -1 || params.indexOf('phone') !== -1 || params.indexOf('phoneNumber') !== -1) {
    return Object.assign(base, {
      decision: 'manual-review',
      reason: 'The route requires a share token or phone number. Those values are not invented, and the route stays blocked.',
    });
  }
  const reviewed = SAFE_REVIEW[route.route];
  if (reviewed && !trace.unbounded && !trace.writes && !trace.external && trace.getOnly && sameParams(params, reviewed.requiredQuery)) {
    return Object.assign(base, {
      decision: 'safe',
      requiredQuery: reviewed.requiredQuery,
      staticQuery: reviewed.staticQuery,
      reason: reviewed.note,
    });
  }
  if (params.length > 0) {
    const needed = stagingQuery(params);
    return Object.assign(base, {
      decision: 'needs-test-data',
      requiredQuery: needed,
      reason: 'Traced read. Required query: ' + needed.join(', ')
        + (trace.unbounded ? '. The helper can read without a row limit, so this stays unapproved until a staging account and a separate bounded-read review exist.' : '. Staging values are not configured, so the route stays unapproved.')
        + (params.indexOf('email') !== -1 && needed.indexOf('email') === -1 ? ' Email is an accepted alternative identifier; do not invent one.' : ''),
    });
  }
  if (trace.unbounded) {
    return Object.assign(base, {
      decision: 'manual-review',
      reason: 'The traced read has no row limit. It stays blocked.',
    });
  }
  return Object.assign(base, {
    decision: 'manual-review',
    reason: 'Required parameters or authorization were not proven from the handler and its helpers. The route stays blocked.',
  });
}
