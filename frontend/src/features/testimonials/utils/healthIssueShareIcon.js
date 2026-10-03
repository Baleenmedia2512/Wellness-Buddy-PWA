/**
 * Map a health-issue label to a capture-safe text glyph.
 * html2canvas reliably paints these glyphs in the final WhatsApp bitmap.
 */

const ICONS = Object.freeze({
  heart: '❤️',
  tired: '😫',
  sleep: '🛏️',
  hormonal: '♀️',
  drop: '🩸',
  pulse: '💓',
  bone: '🦴',
  anxiety: '😰',
  lungs: '🫁',
  food: '🍽️',
  wind: '💨',
  skin: '🧴',
  hair: '💇',
  scale: '⚖️',
});

const RULES = [
  { re: /sleep|insomnia|apnea/, icon: ICONS.sleep },
  { re: /tired|fatigue|exhaust|low energy/, icon: ICONS.tired },
  { re: /hormon|pcod|pcos|period|thyroid/, icon: ICONS.hormonal },
  { re: /diabet/, icon: ICONS.drop },
  { re: /blood pressure|hypertension|\bbp\b/, icon: ICONS.pulse },
  { re: /cholesterol/, icon: ICONS.pulse },
  { re: /knee|joint|arthritis|back pain|\bpain\b/, icon: ICONS.bone },
  { re: /anxiet|stress|migraine/, icon: ICONS.anxiety },
  { re: /depress/, icon: ICONS.heart },
  { re: /liver/, icon: ICONS.lungs },
  { re: /digest|ibs|reflux|gerd/, icon: ICONS.food },
  { re: /breath|asthma/, icon: ICONS.wind },
  { re: /skin|eczema|psoriasis/, icon: ICONS.skin },
  { re: /hair/, icon: ICONS.hair },
  { re: /weight|obes/, icon: ICONS.scale },
];

/** @param {string} label */
export function healthIssueShareIcon(label) {
  const text = String(label || '').toLowerCase();
  const hit = RULES.find((rule) => rule.re.test(text));
  return hit ? hit.icon : ICONS.heart;
}
