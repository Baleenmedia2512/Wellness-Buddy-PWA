// src/components/PersonalDisciplineScore.js
import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { BookOpen, Coffee, Utensils, Moon, Droplets, Flame } from "lucide-react";
import BathroomScaleIcon from "./icons/BathroomScaleIcon";
import { debugLog } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// SWR (stale-while-revalidate) cache — keyed per user so different users
// never see each other's data. TTL is 5 minutes; stale data shows instantly
// on mount so the bar never flashes blank on back-navigation.
// ---------------------------------------------------------------------------
const PDS_CACHE_TTL = 5 * 60 * 1000;
const readPDSCache = (uid) => {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`wv.pds.${uid}`);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Date.now() - c.ts < PDS_CACHE_TTL ? c : null;
  } catch { return null; }
};
const writePDSCache = (uid, categories, overallScore) => {
  if (!uid) return;
  try {
    localStorage.setItem(`wv.pds.${uid}`, JSON.stringify({ categories, overallScore, ts: Date.now() }));
  } catch { /* storage quota — ignore */ }
};

/**
 * PersonalDisciplineScore - Displays user's personal discipline breakdown by category
 * Shows WEI (Weight), EDU (Education), BRE (Breakfast), LUN (Lunch), DIN (Dinner), WAT (Water), CAL (Calories)
 * Uses coach/discipline-report API and reads from coachPerformance.activities field
 */
const PersonalDisciplineScore = forwardRef(({ apiBaseUrl, userId }, ref) => {
  const [categories, setCategories] = useState(() => readPDSCache(userId)?.categories ?? null);
  const [overallScore, setOverallScore] = useState(() => readPDSCache(userId)?.overallScore ?? 0);
  // If we have a cache hit, skip the loading state so the bar shows immediately.
  const [loading, setLoading] = useState(() => readPDSCache(userId) === null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchPersonalScore = async () => {
      if (!userId || !apiBaseUrl) {
        setLoading(false);
        return;
      }

      try {
        // debugLog(
        //   "📊 [PersonalDisciplineScore] Fetching personal discipline for userId:",
        //   userId,
        // );

        // Get user's timezone offset for proper discipline calculation
        const userTimezoneOffset = new Date().getTimezoneOffset();

        const response = await fetch(
          `${apiBaseUrl}/api/coach/discipline-report?coachId=${userId}&dateRange=today&userTimezoneOffset=${userTimezoneOffset}&t=${Date.now()}`,
          {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          },
        );
        const result = await response.json();

        // debugLog("📊 [PersonalDisciplineScore] Full API Response:", result);
        // debugLog("📊 [PersonalDisciplineScore] API Response Summary:", {
        //   success: result.success,
        //   hasCoachPerformance: !!result.coachPerformance,
        //   activities: result.coachPerformance?.activities,
        //   overallScore: result.coachPerformance?.periodDiscipline?.percentage,
        //   rawCoachPerformance: result.coachPerformance,
        // });

        if (!result.success || !result.coachPerformance) {
          // debugLog(
          //   "📊 [PersonalDisciplineScore] No data available - hiding component",
          // );
          setCategories(null);
          setOverallScore(0);
          setLoading(false);
          return;
        }

        // Get overall discipline score
        const overall =
          result.coachPerformance.periodDiscipline?.percentage || 0;
        // debugLog("📊 [PersonalDisciplineScore] Overall score:", overall);
        setOverallScore(overall);

        // Get personal discipline activities (use 'activities' field from API)
        const activities = result.coachPerformance.activities || {};
        // debugLog(
        //   "📊 [PersonalDisciplineScore] Activities data:",
        //   activities,
        // );

        const categoryData = {
          weight: activities.weight || { percentage: 0 },
          education: activities.education || { percentage: 0 },
          breakfast: activities.breakfast || { percentage: 0 },
          lunch: activities.lunch || { percentage: 0 },
          dinner: activities.dinner || { percentage: 0 },
          water: activities.water || { percentage: 0 },
          caloriesBurned: activities.caloriesBurned || { percentage: 0 },
        };

        // debugLog(
        //   "📊 [PersonalDisciplineScore] Setting categories:",
        //   categoryData,
        // );
        setCategories(categoryData);
        writePDSCache(userId, categoryData, overall);
      } catch (error) {
        console.error(
          "📊 [PersonalDisciplineScore] Error fetching personal score:",
          error,
        );
        setCategories(null);
        setOverallScore(0);
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalScore();
  }, [apiBaseUrl, userId, refreshKey]);

  // Expose refresh method to parent component
  useImperativeHandle(ref, () => ({
    refresh: () => {
      // debugLog("📊 [PersonalDisciplineScore] Manual refresh triggered");
      setRefreshKey((prev) => prev + 1);
    },
  }));

  // Get color based on score
  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  // Score → variant for non-tintable icons (the PNG-based scale)
  const getScoreVariant = (score) => (score >= 80 ? "green" : "red");

  // Icons for each category (weight is a function so it can react to score)
  const categoryIcons = {
    weight: (score) => (
      <BathroomScaleIcon
        className="w-3.5 h-3.5 sm:w-4 sm:h-4"
        variant={getScoreVariant(score)}
      />
    ),
    education: <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    breakfast: <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    lunch: <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    dinner: <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    water: <Droplets className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    caloriesBurned: <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
  };

  // Don't render if loading
  if (loading) {
    return null;
  }

  // Don't show if no data
  if (!categories) {
    // debugLog(
    //   "📊 [PersonalDisciplineScore] Not rendering - no categories available",
    // );
    return null;
  }

  // debugLog(
  //   " [PersonalDisciplineScore] Rendering with categories:",
  //   categories,
  // );

  return (
    <div className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-2 sm:px-3 py-1 sm:py-2">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Header - Overall Score Removed */}

          {/* Categories Grid */}
          <div className="grid grid-cols-7 divide-x divide-gray-200">
            {Object.entries(categories).map(([key, data]) => (
              <div
                key={key}
                className="p-1.5 sm:p-2 flex flex-col items-center justify-center text-center min-h-[70px] sm:min-h-[85px] hover:bg-gray-50 transition-colors"
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center mb-1 shadow-sm border-2 ${getScoreColor(
                    data.percentage,
                  )}`}
                >
                  {typeof categoryIcons[key] === "function"
                    ? categoryIcons[key](data.percentage)
                    : categoryIcons[key]}
                </div>
                <span
                  className={`text-[11px] font-bold mt-0.5 ${
                    data.percentage >= 80
                      ? "text-green-600"
                      : data.percentage >= 60
                      ? "text-yellow-600"
                      : "text-red-500"
                  }`}
                >
                  {data.percentage}%
                </span>
              </div>
            ))}
          </div>

          {/* Progress indicator bar */}
          <div className="h-0.5 sm:h-1 bg-gray-100 flex">
            {Object.entries(categories).map(([key, data]) => (
              <div
                key={key}
                className={`transition-all duration-500 flex-1 ${
                  data.percentage >= 80
                    ? "bg-green-500"
                    : data.percentage >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ opacity: data.percentage > 0 ? 1 : 0.1 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

PersonalDisciplineScore.displayName = "PersonalDisciplineScore";

export default PersonalDisciplineScore;
