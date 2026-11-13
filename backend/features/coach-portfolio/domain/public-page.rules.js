/**
 * Safe public view-model for the coach portfolio website template.
 * Never exposes admin notes or unpaid drafts.
 */
import { DEFAULT_PORTFOLIO_OFFERINGS } from './default-offerings.rules.js';
import { offeringsWithEmoji } from './offering-emoji.rules.js';
import { shortPublicText } from './public-copy.rules.js';
import {
  formatClockTimeLabel,
  normalizeFormJson,
  normalizeReviewRating,
  resolveLiveFormJson,
  SUBMISSION_STATUS,
} from './submission.rules.js';

export const PUBLIC_VISIBLE_STATUSES = new Set([
  SUBMISSION_STATUS.APPROVED,
  SUBMISSION_STATUS.WEBSITE_IN_PROGRESS,
  SUBMISSION_STATUS.COMPLETED,
]);

export function canShowPublicPortfolio({ isPublished, status }) {
  if (!isPublished) return false;
  return PUBLIC_VISIBLE_STATUSES.has(String(status || ''));
}

function pickOther(list, otherText) {
  const items = Array.isArray(list) ? [...list] : [];
  if (items.includes('Other') && String(otherText || '').trim()) {
    return items.map((v) => (v === 'Other' ? String(otherText).trim() : v));
  }
  return items;
}

/**
 * Freestyle (no club GPS) maps link from City / Area typed on the form.
 * Club GPS links stay as `https://maps.google.com/?q=lat,lng`.
 *
 * @param {{ locality?: string, city?: string, address?: string }} [place]
 * @returns {string} empty when nowhere to search
 */
export function buildGoogleMapsSearchUrl({ locality = '', city = '', address = '' } = {}) {
  const area = String(locality || '').trim();
  const cityLabel = String(city || '').trim();
  const parts = [];
  if (area) parts.push(area);
  if (cityLabel && cityLabel.toLowerCase() !== area.toLowerCase()) parts.push(cityLabel);
  let query = parts.join(', ');
  if (!query) query = String(address || '').trim();
  if (!query) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Embed + directions share the same query (GPS lat,lng or place name).
 * @param {string|null|undefined} mapsLink
 * @returns {string|null}
 */
export function mapsEmbedSrcFromLink(mapsLink) {
  const link = String(mapsLink || '').trim();
  if (!link) return null;
  try {
    const u = new URL(link);
    const q = u.searchParams.get('q') || u.searchParams.get('query');
    if (!q || !String(q).trim()) return null;
    return `https://maps.google.com/maps?q=${encodeURIComponent(String(q).trim())}&z=15&output=embed`;
  } catch {
    return null;
  }
}

/** Shared wellness phrases — woven into meta, not dumped as spam. */
export const COACH_SEO_CORE_PHRASES = Object.freeze([
  'Wellness Coach',
  'nutrition coach',
  'nutrition center',
  'weight management',
  'healthy lifestyle',
]);

/**
 * Build title / description / keyword list for one coach public page.
 * City + area come from the form (portfolio place); unique per coach.
 *
 * @param {{
 *   displayName: string,
 *   title: string,
 *   city?: string,
 *   locality?: string,
 *   centerName?: string,
 *   offerings?: string[],
 * }} input
 */
export function buildCoachPageSeo({
  displayName,
  title,
  city = '',
  locality = '',
  centerName = '',
  offerings = [],
} = {}) {
  const name = String(displayName || 'Wellness Coach').trim() || 'Wellness Coach';
  const role = String(title || 'Wellness Coach').trim() || 'Wellness Coach';
  const cityLabel = String(city || '').trim();
  const areaLabel = String(locality || '').trim();
  const place = [areaLabel, cityLabel].filter(Boolean).join(', ');
  const club = String(centerName || '').trim();

  const placeSuffix = place ? ` in ${place}` : (cityLabel ? ` in ${cityLabel}` : '');
  const seoTitle = `${name} | ${role}${placeSuffix} | Wellness Valley`.slice(0, 70);

  const offeringBit = offerings[0]
    ? String(offerings[0]).trim()
    : 'nutrition and wellness coaching';
  const seoDescription = [
    `${name} — ${role}${place ? ` serving ${place}` : ''}.`,
    club ? `${club}.` : null,
    `Wellness coach and nutrition guidance${cityLabel ? ` in ${cityLabel}` : ''}.`,
    `Offering ${offeringBit}.`,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 160);

  const seoKeywords = [
    name,
    role,
    'Wellness Coach',
    'nutrition coach',
    'nutrition center',
    'Wellness Valley',
    cityLabel,
    areaLabel,
    club,
    place ? `wellness coach ${place}` : null,
    cityLabel ? `nutrition coach ${cityLabel}` : null,
    cityLabel ? `wellness coach near ${cityLabel}` : null,
  ].filter(Boolean);

  return { seoTitle, seoDescription, seoKeywords };
}

/**
 * Visible place label for H1 / copy (area + city).
 * @param {{ locality?: string, city?: string }} page
 */
export function buildCoachPlaceLabel(page = {}) {
  const locality = String(page?.locality || '').trim();
  const city = String(page?.city || '').trim();
  return [locality, city].filter(Boolean).join(', ') || city || '';
}

/**
 * Primary on-page heading: coach name + place (matches meta intent).
 * @param {{ displayName?: string, fullName?: string, locality?: string, city?: string }} page
 */
export function buildCoachVisibleHeading(page = {}) {
  const name = String(page?.displayName || page?.fullName || 'Wellness Coach').trim()
    || 'Wellness Coach';
  const place = buildCoachPlaceLabel(page);
  if (place) return `${name} — Wellness Coach in ${place}`;
  return `${name} — Wellness Coach`;
}

/**
 * FAQ copy shown on the public page (also drives FAQPage JSON-LD).
 * @param {object} page
 * @param {{ heroName?: string, basedIn?: string|null }} [opts]
 * @returns {{ q: string, a: string }[]}
 */
export function buildCoachPageFaqs(page = {}, { heroName = '', basedIn = null } = {}) {
  const name = String(heroName || page?.displayName || page?.fullName || 'your coach').trim()
    || 'your coach';
  const placeBit = basedIn || buildCoachPlaceLabel(page) || null;
  return [
    {
      q: 'How do I get started?',
      a: `Message ${name} on WhatsApp for a short intro chat. You will get clear next steps for your goals.`,
    },
    {
      q: 'Is coaching only in person?',
      a: page?.onlineConsultation
        ? 'Both in-person and online sessions are available — choose what fits your routine.'
        : 'Coaching is available at the wellness center. Ask on WhatsApp for timing and visit options.',
    },
    {
      q: 'Do I need a special diet plan on day one?',
      a: 'No crash plans. Guidance starts with simple daily habits you can keep.',
    },
    {
      q: 'How often will we check in?',
      a: 'Check-ins are regular and kind — enough to stay accountable without pressure.',
    },
    {
      q: 'Where is the center?',
      a: placeBit
        ? `Based in ${placeBit}${page?.centerName ? ` · ${page.centerName}` : ''}. Use Map or Get Directions for the exact location.`
        : 'Ask on WhatsApp for the center location and visit hours.',
    },
  ];
}

function cleanJsonLdNode(node) {
  const cleaned = { ...node };
  Object.keys(cleaned).forEach((k) => {
    if (cleaned[k] === undefined || cleaned[k] === '') delete cleaned[k];
  });
  return cleaned;
}

/**
 * JSON-LD graph: Person + ProfessionalService + FAQPage (+ LocalBusiness when club GPS).
 * @param {object} page toPublicPortfolioPage result (+ optional geoLatitude/geoLongitude)
 * @param {{
 *   pageUrl: string,
 *   imageUrl?: string|null,
 *   faqs?: { q: string, a: string }[],
 *   hasClub?: boolean,
 * }} opts
 */
export function buildCoachPageJsonLd(page, {
  pageUrl,
  imageUrl = null,
  faqs = null,
  hasClub = false,
} = {}) {
  const name = String(page?.fullName || page?.displayName || 'Wellness Coach').trim();
  const postalAddress = page?.city ? {
    '@type': 'PostalAddress',
    addressLocality: page.city,
    addressRegion: page.state || undefined,
    postalCode: page.pincode || undefined,
    streetAddress: page.address || page.centerName || undefined,
    addressCountry: 'IN',
  } : undefined;

  const person = {
    '@type': 'Person',
    name,
    jobTitle: page?.title || 'Wellness Coach',
    description: page?.seoDescription,
    url: pageUrl,
    image: imageUrl || undefined,
    telephone: page?.phone || undefined,
    email: page?.email || undefined,
    address: page?.city ? {
      '@type': 'PostalAddress',
      addressLocality: page.city,
      addressRegion: page.state || undefined,
      postalCode: page.pincode || undefined,
      streetAddress: page.address || undefined,
      addressCountry: 'IN',
    } : undefined,
  };
  const service = {
    '@type': 'ProfessionalService',
    name: `${name} — Wellness Coaching`,
    description: page?.seoDescription,
    url: pageUrl,
    image: imageUrl || undefined,
    telephone: page?.phone || undefined,
    areaServed: page?.city || page?.locality || undefined,
    address: postalAddress,
    priceRange: page?.feeDetails ? '₹' : undefined,
  };

  const graph = [person, service];

  const faqItems = Array.isArray(faqs) && faqs.length
    ? faqs
    : buildCoachPageFaqs(page);
  if (faqItems.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    });
  }

  const lat = Number(page?.geoLatitude);
  const lng = Number(page?.geoLongitude);
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
  if (hasClub && hasGeo) {
    const businessName = String(page?.centerName || '').trim()
      || `${name} Wellness Center`;
    graph.push({
      '@type': 'LocalBusiness',
      name: businessName,
      description: page?.seoDescription,
      url: pageUrl,
      image: imageUrl || undefined,
      telephone: page?.phone || undefined,
      email: page?.email || undefined,
      address: postalAddress,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: lat,
        longitude: lng,
      },
      priceRange: page?.feeDetails ? '₹' : undefined,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph.map(cleanJsonLdNode),
  };
}

/**
 * @param {{ formJson: object, publishedFormJson?: object|null, userName?: string|null, publicSlug: string }} row
 */
export function toPublicPortfolioPage(row) {
  // Live site uses PublishedFormJson; FormJson is the editor draft until Publish+OTP.
  const form = resolveLiveFormJson(row);
  // Live app UserName wins — same identity as the mobile app profile.
  const appName = String(row.userName || '').trim();
  const fullName = String(appName || form.personal.fullName || 'Wellness Coach').trim();
  const title = form.personal.professionalTitle === 'Other'
    ? (form.personal.professionalTitleOther || 'Professional Wellness Coach')
    : (form.personal.professionalTitle || 'Professional Wellness Coach');
  const city = String(form.center.city || '').trim();
  const locality = String(form.center.locality || '').trim();
  const displayName = String(appName || form.mediaBrand.websiteDisplayName || fullName).trim();

  const languages = pickOther(form.personal.languages, form.personal.languagesOther);
  // Website always shows the 6 Wellness University programs (form no longer edits these).
  const offerings = [...DEFAULT_PORTFOLIO_OFFERINGS];
  const targets = pickOther(form.services.targetCustomers, form.services.targetCustomersOther);
  const colors = pickOther(form.mediaBrand.preferredColors, form.mediaBrand.preferredColorsOther);

  const whatsapp = String(form.center.whatsapp || form.center.businessPhone || '').replace(/\D/g, '');
  const phone = String(form.center.businessPhone || '').trim();

  const transformations = (form.mediaBrand.transformations || [])
    .filter((t) => t && (t.beforePhotoUrl || t.afterPhotoUrl))
    .map((t) => ({
      label: t.label || '',
      beforePhotoUrl: t.beforePhotoUrl || null,
      afterPhotoUrl: t.afterPhotoUrl || null,
    }));

  const testimonials = (form.mediaBrand.testimonials || [])
    .filter((t) => t && String(t.quote || '').trim() && String(t.name || '').trim())
    .map((t) => ({
      name: t.name,
      quote: shortPublicText(t.quote, 160),
      rating: normalizeReviewRating(t.rating),
    }));

  return {
    slug: row.publicSlug,
    displayName,
    fullName,
    title,
    yearsExperience: form.personal.yearsExperience || '',
    background: shortPublicText(form.personal.background, 360),
    qualifications: shortPublicText(form.personal.qualifications, 140),
    uniqueApproach: shortPublicText(form.personal.uniqueApproach, 360),
    languages,
    profilePhoto: form.personal.profilePhoto || null,
    centerName: form.center.centerName || '',
    address: form.center.address || '',
    locality,
    city,
    state: form.center.state || '',
    pincode: form.center.pincode || '',
    mapsLink: form.center.mapsLink || '',
    landmark: form.center.landmark || '',
    phone,
    whatsapp,
    email: form.center.businessEmail || '',
    workingDays: form.timings.workingDays || [],
    // Labels only when coach saved real HH:mm via the Hours step (not legacy text).
    openingTime: formatClockTimeLabel(form.timings.openingTime),
    closingTime: formatClockTimeLabel(form.timings.closingTime),
    weeklyHoliday: form.timings.weeklyHoliday || '',
    offerings,
    offeringCards: offeringsWithEmoji(offerings),
    servicesDescription: shortPublicText(form.services.description, 180),
    sessionTypes: form.services.sessionTypes || [],
    onlineConsultation: form.services.onlineConsultation === 'yes',
    feeDetails: form.services.chargesFees === 'yes'
      ? shortPublicText(form.services.feeDetails, 100)
      : '',
    targets,
    customerGoals: shortPublicText(form.services.customerGoals, 140),
    serviceAreas: shortPublicText(form.services.serviceAreas, 100),
    entrancePhoto: form.mediaBrand.entrancePhoto || null,
    interiorPhotos: (form.mediaBrand.interiorPhotos || []).filter(Boolean),
    nameBoardPhoto: form.mediaBrand.nameBoardPhoto || null,
    activityPhotos: (form.mediaBrand.activityPhotos || []).filter(Boolean),
    introVideos: (() => {
      const listed = Array.isArray(form.mediaBrand.introVideos)
        ? form.mediaBrand.introVideos.filter(Boolean).map((u) => String(u))
        : [];
      if (listed.length) return listed;
      const legacy = String(
        form.mediaBrand.introVideoUrl || form.mediaBrand.introVideoLink || '',
      ).trim();
      return legacy ? [legacy] : [];
    })(),
    introVideoUrl: (() => {
      const listed = Array.isArray(form.mediaBrand.introVideos)
        ? form.mediaBrand.introVideos.filter(Boolean).map((u) => String(u))
        : [];
      if (listed.length) return listed[0];
      return form.mediaBrand.introVideoUrl || form.mediaBrand.introVideoLink || null;
    })(),
    logo: form.mediaBrand.logo || null,
    transformations,
    testimonials,
    preferredColors: colors,
    websiteLanguages: pickOther(form.mediaBrand.websiteLanguages, form.mediaBrand.websiteLanguagesOther),
    social: form.mediaBrand.social || {},
    websiteGoals: form.goalsConsent.websiteGoals || [],
    preferredActions: form.goalsConsent.preferredActions || [],
    highlight: shortPublicText(form.goalsConsent.highlight, 140),
    ...buildCoachPageSeo({
      displayName,
      title,
      city,
      locality,
      centerName: form.center.centerName || '',
      offerings,
    }),
  };
}
