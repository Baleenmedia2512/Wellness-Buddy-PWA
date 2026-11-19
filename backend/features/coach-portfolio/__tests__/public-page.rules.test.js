/**
 * Run: node --test backend/features/coach-portfolio/__tests__/public-page.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoachPageFaqs,
  buildCoachPageJsonLd,
  buildCoachPageSeo,
  buildCoachVisibleHeading,
  buildGoogleMapsSearchUrl,
  canShowPublicPortfolio,
  mapsEmbedSrcFromLink,
  toPublicPortfolioPage,
} from '../domain/public-page.rules.js';
import { DEFAULT_PORTFOLIO_OFFERINGS } from '../domain/default-offerings.rules.js';
import { SUBMISSION_STATUS } from '../domain/submission.rules.js';

describe('coach-portfolio public-page.rules', () => {
  it('builds freestyle Google Maps search URL from City / Area', () => {
    const url = buildGoogleMapsSearchUrl({
      locality: 'Vadapalani',
      city: 'Chennai',
    });
    assert.match(url, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    assert.match(url, /Vadapalani/);
    assert.match(url, /Chennai/);
    assert.equal(buildGoogleMapsSearchUrl({}), '');
    const embed = mapsEmbedSrcFromLink(url);
    assert.match(embed, /maps\.google\.com\/maps\?q=/);
    assert.match(embed, /output=embed/);
  });

  it('embeds club GPS maps links from q=lat,lng', () => {
    const embed = mapsEmbedSrcFromLink('https://maps.google.com/?q=13.05,80.21');
    assert.equal(
      embed,
      'https://maps.google.com/maps?q=13.05%2C80.21&z=15&output=embed',
    );
  });

  it('builds local SEO title, description, and keywords from place', () => {
    const seo = buildCoachPageSeo({
      displayName: 'Avinash',
      title: 'Wellness Coach',
      city: 'Madurai',
      locality: 'Avaniyapuram',
      offerings: ['Family Healthy Breakfast Programme'],
    });
    assert.match(seo.seoTitle, /Avinash/);
    assert.match(seo.seoTitle, /Madurai|Avaniyapuram/);
    assert.ok(seo.seoDescription.length <= 160);
    assert.ok(seo.seoKeywords.some((k) => /Madurai/i.test(k)));
    assert.equal(
      buildCoachVisibleHeading({
        displayName: 'Avinash Kumar',
        title: 'Nutrition Coach',
        city: 'Madurai',
        locality: 'Avaniyapuram',
      }),
      'Coach Avinash',
    );
    assert.equal(
      buildCoachVisibleHeading({ displayName: 'Coach Priya', city: 'Madurai' }),
      'Coach Priya',
    );
    assert.equal(buildCoachVisibleHeading({}), 'Coach');
    const faqs = buildCoachPageFaqs({
      displayName: 'Avinash',
      city: 'Madurai',
      locality: 'Avaniyapuram',
      onlineConsultation: true,
    }, { heroName: 'Avinash', basedIn: 'Avaniyapuram, Madurai' });
    assert.ok(faqs.length >= 4);
    assert.match(faqs[0].a, /Avinash/);
    const ld = buildCoachPageJsonLd({
      fullName: 'Avinash',
      title: 'Wellness Coach',
      city: 'Madurai',
      locality: 'Avaniyapuram',
      seoDescription: seo.seoDescription,
    }, {
      pageUrl: 'https://example.com/coach/madurai/avaniyapuram/avinash',
      faqs,
    });
    assert.equal(ld['@context'], 'https://schema.org');
    assert.equal(ld['@graph'].length, 3);
    assert.equal(ld['@graph'][0]['@type'], 'Person');
    assert.equal(ld['@graph'][1]['@type'], 'ProfessionalService');
    assert.equal(ld['@graph'][2]['@type'], 'FAQPage');
    assert.equal(ld['@graph'][2].mainEntity.length, faqs.length);
  });

  it('adds LocalBusiness JSON-LD when club GPS is present', () => {
    const faqs = buildCoachPageFaqs({
      displayName: 'Priya',
      centerName: 'Valley Center',
      city: 'Chennai',
      locality: 'Vadapalani',
    });
    const ld = buildCoachPageJsonLd({
      fullName: 'Priya',
      displayName: 'Priya',
      title: 'Wellness Coach',
      centerName: 'Valley Center',
      city: 'Chennai',
      locality: 'Vadapalani',
      phone: '9876543210',
      seoDescription: 'Priya — Wellness Coach in Vadapalani, Chennai.',
      geoLatitude: 13.05,
      geoLongitude: 80.21,
    }, {
      pageUrl: 'https://example.com/coach/chennai/vadapalani/priya',
      faqs,
      hasClub: true,
    });
    const types = ld['@graph'].map((n) => n['@type']);
    assert.deepEqual(types, ['Person', 'ProfessionalService', 'FAQPage', 'LocalBusiness']);
    const local = ld['@graph'].find((n) => n['@type'] === 'LocalBusiness');
    assert.equal(local.name, 'Valley Center');
    assert.equal(local.geo.latitude, 13.05);
    assert.equal(local.geo.longitude, 80.21);
  });

  it('skips LocalBusiness JSON-LD without club GPS', () => {
    const ld = buildCoachPageJsonLd({
      fullName: 'Ravi',
      city: 'Salem',
      locality: 'Hasthampatti',
      seoDescription: 'Ravi coach',
    }, {
      pageUrl: 'https://example.com/coach/salem/hasthampatti/ravi',
      hasClub: false,
    });
    assert.ok(!ld['@graph'].some((n) => n['@type'] === 'LocalBusiness'));
    assert.ok(ld['@graph'].some((n) => n['@type'] === 'FAQPage'));
  });

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
    assert.match(page.seoDescription, /wellness/i);
    assert.ok(Array.isArray(page.seoKeywords));
    assert.ok(page.seoKeywords.some((k) => /Coimbatore/i.test(k)));
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
