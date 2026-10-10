/**
 * Server-side Transformation share card (JPEG) for coach OTP emails.
 * Fallback when the client does not send a captured share card.
 * Uses embedded Noto Sans so text is not tofu boxes on Linux/Vercel.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
/** Default photo height; shrinks when health-issue chips need space. */
const PHOTO_H_MAX = 460;
const PHOTO_H_MIN = 320;
const META_H = 52;
const DISCLAIMER_H = 110;
const DISCLAIMER_PAD_X = 40;
const MAX_VISIBLE_ISSUES = 10;
/** Match frontend share card — 14px issue chip labels. */
const ISSUE_CHIP_FONT = 14;
const ISSUE_CHIP_ROW_H = 40;
const ISSUE_TITLE_H = 36;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '../assets');
/** Real family name inside NotoSans-*.ttf (fc-query). */
const CARD_FONT_FAMILY = 'Noto Sans';

let fontconfigReady = false;

/**
 * sharp/librsvg ignores SVG @font-face. Point fontconfig at our bundled TTFs
 * so text is real glyphs instead of □ tofu boxes (esp. Linux/Vercel).
 */
function ensureShareCardFontconfig() {
  if (fontconfigReady) return;
  try {
    readFileSync(join(ASSETS_DIR, 'NotoSans-Regular.ttf'));
    readFileSync(join(ASSETS_DIR, 'NotoSans-Bold.ttf'));
    const cacheDir = join(tmpdir(), 'wv-fontconfig-cache');
    mkdirSync(cacheDir, { recursive: true });
    const confPath = join(tmpdir(), 'wv-testimonials-fonts.conf');
    writeFileSync(
      confPath,
      `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${ASSETS_DIR}</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>
`,
    );
    process.env.FONTCONFIG_FILE = confPath;
    process.env.FONTCONFIG_PATH = ASSETS_DIR;
    // macOS Homebrew libvips may prefer CoreText unless fontconfig is forced.
    if (!process.env.PANGOCAIRO_BACKEND) {
      process.env.PANGOCAIRO_BACKEND = 'fontconfig';
    }
    fontconfigReady = true;
  } catch {
    fontconfigReady = false;
  }
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
  const boxPad = 8;
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
      <text x="${x + chipW / 2}" y="${textY}" text-anchor="middle" font-family="${CARD_FONT_FAMILY}, sans-serif" font-size="${ISSUE_CHIP_FONT}" font-weight="700" fill="#4b5563">${escapeXml(label)}</text>`;
  });

  const markup = `
    <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="12" ry="12" fill="#fff1f2" stroke="#f9a8d4" stroke-width="1"/>
    <text x="${CARD_W / 2}" y="${boxY + boxPad + 16}" text-anchor="middle" font-family="${CARD_FONT_FAMILY}, sans-serif" font-size="16" font-style="italic" font-weight="700" fill="#be185d">Health Issues</text>
    <text x="${CARD_W / 2}" y="${boxY + boxPad + 30}" text-anchor="middle" font-family="${CARD_FONT_FAMILY}, sans-serif" font-size="9" font-style="italic" fill="#9ca3af">while joining in the community</text>
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

  const name = escapeXml(String(opts.memberName || 'Customer').trim() || 'Customer');
  const beforeKg = escapeXml(formatKg(opts.beforeWeightKg));
  const afterKg = escapeXml(formatKg(opts.afterWeightKg));
  const bw = Number(opts.beforeWeightKg);
  const aw = Number(opts.afterWeightKg);
  const hasDiff = Number.isFinite(bw) && Number.isFinite(aw) && bw > 0 && aw > 0 && bw !== aw;
  const diff = hasDiff ? Math.abs(aw - bw).toFixed(1) : null;
  const verb = transformationWeightVerb(bw, aw);
  const duration = String(opts.durationText || '').replace(/\s+/g, ' ').trim();
  const pillLabel = diff && verb
    ? `${verb} ${diff} kgs${duration ? ` in ${duration}` : ''}`
    : '';
  const pill = pillLabel ? escapeXml(pillLabel) : '';
  const pillPadX = 18;
  const pillW = pillLabel
    ? Math.min(CARD_W - 48, Math.max(140, Math.ceil(pillLabel.length * 9.2) + pillPadX * 2))
    : 0;
  const pillH = 30;
  const issues = normalizeIssueList(opts.recoveredHealthIssues);
  const issueCols = issueColumnsForCount(issues.length);
  const issueRows = issueCols ? Math.ceil(issues.length / issueCols) : 0;
  const issuesReserveH = issueRows === 0
    ? 0
    : 8 + 8 + ISSUE_TITLE_H + issueRows * ISSUE_CHIP_ROW_H + 8 + 8;
  const pillReserveH = pillLabel ? 44 : 0;
  const usedBelowPhotos = META_H + 8 + pillReserveH + issuesReserveH + DISCLAIMER_H + 8;
  const photoH = Math.max(
    PHOTO_H_MIN,
    Math.min(PHOTO_H_MAX, CARD_H - PHOTO_TOP - usedBelowPhotos),
  );

  const beforeSlot = await coverTopJpeg(beforeBuffer, PHOTO_W, photoH);
  const afterSlot = await coverTopJpeg(afterBuffer, PHOTO_W, photoH);

  const pillX = pillW ? Math.round((CARD_W - pillW) / 2) : 0;
  const version = escapeXml(String(opts.appVersionLabel || '').trim());

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
  ensureShareCardFontconfig();
  const burstY = pillY + 3;
  const burstLeftX = Math.max(8, pillX - 40);
  const burstRightX = Math.min(CARD_W - 40, pillX + pillW + 8);
  const ff = CARD_FONT_FAMILY;

  // Transparent overlay — no full-card white rect (that hid the photos).
  // Fonts via fontconfig → Noto Sans (SVG @font-face is unsupported by sharp).
  const overlaySvg = Buffer.from(`
    <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style type="text/css"><![CDATA[
          text { font-family: '${ff}', sans-serif; }
        ]]></style>
      </defs>
      <rect x="0" y="0" width="${CARD_W}" height="${HEADER_H}" fill="#059669"/>
      <text x="16" y="28" font-size="20" font-weight="700" fill="#ffffff">Wellness Valley${version ? ` (${version})` : ''}</text>
      <text x="16" y="48" font-size="13" font-weight="400" fill="#a7f3d0">Transformation Results</text>
      <rect x="0" y="${HEADER_H}" width="${CARD_W}" height="${NAME_H}" fill="#ffffff"/>
      <text x="${CARD_W / 2}" y="${HEADER_H + 34}" text-anchor="middle" font-size="22" font-weight="700" fill="#111827">${name}</text>
      <rect x="${beforeX}" y="${PHOTO_TOP + photoH - 36}" width="${PHOTO_W}" height="28" rx="6" fill="#e11d72"/>
      <text x="${beforeX + PHOTO_W / 2}" y="${PHOTO_TOP + photoH - 16}" text-anchor="middle" font-size="16" font-weight="700" fill="#ffffff">Before</text>
      <rect x="${afterX}" y="${PHOTO_TOP + photoH - 36}" width="${PHOTO_W}" height="28" rx="6" fill="#16a34a"/>
      <text x="${afterX + PHOTO_W / 2}" y="${PHOTO_TOP + photoH - 16}" text-anchor="middle" font-size="16" font-weight="700" fill="#ffffff">After</text>
      <rect x="0" y="${footerTop}" width="${CARD_W}" height="${CARD_H - footerTop}" fill="#ffffff"/>
      <text x="${beforeX + PHOTO_W / 2}" y="${metaY + 14}" text-anchor="middle" font-size="11" font-weight="700" fill="#9ca3af">BEFORE</text>
      <text x="${beforeX + PHOTO_W / 2}" y="${metaY + 36}" text-anchor="middle" font-size="17" font-weight="700" fill="#111827">${beforeKg} kg</text>
      <text x="${afterX + PHOTO_W / 2}" y="${metaY + 14}" text-anchor="middle" font-size="11" font-weight="700" fill="#9ca3af">AFTER</text>
      <text x="${afterX + PHOTO_W / 2}" y="${metaY + 36}" text-anchor="middle" font-size="17" font-weight="700" fill="#111827">${afterKg} kg</text>
      ${pill ? `
      <path d="M${burstLeftX + 34} ${burstY + 12}H${burstLeftX + 14}M${burstLeftX + 26} ${burstY + 4}L${burstLeftX + 8} ${burstY}M${burstLeftX + 26} ${burstY + 20}L${burstLeftX + 8} ${burstY + 24}" fill="none" stroke="#059669" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="15" ry="15" fill="#dbeafe"/>
      <text x="${pillX + pillW / 2}" y="${pillY + 20}" text-anchor="middle" font-family="${ff}, sans-serif" font-size="15" font-weight="700" fill="#2563eb">${pill}</text>
      <path d="M${burstRightX} ${burstY + 12}h20M${burstRightX + 8} ${burstY + 4}l18 -4M${burstRightX + 8} ${burstY + 20}l18 4" fill="none" stroke="#059669" stroke-width="3.5" stroke-linecap="round"/>
      ` : ''}
      ${issuesMarkup}
      <rect x="${DISCLAIMER_PAD_X}" y="${discY}" width="${discW}" height="${discH}" rx="12" ry="12" fill="#ffffff" stroke="#dc2626" stroke-width="3"/>
      <text x="${CARD_W / 2}" y="${discY + 28}" text-anchor="middle" font-size="14" font-weight="700" fill="#dc2626">DISCLAIMER</text>
      <line x1="${DISCLAIMER_PAD_X + 36}" y1="${discY + 36}" x2="${DISCLAIMER_PAD_X + discW - 36}" y2="${discY + 36}" stroke="#dc2626" stroke-width="1.5"/>
      <text x="${CARD_W / 2}" y="${discY + 58}" text-anchor="middle" font-size="11" font-weight="400" fill="#000000">The views expressed are that of individuals.</text>
      <text x="${CARD_W / 2}" y="${discY + 76}" text-anchor="middle" font-size="11" font-weight="400" fill="#000000">These products are not intended to diagnose, treat or cure any disease.</text>
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
