/**
 * Run: node --test backend/features/body-parameters-card/__tests__/list.pagination.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BPC_LIST_DEFAULT_PAGE_SIZE,
  normalizeBpcListPagination,
  buildBpcListPaginationMeta,
  filterBpcListRecords,
  paginateBpcListRecords,
} from '../domain/list.pagination.js';

describe('normalizeBpcListPagination', () => {
  it('defaults to page 1 and limit 20', () => {
    const p = normalizeBpcListPagination({});
    assert.equal(p.page, 1);
    assert.equal(p.limit, BPC_LIST_DEFAULT_PAGE_SIZE);
    assert.equal(p.search, '');
  });

  it('caps limit at max page size', () => {
    assert.equal(normalizeBpcListPagination({ limit: 9999 }).limit, 100);
  });

  it('normalizes search to lowercase trimmed', () => {
    assert.equal(normalizeBpcListPagination({ search: '  Alice  ' }).search, 'alice');
  });
});

describe('paginateBpcListRecords', () => {
  const cards = Array.from({ length: 45 }, (_, i) => ({
    id: i + 1,
    name: i % 2 === 0 ? `Alice ${i}` : `Bob ${i}`,
    phoneNumber: `90000000${String(i).padStart(2, '0')}`,
  }));

  it('returns first page of 20 by default', () => {
    const { records, pagination } = paginateBpcListRecords(cards, {});
    assert.equal(records.length, 20);
    assert.equal(pagination.totalRecords, 45);
    assert.equal(pagination.hasNextPage, true);
    assert.equal(pagination.currentPage, 1);
  });

  it('returns page 3 remainder', () => {
    const { records, pagination } = paginateBpcListRecords(cards, { page: 3, limit: 20 });
    assert.equal(records.length, 5);
    assert.equal(pagination.hasNextPage, false);
  });

  it('filters by name, phone, email and community id', () => {
    const { records, pagination } = paginateBpcListRecords(cards, { search: 'alice', limit: 100 });
    assert.ok(records.every((c) => c.name.toLowerCase().includes('alice')));
    assert.equal(pagination.totalRecords, filterBpcListRecords(cards, 'alice').length);

    const withMeta = [
      ...cards,
      { id: 999, name: 'Zed', phoneNumber: null, email: 'zed@test.com', communityId: 'WB999' },
    ];
    assert.equal(filterBpcListRecords(withMeta, 'wb999').length, 1);
    assert.equal(filterBpcListRecords(withMeta, 'zed@test').length, 1);
  });
});

describe('buildBpcListPaginationMeta', () => {
  it('clamps current page to totalPages', () => {
    const meta = buildBpcListPaginationMeta(10, 99, 20);
    assert.equal(meta.currentPage, 1);
    assert.equal(meta.totalPages, 1);
  });
});
