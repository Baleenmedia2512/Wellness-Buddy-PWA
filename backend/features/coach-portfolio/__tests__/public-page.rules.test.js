/**
 * Run: node --test backend/features/coach-portfolio/__tests__/public-page.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canShowPublicPortfolio,
  toPublicPortfolioPage,
} from '../domain/public-page.rules.js';
import { DEFAULT_PORTFOLIO_OFFERINGS } from '../domain/default-offerings.rules.js';
import { SUBMISSION_STATUS } from '../domain/submission.rules.js';

describe('coach-portfolio public-page.rules', () => {
  it('shows only published approved-or-later statuses', () => {
    assert.equal(canShowPublicPortfolio({
      isPublished: true,
      status: SUBMISSION_STATUS.APPROVED,
    }), true);
    assert.equal(canShowPublicPortfolio({
      isPublished: true,
      status: SUBMISSION_STATUS.COMPLETED,
    }), true);
    assert.equal(canShowPublicPortfolio({
      isPublished: false,
      status: SUBMISSION_STATUS.APPROVED,
    }), false);
    assert.equal(canShowPublicPortfolio({
      isPublished: true,
      status: SUBMISSION_STATUS.NEW,
    }), false);
  });

  it('maps form into a safe public page view-model', () => {
    const page = toPublicPortfolioPage({
      publicSlug: 'priya-sharma-coimbatore',
      userName: 'Priya',
      formJson: {
        personal: {
          fullName: 'Priya Sharma',
          professionalTitle: 'Wellness Coach',
          background: '10 years coaching',
          languages: ['English', 'Other'],
          languagesOther: 'Tamil',
        },
        center: {
          centerName: 'Valley Center',
          city: 'Coimbatore',
          locality: 'RS Puram',
          businessPhone: '9876543210',
          whatsapp: '9876543210',
        },
        services: {
          offerings: ['Weight management', 'Other'],
          offeringsOther: 'Habit coaching',
        },
        mediaBrand: {
          websiteDisplayName: 'Coach Priya',
        },
        goalsConsent: {
          highlight: 'Sustainable daily habits',
        },
      },
    });

    assert.equal(page.slug, 'priya-sharma-coimbatore');
    // Live app UserName wins over FormJson display / full name.
    assert.equal(page.displayName, 'Priya');
    assert.equal(page.fullName, 'Priya');
    assert.equal(page.city, 'Coimbatore');
    assert.deepEqual(page.languages, ['English', 'Tamil']);
    assert.deepEqual(page.offerings, [...DEFAULT_PORTFOLIO_OFFERINGS]);
    assert.equal(page.offerings.length, 6);
    assert.equal(page.offeringCards?.[0]?.label, 'Family Healthy Breakfast Programme');
    assert.equal(page.offeringCards?.[0]?.emoji, '🥗');
    assert.equal(page.whatsapp, '9876543210');
    assert.match(page.seoTitle, /Priya/);
    assert.match(page.seoTitle, /Coimbatore/);
    assert.ok(page.seoDescription.length <= 160);
    assert.deepEqual(page.testimonials, []);
  });

  it('maps transformations and real reviews separately', () => {
    const page = toPublicPortfolioPage({
      publicSlug: 'a-b',
      formJson: {
        personal: { fullName: 'A' },
        mediaBrand: {
          websiteDisplayName: 'A',
          transformations: [
            { label: '90 days', beforePhotoUrl: '/before.jpg', afterPhotoUrl: '/after.jpg' },
          ],
          testimonials: [
            { name: 'Riya', quote: 'Great coaching with clear habits.', rating: 4 },
            { name: 'OnlyName', quote: '' },
          ],
        },
      },
    });
    assert.equal(page.transformations.length, 1);
    assert.equal(page.transformations[0].beforePhotoUrl, '/before.jpg');
    assert.equal(page.testimonials.length, 1);
    assert.equal(page.testimonials[0].name, 'Riya');
    assert.match(page.testimonials[0].quote, /Great coaching/);
    assert.equal(page.testimonials[0].rating, 4);
  });

  it('uses Other professional title text when selected', () => {
    const page = toPublicPortfolioPage({
      publicSlug: 'a-b',
      formJson: {
        personal: {
          fullName: 'A',
          professionalTitle: 'Other',
          professionalTitleOther: 'Lifestyle Mentor',
        },
        mediaBrand: { websiteDisplayName: 'A' },
      },
    });
    assert.equal(page.title, 'Lifestyle Mentor');
  });

  it('hides legacy AM/PM hours that were never set via the time picker', () => {
    const page = toPublicPortfolioPage({
      publicSlug: 'a-b',
      formJson: {
        personal: { fullName: 'A' },
        mediaBrand: { websiteDisplayName: 'A' },
        timings: { openingTime: '07:00 AM', closingTime: '07:00 PM' },
      },
    });
    assert.equal(page.openingTime, '');
    assert.equal(page.closingTime, '');
  });

  it('formats coach-filled HH:mm hours for the public contact block', () => {
    const page = toPublicPortfolioPage({
      publicSlug: 'a-b',
      formJson: {
        personal: { fullName: 'A' },
        mediaBrand: { websiteDisplayName: 'A' },
        timings: { openingTime: '07:00', closingTime: '19:00' },
      },
    });
    assert.equal(page.openingTime, '07:00 AM');
    assert.equal(page.closingTime, '07:00 PM');
  });
});
