import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, LabelList, ResponsiveContainer,
} from 'recharts';

const isSmallChartDevice = () =>
  typeof window !== 'undefined' && window.innerWidth < 380;

const NutritionFilters = ({
  trendRangeDays,
  setTrendRangeDays,
  trendLoading,
  calorieTrendData,
  calorieChartRenderData,
  visibleNutritionDotIndices,
  visibleNutritionTickLabels,
  trendAverageCalories,
  trendBestDay,
  trendAboveTargetDays,
  calorieTarget,
  renderCaloriePointLabel,
  trendPanelRef,
}) => {
  return (
    <div ref={trendPanelRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs md:text-sm text-gray-500">Calorie Trend</p>
          <p className="text-sm md:text-base font-semibold text-gray-900">
            Last {trendRangeDays} days
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setTrendRangeDays(days)}
              className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                trendRangeDays === days
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-white'
              }`}
            >
              {days}D
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
          <p className="text-[10px] text-emerald-700">Average</p>
          <p className="text-xs md:text-sm font-semibold text-emerald-900">{trendAverageCalories} kcal</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <p className="text-[10px] text-slate-600">Best Day</p>
          <p className="text-xs md:text-sm font-semibold text-slate-900">
            {trendBestDay ? `${trendBestDay.label} (${trendBestDay.calories} kcal)` : '-'}
          </p>
        </div>
        <div className="rounded-lg bg-rose-50 px-2 py-1.5 col-span-2 sm:col-span-1">
          <p className="text-[10px] text-rose-700">Above Target</p>
          <p className="text-xs md:text-sm font-semibold text-rose-900">
            {trendAboveTargetDays}/{calorieTrendData.length || trendRangeDays} days
          </p>
        </div>
      </div>

      {trendLoading ? (
        <div className="h-36 rounded-xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" />
      ) : calorieTrendData.length === 0 ? (
        <div className="h-36 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500">
          No trend data available
        </div>
      ) : (
        <>
          <div className="w-full h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={calorieChartRenderData} margin={{ top: 30, right: 22, left: 0, bottom: 12 }}>
                <XAxis
                  dataKey="label"
                  interval={0}
                  ticks={visibleNutritionTickLabels}
                  padding={{ left: 6, right: 12 }}
                  minTickGap={12}
                  tick={{ fontSize: isSmallChartDevice() ? 8 : 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={34}
                  tick={{ fontSize: isSmallChartDevice() ? 8 : 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'auto']}
                  tickCount={6}
                />
                <ReferenceLine y={calorieTarget} stroke="#9ca3af" strokeDasharray="5 5" ifOverflow="extendDomain" />
                <Line
                  type="linear"
                  dataKey="calories"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  dot={({ cx, cy, payload, index }) => {
                    if (cx === undefined || cy === undefined || !payload || !visibleNutritionDotIndices.has(index)) {
                      return null;
                    }
                    return (
                      <circle
                        key={`calorie-dot-${payload.key || index}`}
                        cx={cx}
                        cy={cy}
                        r={isSmallChartDevice() ? 3 : 4}
                        fill="#16a34a"
                      />
                    );
                  }}
                  activeDot={false}
                  isAnimationActive={false}
                >
                  <LabelList dataKey="calories" content={renderCaloriePointLabel} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <span>Target: {calorieTarget} kcal</span>
            <span>Avg: {trendAverageCalories} kcal</span>
          </div>
        </>
      )}
    </div>
  );
};

export default NutritionFilters;
