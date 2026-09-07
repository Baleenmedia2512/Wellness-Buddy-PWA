/**
 * Run: node --test frontend/src/features/user/domain/transformationPoseGuide.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_POSE_SLOT,
  POSE_SLOT_KEYS,
  POSE_TAB_GUIDE,
  allTransformationSlotsFilled,
  nextEmptyTransformationSlot,
  poseFacesScreenRight,
} from './transformationPoseGuide.js';

describe('transformation pose tabs', () => {
  it('orders tabs Left, Centre, Right', () => {
    assert.deepEqual([...POSE_SLOT_KEYS], ['left', 'front', 'right']);
    assert.equal(POSE_TAB_GUIDE.left.label, 'Left');
    assert.equal(POSE_TAB_GUIDE.front.label, 'Centre');
    assert.equal(POSE_TAB_GUIDE.right.label, 'Right');
    assert.equal(DEFAULT_POSE_SLOT, 'left');
  });

  it('faces left-tab toward screen-left and right-tab toward screen-right', () => {
    assert.equal(poseFacesScreenRight('left'), false);
    assert.equal(poseFacesScreenRight('right'), true);
    assert.equal(poseFacesScreenRight('front'), false);
  });

  it('treats missing previews as empty', () => {
    assert.equal(allTransformationSlotsFilled(), false);
    assert.equal(allTransformationSlotsFilled({}), false);
    assert.equal(allTransformationSlotsFilled({ left: 'x', front: 'y' }), false);
    assert.equal(allTransformationSlotsFilled({ left: 'x', front: 'y', right: 'z' }), true);
  });

  it('walks empty slots Left → Centre → Right', () => {
    assert.equal(nextEmptyTransformationSlot({}, 'left'), 'front');
    assert.equal(nextEmptyTransformationSlot({ left: 'x' }, 'left'), 'front');
    assert.equal(nextEmptyTransformationSlot({ left: 'x', front: 'y' }, 'front'), 'right');
    assert.equal(nextEmptyTransformationSlot({ left: 'x', front: 'y', right: 'z' }, 'right'), null);
  });
});
