/**
 * Photo fit helpers for the transformation share card.
 * html2canvas ignores CSS object-fit, so capture bakes the crop into a bitmap.
 */

/** Scale a source rectangle into maxW×maxH without changing its aspect ratio. */
export function fitContainSize(naturalW, naturalH, maxW, maxH) {
  const nw = Number(naturalW) || 0;
  const nh = Number(naturalH) || 0;
  if (nw <= 0 || nh <= 0) return { width: maxW, height: maxH };
  const scale = Math.min(maxW / nw, maxH / nh);
  return {
    width: Math.max(1, Math.round(nw * scale)),
    height: Math.max(1, Math.round(nh * scale)),
  };
}

/**
 * Draw an image into destW×destH like CSS object-fit:cover; object-position:top.
 * Used before html2canvas so WhatsApp gets a cropped bitmap, not a stretched one.
 */
export function drawImageCoverTop(ctx, img, destW, destH) {
  const nw = img.naturalWidth || 0;
  const nh = img.naturalHeight || 0;
  if (!nw || !nh || !destW || !destH) return;
  const scale = Math.max(destW / nw, destH / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  ctx.drawImage(img, (destW - dw) / 2, 0, dw, dh);
}
