/**
 * Geometry for handle-based portrait crop (9:16 box over a contain-fitted image).
 */

/**
 * Where the image sits inside the viewport with object-fit: contain.
 */
export function containRect(containerW, containerH, naturalW, naturalH) {
  const cw = Number(containerW) || 0;
  const ch = Number(containerH) || 0;
  const nw = Number(naturalW) || 0;
  const nh = Number(naturalH) || 0;
  if (!(cw > 0) || !(ch > 0) || !(nw > 0) || !(nh > 0)) {
    return { x: 0, y: 0, width: 0, height: 0, scale: 1 };
  }
  const scale = Math.min(cw / nw, ch / nh);
  const width = nw * scale;
  const height = nh * scale;
  return {
    x: (cw - width) / 2,
    y: (ch - height) / 2,
    width,
    height,
    scale,
  };
}

/**
 * Largest 9:16 (or given aspect) box that fits inside displayRect, centered.
 */
export function maxAspectCrop(displayRect, aspect = 9 / 16) {
  const a = Number(aspect) || 9 / 16;
  if (!(displayRect?.width > 0) || !(displayRect?.height > 0) || !(a > 0)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let width;
  let height;
  if (displayRect.width / displayRect.height > a) {
    height = displayRect.height;
    width = height * a;
  } else {
    width = displayRect.width;
    height = width / a;
  }
  return {
    x: displayRect.x + (displayRect.width - width) / 2,
    y: displayRect.y + (displayRect.height - height) / 2,
    width,
    height,
  };
}

/** Centered starter — inset so the user can grow or shrink. */
export function initialAspectCrop(displayRect, aspect = 9 / 16, inset = 0.85) {
  const full = maxAspectCrop(displayRect, aspect);
  if (!(full.width > 0)) return full;
  const factor = Math.min(1, Math.max(0.45, Number(inset) || 0.85));
  const width = full.width * factor;
  const height = full.height * factor;
  return {
    x: full.x + (full.width - width) / 2,
    y: full.y + (full.height - height) / 2,
    width,
    height,
  };
}

/** @deprecated alias */
export function initialFreeCrop(displayRect, aspect = 9 / 16, inset = 0.85) {
  return initialAspectCrop(displayRect, aspect, inset);
}

/**
 * Keep crop inside displayRect; preserve aspect.
 * Min size is at least ~25% of the max frame so the box cannot collapse to a thin strip.
 */
export function clampAspectCrop(crop, displayRect, aspect = 9 / 16, minSide = 48) {
  const a = Number(aspect) || 9 / 16;
  if (!(displayRect?.width > 0) || !(displayRect?.height > 0) || !(a > 0)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const maxBox = maxAspectCrop(displayRect, a);
  const minW = Math.max(minSide, maxBox.width * 0.25);
  const minH = minW / a;

  let width = Math.max(minW, Math.min(Number(crop?.width) || 0, maxBox.width));
  let height = width / a;
  if (height > maxBox.height) {
    height = maxBox.height;
    width = height * a;
  }
  if (height < minH) {
    height = minH;
    width = height * a;
  }

  let x = Number(crop?.x);
  let y = Number(crop?.y);
  if (!Number.isFinite(x)) x = displayRect.x;
  if (!Number.isFinite(y)) y = displayRect.y;

  const maxX = displayRect.x + displayRect.width - width;
  const maxY = displayRect.y + displayRect.height - height;
  x = Math.min(Math.max(x, displayRect.x), maxX);
  y = Math.min(Math.max(y, displayRect.y), maxY);

  return { x, y, width, height };
}

export function clampFreeCrop(crop, displayRect, minSide = 48) {
  if (!(displayRect?.width > 0) || !(displayRect?.height > 0)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const minW = Math.min(minSide, displayRect.width);
  const minH = Math.min(minSide, displayRect.height);
  let width = Math.max(minW, Math.min(Number(crop?.width) || 0, displayRect.width));
  let height = Math.max(minH, Math.min(Number(crop?.height) || 0, displayRect.height));
  let x = Number(crop?.x);
  let y = Number(crop?.y);
  if (!Number.isFinite(x)) x = displayRect.x;
  if (!Number.isFinite(y)) y = displayRect.y;
  const maxX = displayRect.x + displayRect.width - width;
  const maxY = displayRect.y + displayRect.height - height;
  x = Math.min(Math.max(x, displayRect.x), maxX);
  y = Math.min(Math.max(y, displayRect.y), maxY);
  return { x, y, width, height };
}

export function cropBoxToPixels(crop, displayRect, naturalW, naturalH) {
  const nw = Number(naturalW) || 0;
  const nh = Number(naturalH) || 0;
  if (!(displayRect?.width > 0) || !(displayRect?.height > 0) || !(nw > 0) || !(nh > 0)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const sx = nw / displayRect.width;
  const sy = nh / displayRect.height;
  const x = Math.round((Number(crop.x) - displayRect.x) * sx);
  const y = Math.round((Number(crop.y) - displayRect.y) * sy);
  const width = Math.round(Number(crop.width) * sx);
  const height = Math.round(Number(crop.height) * sy);
  return {
    x: Math.max(0, Math.min(x, nw - 1)),
    y: Math.max(0, Math.min(y, nh - 1)),
    width: Math.max(1, Math.min(width, nw - Math.max(0, x))),
    height: Math.max(1, Math.min(height, nh - Math.max(0, y))),
  };
}

/**
 * Resize from one corner with locked aspect. Opposite corner stays fixed.
 * The dragged corner follows the pointer along the 9:16 diagonal.
 */
export function resizeAspectCropFromCorner(crop, corner, pointerX, pointerY, displayRect, aspect = 9 / 16) {
  const a = Number(aspect) || 9 / 16;
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;

  const fixed = {
    se: { x: crop.x, y: crop.y },
    sw: { x: right, y: crop.y },
    ne: { x: crop.x, y: bottom },
    nw: { x: right, y: bottom },
  }[corner] || { x: crop.x, y: crop.y };

  // Positive size deltas from the fixed corner toward the dragged corner.
  let rawW;
  let rawH;
  if (corner === 'se') {
    rawW = pointerX - fixed.x;
    rawH = pointerY - fixed.y;
  } else if (corner === 'sw') {
    rawW = fixed.x - pointerX;
    rawH = pointerY - fixed.y;
  } else if (corner === 'ne') {
    rawW = pointerX - fixed.x;
    rawH = fixed.y - pointerY;
  } else {
    rawW = fixed.x - pointerX;
    rawH = fixed.y - pointerY;
  }

  rawW = Math.max(0, rawW);
  rawH = Math.max(0, rawH);

  // Project onto aspect vector (a, 1) so the corner moves diagonally (not axis-only).
  const t = (rawW * a + rawH) / (a * a + 1);
  const width = t * a;
  const height = width / a;

  let x;
  let y;
  if (corner === 'se') {
    x = fixed.x;
    y = fixed.y;
  } else if (corner === 'sw') {
    x = fixed.x - width;
    y = fixed.y;
  } else if (corner === 'ne') {
    x = fixed.x;
    y = fixed.y - height;
  } else {
    x = fixed.x - width;
    y = fixed.y - height;
  }

  return clampAspectCrop({ x, y, width, height }, displayRect, a);
}

/** Free-form (no aspect) — kept for tests / legacy. */
export function resizeFreeCropFromCorner(crop, corner, pointerX, pointerY, displayRect) {
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;
  const fixed = {
    se: { x: crop.x, y: crop.y },
    sw: { x: right, y: crop.y },
    ne: { x: crop.x, y: bottom },
    nw: { x: right, y: bottom },
  }[corner] || { x: crop.x, y: crop.y };

  return clampFreeCrop({
    x: Math.min(fixed.x, pointerX),
    y: Math.min(fixed.y, pointerY),
    width: Math.abs(pointerX - fixed.x),
    height: Math.abs(pointerY - fixed.y),
  }, displayRect);
}
