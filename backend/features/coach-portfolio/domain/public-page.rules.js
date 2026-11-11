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
 * @param {{ formJson: object, userName?: string|null, publicSlug: string }} row
 */
export function toPublicPortfolioPage(row) {
  const form = normalizeFormJson(row.formJson);
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
    seoTitle: `${displayName} | ${title}${city ? ` in ${city}` : ''} | Wellness Valley`,
    seoDescription: [
      `${displayName} — ${title}`,
      city ? `serving ${locality ? `${locality}, ` : ''}${city}` : null,
      offerings[0] ? `Offering ${offerings[0]}` : 'Professional wellness coaching',
    ].filter(Boolean).join('. ').slice(0, 160),
  };
}
