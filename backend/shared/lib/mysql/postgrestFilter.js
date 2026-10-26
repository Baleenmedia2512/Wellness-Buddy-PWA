const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function cleanIdent(name) {
  return String(name ?? '').trim().replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
}

export function quoteIdent(name) {
  const cleaned = cleanIdent(name);
  if (!IDENT.test(cleaned)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `\`${cleaned}\``;
}

export function parseSelectList(input) {
  if (input == null || input === '' || input === '*') return null;
  if (typeof input !== 'string') {
    throw new Error('select columns must be a string');
  }
  if (input.includes('(')) {
    throw new Error('Nested selects are not available on the MySQL path');
  }
  return input.split(',').map(cleanIdent).filter(Boolean);
}

export function splitTopLevelCommas(input) {
  const parts = [];
  let current = '';
  let quoted = false;
  for (const ch of String(input)) {
    if (ch === '"') quoted = !quoted;
    if (ch === ',' && !quoted) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function coerceOrValue(op, raw) {
  const value = String(raw);
  if (op === 'is' || op === 'eq' || op === 'neq') {
    if (value === 'null') return null;
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  if (op === 'in') {
    const inner = value.replace(/^\(|\)$/g, '');
    if (!inner) return [];
    return splitTopLevelCommas(inner).map((item) => coerceOrValue('eq', item.trim()));
  }
  if ((op === 'eq' || op === 'neq' || op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte')
    && /^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

export function parseOrFilter(input) {
  return splitTopLevelCommas(input).map((part) => {
    const text = part.trim();
    let column = '';
    let rest = text;
    if (text.startsWith('"')) {
      const end = text.indexOf('"', 1);
      column = text.slice(1, end);
      rest = text.slice(end + 1).replace(/^\./, '');
    } else {
      const dot = text.indexOf('.');
      column = text.slice(0, dot);
      rest = text.slice(dot + 1);
    }
    const opDot = rest.indexOf('.');
    const op = rest.slice(0, opDot);
    const raw = rest.slice(opDot + 1);
    return { kind: op, column: cleanIdent(column), value: coerceOrValue(op, raw) };
  });
}

function assertKnown(column, known) {
  const name = cleanIdent(column);
  if (!known.has(name)) {
    throw new Error(`Unknown column ${name}`);
  }
  return quoteIdent(name);
}

function coerceParam(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return value;
}

function comparisonSql(kind, columnSql, value, params) {
  if ((kind === 'eq' || kind === 'is') && value === null) return `${columnSql} IS NULL`;
  if ((kind === 'neq' || kind === 'not') && value === null) return `${columnSql} IS NOT NULL`;
  if (kind === 'is' && value === true) return `${columnSql} = 1`;
  if (kind === 'is' && value === false) return `${columnSql} = 0`;
  if (kind === 'like' || kind === 'ilike') {
    params.push(value);
    const hasWild = /[%_]/.test(String(value));
    const left = kind === 'ilike' ? `LOWER(${columnSql})` : columnSql;
    const right = kind === 'ilike' ? 'LOWER(?)' : '?';
    return hasWild ? `${left} LIKE ${right}` : `${left} = ${right}`;
  }
  const op = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[kind];
  if (!op) throw new Error(`Unsupported filter ${kind}`);
  params.push(coerceParam(value));
  return `${columnSql} ${op} ?`;
}

function compileAtom(filter, params, known) {
  if (filter.kind === 'or') {
    const parts = filter.atoms.map((atom) => compileAtom(atom, params, known));
    return `(${parts.join(' OR ')})`;
  }
  const columnSql = assertKnown(filter.column, known);
  if (filter.kind === 'in') {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    if (values.length === 0) return '0 = 1';
    values.forEach((value) => params.push(coerceParam(value)));
    return `${columnSql} IN (${values.map(() => '?').join(', ')})`;
  }
  if (filter.kind === 'not') {
    if (filter.op === 'is' && filter.value === null) return `${columnSql} IS NOT NULL`;
    if (filter.op === 'is' && filter.value === true) return `${columnSql} = 0`;
    if (filter.op === 'is' && filter.value === false) return `${columnSql} = 1`;
    if (filter.op === 'in') {
      const values = Array.isArray(filter.value) ? filter.value : [];
      if (values.length === 0) return '1 = 1';
      values.forEach((value) => params.push(coerceParam(value)));
      return `${columnSql} NOT IN (${values.map(() => '?').join(', ')})`;
    }
    return comparisonSql(filter.op === 'eq' ? 'neq' : filter.op, columnSql, filter.value, params);
  }
  return comparisonSql(filter.kind, columnSql, filter.value, params);
}

export function compileWhere(filters, known) {
  const params = [];
  const parts = (filters || []).map((filter) => compileAtom(filter, params, known));
  return {
    sql: parts.length ? ` WHERE ${parts.join(' AND ')}` : '',
    params,
  };
}

export function compileOrder(orders, known) {
  if (!orders?.length) return { sql: '', params: [] };
  const sql = orders.map((order) => {
    const columnSql = assertKnown(order.column, known);
    const direction = order.ascending === false ? 'DESC' : 'ASC';
    return `${columnSql} ${direction}`;
  }).join(', ');
  return { sql: ` ORDER BY ${sql}`, params: [] };
}

export function compileLimit(limit, offset) {
  if (limit == null) return { sql: '', params: [] };
  const lim = Number(limit);
  const off = Number(offset || 0);
  if (!Number.isInteger(lim) || lim < 0 || !Number.isInteger(off) || off < 0) {
    throw new Error('limit and offset must be whole numbers');
  }
  if (off > 0) return { sql: ' LIMIT ? OFFSET ?', params: [lim, off] };
  return { sql: ' LIMIT ?', params: [lim] };
}
