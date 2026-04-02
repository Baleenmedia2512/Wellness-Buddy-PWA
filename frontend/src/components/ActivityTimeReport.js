import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  { value: "all",      label: "All Members"      },
  { value: "strong",   label: "Strong (≥80%)"    },
  { value: "moderate", label: "Moderate (50–79%)" },
  { value: "risk",     label: "At Risk (<50%)"    },
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
function TimeReportDetails({ node, dateRange }) {
  const [tab, setTab] = useState("heatmap");

  const entry = node.__timeData;
  if (!entry) return null;

  const hasAny = (entry.days || []).some((d) =>
    ACTIVITY_KEYS.some((k) => d.activities?.[k]?.status !== "missed"),
  );

  return (
    <div className="border-t border-gray-100 bg-gray-50/40">
      {/* Avg time chips — shown for today/yesterday/custom (single day) */}
      <AvgTimeRow averageTimes={entry.averageTimes} consistentlyLate={entry.consistentlyLate} />

      {/* Tab toggle */}
      <div className="flex items-center gap-2 px-3 pt-2">
        {["heatmap", "table"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all ${
              tab === t
                ? "bg-green-700 text-white border-green-700"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {t === "heatmap" ? "Heatmap" : "Day-wise Table"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "heatmap" ? (
          <motion.div
            key="heatmap"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="px-3 py-3 space-y-1.5"
          >
            {/* Column headers */}
            <div className="flex items-center gap-1 mb-1">
              <span className="w-16 shrink-0" />
              {ACTIVITY_KEYS.map((key) => {
                const { Icon, short } = ACTIVITY_META[key];
                return (
                  <div
                    key={key}
                    className="flex flex-col items-center min-w-[36px] gap-0.5"
                  >
                    <Icon className="w-3 h-3 text-gray-400" />
                    <span className="text-[8px] text-gray-400 font-semibold uppercase">{short}</span>
                  </div>
                );
              })}
            </div>
            {hasAny ? (
              (entry.days || []).map((day) => (
                <DayHeatmapRow key={day.date} day={day} />
              ))
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">No activity data for this period.</p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="overflow-x-auto px-3 pb-3 pt-2"
          >
            <table className="w-full min-w-[560px] text-[11px] sm:text-xs border-collapse">
              <thead>
                <tr className="bg-green-50">
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-600 rounded-tl-lg">Date</th>
                  {ACTIVITY_KEYS.map((key) => {
                    const { Icon, label } = ACTIVITY_META[key];
                    return (
                      <th key={key} className="px-2 py-1.5 font-semibold text-gray-600">
                        <div className="flex items-center justify-start gap-1">
                          <Icon className="w-3 h-3 text-gray-400" />
                          <span>{label}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(entry.days || []).map((day, i) => (
                  <tr key={day.date} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="px-2 py-1.5 font-medium text-gray-700 text-[11px]">{day.date}</td>
                    {ACTIVITY_KEYS.map((key) => {
                      const act = day.activities?.[key];
                      const s   = act?.status ?? "missed";
                      const st  = STATUS_TEXT[s];
                      return (
                        <td key={key} className="px-2 py-1.5">
                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${st.bg} ${st.border}`}>
                            <StatusDot status={s} />
                            <span className={`text-[10px] font-semibold ${st.text}`}>
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
          </motion.div>
        )}
      </AnimatePresence>
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
  const [teamView, setTeamView] = useState("direct");
  const [expandOverride, setExpandOverride] = useState(null); // "expanded" | "collapsed" | null

  // Reset expandOverride to null after it fires so newly-opened nodes start from defaultExpanded
  useEffect(() => {
    if (expandOverride !== null) {
      const t = setTimeout(() => setExpandOverride(null), 50);
      return () => clearTimeout(t);
    }
  }, [expandOverride]);

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

        const [hierarchyRes, reportRes] = await Promise.all([
          teamHierarchyService.getTeamHierarchy(user.id, false).catch(() => null),
          fetch(`${apiBaseUrl}/api/get-activity-time-report?${params}`, { cache: "no-store" }),
        ]);

        const reportJson = await reportRes.json();
        if (!reportRes.ok || !reportJson?.success) {
          throw new Error(reportJson?.message || "Failed to fetch time report");
        }

        const flat = Array.isArray(reportJson.data) ? reportJson.data : [];
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

        const sortNode = (node) => ({
          ...node,
          teamMembers: [...(node.teamMembers || [])]
            .sort((a, b) => sortOrder === "desc" ? b.__score - a.__score : a.__score - b.__score)
            .map(sortNode),
        });

        if (hierarchyRes?.hierarchy) {
          setHierarchyData(sortNode(enrichNode(hierarchyRes.hierarchy)));
        } else if (flat.length > 0) {
          // No hierarchy service — build synthetic tree from flat list
          const syn = buildHierarchyFromFlat(flat, scoreMap, user.id);
          if (syn) setHierarchyData(sortNode(enrichNode(syn)));
        }
      } catch (err) {
        setError(err.message || "Unable to load report");
      } finally {
        if (isBackground) setRefreshing(false);
        else setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, apiBaseUrl, userRole, dateRange, customStartDate, customEndDate, timezoneOffset, sortOrder],
  );

  useEffect(() => { fetchData(false); }, [fetchData]);

  // ── Filter / search / style helpers ───────────────────────────────────────

  const matchesFilter = useCallback(
    (node) => {
      if (filter === "all") return true;
      const s = node.__score ?? 0;
      if (filter === "strong")   return s >= 80;
      if (filter === "moderate") return s >= 50 && s < 80;
      if (filter === "risk")     return s < 50;
      return true;
    },
    [filter],
  );

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

  const renderStatus = useCallback((node) => {
    const score   = node.__score ?? 0;
    const hasLate = Object.values(node.__timeData?.consistentlyLate || {}).some(Boolean);
    return (
      <div className="flex items-center gap-1.5">
        <ScoreRing score={score} />
        {hasLate && (
          <Flame className="w-4 h-4 text-orange-500 shrink-0" title="Consistently late on some activities" />
        )}
      </div>
    );
  }, []);

  const renderStats = useCallback((node) => {
    const self      = node.__score ?? 0;
    const directAvg = node.__directAvg;
    const fullAvg   = node.__fullAvg;
    const fmt = (v) => v === null || v === undefined ? "0%" : `${v}%`;
    return (
      <>
        <div className="flex-1 flex flex-col items-center pr-2">
          <span className="text-sm sm:text-base font-bold text-gray-900">
            {self}%
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center px-2">
          <span className="text-sm sm:text-base font-bold text-gray-900">
            {fmt(directAvg)}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center pl-2">
          <span className="text-sm sm:text-base font-bold text-gray-900">
            {fmt(fullAvg)}
          </span>
        </div>
      </>
    );
  }, []);

  const renderExpandedDetails = useCallback((node) => <TimeReportDetails node={node} dateRange={dateRange} />, [dateRange]);

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

  const subtitle = `${flatData.length} member${flatData.length === 1 ? "" : "s"} • ${
    new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  }`;
  // ── Direct / Full hierarchy filter ────────────────────────────────────────
  const filteredHierarchy = useMemo(() => {
    if (!hierarchyData) return null;
    if (teamView === "full") return hierarchyData;
    // Direct view: strip nested teamMembers from direct reports
    if (hierarchyData.teamMembers) {
      return {
        ...hierarchyData,
        teamMembers: hierarchyData.teamMembers.map((member) => ({
          ...member,
          teamMembers: [],
        })),
      };
    }
    return hierarchyData;
  }, [hierarchyData, teamView]);
  const handleDownload = () => {
    console.log("Download activity time report");
    // Implement download logic here
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
      onFilterChange={setFilter}
      sortOrder={sortOrder}
      onSortChange={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
      summaryStats={null}
      allowedDateRanges={["today", "yesterday"]}
      singleDayCustom={true}
      onExpandAll={() => setExpandOverride("expanded")}
      onCollapseAll={() => setExpandOverride("collapsed")}
      expandedState={expandOverride}
    >
      {filteredHierarchy ? (
        <>
          {teamViewToggle}
          <HierarchicalNode
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
            forceExpandedState={expandOverride}
            defaultExpanded={false}
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
    </HierarchicalReportLayout>
  );
}

export default ActivityTimeReport;
