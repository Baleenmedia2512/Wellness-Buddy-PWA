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

  it('focuses the element without a synthetic click on web', () => {
    const focus = mock.fn();
    const click = mock.fn();
    focusInputForKeyboard({ focus, click });
    assert.equal(focus.mock.callCount(), 1);
    // Node / web is not native Android — click would select-all mid-typing.
    assert.equal(click.mock.callCount(), 0);
  });

  it('does not re-focus when the field is already active (mobile web tel select-all)', () => {
    if (typeof document === 'undefined') {
      // Node unit env: production code also skips the activeElement guard here.
      const el = { focus: mock.fn(), click: mock.fn() };
      focusInputForKeyboard(el);
      assert.equal(el.focus.mock.callCount(), 1);
      return;
    }
    const el = { focus: mock.fn(), click: mock.fn() };
    const previous = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => el,
    });
    try {
      focusInputForKeyboard(el);
      assert.equal(el.focus.mock.callCount(), 0);
      assert.equal(el.click.mock.callCount(), 0);
    } finally {
      if (previous) Object.defineProperty(document, 'activeElement', previous);
      else delete document.activeElement;
    }
  });
});

describe('scheduleFocusInputForKeyboard', () => {
  it('returns a cancel function', () => {
    const cancel = scheduleFocusInputForKeyboard(() => null, [10]);
    assert.equal(typeof cancel, 'function');
    cancel();
  });
});
