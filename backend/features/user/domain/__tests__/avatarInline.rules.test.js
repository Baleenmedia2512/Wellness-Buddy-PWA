/**
 * Run: node --test backend/features/user/domain/__tests__/avatarInline.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { wantsInlineAvatar } from '../avatarInline.rules.js';

describe('wantsInlineAvatar', () => {
  it('is off by default so existing <img src> clients still get 302', () => {
    assert.equal(wantsInlineAvatar({}), false);
    assert.equal(wantsInlineAvatar({ userId: '42' }), false);
    assert.equal(wantsInlineAvatar({ inline: '' }), false);
    assert.equal(wantsInlineAvatar({ inline: '0' }), false);
  });

  it('is on for inline=1 / true used by profile recrop', () => {
    assert.equal(wantsInlineAvatar({ inline: '1' }), true);
    assert.equal(wantsInlineAvatar({ inline: 'true' }), true);
    assert.equal(wantsInlineAvatar({ inline: 'TRUE' }), true);
  });
});
