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
import { shareCardResultPillLabel } from './transformationWeightDirection.js';

const CARD_W = 540;
const CARD_H = 960;
const HEADER_H = 62;
const NAME_H = 52;
const PHOTO_TOP = HEADER_H + NAME_H;
const PHOTO_GAP = 8;
const PHOTO_SIDE_PAD = 12;
const PHOTO_W = Math.floor((CARD_W - PHOTO_SIDE_PAD * 2 - PHOTO_GAP) / 2);
/** Standard portrait photo height (keeps photos in proportion without elongation). */
const PHOTO_H = 460;
const META_H = 52;
const DISCLAIMER_H = 110;
const MAX_VISIBLE_ISSUES = 10;
/** Match frontend share card — 14px issue chip labels. */
const ISSUE_CHIP_FONT = 14;
/** Title + subtitle + gap before chips ("while joining the community"). */
const ISSUE_TITLE_H = 44;

/** import.meta.url so Next/Vercel file tracing packs the TTFs with the function. */
const FONT_REGULAR_URL = new URL('../assets/NotoSans-Regular.ttf', import.meta.url);
const FONT_BOLD_URL = new URL('../assets/NotoSans-Bold.ttf', import.meta.url);
const FONT_PACIFICO_URL = new URL('../assets/Pacifico-Regular.ttf', import.meta.url);
const LOGO_URL = new URL('../assets/logo.png', import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
let fontRegular = null;
let fontBold = null;
let fontPacifico = null;
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

function parseFontFile(fontUrl) {
  const buf = readFileSync(fontUrl);
  // Node Buffer → ArrayBuffer slice for opentype.parse (v1.3.x).
  return opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
}

function loadCardFonts() {
  if (fontRegular && fontBold && fontPacifico) return;
  fontRegular = parseFontFile(FONT_REGULAR_URL);
  fontBold = parseFontFile(FONT_BOLD_URL);
  try {
    fontPacifico = parseFontFile(FONT_PACIFICO_URL);
  } catch {
    fontPacifico = fontBold;
  }
  if (!fontRegular?.getPath || !fontBold?.getPath) {
    throw new Error('Share-card Noto fonts failed to load');
  }
}

/**
 * Render text as an SVG path (no host fonts required).
 * @param {{ text: string, x: number, y: number, size: number, fill: string, bold?: boolean, script?: boolean, anchor?: 'start'|'middle' }} opts
 */
function svgTextPath({ text, x, y, size, fill, bold = true, script = false, anchor = 'start' }) {
  loadCardFonts();
  const raw = String(text ?? '');
  if (!raw) return '';
  let font = bold ? fontBold : fontRegular;
  if (script) {
    font = fontPacifico || fontBold;
  }
  let drawX = x;
  if (anchor === 'middle') {
    drawX = x - font.getAdvanceWidth(raw, size) / 2;
  }
  const path = font.getPath(raw, drawX, y, size);
  return `<path d="${path.toPathData(1)}" fill="${fill}"/>`;
}

/**
 * Center script ink (not advance width) so "Before" and "After" share one slot.
 * @param {{ text: string, centerX: number, centerY: number, size: number, fill: string }} opts
 */
function svgScriptCentered({ text, centerX, centerY, size, fill }) {
  loadCardFonts();
  const raw = String(text ?? '');
  if (!raw) return '';
  const font = fontPacifico || fontBold;
  const probe = font.getPath(raw, 0, 0, size);
  const box = probe.getBoundingBox();
  const drawX = centerX - (box.x1 + box.x2) / 2;
  const drawY = centerY - (box.y1 + box.y2) / 2;
  const path = font.getPath(raw, drawX, drawY, size);
  return `<path d="${path.toPathData(1)}" fill="${fill}"/>`;
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

const ISSUE_CHIP_PAD_X = 12;
const ISSUE_CHIP_GAP = 8;
const ISSUE_CHIP_H = 32;
const ISSUE_CHIP_H_TWO = 48;
const ISSUE_ROW_GAP = 8;
const ISSUE_BOX_PAD = 10;

/**
 * Split a label onto two lines when it is wider than the chip text area.
 * @param {string} label
 * @param {number} maxTextW
 * @param {number} size
 * @returns {{ lines: string[], textW: number }}
 */
function issueLabelLines(label, maxTextW, size) {
  const fullW = measureTextWidth(label, size, true);
  if (fullW <= maxTextW) return { lines: [label], textW: fullW };
  const words = String(label).split(' ').filter(Boolean);
  if (words.length < 2) return { lines: [label], textW: fullW };
  let best = null;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(measureTextWidth(a, size, true), measureTextWidth(b, size, true));
    if (w > maxTextW) continue;
    if (!best || w < best.textW) best = { lines: [a, b], textW: w };
  }
  if (best) return best;
  const mid = Math.ceil(words.length / 2);
  const a = words.slice(0, mid).join(' ');
  const b = words.slice(mid).join(' ');
  return {
    lines: [a, b],
    textW: Math.max(measureTextWidth(a, size, true), measureTextWidth(b, size, true)),
  };
}

/**
 * Chip wide enough for its label. Long names wrap inside the bubble
 * instead of painting across the next chip.
 * @param {string[]} labels
 * @param {number} [innerW]
 * @returns {{ rows: Array<{ chips: object[], width: number, height: number }>, blockH: number }}
 */
export function layoutHealthIssueChips(labels, innerW = CARD_W - 24 - ISSUE_BOX_PAD * 2) {
  const maxTextW = Math.max(40, innerW - ISSUE_CHIP_PAD_X * 2);
  const chips = (Array.isArray(labels) ? labels : []).map((label) => {
    let fitted = null;
    for (const size of [ISSUE_CHIP_FONT, 12, 11]) {
      const attempt = issueLabelLines(label, maxTextW, size);
      if (attempt.textW <= maxTextW) {
        fitted = { ...attempt, size };
        break;
      }
    }
    if (!fitted) {
      const attempt = issueLabelLines(label, maxTextW, 11);
      fitted = { ...attempt, size: 11 };
    }
    const chipW = Math.min(
      innerW,
      Math.max(64, Math.ceil(fitted.textW + ISSUE_CHIP_PAD_X * 2)),
    );
    return {
      label,
      lines: fitted.lines,
      size: fitted.size,
      textW: fitted.textW,
      chipW,
      chipH: fitted.lines.length > 1 ? ISSUE_CHIP_H_TWO : ISSUE_CHIP_H,
    };
  });

  const rows = [];
  let current = [];
  let rowW = 0;
  const flush = () => {
    if (!current.length) return;
    rows.push({
      chips: current,
      width: rowW,
      height: Math.max(...current.map((chip) => chip.chipH)),
    });
    current = [];
    rowW = 0;
  };
  chips.forEach((chip) => {
    const nextW = current.length ? rowW + ISSUE_CHIP_GAP + chip.chipW : chip.chipW;
    if (current.length && nextW > innerW) flush();
    current.push(chip);
    rowW = current.length > 1 ? rowW + ISSUE_CHIP_GAP + chip.chipW : chip.chipW;
  });
  flush();

  const blockH = rows.reduce(
    (sum, row, index) => sum + row.height + (index > 0 ? ISSUE_ROW_GAP : 0),
    0,
  );
  return { rows, blockH };
}

/**
 * Pink health-issues block (title + chips) under the result pill.
 * @param {string[]} issues
 * @param {number} topY
 * @returns {{ markup: string, height: number }}
 */
function buildHealthIssuesSvg(issues, topY) {
  const items = normalizeIssueList(issues);
  if (!items.length) return { markup: '', height: 0 };

  const boxX = 12;
  const boxW = CARD_W - 24;
  const boxPad = ISSUE_BOX_PAD;
  const innerW = boxW - boxPad * 2;
  const titleBlockH = ISSUE_TITLE_H;
  const layout = layoutHealthIssueChips(items, innerW);
  const boxH = boxPad + titleBlockH + layout.blockH + boxPad;
  const boxY = topY;

  let chips = '';
  let cursorY = boxY + boxPad + titleBlockH;
  layout.rows.forEach((row) => {
    let cursorX = boxX + boxPad + Math.max(0, (innerW - row.width) / 2);
    row.chips.forEach((chip) => {
      const textX = cursorX + chip.chipW / 2;
      const lineStep = 16;
      const firstBaseline = chip.lines.length > 1
        ? cursorY + 18
        : cursorY + Math.round(chip.chipH * 0.66);
      chips += `
      <rect x="${cursorX}" y="${cursorY}" width="${chip.chipW}" height="${chip.chipH}" rx="8" ry="8" fill="#ffffff" stroke="#f9a8d4" stroke-width="1.5"/>`;
      chip.lines.forEach((line, lineIdx) => {
        chips += svgTextPath({
          text: line,
          x: textX,
          y: firstBaseline + lineIdx * lineStep,
          size: chip.size,
          fill: '#4b5563',
          bold: true,
          anchor: 'middle',
        });
      });
      cursorX += chip.chipW + ISSUE_CHIP_GAP;
    });
    cursorY += row.height + ISSUE_ROW_GAP;
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
 * Organic brush-stroke badge matching the frontend BrushLabel component exactly.
 * Directly replicates the 4 layered CSS spans and Pacifico cursive text from TransformationShareCard.jsx.
 * @param {{ label: string, containerX: number, containerY: number, side: 'left'|'right' }} opts
 */
function buildBrushBadgeSvg({ label, containerX, containerY, side }) {
  const color = side === 'left' ? '#e11d72' : '#16a34a';
  // Same stroke and the same ink center for Before and After.
  // Advance-width centering leaves the shorter word sitting off the brush.
  const textCenterX = 109;
  const textCenterY = 46;

  return `
    <g transform="translate(${containerX}, ${containerY})">
      <!-- Span 1: Main organic body with asymmetrical rounded corners & slant -->
      <path d="M 84 19 H 189 A 28 25 0 0 1 217 44 V 53 A 75 19 0 0 1 142 72 H 41 A 38 28 0 0 1 3 44 V 35 A 81 16 0 0 1 84 19 Z"
        fill="${color}" opacity="0.96"
        transform="translate(110, 45.5) rotate(-2) skewX(-7) translate(-110, -45.5)"/>

      <!-- Span 2: Top paint streak accent -->
      <path d="M 63 13 H 177 A 25 2 0 0 1 202 15 V 19 A 50 8 0 0 1 152 27 H 33 A 20 2 0 0 1 13 25 V 22 A 50 9 0 0 1 63 13 Z"
        fill="${color}" opacity="0.76"
        transform="rotate(2, 107.5, 20)"/>

      <!-- Span 3: Bottom paint streak accent -->
      <path d="M 35 62 H 136 A 60 7 0 0 1 196 69 V 70 A 30 2 0 0 1 166 72 H 60 A 60 7 0 0 1 0 65 V 64 A 35 2 0 0 1 35 62 Z"
        fill="${color}" opacity="0.72"
        transform="rotate(1, 98, 67)"/>

      <!-- Span 4: Centered bristle flick (same on both photos) -->
      <path d="M 64 35 H 180 A 25 2 0 0 1 205 37 V 39 A 55 8 0 0 1 150 47 H 29 A 20 2 0 0 1 9 45 V 43 A 55 8 0 0 1 64 35 Z"
        fill="${color}" opacity="0.65"
        transform="rotate(-5, 107, 41)"/>

      <!-- Pacifico cursive label, ink-centered so Before and After share one slot -->
      <g transform="rotate(-3, ${textCenterX}, ${textCenterY})">
        <g opacity="0.36">
          ${svgScriptCentered({ text: label, centerX: textCenterX, centerY: textCenterY + 2, size: 40, fill: '#000000' })}
        </g>
        ${svgScriptCentered({ text: label, centerX: textCenterX, centerY: textCenterY, size: 40, fill: '#ffffff' })}
      </g>
    </g>
  `;
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
  const pillLabel = shareCardResultPillLabel(
    opts.beforeWeightKg,
    opts.afterWeightKg,
    opts.durationText,
  );
  const pillPadX = 18;
  const pillW = pillLabel
    ? Math.min(CARD_W - 48, Math.max(140, Math.ceil(measureTextWidth(pillLabel, 15, true)) + pillPadX * 2))
    : 0;
  const pillH = 30;
  const issues = normalizeIssueList(opts.recoveredHealthIssues);
  const photoH = PHOTO_H;

  const beforeSlot = await coverTopJpeg(beforeBuffer, PHOTO_W, photoH);
  const afterSlot = await coverTopJpeg(afterBuffer, PHOTO_W, photoH);

  const pillX = pillW ? Math.round((CARD_W - pillW) / 2) : 0;
  const version = String(opts.appVersionLabel || defaultAppVersionLabel() || '').trim();
  const headerTitle = version ? `Wellness Valley (${version})` : 'Wellness Valley';
  const logoUri = cardLogoDataUri();
  const titleX = logoUri ? 62 : 16;

  const beforeX = PHOTO_SIDE_PAD;
  const afterX = PHOTO_SIDE_PAD + PHOTO_W + PHOTO_GAP;
  const metaY = PHOTO_TOP + photoH + 8;
  const pillY = metaY + META_H + 8;
  const footerTop = PHOTO_TOP + photoH;
  const issuesTop = pillLabel ? pillY + pillH + 12 : metaY + META_H + 10;
  const { markup: issuesMarkup, height: issuesHeight } = buildHealthIssuesSvg(issues, issuesTop);

  // Disclaimer sits on the bottom edge, full card width.
  const discY = issuesMarkup
    ? issuesTop + issuesHeight + 12
    : (pillLabel ? pillY + pillH + 14 : metaY + META_H + 14);
  const discH = DISCLAIMER_H - 14;
  const discTextX = 16;
  const cardH = discY + discH;

  const burstY = pillY + 3;
  const burstLeftX = Math.max(8, pillX - 40);
  const burstRightX = Math.min(CARD_W - 40, pillX + pillW + 8);

  // Overlay uses glyph paths only — no <text> (avoids tofu on serverless).
  const overlaySvg = Buffer.from(`
    <svg width="${CARD_W}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${CARD_W}" height="${HEADER_H}" fill="#059669"/>
      ${logoUri ? `
      <circle cx="31" cy="31" r="19" fill="#ffffff"/>
      <image href="${logoUri}" x="16" y="16" width="30" height="30" preserveAspectRatio="xMidYMid meet"/>
      ` : ''}
      ${svgTextPath({ text: headerTitle, x: titleX, y: 28, size: 20, fill: '#ffffff', bold: true })}
      ${svgTextPath({ text: 'Transformation Results', x: titleX, y: 48, size: 13, fill: '#a7f3d0', bold: false })}
      <rect x="0" y="${HEADER_H}" width="${CARD_W}" height="${NAME_H}" fill="#ffffff"/>
      ${svgTextPath({ text: name, x: CARD_W / 2, y: HEADER_H + 34, size: 22, fill: '#111827', bold: true, anchor: 'middle' })}
      ${buildBrushBadgeSvg({ label: 'Before', containerX: beforeX + 18, containerY: PHOTO_TOP + photoH - 16 - 92, side: 'left' })}
      ${buildBrushBadgeSvg({ label: 'After', containerX: afterX + 18, containerY: PHOTO_TOP + photoH - 16 - 92, side: 'right' })}
      <rect x="0" y="${footerTop}" width="${CARD_W}" height="${cardH - footerTop}" fill="#ffffff"/>
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
      <rect x="0" y="${discY}" width="${CARD_W}" height="${discH}" fill="#FFF2A6" stroke="#E52525" stroke-width="2"/>
      ${svgTextPath({ text: 'DISCLAIMER', x: CARD_W / 2, y: discY + 24, size: 13, fill: '#E52525', bold: true, anchor: 'middle' })}
      <line x1="16" y1="${discY + 32}" x2="${CARD_W - 16}" y2="${discY + 32}" stroke="#E52525" stroke-width="1.2"/>
      ${svgTextPath({ text: 'The views expressed are those of individuals.', x: discTextX, y: discY + 54, size: 12, fill: '#171717', bold: true, anchor: 'start' })}
      ${svgTextPath({ text: 'These products are not intended to diagnose, treat or cure any disease.', x: discTextX, y: discY + 74, size: 12, fill: '#171717', bold: true, anchor: 'start' })}
    </svg>
  `);

  const overlayPng = await sharp(overlaySvg, { density: 96 })
    .resize(CARD_W, cardH, { fit: 'fill' })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: CARD_W,
      height: cardH,
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
