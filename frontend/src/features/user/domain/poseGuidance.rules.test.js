/**
 * Run: node --test frontend/src/features/user/domain/poseGuidance.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyBodyOrientation,
  evaluatePoseGuidance,
  hasUsableFace,
} from './poseGuidance.rules.js';

function lm(x, y, visibility = 0.9) {
  return { x, y, visibility };
}

describe('classifyBodyOrientation', () => {
  it('returns none without landmarks', () => {
    assert.equal(classifyBodyOrientation(null), 'none');
    assert.equal(classifyBodyOrientation([]), 'none');
  });

  it('detects front when shoulders are wide and nose visible', () => {
    const landmarks = new Array(25).fill(null).map(() => lm(0.5, 0.5, 0.1));
    landmarks[0] = lm(0.5, 0.2);
    landmarks[11] = lm(0.3, 0.35);
    landmarks[12] = lm(0.7, 0.35);
    landmarks[23] = lm(0.35, 0.7);
    landmarks[24] = lm(0.65, 0.7);
    assert.equal(classifyBodyOrientation(landmarks), 'front');
  });

  it('detects left profile when nose is right of shoulder mid', () => {
    const landmarks = new Array(25).fill(null).map(() => lm(0.5, 0.5, 0.1));
    landmarks[0] = lm(0.62, 0.25);
    landmarks[11] = lm(0.48, 0.35);
    landmarks[12] = lm(0.52, 0.35);
    landmarks[23] = lm(0.48, 0.7);
    landmarks[24] = lm(0.52, 0.7);
    assert.equal(classifyBodyOrientation(landmarks), 'left');
  });

  it('detects right profile when nose is left of shoulder mid', () => {
    const landmarks = new Array(25).fill(null).map(() => lm(0.5, 0.5, 0.1));
    landmarks[0] = lm(0.38, 0.25);
    landmarks[11] = lm(0.48, 0.35);
    landmarks[12] = lm(0.52, 0.35);
    landmarks[23] = lm(0.48, 0.7);
    landmarks[24] = lm(0.52, 0.7);
    assert.equal(classifyBodyOrientation(landmarks), 'right');
  });
});

describe('evaluatePoseGuidance', () => {
  it('requires face for front', () => {
    const r = evaluatePoseGuidance('front', { orientation: 'front', faceCount: 0 });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'no_face');
  });

  it('accepts matching left without face requirement', () => {
    const r = evaluatePoseGuidance('left', { orientation: 'left', faceCount: 0 });
    assert.equal(r.ok, true);
  });

  it('rejects wrong side for right step', () => {
    const r = evaluatePoseGuidance('right', { orientation: 'left', faceCount: 1 });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'wrong_pose');
  });
});

describe('hasUsableFace', () => {
  it('true when at least one face', () => {
    assert.equal(hasUsableFace(1), true);
    assert.equal(hasUsableFace(0), false);
  });
});
