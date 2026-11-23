/**
 * Run: node --test backend/features/coach-portfolio/__tests__/applyLiveProfileToPublicPage.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyLiveProfileToPublicPage } from '../domain/applyLiveProfileToPublicPage.js';

describe('applyLiveProfileToPublicPage', () => {
  it('overlays live title and about from profile intro', () => {
    const page = {
      title: 'Form Title',
      background: 'Form about text',
    };
    applyLiveProfileToPublicPage(page, {
      professionalTitle: 'Wellness Coach',
      aboutMe: 'I help members build daily habits.',
    });
    assert.equal(page.title, 'Wellness Coach');
    assert.match(page.background, /daily habits/);
  });

  it('leaves page unchanged when intro is empty', () => {
    const page = { title: 'Keep', background: 'Keep about' };
    applyLiveProfileToPublicPage(page, null);
    applyLiveProfileToPublicPage(page, { professionalTitle: '', aboutMe: '' });
    assert.equal(page.title, 'Keep');
    assert.equal(page.background, 'Keep about');
  });
});
