/**
 * Run: node --test frontend/src/features/testimonials/__tests__/transformationCollagePrompt.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLAGE_CHATGPT_PROMPT,
  buildChatGptCollageUrl,
} from '../utils/transformationCollagePrompt.js';

describe('collage ChatGPT prompt', () => {
  it('asks for one collage with Before After Now and face lock', () => {
    assert.equal(typeof COLLAGE_CHATGPT_PROMPT, 'string');
    assert.match(COLLAGE_CHATGPT_PROMPT, /BEFORE/);
    assert.match(COLLAGE_CHATGPT_PROMPT, /AFTER/);
    assert.match(COLLAGE_CHATGPT_PROMPT, /NOW/);
    assert.match(COLLAGE_CHATGPT_PROMPT, /SAME face/i);
    assert.match(COLLAGE_CHATGPT_PROMPT, /ONE single image collage/i);
  });

  it('builds a ChatGPT URL with the prompt prefilled', () => {
    const url = buildChatGptCollageUrl();
    assert.match(url, /^https:\/\/chatgpt\.com\/\?q=/);
    assert.match(url, /BEFORE/);
  });
});
