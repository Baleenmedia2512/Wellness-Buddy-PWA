/**
 * Server-side Transformation share card (JPEG) for coach OTP emails.
 * Fallback when the client does not send a captured share card.
 * Uses embedded Noto Sans so text is not tofu boxes on Linux/Vercel.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { transformationWeightVerb } from './transformationWeightDirection.js';

const CARD_W = 540;
const CARD_H = 960;
const HEADER_H = 62;
const NAME_H = 52;
const PHOTO_TOP = HEADER_H + NAME_H;
const PHOTO_GAP = 8;
const PHOTO_SIDE_PAD = 12;
const PHOTO_W = Math.floor((CARD_W - PHOTO_SIDE_PAD * 2 - PHOTO_GAP) / 2);
const PHOTO_H = 480;
const META_H = 52;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '../assets');

let cachedFontCss = null;

function cardFontCss() {
  if (cachedFontCss !== null) return cachedFontCss;
  try {
    const regular = readFileSync(join(ASSETS_DIR, 'NotoSans-Regular.ttf')).toString('base64');
    const bold = readFileSync(join(ASSETS_DIR, 'NotoSans-Bold.ttf')).toString('base64');
    cachedFontCss = `
      @font-face {
        font-family: 'CardSans';
        src: url('data:font/ttf;base64,${regular}') format('truetype');
        font-weight: 400;
        font-style: normal;
      }
      @font-face {
        font-family: 'CardSans';
        src: url('data:font/ttf;base64,${bold}') format('truetype');
        font-weight: 700;
        font-style: normal;
      }
    `;
  } catch {
    // Fonts optional — compose still produces photos + labels without them.
    cachedFontCss = '';
  }
  return cachedFontCss;
}

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
 * Decode optional raw/data-URI base64 into a Buffer.
 * @param {string|null|undefined} base64
 * @returns {Buffer|null}
 */
export function bufferFromOptionalBase64(base64) {
  if (typeof base64 !== 'string' || !base64) return null;
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '');
  if (!cleaned) return null;
  try {
    const buf = Buffer.from(cleaned, 'base64');
    return buf.length ? buf : null;
  } catch {
    return null;
  }
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
  const hasDiff = Number.isFinite(bw) && Number.isFinite(aw) && bw > 0 && aw > 0 && bw !== aw;
  const diff = hasDiff ? Math.abs(aw - bw).toFixed(1) : null;
  const verb = transformationWeightVerb(bw, aw);
  const duration = String(opts.durationText || '').trim();
  const pill = diff && verb
    ? `${verb} ${diff} kgs${duration ? ` in ${escapeXml(duration)}` : ''}`
    : '';
  const version = escapeXml(String(opts.appVersionLabel || '').trim());

  const beforeX = PHOTO_SIDE_PAD;
  const afterX = PHOTO_SIDE_PAD + PHOTO_W + PHOTO_GAP;
  const metaY = PHOTO_TOP + PHOTO_H + 8;
  const pillY = metaY + META_H + 8;
  const footerTop = PHOTO_TOP + PHOTO_H;
  const fontCss = cardFontCss();

  // Transparent overlay — no full-card white rect (that hid the photos).
  const overlaySvg = Buffer.from(`
    <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style type="text/css"><![CDATA[
          ${fontCss}
          text { font-family: 'CardSans', Arial, sans-serif; }
        ]]></style>
      </defs>
      <rect x="0" y="0" width="${CARD_W}" height="${HEADER_H}" fill="#059669"/>
      <text x="16" y="28" font-size="20" font-weight="700" fill="#ffffff">Wellness Valley${version ? ` (${version})` : ''}</text>
      <text x="16" y="48" font-size="13" font-weight="400" fill="#a7f3d0">Transformation Results</text>
      <rect x="0" y="${HEADER_H}" width="${CARD_W}" height="${NAME_H}" fill="#ffffff"/>
      <text x="${CARD_W / 2}" y="${HEADER_H + 34}" text-anchor="middle" font-size="22" font-weight="700" fill="#111827">${name}</text>
      <rect x="${beforeX}" y="${PHOTO_TOP + PHOTO_H - 36}" width="${PHOTO_W}" height="28" rx="6" fill="#e11d72"/>
      <text x="${beforeX + PHOTO_W / 2}" y="${PHOTO_TOP + PHOTO_H - 16}" text-anchor="middle" font-size="16" font-weight="700" fill="#ffffff">Before</text>
      <rect x="${afterX}" y="${PHOTO_TOP + PHOTO_H - 36}" width="${PHOTO_W}" height="28" rx="6" fill="#16a34a"/>
      <text x="${afterX + PHOTO_W / 2}" y="${PHOTO_TOP + PHOTO_H - 16}" text-anchor="middle" font-size="16" font-weight="700" fill="#ffffff">After</text>
      <rect x="0" y="${footerTop}" width="${CARD_W}" height="${CARD_H - footerTop}" fill="#ffffff"/>
      <text x="${beforeX + PHOTO_W / 2}" y="${metaY + 14}" text-anchor="middle" font-size="11" font-weight="700" fill="#9ca3af">BEFORE</text>
      <text x="${beforeX + PHOTO_W / 2}" y="${metaY + 36}" text-anchor="middle" font-size="17" font-weight="700" fill="#111827">${beforeKg} kg</text>
      <text x="${afterX + PHOTO_W / 2}" y="${metaY + 14}" text-anchor="middle" font-size="11" font-weight="700" fill="#9ca3af">AFTER</text>
      <text x="${afterX + PHOTO_W / 2}" y="${metaY + 36}" text-anchor="middle" font-size="17" font-weight="700" fill="#111827">${afterKg} kg</text>
      ${pill ? `<rect x="${(CARD_W - 280) / 2}" y="${pillY}" width="280" height="32" rx="16" fill="#dbeafe"/>
      <text x="${CARD_W / 2}" y="${pillY + 21}" text-anchor="middle" font-size="14" font-weight="700" fill="#2563eb">${pill}</text>` : ''}
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
    .composite([
      { input: beforeSlot, top: PHOTO_TOP, left: beforeX },
      { input: afterSlot, top: PHOTO_TOP, left: afterX },
      { input: overlaySvg, top: 0, left: 0 },
    ])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}
