import { getPrisma } from '../prisma.js';
import { getCatalog } from './mysqlCatalog.js';
import { normalizeRow, normalizeWriteValue } from './rowCodec.js';
import {
  cleanIdent,
  compileLimit,
  compileOrder,
  compileWhere,
  parseOrFilter,
  parseSelectList,
  quoteIdent,
} from './postgrestFilter.js';

const DEFAULT_LIMIT = 1000;

function shapeRows(rows, mode) {
  if (mode === 'single') {
    if (rows.length !== 1) {
      return {
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
        count: null,
      };
    }
    return { data: rows[0], error: null, count: null };
  }
  if (mode === 'maybe') {
    if (rows.length > 1) {
      return {
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
        count: null,
      };
    }
    return { data: rows[0] || null, error: null, count: null };
  }
  return { data: rows, error: null, count: null };
}

async function withUtc(fn) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET time_zone = '+00:00'");
    return fn(tx);
  });
}

class MysqlQuery {
  constructor(table) {
    this.table = table;
    this.action = 'select';
    this.filters = [];
    this.orders = [];
    this.selectCols = null;
    this.returning = false;
    this.head = false;
    this.countExact = false;
    this.rowLimit = null;
    this.rowOffset = 0;
    this.mode = null;
    this.payload = null;
    this.onConflict = null;
    this._promise = null;
  }

  select(list, options = {}) {
    this.selectCols = parseSelectList(list);
    this.returning = true;
    this.head = options?.head === true;
    this.countExact = options?.count === 'exact';
    return this;
  }

  eq(column, value) { return this._cmp('eq', column, value); }
  neq(column, value) { return this._cmp('neq', column, value); }
  gt(column, value) { return this._cmp('gt', column, value); }
  gte(column, value) { return this._cmp('gte', column, value); }
  lt(column, value) { return this._cmp('lt', column, value); }
  lte(column, value) { return this._cmp('lte', column, value); }
  like(column, value) { return this._cmp('like', column, value); }
  ilike(column, value) { return this._cmp('ilike', column, value); }
  is(column, value) { return this._cmp('is', column, value); }

  in(column, value) {
    this.filters.push({ kind: 'in', column: cleanIdent(column), value: value || [] });
    return this;
  }

  not(column, op, value) {
    this.filters.push({ kind: 'not', column: cleanIdent(column), op, value });
    return this;
  }

  or(input) {
    this.filters.push({ kind: 'or', atoms: parseOrFilter(input) });
    return this;
  }

  match(obj) {
    for (const [column, value] of Object.entries(obj || {})) this.eq(column, value);
    return this;
  }

  order(column, options = {}) {
    this.orders.push({ column: cleanIdent(column), ascending: options.ascending !== false });
    return this;
  }

  limit(count) {
    this.rowLimit = Number(count);
    return this;
  }

  range(from, to) {
    this.rowOffset = Number(from);
    this.rowLimit = Number(to) - Number(from) + 1;
    return this;
  }

  insert(payload) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload, options = {}) {
    this.action = 'upsert';
    this.payload = payload;
    this.onConflict = options.onConflict || null;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  single() {
    this.mode = 'single';
    return this;
  }

  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  execute() {
    if (!this._promise) this._promise = this._run();
    return this._promise;
  }

  _cmp(kind, column, value) {
    this.filters.push({ kind, column: cleanIdent(column), value });
    return this;
  }

  async _run() {
    try {
      const table = getCatalog().get(this.table);
      if (!table) {
        return { data: null, error: { message: `Unknown table ${this.table}`, code: '42P01' }, count: null };
      }
      if (this.action === 'insert') return await this._insert(table);
      if (this.action === 'update') return await this._update(table);
      if (this.action === 'delete') return await this._delete(table);
      if (this.action === 'upsert') return await this._upsert(table);
      return await this._select(table);
    } catch (err) {
      return { data: null, error: { message: err.message, code: err.code || null }, count: null };
    }
  }

  async _select(table) {
    const known = table.fields;
    const where = compileWhere(this.filters, known);
    if (this.head) {
      const rows = await withUtc((tx) => tx.$queryRawUnsafe(
        `SELECT COUNT(*) AS cnt FROM ${quoteIdent(table.name)}${where.sql}`,
        ...where.params,
      ));
      return { data: null, error: null, count: Number(rows[0].cnt) };
    }
    const columnSql = this.selectCols?.length
      ? this.selectCols.map((column) => quoteIdent(column)).join(', ')
      : '*';
    const order = compileOrder(this.orders, known);
    const limit = compileLimit(this.rowLimit == null ? DEFAULT_LIMIT : this.rowLimit, this.rowOffset);
    const sql = `SELECT ${columnSql} FROM ${quoteIdent(table.name)}${where.sql}${order.sql}${limit.sql}`;
    const rows = await withUtc(async (tx) => {
      let count = null;
      if (this.countExact) {
        const countRows = await tx.$queryRawUnsafe(
          `SELECT COUNT(*) AS cnt FROM ${quoteIdent(table.name)}${where.sql}`,
          ...where.params,
        );
        count = Number(countRows[0].cnt);
      }
      const dataRows = await tx.$queryRawUnsafe(sql, ...where.params, ...limit.params);
      return { count, dataRows };
    });
    const shaped = shapeRows(rows.dataRows.map((row) => normalizeRow(row, table)), this.mode);
    if (this.countExact) shaped.count = rows.count;
    return shaped;
  }

  async _insert(table) {
    const records = (Array.isArray(this.payload) ? this.payload : [this.payload]).filter(Boolean);
    if (!records.length) return { data: null, error: { message: 'Insert payload is empty' }, count: null };
    const columns = [...new Set(records.flatMap((row) => Object.keys(row).filter((key) => row[key] !== undefined)))]
      .filter((column) => table.fields.has(column));
    if (!columns.length) return { data: null, error: { message: 'Insert payload has no known columns' }, count: null };
    const params = [];
    const tuples = records.map((row) => {
      const values = columns.map((column) => normalizeWriteValue(row[column] === undefined ? null : row[column], table.fields.get(column)));
      params.push(...values);
      return `(${columns.map(() => '?').join(', ')})`;
    });
    const insertSql = `INSERT INTO ${quoteIdent(table.name)} (${columns.map(quoteIdent).join(', ')}) VALUES ${tuples.join(', ')}`;
    const columnSql = this.selectCols?.length ? this.selectCols.map(quoteIdent).join(', ') : '*';
    const pk = table.pk.length === 1 ? table.fields.get(table.pk[0]) : null;
    const pkName = pk?.name;
    const useLastId = records.length === 1 && pk?.defaultName === 'autoincrement' && records[0][pkName] == null;
    const selected = await withUtc(async (tx) => {
      await tx.$executeRawUnsafe(insertSql, ...params);
      if (!this.returning) return [];
      if (useLastId) {
        return tx.$queryRawUnsafe(
          `SELECT ${columnSql} FROM ${quoteIdent(table.name)} WHERE ${quoteIdent(pkName)} = LAST_INSERT_ID()`,
        );
      }
      const where = compileWhere(columns.map((column) => ({ kind: 'eq', column, value: records[0][column] ?? null })), table.fields);
      return tx.$queryRawUnsafe(
        `SELECT ${columnSql} FROM ${quoteIdent(table.name)}${where.sql} LIMIT ?`,
        ...where.params,
        records.length,
      );
    });
    if (!this.returning) return { data: null, error: null, count: null };
    return shapeRows(selected.map((row) => normalizeRow(row, table)), this.mode);
  }

  async _update(table) {
    const columns = Object.keys(this.payload || {}).filter((key) => this.payload[key] !== undefined && table.fields.has(key));
    if (!columns.length) return { data: null, error: { message: 'Update payload is empty' }, count: null };
    const where = compileWhere(this.filters, table.fields);
    const params = columns.map((column) => normalizeWriteValue(this.payload[column], table.fields.get(column)));
    const sql = `UPDATE ${quoteIdent(table.name)} SET ${columns.map((column) => `${quoteIdent(column)} = ?`).join(', ')}${where.sql}`;
    await withUtc((tx) => tx.$executeRawUnsafe(sql, ...params, ...where.params));
    if (!this.returning) return { data: null, error: null, count: null };
    return this._select(table);
  }

  async _delete(table) {
    const where = compileWhere(this.filters, table.fields);
    let existing = [];
    if (this.returning) {
      const selected = await this._select(table);
      if (selected.error) return selected;
      existing = Array.isArray(selected.data) ? selected.data : (selected.data ? [selected.data] : []);
    }
    await withUtc((tx) => tx.$executeRawUnsafe(
      `DELETE FROM ${quoteIdent(table.name)}${where.sql}`,
      ...where.params,
    ));
    if (!this.returning) return { data: null, error: null, count: null };
    return shapeRows(existing, this.mode);
  }

  async _upsert(table) {
    const row = Array.isArray(this.payload) ? this.payload[0] : this.payload;
    const columns = Object.keys(row || {}).filter((key) => row[key] !== undefined && table.fields.has(key));
    if (!columns.length) return { data: null, error: { message: 'Upsert payload has no known columns' }, count: null };
    const params = columns.map((column) => normalizeWriteValue(row[column], table.fields.get(column)));
    const assignments = columns.map((column) => `${quoteIdent(column)} = incoming.${quoteIdent(column)}`);
    const sql = `INSERT INTO ${quoteIdent(table.name)} (${columns.map(quoteIdent).join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) AS incoming ON DUPLICATE KEY UPDATE ${assignments.join(', ')}`;
    await withUtc((tx) => tx.$executeRawUnsafe(sql, ...params));
    const keys = (this.onConflict || table.pk.join(',')).split(',').map(cleanIdent).filter((column) => row[column] !== undefined);
    keys.forEach((column) => this.eq(column, row[column]));
    this.action = 'select';
    this.rowLimit = 1;
    if (this.mode == null && this.returning) this.mode = 'single';
    return this._select(table);
  }
}

function unavailableStorage() {
  const fail = async () => ({ data: null, error: { message: 'SUPABASE_URL is required for file storage' } });
  return {
    from() {
      return {
        upload: fail,
        download: fail,
        remove: fail,
        list: fail,
        createSignedUrl: fail,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      };
    },
  };
}

function unavailableChannel() {
  return {
    subscribe(cb) {
      if (typeof cb === 'function') cb('CHANNEL_ERROR');
      return this;
    },
    async send() { return 'error'; },
    unsubscribe() { return Promise.resolve('ok'); },
  };
}

export function createMysqlSupabaseClient(bridges = {}) {
  return {
    from(table) {
      return new MysqlQuery(table);
    },
    storage: bridges.storage || unavailableStorage(),
    channel(name, options) {
      if (bridges.channel) return bridges.channel(name, options);
      return unavailableChannel();
    },
  };
}
