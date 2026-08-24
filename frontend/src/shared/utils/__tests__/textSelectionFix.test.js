/**
 * Android Copy / Select all must not open on dashboard text.
 * First focus selects all; second click places caret.
 * Run: node --test frontend/src/shared/utils/__tests__/textSelectionFix.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEditableSelectionTarget,
  markPointerDownFocusState,
  shouldSelectAllOnClick,
} from '../textSelectionFix.js';

function mockElement({ tagName = 'DIV', closestMatch = false, isContentEditable = false, parentElement = null } = {}) {
  return {
    nodeType: 1,
    tagName,
    isContentEditable,
    parentElement,
    closest: (selector) => {
      if (!closestMatch) return null;
      if (typeof closestMatch === 'string') {
        return selector.includes(closestMatch) ? { tagName } : null;
      }
      return { tagName };
    },
  };
}

describe('isEditableSelectionTarget', () => {
  it('rejects missing targets so Home text cannot open Copy / Select all', () => {
    assert.equal(isEditableSelectionTarget(null), false);
    assert.equal(isEditableSelectionTarget(undefined), false);
  });

  it('rejects dashboard nodes that are not form fields', () => {
    const heading = mockElement({ tagName: 'H1' });
    assert.equal(isEditableSelectionTarget(heading), false);
  });

  it('allows input, textarea, and select so OTP / email paste still works', () => {
    assert.equal(isEditableSelectionTarget(mockElement({ tagName: 'INPUT', closestMatch: 'input' })), true);
    assert.equal(isEditableSelectionTarget(mockElement({ tagName: 'TEXTAREA', closestMatch: 'textarea' })), true);
    assert.equal(isEditableSelectionTarget(mockElement({ tagName: 'SELECT', closestMatch: 'select' })), true);
  });

  it('allows contenteditable and text nodes inside a field', () => {
    const field = mockElement({ tagName: 'INPUT', closestMatch: 'input', isContentEditable: false });
    const textNode = { nodeType: 3, parentElement: field };
    assert.equal(isEditableSelectionTarget(mockElement({ isContentEditable: true, closestMatch: false })), true);
    assert.equal(isEditableSelectionTarget(textNode), true);
  });
});

describe('shouldSelectAllOnClick (first tap vs second tap)', () => {
  it('selects all on first activating tap, not on second tap while focused', () => {
    if (typeof HTMLElement === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.value = '1526985355';
    document.body.appendChild(input);

    // First tap: not focused yet → select all
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => document.body });
    markPointerDownFocusState(input);
    assert.equal(shouldSelectAllOnClick(input), true);

    // Second tap: already focused → caret only
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => input });
    markPointerDownFocusState(input);
    assert.equal(shouldSelectAllOnClick(input), false);

    input.remove();
  });
});
