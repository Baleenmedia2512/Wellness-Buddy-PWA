/**
 * ChatGPT prompt for Before | After | Now → one collage (face lock).
 * Dynamically embeds user Before/After weights and duration when available.
 */

function formatPromptWeight(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Number(num.toFixed(1)).toString();
}

function buildWeightSummarySentence({ beforeWeightKg, afterWeightKg, durationText } = {}) {
  const beforeLabel = formatPromptWeight(beforeWeightKg);
  const afterLabel = formatPromptWeight(afterWeightKg);
  const durRaw = String(durationText || '').trim();
  const duration = durRaw && durRaw !== '—' && durRaw !== '-' ? durRaw : '';

  if (beforeLabel && afterLabel) {
    const beforeNum = Number(beforeLabel);
    const afterNum = Number(afterLabel);
    const diffNum = Math.abs(beforeNum - afterNum);
    const diffLabel = Number(diffNum.toFixed(1)).toString();
    let changeSentence = '';
    if (beforeNum > afterNum) {
      changeSentence = `Reduced ${diffLabel}kg${duration ? ` in ${duration}` : ''}.`;
    } else if (afterNum > beforeNum) {
      changeSentence = `Gained ${diffLabel}kg${duration ? ` in ${duration}` : ''}.`;
    } else {
      changeSentence = duration ? `Achieved in ${duration}.` : '';
    }
    return [
      `Before weight ${beforeLabel} kg and after weight ${afterLabel} kg.`,
      changeSentence,
      "Don't make any touchup to the faces.",
    ].filter(Boolean).join(' ');
  }

  return [
    duration ? `Transformation in ${duration}.` : '',
    "Don't make any touchup to the faces.",
  ].filter(Boolean).join(' ');
}

/**
 * Build a user-specific ChatGPT collage prompt from Before weight, After weight, and duration.
 * @param {{ beforeWeightKg?: number|string|null, afterWeightKg?: number|string|null, durationText?: string|null }} [details]
 */
export function buildCollageChatGptPrompt(details = {}) {
  const summaryLine = buildWeightSummarySentence(details);
  return `I will upload 3 photos in order: 1) BEFORE 2) AFTER 3) NOW.

Create ONE single image collage only:
- 3 equal panels side by side
  - Left = BEFORE, Middle = AFTER, Right = NOW

${summaryLine}`;
}

export const COLLAGE_CHATGPT_PROMPT = buildCollageChatGptPrompt();

/** Prefills ChatGPT composer when the browser allows query deep-links. */
export function buildChatGptCollageUrl(promptOrDetails = COLLAGE_CHATGPT_PROMPT) {
  const text = typeof promptOrDetails === 'object' && promptOrDetails !== null
    ? buildCollageChatGptPrompt(promptOrDetails)
    : String(promptOrDetails || COLLAGE_CHATGPT_PROMPT).trim();
  return `https://chatgpt.com/?q=${encodeURIComponent(text)}`;
}

export async function copyTransformCollagePrompt(promptOrDetails = COLLAGE_CHATGPT_PROMPT) {
  const text = typeof promptOrDetails === 'object' && promptOrDetails !== null
    ? buildCollageChatGptPrompt(promptOrDetails)
    : String(promptOrDetails || COLLAGE_CHATGPT_PROMPT).trim();
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

export function openChatGptCollageWindow(promptOrDetails = COLLAGE_CHATGPT_PROMPT) {
  try {
    if (typeof window !== 'undefined') {
      const win = window.open(buildChatGptCollageUrl(promptOrDetails), '_blank', 'noopener,noreferrer');
      return Boolean(win);
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Copy prompt, then open ChatGPT with the prompt in the composer when possible.
 * @returns {Promise<{ copied: boolean, opened: boolean, prompt: string }>}
 */
export async function copyAndOpenChatGptCollagePrompt(details = {}) {
  const prompt = typeof details === 'string'
    ? details
    : buildCollageChatGptPrompt(details);
  let copied = false;
  try {
    copied = await copyTransformCollagePrompt(prompt);
  } catch {
    copied = false;
  }
  const opened = openChatGptCollageWindow(prompt);
  return { copied, opened, prompt };
}
