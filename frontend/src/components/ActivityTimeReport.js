import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  Scale,
  BookOpen,
  Coffee,
  Utensils,
  Moon,
  Flame,
  Clock,
  TrendingUp,
  TrendingDown,
  Droplets,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import * as XLSX from "xlsx";
import HierarchicalReportLayout, {
  LoadingSkeleton,
} from "./common/HierarchicalReportLayout";
import HierarchicalNode from "./common/HierarchicalNode";
import { teamHierarchyService } from "../services/teamHierarchyService";
import TimeWindowSettingsModal from "./TimeWindowSettingsModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_KEYS = ["weight", "breakfast", "lunch", "dinner", "education", "water", "caloriesBurned"];

const ACTIVITY_META = {
  weight:         { label: "Weight",    short: "WGT", Icon: Scale,    color: "blue"   },
  breakfast:      { label: "Breakfast", short: "BRK", Icon: Coffee,   color: "orange" },
  lunch:          { label: "Lunch",     short: "LUN", Icon: Utensils, color: "green"  },
  dinner:         { label: "Dinner",    short: "DIN", Icon: Moon,     color: "purple" },
  education:      { label: "Education", short: "EDU", Icon: BookOpen, color: "indigo" },
  water:          { label: "Water",     short: "WAT", Icon: Droplets, color: "cyan"   },
  caloriesBurned: { label: "Calories",  short: "CAL", Icon: Flame,    color: "red"    },
};

const STATUS_DOT = {
  "on-time": "bg-green-500",
  late:      "bg-amber-400",
  missed:    "bg-red-400",
};

const STATUS_TEXT = {
  "on-time": { text: "text-green-700", bg: "bg-green-50",  border: "border-green-200" },
  late:      { text: "text-amber-700", bg: "bg-amber-50",  border: "border-amber-200" },
  missed:    { text: "text-red-600",   bg: "bg-red-50",    border: "border-red-200"   },
};

const FILTER_OPTIONS = [
  { value: "all",       label: "All Activities" },
  { value: "weight",    label: "Weight"         },
  { value: "breakfast", label: "Breakfast"      },
  { value: "lunch",     label: "Lunch"          },
  { value: "dinner",    label: "Dinner"         },
  { value: "education", label: "Education"      },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function mapRoleForApi(userRole) {
  const n = String(userRole || "member").toLowerCase();
  if (n === "admin" || n === "developer") return "admin";
  if (n === "coach") return "coach";
  return "member";
}

function mapUiRangeToApiRange(range) {
  if (range === "week")  return "last7days";
  if (range === "month") return "last30days";
  return range;
}

function formatDateForApi(d) {
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function formatDateForFile(d = new Date()) {
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function escapeCsv(value) {
  const normalized = value == null ? "" : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
}

function escapeHtml(value) {
  const normalized = value == null ? "" : String(value);
  return normalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function utf8ToBase64(input) {
  return btoa(unescape(encodeURIComponent(input)));
}

/** Convert "HH:mm" (24-hr) to "h:mm AM/PM" (12-hr) for display */
function fmt12(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Score: on-time=100, late=50, missed=0  →  averaged across all activity×day cells */
function computeUserScore(entry) {
  let total = 0, count = 0;
  (entry.days || []).forEach((day) => {
    ACTIVITY_KEYS.forEach((key) => {
      const s = day.activities?.[key]?.status;
      total += s === "on-time" ? 100 : s === "late" ? 50 : 0;
      count++;
    });
  });
  return count > 0 ? Math.round(total / count) : 0;
}

// ── Dummy preview data ───────────────────────────────────────────────────────
// Set USE_DUMMY_DATA = false (or delete this block) to restore real API data
const USE_DUMMY_DATA = true;

function getDummyEntries() {
  const today = new Date().toISOString().slice(0, 10);
  const d = (acts) => ({ date: today, activities: acts });
  const a = (time, status) => ({ time, status });
  return [
    // ── Level 0: You (root coach) ──────────────────────────────────────────
    {
      userId: 501, name: "Ravi Kumar (You)", email: "ravi@demo.com", role: "coach",
      coachId: null,
      averageTimes:    { weight: "07:10", breakfast: "08:05", lunch: "13:00", dinner: "19:30", education: "09:15" },
      consistentlyLate:{ weight: false,   breakfast: false,   lunch: false,   dinner: false,   education: false   },
      days: [d({ weight: a("07:10","on-time"), breakfast: a("08:05","on-time"), lunch: a("13:00","on-time"), dinner: a("19:30","on-time"), education: a("09:15","on-time") })],
    },

    // ── Level 1: Your direct reports (sub-coaches + members) ───────────────
    {
      userId: 502, name: "Priya Menon (Sub-Coach)", email: "priya@demo.com", role: "coach",
      coachId: 501,
      averageTimes:    { weight: "07:45", breakfast: "09:30", lunch: "13:50", dinner: "20:30", education: null     },
      consistentlyLate:{ weight: false,   breakfast: true,    lunch: false,   dinner: true,    education: false   },
      days: [d({ weight: a("07:45","on-time"), breakfast: a("09:30","late"),    lunch: a("13:50","late"),    dinner: a("20:30","late"),    education: a(null,"missed")   })],
    },
    {
      userId: 503, name: "Arjun Singh (Sub-Coach)", email: "arjun@demo.com", role: "coach",
      coachId: 501,
      averageTimes:    { weight: null,    breakfast: "08:20", lunch: null,    dinner: "19:10", education: "10:00" },
      consistentlyLate:{ weight: false,   breakfast: false,   lunch: false,   dinner: false,   education: false   },
      days: [d({ weight: a(null,"missed"),   breakfast: a("08:20","on-time"), lunch: a(null,"missed"),   dinner: a("19:10","on-time"), education: a("10:00","on-time") })],
    },
    {
      userId: 504, name: "Meena Iyer", email: "meena@demo.com", role: "member",
      coachId: 501,
      averageTimes:    { weight: "06:55", breakfast: null,    lunch: "14:20", dinner: null,    education: null    },
      consistentlyLate:{ weight: false,   breakfast: false,   lunch: true,    dinner: false,   education: false   },
      days: [d({ weight: a("06:55","on-time"), breakfast: a(null,"missed"),   lunch: a("14:20","late"),    dinner: a(null,"missed"),   education: a(null,"missed")   })],
    },

    // ── Level 2: Priya's team (visible only in Full view) ──────────────────
    {
      userId: 511, name: "Sunita Rao", email: "sunita@demo.com", role: "member",
      coachId: 502,
      averageTimes:    { weight: "07:00", breakfast: "08:10", lunch: "13:10", dinner: "19:45", education: "09:30" },
      consistentlyLate:{ weight: false,   breakfast: false,   lunch: false,   dinner: false,   education: false   },
      days: [d({ weight: a("07:00","on-time"), breakfast: a("08:10","on-time"), lunch: a("13:10","on-time"), dinner: a("19:45","on-time"), education: a("09:30","on-time") })],
    },
    {
      userId: 512, name: "Deepak Verma", email: "deepak@demo.com", role: "member",
      coachId: 502,
      averageTimes:    { weight: null,    breakfast: "10:00", lunch: "15:00", dinner: null,    education: null    },
      consistentlyLate:{ weight: false,   breakfast: true,    lunch: true,    dinner: false,   education: false   },
      days: [d({ weight: a(null,"missed"),   breakfast: a("10:00","late"),    lunch: a("15:00","late"),    dinner: a(null,"missed"),   education: a(null,"missed")   })],
    },
    {
      userId: 513, name: "Anjali Das", email: "anjali@demo.com", role: "member",
      coachId: 502,
      averageTimes:    { weight: "07:30", breakfast: null,    lunch: "13:20", dinner: "20:00", education: "10:15" },
      consistentlyLate:{ weight: false,   breakfast: false,   lunch: false,   dinner: false,   education: false   },
      days: [d({ weight: a("07:30","on-time"), breakfast: a(null,"missed"),   lunch: a("13:20","on-time"), dinner: a("20:00","late"),    education: a("10:15","on-time") })],
    },

    // ── Level 2: Arjun's team (visible only in Full view) ──────────────────
    {
      userId: 521, name: "Lakshmi Nair", email: "lakshmi@demo.com", role: "member",
      coachId: 503,
      averageTimes:    { weight: "08:00", breakfast: "08:30", lunch: null,    dinner: "19:20", education: null    },
      consistentlyLate:{ weight: false,   breakfast: false,   lunch: false,   dinner: false,   education: false   },
      days: [d({ weight: a("08:00","late"),    breakfast: a("08:30","on-time"), lunch: a(null,"missed"),   dinner: a("19:20","on-time"), education: a(null,"missed")   })],
    },
    {
      userId: 522, name: "Ramesh Pillai", email: "ramesh@demo.com", role: "member",
      coachId: 503,
      averageTimes:    { weight: null,    breakfast: null,    lunch: null,    dinner: null,    education: null    },
      consistentlyLate:{ weight: false,   breakfast: false,   lunch: false,   dinner: false,   education: false   },
      days: [d({ weight: a(null,"missed"),   breakfast: a(null,"missed"),   lunch: a(null,"missed"),   dinner: a(null,"missed"),   education: a(null,"missed")   })],
    },
  ];
}

/**
 * Sort key for a node based on selected activity filter.
 * desc = correct takers first (higher on-time count).
 * asc  = complete untakers (missed) first, then late, then on-time.
 * Weighted: on-time = 2pts, late = 1pt, missed = 0pts — summed across all days.
 */
function computeActivitySortKey(node, activity) {
  if (!activity || activity === "all") return node.__score ?? 0;
  let score = 0;
  (node.__timeData?.days || []).forEach((day) => {
    const s = day.activities?.[activity]?.status;
    if (s === "on-time") score += 2;
    else if (s === "late") score += 1;
    // missed = 0
  });
  return score;
}

/** Build HierarchicalNode-compatible tree from flat API list enriched with scores */
function buildHierarchyFromFlat(flatList, scoreMap, currentUserId) {
  const byId = new Map();
  flatList.forEach((u) => {
    byId.set(u.userId, {
      userId:           u.userId,
      userName:         u.name,
      email:            u.email,
      role:             u.role,
      uplineCoachName:  null,
      uplineCoCoachName:null,
      profileImage:     null,
      teamMembers:      [],
      __timeData:       u,          // raw API entry (days, averageTimes, consistentlyLate)
      __score:          scoreMap.get(u.userId) ?? 0,
    });
  });

  // Try to attach children to parents using coachId/coCoachId when present in flatList
  // If no hierarchy info return all as top-level siblings under a virtual root
  const roots = [];
  byId.forEach((node) => {
    const raw = node.__timeData;
    const parentId = raw.coachId ?? raw.uplineCoachId ?? null;
    if (parentId && byId.has(parentId)) {
      const parent = byId.get(parentId);
      if (!parent.teamMembers.includes(node)) parent.teamMembers.push(node);
      // propagate coach name
      node.uplineCoachName = parent.userName;
    } else {
      roots.push(node);
    }
  });

  if (roots.length === 1) return roots[0];

  // Multiple roots: find the one matching currentUserId as the tree root
  const self = byId.get(currentUserId);
  return self || roots[0] || null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Coloured dot for a single activity status */
function StatusDot({ status }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status] ?? "bg-gray-300"}`}
      title={status}
    />
  );
}

/** Compact 5-cell activity heatmap for one day row */
function DayHeatmapRow({ day }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-gray-400 w-16 shrink-0">{day.date?.slice(5)}</span>
      {ACTIVITY_KEYS.map((key) => {
        const s = day.activities?.[key]?.status ?? "missed";
        const t = day.activities?.[key]?.time;
        const st = STATUS_TEXT[s];
        return (
          <div
            key={key}
            title={`${ACTIVITY_META[key].label}: ${fmt12(t) ?? "—"} (${s})`}
            className={`flex flex-col items-center justify-center rounded-md border px-1 py-0.5 min-w-[36px] ${st.bg} ${st.border}`}
          >
            <StatusDot status={s} />
            <span className={`text-[9px] font-bold mt-0.5 ${st.text}`}>
              {fmt12(t) ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Average time chips row for one user */
function AvgTimeRow({ averageTimes, consistentlyLate }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-gray-50 border-t border-gray-100">
      {ACTIVITY_KEYS.map((key) => {
        const { Icon, label, short } = ACTIVITY_META[key];
        const avg = averageTimes?.[key];
        const late = consistentlyLate?.[key];
        return (
          <div
            key={key}
            className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 px-2 py-1 shadow-sm"
            title={`Avg ${label}: ${avg ?? "no data"}`}
          >
            <Icon className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="text-[9px] font-semibold text-gray-500 uppercase">{short}</span>
            <span className="text-[10px] font-bold text-gray-800">{fmt12(avg) ?? "—"}</span>
            {late && (
              <Flame className="w-3 h-3 text-orange-500 shrink-0" title="Consistently late" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Score ring SVG  (45 px) */
function ScoreRing({ score }) {
  const R = 18, C = 2 * Math.PI * R;
  const pct = Math.min(100, Math.max(0, score));
  const offset = C - (pct / 100) * C;
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
  return (
    <svg width="45" height="45" viewBox="0 0 45 45" className="-rotate-90 shrink-0">
      <circle cx="22.5" cy="22.5" r={R} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="22.5" cy="22.5" r={R} fill="none"
        stroke={color} strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={offset}
        className="transition-all duration-700"
      />
      <text
        x="22.5" y="22.5"
        textAnchor="middle" dominantBaseline="middle"
        className="rotate-90"
        style={{ transform: "rotate(90deg)", transformOrigin: "22.5px 22.5px", fontSize: "8px", fontWeight: 700, fill: color }}
      >
        {pct}%
      </text>
    </svg>
  );
}

/** Expanded details panel shown inside HierarchicalNode */
function TimeReportDetails({ node, dateRange, filter }) {
  const entry = node.__timeData;
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!filter || filter === "all" || !scrollRef.current) return;
    const th = scrollRef.current.querySelector(`[data-key="${filter}"]`);
    if (!th) return;
    const container = scrollRef.current;
    const targetLeft = th.offsetLeft - container.offsetWidth / 2 + th.offsetWidth / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [filter]);

  if (!entry) return null;

  const visibleKeys = filter && filter !== "all" ? [filter] : ACTIVITY_KEYS;

  return (
    <div className="border-t border-gray-100 bg-gray-50/40">
      {/* Day-wise Table */}
      <div ref={scrollRef} className="px-2 pb-2 pt-1.5">
        <table className="w-full text-[10px] border-collapse" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr className="bg-green-50">
              <th className="text-left px-1 py-1 font-semibold text-gray-600 rounded-tl-lg w-[44px]">Date</th>
              {visibleKeys.map((key) => {
                const { Icon, short } = ACTIVITY_META[key];
                return (
                  <th key={key} data-key={key} title={ACTIVITY_META[key].label} className="px-1 py-1 font-semibold transition-colors text-center text-gray-600">
                    <div className="flex items-center justify-center gap-0.5">
                      <Icon className="w-2.5 h-2.5 shrink-0" />
                      <span className="text-[9px]">{short}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {(entry.days || []).map((day, i) => (
              <tr key={day.date} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                <td className="px-1 py-1 font-medium text-gray-600 text-[9px] w-[44px]">{day.date?.slice(5)}</td>
                {visibleKeys.map((key) => {
                  const act = day.activities?.[key];
                  const s   = act?.status ?? "missed";
                  const st  = STATUS_TEXT[s];
                  return (
                    <td key={key} className="px-0.5 py-1 text-center">
                      <div className={`inline-flex items-center justify-center gap-0.5 px-1 py-0.5 rounded border w-full ${st.bg} ${st.border}`}>
                        <StatusDot status={s} />
                        <span className={`text-[9px] font-semibold ${st.text} whitespace-nowrap`}>
                          {fmt12(act?.time) ?? "—"}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function ActivityTimeReport({ user, userRole, apiBaseUrl, onBack }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState("today");
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("desc");
  const [hierarchyData, setHierarchyData] = useState(null);
  const [flatData, setFlatData] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [teamView, setTeamView] = useState("direct");
  const [filterBehavior, setFilterBehavior] = useState("all");
  const [activityRowSortBy, setActivityRowSortBy] = useState("date"); // "date", "activity", "status"
  const [activityRowSortOrder, setActivityRowSortOrder] = useState("asc"); // "asc", "desc"

  const timezoneOffset = useMemo(() => new Date().getTimezoneOffset(), []);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!user?.id || !apiBaseUrl) return;
      if (dateRange === "custom" && (!customStartDate || !customEndDate)) return;

      if (isBackground) setRefreshing(true);
      else { setLoading(true); setHierarchyData(null); setFlatData([]); }
      setError("");

      try {
        // ── DUMMY OVERRIDE — remove when done previewing ───────────────────
        let flat;
        let hierarchyRes = null;
        if (USE_DUMMY_DATA) {
          flat = getDummyEntries();
        } else {
          const params = new URLSearchParams({
            userId: String(user.id),
            role: mapRoleForApi(userRole),
            dateRange: mapUiRangeToApiRange(dateRange),
            userTimezoneOffset: String(timezoneOffset),
          });
          if (dateRange === "custom") {
            params.set("startDate", formatDateForApi(customStartDate));
            params.set("endDate", formatDateForApi(customEndDate));
          }

          const [hRes, reportRes] = await Promise.all([
            teamHierarchyService.getTeamHierarchy(user.id, false).catch(() => null),
            fetch(`${apiBaseUrl}/api/get-activity-time-report?${params}`, { cache: "no-store" }),
          ]);
          hierarchyRes = hRes;

          const reportJson = await reportRes.json();
          if (!reportRes.ok || !reportJson?.success) {
            throw new Error(reportJson?.message || "Failed to fetch time report");
          }
          flat = Array.isArray(reportJson.data) ? reportJson.data : [];
        }
        // ── end dummy override ───────────────────────────────────────────────

        setFlatData(flat);

        // Build score + data maps
        const scoreMap = new Map();
        const dataMap  = new Map();
        flat.forEach((entry) => {
          const score = computeUserScore(entry);
          scoreMap.set(entry.userId, score);
          dataMap.set(entry.userId, { ...entry, __score: score });
        });

        // Recursive team avg helpers
        const getAllDescendantScores = (node) => {
          let scores = [];
          (node.teamMembers || []).forEach((m) => {
            scores.push(scoreMap.get(m.userId) ?? 0);
            scores = scores.concat(getAllDescendantScores(m));
          });
          return scores;
        };

        const enrichNode = (node) => {
          const uid = node.userId || node.id;
          const enriched = {
            ...node,
            userId:             uid,
            userName:           node.userName || node.name,
            uplineCoachName:    node.coachName   ?? node.uplineCoachName   ?? null,
            uplineCoCoachName:  node.coCoachName ?? node.uplineCoCoachName ?? null,
            __timeData:         dataMap.get(uid) || null,
            __score:            scoreMap.get(uid) ?? 0,
          };
          enriched.teamMembers = (node.teamMembers || []).map(enrichNode);
          const directScores = enriched.teamMembers.map((m) => m.__score);
          enriched.__directAvg = directScores.length
            ? Math.round(directScores.reduce((a, b) => a + b, 0) / directScores.length)
            : null;
          const fullScores = getAllDescendantScores(enriched);
          enriched.__fullAvg = fullScores.length
            ? Math.round(fullScores.reduce((a, b) => a + b, 0) / fullScores.length)
            : null;
          return enriched;
        };

        if (hierarchyRes?.hierarchy) {
          setHierarchyData(enrichNode(hierarchyRes.hierarchy));
        } else if (flat.length > 0) {
          // No hierarchy service — build synthetic tree from flat list
          const syn = buildHierarchyFromFlat(flat, scoreMap, user.id);
          if (syn) setHierarchyData(enrichNode(syn));
        }
      } catch (err) {
        setError(err.message || "Unable to load report");
      } finally {
        if (isBackground) setRefreshing(false);
        else setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, apiBaseUrl, userRole, dateRange, customStartDate, customEndDate, timezoneOffset],
  );

  useEffect(() => { fetchData(false); }, [fetchData]);

  // ── Activity sort (reacts to filter category + sort direction) ───────────

  const sortedHierarchyData = useMemo(() => {
    if (!hierarchyData) return null;
    const sortNode = (node) => ({
      ...node,
      teamMembers: [...(node.teamMembers || [])]
        .sort((a, b) => {
          const ka = computeActivitySortKey(a, filter);
          const kb = computeActivitySortKey(b, filter);
          return sortOrder === "desc" ? kb - ka : ka - kb;
        })
        .map(sortNode),
    });
    return sortNode(hierarchyData);
  }, [hierarchyData, filter, sortOrder]);

  // ── Filter / search / style helpers ───────────────────────────────────────

  // Filter now controls sort category; filterBehavior controls member visibility
  const matchesFilter = useCallback((node) => {
    if (filterBehavior === "all") return true;
    const activity = filter === "all" ? null : filter;
    if (!activity) {
      // "all activities" + behavior: use overall score
      const s = node.__score ?? 0;
      if (filterBehavior === "correct") return s >= 50;
      if (filterBehavior === "late")    return s > 0 && s < 50;
      if (filterBehavior === "missed")  return s === 0;
    }
    // specific activity: check that day's status
    const statuses = (node.__timeData?.days || []).map(
      (day) => day.activities?.[activity]?.status ?? "missed"
    );
    if (filterBehavior === "correct") return statuses.some((s) => s === "on-time");
    if (filterBehavior === "late")    return statuses.some((s) => s === "late") && !statuses.some((s) => s === "on-time");
    if (filterBehavior === "missed")  return statuses.every((s) => s === "missed");
    return true;
  }, [filter, filterBehavior]);

  const matchesSearch = useCallback((node, query) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      String(node.userName || "").toLowerCase().includes(q) ||
      String(node.email    || "").toLowerCase().includes(q)
    );
  }, []);

  const getStatusStyle = useCallback((node) => {
    const s = node.__score ?? 0;
    if (s >= 80) return {
      containerClass:   "bg-white border-green-200",
      avatarClass:      "bg-green-100 border-green-400 text-green-700",
      nameClass:        "text-green-800",
      statsBorderClass: "border-green-100 divide-green-100",
    };
    if (s >= 50) return {
      containerClass:   "bg-white border-amber-200",
      avatarClass:      "bg-amber-100 border-amber-400 text-amber-700",
      nameClass:        "text-amber-800",
      statsBorderClass: "border-amber-100 divide-amber-100",
    };
    return {
      containerClass:   "bg-white border-red-200",
      avatarClass:      "bg-red-100 border-red-400 text-red-700",
      nameClass:        "text-red-800",
      statsBorderClass: "border-red-100 divide-red-100",
    };
  }, []);

  // ── HierarchicalNode render props ──────────────────────────────────────────

  const renderStatus = useCallback(() => null, []);

  const renderStats = useCallback(() => null, []);

  const renderExpandedDetails = useCallback((node) => <TimeReportDetails node={node} dateRange={dateRange} filter={filter} />, [dateRange, filter]);

  // ── Summary stats ──────────────────────────────────────────────────────────

  const summaryStats = useMemo(() => {
    if (flatData.length === 0) return null;
    const scores   = flatData.map(computeUserScore);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const topIdx   = scores.indexOf(Math.max(...scores));
    const atRisk   = scores.filter((s) => s < 50).length;
    return {
      title: "",
      items: [
        { label: "Avg Score", value: avgScore,            unit: "%", color: "text-green-700", bgColor: "bg-green-50" },
        { label: "Top Star",  value: scores[topIdx] ?? 0, unit: "%", sub: String(flatData[topIdx]?.name || "—").split(" ")[0], color: "text-blue-700", bgColor: "bg-blue-50" },
        { label: "At Risk",   value: atRisk,              unit: "",  sub: `of ${flatData.length}`, color: "text-red-700", bgColor: "bg-red-50" },
      ],
      note: "Score: On-time = 100 pts · Late = 50 pts · Missed = 0 pts — averaged across all activities × days.",
    };
  }, [flatData]);

  // ── Team-view toggle ───────────────────────────────────────────────────────

  const teamViewToggle = (
    <div className="flex justify-end mb-3 sm:mb-4">
      <div className="inline-flex bg-green-50 border border-green-200 rounded-full p-0.5">
        <button
          onClick={() => setTeamView("direct")}
          className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-semibold transition-all ${
            teamView === "direct"
              ? "bg-green-600 text-white shadow-sm"
              : "text-green-700 hover:text-green-800"
          }`}
        >
          Direct
        </button>
        <button
          onClick={() => setTeamView("full")}
          className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-semibold transition-all ${
            teamView === "full"
              ? "bg-green-600 text-white shadow-sm"
              : "text-green-700 hover:text-green-800"
          }`}
        >
          Full
        </button>
      </div>
    </div>
  );

  // ── Direct / Full hierarchy filter ────────────────────────────────────────
  const buildHierarchyForView = useCallback((view) => {
    if (!sortedHierarchyData) return null;
    if (view === "full") return sortedHierarchyData;
    // Direct view: strip nested teamMembers from direct reports
    if (sortedHierarchyData.teamMembers) {
      return {
        ...sortedHierarchyData,
        teamMembers: sortedHierarchyData.teamMembers.map((member) => ({
          ...member,
          teamMembers: [],
        })),
      };
    }
    return sortedHierarchyData;
  }, [sortedHierarchyData]);

  const filteredHierarchy = useMemo(() => {
    return buildHierarchyForView(teamView);
  }, [buildHierarchyForView, teamView]);

  // ── Count members in filtered hierarchy ────────────────────────────────────

  const visibleMemberCount = useMemo(() => {
    if (!filteredHierarchy) return 0;

    const countMembers = (node) => {
      let count = 1; // Count the node itself if it passes filters
      (node.teamMembers || []).forEach((member) => {
        count += countMembers(member);
      });
      return count;
    };

    return countMembers(filteredHierarchy);
  }, [filteredHierarchy]);

  const subtitle = `${visibleMemberCount} member${visibleMemberCount === 1 ? "" : "s"} • ${
    new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  }`;

  const saveOrShareFile = useCallback(async ({ content, fileName, mimeType, title }) => {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // Write as UTF-8 text directly — no base64 needed for CSV files
      const result = await Filesystem.writeFile({
        path: fileName,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      const canShare = await Share.canShare().catch(() => ({ value: false }));
      if (canShare.value) {
        await Share.share({
          title: title || "Activity Time Report",
          text: "Save or share your report file",
          files: [result.uri],
          dialogTitle: "Save or Share Report",
        });
      } else {
        alert(`File saved to: ${result.uri}`);
      }
      return;
    }

    // Web Share API — works on Android Chrome PWA and iOS Safari PWA
    const blob = new Blob([content], { type: mimeType });
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: mimeType })] })) {
      try {
        await navigator.share({
          title: title || "Activity Time Report",
          files: [new File([blob], fileName, { type: mimeType })],
        });
        return;
      } catch (err) {
        if (err.name === "AbortError") return; // user cancelled — do nothing
        // fall through to anchor download
      }
    }

    // Desktop / fallback: anchor click download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, []);

  // ── Helper: Sort daily activity rows by date, activity, or status ────────────

  const getSortedDailyActivities = useCallback((entry) => {
    if (!entry || !entry.days) return [];

    // Expand days into individual activity rows
    const activityRows = [];
    (entry.days || []).forEach((day) => {
      ACTIVITY_KEYS.forEach((actKey) => {
        const activity = day.activities?.[actKey];
        activityRows.push({
          date: day.date,
          activity: actKey,
          time: activity?.time || null,
          status: activity?.status || "missed",
          label: ACTIVITY_META[actKey].label,
        });
      });
    });

    // Sort based on current sort settings
    const sorted = [...activityRows].sort((a, b) => {
      let cmp = 0;

      if (activityRowSortBy === "date") {
        cmp = a.date.localeCompare(b.date);
      } else if (activityRowSortBy === "activity") {
        cmp = a.activity.localeCompare(b.activity);
      } else if (activityRowSortBy === "status") {
        const statusOrder = { "on-time": 0, late: 1, missed: 2 };
        cmp = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      }

      return activityRowSortOrder === "desc" ? -cmp : cmp;
    });

    return sorted;
  }, [activityRowSortBy, activityRowSortOrder]);

  // ── Excel export with sorted daily activity data ───────────────────────────

  const handleExcelDownload = useCallback(async () => {
    if (!flatData || flatData.length === 0) return;

    try {
      const workbook = XLSX.utils.book_new();

      // Create one sheet per user with their daily activity data
      flatData.forEach((entry) => {
        const userName = entry.name || "User";
        const sheetName = String(userName).slice(0, 31); // Excel max sheet name = 31 chars

        // Get sorted daily activities
        const sortedActivities = getSortedDailyActivities(entry);

        if (sortedActivities.length === 0) return;

        // Build sheet data
        const sheetData = [
          ["Activity Time Report - " + userName],
          ["Email:", entry.email],
          ["Role:", entry.role],
          [],
          ["Date", "Activity", "Time", "Status"],
          ...sortedActivities.map((row) => [
            row.date,
            row.label,
            row.time ? fmt12(row.time) : "—",
            row.status === "on-time" ? "On-time" : row.status === "late" ? "Late" : "Missed",
          ]),
        ];

        const sheet = XLSX.utils.aoa_to_sheet(sheetData);

        // Style the sheet
        sheet["!cols"] = [
          { wch: 12 }, // Date
          { wch: 15 }, // Activity
          { wch: 12 }, // Time
          { wch: 12 }, // Status
        ];

        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      });

      // Create summary sheet
      const summaryData = [
        ["Activity Time Report Summary"],
        ["Date Range:", dateRange.toUpperCase()],
        ["Total Members:", flatData.length],
        ["Generated:", new Date().toLocaleString()],
        [],
        ["Member", "Email", "Role", "Avg Weight Time", "Avg Breakfast Time", "Avg Lunch Time", "Avg Dinner Time", "Avg Education Time"],
        ...flatData.map((entry) => [
          entry.name,
          entry.email,
          entry.role,
          fmt12(entry.averageTimes?.weight) || "—",
          fmt12(entry.averageTimes?.breakfast) || "—",
          fmt12(entry.averageTimes?.lunch) || "—",
          fmt12(entry.averageTimes?.dinner) || "—",
          fmt12(entry.averageTimes?.education) || "—",
        ]),
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [
        { wch: 20 },
        { wch: 20 },
        { wch: 10 },
        { wch: 16 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
      ];

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary", 0);

      // Download
      const fileDate = formatDateForFile(new Date());
      const fileName = `activity-time-report-${dateRange}-${fileDate}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      setShowDownloadOptions(false);
    } catch (err) {
      console.error("Excel download failed:", err);
      alert("Unable to download Excel right now. Please try again.");
    }
  }, [flatData, dateRange, getSortedDailyActivities]);

  const getMergedExportRows = useCallback(() => {
    const viewsToExport = ["direct", "full"];

    const passes = (node) => matchesFilter(node) && matchesSearch(node, searchQuery);

    const collectRows = (node) => {
      const descendants = (node.teamMembers || []).flatMap(collectRows);
      if (!passes(node) && descendants.length === 0) return [];

      const entry = node.__timeData || {};
      const row = {
        memberName: node.userName || node.name || "-",
        email: node.email || "-",
        role: node.role || "-",
        averageWeightTime: fmt12(entry.averageTimes?.weight) || "-",
        averageBreakfastTime: fmt12(entry.averageTimes?.breakfast) || "-",
        averageLunchTime: fmt12(entry.averageTimes?.lunch) || "-",
        averageDinnerTime: fmt12(entry.averageTimes?.dinner) || "-",
        averageEducationTime: fmt12(entry.averageTimes?.education) || "-",
      };

      return [row, ...descendants];
    };

    const mergedRows = [];
    viewsToExport.forEach((view) => {
      const sourceRoot = buildHierarchyForView(view);
      if (!sourceRoot) return;

      const rows = collectRows(sourceRoot);
      if (rows.length === 0) return;
      rows.forEach((row) => {
        mergedRows.push({
          reportView: view === "direct" ? "Direct" : "Full",
          ...row,
        });
      });
    });

    return mergedRows;
  }, [buildHierarchyForView, matchesFilter, matchesSearch, searchQuery]);

  const handleCsvDownload = useCallback(async () => {
    if (!filteredHierarchy || !filteredHierarchy.__timeData) return;

    try {
      // Determine which activity to filter by
      const selectedActivity = filter === "all" ? null : filter;

      // Recursive function to collect members from the current view
      const collectMembers = (node) => {
        const members = [];

        // Check if current node passes filter
        if (matchesFilter(node) && matchesSearch(node, searchQuery)) {
          members.push(node);
        }

        // Add team members
        (node.teamMembers || []).forEach((member) => {
          members.push(...collectMembers(member));
        });

        return members;
      };

      let members = collectMembers(filteredHierarchy);

      if (members.length === 0) {
        alert("No members found matching your filters.");
        return;
      }

      // Sort members by name if name sort is selected
      if (activityRowSortBy === "name") {
        members = [...members].sort((a, b) => {
          const nameA = (a.userName || a.name || "").toLowerCase();
          const nameB = (b.userName || b.name || "").toLowerCase();
          const cmp = nameA.localeCompare(nameB);
          return activityRowSortOrder === "desc" ? -cmp : cmp;
        });
      }

      const headers = ["Member Name", "Email", "Role", "Date", "Activity", "Time", "Status"];
      const csvRows = [headers.map(escapeCsv).join(",")];

      // Build CSV from sorted daily activities, filtered by selected activity
      members.forEach((node) => {
        const entry = node.__timeData;
        if (!entry) return;

        const sortedActivities = getSortedDailyActivities(entry);

        // Filter activities if specific activity is selected
        const filteredActivities = selectedActivity
          ? sortedActivities.filter((row) => row.activity === selectedActivity)
          : sortedActivities;

        if (filteredActivities.length === 0) return;

        filteredActivities.forEach((row) => {
          const cells = [
            node.userName || node.name || "-",
            node.email || "-",
            node.role || "-",
            row.date ? `="${row.date}"` : "-",   // force Excel to treat as text
            row.label,
            row.time ? fmt12(row.time) : "-",
            row.status === "on-time" ? "On-time" : row.status === "late" ? "Late" : "Missed",
          ];
          // Don't run escapeCsv on the date cell (index 3) — it's already formatted
          const csvLine = cells
            .map((cell, i) => (i === 3 ? cell : escapeCsv(cell)))
            .join(",");
          csvRows.push(csvLine);
        });
      });

      const csv = "\uFEFF" + csvRows.join("\n");
      const fileDate = formatDateForFile(new Date());
      const viewLabel = teamView === "direct" ? "direct" : "full";
      const activityLabel = selectedActivity || "all-activities";
      const sortLabel = `${activityRowSortBy}-${activityRowSortOrder}`;

      try {
        await saveOrShareFile({
          content: csv,
          fileName: `activity-report-${viewLabel}-${activityLabel}-${dateRange}-${sortLabel}-${fileDate}.csv`,
          mimeType: "text/csv;charset=utf-8;",
          title: "Activity Time Report (CSV)",
        });
        setShowDownloadOptions(false);
      } catch (err) {
        console.error("CSV download/share failed:", err);
        alert("Unable to download CSV right now. Please try again.");
      }
    } catch (err) {
      console.error("CSV export failed:", err);
      alert("Unable to generate CSV right now. Please try again.");
    }
  }, [filteredHierarchy, teamView, filter, dateRange, getSortedDailyActivities, activityRowSortBy, activityRowSortOrder, saveOrShareFile, matchesFilter, matchesSearch, searchQuery]);

  const handlePdfDownload = useCallback(async () => {
    const mergedRows = getMergedExportRows();
    if (mergedRows.length === 0) return;

    const now = new Date();
    const generatedAt = now.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const tableRows = mergedRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.reportView)}</td>
            <td>${escapeHtml(row.memberName)}</td>
            <td>${escapeHtml(row.email)}</td>
            <td>${escapeHtml(row.role)}</td>
            <td>${escapeHtml(row.averageWeightTime)}</td>
            <td>${escapeHtml(row.averageBreakfastTime)}</td>
            <td>${escapeHtml(row.averageLunchTime)}</td>
            <td>${escapeHtml(row.averageDinnerTime)}</td>
            <td>${escapeHtml(row.averageEducationTime)}</td>
          </tr>
        `,
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>Activity Time Report PDF</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            p.meta { margin: 0 0 18px; color: #4b5563; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
            th { background: #f3f4f6; font-weight: 700; }
            tr:nth-child(even) { background: #f9fafb; }
            .note { margin-top: 12px; font-size: 11px; color: #6b7280; }
          </style>
        </head>
        <body>
          <h1>Activity Time Report</h1>
          <p class="meta">Date Range: ${escapeHtml(dateRange)} | Generated: ${escapeHtml(generatedAt)}</p>
          <table>
            <thead>
              <tr>
                <th>Report Type</th>
                <th>Member Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Weight Time</th>
                <th>Breakfast Time</th>
                <th>Lunch Time</th>
                <th>Dinner Time</th>
                <th>Education Time</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <p class="note">Tip: In the print dialog, choose "Save as PDF".</p>
        </body>
      </html>
    `;

    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        throw new Error("Print window blocked");
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
      setShowDownloadOptions(false);
    } catch (err) {
      const fileDate = formatDateForFile(new Date());
      await saveOrShareFile({
        content: html,
        fileName: `activity-time-report-${dateRange}-${fileDate}.html`,
        mimeType: "text/html;charset=utf-8;",
        title: "Activity Time Report (PDF View)",
      });
      alert("Report shared as HTML. Open it and choose Print > Save as PDF.");
      setShowDownloadOptions(false);
    }
  }, [getMergedExportRows, dateRange, saveOrShareFile]);

  const handleDownload = () => {
    setShowDownloadOptions(true);
  };

  const handleSettings = () => {
    setShowSettings((prev) => !prev);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <HierarchicalReportLayout
      title="Activity Time Report"
      subtitle={subtitle}
      onBack={onBack}
      onRefresh={() => fetchData(true)}
      onDownload={handleDownload}
      onSettings={handleSettings}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={() => fetchData(false)}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      customStartDate={customStartDate}
      customEndDate={customEndDate}
      onCustomDateSelect={(start, end) => {
        setCustomStartDate(start);
        setCustomEndDate(end);
        setDateRange("custom");
      }}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      filter={filter}
      filterOptions={FILTER_OPTIONS}
      onFilterChange={(val) => {
          setFilter(val);
          setFilterBehavior("all");
        }}
      sortOrder={sortOrder}
      onSortChange={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
      summaryStats={null}
      allowedDateRanges={["today", "yesterday"]}
      singleDayCustom={true}
    >
      {filteredHierarchy ? (
        <>
          {teamViewToggle}

          {/* Daily Activity Sorting Controls
          <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex flex-col gap-2">
              <div className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">Sort Daily Activities By:</div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "name", label: "👤 Name" },
                  { value: "date", label: "📅 Date" },
                  { value: "activity", label: "🍽️ Activity" },
                  { value: "status", label: "✓ Status" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      if (activityRowSortBy === option.value) {
                        setActivityRowSortOrder(activityRowSortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setActivityRowSortBy(option.value);
                        setActivityRowSortOrder("asc");
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      activityRowSortBy === option.value
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"
                    }`}
                    title={`Sort by ${option.label}${activityRowSortBy === option.value ? ` (${activityRowSortOrder === "asc" ? "ascending" : "descending"})` : ""}`}
                  >
                    {option.label} {activityRowSortBy === option.value && (activityRowSortOrder === "asc" ? "↑" : "↓")}
                  </button>
                ))}
              </div>
              <div className="text-[9px] text-blue-600">💡 Change sort order by clicking the same button again. CSV download will include sorted data.</div>
            </div>
          </div> */}

          {/* Behavior filter pills */}
          <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-full w-fit">
            {[
              { value: "all",     label: "All" },
              { value: "correct", label: "Correct" },
              { value: "late",    label: "Late" },
              { value: "missed",  label: "Not Taken" },
            ].map((b) => (
              <button
                key={b.value}
                onClick={() => setFilterBehavior(b.value)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                  filterBehavior === b.value
                    ? "bg-white text-green-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <HierarchicalNode
            key={`hierarchy-${teamView}`}
            node={filteredHierarchy}
            level={0}
            isLastChild={true}
            renderStatus={renderStatus}
            renderStats={renderStats}
            renderExpandedDetails={renderExpandedDetails}
            isCurrentUser={filteredHierarchy.userId === user?.id}
            showTeamCount={true}
            getStatusStyle={getStatusStyle}
            searchQuery={searchQuery}
            filter={filter}
            matchesFilter={matchesFilter}
            matchesSearch={matchesSearch}
            defaultShowDetails={true}
          />
        </>
      ) : !loading && !error ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No data found</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            No time report data available for the selected period.
          </p>
        </div>
      ) : null}

      {/* Time Window Settings Modal */}
      <TimeWindowSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onUpdate={() => fetchData(true)}
        userEmail={user?.email}
      />

      {/* Download Options Modal */}
      {showDownloadOptions && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-gray-200 shadow-xl p-4">
            <h3 className="text-base font-bold text-gray-900">Download Report</h3>
            <p className="text-xs text-gray-600 mt-1">
              Downloading {teamView === "direct" ? "Direct" : "Full"} team members {filter !== "all" ? `with ${filter} activities` : "with all activities"} sorted by {activityRowSortBy}.
            </p>
            <div className="mt-4 space-y-2">
              <button
                onClick={handleCsvDownload}
                className="w-full rounded-xl bg-green-600 text-white py-2.5 text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                📥 Download as CSV
              </button>
              <button
                onClick={() => setShowDownloadOptions(false)}
                className="w-full rounded-xl border border-gray-300 bg-white text-gray-700 py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </HierarchicalReportLayout>
  );
}

export default ActivityTimeReport;
