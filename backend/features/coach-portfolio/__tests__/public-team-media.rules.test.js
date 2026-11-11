/**
 * Run: node --test backend/features/coach-portfolio/__tests__/public-team-media.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectPublicTeamMediaCandidates,
  signPublicTeamMedia,
} from '../domain/public-team-media.rules.js';

describe('public-team-media.rules', () => {
  it('maps verified health videos to What We Say and photos to What We Do', () => {
    const { sayCandidates, doCandidates } = selectPublicTeamMediaCandidates([
      {
        user: { UserId: 1, UserName: 'Priya' },
        testimonial: {
          status: 'verified',
          video_status: 'verified',
          before_image_path: '1/before.jpg',
          after_image_path: '1/after.jpg',
          health_video_path: '1/health.mp4',
        },
      },
      {
        user: { UserId: 2, UserName: 'Karthik' },
        testimonial: {
          status: 'pending',
          video_status: 'pending',
          before_image_path: '2/before.jpg',
          after_image_path: '2/after.jpg',
          health_video_path: '2/health.mp4',
        },
      },
      {
        user: { UserId: 3, UserName: 'Anitha' },
        testimonial: {
          status: 'verified',
          video_status: 'none',
          before_image_path: '3/before.jpg',
          after_image_path: '3/after.jpg',
          health_video_path: null,
        },
      },
    ]);

    assert.equal(sayCandidates.length, 1);
    assert.equal(sayCandidates[0].memberName, 'Priya');
    assert.equal(doCandidates.length, 2);
    assert.deepEqual(doCandidates.map((d) => d.memberName).sort(), ['Anitha', 'Priya']);
  });

  it('signs selected candidates into public media lists', async () => {
    const media = await signPublicTeamMedia({
      sayCandidates: [{ userId: 1, memberName: 'Priya', healthVideoPath: '1/health.mp4' }],
      doCandidates: [{
        userId: 1,
        memberName: 'Priya',
        beforeImagePath: '1/before.jpg',
        afterImagePath: '1/after.jpg',
        beforeWeightKg: 70,
        afterWeightKg: 65,
        durationText: '90 days',
      }],
    }, {
      signVideo: async (p) => `https://cdn.example/${p}`,
      signImage: async (p) => `https://cdn.example/${p}`,
    });

    assert.equal(media.whatWeSay.length, 1);
    assert.equal(media.whatWeSay[0].healthVideoUrl, 'https://cdn.example/1/health.mp4');
    assert.equal(media.whatWeDo.length, 1);
    assert.equal(media.whatWeDo[0].beforeImageUrl, 'https://cdn.example/1/before.jpg');
  });
});
