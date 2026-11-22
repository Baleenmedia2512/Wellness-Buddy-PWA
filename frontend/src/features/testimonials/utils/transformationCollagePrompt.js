/**
 * ChatGPT prompt for Before | After | Now → one collage (face lock).
 * App stores the downloaded collage in a single Transformation photo slot.
 */

export const COLLAGE_CHATGPT_PROMPT = `I will upload 3 photos in order: 1) BEFORE 2) AFTER 3) NOW.

Create ONE single image collage only:
- 3 equal panels side by side
- Left = BEFORE, Middle = AFTER, Right = NOW
- Use my uploaded photos as-is in each panel
- Keep the SAME face/identity in all panels — do not change, beautify, or replace my face
- Full body visible if present in my photos
- Small labels only: BEFORE | AFTER | NOW
- No long text, no story, no hashtags — only the collage image`;

export async function copyTransformCollagePrompt() {
  const text = COLLAGE_CHATGPT_PROMPT;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}
