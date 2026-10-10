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
/** Leave room below the result pill for the red DISCLAIMER footer. */
const PHOTO_H = 460;
const META_H = 52;
const DISCLAIMER_H = 110;
const DISCLAIMER_PAD_X = 40;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '../assets');

let cachedFontCss = null;

function cardFontCss() {
  if (cachedFontCss !== null) return cachedFontCss;
  try {
    const regularPath = join(ASSETS_DIR, 'NotoSans-Regular.ttf');
    const boldPath = join(ASSETS_DIR, 'NotoSans-Bold.ttf');
    // Prefer file:// for librsvg (Vercel/Linux); data-URI alone often becomes tofu boxes.
    const regularFile = `file://${regularPath}`;
    const boldFile = `file://${boldPath}`;
    const regular = readFileSync(regularPath).toString('base64');
    const bold = readFileSync(boldPath).toString('base64');
    cachedFontCss = `
      @font-face {
        font-family: 'CardSans';
        src: url('${regularFile}') format('truetype'),
             url('data:font/ttf;base64,${regular}') format('truetype');
        font-weight: 400;
        font-style: normal;
      }
      @font-face {
        font-family: 'CardSans';
        src: url('${boldFile}') format('truetype'),
             url('data:font/ttf;base64,${bold}') format('truetype');
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
 * True when a share-card JPEG has real painted text (not librsvg tofu boxes).
 * Samples the member-name band under the green header.
 * @param {Buffer} jpeg
 * @returns {Promise<boolean>}
 */
export async function shareCardJpegHasReadableText(jpeg) {
  if (!Buffer.isBuffer(jpeg) || jpeg.length < 500) return false;
  try {
    const { data, info } = await sharp(jpeg)
      .extract({ left: 80, top: 70, width: 380, height: 36 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let dark = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i] < 45 && data[i + 1] < 45 && data[i + 2] < 45) dark += 1;
    }
    // Real "System" / name glyphs paint dozens of near-black pixels; tofu does not.
    return dark > 40;
  } catch {
    return false;
  }
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
  const duration = String(opts.durationText || '').replace(/\s+/g, ' ').trim();
  // Size pill to label (same idea as frontend SVG pill) — fixed 280px left-shifted short text.
  const pillLabel = diff && verb
    ? `${verb} ${diff} kgs${duration ? ` in ${duration}` : ''}`
    : '';
  const pill = pillLabel ? escapeXml(pillLabel) : '';
  const pillPadX = 18;
  const pillW = pillLabel
    ? Math.min(CARD_W - 48, Math.max(140, Math.ceil(pillLabel.length * 9.2) + pillPadX * 2))
    : 0;
  const pillH = 30;
  const pillX = pillW ? Math.round((CARD_W - pillW) / 2) : 0;
  const version = escapeXml(String(opts.appVersionLabel || '').trim());

  const beforeX = PHOTO_SIDE_PAD;
  const afterX = PHOTO_SIDE_PAD + PHOTO_W + PHOTO_GAP;
  const metaY = PHOTO_TOP + PHOTO_H + 8;
  const pillY = metaY + META_H + 8;
  const footerTop = PHOTO_TOP + PHOTO_H;
  const discY = CARD_H - DISCLAIMER_H + 4;
  const discW = CARD_W - DISCLAIMER_PAD_X * 2;
  const discH = DISCLAIMER_H - 14;
  const fontCss = cardFontCss();
  const burstY = pillY + 3;
  const burstLeftX = Math.max(8, pillX - 40);
  const burstRightX = Math.min(CARD_W - 40, pillX + pillW + 8);

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
      ${pill ? `
      <path d="M${burstLeftX + 34} ${burstY + 12}H${burstLeftX + 14}M${burstLeftX + 26} ${burstY + 4}L${burstLeftX + 8} ${burstY}M${burstLeftX + 26} ${burstY + 20}L${burstLeftX + 8} ${burstY + 24}" fill="none" stroke="#059669" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="15" ry="15" fill="#dbeafe"/>
      <text x="${pillX + pillW / 2}" y="${pillY + 20}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800" fill="#2563eb">${pill}</text>
      <path d="M${burstRightX} ${burstY + 12}h20M${burstRightX + 8} ${burstY + 4}l18 -4M${burstRightX + 8} ${burstY + 20}l18 4" fill="none" stroke="#059669" stroke-width="3.5" stroke-linecap="round"/>
      ` : ''}
      <rect x="${DISCLAIMER_PAD_X}" y="${discY}" width="${discW}" height="${discH}" rx="12" ry="12" fill="#ffffff" stroke="#dc2626" stroke-width="3"/>
      <text x="${CARD_W / 2}" y="${discY + 28}" text-anchor="middle" font-size="14" font-weight="700" fill="#dc2626">DISCLAIMER</text>
      <line x1="${DISCLAIMER_PAD_X + 36}" y1="${discY + 36}" x2="${DISCLAIMER_PAD_X + discW - 36}" y2="${discY + 36}" stroke="#dc2626" stroke-width="1.5"/>
      <text x="${CARD_W / 2}" y="${discY + 58}" text-anchor="middle" font-size="11" font-weight="400" fill="#000000">The views expressed are that of individuals.</text>
      <text x="${CARD_W / 2}" y="${discY + 76}" text-anchor="middle" font-size="11" font-weight="400" fill="#000000">These products are not intended to diagnose, treat or cure any disease.</text>
    </svg>
  `);

  // Rasterize SVG first so librsvg resolves @font-face before composite
  // (passing raw SVG into composite often yields tofu □ boxes on Linux/Vercel).
  const overlayPng = await sharp(overlaySvg, { density: 96 })
    .resize(CARD_W, CARD_H, { fit: 'fill' })
    .png()
    .toBuffer();

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
      { input: overlayPng, top: 0, left: 0 },
    ])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}
