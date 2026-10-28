import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileWhere,
  parseOrFilter,
  parseSelectList,
} from '../postgrestFilter.js';

const known = new Map([
  ['Email', {}],
  ['IsDeleted', {}],
  ['UserId', {}],
  ['CoachId', {}],
  ['CoCoachId', {}],
]);

describe('parseSelectList', () => {
  it('keeps quoted column names', () => {
    assert.deepEqual(parseSelectList('"ID", "OTPHash", "ExpiresAt"'), ['ID', 'OTPHash', 'ExpiresAt']);
  });

  it('treats star as every column', () => {
    assert.equal(parseSelectList('*'), null);
  });
});

describe('parseOrFilter', () => {
  it('reads quoted null checks and numeric equals', () => {
    assert.deepEqual(parseOrFilter('"IsDeleted".is.null,"IsDeleted".eq.0,"IsDeleted".eq.false'), [
      { kind: 'is', column: 'IsDeleted', value: null },
      { kind: 'eq', column: 'IsDeleted', value: 0 },
      { kind: 'eq', column: 'IsDeleted', value: false },
    ]);
  });

  it('keeps dots inside an ilike value', () => {
    const [atom] = parseOrFilter('Email.ilike.%a.b@c.com%');
    assert.equal(atom.column, 'Email');
    assert.equal(atom.kind, 'ilike');
    assert.equal(atom.value, '%a.b@c.com%');
  });
});

describe('compileWhere', () => {
  it('uses case-insensitive equality when ilike has no wildcard', () => {
    const compiled = compileWhere([{ kind: 'ilike', column: 'Email', value: 'Person@example.com' }], known);
    assert.match(compiled.sql, /LOWER\(`Email`\) = LOWER\(\?\)/);
    assert.deepEqual(compiled.params, ['Person@example.com']);
  });

  it('turns an empty in-list into no rows', () => {
    const compiled = compileWhere([{ kind: 'in', column: 'UserId', value: [] }], known);
    assert.match(compiled.sql, /0 = 1/);
  });

  it('combines an or group with a normal filter', () => {
    const compiled = compileWhere([
      { kind: 'eq', column: 'Email', value: 'a@b.c' },
      { kind: 'or', atoms: parseOrFilter('CoachId.eq.5,CoCoachId.eq.5') },
    ], known);
    assert.match(compiled.sql, /`Email` = \? AND \(`CoachId` = \? OR `CoCoachId` = \?\)/);
    assert.deepEqual(compiled.params, ['a@b.c', 5, 5]);
  });

  it('compiles co-coach and() groups instead of treating and(CoachId as a column', () => {
    const atoms = parseOrFilter(
      'and(CoachId.eq.339,CoCoachId.eq.279),and(CoachId.eq.279,CoCoachId.eq.339)',
    );
    assert.equal(atoms[0].kind, 'and');
    assert.equal(atoms[0].atoms[0].column, 'CoachId');
    assert.equal(atoms[0].atoms[1].column, 'CoCoachId');

    const compiled = compileWhere([
      { kind: 'or', atoms },
      { kind: 'eq', column: 'Status', value: 'active' },
    ], new Map([...known, ['Status', {}]]));
    assert.match(
      compiled.sql,
      /\(`CoachId` = \? AND `CoCoachId` = \?\) OR \(`CoachId` = \? AND `CoCoachId` = \?\)/,
    );
    assert.match(compiled.sql, /`Status` = \?/);
    assert.deepEqual(compiled.params, [339, 279, 279, 339, 'active']);
  });

  it('maps not-is-null to IS NOT NULL', () => {
    const compiled = compileWhere([{ kind: 'not', column: 'Email', op: 'is', value: null }], known);
    assert.match(compiled.sql, /`Email` IS NOT NULL/);
  });

  it('excludes an ilike pattern instead of matching it', () => {
    const compiled = compileWhere(
      [{ kind: 'not', column: 'Topic', op: 'ilike', value: 'Calories Burned:%' }],
      new Map([['Topic', {}]]),
    );
    assert.match(compiled.sql, /NOT \(LOWER\(`Topic`\) LIKE LOWER\(\?\)\)/);
    assert.deepEqual(compiled.params, ['Calories Burned:%']);
  });
});
