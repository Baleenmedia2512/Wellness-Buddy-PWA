/**
 * geminiPromptFormat.test.js — regression guard for the prompt's FORMAT block.
 *
 * Root cause of the bug being fixed: the example JSON in the FORMAT section
 * contained a double-comma and leading commas on micronutrient lines, so
 * Gemini silently dropped those lines when copying the schema. Users saw
 * empty vitamin/mineral progress bars even after migration 0011 landed.
 *
 * This test extracts the FORMAT example from the built prompt, strips the
 * field-type annotations and inline ⚠️ guidance, and asserts that the
 * remaining text is valid JSON. If it isn't, Gemini will misinterpret it.
 *
 * Per claude.md §5 / §9, a regression test must reproduce the defect.
 */
import { geminiService } from '../geminiService';

/**
 * Pull out the JSON block between the first "{" after "FORMAT:" and its
 * matching closing "}". Then strip everything between ": " and the next
 * line-ending comma/closing brace so we are left with `"key": 0` shapes.
 */
function extractFormatExample(prompt) {
  const formatIdx = prompt.indexOf('FORMAT:');
  expect(formatIdx).toBeGreaterThan(-1);
  const slice = prompt.slice(formatIdx);
  const start = slice.indexOf('{');
  // Walk brace depth to find the matching '}'.
  let depth = 0;
  let end = -1;
  for (let i = start; i < slice.length; i++) {
    if (slice[i] === '{') depth++;
    else if (slice[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  expect(end).toBeGreaterThan(start);
  return slice.slice(start, end + 1);
}

/** Strip parenthetical guidance, then collapse every `"key": <value>` token
 *  to `"key": 0` (or keep `{` / `[` openings). Robust to multiple keys per
 *  line and to inline annotations. */
function normalizeToValidJson(example) {
  // Strip parenthetical guidance. Annotations may nest parens (e.g.
  // "formula: sum(food.gi * food.carbs)"), so apply repeatedly until stable
  // — `[^()]` only matches innermost parens per pass.
  let cleaned = example;
  for (let i = 0; i < 10; i++) {
    const next = cleaned.replace(/\([^()]*\)/g, '');
    if (next === cleaned) break;
    cleaned = next;
  }
  // Collapse every `"key": <value>` token to `"key": 0`.
  cleaned = cleaned.replace(/("[A-Za-z_][\w]*")\s*:\s*([^,{}\[\]\n]*?)(?=\s*[,}\]\n])/g, (match, key, val) => {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return `${key}: ${trimmed}`;
    return `${key}: 0`;
  });
  return cleaned;
}

describe('geminiService — FORMAT block in prompt is valid JSON', () => {
  let formatJsonText;

  beforeAll(() => {
    const prompt = geminiService.buildPersonalizedPrompt(null);
    const example = extractFormatExample(prompt);
    formatJsonText = normalizeToValidJson(example);
  });

  it('parses without SyntaxError (regression: double-comma in total block)', () => {
    try {
      JSON.parse(formatJsonText);
    } catch (err) {
      // Print the normalized text on failure so future maintainers can spot
      // the offending line at a glance.
      // eslint-disable-next-line no-console
      console.error('Normalized FORMAT example failed to parse:\n' + formatJsonText);
      throw err;
    }
  });

  it('declares all 17 micronutrient fields in per-food nutrition object', () => {
    const parsed = JSON.parse(formatJsonText);
    const food = parsed.foods[0];
    const microKeys = [
      'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
      'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12',
      'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus',
    ];
    for (const key of microKeys) {
      expect(food.nutrition).toHaveProperty(key);
    }
  });

  it('declares all 17 micronutrient fields in total object', () => {
    const parsed = JSON.parse(formatJsonText);
    const microKeys = [
      'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
      'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12',
      'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus',
    ];
    for (const key of microKeys) {
      expect(parsed.total).toHaveProperty(key);
    }
  });

  it('keeps macros + sugar/sodium/cholesterol/glycemic_index in total', () => {
    const parsed = JSON.parse(formatJsonText);
    for (const k of ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'cholesterol', 'glycemic_index']) {
      expect(parsed.total).toHaveProperty(k);
    }
  });
});
