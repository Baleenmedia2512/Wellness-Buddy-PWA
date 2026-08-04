/**
 * Maps a diary timeline food row to the meal shape NutritionDashboard modals expect.
 * Used when the hidden dashboard list has not loaded yet (coach member view, race on tap).
 */

/** @param {{ kind?: string, capturedAt?: string, payload?: object }} diaryEntry */
export function mealFromDiaryRow(diaryEntry) {
  const p = diaryEntry?.payload || {};
  if (p.id == null || p.id === '') return null;

  const t = p.totals || {};
  return {
    ID: p.id,
    AnalysisData: p.analysisData ?? null,
    ImageBase64: p.imageBase64 ?? null,
    ImagePath: p.imagePath ?? null,
    TotalCalories: t.calories ?? null,
    TotalProtein: t.protein ?? null,
    TotalCarbs: t.carbs ?? null,
    TotalFat: t.fat ?? null,
    TotalFiber: t.fiber ?? null,
    TotalSugar: t.sugar ?? null,
    TotalSodium: t.sodium ?? null,
    TotalCholesterol: t.cholesterol ?? null,
    GlycemicIndex: t.glycemicIndex ?? null,
    ConfidenceScore: p.confidence ?? null,
    CreatedAt: diaryEntry.capturedAt ?? null,
    ProcessedBy: p.processedBy ?? null,
    DeviceInfo: p.deviceInfo ?? null,
  };
}
