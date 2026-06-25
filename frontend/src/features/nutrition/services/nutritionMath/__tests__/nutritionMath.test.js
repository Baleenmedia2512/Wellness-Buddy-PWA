import {
  textToNumber,
  decimalToFraction,
  computeNutrition,
  generateServingOptions,
} from "../index";

describe("nutritionMath/textToNumber", () => {
  test("returns null for non-string input", () => {
    expect(textToNumber(null)).toBeNull();
    expect(textToNumber(undefined)).toBeNull();
    expect(textToNumber(123)).toBeNull();
  });

  test("matches single number words", () => {
    expect(textToNumber("two parottas")).toBe(2);
    expect(textToNumber("Half a cup")).toBe(0.5);
    expect(textToNumber("quarter pound")).toBe(0.25);
  });

  test("preserves legacy includes-based semantics", () => {
    expect(textToNumber("twenty grams")).toBe(20);
  });

  test("returns null when no number word present", () => {
    expect(textToNumber("a bowl of rice")).toBeNull();
  });
});

describe("nutritionMath/decimalToFraction", () => {
  test("whole numbers stringify as integer", () => {
    expect(decimalToFraction(2)).toBe("2");
    expect(decimalToFraction(0)).toBe("0");
  });

  test("common fractions round to known forms", () => {
    expect(decimalToFraction(0.25)).toBe("1/4");
    expect(decimalToFraction(0.5)).toBe("1/2");
    expect(decimalToFraction(0.75)).toBe("3/4");
  });

  test("mixed numbers combine whole and fraction", () => {
    expect(decimalToFraction(1.5)).toBe("1 1/2");
    expect(decimalToFraction(2.25)).toBe("2 1/4");
  });

  test("non-common fractions fall back to one decimal", () => {
    expect(decimalToFraction(1.1)).toBe("1.1");
  });
});

describe("nutritionMath/computeNutrition", () => {
  test("returns null when inputs missing", () => {
    expect(computeNutrition(null, 100)).toBeNull();
    expect(computeNutrition({ calories: 100 }, 0)).toBeNull();
  });

  test("scales per-100g values; calories rounded, macros ceil'd", () => {
    const per100g = { calories: 100, protein: 1.1, carbs: 2.2, fat: 0.4, fiber: 0.5 };
    expect(computeNutrition(per100g, 50)).toEqual({
      calories: 50,
      protein: 1, // 0.55 -> ceil 1
      carbs: 2, // 1.1 -> ceil 2
      fat: 1, // 0.2 -> ceil 1
      fiber: 1, // 0.25 -> ceil 1
    });
  });

  test("missing fiber treated as 0", () => {
    const out = computeNutrition({ calories: 0, protein: 0, carbs: 0, fat: 0 }, 100);
    expect(out.fiber).toBe(0);
  });
});

describe("nutritionMath/generateServingOptions", () => {
  const per100g = { calories: 100, protein: 5, carbs: 20, fat: 2, fiber: 1 };

  test("returns array including original quantity", () => {
    const options = generateServingOptions(
      { grams: 100 },
      per100g,
      "rice",
      "1 bowl",
    );
    expect(Array.isArray(options)).toBe(true);
    expect(options.some((o) => o.isOriginal)).toBe(true);
    const original = options.find((o) => o.isOriginal);
    expect(original.description).toContain("(original)");
  });

  test("uses fraction format when input is a fraction", () => {
    const options = generateServingOptions(
      { grams: 250 },
      per100g,
      "milk",
      "1/2 cup",
    );
    const original = options.find((o) => o.isOriginal);
    expect(original.description).toMatch(/1\/2/);
  });

  test("each option carries scaled nutrition derived from per100g", () => {
    const options = generateServingOptions(
      { grams: 100 },
      per100g,
      "rice",
      "1 bowl",
    );
    options.forEach((o) => {
      expect(o.nutrition).toEqual(
        expect.objectContaining({
          calories: expect.any(Number),
          protein: expect.any(Number),
          carbs: expect.any(Number),
          fat: expect.any(Number),
          fiber: expect.any(Number),
        }),
      );
    });
  });
});
