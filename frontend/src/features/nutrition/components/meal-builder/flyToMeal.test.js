/**
 * Run: node --test frontend/src/features/nutrition/components/meal-builder/flyToMeal.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  rectCenter,
  resolveFlyTargetPoint,
  bottomTrayFallbackPoint,
} from './flyToMeal.geometry.js';

describe('fly-to-meal geometry', () => {
  it('rectCenter uses the middle of the box', () => {
    assert.deepEqual(
      rectCenter({ left: 10, top: 20, width: 40, height: 20 }),
      { x: 30, y: 30 },
    );
  });

  it('resolveFlyTargetPoint prefers a visible tray target', () => {
    const target = {
      getBoundingClientRect: () => ({ left: 100, top: 400, width: 80, height: 40 }),
    };
    assert.deepEqual(resolveFlyTargetPoint(target, null), { x: 140, y: 420 });
  });

  it('resolveFlyTargetPoint falls back when tray has no size yet', () => {
    const emptyTarget = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    };
    const host = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 360,
        height: 640,
        bottom: 640,
      }),
    };
    assert.deepEqual(
      resolveFlyTargetPoint(emptyTarget, host),
      bottomTrayFallbackPoint(host),
    );
    assert.deepEqual(bottomTrayFallbackPoint(host), { x: 180, y: 584 });
  });
});
