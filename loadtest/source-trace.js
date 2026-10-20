/**
 * Follows the named imports a route handler actually calls.
 * A whole service file is not treated as a side effect when the handler
 * only calls a read function from it.
 */

const fs = require('fs');
const path = require('path');

const SKIP_BINDINGS = new Set([
  'applyCors',
  'methodNotAllowed',
  'runService',
]);

const CALL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'await',
  'typeof', 'new', 'throw', 'void', 'delete', 'in', 'of', 'do', 'else',
  'case', 'super', 'class', 'try', 'finally',
]);

function lineEffects(body) {
  const writes = [];
  const external = [];
  const redirects = [];
  body.split('\n').forEach(function (line) {
    if (/sendMdtSms|sendTransactionalMail|createTransport\s*\(|getGenAI|GoogleGenerativeAI|\bfetch\s*\(|axios\.|nodemailer|stripe\.|razorpay|PutObjectCommand/.test(line)) {
      const found = line.match(/sendMdtSms|sendTransactionalMail|createTransport\s*\(|getGenAI|GoogleGenerativeAI|\bfetch\s*\(|axios\.|nodemailer|stripe\.|razorpay|PutObjectCommand/);
      external.push(found[0]);
    }
    if (/res\.redirect\s*\(|NextResponse\.redirect|httpStatus:\s*302|\.status\(\s*302\s*\)/.test(line)) {
      redirects.push(line.match(/res\.redirect\s*\(|NextResponse\.redirect|httpStatus:\s*302|\.status\(\s*302\s*\)/)[0]);
    }
    if (/\.(insert|upsert|rpc)\s*\(/.test(line)) {
      writes.push(line.match(/\.(insert|upsert|rpc)\s*\(/)[1]);
    } else if (/\.update\s*\(/.test(line) && !/createHash|createHmac|\.update\(\s*['"`]|stringToSign|\.update\(\s*data\b/.test(line)) {
      writes.push('update');
    } else if (/\.delete\(\s*\)/.test(line)) {
      writes.push('delete');
    }
  });
  return { writes: writes, external: external, redirects: redirects };
}
const REQUIRED_RE = /if\s*\(\s*!query\??\.(\w+)/g;
const REQUIRED_MSG_RE = /['"`](\w+) is required['"`]|Missing required parameter:\s*(\w+)|Missing required field:\s*(\w+)/g;
const IGNORE_MEMBER_OBJECTS = new Set([
  'logger', 'console', 'Math', 'JSON', 'Object', 'Promise', 'Buffer', 'process',
  'res', 'req', 'supabase', 'URL', 'Date', 'Number', 'String', 'Array', 'crypto',
  'path', 'fs',
]);
const PACKAGE_UNRESOLVED = new Set([
  'ValidationError',
  'createClient',
  'Pool',
]);

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, base + '.js', path.join(base, 'index.js')];
  for (let i = 0; i < candidates.length; i += 1) {
    if (fs.existsSync(candidates[i]) && fs.statSync(candidates[i]).isFile()) return candidates[i];
  }
  return null;
}

function parseImportClause(clause) {
  const bindings = [];
  const trimmed = clause.trim();
  const star = trimmed.match(/^\*\s+as\s+(\w+)$/);
  if (star) {
    bindings.push({ local: star[1], imported: '*', typeOnly: false });
    return bindings;
  }
  const brace = trimmed.indexOf('{');
  if (brace === -1) {
    const name = trimmed.replace(/^type\s+/, '').split(/\s+/)[0];
    if (name && name !== 'type') bindings.push({ local: name, imported: 'default', typeOnly: trimmed.startsWith('type ') });
    return bindings;
  }
  const before = trimmed.slice(0, brace).replace(/,/g, '').trim();
  if (before.startsWith('* as ')) {
    bindings.push({ local: before.slice(5).trim(), imported: '*', typeOnly: false });
  } else if (before && before !== 'type') {
    bindings.push({ local: before.split(/\s+/)[0], imported: 'default', typeOnly: false });
  }
  const inside = trimmed.slice(brace + 1, trimmed.lastIndexOf('}'));
  inside.split(',').forEach(function (part) {
    const piece = part.trim();
    if (!piece || piece.startsWith('type ')) return;
    const bits = piece.split(/\s+as\s+/);
    const imported = bits[0].trim();
    const local = (bits[1] || bits[0]).trim();
    if (imported && local) bindings.push({ local: local, imported: imported, typeOnly: false });
  });
  return bindings;
}

function parseModule(filePath) {
  const source = stripComments(fs.readFileSync(filePath, 'utf8'));
  const imports = [];
  const importRe = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match = importRe.exec(source);
  while (match) {
    parseImportClause(match[1]).forEach(function (binding) {
      if (binding.typeOnly) return;
      imports.push({
        local: binding.local,
        imported: binding.imported,
        specifier: match[2],
        resolved: resolveSpecifier(filePath, match[2]),
      });
    });
    match = importRe.exec(source);
  }
  const reexports = [];
  const reexportRe = /export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  match = reexportRe.exec(source);
  while (match) {
    match[1].split(',').forEach(function (part) {
      const piece = part.trim();
      if (!piece) return;
      const bits = piece.split(/\s+as\s+/);
      reexports.push({
        imported: bits[0].trim(),
        local: (bits[1] || bits[0]).trim(),
        specifier: match[2],
        resolved: resolveSpecifier(filePath, match[2]),
      });
    });
    match = reexportRe.exec(source);
  }
  return { source: source, imports: imports, reexports: reexports };
}

function matchBracket(source, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === '\\') {
        i += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findFunctionRange(source, name) {
  const patterns = [
    new RegExp('(?:export\\s+default\\s+)?(?:export\\s+)?(?:async\\s+)?function\\s+' + name + '\\s*\\('),
    new RegExp('(?:export\\s+)?(?:const|let|var)\\s+' + name + '\\s*=\\s*(?:async\\s*)?(?:function\\s*)?\\('),
    new RegExp('(?:export\\s+)?(?:const|let|var)\\s+' + name + '\\s*=\\s*(?:async\\s*)?[A-Za-z_$][\\w$]*\\s*=>'),
  ];
  let start = -1;
  for (let i = 0; i < patterns.length; i += 1) {
    const found = patterns[i].exec(source);
    if (found && (start === -1 || found.index < start)) start = found.index;
  }
  if (start === -1) return null;
  const paren = source.indexOf('(', start);
  const arrow = source.indexOf('=>', start);
  let bodyStart = -1;
  if (paren !== -1 && (arrow === -1 || paren < arrow)) {
    const parenEnd = matchBracket(source, paren, '(', ')');
    if (parenEnd === -1) return null;
    const after = source.slice(parenEnd + 1).match(/\s*(=>)?\s*/);
    const cursor = parenEnd + 1 + (after ? after[0].length : 0);
    if (source[cursor] === '{') bodyStart = cursor;
    else {
      const lineEnd = source.indexOf('\n', cursor);
      const end = lineEnd === -1 ? source.length : lineEnd;
      return { start: start, end: end, body: source.slice(start, end) };
    }
  } else if (arrow !== -1) {
    const afterArrow = source.slice(arrow + 2).match(/\s*/)[0].length + arrow + 2;
    if (source[afterArrow] === '{') bodyStart = afterArrow;
    else {
      const lineEnd = source.indexOf('\n', afterArrow);
      const end = lineEnd === -1 ? source.length : lineEnd;
      return { start: start, end: end, body: source.slice(start, end) };
    }
  }
  if (bodyStart === -1) return null;
  const bodyEnd = matchBracket(source, bodyStart, '{', '}');
  if (bodyEnd === -1) return null;
  return { start: start, end: bodyEnd + 1, body: source.slice(start, bodyEnd + 1) };
}

function calledNames(body) {
  const names = [];
  const callRe = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*(?=\()/g;
  let match = callRe.exec(body);
  while (match) {
    if (!CALL_KEYWORDS.has(match[2])) names.push(match[2]);
    match = callRe.exec(body);
  }
  const memberRe = /([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*(?=\()/g;
  match = memberRe.exec(body);
  while (match) {
    if (!['if', 'return', 'await'].includes(match[1])) names.push(match[1] + '.' + match[2]);
    match = memberRe.exec(body);
  }
  return names;
}

function collectMatches(regex, body) {
  const found = [];
  regex.lastIndex = 0;
  let match = regex.exec(body);
  while (match) {
    found.push(match[1] || match[0]);
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
    match = regex.exec(body);
  }
  regex.lastIndex = 0;
  return found;
}

function requiredFields(body) {
  const fields = new Set();
  collectMatches(REQUIRED_RE, body).forEach(function (field) { fields.add(field); });
  const messageRe = /['"`](\w+) is required['"`]|Missing required parameter:\s*(\w+)|Missing required field:\s*(\w+)/g;
  let message = messageRe.exec(body);
  while (message) {
    fields.add(message[1] || message[2] || message[3]);
    message = messageRe.exec(body);
  }
  const assignedRe = /(?:const|let)\s+(\w+)\s*=\s*query\??\.(\w+)/g;
  let assigned = assignedRe.exec(body);
  while (assigned) {
    if (new RegExp('if\\s*\\(\\s*!' + assigned[1] + '\\b').test(body)) fields.add(assigned[2]);
    assigned = assignedRe.exec(body);
  }
  const destructure = /(?:const|let)\s*\{([^}]+)\}\s*=\s*(?:req\.)?query\b/.exec(body);
  if (destructure) {
    destructure[1].split(',').forEach(function (part) {
      const field = part.split(':')[0].split('=')[0].trim();
      if (!field || field.startsWith('...')) return;
      if (new RegExp('if\\s*\\(\\s*!' + field + '\\b').test(body)) fields.add(field);
    });
  }
  return Array.from(fields);
}

function bindingTarget(parsed, name) {
  const imported = parsed.imports.find(function (item) { return item.local === name; });
  if (imported) return { file: imported.resolved, exportName: imported.imported === '*' ? '*' : imported.imported, specifier: imported.specifier };
  const reexported = parsed.reexports.find(function (item) { return item.local === name; });
  if (reexported) return { file: reexported.resolved, exportName: reexported.imported, specifier: reexported.specifier };
  return null;
}

function traceRoute(root, relativeFile) {
  const entry = path.join(root, relativeFile);
  const evidence = {
    entry: relativeFile,
    functions: [],
    files: [],
    writes: [],
    external: [],
    redirects: [],
    requiredQuery: [],
    unresolved: [],
    uncertain: false,
  };
  if (!fs.existsSync(entry)) {
    evidence.uncertain = true;
    evidence.unresolved.push(relativeFile);
    return evidence;
  }
  const seen = new Set();
  const queue = [];

  function enqueue(filePath, exportName) {
    if (!filePath) {
      if (!PACKAGE_UNRESOLVED.has(exportName)) {
        evidence.uncertain = true;
        evidence.unresolved.push(exportName || 'unknown-import');
      }
      return;
    }
    const key = filePath + '#' + exportName;
    if (seen.has(key)) return;
    if (seen.size > 120) {
      evidence.uncertain = true;
      evidence.unresolved.push('trace-limit');
      return;
    }
    seen.add(key);
    queue.push({ filePath: filePath, exportName: exportName });
  }

  const entryParsed = parseModule(entry);
  const entryBody = entryParsed.source;
  const entryCalls = calledNames(entryBody);
  entryCalls.forEach(function (name) {
    if (SKIP_BINDINGS.has(name) || name.indexOf('.') !== -1) return;
    const target = bindingTarget(entryParsed, name);
    if (target) enqueue(target.file, target.exportName);
  });
  const localHandler = findFunctionRange(entryParsed.source, 'handler');
  if (localHandler) {
    evidence.functions.push(relativeFile + '#handler');
    noteEffects(evidence, relativeFile, 'handler', localHandler.body);
    requiredFields(localHandler.body).forEach(function (field) {
      if (!evidence.requiredQuery.includes(field)) evidence.requiredQuery.push(field);
    });
  }

  let guard = 0;
  while (queue.length > 0 && guard < 120) {
    guard += 1;
    const item = queue.shift();
    const relative = path.relative(root, item.filePath).replace(/\\/g, '/');
    if (!evidence.files.includes(relative)) evidence.files.push(relative);
    let parsed;
    try {
      parsed = parseModule(item.filePath);
    } catch (error) {
      evidence.uncertain = true;
      evidence.unresolved.push(relative);
      continue;
    }
    if (item.exportName === '*') {
      evidence.uncertain = true;
      evidence.unresolved.push(relative + '#*');
      continue;
    }
    const local = findFunctionRange(parsed.source, item.exportName);
    if (!local) {
      const forwarded = bindingTarget(parsed, item.exportName);
      if (forwarded && forwarded.file) {
        enqueue(forwarded.file, forwarded.exportName);
        continue;
      }
      if (!PACKAGE_UNRESOLVED.has(item.exportName) && !new RegExp('class\\s+' + item.exportName + '\\b').test(parsed.source)) {
        evidence.uncertain = true;
        evidence.unresolved.push(relative + '#' + item.exportName);
      }
      continue;
    }
    const label = relative + '#' + item.exportName;
    evidence.functions.push(label);
    noteEffects(evidence, relative, item.exportName, local.body);
    requiredFields(local.body).forEach(function (field) {
      if (!evidence.requiredQuery.includes(field)) evidence.requiredQuery.push(field);
    });
    calledNames(local.body).forEach(function (name) {
      if (name.indexOf('.') !== -1) {
        const objectName = name.split('.')[0];
        const methodName = name.split('.')[1];
        if (IGNORE_MEMBER_OBJECTS.has(objectName)) return;
        const target = bindingTarget(parsed, objectName);
        if (target && target.exportName === '*') enqueue(target.file, methodName);
        else if (target) {
          evidence.uncertain = true;
          evidence.unresolved.push((target.specifier || objectName) + '#' + methodName);
        }
        return;
      }
      if (CALL_KEYWORDS.has(name) || SKIP_BINDINGS.has(name)) return;
      const target = bindingTarget(parsed, name);
      if (target) {
        enqueue(target.file, target.exportName);
        return;
      }
      if (findFunctionRange(parsed.source, name)) enqueue(item.filePath, name);
    });
  }
  if (queue.length > 0) {
    evidence.uncertain = true;
    evidence.unresolved.push('trace-limit');
  }
  evidence.requiredQuery.sort();
  return evidence;
}

function noteEffects(evidence, file, name, body) {
  const effects = lineEffects(body);
  effects.writes.forEach(function (match) {
    evidence.writes.push({ file: file, fn: name, match: match });
  });
  effects.external.forEach(function (match) {
    evidence.external.push({ file: file, fn: name, match: match });
  });
  effects.redirects.forEach(function (match) {
    evidence.redirects.push({ file: file, fn: name, match: match });
  });
}

module.exports = {
  traceRoute: traceRoute,
  parseModule: parseModule,
  findFunctionRange: findFunctionRange,
  calledNames: calledNames,
  requiredFields: requiredFields,
  lineEffects: lineEffects,
};
