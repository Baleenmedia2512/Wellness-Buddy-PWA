/**
 * Run: node --test frontend/src/features/weight/services/__tests__/weightChartGeometry.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChartGeometry, computeResponsiveDateLabelOptions, computeTrendChartRenderWidth } from '../weightChartGeometry.js';

function point(key, value) {
  return { key, value, label: key, hasRecorded: true };
}

describe('buildChartGeometry date-proportional axis', () => {
  it('spaces sparse points by calendar date within the selected range', () => {
    const rangeStart = new Date(2026, 7, 1); // Aug 1
    const rangeEnd = new Date(2026, 7, 29); // Aug 29
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    const series = [
      point('2026-08-10', 80),
      point('2026-08-11', 81),
      point('2026-08-29', 77),
    ];
    const geom = buildChartGeometry(series, 300, {
      plotAllPoints: true,
      maxDateLabels: 7,
      rangeStart,
      rangeEnd,
    });

    const [first, second, last] = geom.points;
    assert.ok(second.x - first.x < last.x - second.x, 'later dates should spread farther apart');
    assert.ok(first.x < second.x && second.x < last.x, 'x should increase with date');
  });

  it('places the first recorded point at the left edge of the plot', () => {
    const rangeStart = new Date(2026, 7, 10);
    const rangeEnd = new Date(2026, 7, 29);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    const series = [
      point('2026-08-10', 80),
      point('2026-08-15', 81),
      point('2026-08-29', 77),
    ];
    const geom = buildChartGeometry(series, 300, {
      plotAllPoints: true,
      rangeStart,
      rangeEnd,
    });

    assert.equal(geom.points[0].x, 30);
    assert.equal(geom.points[geom.points.length - 1].x, 300 - 14);
  });

  it('falls back to index spacing when range bounds are omitted', () => {
    const series = [
      point('2026-08-10', 80),
      point('2026-08-29', 77),
    ];
    const geom = buildChartGeometry(series, 300, { plotAllPoints: true });
    const gap = geom.points[1].x - geom.points[0].x;
    const plotWidth = 300 - 30 - 14;
    assert.equal(gap, plotWidth);
  });

  it('skips crowded date labels when points are only one day apart', () => {
    const rangeStart = new Date(2026, 7, 20);
    const rangeEnd = new Date(2026, 7, 29);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    const series = [
      point('2026-08-20', 80),
      point('2026-08-21', 81),
      point('2026-08-22', 82),
      point('2026-08-24', 83),
      point('2026-08-25', 84),
      point('2026-08-26', 85),
      point('2026-08-29', 86),
    ];
    const geom = buildChartGeometry(series, 320, {
      plotAllPoints: true,
      maxDateLabels: series.length,
      minDateLabelGapPx: 40,
      rangeStart,
      rangeEnd,
    });

    const labeled = Array.from(geom.dateLabelIndices).sort((a, b) => a - b);
    for (let i = 1; i < labeled.length; i += 1) {
      const gap = geom.points[labeled[i]].x - geom.points[labeled[i - 1]].x;
      assert.ok(gap >= 40, `labels at ${labeled[i - 1]} and ${labeled[i]} are too close`);
    }
  });

  it('shows more compact day labels with a smaller minimum gap', () => {
    const rangeStart = new Date(2026, 7, 10);
    const rangeEnd = new Date(2026, 7, 29);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    const series = [
      point('2026-08-10', 80),
      point('2026-08-11', 81),
      point('2026-08-14', 82),
      point('2026-08-15', 83),
      point('2026-08-18', 84),
      point('2026-08-26', 85),
      point('2026-08-29', 86),
    ];
    const wideGap = buildChartGeometry(series, 320, {
      plotAllPoints: true,
      maxDateLabels: series.length,
      minDateLabelGapPx: 40,
      rangeStart,
      rangeEnd,
    });
    const compactGap = buildChartGeometry(series, 320, {
      plotAllPoints: true,
      maxDateLabels: series.length,
      minDateLabelGapPx: 12,
      rangeStart,
      rangeEnd,
    });

    assert.ok(compactGap.dateLabelIndices.size > wideGap.dateLabelIndices.size);
  });

  it('shows a label for every point when showAllDateLabels is enabled', () => {
    const rangeStart = new Date(2026, 7, 10);
    const rangeEnd = new Date(2026, 7, 20);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    const series = [
      point('2026-08-10', 80),
      point('2026-08-11', 81),
      point('2026-08-12', 82),
      point('2026-08-14', 83),
      point('2026-08-16', 84),
      point('2026-08-17', 85),
      point('2026-08-20', 86),
    ];
    const geom = buildChartGeometry(series, 320, {
      plotAllPoints: true,
      showAllDateLabels: true,
      rangeStart,
      rangeEnd,
    });

    assert.equal(geom.dateLabelIndices.size, series.length);
  });
});

describe('computeTrendChartRenderWidth', () => {
  it('expands width on narrow screens when the date span needs more room', () => {
    const start = new Date(2026, 7, 10);
    const end = new Date(2026, 7, 29);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const width = computeTrendChartRenderWidth(320, start, end, true);
    assert.ok(width > 320);
  });

  it('keeps container width for short 5-day spans', () => {
    const start = new Date(2026, 7, 25);
    const end = new Date(2026, 7, 29);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const width = computeTrendChartRenderWidth(320, start, end, true);
    assert.equal(width, 320);
  });
});

describe('computeResponsiveDateLabelOptions', () => {
  it('allows more labels on wide screens and fewer on narrow screens', () => {
    const wide = computeResponsiveDateLabelOptions(720, 8, false);
    const narrow = computeResponsiveDateLabelOptions(320, 8, true);
    assert.ok(wide.maxDateLabels >= narrow.maxDateLabels);
    assert.ok(wide.minDateLabelGapPx >= narrow.minDateLabelGapPx);
  });
});
