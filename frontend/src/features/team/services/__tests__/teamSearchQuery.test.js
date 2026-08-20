/**
 * Run: node --test frontend/src/features/team/services/__tests__/teamSearchQuery.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTypedSearchQuery } from '../teamSearchQuery.js';

describe('resolveTypedSearchQuery', () => {
  it('keeps an in-progress query as typed', () => {
    assert.equal(resolveTypedSearchQuery({
      currentQuery: 'jo',
      displayName: 'John Smith',
      nextValue: 'joh',
    }), 'joh');
  });

  it('strips the visible selected name when the next keystroke appends to it', () => {
    assert.equal(resolveTypedSearchQuery({
      currentQuery: '',
      displayName: 'John Smith',
      nextValue: 'John Smithj',
    }), 'j');
  });

  it('uses a full replace when select-all worked', () => {
    assert.equal(resolveTypedSearchQuery({
      currentQuery: '',
      displayName: 'John Smith',
      nextValue: 'jane',
    }), 'jane');
  });

  it('treats deleting from the visible name as the remaining prefix', () => {
    assert.equal(resolveTypedSearchQuery({
      currentQuery: '',
      displayName: 'John Smith',
      nextValue: 'John Smit',
    }), 'John Smit');
  });

  it('does not search when the visible name is unchanged', () => {
    assert.equal(resolveTypedSearchQuery({
      currentQuery: '',
      displayName: 'John Smith',
      nextValue: 'John Smith',
    }), '');
  });
});
