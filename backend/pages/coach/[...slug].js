/**
 * Public coach portfolio website.
 * URL: /coach/<city>/<area>/<website-display-name>
 * Legacy: /coach/<city>/<name-area>
 * Example: /coach/chennai/adyar/priya-wellness
 *
 * Catch-all route so Next.js can serve city/area/name without conflicting
 * with a single-segment [slug] page.
 *
 * One-page template modules (FormJson → UI):
 *   Hero: profilePhoto, name, place, WhatsApp/Call/Map
 *   About: short coach background
 *   Programs: services.offerings (+ emoji)
 *   Photos: album cards → dark masonry gallery → lightbox prev/next
 *   What We Say: verified downline health videos (Team Transformation, cached)
 *   What We Do: verified downline before/after photos (Team Transformation, cached)
 *   Center strip + FAQ/Contact
 *
 * Editorial forest-green + cream paper. No Herbalife branding. No medical claims.
 */
import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { getPrisma } from '../../shared/lib/prisma.js';
import * as submissionRepo from '../../features/coach-portfolio/data/submission.repo.js';
import {
  buildCoachPageFaqs,
  buildCoachPageJsonLd,
  buildCoachPageSeo,
  buildCoachVisibleHeading,
  buildGoogleMapsSearchUrl,
  canShowPublicPortfolio,
  mapsEmbedSrcFromLink,
  toPublicPortfolioPage,
} from '../../features/coach-portfolio/domain/public-page.rules.js';
import { isValidCoachSlug } from '../../features/coach-portfolio/domain/slug.rules.js';
import { getPublicTeamMediaForCoach } from '../../features/coach-portfolio/api/public-team-media.service.js';
import { emptyPublicTeamMedia } from '../../features/coach-portfolio/domain/public-team-media.rules.js';
import {
  getAppPortfolioHeroPhotoUrl,
  getAppWorkingClubForPortfolio,
} from '../../features/coach-portfolio/api/hydrate-from-app.service.js';
import { fetchCityVillage } from '../../shared/lib/reverseGeocode.js';

function absoluteUrl(baseUrl, maybeUrl) {
  if (!maybeUrl) return null;
  if (/^https?:\/\//i.test(maybeUrl) || maybeUrl.startsWith('data:')) return maybeUrl;
  if (maybeUrl.startsWith('/')) return `${baseUrl}${maybeUrl}`;
  return maybeUrl;
}

function whatsappHref(digits) {
  const raw = String(digits || '').replace(/\D/g, '');
  if (!raw) return null;
  // India 10-digit mobile → add country code for wa.me
  const intl = raw.length === 10 ? `91${raw}` : raw;
  return `https://wa.me/${intl}`;
}

function telHref(phone) {
  if (!phone) return null;
  return `tel:${String(phone).replace(/[^\d+]/g, '')}`;
}

function firstName(displayName) {
  const parts = String(displayName || '').trim().split(/\s+/);
  return parts[0] || displayName || 'Coach';
}

function nameInitials(displayName) {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'W';
  const a = parts[0][0] || '';
  const b = (parts[1] || parts[0])[0] || '';
  return `${a}${b}`.toUpperCase();
}

export async function getServerSideProps({ params, req }) {
  const parts = Array.isArray(params?.slug)
    ? params.slug.map((p) => String(p || '').trim().toLowerCase()).filter(Boolean)
    : String(params?.slug || '').trim().toLowerCase().split('/').filter(Boolean);

  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const baseUrl = `${proto}://${host}`;

  if (!isEnabled('ff.coach-portfolio') || parts.length === 0) {
    return { notFound: true };
  }

  // Legacy single segment → redirect to stored /coach/... path when possible
  if (parts.length === 1) {
    const leaf = parts[0];
    if (!isValidCoachSlug(leaf)) return { notFound: true };
    try {
      await submissionRepo.findSubmissionByUserId(0);
      const rows = await getPrisma().$queryRawUnsafe(
        `SELECT PublicSlug AS publicSlug
         FROM coach_portfolio_submissions_table
         WHERE IsPublished = 1 AND PublicSlug LIKE ?
         ORDER BY UpdatedAt DESC
         LIMIT 1`,
        `%/${leaf}`,
      );
      const publicSlug = Array.isArray(rows) && rows[0]?.publicSlug
        ? String(rows[0].publicSlug)
        : null;
      if (publicSlug && publicSlug.includes('/')) {
        return {
          redirect: {
            destination: `/coach/${publicSlug}`,
            permanent: false,
          },
        };
      }
    } catch {
      return { notFound: true };
    }
    return { notFound: true };
  }

  // v2: city/area/display-name · v1 legacy: city/name-area
  if (
    (parts.length !== 2 && parts.length !== 3)
    || !parts.every((p) => isValidCoachSlug(p))
  ) {
    return { notFound: true };
  }

  let row = null;
  try {
    row = await submissionRepo.findPublishedBySlugParts(parts);
  } catch {
    return { notFound: true };
  }

  if (!row || !canShowPublicPortfolio(row)) {
    return { notFound: true };
  }

  const page = toPublicPortfolioPage(row);
  const pathSlug = page.slug || parts.join('/');
  let teamMedia = emptyPublicTeamMedia();
  try {
    teamMedia = await getPublicTeamMediaForCoach(row.userId);
    // Random front order per request (SSR-stable for hydration).
    teamMedia = {
      ...teamMedia,
      whatWeSay: shuffleCopy(teamMedia.whatWeSay),
      whatWeDo: shuffleCopy(teamMedia.whatWeDo),
    };
  } catch {
    teamMedia = emptyPublicTeamMedia();
  }
  // Prefer a sharp live face for the hero (Google HD when available).
  try {
    const appPhoto = await getAppPortfolioHeroPhotoUrl(row.userId);
    if (appPhoto) page.profilePhoto = appPhoto;
  } catch {
    /* keep FormJson photo if profile lookup fails */
  }

  // Map: club GPS when owned center exists; else City/Area Google Maps search (freestyle).
  let hasClub = false;
  page.geoLatitude = null;
  page.geoLongitude = null;
  try {
    const club = await getAppWorkingClubForPortfolio(row.userId);
    hasClub = Boolean(club?.hasClub);
    if (hasClub) {
      page.centerName = club.centerName || '';
      page.mapsLink = club.mapsLink || '';
      // Clear form locality/city so hero never shows e.g. slug "RS Puram, Coimbatore".
      page.locality = '';
      page.city = '';
      page.address = club.centerName || '';
      const lat = Number(club.latitude);
      const lng = Number(club.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        page.geoLatitude = lat;
        page.geoLongitude = lng;
        try {
          const place = await fetchCityVillage(lat, lng);
          const locality = String(place?.village || '').trim();
          const city = String(place?.city || '').trim();
          page.locality = locality;
          page.city = city;
          const label = [locality, city].filter(Boolean).join(', ');
          if (label) page.address = label;
        } catch {
          /* keep empty locality/city — map still works via GPS */
        }
      }
    } else {
      page.centerName = '';
      // Keep FormJson city/area (SEO + freestyle place); map searches that query.
      const placeLabel = [page.locality, page.city].filter(Boolean).join(', ');
      page.address = placeLabel || '';
      page.mapsLink = buildGoogleMapsSearchUrl({
        locality: page.locality,
        city: page.city,
        address: page.address,
      });
    }
  } catch {
    hasClub = false;
    page.centerName = '';
    page.geoLatitude = null;
    page.geoLongitude = null;
    const placeLabel = [page.locality, page.city].filter(Boolean).join(', ');
    page.address = placeLabel || '';
    page.mapsLink = buildGoogleMapsSearchUrl({
      locality: page.locality,
      city: page.city,
      address: page.address,
    });
  }

  // Refresh SEO after live club place resolve (city/area may change from GPS).
  const seo = buildCoachPageSeo({
    displayName: page.displayName,
    title: page.title,
    city: page.city,
    locality: page.locality,
    centerName: page.centerName,
    offerings: page.offerings,
  });
  page.seoTitle = seo.seoTitle;
  page.seoDescription = seo.seoDescription;
  page.seoKeywords = seo.seoKeywords;

  return {
    props: {
      page,
      hasClub,
      teamMedia,
      baseUrl,
      pageUrl: `${baseUrl}/coach/${pathSlug}`,
    },
  };
}

function Section({ id, title, eyebrow, children }) {
  if (!children) return null;
  return (
    <section id={id} className="section">
      {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      <div className="section-body">{children}</div>
    </section>
  );
}

function uniqueMediaUrls(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const src = item?.src;
    if (!src || seen.has(src)) continue;
    seen.add(src);
    out.push(item);
  }
  return out;
}

function chunkTiles(items, size) {
  const out = [];
  for (let i = 0; i < (items || []).length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function GalleryTile({ tile, shape, onOpenVideo, onOpenPhoto }) {
  if (!tile) return null;
  const isVideo = tile.type === 'video';
  return (
    <button
      type="button"
      className={`gallery-tile ${shape}${isVideo ? ' is-video' : ''}`}
      onClick={() => {
        if (isVideo) onOpenVideo(tile);
        else onOpenPhoto();
      }}
    >
      {isVideo ? (
        <video
          className="gallery-tile-video"
          src={tile.src}
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tile.cover || tile.src} alt={tile.label || ''} loading="lazy" />
      )}
      {isVideo ? (
        <span className="photo-album-play" aria-hidden="true">▶</span>
      ) : null}
    </button>
  );
}

/** Fisher–Yates copy shuffle for public media front order. */
function shuffleCopy(items) {
  const arr = Array.isArray(items) ? [...items] : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Responsive page size for carousels (mobile vs desktop). */
function useCarouselPageSize(mobileSize = 1, desktopSize = 2) {
  const [pageSize, setPageSize] = useState(desktopSize);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 719px)');
    const apply = () => setPageSize(mq.matches ? mobileSize : desktopSize);
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else mq.addListener(apply);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', apply);
      else mq.removeListener(apply);
    };
  }, [mobileSize, desktopSize]);
  return pageSize;
}

/**
 * Arrow carousel: show `pageSize` items; arrows only when there are more.
 */
function MediaCarousel({ items, pageSize, tone = 'light', label, renderItem }) {
  const [start, setStart] = useState(0);
  const total = Array.isArray(items) ? items.length : 0;
  const size = Math.max(1, Number(pageSize) || 1);
  const showArrows = total > size;
  const visible = [];
  for (let i = 0; i < Math.min(size, total); i += 1) {
    visible.push(items[(start + i) % total]);
  }

  const stepPrev = () => {
    if (!total) return;
    setStart((s) => (s - size + total * 20) % total);
  };
  const stepNext = () => {
    if (!total) return;
    setStart((s) => (s + size) % total);
  };

  if (!total) return null;

  return (
    <div className={`media-carousel media-carousel-${tone}${showArrows ? '' : ' no-arrows'}`}>
      {showArrows ? (
        <button
          type="button"
          className="media-carousel-btn"
          onClick={stepPrev}
          aria-label={`Previous ${label}`}
        >
          ‹
        </button>
      ) : null}
      <div className="media-carousel-track" data-count={String(visible.length)}>
        {visible.map((item, idx) => renderItem(item, idx))}
      </div>
      {showArrows ? (
        <button
          type="button"
          className="media-carousel-btn"
          onClick={stepNext}
          aria-label={`Next ${label}`}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

export default function CoachPortfolioPage({
  page,
  hasClub: hasClubProp = false,
  teamMedia = null,
  baseUrl,
  pageUrl,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [lightboxItems, setLightboxItems] = useState([]);
  const [videoSrc, setVideoSrc] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activeAlbumId, setActiveAlbumId] = useState('all');
  const [faqOpen, setFaqOpen] = useState(0);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookName, setBookName] = useState('');
  const [bookPhone, setBookPhone] = useState('');
  const [bookNote, setBookNote] = useState('');
  const mediaPageSize = useCarouselPageSize(1, 2);
  const touchStartX = useRef(null);
  const photo = absoluteUrl(baseUrl, page.profilePhoto);
  const aboutPhoto = photo
    || absoluteUrl(baseUrl, (page.activityPhotos || [])[0])
    || absoluteUrl(baseUrl, (page.interiorPhotos || [])[0]);
  const logo = absoluteUrl(baseUrl, page.logo);
  const ogImage = photo || logo || (baseUrl ? `${baseUrl}/wellness-valley-icon.png` : null);
  const wa = whatsappHref(page.whatsapp);
  const call = telHref(page.phone);
  const heroName = firstName(page.displayName);
  const placeShort = [page.locality, page.city].filter(Boolean).join(', ');
  // Hero pin: strip bureaucratic Ward/Zone noise so mobile stays one line.
  const heroPlace = (() => {
    let locality = String(page.locality || '').trim();
    const city = String(page.city || '').trim();
    locality = locality
      .replace(/\bWard\s*\d+\b[, ]*/gi, '')
      .replace(/\bZone\s*\d+\b[, ]*/gi, '')
      .replace(/^[,.\s]+|[,.\s]+$/g, '')
      .trim();
    return [locality, city].filter(Boolean).join(', ') || city || placeShort || null;
  })();

  const hasGallery = Boolean(
    page.entrancePhoto
    || page.nameBoardPhoto
    || (page.interiorPhotos || []).length
    || (page.activityPhotos || []).length,
  );
  const hasTransformations = Array.isArray(page.transformations) && page.transformations.length > 0;
  const whatWeSay = Array.isArray(teamMedia?.whatWeSay) ? teamMedia.whatWeSay : [];
  const whatWeDo = Array.isArray(teamMedia?.whatWeDo) ? teamMedia.whatWeDo : [];
  const hasWhatWeSay = whatWeSay.length > 0;
  const hasWhatWeDo = whatWeDo.length > 0;
  const bizTitle = String(page.centerName || '').trim()
    || String(page.displayName || page.fullName || heroName || '').trim();
  const introVideoSrcs = uniqueMediaUrls(
    (Array.isArray(page.introVideos) && page.introVideos.length
      ? page.introVideos
      : (page.introVideoUrl ? [page.introVideoUrl] : [])
    )
      .map((u) => absoluteUrl(baseUrl, u))
      .filter(Boolean)
      .map((src) => ({ src })),
  ).map((item) => item.src);
  const introVideoSrc = introVideoSrcs[0] || null;
  const hasMedia = hasGallery || introVideoSrcs.length > 0 || hasTransformations;
  const basedIn = placeShort || page.city || null;
  const heroTag = page.title || 'Professional Wellness Coach';
  const aboutText = [
    page.background,
    page.uniqueApproach,
  ].filter(Boolean).join(' ').trim()
    || String(page.qualifications || '').trim()
    || [
      page.displayName || heroName,
      'is a',
      heroTag,
      basedIn ? `based in ${basedIn}` : null,
      page.yearsExperience ? `with ${page.yearsExperience} of experience` : null,
    ].filter(Boolean).join(' ') + '.';
  const hasAbout = Boolean(aboutText);
  const rawHeroBlurb = String(page.highlight || page.background || page.uniqueApproach || '').trim();
  const heroBlurb = rawHeroBlurb
    ? (rawHeroBlurb.length > 88
      ? `${rawHeroBlurb.slice(0, 85).replace(/\s+\S*$/, '').trim()}…`
      : rawHeroBlurb)
    : '';
  const showHeroTag = heroTag
    && heroTag.toLowerCase() !== 'wellness coach';
  const navItems = [
    { href: '#top', label: 'Home' },
    hasAbout ? { href: '#about', label: 'About' } : null,
    (page.offeringCards || []).length ? { href: '#services', label: 'Services' } : null,
    hasMedia ? { href: '#gallery', label: 'Gallery' } : null,
    { href: '#faq', label: 'FAQ' },
    { href: '#contact', label: 'Contact' },
  ].filter(Boolean);

  const FAQS = buildCoachPageFaqs(page, { heroName, basedIn });
  const visibleHeading = buildCoachVisibleHeading(page);
  const placeAlt = [page.locality, page.city].filter(Boolean).join(', ');
  const profileAlt = [page.fullName || page.displayName || heroName, placeAlt]
    .filter(Boolean)
    .join(' — ') || 'Wellness Coach';

  const trustItems = [
    { title: 'Personalized Guidance', line: 'Plans that fit your day', icon: '🌿' },
    { title: 'Trusted Support', line: 'Kind, clear check-ins', icon: '💚' },
    { title: 'Holistic Approach', line: 'Food, movement, habits', icon: '🪷' },
  ];
  const openBook = () => setBookOpen(true);

  // yearsExperience / title / about copy are FormJson-only — reflect the CMS form.
  const coachTitle = String(page.title || '').trim();
  const aboutKicker = coachTitle
    ? `Meet Your ${coachTitle}`
    : 'Meet Your Coach';
  const aboutBullets = [
    String(page.yearsExperience || '').trim() || null,
    page.qualifications || coachTitle || null,
    page.languages?.length ? `Languages: ${page.languages.slice(0, 3).join(', ')}` : null,
  ].filter(Boolean).slice(0, 3);

  const social = page.social || {};
  // Club → GPS mapsLink; freestyle → City/Area search mapsLink (set in getServerSideProps).
  const hasClub = Boolean(hasClubProp);
  const mapsLink = String(page.mapsLink || '').trim();
  const mapsEmbedSrc = mapsEmbedSrcFromLink(mapsLink);
  const showMap = Boolean(mapsEmbedSrc);
  const heroSupport = page.highlight
    || [
      'Get personalized wellness guidance from',
      page.displayName || heroName,
      basedIn ? `in ${basedIn}` : null,
      '— simple habits, clear support, lasting results.',
    ].filter(Boolean).join(' ');
  const closeMenu = () => setMenuOpen(false);

  const entranceItems = uniqueMediaUrls([
    page.entrancePhoto
      ? { src: absoluteUrl(baseUrl, page.entrancePhoto), label: 'Entrance' }
      : null,
    page.nameBoardPhoto
      ? { src: absoluteUrl(baseUrl, page.nameBoardPhoto), label: 'Name board' }
      : null,
  ].filter((item) => item?.src));

  const interiorItems = uniqueMediaUrls(
    (page.interiorPhotos || []).map((u, i) => ({
      src: absoluteUrl(baseUrl, u),
      label: (page.interiorPhotos || []).length > 1 ? `Interior ${i + 1}` : 'Interior',
    })),
  );

  const activityItems = uniqueMediaUrls(
    (page.activityPhotos || []).map((u, i) => ({
      src: absoluteUrl(baseUrl, u),
      label: (page.activityPhotos || []).length > 1 ? `Activity ${i + 1}` : 'Activity',
    })),
  );

  const gallery = uniqueMediaUrls([
    ...entranceItems,
    ...interiorItems,
    ...activityItems,
  ]);

  const transformItems = uniqueMediaUrls(
    (page.transformations || []).flatMap((t, idx) => {
      const label = t.label || `Result ${idx + 1}`;
      return [
        t.beforePhotoUrl
          ? { src: absoluteUrl(baseUrl, t.beforePhotoUrl), label: `${label} · Before` }
          : null,
        t.afterPhotoUrl
          ? { src: absoluteUrl(baseUrl, t.afterPhotoUrl), label: `${label} · After` }
          : null,
      ];
    }),
  );

  const allViewerItems = uniqueMediaUrls([...gallery, ...transformItems]);

  const videoTiles = introVideoSrcs.map((src, i) => ({
    id: `intro-video-${i}`,
    type: 'video',
    // Use the video URL itself so the tile shows a real frame (not a stretched profile photo).
    src: src.includes('#') ? src : `${src}#t=0.1`,
    cover: null,
    label: introVideoSrcs.length > 1 ? `Intro video ${i + 1}` : 'Intro video',
  }));
  const videoTile = videoTiles[0] || null;

  const toPhotoTiles = (items) => (items || []).map((item, i) => ({
    id: `photo-${item.src.slice(0, 24)}-${i}`,
    type: 'photo',
    src: item.src,
    cover: item.src,
    label: item.label,
  }));

  const transformPairs = (page.transformations || [])
    .map((t, idx) => {
      const label = t.label || `Result ${idx + 1}`;
      const beforeSrc = absoluteUrl(baseUrl, t.beforePhotoUrl);
      const afterSrc = absoluteUrl(baseUrl, t.afterPhotoUrl);
      if (!beforeSrc && !afterSrc) return null;
      return { label, beforeSrc, afterSrc };
    })
    .filter(Boolean);

  const allPhotoCount = gallery.length;
  const videoCount = videoTiles.length;
  const galleryTabs = [
    {
      id: 'all',
      title: 'All',
      count: allPhotoCount + videoCount,
      countLabel: [
        allPhotoCount ? `${allPhotoCount} Photo${allPhotoCount === 1 ? '' : 's'}` : null,
        videoCount ? `${videoCount} Video${videoCount === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' / ') || '0',
      cover: gallery[0]?.src || transformItems[0]?.src || photo || logo,
      tiles: [
        ...videoTiles,
        ...toPhotoTiles(gallery),
      ],
    },
    videoCount
      ? {
        id: 'video',
        title: 'Video',
        count: videoCount,
        countLabel: `${videoCount} Video${videoCount === 1 ? '' : 's'}`,
        cover: photo || gallery[0]?.src || logo,
        tiles: videoTiles,
      }
      : null,
    entranceItems.length
      ? {
        id: 'entrance',
        title: 'Entrance',
        count: entranceItems.length,
        countLabel: `${entranceItems.length} Photo${entranceItems.length === 1 ? '' : 's'}`,
        cover: entranceItems[0].src,
        tiles: toPhotoTiles(entranceItems),
      }
      : null,
    interiorItems.length
      ? {
        id: 'interior',
        title: 'Interior',
        count: interiorItems.length,
        countLabel: `${interiorItems.length} Photo${interiorItems.length === 1 ? '' : 's'}`,
        cover: interiorItems[0].src,
        tiles: toPhotoTiles(interiorItems),
      }
      : null,
    activityItems.length
      ? {
        id: 'activity',
        title: 'Activity',
        count: activityItems.length,
        countLabel: `${activityItems.length} Photo${activityItems.length === 1 ? '' : 's'}`,
        cover: activityItems[0].src,
        tiles: toPhotoTiles(activityItems),
      }
      : null,
    transformPairs.length
      ? {
        id: 'transformations',
        title: 'Transform',
        count: transformPairs.length,
        countLabel: `${transformPairs.length} Result${transformPairs.length === 1 ? '' : 's'}`,
        cover: transformPairs[0].afterSrc || transformPairs[0].beforeSrc,
        tiles: toPhotoTiles(transformItems),
        pairs: transformPairs,
      }
      : null,
  ].filter(Boolean);

  // Homepage strip: 3 portrait tiles (mockup) — Center · Sessions · Activities
  const photosPreviewPool = [
    entranceItems[0]?.src
      || (page.nameBoardPhoto ? absoluteUrl(baseUrl, page.nameBoardPhoto) : null),
    interiorItems[0]?.src,
    activityItems[0]?.src,
    interiorItems[1]?.src,
    activityItems[1]?.src,
    gallery[0]?.src,
    gallery[1]?.src,
    gallery[2]?.src,
    transformPairs[0]?.afterSrc || transformPairs[0]?.beforeSrc,
  ].filter(Boolean);
  const photosPreview = [];
  for (const src of photosPreviewPool) {
    if (photosPreview.length >= 3) break;
    if (photosPreview.includes(src)) continue;
    photosPreview.push(src);
  }
  const photosPreviewCount = allPhotoCount + videoCount;
  const photosPreviewCaption = [
    (entranceItems.length || page.nameBoardPhoto || interiorItems.length) ? 'Center photos' : null,
    interiorItems.length || activityItems.length ? 'Coaching sessions' : null,
    activityItems.length || transformPairs.length ? 'Activities' : null,
  ].filter(Boolean);
  const photosCaptionText = (photosPreviewCaption.length
    ? photosPreviewCaption
    : ['Center photos', 'Coaching sessions', 'Activities']
  ).join(' · ');

  const activeTab = galleryTabs.find((t) => t.id === activeAlbumId) || galleryTabs[0] || null;
  const activeTiles = activeTab?.tiles || [];
  const activeVideoTiles = activeTiles.filter((t) => t.type === 'video');
  const activePhotoTiles = activeTiles.filter((t) => t.type === 'photo');

  const lightboxOpen = lightboxIndex != null && lightboxItems[lightboxIndex];
  const closeLightbox = () => {
    setLightboxIndex(null);
    setLightboxItems([]);
  };
  const openGallery = (albumId) => {
    setActiveAlbumId(albumId || 'all');
    setGalleryOpen(true);
  };
  const closeGallery = () => {
    closeLightbox();
    setGalleryOpen(false);
  };
  const openViewerFromList = (items, src) => {
    const mapped = (items || [])
      .map((item) => {
        if (!item) return null;
        if (item.type === 'video') return null;
        if (item.src) return { src: item.src, label: item.label || '' };
        return null;
      })
      .filter(Boolean);
    const useList = mapped.length ? mapped : allViewerItems;
    const idx = useList.findIndex((item) => item.src === src);
    if (idx < 0) return;
    setLightboxItems(useList);
    setLightboxIndex(idx);
  };
  const openViewer = (src) => openViewerFromList(allViewerItems, src);
  const showPrev = () => {
    if (!lightboxItems.length) return;
    setLightboxIndex((i) => (i == null ? 0 : (i - 1 + lightboxItems.length) % lightboxItems.length));
  };
  const showNext = () => {
    if (!lightboxItems.length) return;
    setLightboxIndex((i) => (i == null ? 0 : (i + 1) % lightboxItems.length));
  };

  useEffect(() => {
    if (!menuOpen && lightboxIndex == null && !videoSrc && !galleryOpen && !bookOpen) {
      return undefined;
    }
    const total = lightboxItems.length;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (lightboxIndex != null) {
          closeLightbox();
          return;
        }
        if (bookOpen) {
          setBookOpen(false);
          return;
        }
        if (videoSrc) {
          setVideoSrc(null);
          return;
        }
        if (galleryOpen) {
          setGalleryOpen(false);
          return;
        }
        setMenuOpen(false);
        return;
      }
      if (lightboxIndex == null || total < 2) return;
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((i) => (i == null ? 0 : (i - 1 + total) % total));
      }
      if (e.key === 'ArrowRight') {
        setLightboxIndex((i) => (i == null ? 0 : (i + 1) % total));
      }
    };
    const prevOverflow = document.body.style.overflow;
    if (menuOpen || lightboxIndex != null || videoSrc || galleryOpen || bookOpen) {
      document.body.style.overflow = 'hidden';
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, lightboxIndex, lightboxItems.length, videoSrc, galleryOpen, bookOpen]);

  const jsonLd = buildCoachPageJsonLd(page, {
    pageUrl,
    imageUrl: ogImage,
    faqs: FAQS,
    hasClub,
  });
  const keywords = Array.isArray(page.seoKeywords) ? page.seoKeywords.join(', ') : '';

  return (
    <>
      <Head>
        <title>{page.seoTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={page.seoDescription} />
        {keywords ? <meta name="keywords" content={keywords} /> : null}
        <meta name="robots" content="index,follow" />
        <meta name="geo.region" content="IN" />
        {page.city ? <meta name="geo.placename" content={[page.locality, page.city].filter(Boolean).join(', ')} /> : null}
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="profile" />
        <meta property="og:site_name" content="Wellness Valley" />
        <meta property="og:title" content={page.seoTitle} />
        <meta property="og:description" content={page.seoDescription} />
        <meta property="og:url" content={pageUrl} />
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={page.seoTitle} />
        <meta name="twitter:description" content={page.seoDescription} />
        {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Great+Vibes&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <style>{PAGE_CSS}</style>
      </Head>

      <div className="page" id="top">
        <header className="site-header">
          <div className="shell header-row">
            <a className="brand" href="#top" aria-label="Wellness Valley home" onClick={closeMenu}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wellness-valley-logo.png" alt="Wellness Valley" className="brand-logo" width={72} height={72} />
            </a>
            <nav className="desk-nav" aria-label="Primary">
              {navItems.map((item) => (
                <a key={item.href} href={item.href}>{item.label}</a>
              ))}
            </nav>
            <button type="button" className="btn btn-primary header-cta" onClick={openBook}>
              Book Consultation
            </button>
            <button
              type="button"
              className="menu-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className={menuOpen ? 'burger open' : 'burger'}><i /><i /><i /></span>
            </button>
          </div>
        </header>

        {menuOpen ? (
          <button type="button" className="menu-backdrop" aria-label="Close menu" onClick={closeMenu} />
        ) : null}
        <aside className={menuOpen ? 'side-menu open' : 'side-menu'} aria-hidden={!menuOpen}>
          <div className="side-menu-top">
            <div className="side-menu-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wellness-valley-logo.png" alt="" width={36} height={36} />
              <p className="side-menu-title">Wellness Valley</p>
            </div>
            <button type="button" className="side-menu-close" onClick={closeMenu} aria-label="Close">✕</button>
          </div>
          <nav className="side-menu-nav">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu}>{item.label}</a>
            ))}
          </nav>
          <div className="side-menu-foot">
            <button type="button" className="btn btn-primary side-menu-cta" onClick={() => { closeMenu(); openBook(); }}>
              Book Consultation
            </button>
          </div>
        </aside>

        <section className="hero">
          <div className="hero-wash" aria-hidden="true" />
          <div className="hero-wave" aria-hidden="true" />
          <div className="shell hero-grid">
            <div className="hero-copy">
              {hasClub && (bizTitle || heroPlace) ? (
                <div className="biz-listing" aria-label="Center listing">
                  {bizTitle ? (
                    <p className="biz-listing-name">{bizTitle}</p>
                  ) : null}
                  {heroPlace ? (
                    <p className="biz-listing-place" title={basedIn || heroPlace}>
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"
                        />
                        <circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <span className="biz-listing-place-text">{heroPlace}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
              <h1 className="hero-seo-heading">{visibleHeading}</h1>
              <p className="hero-tagline" aria-hidden="false">
                <span className="hero-h1-main">Your Journey to a Healthier &amp; Happier You</span>
                <span className="hero-h1-script">Starts Here</span>
              </p>
              <p className="hero-lead">{heroSupport}</p>
              <div className="hero-actions">
                {wa ? (
                  <a className="btn btn-whatsapp" href={wa} target="_blank" rel="noreferrer">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.5 3.5A11 11 0 0 0 3.2 17.7L2 22l4.4-1.2A11 11 0 1 0 20.5 3.5zm-8.6 17a9.1 9.1 0 0 1-4.6-1.3l-.3-.2-2.7.7.7-2.6-.2-.3a9.1 9.1 0 1 1 7.1 3.7zm5-6.8c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.1-.3a.5.5 0 0 0 0-.5l-.6-1.5c-.2-.4-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.5 11.5 0 0 0 4.4 3.9 15 15 0 0 0 1.5.5 3.6 3.6 0 0 0 1.6.1 2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.6-.3z" /></svg>
                    Chat on WhatsApp
                  </a>
                ) : null}
                <button type="button" className="btn btn-outline" onClick={openBook}>Book a Consultation</button>
              </div>
              <div className="trust-row">
                {trustItems.map((item) => (
                  <div key={item.title} className="trust-item">
                    <span className="trust-icon" aria-hidden="true">{item.icon}</span>
                    <div className="trust-copy">
                      <p className="trust-title">{item.title}</p>
                      <p className="trust-line">{item.line}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={photo ? 'hero-visual' : 'hero-visual empty'}>
              <div className={photo ? 'hero-photo-wrap' : 'hero-photo-wrap placeholder'}>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={profileAlt}
                    className="hero-photo"
                    decoding="async"
                    fetchPriority="high"
                  />
                ) : (
                  <span className="hero-mono" aria-hidden="true">{nameInitials(page.displayName || page.fullName || heroName)}</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <main>
          {(hasAbout || (page.offeringCards || []).length) ? (
            <section id="about" className="section about-services-section">
              <div className="shell about-services-grid">
                {hasAbout ? (
                  <div className="about-col">
                    <div className="about-photo-wrap">
                      <div className="about-media">
                        {aboutPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={aboutPhoto} alt={profileAlt} />
                        ) : (
                          <span className="about-fallback">{nameInitials(page.displayName || heroName)}</span>
                        )}
                      </div>
                    </div>
                    <div className="about-intro">
                      <p className="lined-kicker"><span>{aboutKicker}</span></p>
                      <h2>Hi, I’m {page.displayName || page.fullName || heroName}</h2>
                    </div>
                    <p className="about-text">{aboutText}</p>
                    {aboutBullets.length ? (
                      <ul className="about-bullets">
                        {aboutBullets.map((b) => (
                          <li key={b}><span className="check" aria-hidden="true">✓</span>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {(page.offeringCards || []).length ? (
                  <div id="services" className={`services-panel${!hasAbout ? ' services-panel-solo' : ''}`}>
                    <h2>Our Services</h2>
                    <p className="panel-sub">Comprehensive guidance for a healthier you</p>
                    <div className="services-grid">
                      {(page.offeringCards || [])
                        .slice(0, servicesExpanded ? undefined : 3)
                        .map((item) => (
                        <article key={item.label} className="service-card">
                          <span className="service-icon-wrap" aria-hidden="true">
                            <span className="service-emoji">{item.emoji}</span>
                          </span>
                          <h3>{item.label}</h3>
                        </article>
                      ))}
                    </div>
                    {(page.offeringCards || []).length > 3 ? (
                      <div className="panel-cta">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setServicesExpanded((v) => !v)}
                        >
                          {servicesExpanded ? 'Show less' : 'Show more'}
                          {' '}
                          <span aria-hidden="true">{servicesExpanded ? '↑' : '→'}</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {hasMedia && photosPreview.length ? (
            <section id="gallery" className="section gallery-section">
              <div className="shell">
                <div className="section-head center">
                  <h2>Our Wellness Center</h2>
                  <p className="panel-sub">A calm and welcoming space for your wellness journey</p>
                </div>
                <button
                  type="button"
                  className="photos-preview"
                  onClick={() => openGallery('all')}
                  aria-label={`Open photo gallery, ${photosPreviewCount} items`}
                >
                  <span
                    className="photos-preview-row"
                    style={{ gridTemplateColumns: `repeat(${Math.min(3, photosPreview.length)}, minmax(0, 1fr))` }}
                  >
                    {photosPreview.map((src, idx) => (
                      <span key={`${src}-${idx}`} className="photos-preview-tile">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`${page.centerName || page.displayName || 'Wellness'} center photo${placeAlt ? ` in ${placeAlt}` : ''}`}
                          loading="lazy"
                        />
                      </span>
                    ))}
                  </span>
                </button>
                <div className="section-cta">
                  <button type="button" className="btn btn-primary" onClick={() => openGallery('all')}>
                    View Gallery <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {hasWhatWeSay ? (
            <section id="what-we-say" className="section reviews-section">
              <div className="reviews-leaves" aria-hidden="true" />
              <div className="shell">
                <div className="section-head center light">
                  <h2>What We Say</h2>
                  <p className="reviews-gold">Health journeys from our community</p>
                </div>
                <MediaCarousel
                  items={whatWeSay}
                  pageSize={mediaPageSize}
                  tone="dark"
                  label="videos"
                  renderItem={(item, idx) => (
                    <article
                      key={`say-${item.userId}-${item.healthVideoUrl}-${idx}`}
                      className="say-video-card"
                    >
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video
                        className="say-video"
                        controls
                        playsInline
                        preload="metadata"
                        src={item.healthVideoUrl}
                      />
                      {item.memberName ? (
                        <p className="say-video-name">{item.memberName}</p>
                      ) : null}
                    </article>
                  )}
                />
              </div>
            </section>
          ) : null}

          {hasWhatWeDo ? (
            <section id="what-we-do" className="section what-we-do-section">
              <div className="do-wash" aria-hidden="true" />
              <div className="shell what-we-do-inner">
                <div className="section-head center">
                  <p className="do-kicker">Transformations</p>
                  <h2>What We Do</h2>
                  <p className="panel-sub do-sub">Real results from our community — before &amp; after</p>
                </div>
                <MediaCarousel
                  items={whatWeDo}
                  pageSize={mediaPageSize}
                  tone="light"
                  label="transformations"
                  renderItem={(item, idx) => (
                    <article
                      key={`do-${item.userId}-${item.beforeImageUrl || item.afterImageUrl}-${idx}`}
                      className="do-transform-card"
                    >
                      <div className="do-transform-pair">
                        {item.beforeImageUrl ? (
                          <figure className="do-shot">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.beforeImageUrl}
                              alt={`${item.memberName || 'Member'} before${placeAlt ? ` — ${placeAlt}` : ''}`}
                              loading="lazy"
                            />
                            <span className="do-shot-badge">Before</span>
                          </figure>
                        ) : null}
                        {item.beforeImageUrl && item.afterImageUrl ? (
                          <span className="do-pair-arrow" aria-hidden="true">→</span>
                        ) : null}
                        {item.afterImageUrl ? (
                          <figure className="do-shot do-shot-after">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.afterImageUrl}
                              alt={`${item.memberName || 'Member'} after${placeAlt ? ` — ${placeAlt}` : ''}`}
                              loading="lazy"
                            />
                            <span className="do-shot-badge do-shot-badge-after">After</span>
                          </figure>
                        ) : null}
                      </div>
                      <div className="do-transform-meta">
                        <div className="do-transform-who">
                          {item.memberName ? <p className="do-transform-name">{item.memberName}</p> : null}
                          {item.durationText ? (
                            <span className="do-transform-duration">{item.durationText}</span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  )}
                />
              </div>
            </section>
          ) : null}

          <section id="faq" className="section faq-contact-section">
            <div className={`shell faq-contact-grid${showMap ? '' : ' no-map'}`}>
              <div className="faq-panel">
                <p className="section-kicker">Questions</p>
                <h2>FAQ</h2>
                <div className="faq-list">
                  {FAQS.map((item, idx) => (
                    <div key={item.q} className={faqOpen === idx ? 'faq-item open' : 'faq-item'}>
                      <button type="button" className="faq-q" onClick={() => setFaqOpen(faqOpen === idx ? -1 : idx)}>
                        <span>{item.q}</span>
                        <span className="faq-plus" aria-hidden="true">{faqOpen === idx ? '−' : '+'}</span>
                      </button>
                      {faqOpen === idx ? <p className="faq-a">{item.a}</p> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div id="contact" className="contact-panel">
                <p className="section-kicker">Get in Touch</p>
                <h2>Contact</h2>
                <ul className="contact-list">
                  {page.phone ? (
                    <li>
                      <span className="contact-ico" aria-hidden="true">📞</span>
                      <div>
                        <span className="contact-label">Phone</span>
                        <a href={call}>{page.phone}</a>
                      </div>
                    </li>
                  ) : null}
                  {page.email ? (
                    <li>
                      <span className="contact-ico" aria-hidden="true">✉️</span>
                      <div>
                        <span className="contact-label">Email</span>
                        <a href={`mailto:${page.email}`}>{page.email}</a>
                      </div>
                    </li>
                  ) : null}
                  {hasClub && page.centerName ? (
                    <li>
                      <span className="contact-ico" aria-hidden="true">📍</span>
                      <div>
                        <span className="contact-label">Club</span>
                        <p>{page.centerName}</p>
                      </div>
                    </li>
                  ) : null}
                  {!hasClub && (page.locality || page.city) ? (
                    <li>
                      <span className="contact-ico" aria-hidden="true">📍</span>
                      <div>
                        <span className="contact-label">Location</span>
                        <p>{[page.locality, page.city].filter(Boolean).join(', ')}</p>
                      </div>
                    </li>
                  ) : null}
                  {hasClub && (page.openingTime || page.closingTime) ? (
                    <li>
                      <span className="contact-ico" aria-hidden="true">🕒</span>
                      <div>
                        <span className="contact-label">Hours</span>
                        <p>{page.openingTime || '—'} – {page.closingTime || '—'}</p>
                      </div>
                    </li>
                  ) : null}
                </ul>
              </div>

              {showMap ? (
                <div className="map-panel">
                  <div className="map-frame">
                    <iframe
                      title={hasClub ? 'Club location' : 'Location'}
                      src={mapsEmbedSrc}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                  <a className="btn btn-primary map-directions" href={mapsLink} target="_blank" rel="noreferrer">
                    Get Directions
                  </a>
                </div>
              ) : null}
            </div>
          </section>
        </main>

        <footer className="site-footer">
          <div className="shell footer-grid">
            <div className="footer-brand-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wellness-valley-logo.png" alt="" width={44} height={44} />
              <p className="footer-brand">Wellness Valley</p>
              <p className="footer-copy">© {new Date().getFullYear()} Wellness Valley. All rights reserved.</p>
            </div>
            <div>
              <p className="footer-label">Follow Us</p>
              <div className="footer-social">
                {social.facebook ? (
                  <a href={social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="social-ico" title="Facebook">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13V9c0-.6.4-1 1-1z" /></svg>
                  </a>
                ) : null}
                {social.instagram ? (
                  <a href={social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="social-ico" title="Instagram">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm11 1.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM12 7.5A4.5 4.5 0 1 1 12 16.5 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 12 14.5 2.5 2.5 0 0 0 12 9.5z" /></svg>
                  </a>
                ) : null}
                {social.youtube ? (
                  <a href={social.youtube} target="_blank" rel="noreferrer" aria-label="YouTube" className="social-ico" title="YouTube">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M23 12.2s0-3.2-.4-4.7c-.2-.9-.9-1.6-1.8-1.8C19.3 5.3 12 5.3 12 5.3s-7.3 0-8.8.4c-.9.2-1.6.9-1.8 1.8C1 9 1 12.2 1 12.2s0 3.2.4 4.7c.2.9.9 1.6 1.8 1.8 1.5.4 8.8.4 8.8.4s7.3 0 8.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.5.4-4.7.4-4.7zM9.8 15.5v-6.6l6.2 3.3-6.2 3.3z" /></svg>
                  </a>
                ) : null}
                {social.linkedin ? (
                  <a href={social.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="social-ico" title="LinkedIn">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.5 8.5H3.7V21h2.8V8.5zM5.1 3A1.6 1.6 0 1 0 5.1 6.2 1.6 1.6 0 0 0 5.1 3zM20.3 21h-2.8v-6.1c0-1.7-.7-2.3-1.7-2.3s-1.9.8-1.9 2.4V21H11V8.5h2.7v1.5c.5-.9 1.7-1.8 3.5-1.8 2.4 0 3.1 1.4 3.1 4.1V21z" /></svg>
                  </a>
                ) : null}
                {!social.instagram && !social.facebook && !social.youtube && !social.linkedin ? (
                  <span className="footer-muted">Coming soon</span>
                ) : null}
              </div>
            </div>
          </div>
        </footer>

        {wa ? (
          <a className="float-wa" href={wa} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" title="WhatsApp">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M20.5 3.5A11 11 0 0 0 3.2 17.7L2 22l4.4-1.2A11 11 0 1 0 20.5 3.5zm-8.6 17a9.1 9.1 0 0 1-4.6-1.3l-.3-.2-2.7.7.7-2.6-.2-.3a9.1 9.1 0 1 1 7.1 3.7zm5-6.8c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.1-.3a.5.5 0 0 0 0-.5l-.6-1.5c-.2-.4-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.5 11.5 0 0 0 4.4 3.9 15 15 0 0 0 1.5.5 3.6 3.6 0 0 0 1.6.1 2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.6-.3z" /></svg>
          </a>
        ) : null}

        {bookOpen ? (
          <div className="book-modal" role="dialog" aria-modal="true" aria-label="Book a consultation">
            <button type="button" className="book-backdrop" aria-label="Close" onClick={() => setBookOpen(false)} />
            <div className="book-panel">
              <div className="book-panel-head">
                <h3>Book a Consultation</h3>
                <button type="button" className="book-close" onClick={() => setBookOpen(false)} aria-label="Close">✕</button>
              </div>
              <p className="book-lead">Share a few details and we will reach out on WhatsApp.</p>
              <form
                className="book-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = bookName.trim();
                  const phone = bookPhone.trim();
                  const note = bookNote.trim();
                  if (!name || !phone) return;
                  if (wa) {
                    const msg = encodeURIComponent(
                      `Hi ${page.displayName || 'Coach'},\n\nI would like to book a consultation.\nName: ${name}\nPhone: ${phone}${note ? `\nNote: ${note}` : ''}`,
                    );
                    window.open(`${wa}?text=${msg}`, '_blank', 'noopener,noreferrer');
                  }
                  setBookOpen(false);
                  setBookName('');
                  setBookPhone('');
                  setBookNote('');
                }}
              >
                <label className="book-field">
                  <span>Your name</span>
                  <input type="text" required maxLength={60} value={bookName} onChange={(e) => setBookName(e.target.value)} placeholder="Full name" />
                </label>
                <label className="book-field">
                  <span>Phone / WhatsApp</span>
                  <input type="tel" required maxLength={20} value={bookPhone} onChange={(e) => setBookPhone(e.target.value)} placeholder="10-digit mobile" />
                </label>
                <label className="book-field">
                  <span>Message (optional)</span>
                  <textarea rows={3} maxLength={240} value={bookNote} onChange={(e) => setBookNote(e.target.value)} placeholder="Your goal or preferred time" />
                </label>
                <button type="submit" className="btn btn-primary book-submit">
                  {wa ? 'Send on WhatsApp' : 'Submit enquiry'}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {galleryOpen ? (
          <div className="gallery-shell" role="dialog" aria-modal="true" aria-label="Photo gallery">
            <div className="gallery-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wellness-valley-logo.png" alt="" className="gallery-brand-logo" width={36} height={36} />
              <p className="gallery-brand-name">Wellness Valley</p>
              <button type="button" className="gallery-close" aria-label="Close gallery" onClick={closeGallery}>
                ✕
              </button>
            </div>
            <div className="gallery-top">
              <div className="gallery-tabs" role="tablist">
                {galleryTabs.map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab?.id === tab.id}
                    className={activeTab?.id === tab.id ? 'gallery-tab active' : 'gallery-tab'}
                    onClick={() => setActiveAlbumId(tab.id)}
                  >
                    {tab.title} ({tab.count})
                  </button>
                ))}
              </div>
            </div>
            {activeTab?.id === 'transformations' ? (
              <div className="gallery-transforms">
                {(activeTab.pairs || []).map((pair, idx) => (
                  <article key={`xf-${idx}`} className="gallery-transform-card">
                    {pair.label ? <p className="gallery-transform-label">{pair.label}</p> : null}
                    <div className="transform-pair">
                      {pair.beforeSrc ? (
                        <button
                          type="button"
                          className="transform-shot"
                          onClick={() => openViewerFromList(activePhotoTiles, pair.beforeSrc)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pair.beforeSrc}
                            alt={`${pair.label || 'Transformation'} before${placeAlt ? ` — ${placeAlt}` : ''}`}
                            loading="lazy"
                          />
                          <span>Before</span>
                        </button>
                      ) : null}
                      {pair.afterSrc ? (
                        <button
                          type="button"
                          className="transform-shot"
                          onClick={() => openViewerFromList(activePhotoTiles, pair.afterSrc)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pair.afterSrc}
                            alt={`${pair.label || 'Transformation'} after${placeAlt ? ` — ${placeAlt}` : ''}`}
                            loading="lazy"
                          />
                          <span>After</span>
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="gallery-masonry">
                {activeVideoTiles.length ? (
                  <div className="gallery-videos">
                    {activeVideoTiles.map((tile) => (
                      <GalleryTile
                        key={tile.id}
                        tile={tile}
                        shape="wide"
                        onOpenVideo={(t) => setVideoSrc(t?.src || null)}
                        onOpenPhoto={() => {}}
                      />
                    ))}
                  </div>
                ) : null}
                {chunkTiles(activePhotoTiles, 3).map((group, groupIdx) => (
                  group.length === 1 ? (
                    <div className="gallery-bento single" key={`bento-${groupIdx}`}>
                      <GalleryTile
                        tile={group[0]}
                        shape="wide"
                        onOpenVideo={(tile) => setVideoSrc(tile?.src || null)}
                        onOpenPhoto={() => openViewerFromList(activePhotoTiles, group[0].src)}
                      />
                    </div>
                  ) : (
                    <div className="gallery-bento" key={`bento-${groupIdx}`}>
                      <GalleryTile
                        tile={group[0]}
                        shape="tall"
                        onOpenVideo={(tile) => setVideoSrc(tile?.src || null)}
                        onOpenPhoto={() => openViewerFromList(activePhotoTiles, group[0].src)}
                      />
                      <div className="gallery-bento-right">
                        {group.slice(1).map((tile, i) => (
                          <GalleryTile
                            key={tile.id}
                            tile={tile}
                            shape={i === 0 ? 'wide' : 'square'}
                            onOpenVideo={(t) => setVideoSrc(t?.src || null)}
                            onOpenPhoto={() => openViewerFromList(activePhotoTiles, tile.src)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        ) : null}

        {lightboxOpen ? (
          <div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={lightboxOpen.label || 'Photo'}
          >
            <button
              type="button"
              className="lightbox-backdrop"
              aria-label="Close"
              onClick={closeLightbox}
            />
            <div
              className="lightbox-panel"
              onTouchStart={(e) => {
                touchStartX.current = e.changedTouches?.[0]?.clientX ?? null;
              }}
              onTouchEnd={(e) => {
                const start = touchStartX.current;
                const end = e.changedTouches?.[0]?.clientX;
                touchStartX.current = null;
                if (start == null || end == null || lightboxItems.length < 2) return;
                const delta = end - start;
                if (Math.abs(delta) < 48) return;
                if (delta < 0) showNext();
                else showPrev();
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightboxOpen.src} alt={lightboxOpen.label || ''} />
              <div className="lightbox-bar">
                {lightboxItems.length > 1 ? (
                  <button type="button" className="lightbox-nav" onClick={showPrev} aria-label="Previous photo">
                    ‹ Prev
                  </button>
                ) : <span />}
                <div className="lightbox-meta">
                  {lightboxOpen.label ? <p className="lightbox-cap">{lightboxOpen.label}</p> : null}
                  <p className="lightbox-count">
                    {lightboxIndex + 1} / {lightboxItems.length}
                  </p>
                </div>
                {lightboxItems.length > 1 ? (
                  <button type="button" className="lightbox-nav" onClick={showNext} aria-label="Next photo">
                    Next ›
                  </button>
                ) : <span />}
              </div>
              <button type="button" className="lightbox-close" onClick={closeLightbox}>
                Close
              </button>
            </div>
          </div>
        ) : null}

        {videoSrc ? (
          <div className="lightbox" role="dialog" aria-modal="true" aria-label="Intro video">
            <button
              type="button"
              className="lightbox-backdrop"
              aria-label="Close"
              onClick={() => setVideoSrc(null)}
            />
            <div className="lightbox-panel video-lightbox">
              <video
                key={videoSrc}
                controls
                autoPlay
                playsInline
                preload="metadata"
                poster={photo || gallery[0]?.src || undefined}
                src={videoSrc}
                className="intro-video"
              />
              <button type="button" className="lightbox-close" onClick={() => setVideoSrc(null)}>
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

const PAGE_CSS = `:root {
  --forest: #1b4d3e;
  --forest-deep: #143628;
  --botanical: #2d6a4f;
  --sage: #e8f0ea;
  --sage-deep: #d7e6db;
  --cream: #f7f3eb;
  --cream-warm: #f3eee4;
  --offwhite: #fafaf8;
  --ink: #1a2a22;
  --muted: #5c6b62;
  --gold: #c4a574;
  --line: rgba(27, 77, 62, 0.12);
  --card: #ffffff;
  --shadow: 0 12px 32px rgba(20, 54, 40, 0.08);
  --radius: 20px;
  --header-h: 76px;
  --serif: "Cormorant Garamond", Georgia, serif;
  --sans: Manrope, system-ui, sans-serif;
  --script: "Great Vibes", cursive;
}
*, *::before, *::after { box-sizing: border-box; }
html {
  scroll-behavior: smooth;
  scroll-padding-top: calc(var(--header-h) + 12px);
}
body {
  margin: 0;
  font-family: var(--sans);
  color: var(--ink);
  background: var(--offwhite);
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
img { max-width: 100%; }
.shell {
  width: min(1140px, calc(100% - 40px));
  margin: 0 auto;
}
.page {
  min-width: 0;
  overflow-x: clip;
  background: var(--offwhite);
  padding-top: var(--header-h);
}

.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  background: rgba(250, 250, 248, 0.96);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.header-row {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: var(--header-h);
}
.brand {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  flex: 0 0 auto;
}
.brand-logo {
  width: 72px;
  height: 72px;
  object-fit: contain;
  display: block;
}
.desk-nav {
  display: none;
  flex: 1;
  justify-content: center;
  gap: 22px;
}
.desk-nav a {
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  opacity: 0.78;
}
.desk-nav a:hover { color: var(--botanical); opacity: 1; }
.btn.header-cta { display: none; }
.menu-btn {
  margin-left: auto;
  appearance: none;
  border: 0;
  background: transparent;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.burger { width: 20px; height: 14px; position: relative; display: block; }
.burger i {
  position: absolute; left: 0; width: 100%; height: 2px;
  background: var(--ink); border-radius: 2px; transition: 0.18s ease;
}
.burger i:nth-child(1) { top: 0; }
.burger i:nth-child(2) { top: 6px; }
.burger i:nth-child(3) { top: 12px; }
.burger.open i:nth-child(1) { top: 6px; transform: rotate(45deg); }
.burger.open i:nth-child(2) { opacity: 0; }
.burger.open i:nth-child(3) { top: 6px; transform: rotate(-45deg); }

.menu-backdrop {
  position: fixed; inset: 0; z-index: 70;
  border: 0;
  background: rgba(10, 20, 14, 0.42);
  backdrop-filter: blur(2px);
}
.side-menu {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 80;
  width: min(300px, 86vw);
  background: #fff;
  transform: translateX(105%);
  transition: transform 0.24s ease;
  padding: calc(14px + env(safe-area-inset-top, 0px)) 18px calc(18px + env(safe-area-inset-bottom, 0px));
  box-shadow: -18px 0 48px rgba(0,0,0,0.16);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.side-menu.open { transform: translateX(0); }
.side-menu-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.side-menu-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.side-menu-brand img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  flex: 0 0 auto;
}
.side-menu-title {
  margin: 0;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--forest-deep);
}
.side-menu-close {
  border: 0;
  background: var(--sage);
  width: 36px;
  height: 36px;
  border-radius: 999px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  color: var(--forest-deep);
  flex: 0 0 auto;
}
.side-menu-nav {
  display: grid;
  gap: 2px;
  margin-top: 8px;
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 4px 0;
}
.side-menu-nav a {
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
  padding: 12px 12px;
  border-radius: 12px;
  color: var(--ink);
  background: transparent;
  border-bottom: 1px solid rgba(27, 77, 62, 0.06);
}
.side-menu-nav a:last-child { border-bottom: 0; }
.side-menu-nav a:active,
.side-menu-nav a:hover {
  background: var(--sage);
  color: var(--forest-deep);
}
.side-menu-foot {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.side-menu-cta {
  width: 100%;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
  border-radius: 999px;
  padding: 13px 22px;
  font-size: 13px;
  font-weight: 700;
  border: 0;
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--sans);
  transition: transform 0.15s ease, background 0.15s ease;
}
.btn:hover { transform: translateY(-1px); }
.btn-primary { background: var(--botanical); color: #fff; }
.btn-primary:hover { background: var(--forest); }
.btn-outline {
  background: transparent;
  color: var(--botanical);
  border: 1.5px solid rgba(45, 106, 79, 0.45);
}
.btn-outline-light {
  background: transparent;
  color: #fff;
  border: 1.5px solid rgba(255,255,255,0.45);
}
.btn-whatsapp { background: #25d366; color: #fff; }

.hero {
  position: relative;
  background: #f7f4ec;
  padding: 28px 0 0;
  overflow: hidden;
  isolation: isolate;
}
.hero-wash {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 55% 70% at 78% 42%, rgba(232, 240, 234, 0.95) 0%, transparent 68%),
    linear-gradient(105deg, #f7f4ec 0%, #f7f4ec 46%, rgba(247,244,236,0.55) 62%, rgba(232,240,234,0.35) 100%);
}
.hero-wave {
  position: absolute;
  right: -8%;
  bottom: -18%;
  width: min(52vw, 520px);
  height: min(42vw, 360px);
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 30% 40%, rgba(45, 106, 79, 0.28), transparent 62%),
    radial-gradient(ellipse at 70% 70%, rgba(31, 107, 69, 0.22), transparent 58%);
  border-radius: 60% 40% 55% 45%;
  filter: blur(1px);
  transform: rotate(-12deg);
}
.hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 8px;
  align-items: center;
  min-height: 0;
}
.hero-copy {
  position: relative;
  z-index: 3;
  padding: 18px 0 36px;
}
.biz-listing {
  display: grid;
  gap: 8px;
  margin: 0 0 20px;
  text-align: left;
  max-width: 38rem;
}
.biz-listing-name {
  position: relative;
  margin: 0;
  display: inline-block;
  font-family: var(--script);
  font-size: clamp(40px, 6.8vw, 58px);
  font-weight: 400;
  line-height: 1.02;
  letter-spacing: 0.02em;
  color: var(--botanical);
  text-wrap: balance;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
}
.biz-listing-name::after {
  content: "";
  display: block;
  width: min(72%, 9.5rem);
  height: 10px;
  margin: 2px auto 0;
  background:
    radial-gradient(ellipse at center, rgba(45, 106, 79, 0.35) 0%, rgba(45, 106, 79, 0) 72%);
  border-radius: 999px;
}
.biz-listing-review {
  margin: 0;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.biz-stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  line-height: 0;
}
.biz-star {
  position: relative;
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  color: rgba(196, 165, 116, 0.28);
}
.biz-star-base,
.biz-star-fill {
  display: block;
}
.biz-star-clip {
  position: absolute;
  inset: 0 auto 0 0;
  overflow: hidden;
  color: var(--gold);
}
.biz-listing-score {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--forest-deep);
  line-height: 1;
}
.biz-listing-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  line-height: 1;
}
.biz-listing-place {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: min(100%, 22rem);
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(45, 106, 79, 0.08);
  border: 1px solid rgba(45, 106, 79, 0.12);
  font-size: 13px;
  font-weight: 600;
  color: var(--forest-deep);
  line-height: 1.25;
}
.biz-listing-place svg {
  flex: 0 0 auto;
  color: var(--botanical);
}
.biz-listing-place-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hero-seo-heading {
  margin: 0 0 10px;
  font-family: var(--sans);
  font-size: clamp(15px, 2.4vw, 18px);
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--forest-deep);
  max-width: 36ch;
}
.hero-tagline {
  margin: 0;
  display: grid;
  gap: 2px;
}
.hero-h1-main {
  font-family: var(--serif);
  font-size: clamp(28px, 5.2vw, 44px);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.015em;
  color: var(--forest-deep);
}
.hero-h1-script {
  font-family: var(--script);
  font-size: clamp(34px, 6vw, 52px);
  font-weight: 400;
  line-height: 1.05;
  color: var(--botanical);
}
.hero-lead {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.6;
  max-width: 42ch;
}
.hero-actions {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.trust-row {
  margin-top: 26px;
  display: grid;
  gap: 12px;
}
.trust-item {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}
.trust-icon {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(255,255,255,0.75);
  border: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  line-height: 1;
  flex: 0 0 auto;
  box-shadow: none;
}
.trust-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}
.trust-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--forest);
}
.trust-line {
  margin: 0;
  font-size: 12px;
  line-height: 1.3;
  color: var(--muted);
}

.hero-visual {
  position: relative;
  z-index: 1;
  justify-self: center;
  align-self: center;
  width: min(100%, 240px);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-visual.empty { min-height: 220px; }
.hero-photo-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  /* Same frame on mobile + desktop so the crop matches. */
  aspect-ratio: 4 / 5;
  background: transparent;
  border-radius: 28px;
  overflow: hidden;
  box-shadow: 0 12px 28px rgba(27, 67, 50, 0.12);
}
.hero-photo-wrap.placeholder {
  display: grid;
  place-items: center;
  background: transparent;
  box-shadow: none;
}
.hero-photo-wrap::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(180deg, transparent 88%, rgba(247, 244, 236, 0.35) 100%);
}
.hero-photo {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 18%;
  display: block;
  border-radius: 0;
  box-shadow: none;
  filter: none;
}
.hero-mono {
  position: relative; z-index: 1;
  font-family: var(--serif);
  font-size: 56px; font-weight: 600; color: var(--forest); opacity: 0.45;
}

.section { padding: 48px 0; }
.section-kicker {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--botanical);
}
.section-head.center { text-align: center; margin-bottom: 28px; }
.section-head h2,
.about-intro h2,
.services-panel h2,
.contact-panel h2,
.faq-panel h2 {
  margin: 0;
  font-family: var(--serif);
  font-size: clamp(26px, 4vw, 34px);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--forest-deep);
}
.section-head.light h2 { color: #f7f3eb; }
.section-cta, .panel-cta { margin-top: 18px; text-align: center; }
.panel-sub {
  margin: 6px 0 16px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}
.lined-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  color: var(--botanical);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.lined-kicker::before,
.lined-kicker::after {
  content: "";
  height: 1px;
  flex: 0 0 22px;
  background: rgba(45, 106, 79, 0.35);
}
.lined-kicker span { white-space: nowrap; }

.about-services-section { background: var(--offwhite); }
.about-services-grid {
  display: grid;
  gap: 22px;
  align-items: start;
}
.about-col {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  grid-template-areas:
    "photo intro"
    "body body"
    "bullets bullets";
  column-gap: 14px;
  row-gap: 10px;
  align-items: start;
}
.about-photo-wrap {
  grid-area: photo;
  position: relative;
  width: 88px;
  height: 88px;
  margin: 0;
  align-self: start;
}
.about-media {
  position: relative;
  z-index: 1;
  width: 88px;
  height: 88px;
  border-radius: 999px;
  overflow: hidden;
  aspect-ratio: 1 / 1;
  background: rgba(45, 106, 79, 0.08);
  box-shadow: 0 8px 20px rgba(20, 54, 40, 0.1);
  border: 3px solid #fff;
}
.about-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
  border-radius: 999px;
}
.about-fallback {
  width: 100%; height: 100%; display: grid; place-items: center;
  font-family: var(--serif); font-size: 26px; font-weight: 600; color: var(--botanical);
  background: rgba(45, 106, 79, 0.08);
  border-radius: 999px;
}
.about-intro {
  grid-area: intro;
  min-width: 0;
  text-align: left;
  align-self: center;
}
.about-intro h2 {
  margin: 4px 0 0;
  font-size: clamp(22px, 4vw, 30px);
  line-height: 1.2;
}
.about-intro .lined-kicker {
  margin: 0 0 4px;
  justify-content: flex-start;
}
.about-text {
  grid-area: body;
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
  font-size: 14px;
}
.about-bullets {
  grid-area: bullets;
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.about-bullets li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--ink);
  line-height: 1.4;
}
.about-bullets .check {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--botanical);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 10px;
  flex: 0 0 auto;
  margin-top: 1px;
}
.services-panel-solo {
  max-width: 920px;
  margin: 0 auto;
  height: auto;
}

.services-panel {
  background: linear-gradient(180deg, #eaf3ed 0%, #e3efe7 100%);
  border-radius: 22px;
  padding: 20px 16px 18px;
  border: 0;
  height: auto;
  display: flex;
  flex-direction: column;
}
.services-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  flex: 1;
}
.service-card {
  background: rgba(255,255,255,0.88);
  border: 0;
  border-radius: 14px;
  padding: 14px 10px;
  text-align: center;
  min-height: 92px;
  box-shadow: none;
}
.service-icon-wrap {
  width: 34px;
  height: 34px;
  margin: 0 auto 8px;
  border-radius: 999px;
  background: rgba(45, 106, 79, 0.1);
  display: grid;
  place-items: center;
}
.service-emoji { font-size: 16px; line-height: 1; }
.service-card h3 {
  margin: 0;
  font-size: 12px;
  line-height: 1.3;
  font-weight: 700;
  color: var(--forest-deep);
}

.gallery-section { background: var(--offwhite); }
.gallery-section .section-head.center { margin-bottom: 22px; }
.gallery-section .panel-sub {
  margin: 8px auto 0;
  max-width: 42ch;
  text-align: center;
}
.photos-preview {
  appearance: none; border: 0; background: transparent; padding: 0; margin: 0;
  width: 100%; cursor: pointer; display: block; text-align: left;
  position: relative;
}
.photos-preview-row {
  display: grid;
  gap: 8px;
  width: 100%;
  align-items: stretch;
}
.photos-preview-tile {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  max-height: 170px;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(45, 106, 79, 0.06);
  box-shadow: none;
  justify-self: stretch;
}
.photos-preview-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: inherit;
}

.reviews-section {
  position: relative;
  background: linear-gradient(160deg, var(--forest-deep), var(--forest) 55%, #1f5a46);
  color: #fff;
  overflow: hidden;
}
.reviews-leaves {
  position: absolute;
  inset: 0;
  opacity: 0.12;
  background-image:
    radial-gradient(circle at 12% 20%, rgba(255,255,255,0.35) 0 1px, transparent 2px),
    radial-gradient(circle at 80% 30%, rgba(255,255,255,0.25) 0 1.5px, transparent 3px),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cpath fill='%23ffffff' d='M40 20c8 22 6 40-4 56-12 18-28 30-42 36 16-5 32-16 41-34 8-15 10-32 5-58zm50 24c14 16 24 24 42 30-16 1-30-5-43-18-6-6-10-12-12-20 5 2 8 5 13 8z'/%3E%3C/svg%3E");
  background-size: 24px 24px, 36px 36px, 160px 160px;
  pointer-events: none;
}
.reviews-gold {
  margin: 8px 0 0;
  color: var(--gold);
  font-size: 14px;
  font-weight: 600;
}
.review-carousel {
  position: relative;
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  gap: 8px;
  align-items: center;
}
.carousel-btn {
  appearance: none;
  border: 1px solid rgba(255,255,255,0.28);
  background: rgba(255,255,255,0.08);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.review-track {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.review-card {
  background: #fff;
  color: var(--ink);
  border-radius: 16px;
  padding: 18px 14px 14px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.14);
  position: relative;
  text-align: left;
}
.review-card:nth-child(n + 2) { display: none; }
.review-mark {
  position: absolute;
  top: 4px;
  left: 12px;
  font-family: var(--serif);
  font-size: 42px;
  line-height: 1;
  color: var(--botanical);
  opacity: 0.45;
}
.review-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-top: 10px;
}
.review-avatar {
  width: 48px;
  height: 48px;
  margin: 0;
  border-radius: 999px;
  background: var(--sage);
  color: var(--forest);
  display: grid;
  place-items: center;
  font-family: var(--serif);
  font-size: 16px;
  font-weight: 600;
  border: 2px solid #fff;
  box-shadow: 0 4px 12px rgba(20,54,40,0.1);
  flex: 0 0 auto;
}
.review-body { min-width: 0; }
.review-quote {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
}
.review-name {
  margin: 8px 0 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--forest);
}
.review-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 16px;
  position: relative;
}
.review-dots .dot {
  appearance: none;
  border: 0;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(255,255,255,0.35);
  padding: 0;
  cursor: pointer;
}
.review-dots .dot.active {
  width: 22px;
  background: var(--gold);
}
.media-carousel {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
}
.media-carousel.no-arrows {
  grid-template-columns: minmax(0, 1fr);
}
.media-carousel-track {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  min-width: 0;
}
.media-carousel-track[data-count="2"] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.media-carousel-track[data-count="3"] {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.media-carousel-btn {
  appearance: none;
  border: 1px solid rgba(45, 106, 79, 0.28);
  background: #fff;
  color: var(--forest-deep);
  width: 40px;
  height: 40px;
  border-radius: 999px;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow: 0 6px 16px rgba(20, 54, 40, 0.08);
  flex: 0 0 auto;
}
.media-carousel-btn:hover { background: var(--sage); }
.media-carousel-dark .media-carousel-btn {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.28);
  color: #fff;
  box-shadow: none;
}
.media-carousel-dark .media-carousel-btn:hover {
  background: rgba(255,255,255,0.18);
}
.say-video-card {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 18px;
  overflow: hidden;
  padding: 10px;
  min-width: 0;
}
.say-video {
  width: 100%;
  max-height: 320px;
  border-radius: 12px;
  background: #000;
  display: block;
}
.say-video-name {
  margin: 10px 4px 2px;
  color: #f3e6c8;
  font-size: 13px;
  font-weight: 700;
}

.what-we-do-section {
  position: relative;
  background:
    linear-gradient(180deg, #f3efe6 0%, #faf7f1 48%, #eef5f0 100%);
  overflow: hidden;
}
.do-wash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 50% 40% at 12% 20%, rgba(45, 106, 79, 0.08), transparent 70%),
    radial-gradient(ellipse 45% 35% at 88% 75%, rgba(196, 165, 116, 0.14), transparent 72%);
}
.what-we-do-inner { position: relative; z-index: 1; }
.do-kicker {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--botanical);
}
.do-sub {
  margin-left: auto;
  margin-right: auto;
  max-width: 40ch;
  text-align: center;
}
.do-transform-card {
  background: #fff;
  border: 1px solid rgba(27, 77, 62, 0.1);
  border-radius: 22px;
  padding: 12px 12px 14px;
  box-shadow: 0 14px 34px rgba(20, 54, 40, 0.08);
  min-width: 0;
}
.do-transform-pair {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: stretch;
}
.do-pair-arrow {
  position: absolute;
  left: 50%;
  top: 46%;
  z-index: 2;
  transform: translate(-50%, -50%);
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: var(--botanical);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(27, 77, 62, 0.28);
  pointer-events: none;
}
.do-shot {
  position: relative;
  margin: 0;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(45, 106, 79, 0.06);
}
.do-shot-after {
  box-shadow: inset 0 0 0 2px rgba(45, 106, 79, 0.18);
}
.do-shot img {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  display: block;
}
.do-shot-badge {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
  background: rgba(26, 42, 34, 0.72);
  backdrop-filter: blur(6px);
}
.do-shot-badge-after {
  background: rgba(45, 106, 79, 0.88);
}
.do-transform-meta {
  margin-top: 12px;
  padding: 0 4px;
}
.do-transform-who {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.do-transform-name {
  margin: 0;
  font-weight: 700;
  color: var(--forest-deep);
  font-size: 14px;
}
.do-transform-duration {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(45, 106, 79, 0.1);
  color: var(--botanical);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.ratings-section {
  background: linear-gradient(180deg, #fafaf8 0%, #f3efe6 100%);
}
.ratings-kicker {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--botanical);
}
.ratings-sub {
  margin-left: auto;
  margin-right: auto;
  max-width: 40ch;
  text-align: center;
}
.rating-summary {
  text-align: center;
  margin: 8px auto 22px;
}
.rating-score {
  margin: 0;
  font-family: var(--serif);
  font-size: clamp(40px, 7vw, 52px);
  font-weight: 600;
  line-height: 1;
  color: var(--forest-deep);
}
.rating-stars {
  margin: 8px 0 0;
  color: var(--gold);
  font-size: 22px;
  letter-spacing: 0.08em;
  line-height: 1;
}
.rating-count {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.ratings-empty {
  margin: 0 auto 18px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
.rating-card {
  background: #fff;
  border: 1px solid rgba(27, 77, 62, 0.1);
  border-radius: 18px;
  padding: 18px 16px 16px;
  box-shadow: 0 12px 28px rgba(20, 54, 40, 0.06);
  min-width: 0;
  text-align: left;
  height: 100%;
}
.rating-card-stars {
  margin: 0 0 10px;
  color: var(--gold);
  font-size: 16px;
  letter-spacing: 0.06em;
  line-height: 1;
}
.rating-card-quote {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.55;
}
.rating-card-name {
  margin: 14px 0 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--forest-deep);
}
.ratings-cta {
  margin-top: 22px;
  text-align: center;
}
.ratings-cta .btn {
  min-width: 200px;
}

.faq-contact-section { background: var(--sage); }
.faq-contact-grid {
  display: grid;
  gap: 28px;
}
.faq-list { margin-top: 16px; display: grid; gap: 10px; }
.faq-item {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 6px 16px rgba(20,54,40,0.04);
}
.faq-q {
  width: 100%;
  appearance: none; border: 0; background: transparent;
  display: flex; justify-content: space-between; gap: 12px; align-items: center;
  text-align: left; padding: 16px 16px; font: inherit; font-weight: 700;
  cursor: pointer; color: var(--forest-deep);
}
.faq-plus {
  width: 28px; height: 28px; border-radius: 999px;
  background: var(--sage); color: var(--botanical);
  display: grid; place-items: center; flex: 0 0 auto; font-size: 18px;
}
.faq-a {
  margin: 0;
  padding: 0 16px 16px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.55;
}
.contact-list {
  list-style: none;
  margin: 18px 0 20px;
  padding: 0;
  display: grid;
  gap: 14px;
}
.contact-list li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.contact-ico {
  width: 36px; height: 36px; border-radius: 999px;
  background: #fff; border: 1px solid var(--line);
  display: grid; place-items: center; flex: 0 0 auto;
}
.contact-label {
  display: block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--botanical);
  margin-bottom: 3px;
}
.contact-list a, .contact-list p {
  margin: 0;
  text-decoration: none;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.4;
  font-size: 14px;
}
.faq-panel,
.contact-panel {
  min-width: 0;
}
.contact-panel {
  display: flex;
  flex-direction: column;
}
.contact-panel .btn {
  align-self: flex-start;
}
.map-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}
.map-frame {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  min-height: 240px;
  flex: 1;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}
.map-frame iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.map-directions {
  width: 100%;
  justify-content: center;
  text-align: center;
}
.map-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  gap: 6px;
  color: var(--muted);
  font-weight: 600;
  padding: 16px;
}

.site-footer {
  background: var(--forest-deep);
  color: #dceee4;
  padding: 42px 0 34px;
}
.footer-grid {
  display: grid;
  gap: 28px;
}
.footer-brand-block img { display: block; }
.footer-brand {
  margin: 12px 0 6px;
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 600;
  color: #fff;
}
.footer-copy { margin: 0; font-size: 12px; opacity: 0.7; }
.footer-label {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--gold);
}
.footer-social { display: flex; flex-wrap: wrap; gap: 10px; }
.social-ico {
  width: 38px; height: 38px; border-radius: 999px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.16);
  display: grid; place-items: center;
  text-decoration: none;
  color: #fff;
}
.social-ico svg { display: block; }
.footer-muted { opacity: 0.7; font-size: 14px; }

.float-wa {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 35;
  width: 58px;
  height: 58px;
  border-radius: 999px;
  background: #25d366;
  color: #08381c;
  display: grid;
  place-items: center;
  box-shadow: 0 14px 30px rgba(37,211,102,0.42);
  text-decoration: none;
}

.book-modal {
  position: fixed; inset: 0; z-index: 90;
  display: grid; place-items: center; padding: 16px;
}
.book-backdrop {
  position: absolute; inset: 0; border: 0;
  background: rgba(10, 20, 14, 0.55); cursor: pointer;
}
.book-panel {
  position: relative; z-index: 1;
  width: min(440px, 100%);
  background: #fff;
  border-radius: 22px;
  padding: 22px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.22);
}
.book-panel-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.book-panel-head h3 {
  margin: 0;
  font-family: var(--serif);
  font-size: 28px;
  font-weight: 600;
  color: var(--forest-deep);
}
.book-close {
  appearance: none; border: 0; background: var(--sage);
  width: 34px; height: 34px; border-radius: 999px; cursor: pointer;
}
.book-lead { margin: 10px 0 16px; color: var(--muted); font-size: 14px; line-height: 1.5; }
.book-form { display: grid; gap: 12px; }
.book-field { display: grid; gap: 6px; font-size: 12px; font-weight: 700; color: var(--forest); }
.book-field input,
.book-field textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 11px 12px;
  font: inherit;
  font-weight: 500;
  background: var(--offwhite);
}
.book-submit { width: 100%; margin-top: 4px; }

/* Gallery / lightbox */
.photo-album-play {
  width: 52px; height: 52px; border-radius: 999px;
  background: rgba(15, 22, 18, 0.72); color: #fff;
  border: 2px solid rgba(255,255,255,0.88);
  display: grid; place-items: center; font-size: 16px; padding-left: 3px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  pointer-events: none;
}
.gallery-videos {
  display: grid;
  gap: 10px;
  margin-bottom: 4px;
}
.gallery-tile.is-video {
  aspect-ratio: 16 / 9;
  min-height: 0;
  width: 100%;
  background: #0a100e;
}
.gallery-tile-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #0a100e;
}
.gallery-shell {
  position: fixed; inset: 0; z-index: 70;
  background: #0f1612; color: #fff;
  display: flex; flex-direction: column;
  overflow: auto;
}
.gallery-brand {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
}
.gallery-brand-logo { width: 32px; height: 32px; object-fit: contain; }
.gallery-brand-name { margin: 0; font-family: var(--serif); font-weight: 600; flex: 1; font-size: 20px; }
.gallery-close, .lightbox-close {
  appearance: none; border: 0; background: rgba(255,255,255,0.1);
  color: #fff; border-radius: 999px; padding: 8px 12px; cursor: pointer; font-weight: 700;
}
.gallery-top { padding: 12px 12px 0; }
.gallery-tabs {
  display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px;
}
.gallery-tab {
  appearance: none; border: 0; background: rgba(255,255,255,0.08);
  color: #fff; border-radius: 999px; padding: 8px 12px; white-space: nowrap;
  font-weight: 600; cursor: pointer;
}
.gallery-tab.active { background: #25d366; color: #08381c; }
.gallery-masonry {
  padding: 12px;
  display: grid;
  gap: 8px;
  width: min(720px, 100%);
  margin: 0 auto;
}
.gallery-bento {
  display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 8px;
}
.gallery-bento.single { grid-template-columns: 1fr; }
.gallery-bento-right { display: grid; gap: 8px; }
.gallery-tile {
  appearance: none; border: 0; padding: 0; margin: 0;
  position: relative; overflow: hidden; border-radius: 12px;
  background: #1b2620; cursor: pointer; min-height: 88px;
}
.gallery-tile img { width: 100%; height: 100%; object-fit: cover; display: block; min-height: 88px; }
.gallery-tile.tall { min-height: 160px; }
.gallery-tile.wide { min-height: 96px; }
.gallery-tile.is-video.wide { min-height: 0; }
.gallery-tile .photo-album-play { position: absolute; inset: 0; margin: auto; }
.gallery-transforms { padding: 12px; display: grid; gap: 14px; }
.gallery-transform-card {
  background: rgba(255,255,255,0.05); border-radius: 16px; padding: 12px;
}
.gallery-transform-label { margin: 0 0 10px; font-weight: 700; }
.transform-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.transform-shot {
  appearance: none; border: 0; padding: 0; background: transparent; color: #fff;
  border-radius: 12px; overflow: hidden; cursor: pointer; text-align: left;
}
.transform-shot img { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; }
.transform-shot span {
  display: block; padding: 8px 4px 2px; font-size: 12px; font-weight: 700; opacity: 0.85;
}
.lightbox {
  position: fixed; inset: 0; z-index: 80;
  display: grid; place-items: center;
}
.lightbox-backdrop {
  position: absolute; inset: 0; border: 0; background: rgba(0,0,0,0.72); cursor: pointer;
}
.lightbox-panel {
  position: relative; z-index: 1;
  width: min(560px, calc(100% - 32px));
  background: #0f1612; border-radius: 16px; overflow: hidden;
}
.lightbox-panel img, .intro-video {
  width: 100%; max-height: min(52vh, 420px); object-fit: contain; display: block; background: #000; margin: 0 auto;
}
.lightbox-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px;
}
.lightbox-nav {
  appearance: none; border: 0; background: rgba(255,255,255,0.1); color: #fff;
  border-radius: 999px; padding: 8px 12px; font-weight: 700; cursor: pointer;
}
.lightbox-meta { text-align: center; color: #fff; }
.lightbox-cap, .lightbox-count { margin: 0; font-size: 12px; }
.lightbox-close { position: absolute; top: 10px; right: 10px; }

@media (min-width: 720px) {
  .desk-nav { display: flex; }
  .btn.header-cta { display: inline-flex; margin-left: auto; }
  .menu-btn { display: none; }
  .hero { padding: 20px 0 0; }
  .hero-grid {
    grid-template-columns: minmax(0, 1.05fr) minmax(260px, 320px);
    gap: 28px;
    align-items: center;
    min-height: 460px;
  }
  .hero-copy { padding: 28px 0 48px; }
  .hero-visual {
    width: 100%;
    max-width: 280px;
    margin: 0 auto;
    justify-self: center;
    align-self: center;
  }
  .hero-photo-wrap {
    aspect-ratio: 4 / 5;
    max-height: 360px;
    border-radius: 32px;
  }
  .hero-wave {
    /* Keep wash subtle so it doesn’t look like a blur around the portrait. */
    right: -6%;
    bottom: -18%;
    width: min(36vw, 380px);
    height: min(28vw, 280px);
    opacity: 0.45;
    filter: blur(2px);
  }
  .trust-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    align-items: center;
  }
  .trust-item { gap: 10px; }
  /* Keep About + Services stacked until wide desktop — tablet side-by-side was too tight */
  .about-services-grid {
    grid-template-columns: 1fr;
    gap: 24px;
    align-items: start;
  }
  .about-col {
    grid-template-columns: 104px minmax(0, 1fr);
    grid-template-areas:
      "photo intro"
      "photo body"
      "photo bullets";
    column-gap: 18px;
    row-gap: 8px;
  }
  .about-photo-wrap,
  .about-media { width: 104px; height: 104px; }
  .about-intro { align-self: start; padding-top: 4px; }
  .services-panel { height: auto; }
  .services-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .services-panel .panel-cta { margin-top: 14px; }
  .photos-preview {
    max-width: 560px;
    margin-left: auto;
    margin-right: auto;
  }
  .photos-preview::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
      linear-gradient(90deg, var(--offwhite) 0%, rgba(250,250,248,0) 7%, rgba(250,250,248,0) 93%, var(--offwhite) 100%),
      linear-gradient(0deg, var(--offwhite) 0%, rgba(250,250,248,0) 16%),
      linear-gradient(180deg, var(--offwhite) 0%, rgba(250,250,248,0) 12%);
  }
  .photos-preview-row { gap: 8px; }
  .photos-preview-tile {
    max-height: none;
    aspect-ratio: auto;
    height: 168px;
    border-radius: 14px;
  }
  .review-track { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .media-carousel-track { gap: 18px; }
  .review-card:nth-child(n + 2) { display: block; }
  .faq-contact-grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    gap: 28px;
    align-items: start;
  }
  .map-panel {
    grid-column: 1 / -1;
  }
  .map-frame {
    min-height: 280px;
    height: 280px;
    flex: 0 0 auto;
  }
  .footer-grid { grid-template-columns: 1.4fr 1fr; gap: 28px; align-items: start; }
}

@media (min-width: 980px) {
  .about-services-grid {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    gap: 36px;
    align-items: start;
  }
  .about-col {
    grid-template-columns: 120px minmax(0, 1fr);
    grid-template-areas:
      "photo intro"
      "photo body"
      "photo bullets";
    column-gap: 20px;
    row-gap: 10px;
  }
  .about-photo-wrap,
  .about-media { width: 120px; height: 120px; }
  .about-fallback { font-size: 32px; }
  .about-intro h2 { font-size: 30px; }
  .services-panel {
    height: auto;
    padding: 24px 22px 20px;
    align-self: start;
  }
  .photos-preview { max-width: 600px; }
  .photos-preview-tile { height: 180px; border-radius: 14px; }
  .gallery-masonry { width: min(760px, 100%); }
  .gallery-tile.tall { min-height: 180px; }
  .gallery-tile.wide { min-height: 108px; }
  .lightbox-panel { width: min(600px, calc(100% - 40px)); }
  .faq-contact-grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr) minmax(0, 1fr);
    gap: 28px;
    align-items: stretch;
  }
  .faq-contact-grid.no-map {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr);
  }
  .faq-panel,
  .contact-panel,
  .map-panel {
    height: 100%;
  }
  .contact-panel .btn {
    margin-top: auto;
  }
  .map-panel {
    grid-column: auto;
    min-height: 0;
    height: auto;
    align-self: stretch;
  }
  .map-frame {
    min-height: 0;
    height: auto;
    flex: 1 1 auto;
  }
}

@media (max-width: 719px) {
  .shell { width: min(1140px, calc(100% - 28px)); }
  :root { --header-h: 76px; }
  .header-row { gap: 12px; }
  .brand-logo { width: 60px; height: 60px; }
  .section { padding: 36px 0; }
  .section-head.center { margin-bottom: 20px; }
  .section-head h2,
  .services-panel h2,
  .contact-panel h2,
  .faq-panel h2 {
    font-size: clamp(24px, 7vw, 30px);
  }

  .hero { padding: 8px 0 0; }
  .hero-grid {
    grid-template-columns: 1fr;
    align-items: center;
    gap: 2px;
  }
  .hero-visual {
    order: -1;
    width: min(58%, 210px);
    margin: 8px auto 0;
  }
  .hero-photo-wrap {
    aspect-ratio: 4 / 5;
    border-radius: 26px;
  }
  .hero-copy {
    text-align: center;
    padding: 8px 0 26px;
  }
  /* One accent script only ("Starts Here"); center name stays solid serif. */
  .biz-listing {
    gap: 8px;
    margin: 0 auto 18px;
    justify-items: center;
    text-align: center;
    max-width: 100%;
  }
  .biz-listing-name {
    font-family: var(--script);
    font-size: clamp(42px, 12vw, 52px);
    font-weight: 400;
    letter-spacing: 0.02em;
    color: var(--botanical);
    line-height: 1.02;
  }
  .biz-listing-name::after {
    width: min(68%, 8rem);
    height: 9px;
  }
  .biz-listing-review { justify-content: center; gap: 6px; }
  .biz-listing-place {
    justify-content: center;
    max-width: min(100%, 20rem);
    padding: 0;
    border: 0;
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .biz-listing-score { font-size: 15px; }
  .biz-listing-count { font-size: 12px; }
  .hero-tagline { gap: 4px; }
  .hero-h1-main {
    font-size: clamp(26px, 7.4vw, 34px);
    line-height: 1.14;
  }
  .hero-h1-script {
    font-size: clamp(38px, 11vw, 48px);
    line-height: 1;
  }
  .trust-row { display: none; }
  .hero-lead {
    margin: 10px auto 0;
    font-size: 13px;
    max-width: 30ch;
  }
  .hero-actions {
    margin-top: 20px;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .hero-actions .btn {
    width: 100%;
    padding: 15px 18px;
    font-size: 15px;
    font-weight: 700;
    border-radius: 999px;
  }
  .hero-actions .btn-outline {
    background: transparent;
  }
  /* Same photo fade as base — do not swap crop/vignette on mobile. */
  /* Hero already has WhatsApp CTA — hide floating duplicate on small screens. */
  .float-wa { display: none; }

  /* About mobile: avatar | title row, then full-width text + bullets */
  .about-services-grid { gap: 18px; }
  .about-col {
    grid-template-columns: 72px minmax(0, 1fr);
    grid-template-areas:
      "photo intro"
      "body body"
      "bullets bullets";
    column-gap: 12px;
    row-gap: 10px;
  }
  .about-photo-wrap,
  .about-media {
    width: 72px;
    height: 72px;
    margin: 0;
  }
  .about-fallback { font-size: 22px; }
  .about-intro { align-self: center; }
  .about-intro h2 { font-size: 20px; }
  .about-intro .lined-kicker {
    font-size: 10px;
    gap: 6px;
  }
  .about-intro .lined-kicker::before,
  .about-intro .lined-kicker::after {
    flex: 0 0 10px;
  }
  .about-text { font-size: 13px; }
  .about-bullets { gap: 8px; }
  .about-bullets li { font-size: 12px; }

  .services-panel {
    height: auto;
    padding: 18px 14px 16px;
    border-radius: 18px;
  }
  .services-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .service-card {
    min-height: 0;
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    text-align: left;
    padding: 14px 14px;
  }
  .service-icon-wrap { margin: 0; }
  .service-card h3 { font-size: 14px; }

  /* Gallery mobile: keep compact strip — do not inherit desktop fill/blend */
  .photos-preview::after { content: none; }
  .photos-preview-row { gap: 8px; }
  .photos-preview-tile {
    max-height: 148px;
    aspect-ratio: 3 / 4;
    border-radius: 14px;
  }

  .media-carousel {
    grid-template-columns: 34px minmax(0, 1fr) 34px;
    gap: 6px;
  }
  .media-carousel.no-arrows { grid-template-columns: minmax(0, 1fr); }
  .media-carousel-btn { width: 34px; height: 34px; font-size: 20px; }
  .say-video { max-height: 240px; }

  .faq-contact-section { padding: 36px 0; }
  .faq-contact-grid { gap: 18px; }
  .faq-panel,
  .contact-panel {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 18px 16px 16px;
    box-shadow: 0 8px 20px rgba(20, 54, 40, 0.04);
  }
  .faq-q {
    padding: 14px 14px;
    font-size: 14px;
    gap: 10px;
  }
  .faq-a { font-size: 13px; padding: 0 14px 14px; }
  .contact-list { margin: 14px 0 0; gap: 12px; }
  .map-panel { gap: 10px; }
  .map-frame {
    min-height: 220px;
    height: 220px;
    flex: 0 0 auto;
    border-radius: 16px;
  }
  .map-directions {
    padding: 13px 18px;
    font-size: 13px;
  }

  .site-footer { padding: 32px 0 88px; }
  .footer-grid { gap: 22px; text-align: center; }
  .footer-brand-block {
    display: grid;
    justify-items: center;
  }
  .footer-social { justify-content: center; }
  .float-wa {
    right: 14px;
    bottom: 14px;
    width: 54px;
    height: 54px;
  }
}

@media (max-width: 560px) {
  .shell { width: calc(100% - 24px); }
  .hero-visual { width: min(56%, 200px); }
  .about-col {
    grid-template-columns: 64px minmax(0, 1fr);
    column-gap: 10px;
  }
  .about-photo-wrap,
  .about-media {
    width: 64px;
    height: 64px;
  }
  .about-intro h2 { font-size: 18px; }
  .about-text { font-size: 12.5px; }
  .photos-preview-tile { max-height: 132px; }
}

`;
