/**
 * Diff draft FormJson vs last PublishedFormJson for coach publish OTP emails.
 */
import { normalizeFormJson } from './submission.rules.js';

function cleanLine(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function truncate(value, max = 120) {
  const text = cleanLine(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function hasMedia(value) {
  if (!value) return false;
  if (typeof value === 'string') return Boolean(value.trim());
  if (typeof value === 'object') {
    return Boolean(value.url || value.src || value.path || value.key);
  }
  return false;
}

function countMediaList(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter((item) => hasMedia(item) || (typeof item === 'string' && item.trim())).length;
}

function titleLabel(personal = {}) {
  const title = cleanLine(personal.professionalTitle);
  const other = cleanLine(personal.professionalTitleOther);
  if (title === 'Other' && other) return other;
  return title;
}

function mediaSummary(form) {
  const personal = form.personal || {};
  const media = form.mediaBrand || {};
  return {
    profilePhoto: hasMedia(personal.profilePhoto) ? 'Yes' : 'No',
    entrancePhoto: hasMedia(media.entrancePhoto) ? 'Yes' : 'No',
    interiorCount: String(countMediaList(media.interiorPhotos)),
    activityCount: String(countMediaList(media.activityPhotos)),
    introVideo: (
      hasMedia(media.introVideoUrl)
      || cleanLine(media.introVideoLink)
      || cleanLine(media.introVideoKey)
      || countMediaList(media.introVideos) > 0
    ) ? 'Yes' : 'No',
  };
}

function snapshotFields(form) {
  const f = normalizeFormJson(form || {});
  const personal = f.personal || {};
  const center = f.center || {};
  const media = f.mediaBrand || {};
  const mediaBits = mediaSummary(f);
  return [
    { key: 'displayName', label: 'Website display name', value: cleanLine(media.websiteDisplayName) },
    { key: 'fullName', label: 'Full name', value: cleanLine(personal.fullName) },
    { key: 'title', label: 'Professional title', value: titleLabel(personal) },
    { key: 'city', label: 'City', value: cleanLine(center.city) },
    { key: 'locality', label: 'Area', value: cleanLine(center.locality) },
    { key: 'centerName', label: 'Center name', value: cleanLine(center.centerName) },
    { key: 'phone', label: 'Phone', value: cleanLine(center.businessPhone) },
    { key: 'whatsapp', label: 'WhatsApp', value: cleanLine(center.whatsapp) },
    { key: 'email', label: 'Business email', value: cleanLine(center.businessEmail) },
    { key: 'years', label: 'Years of experience', value: cleanLine(personal.yearsExperience) },
    { key: 'background', label: 'About / background', value: truncate(personal.background, 140) },
    { key: 'approach', label: 'What you believe in', value: truncate(personal.uniqueApproach, 140) },
    { key: 'profilePhoto', label: 'Profile photo', value: mediaBits.profilePhoto },
    { key: 'entrancePhoto', label: 'Entrance photo', value: mediaBits.entrancePhoto },
    { key: 'interiorCount', label: 'Interior photos', value: mediaBits.interiorCount },
    { key: 'activityCount', label: 'Activity photos', value: mediaBits.activityCount },
    { key: 'introVideo', label: 'Intro video', value: mediaBits.introVideo },
  ];
}

/**
 * @param {object|null|undefined} previousForm PublishedFormJson (or null for first publish)
 * @param {object|null|undefined} nextForm Draft FormJson
 * @returns {{ isFirstPublish: boolean, changes: Array<{ key: string, label: string, before: string, after: string, kind: 'new'|'changed' }> }}
 */
export function buildPublishFormDiff(previousForm, nextForm) {
  const nextFields = snapshotFields(nextForm);
  const isFirstPublish = previousForm == null
    || (typeof previousForm === 'object' && Object.keys(normalizeFormJson(previousForm).personal || {}).length === 0
      && !cleanLine(normalizeFormJson(previousForm).mediaBrand?.websiteDisplayName));

  // Treat missing/empty published snapshot as first publish.
  let previousFields;
  if (previousForm == null) {
    previousFields = nextFields.map((f) => ({ ...f, value: '' }));
  } else {
    const prevNormalized = normalizeFormJson(previousForm);
    const hasAny = Boolean(
      cleanLine(prevNormalized.mediaBrand?.websiteDisplayName)
      || cleanLine(prevNormalized.personal?.fullName)
      || cleanLine(prevNormalized.center?.city),
    );
    if (!hasAny) {
      previousFields = nextFields.map((f) => ({ ...f, value: '' }));
    } else {
      previousFields = snapshotFields(previousForm);
    }
  }

  const prevByKey = new Map(previousFields.map((f) => [f.key, f.value]));
  const changes = [];
  for (const field of nextFields) {
    const before = String(prevByKey.get(field.key) ?? '');
    const after = String(field.value ?? '');
    if (before === after) continue;
    if (!before && !after) continue;
    changes.push({
      key: field.key,
      label: field.label,
      before,
      after,
      kind: before ? 'changed' : 'new',
    });
  }

  return {
    isFirstPublish: changes.every((c) => c.kind === 'new') && changes.length > 0
      ? true
      : previousForm == null || changes.every((c) => !c.before),
    changes,
  };
}

/**
 * Plain-text block for email.
 * @param {{ changes: Array<{ label: string, before: string, after: string, kind: string }>, isFirstPublish?: boolean }} diff
 */
export function formatPublishDiffText(diff) {
  const changes = Array.isArray(diff?.changes) ? diff.changes : [];
  if (!changes.length) {
    return ['Changes: (no field changes detected — publish refreshes the live site from the current draft).'];
  }
  const lines = [diff?.isFirstPublish ? 'Changes (first publish):' : 'Changes:'];
  for (const item of changes) {
    if (item.kind === 'new' || !item.before) {
      lines.push(`- ${item.label}: ${item.after || '—'} (new)`);
    } else {
      lines.push(`- ${item.label}: ${item.before || '—'} → ${item.after || '—'}`);
    }
  }
  return lines;
}

/**
 * HTML table rows for changed fields (highlighted).
 * @param {{ changes: Array<{ label: string, before: string, after: string, kind: string }> }} diff
 * @param {(s: string) => string} escapeHtml
 */
export function formatPublishDiffHtml(diff, escapeHtml) {
  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s ?? '');
  const changes = Array.isArray(diff?.changes) ? diff.changes : [];
  if (!changes.length) {
    return `<p style="margin:0;color:#6b7280;font-size:13px;font-family:Arial,Helvetica,sans-serif;">No field changes detected — publish refreshes the live site from the current draft.</p>`;
  }
  const rows = changes.map((item) => {
    const badge = item.kind === 'new' || !item.before
      ? `<span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:2px 6px;border-radius:999px;">New</span>`
      : `<span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:2px 6px;border-radius:999px;">Changed</span>`;
    const beforeCell = item.before
      ? `<div style="color:#6b7280;text-decoration:line-through;font-size:12px;">${esc(item.before)}</div>`
      : `<div style="color:#9ca3af;font-size:12px;">—</div>`;
    const afterCell = `<div style="color:#111827;font-size:13px;font-weight:700;">${esc(item.after || '—')}</div>`;
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;width:28%;font-family:Arial,Helvetica,sans-serif;">
        <div style="color:#374151;font-size:12px;font-weight:600;">${esc(item.label)}</div>
        <div style="margin-top:4px;">${badge}</div>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;font-family:Arial,Helvetica,sans-serif;">
        ${beforeCell}
        ${afterCell}
      </td>
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${rows}</table>`;
}
