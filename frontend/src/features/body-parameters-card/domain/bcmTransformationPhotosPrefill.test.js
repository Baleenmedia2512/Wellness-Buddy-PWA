/**
 * Run: node --test frontend/src/features/body-parameters-card/domain/bcmTransformationPhotosPrefill.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveEditCardPhotoPrefillUserId,
  resolvePhoneStatusPhotoPrefillUserId,
} from './bcmTransformationPhotosPrefill.js';

describe('bcmTransformationPhotosPrefill', () => {
  describe('resolvePhoneStatusPhotoPrefillUserId', () => {
    it('returns null when activated', () => {
      assert.equal(
        resolvePhoneStatusPhotoPrefillUserId({ activated: true, userId: 42 }),
        null,
      );
    });

    it('returns member id when not activated', () => {
      assert.equal(
        resolvePhoneStatusPhotoPrefillUserId({ activated: false, userId: '42' }),
        42,
      );
    });

    it('returns null without userId', () => {
      assert.equal(
        resolvePhoneStatusPhotoPrefillUserId({ activated: false, userId: null }),
        null,
      );
    });
  });

  describe('resolveEditCardPhotoPrefillUserId', () => {
    it('returns linked member id from existing card', () => {
      assert.equal(resolveEditCardPhotoPrefillUserId({ id: 1, userId: 99 }), 99);
    });

    it('returns null when card has no userId', () => {
      assert.equal(resolveEditCardPhotoPrefillUserId({ id: 1 }), null);
    });
  });
});
