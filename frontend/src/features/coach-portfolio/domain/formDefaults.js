import { DEFAULT_PORTFOLIO_OFFERINGS } from './formOptions.js';

export function emptyPortfolioForm() {
  return {
    personal: {
      fullName: '',
      professionalTitle: '',
      professionalTitleOther: '',
      yearsExperience: '',
      background: '',
      qualifications: '',
      languages: [],
      languagesOther: '',
      uniqueApproach: '',
      profilePhoto: null,
    },
    center: {
      centerName: '',
      operational: '',
      expectedOpeningDate: '',
      address: '',
      locality: '',
      city: '',
      state: '',
      pincode: '',
      mapsLink: '',
      landmark: '',
      businessPhone: '',
      whatsapp: '',
      businessEmail: '',
      hasGoogleBusiness: '',
      googleBusinessLink: '',
    },
    timings: {
      workingDays: [],
      openingTime: '',
      closingTime: '',
      weeklyHoliday: '',
      weekendAppointments: '',
      advanceBookingRequired: '',
    },
    services: {
      offerings: [...DEFAULT_PORTFOLIO_OFFERINGS],
      offeringsOther: '',
      description: '',
      sessionTypes: [],
      needsAppointment: '',
      onlineConsultation: '',
      chargesFees: '',
      feeDetails: '',
      targetCustomers: [],
      targetCustomersOther: '',
      customerGoals: '',
      serviceAreas: '',
    },
    mediaBrand: {
      entrancePhoto: null,
      interiorPhotos: [],
      nameBoardPhoto: null,
      activityPhotos: [],
      introVideos: [],
      introVideoLink: '',
      introVideoKey: null,
      introVideoUrl: null,
      hasTestimonialsPermission: '',
      transformations: [],
      testimonials: [],
      websiteDisplayName: '',
      hasLogo: '',
      logo: null,
      preferredColors: [],
      preferredColorsOther: '',
      referenceWebsite: '',
      websiteLanguages: [],
      websiteLanguagesOther: '',
      social: {
        instagram: '',
        facebook: '',
        youtube: '',
        linkedin: '',
        existingWebsite: '',
      },
    },
    goalsConsent: {
      websiteGoals: [],
      requiredFeatures: [],
      preferredActions: [],
      highlight: '',
      additionalRequirements: '',
      accuracyConfirmed: false,
      publishAuthorized: '',
    },
  };
}

/** Profile-hydrated About fields required before Publish. */
export function validateAboutForm(form) {
  const errors = [];
  const personal = form?.personal || {};
  if (!String(personal.yearsExperience || '').trim()) {
    errors.push('Set Date of joining Herbalife in Profile');
  }
  if (!String(personal.background || '').trim()) {
    errors.push('Complete About me in Profile');
  }
  if (!Array.isArray(personal.languages) || personal.languages.length === 0) {
    errors.push('Select Languages in Profile');
  }
  if (!String(personal.professionalTitle || '').trim()) {
    errors.push('Complete Professional title in Profile');
  }
  return errors;
}

/** Strict HH:mm for time inputs — drop legacy "07:00 AM" style strings. */
function normalizeClockTime(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(text);
  if (!match) return '';
  return `${match[1]}:${match[2]}`;
}

/**
 * @param {object|null|undefined} raw
 * @param {object|null|undefined} [patch] optional deep section overrides (2nd arg was previously ignored — bug)
 */
export function mergePortfolioForm(raw, patch = null) {
  const base = emptyPortfolioForm();
  const primary = raw && typeof raw === 'object' ? raw : {};
  const overlay = patch && typeof patch === 'object' ? patch : {};
  const mergedServices = {
    ...base.services,
    ...(primary.services || {}),
    ...(overlay.services || {}),
  };
  const rawOfferings = Array.isArray(overlay.services?.offerings)
    ? overlay.services.offerings.filter((x) => String(x || '').trim())
    : Array.isArray(primary.services?.offerings)
      ? primary.services.offerings.filter((x) => String(x || '').trim())
      : [];
  mergedServices.offerings = rawOfferings.length
    ? rawOfferings
    : [...DEFAULT_PORTFOLIO_OFFERINGS];
  const timingsIn = {
    ...base.timings,
    ...(primary.timings || {}),
    ...(overlay.timings || {}),
  };
  const mediaPrimary = primary.mediaBrand || {};
  const mediaOverlay = overlay.mediaBrand || {};

  return {
    personal: { ...base.personal, ...(primary.personal || {}), ...(overlay.personal || {}) },
    center: { ...base.center, ...(primary.center || {}), ...(overlay.center || {}) },
    timings: {
      ...timingsIn,
      openingTime: normalizeClockTime(timingsIn.openingTime),
      closingTime: normalizeClockTime(timingsIn.closingTime),
    },
    services: mergedServices,
    mediaBrand: {
      ...base.mediaBrand,
      ...mediaPrimary,
      ...mediaOverlay,
      interiorPhotos: Array.isArray(mediaOverlay.interiorPhotos)
        ? mediaOverlay.interiorPhotos.filter(Boolean)
        : Array.isArray(mediaPrimary.interiorPhotos)
          ? mediaPrimary.interiorPhotos.filter(Boolean)
          : [],
      activityPhotos: Array.isArray(mediaOverlay.activityPhotos)
        ? mediaOverlay.activityPhotos.filter(Boolean)
        : Array.isArray(mediaPrimary.activityPhotos)
          ? mediaPrimary.activityPhotos.filter(Boolean)
          : [],
      introVideos: (() => {
        const listed = Array.isArray(mediaOverlay.introVideos)
          ? mediaOverlay.introVideos.filter(Boolean).map((u) => String(u))
          : Array.isArray(mediaPrimary.introVideos)
            ? mediaPrimary.introVideos.filter(Boolean).map((u) => String(u))
            : [];
        if (listed.length) return listed;
        const legacy = String(
          mediaOverlay.introVideoUrl
          || mediaOverlay.introVideoLink
          || mediaPrimary.introVideoUrl
          || mediaPrimary.introVideoLink
          || '',
        ).trim();
        return legacy ? [legacy] : [];
      })(),
      introVideoUrl: (() => {
        const listed = Array.isArray(mediaOverlay.introVideos)
          ? mediaOverlay.introVideos.filter(Boolean).map((u) => String(u))
          : Array.isArray(mediaPrimary.introVideos)
            ? mediaPrimary.introVideos.filter(Boolean).map((u) => String(u))
            : [];
        if (listed.length) return listed[0];
        return mediaOverlay.introVideoUrl || mediaPrimary.introVideoUrl || null;
      })(),
      introVideoLink: (() => {
        const listed = Array.isArray(mediaOverlay.introVideos)
          ? mediaOverlay.introVideos.filter(Boolean).map((u) => String(u))
          : Array.isArray(mediaPrimary.introVideos)
            ? mediaPrimary.introVideos.filter(Boolean).map((u) => String(u))
            : [];
        if (listed.length) return listed[0];
        return String(
          mediaOverlay.introVideoLink
          || mediaOverlay.introVideoUrl
          || mediaPrimary.introVideoLink
          || mediaPrimary.introVideoUrl
          || '',
        ).trim();
      })(),
      transformations: Array.isArray(mediaOverlay.transformations)
        ? mediaOverlay.transformations.slice(0, 6).map((t) => ({
          label: String(t?.label || t?.name || ''),
          beforePhotoUrl: t?.beforePhotoUrl ?? null,
          afterPhotoUrl: t?.afterPhotoUrl ?? null,
        }))
        : Array.isArray(mediaPrimary.transformations)
          ? mediaPrimary.transformations.slice(0, 6).map((t) => ({
            label: String(t?.label || t?.name || ''),
            beforePhotoUrl: t?.beforePhotoUrl ?? null,
            afterPhotoUrl: t?.afterPhotoUrl ?? null,
          }))
          : [],
      testimonials: Array.isArray(mediaOverlay.testimonials)
        ? mediaOverlay.testimonials.slice(0, 6).map((t) => {
          const n = Number(t?.rating);
          const rating = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 5;
          return {
            name: String(t?.name || ''),
            quote: String(t?.quote || ''),
            rating,
          };
        })
        : Array.isArray(mediaPrimary.testimonials)
          ? mediaPrimary.testimonials.slice(0, 6).map((t) => {
            const n = Number(t?.rating);
            const rating = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 5;
            return {
              name: String(t?.name || ''),
              quote: String(t?.quote || ''),
              rating,
            };
          })
          : [],
      social: {
        ...base.mediaBrand.social,
        ...(mediaPrimary.social || {}),
        ...(mediaOverlay.social || {}),
      },
    },
    goalsConsent: {
      ...base.goalsConsent,
      ...(primary.goalsConsent || {}),
      ...(overlay.goalsConsent || {}),
    },
  };
}
