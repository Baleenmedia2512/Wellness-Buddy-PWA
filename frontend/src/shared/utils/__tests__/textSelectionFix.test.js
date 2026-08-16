/**
 * Android Copy / Select all must not open on dashboard text.
 * Run: node --test frontend/src/shared/utils/__tests__/textSelectionFix.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isEditableSelectionTarget } from '../textSelectionFix.js';

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
