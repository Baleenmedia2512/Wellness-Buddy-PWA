// src/components/PersonalDisciplineScore.js
import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Scale, BookOpen, Coffee, Utensils, Moon } from "lucide-react";

/**
 * PersonalDisciplineScore - Displays user's personal discipline breakdown by category
 * Shows WEI (Weight), EDU (Education), BRE (Breakfast), LUN (Lunch), DIN (Dinner)
 * Uses coach/discipline-report API and reads from coachPerformance.activities field
 */
const PersonalDisciplineScore = forwardRef(({ apiBaseUrl, userId }, ref) => {
  const [categories, setCategories] = useState(null);
  const [overallScore, setOverallScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchPersonalScore = async () => {
      if (!userId || !apiBaseUrl) {
        setLoading(false);
        return;
      }

      try {
        console.log(
          "📊 [PersonalDisciplineScore] Fetching personal discipline for userId:",
          userId,
        );

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

        console.log("📊 [PersonalDisciplineScore] Full API Response:", result);
        console.log("📊 [PersonalDisciplineScore] API Response Summary:", {
          success: result.success,
          hasCoachPerformance: !!result.coachPerformance,
          activities: result.coachPerformance?.activities,
          overallScore: result.coachPerformance?.periodDiscipline?.percentage,
          rawCoachPerformance: result.coachPerformance,
        });

        if (!result.success || !result.coachPerformance) {
          console.log("📊 [PersonalDisciplineScore] No data available - hiding component");
          setCategories(null);
          setOverallScore(0);
          setLoading(false);
          return;
        }

        // Get overall discipline score
        const overall = result.coachPerformance.periodDiscipline?.percentage || 0;
        console.log("📊 [PersonalDisciplineScore] Overall score:", overall);
        setOverallScore(overall);

        // Get personal discipline activities (use 'activities' field from API)
        const activities = result.coachPerformance.activities || {};
        console.log("📊 [PersonalDisciplineScore] Activities data:", activities);

        const categoryData = {
          weight: activities.weight || { percentage: 0 },
          education: activities.education || { percentage: 0 },
          breakfast: activities.breakfast || { percentage: 0 },
          lunch: activities.lunch || { percentage: 0 },
          dinner: activities.dinner || { percentage: 0 },
        };
        
        console.log("📊 [PersonalDisciplineScore] Setting categories:", categoryData);
        setCategories(categoryData);
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
      console.log("📊 [PersonalDisciplineScore] Manual refresh triggered");
      setRefreshKey(prev => prev + 1);
    }
  }));

  // Get color based on score
  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  // Icons for each category
  const categoryIcons = {
    weight: <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    education: <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    breakfast: <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    lunch: <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    dinner: <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
  };

  // Don't render if loading
  if (loading) {
    return null;
  }

  // Don't show if no data
  if (!categories) {
    console.log(
      "📊 [PersonalDisciplineScore] Not rendering - no categories available",
    );
    return null;
  }

  console.log(" [PersonalDisciplineScore] Rendering with categories:", categories);

  return (
    <div className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-2 sm:px-3 py-1 sm:py-2">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with Overall Score */}
          <div className="px-2 sm:px-3 py-1.5 bg-gradient-to-r from-blue-50 to-green-50 border-b border-gray-100">
            <div className="flex items-center justify-center gap-2">
              <div className="flex-1 text-left">
                {/* <p className="text-[10px] sm:text-xs font-semibold text-gray-700">
                  Your Daily Discipline Score
                </p> */}
                {/* <p className="text-[9px] text-gray-500 mt-0">
                  Swipe to see each of your meals
                </p> */}
              </div>
              <div className="flex flex-col items-center">
                {/* <p className="text-[8px] sm:text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0">
                  Overall
                </p> */}
                <div
                  className={`text-lg sm:text-xl md:text-2xl font-black ${
                    overallScore >= 80
                      ? "text-green-600"
                      : overallScore >= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {overallScore}%
                </div>
              </div>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-5 divide-x divide-gray-200">
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
                  {categoryIcons[key]}
                </div>
                <div
                  className={`text-xs sm:text-sm md:text-base font-black ${
                    data.percentage >= 80
                      ? "text-green-600"
                      : data.percentage >= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {data.percentage}%
                </div>
              </div>
            ))}
          </div>

          {/* Progress indicator bar */}
          <div className="h-0.5 sm:h-1 bg-gray-100 grid grid-cols-5">
            {Object.entries(categories).map(([key, data]) => (
              <div
                key={key}
                className={`transition-all duration-500 ${
                  data.percentage >= 80
                    ? "bg-green-500"
                    : data.percentage >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${data.percentage}%` }}
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
