/**
 * Server-side Transformation share card (JPEG) for coach OTP emails.
 * Built from real Before/After storage bytes — never from a client html2canvas
 * capture (which can bake Mine edit UI into the After slot).
 */
import sharp from 'sharp';

const CARD_W = 540;
const CARD_H = 960;
const HEADER_H = 62;
const NAME_H = 52;
const PHOTO_TOP = HEADER_H + NAME_H;
const PHOTO_GAP = 8;
const PHOTO_SIDE_PAD = 12;
const PHOTO_W = Math.floor((CARD_W - PHOTO_SIDE_PAD * 2 - PHOTO_GAP) / 2);
const PHOTO_H = 420;
const META_H = 52;

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Cover-top crop a photo into a fixed portrait slot.
 * @param {Buffer} input
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Buffer>}
 */
async function coverTopJpeg(input, width, height) {
  return sharp(input)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/**
 * @param {{
 *   beforeBuffer: Buffer,
 *   afterBuffer: Buffer,
 *   memberName?: string|null,
 *   beforeWeightKg?: number|null,
 *   afterWeightKg?: number|null,
 *   goalType?: string|null,
 *   durationText?: string|null,
 *   appVersionLabel?: string|null,
 * }} opts
 * @returns {Promise<Buffer>} image/jpeg bytes
 */
export async function composeTransformationShareCardJpeg(opts) {
  const beforeBuffer = opts?.beforeBuffer;
  const afterBuffer = opts?.afterBuffer;
  if (!Buffer.isBuffer(beforeBuffer) || !beforeBuffer.length) {
    throw new Error('Before photo required for share card');
  }
  if (!Buffer.isBuffer(afterBuffer) || !afterBuffer.length) {
    throw new Error('After photo required for share card');
  }

  const beforeSlot = await coverTopJpeg(beforeBuffer, PHOTO_W, PHOTO_H);
  const afterSlot = await coverTopJpeg(afterBuffer, PHOTO_W, PHOTO_H);

  const name = escapeXml(String(opts.memberName || 'Customer').trim() || 'Customer');
  const beforeKg = escapeXml(formatKg(opts.beforeWeightKg));
  const afterKg = escapeXml(formatKg(opts.afterWeightKg));
  const bw = Number(opts.beforeWeightKg);
  const aw = Number(opts.afterWeightKg);
  const hasDiff = Number.isFinite(bw) && Number.isFinite(aw) && bw > 0 && aw > 0;
  const diff = hasDiff ? Math.abs(aw - bw).toFixed(1) : null;
  const isLoss = opts.goalType !== 'gain';
  const verb = isLoss ? 'Lost' : 'Gained';
  const duration = String(opts.durationText || '').trim();
  const pill = diff
    ? `${verb} ${diff} kgs${duration ? ` in ${escapeXml(duration)}` : ''}`
    : '';
  const version = escapeXml(String(opts.appVersionLabel || '').trim());

  const beforeX = PHOTO_SIDE_PAD;
  const afterX = PHOTO_SIDE_PAD + PHOTO_W + PHOTO_GAP;
  const metaY = PHOTO_TOP + PHOTO_H + 8;
  const pillY = metaY + META_H + 8;

  const svg = Buffer.from(`
    <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <rect x="0" y="0" width="${CARD_W}" height="${HEADER_H}" fill="#059669"/>
      <text x="16" y="28" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" fill="#ffffff">Wellness Valley${version ? ` (${version})` : ''}</text>
      <text x="16" y="48" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" fill="#a7f3d0">Transformation Results</text>
      <text x="${CARD_W / 2}" y="${HEADER_H + 34}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#111827">${name}</text>
      <rect x="${beforeX}" y="${PHOTO_TOP + PHOTO_H - 36}" width="${PHOTO_W}" height="28" rx="6" fill="#e11d72"/>
      <text x="${beforeX + PHOTO_W / 2}" y="${PHOTO_TOP + PHOTO_H - 16}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Before</text>
      <rect x="${afterX}" y="${PHOTO_TOP + PHOTO_H - 36}" width="${PHOTO_W}" height="28" rx="6" fill="#16a34a"/>
      <text x="${afterX + PHOTO_W / 2}" y="${PHOTO_TOP + PHOTO_H - 16}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#ffffff">After</text>
      <text x="${beforeX + PHOTO_W / 2}" y="${metaY + 14}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#9ca3af">BEFORE</text>
      <text x="${beforeX + PHOTO_W / 2}" y="${metaY + 36}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800" fill="#111827">${beforeKg} kg</text>
      <text x="${afterX + PHOTO_W / 2}" y="${metaY + 14}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#9ca3af">AFTER</text>
      <text x="${afterX + PHOTO_W / 2}" y="${metaY + 36}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800" fill="#111827">${afterKg} kg</text>
      ${pill ? `<rect x="${(CARD_W - 280) / 2}" y="${pillY}" width="280" height="32" rx="16" fill="#dbeafe"/>
      <text x="${CARD_W / 2}" y="${pillY + 21}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="800" fill="#2563eb">${pill}</text>` : ''}
    </svg>
  `);

  return sharp({
    create: {
      width: CARD_W,
      height: CARD_H,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .jpeg({ quality: 85, mozjpeg: true })
    .composite([
      { input: beforeSlot, top: PHOTO_TOP, left: beforeX },
      { input: afterSlot, top: PHOTO_TOP, left: afterX },
      { input: svg, top: 0, left: 0 },
    ])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}
