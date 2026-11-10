/**
 * Keep public portfolio copy short — storybook feel, not a resume dump.
 */

export function shortPublicText(value, max = 180) {
  const t = String(value || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  const cut = t.slice(0, Math.max(0, max - 1));
  const soft = cut.replace(/\s+\S*$/, '').trim();
  return `${soft || cut}…`;
}
