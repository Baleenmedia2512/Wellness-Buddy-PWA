/**
 * Run: node --test frontend/src/shared/utils/focusInputForKeyboard.test.js
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { focusInputForKeyboard, scheduleFocusInputForKeyboard } from './focusInputForKeyboard.js';

describe('focusInputForKeyboard', () => {
  it('no-ops for null / non-focusable', () => {
    assert.doesNotThrow(() => focusInputForKeyboard(null));
    assert.doesNotThrow(() => focusInputForKeyboard({}));
  });

  it('focuses the element', () => {
    const focus = mock.fn();
    const click = mock.fn();
    focusInputForKeyboard({ focus, click });
    assert.equal(focus.mock.callCount(), 1);
    // On non-iOS (node test env), a synthetic click is used to help Android IME.
    assert.equal(click.mock.callCount(), 1);
  });
});

describe('scheduleFocusInputForKeyboard', () => {
  it('returns a cancel function', () => {
    const cancel = scheduleFocusInputForKeyboard(() => null, [10]);
    assert.equal(typeof cancel, 'function');
    cancel();
  });
});
