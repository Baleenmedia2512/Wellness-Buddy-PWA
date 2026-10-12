/**
 * Server-side Transformation share card (JPEG) for coach OTP emails.
 * Fallback when the client does not send a captured share card.
 * Text is drawn as SVG paths via opentype.js + bundled Noto Sans TTFs
 * (sharp/librsvg cannot use @font-face → □ tofu on Linux/Vercel).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
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
/** Default photo height; shrinks when health-issue chips need space. */
const PHOTO_H_MAX = 460;
const PHOTO_H_MIN = 320;
const META_H = 52;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '../assets');
const LOGO_URL = new URL('../assets/logo.png', import.meta.url);

let cachedFontCss = null;
let cachedLogoDataUri = null;

function cardLogoDataUri() {
  if (cachedLogoDataUri !== null) return cachedLogoDataUri;
  try {
    cachedLogoDataUri = `data:image/png;base64,${readFileSync(LOGO_URL).toString('base64')}`;
  } catch {
    cachedLogoDataUri = '';
  }
  return cachedLogoDataUri;
}

function defaultAppVersionLabel() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8'));
    return String(pkg?.version || '').trim();
  } catch {
    return '';
  }
}

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

function measureTextWidth(text, size, bold = true) {
  loadCardFonts();
  const font = bold ? fontBold : fontRegular;
  return font.getAdvanceWidth(String(text ?? ''), size);
}

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function normalizeIssueList(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => String(item ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, MAX_VISIBLE_ISSUES);
}

function issueColumnsForCount(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 0) return 0;
  if (n <= 3) return n;
  if (n <= 6) return 3;
  return 4;
}

/**
 * Pink health-issues block (title + 14px chips) under the result pill.
 * @param {string[]} issues
 * @param {number} topY
 * @returns {{ markup: string, height: number }}
 */
function buildHealthIssuesSvg(issues, topY) {
  const items = normalizeIssueList(issues);
  if (!items.length) return { markup: '', height: 0 };

  const cols = issueColumnsForCount(items.length);
  const rows = Math.ceil(items.length / cols);
  const boxX = 12;
  const boxW = CARD_W - 24;
  const boxPad = 10;
  const chipGap = 6;
  const innerW = boxW - boxPad * 2;
  const chipW = Math.floor((innerW - chipGap * (cols - 1)) / cols);
  const chipH = 32;
  const titleBlockH = ISSUE_TITLE_H;
  const chipsH = rows * ISSUE_CHIP_ROW_H;
  const boxH = boxPad + titleBlockH + chipsH + boxPad;
  const boxY = topY;

  let chips = '';
  items.forEach((label, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = boxX + boxPad + col * (chipW + chipGap);
    const y = boxY + boxPad + titleBlockH + row * ISSUE_CHIP_ROW_H;
    const textY = y + 21;
    chips += `
      <rect x="${x}" y="${y}" width="${chipW}" height="${chipH}" rx="8" ry="8" fill="#ffffff" stroke="#f9a8d4" stroke-width="1.5"/>
      ${svgTextPath({
        text: label,
        x: x + chipW / 2,
        y: textY,
        size: ISSUE_CHIP_FONT,
        fill: '#4b5563',
        bold: true,
        anchor: 'middle',
      })}`;
  });

  const markup = `
    <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="12" ry="12" fill="#fff1f2" stroke="#f9a8d4" stroke-width="1"/>
    ${svgTextPath({
      text: 'Health Issues',
      x: CARD_W / 2,
      y: boxY + boxPad + 16,
      size: 16,
      fill: '#be185d',
      bold: true,
      anchor: 'middle',
    })}
    ${svgTextPath({
      text: 'while joining the community',
      x: CARD_W / 2,
      y: boxY + boxPad + 30,
      size: 9,
      fill: '#9ca3af',
      bold: false,
      anchor: 'middle',
    })}
    ${chips}`;

  return { markup, height: boxH + 8 };
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
 *   recoveredHealthIssues?: string[]|null,
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

  loadCardFonts();
  const name = String(opts.memberName || 'Customer').trim() || 'Customer';
  const beforeKg = formatKg(opts.beforeWeightKg);
  const afterKg = formatKg(opts.afterWeightKg);
  const bw = Number(opts.beforeWeightKg);
  const aw = Number(opts.afterWeightKg);
  const hasDiff = Number.isFinite(bw) && Number.isFinite(aw) && bw > 0 && aw > 0 && bw !== aw;
  const diff = hasDiff ? Math.abs(aw - bw).toFixed(1) : null;
  const verb = transformationWeightVerb(bw, aw);
  const duration = String(opts.durationText || '').replace(/\s+/g, ' ').trim();
  const pillLabel = diff && verb
    ? `${verb} ${diff} kgs${duration ? ` in ${duration}` : ''}`
    : '';
  const version = escapeXml(
    String(opts.appVersionLabel || defaultAppVersionLabel() || '').trim(),
  );
  const logoUri = cardLogoDataUri();
  const titleX = logoUri ? 62 : 16;

  const beforeX = PHOTO_SIDE_PAD;
  const afterX = PHOTO_SIDE_PAD + PHOTO_W + PHOTO_GAP;
  const metaY = PHOTO_TOP + photoH + 8;
  const pillY = metaY + META_H + 8;
  const footerTop = PHOTO_TOP + photoH;
  const issuesTop = pillLabel ? pillY + pillH + 10 : metaY + META_H + 8;
  const { markup: issuesMarkup } = buildHealthIssuesSvg(issues, issuesTop);
  const discY = CARD_H - DISCLAIMER_H + 4;
  const discW = CARD_W - DISCLAIMER_PAD_X * 2;
  const discH = DISCLAIMER_H - 14;
  const burstY = pillY + 3;
  const burstLeftX = Math.max(8, pillX - 40);
  const burstRightX = Math.min(CARD_W - 40, pillX + pillW + 8);

  // Overlay uses glyph paths only — no <text> (avoids tofu on serverless).
  const overlaySvg = Buffer.from(`
    <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${CARD_W}" height="${HEADER_H}" fill="#059669"/>
      ${logoUri ? `
      <circle cx="31" cy="31" r="19" fill="#ffffff"/>
      <image href="${logoUri}" x="16" y="16" width="30" height="30" preserveAspectRatio="xMidYMid meet"/>
      ` : ''}
      <text x="${titleX}" y="28" font-size="20" font-weight="700" fill="#ffffff">Wellness Valley${version ? ` (${version})` : ''}</text>
      <text x="${titleX}" y="48" font-size="13" font-weight="400" fill="#a7f3d0">Transformation Results</text>
      <rect x="0" y="${HEADER_H}" width="${CARD_W}" height="${NAME_H}" fill="#ffffff"/>
      ${svgTextPath({ text: name, x: CARD_W / 2, y: HEADER_H + 34, size: 22, fill: '#111827', bold: true, anchor: 'middle' })}
      <rect x="${beforeX}" y="${PHOTO_TOP + photoH - 36}" width="${PHOTO_W}" height="28" rx="6" fill="#e11d72"/>
      ${svgTextPath({ text: 'Before', x: beforeX + PHOTO_W / 2, y: PHOTO_TOP + photoH - 16, size: 16, fill: '#ffffff', bold: true, anchor: 'middle' })}
      <rect x="${afterX}" y="${PHOTO_TOP + photoH - 36}" width="${PHOTO_W}" height="28" rx="6" fill="#16a34a"/>
      ${svgTextPath({ text: 'After', x: afterX + PHOTO_W / 2, y: PHOTO_TOP + photoH - 16, size: 16, fill: '#ffffff', bold: true, anchor: 'middle' })}
      <rect x="0" y="${footerTop}" width="${CARD_W}" height="${CARD_H - footerTop}" fill="#ffffff"/>
      ${svgTextPath({ text: 'BEFORE', x: beforeX + PHOTO_W / 2, y: metaY + 14, size: 11, fill: '#9ca3af', bold: true, anchor: 'middle' })}
      ${svgTextPath({ text: `${beforeKg} kg`, x: beforeX + PHOTO_W / 2, y: metaY + 36, size: 17, fill: '#111827', bold: true, anchor: 'middle' })}
      ${svgTextPath({ text: 'AFTER', x: afterX + PHOTO_W / 2, y: metaY + 14, size: 11, fill: '#9ca3af', bold: true, anchor: 'middle' })}
      ${svgTextPath({ text: `${afterKg} kg`, x: afterX + PHOTO_W / 2, y: metaY + 36, size: 17, fill: '#111827', bold: true, anchor: 'middle' })}
      ${pillLabel ? `
      <path d="M${burstLeftX + 34} ${burstY + 12}H${burstLeftX + 14}M${burstLeftX + 26} ${burstY + 4}L${burstLeftX + 8} ${burstY}M${burstLeftX + 26} ${burstY + 20}L${burstLeftX + 8} ${burstY + 24}" fill="none" stroke="#059669" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="15" ry="15" fill="#dbeafe"/>
      ${svgTextPath({ text: pillLabel, x: pillX + pillW / 2, y: pillY + 20, size: 15, fill: '#2563eb', bold: true, anchor: 'middle' })}
      <path d="M${burstRightX} ${burstY + 12}h20M${burstRightX + 8} ${burstY + 4}l18 -4M${burstRightX + 8} ${burstY + 20}l18 4" fill="none" stroke="#059669" stroke-width="3.5" stroke-linecap="round"/>
      ` : ''}
      ${issuesMarkup}
      <rect x="${DISCLAIMER_PAD_X}" y="${discY}" width="${discW}" height="${discH}" rx="12" ry="12" fill="#ffffff" stroke="#dc2626" stroke-width="3"/>
      ${svgTextPath({ text: 'DISCLAIMER', x: CARD_W / 2, y: discY + 28, size: 14, fill: '#dc2626', bold: true, anchor: 'middle' })}
      <line x1="${DISCLAIMER_PAD_X + 36}" y1="${discY + 36}" x2="${DISCLAIMER_PAD_X + discW - 36}" y2="${discY + 36}" stroke="#dc2626" stroke-width="1.5"/>
      ${svgTextPath({ text: 'The views expressed are that of individuals.', x: CARD_W / 2, y: discY + 58, size: 11, fill: '#000000', bold: false, anchor: 'middle' })}
      ${svgTextPath({ text: 'These products are not intended to diagnose, treat or cure any disease.', x: CARD_W / 2, y: discY + 76, size: 11, fill: '#000000', bold: false, anchor: 'middle' })}
    </svg>
  `);

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
