/**
 * Position the original photo inside a 9:16 window so only the chosen crop shows.
 * Percentages are relative to the window, so the same image element stays the original.
 */
export function portraitCropWindowStyle(area, naturalWidth, naturalHeight) {
  const cropW = Number(area?.width) || 0;
  const cropH = Number(area?.height) || 0;
  const imageW = Number(naturalWidth) || 0;
  const imageH = Number(naturalHeight) || 0;
  if (!(cropW > 0) || !(cropH > 0) || !(imageW > 0) || !(imageH > 0)) return null;
  const x = Number(area.x) || 0;
  const y = Number(area.y) || 0;
  return {
    position: 'absolute',
    width: `${(imageW / cropW) * 100}%`,
    height: `${(imageH / cropH) * 100}%`,
    left: `${(-x / cropW) * 100}%`,
    top: `${(-y / cropH) * 100}%`,
    maxWidth: 'none',
  };
}
