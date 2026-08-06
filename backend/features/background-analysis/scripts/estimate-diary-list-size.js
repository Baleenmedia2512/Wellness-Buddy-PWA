/**
 * Rough payload-size estimate: before vs after lean diary list projection.
 * Run: node backend/features/background-analysis/scripts/estimate-diary-list-size.js
 */
import { extractFoodListSummary } from '../domain/diary-list-summary.js';
import { paginateDiaryEntries } from '../domain/diary-pagination.js';

function fakeBase64(kb) {
  return 'A'.repeat(Math.round(kb * 1024 * 4 / 3));
}

function fakeAnalysis(name) {
  return JSON.stringify({
    foods: Array.from({ length: 6 }, (_, i) => ({
      name: `${name}-item-${i}`,
      calories: 50 + i * 10,
      nutrition: {
        protein: 5, carbs: 10, fat: 2, fiber: 1,
        vitamin_a: 1, vitamin_c: 2, vitamin_d: 3, calcium: 4,
        calcium: 5, iron: 6, magnesium: 7, potassium: 8, zinc: 9,
      },
    })),
    total: { calories: 400, protein: 30, carbs: 60, fat: 12, fiber: 6 },
    category: { name },
    confidence: 0.92,
    notes: 'x'.repeat(400),
  });
}

function buildLegacyEntry(i) {
  const analysis = fakeAnalysis(`Meal${i}`);
  return {
    kind: 'food',
    capturedAt: new Date().toISOString(),
    capture: { id: `cap-${i}` },
    payload: {
      id: i,
      imagePath: `/img/${i}.jpg`,
      imageBase64: fakeBase64(22), // ~22KB JPEG thumb
      analysisData: analysis,
      totals: { calories: 400, protein: 30, carbs: 60, fat: 12, fiber: 6 },
      processedBy: null,
    },
  };
}

function buildLeanEntry(i) {
  const analysis = fakeAnalysis(`Meal${i}`);
  const listSummary = extractFoodListSummary(JSON.parse(analysis), null);
  return {
    kind: 'food',
    capturedAt: new Date().toISOString(),
    capture: { id: `cap-${i}` },
    payload: {
      id: i,
      imagePath: `/img/${i}.jpg`,
      hasImage: true,
      listSummary,
      totals: { calories: 400, protein: 30, carbs: 60, fat: 12, fiber: 6 },
      processedBy: null,
    },
  };
}

function bytes(obj) {
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}

const TOTAL = 48; // busy day
const legacyAll = {
  date: '2026-08-06',
  ownerUserId: '339',
  entries: Array.from({ length: TOTAL }, (_, i) => buildLegacyEntry(i)),
};
const leanAll = Array.from({ length: TOTAL }, (_, i) => buildLeanEntry(i));
const { entries: page, pagination } = paginateDiaryEntries(leanAll, { limit: 20, offset: 0 });
const leanPage = {
  date: '2026-08-06',
  ownerUserId: '339',
  pagination,
  entries: page,
};

const legacyBytes = bytes(legacyAll);
const leanBytes = bytes(leanPage);
const reduction = ((legacyBytes - leanBytes) / legacyBytes) * 100;

console.log(JSON.stringify({
  scenario: `${TOTAL} food entries on one day`,
  before: {
    apiCalls: 1,
    responseBytes: legacyBytes,
    responseKB: Math.round(legacyBytes / 1024),
    includesBase64: true,
    includesAnalysisData: true,
  },
  after: {
    apiCallsInitial: 1,
    apiCallsToExhaust: Math.ceil(TOTAL / 20),
    initialResponseBytes: leanBytes,
    initialResponseKB: Math.round(leanBytes / 1024),
    pageSize: 20,
    hasMore: pagination.hasMore,
    includesBase64: false,
    includesAnalysisData: false,
  },
  improvement: {
    initialPayloadReductionPct: Math.round(reduction * 10) / 10,
    approxInitialPayloadRatio: `${Math.round(leanBytes / 1024)}KB / ${Math.round(legacyBytes / 1024)}KB`,
  },
}, null, 2));
