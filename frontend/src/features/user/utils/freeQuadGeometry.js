/**
 * Free-quad crop geometry — 4 independent corners (+ edge midpoints).
 * Points are in viewport / container coordinates.
 */

/** @typedef {{ x: number, y: number }} Pt */
/** @typedef {{ tl: Pt, tr: Pt, br: Pt, bl: Pt }} Quad */

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

/** Inset rectangular starter quad (tl, tr, br, bl). */
export function initialQuad(displayRect, inset = 0.08) {
  if (!(displayRect?.width > 0) || !(displayRect?.height > 0)) {
    return {
      tl: { x: 0, y: 0 },
      tr: { x: 0, y: 0 },
      br: { x: 0, y: 0 },
      bl: { x: 0, y: 0 },
    };
  }
  const padX = displayRect.width * Math.min(0.4, Math.max(0, inset));
  const padY = displayRect.height * Math.min(0.4, Math.max(0, inset));
  const left = displayRect.x + padX;
  const right = displayRect.x + displayRect.width - padX;
  const top = displayRect.y + padY;
  const bottom = displayRect.y + displayRect.height - padY;
  return {
    tl: { x: left, y: top },
    tr: { x: right, y: top },
    br: { x: right, y: bottom },
    bl: { x: left, y: bottom },
  };
}

export function clampPoint(pt, displayRect) {
  if (!(displayRect?.width > 0)) return { x: 0, y: 0 };
  return {
    x: Math.min(Math.max(Number(pt?.x) || 0, displayRect.x), displayRect.x + displayRect.width),
    y: Math.min(Math.max(Number(pt?.y) || 0, displayRect.y), displayRect.y + displayRect.height),
  };
}

export function clampQuad(quad, displayRect) {
  return {
    tl: clampPoint(quad.tl, displayRect),
    tr: clampPoint(quad.tr, displayRect),
    br: clampPoint(quad.br, displayRect),
    bl: clampPoint(quad.bl, displayRect),
  };
}

export function midpoints(quad) {
  return {
    top: { x: (quad.tl.x + quad.tr.x) / 2, y: (quad.tl.y + quad.tr.y) / 2 },
    right: { x: (quad.tr.x + quad.br.x) / 2, y: (quad.tr.y + quad.br.y) / 2 },
    bottom: { x: (quad.bl.x + quad.br.x) / 2, y: (quad.bl.y + quad.br.y) / 2 },
    left: { x: (quad.tl.x + quad.bl.x) / 2, y: (quad.tl.y + quad.bl.y) / 2 },
  };
}

/** Move one corner; others stay put. */
export function moveCorner(quad, corner, point, displayRect) {
  const next = { ...quad, [corner]: clampPoint(point, displayRect) };
  return next;
}

/** Move an edge by translating both of its corners by the same delta. */
export function moveEdge(quad, edge, dx, dy, displayRect) {
  const pairs = {
    top: ['tl', 'tr'],
    right: ['tr', 'br'],
    bottom: ['bl', 'br'],
    left: ['tl', 'bl'],
  }[edge];
  if (!pairs) return quad;
  const next = { ...quad };
  for (const key of pairs) {
    next[key] = clampPoint({ x: quad[key].x + dx, y: quad[key].y + dy }, displayRect);
  }
  return next;
}

/** Translate whole quad. */
export function moveQuad(quad, dx, dy, displayRect) {
  return clampQuad({
    tl: { x: quad.tl.x + dx, y: quad.tl.y + dy },
    tr: { x: quad.tr.x + dx, y: quad.tr.y + dy },
    br: { x: quad.br.x + dx, y: quad.br.y + dy },
    bl: { x: quad.bl.x + dx, y: quad.bl.y + dy },
  }, displayRect);
}

export function quadPointsAttr(quad) {
  return `${quad.tl.x},${quad.tl.y} ${quad.tr.x},${quad.tr.y} ${quad.br.x},${quad.br.y} ${quad.bl.x},${quad.bl.y}`;
}

/** Map a display-space quad onto natural image pixels (clamped inside the bitmap). */
export function quadToNaturalPixels(quad, displayRect, naturalW, naturalH) {
  const nw = Number(naturalW) || 0;
  const nh = Number(naturalH) || 0;
  if (!(displayRect?.width > 0) || !(displayRect?.height > 0) || !(nw > 0) || !(nh > 0)) {
    return null;
  }
  const sx = nw / displayRect.width;
  const sy = nh / displayRect.height;
  const map = (p) => ({
    x: Math.min(nw, Math.max(0, (Number(p.x) - displayRect.x) * sx)),
    y: Math.min(nh, Math.max(0, (Number(p.y) - displayRect.y) * sy)),
  });
  return {
    tl: map(quad.tl),
    tr: map(quad.tr),
    br: map(quad.br),
    bl: map(quad.bl),
  };
}

/** Average side lengths → output rectangle size suggestion. */
export function quadOutputSize(naturalQuad, maxDimension = 1200) {
  if (!naturalQuad) return { width: 1, height: 1 };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const top = dist(naturalQuad.tl, naturalQuad.tr);
  const bottom = dist(naturalQuad.bl, naturalQuad.br);
  const left = dist(naturalQuad.tl, naturalQuad.bl);
  const right = dist(naturalQuad.tr, naturalQuad.br);
  let width = Math.max(1, Math.round((top + bottom) / 2));
  let height = Math.max(1, Math.round((left + right) / 2));
  const max = Number(maxDimension) || 1200;
  const scale = Math.min(1, max / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  return { width, height };
}
