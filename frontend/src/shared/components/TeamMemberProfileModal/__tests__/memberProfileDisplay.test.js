/**
 * Run: node --test frontend/src/shared/components/TeamMemberProfileModal/__tests__/memberProfileDisplay.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityLevelLabel,
  formatCalorieTarget,
  formatMetricValue,
  healthIssueLabels,
  mediaImageSrc,
  transformationPhotoSrc,
  workingCentreName,
} from '../memberProfileDisplay.js';

describe('member profile display', () => {
  it('keeps displayable transformation photo urls and drops empty slots', () => {
    const photos = {
      front: 'https://cdn.example/front.jpg',
      left: 'data:image/jpeg;base64,abc',
      right: '   ',
    };
    assert.equal(transformationPhotoSrc(photos, 'front'), 'https://cdn.example/front.jpg');
    assert.equal(transformationPhotoSrc(photos, 'left'), 'data:image/jpeg;base64,abc');
    assert.equal(transformationPhotoSrc(photos, 'right'), '');
    assert.equal(transformationPhotoSrc(null, 'front'), '');
    assert.equal(
      transformationPhotoSrc(
        { front: '/api/media/transformation/279/front/a.jpg' },
        'front',
        'http://localhost:3000/',
      ),
      'http://localhost:3000/api/media/transformation/279/front/a.jpg',
    );
    assert.equal(
      mediaImageSrc('/api/media/avatars/279/a.jpg', 'http://localhost:3000'),
      'http://localhost:3000/api/media/avatars/279/a.jpg',
    );
    assert.equal(mediaImageSrc(''), '');
  });

  it('labels activity, centre, health issues, metrics, and calories', () => {
    assert.equal(activityLevelLabel('light_active'), 'Light Active');
    assert.equal(activityLevelLabel(''), '');
    assert.equal(workingCentreName({ name: 'RS Club' }), 'RS Club');
    assert.equal(workingCentreName({ id: 2, options: [{ id: 2, name: 'Valley' }] }), 'Valley');
    assert.deepEqual(healthIssueLabels([' Back Pain ', '', 'BP']), ['Back Pain', 'BP']);
    assert.equal(formatMetricValue('fatPercent', 22.5), '22.5%');
    assert.equal(formatMetricValue('waistCm', 80), '80 cm');
    assert.equal(formatMetricValue('age', 34.2), '34');
    assert.equal(formatCalorieTarget(2100.4), '2100 kcal / day');
    assert.equal(formatCalorieTarget(null), '');
  });
});
