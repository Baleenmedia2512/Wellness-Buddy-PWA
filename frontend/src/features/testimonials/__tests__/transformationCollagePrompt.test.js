/**
 * Run: node --test frontend/src/features/testimonials/__tests__/transformationCollagePrompt.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLAGE_CHATGPT_PROMPT,
  buildCollageChatGptPrompt,
  buildChatGptCollageUrl,
} from '../utils/transformationCollagePrompt.js';

describe('collage ChatGPT prompt', () => {
    it('asks for one collage with Before After Now and no face touchup', () => {
      assert.equal(typeof COLLAGE_CHATGPT_PROMPT, 'string');
      assert.match(COLLAGE_CHATGPT_PROMPT, /BEFORE/);
      assert.match(COLLAGE_CHATGPT_PROMPT, /AFTER/);
      assert.match(COLLAGE_CHATGPT_PROMPT, /NOW/);
      assert.match(COLLAGE_CHATGPT_PROMPT, /3 equal panels side by side/i);
      assert.match(COLLAGE_CHATGPT_PROMPT, /Don't make any touchup to the faces/i);
      assert.match(COLLAGE_CHATGPT_PROMPT, /ONE single image collage/i);
    });

      it('builds a dynamic prompt with user before weight, after weight, loss, and duration', () => {
        const prompt = buildCollageChatGptPrompt({
          beforeWeightKg: 86,
          afterWeightKg: 73,
          durationText: '4 months',
        });
        assert.match(prompt, /Before weight 86 kg and after weight 73 kg\. Reduced 13kg in 4 months\. Don't make any touchup to the faces\./);
      });

      it('supports weight gain dynamically when after weight exceeds before weight', () => {
        const prompt = buildCollageChatGptPrompt({
          beforeWeightKg: 52.5,
          afterWeightKg: 60,
          durationText: '3 months',
        });
        assert.match(prompt, /Before weight 52\.5 kg and after weight 60 kg\. Gained 7\.5kg in 3 months\./);
      });

      it('builds a ChatGPT URL with the dynamic prompt prefilled', () => {
        const url = buildChatGptCollageUrl({ beforeWeightKg: 86, afterWeightKg: 73, durationText: '4 months' });
        assert.match(url, /^https:\/\/chatgpt\.com\/\?q=/);
        assert.match(url, /86/);
        assert.match(url, /73/);
        assert.match(url, /BEFORE/);
      });
    });
