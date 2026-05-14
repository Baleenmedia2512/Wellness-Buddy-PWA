import { resolveAiDetectedName, planFoodCorrection } from "../foodCorrectionPlan";

describe("foodCorrectionPlan/resolveAiDetectedName", () => {
  test("prefers snapshot.originalAiName when present", () => {
    const out = resolveAiDetectedName(
      { originalAiName: "tea" },
      { originalAiName: "milk" },
      "boost",
    );
    expect(out).toBe("tea");
  });

  test("falls back to foodItem.originalAiName", () => {
    expect(
      resolveAiDetectedName({}, { originalAiName: "milk" }, "boost"),
    ).toBe("milk");
  });

  test("falls back to correctionMetadata.aiDetected on either side", () => {
    expect(
      resolveAiDetectedName(
        { correctionMetadata: { aiDetected: "tea" } },
        {},
        "boost",
      ),
    ).toBe("tea");
    expect(
      resolveAiDetectedName(
        {},
        { correctionMetadata: { aiDetected: "tea" } },
        "boost",
      ),
    ).toBe("tea");
  });

  test("falls back to originalName when nothing else and not auto-corrected", () => {
    expect(resolveAiDetectedName({}, {}, "rice")).toBe("rice");
  });

  test("falls back to originalName when auto-corrected but missing originalAiName", () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const out = resolveAiDetectedName({ wasAutoCorrected: true }, {}, "rice");
    expect(out).toBe("rice");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("foodCorrectionPlan/planFoodCorrection", () => {
  const baseSnapshot = {
    name: "rice",
    grams: 100,
    originalAiName: "rice",
    wasAutoCorrected: false,
  };
  const baseUpdated = {
    name: "rice",
    grams: 100,
    serving: { grams: 100, unit: "g" },
    nutrition: { calories: 100, protein: 5, carbs: 20, fat: 2, fiber: 1 },
  };

  test("returns null when neither name nor weight changed", () => {
    expect(
      planFoodCorrection({
        originalFoodSnapshot: baseSnapshot,
        foodItem: baseSnapshot,
        updatedFood: baseUpdated,
      }),
    ).toBeNull();
  });

  test("detects name change", () => {
    const plan = planFoodCorrection({
      originalFoodSnapshot: baseSnapshot,
      foodItem: baseSnapshot,
      updatedFood: { ...baseUpdated, name: "boost" },
    });
    expect(plan).not.toBeNull();
    expect(plan.nameChanged).toBe(true);
    expect(plan.weightChanged).toBe(false);
    expect(plan.userCorrectedName).toBe("boost");
    expect(plan.aiDetectedName).toBe("rice");
  });

  test("detects weight change > 0.5", () => {
    const plan = planFoodCorrection({
      originalFoodSnapshot: baseSnapshot,
      foodItem: baseSnapshot,
      updatedFood: { ...baseUpdated, grams: 150, serving: { grams: 150, unit: "g" } },
    });
    expect(plan).not.toBeNull();
    expect(plan.weightChanged).toBe(true);
    expect(plan.nameChanged).toBe(false);
    expect(plan.userCorrectedName).toBe("rice"); // name unchanged → original used
    expect(plan.correctedData.correctedQuantity).toBe(150);
  });

  test("ignores tiny weight diffs <= 0.5", () => {
    const plan = planFoodCorrection({
      originalFoodSnapshot: baseSnapshot,
      foodItem: baseSnapshot,
      updatedFood: { ...baseUpdated, grams: 100.4, serving: { grams: 100.4, unit: "g" } },
    });
    expect(plan).toBeNull();
  });

  test("preserves correction chain via originalAiName when previously auto-corrected", () => {
    const plan = planFoodCorrection({
      originalFoodSnapshot: { ...baseSnapshot, name: "milk", originalAiName: "tea", wasAutoCorrected: true },
      foodItem: { name: "milk", originalAiName: "tea", wasAutoCorrected: true },
      updatedFood: { ...baseUpdated, name: "boost" },
    });
    expect(plan.aiDetectedName).toBe("tea");
    expect(plan.userCorrectedName).toBe("boost");
  });

  test("correctedData carries final nutrition, not AI nutrition", () => {
    const plan = planFoodCorrection({
      originalFoodSnapshot: baseSnapshot,
      foodItem: baseSnapshot,
      updatedFood: {
        ...baseUpdated,
        name: "boost",
        nutrition: { calories: 200, protein: 10, carbs: 30, fat: 4, fiber: 2 },
      },
    });
    expect(plan.correctedData.correctedCalories).toBe(200);
    expect(plan.correctedData.correctedProtein).toBe(10);
  });
});
