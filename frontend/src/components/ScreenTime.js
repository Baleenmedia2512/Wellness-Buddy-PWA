import React, { useEffect, useState, useCallback } from 'react';
import { screenTimeService } from '../services/screenTimeService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { ArrowLeft, Clock, Smartphone, Calendar, TrendingUp } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a total number of seconds into a human-readable string.
 * < 60 s  → "0m"
 * < 3600  → "35m"
 * ≥ 3600  → "1h 30m"
 */
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  if (s === 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format seconds as plain minutes (for chart Y-axis). */
function toMinutes(seconds) {
  return Math.round((seconds || 0) / 60);
}

/** Format a date key "YYYY-MM-DD" into a short label like "Mar 13". */
function shortDate(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format a date key into a weekday + date label like "Thu, Mar 13". */
function fullDate(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="text-gray-500 text-xs mb-1">{shortDate(label)}</p>
      <p className="font-bold text-indigo-600">{payload[0].value} min</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScreenTime({ userId, onBack }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      const res = await fetch(
        `${apiBaseUrl}/api/get-screen-sessions?userId=${encodeURIComponent(userId)}&days=30`,
        {
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          cache: 'no-store'
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown error');

      // Map API response to the shape this component expects
      const trend = json.trend || [];
      const todayKey = json.today?.date;
      const yesterdayKey = trend.length >= 2 ? trend[trend.length - 2]?.date : null;
      const yesterdayEntry = trend.find((d) => d.date === yesterdayKey);
      const last7 = trend.slice(-7).reduce((a, d) => a + d.totalDurationSeconds, 0);
      const last30 = trend.reduce((a, d) => a + d.totalDurationSeconds, 0);
      const dailyChart = trend.map((d) => ({ date: d.date, durationSeconds: d.totalDurationSeconds }));
      const recentDays = dailyChart.slice().reverse().filter((d) => d.durationSeconds > 0).slice(0, 7);

      setAnalytics({
        todaySeconds: json.today?.totalDurationSeconds ?? 0,
        yesterdaySeconds: yesterdayEntry?.totalDurationSeconds ?? 0,
        last7DaysSeconds: last7,
        last30DaysSeconds: last30,
        dailyChart,
        recentDays
      });
    } catch (err) {
      console.warn('[ScreenTime] Failed to load screen time data:', err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ── Chart data: map daily chart to minutes ───────────────────────────────
  const chartData = (analytics?.dailyChart || []).map((d) => ({
    date: d.date,
    minutes: toMinutes(d.durationSeconds)
  }));

  // Keep only days with data for the bar chart (sparse view) — show full 30 days
  const hasChartData = chartData.some((d) => d.minutes > 0);

  // ── Today's circular indicator ───────────────────────────────────────────
  const todayMinutes = toMinutes(analytics?.todaySeconds || 0);
  // Target reference: 2 hours = 120 min → full circle
  const TARGET_MINUTES = 120;
  const fillPct = Math.min(100, Math.round((todayMinutes / TARGET_MINUTES) * 100));
  const RADIUS = 54;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const strokeDashoffset = CIRCUMFERENCE - (fillPct / 100) * CIRCUMFERENCE;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">Screen Time</h1>
          <p className="text-xs text-gray-500">Digital Wellbeing</p>
        </div>
        <button
          onClick={async () => {
            // Save the current active session before fetching so the total is up to date
            await screenTimeService.endSession();
            screenTimeService.startSession(userId);
            fetchAnalytics();
          }}
          className="ml-auto text-xs text-indigo-600 font-semibold active:opacity-70"
          aria-label="Refresh"
        >
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 max-w-lg mx-auto w-full">

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading your usage data…</p>
          </div>
        )}

        {/* ── Demo data notice removed for production ── */}

        {!loading && analytics && (
          <>
            {/* ── Today section ─────────────────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Today</p>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
                {/* Circular indicator */}
                <div className="relative flex items-center justify-center" style={{ width: 144, height: 144 }}>
                  <svg width={144} height={144} className="-rotate-90">
                    {/* Track */}
                    <circle
                      cx={72}
                      cy={72}
                      r={RADIUS}
                      fill="none"
                      stroke="#E0E7FF"
                      strokeWidth={12}
                    />
                    {/* Progress */}
                    <circle
                      cx={72}
                      cy={72}
                      r={RADIUS}
                      fill="none"
                      stroke="#6366F1"
                      strokeWidth={12}
                      strokeLinecap="round"
                      strokeDasharray={CIRCUMFERENCE}
                      strokeDashoffset={strokeDashoffset}
                      style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                  </svg>
                  {/* Centre text */}
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-extrabold text-gray-800">
                      {formatDuration(analytics.todaySeconds)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">screen time</span>
                  </div>
                </div>

                <p className="mt-3 text-xs text-gray-400">
                  {fillPct}% of 2h daily reference
                </p>
              </div>
            </section>

            {/* ── Stats cards ───────────────────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Overview</p>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Yesterday"
                  value={formatDuration(analytics.yesterdaySeconds)}
                  icon={Clock}
                  accent="bg-sky-500"
                />
                <StatCard
                  label="Last 7 Days"
                  value={formatDuration(analytics.last7DaysSeconds)}
                  icon={Calendar}
                  accent="bg-violet-500"
                />
                <StatCard
                  label="Last 30 Days"
                  value={formatDuration(analytics.last30DaysSeconds)}
                  icon={TrendingUp}
                  accent="bg-emerald-500"
                />
                <StatCard
                  label="Daily Average"
                  value={formatDuration(Math.round((analytics.last30DaysSeconds || 0) / 30))}
                  icon={Smartphone}
                  accent="bg-rose-500"
                />
              </div>
            </section>

            {/* ── Bar chart ─────────────────────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Last 30 Days
              </p>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                {hasChartData ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                      barSize={6}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => {
                          const d = new Date(v + 'T00:00:00');
                          return d.getDate();
                        }}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                        interval={4}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                        unit="m"
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#EEF2FF', radius: 4 }} />
                      <Bar
                        dataKey="minutes"
                        fill="#6366F1"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center gap-2">
                    <Smartphone className="w-8 h-8 text-gray-300" />
                    <p className="text-sm text-gray-400">No usage data yet for the last 30 days.</p>
                  </div>
                )}
              </div>
            </section>

            {/* ── Recent activity list ──────────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Recent Activity
              </p>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {analytics.recentDays.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-400">No recent sessions recorded.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {analytics.recentDays.map((day, idx) => (
                      <li key={day.date} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-indigo-400" />
                          </div>
                          <span className="text-sm text-gray-700">{fullDate(day.date)}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-800">
                          {formatDuration(day.durationSeconds)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Bottom padding for mobile */}
            <div className="h-6" />
          </>
        )}
      </div>
    </div>
  );
}
