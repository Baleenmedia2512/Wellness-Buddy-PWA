import { getSupabaseClient } from "../../utils/supabaseClient.js";

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, cache-control, pragma",
    );
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const { userId, date, startDate, endDate, detailed = "false" } = req.query;

  if (!userId) {
    res.status(400).json({ message: "UserId is required" });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // If detailed nutrition data requested for dashboard
    if (detailed === "true" && date) {
      // Use the date string directly to avoid timezone issues
      // Database stores timestamps without timezone, so we query with local dates
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      // Fetch nutrition data using Supabase
      // UserID is stored as TEXT, ensure we compare as string
      const { data: nutritionData, error } = await supabase
        .from("food_nutrition_data_table")
        .select(
          "ID, ImagePath, ImageBase64, AnalysisData, ConfidenceScore, TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber, ProcessedBy, DeviceInfo, CreatedAt",
        )
        .eq("UserID", String(userId))
        .eq("IsDeleted", 0)
        .gte("CreatedAt", startOfDay)
        .lte("CreatedAt", endOfDay)
        .order("CreatedAt", { ascending: false });

      console.log("📊 [user-nutrition-stats] Query result:", {
        recordCount: nutritionData?.length || 0,
        error: error?.message || null,
        firstRecord: nutritionData?.[0]
          ? { id: nutritionData[0].ID, createdAt: nutritionData[0].CreatedAt }
          : null,
      });

      // Also try a simpler query to debug - order by ID desc to get latest
      const { data: allRecords, error: allError } = await supabase
        .from("food_nutrition_data_table")
        .select("ID, UserID, CreatedAt, IsDeleted")
        .eq("UserID", String(userId))
        .order("ID", { ascending: false })
        .limit(10);

      console.log(
        "📊 [user-nutrition-stats] Debug - All records for user (by ID desc):",
        {
          count: allRecords?.length || 0,
          records: allRecords?.map((r) => ({
            id: r.ID,
            createdAt: r.CreatedAt,
            isDeleted: r.IsDeleted,
          })),
        },
      );

      if (error) throw error;

      // ✅ TIMEZONE FIX: Removed server-side meal categorization
      // Meal categories are now calculated on frontend using user's local timezone
      // This ensures correct categorization regardless of server timezone
      const enrichedData = nutritionData || [];

      // Filter out records with empty foods array in AnalysisData
      const filteredNutritionData = enrichedData.filter((record) => {
        try {
          const data = JSON.parse(record.AnalysisData);
          return Array.isArray(data.foods) && data.foods.length > 0;
        } catch {
          return true; // keep if cannot parse (to avoid hiding valid but malformed data)
        }
      });

      const dailyTotals = filteredNutritionData.reduce(
        (totals, record) => ({
          totalCalories: totals.totalCalories + (record.TotalCalories || 0),
          totalProtein: totals.totalProtein + (record.TotalProtein || 0),
          totalCarbs: totals.totalCarbs + (record.TotalCarbs || 0),
          totalFat: totals.totalFat + (record.TotalFat || 0),
          totalFiber: totals.totalFiber + (record.TotalFiber || 0),
          mealCount: totals.mealCount + 1,
        }),
        {
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
          totalFiber: 0,
          mealCount: 0,
        },
      );
      res.status(200).json({
        success: true,
        data: filteredNutritionData,
        dailyTotals: {
          ...dailyTotals,
          totalCalories: Math.round(dailyTotals.totalCalories * 100) / 100,
          totalProtein: Math.round(dailyTotals.totalProtein * 100) / 100,
          totalCarbs: Math.round(dailyTotals.totalCarbs * 100) / 100,
          totalFat: Math.round(dailyTotals.totalFat * 100) / 100,
          totalFiber: Math.round(dailyTotals.totalFiber * 100) / 100,
        },
        queryInfo: { userId, date, recordCount: filteredNutritionData.length },
      });
      return;
    }

    // Get user statistics using Supabase
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Total count
    const { count: totalCount, error: totalError } = await supabase
      .from("food_nutrition_data_table")
      .select("*", { count: "exact", head: true })
      .eq("UserID", userId)
      .eq("IsDeleted", 0);

    if (totalError) throw totalError;

    // Today count
    const { count: todayCount, error: todayError } = await supabase
      .from("food_nutrition_data_table")
      .select("*", { count: "exact", head: true })
      .eq("UserID", userId)
      .eq("IsDeleted", 0)
      .gte("CreatedAt", today.toISOString());

    if (todayError) throw todayError;

    // Week count
    const { count: weekCount, error: weekError } = await supabase
      .from("food_nutrition_data_table")
      .select("*", { count: "exact", head: true })
      .eq("UserID", userId)
      .eq("IsDeleted", 0)
      .gte("CreatedAt", weekAgo.toISOString());

    if (weekError) throw weekError;

    // Background count
    const { count: backgroundCount, error: backgroundError } = await supabase
      .from("food_nutrition_data_table")
      .select("*", { count: "exact", head: true })
      .eq("UserID", userId)
      .eq("ProcessedBy", "background_service")
      .eq("IsDeleted", 0);

    if (backgroundError) throw backgroundError;

    // Get weekly nutrition data
    const { data: weeklyData, error: weeklyError } = await supabase
      .from("food_nutrition_data_table")
      .select("TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber")
      .eq("UserID", userId)
      .eq("IsDeleted", 0)
      .gte("CreatedAt", weekAgo.toISOString());

    if (weeklyError) throw weeklyError;

    const weeklyNutrition = (weeklyData || []).reduce(
      (totals, record) => ({
        totalCalories: totals.totalCalories + (record.TotalCalories || 0),
        totalProtein: totals.totalProtein + (record.TotalProtein || 0),
        totalCarbs: totals.totalCarbs + (record.TotalCarbs || 0),
        totalFat: totals.totalFat + (record.TotalFat || 0),
        totalFiber: totals.totalFiber + (record.TotalFiber || 0),
      }),
      {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
      },
    );

    // Get daily nutrition (manually group by date)
    const dailyMap = {};
    (weeklyData || []).forEach((record) => {
      const date = new Date(record.CreatedAt).toISOString().split("T")[0];
      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          meals: 0,
        };
      }
      dailyMap[date].calories += record.TotalCalories || 0;
      dailyMap[date].protein += record.TotalProtein || 0;
      dailyMap[date].carbs += record.TotalCarbs || 0;
      dailyMap[date].fat += record.TotalFat || 0;
      dailyMap[date].meals += 1;
    });
    const dailyNutrition = Object.values(dailyMap).sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    // Get recent analyses
    const { data: recentAnalyses, error: recentError } = await supabase
      .from("food_nutrition_data_table")
      .select(
        "ID, ImagePath, ImageBase64, TotalCalories, TotalProtein, TotalCarbs, TotalFat, ProcessedBy, CreatedAt",
      )
      .eq("UserID", userId)
      .eq("IsDeleted", 0)
      .order("CreatedAt", { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    res.status(200).json({
      success: true,
      userId: userId,
      statistics: {
        total: totalCount || 0,
        today: todayCount || 0,
        thisWeek: weekCount || 0,
        backgroundProcessed: backgroundCount || 0,
        manualProcessed: (totalCount || 0) - (backgroundCount || 0),
      },
      weeklyNutrition: weeklyNutrition,
      dailyNutrition: dailyNutrition,
      recentAnalyses: recentAnalyses || [],
    });
  } catch (error) {
    console.error("Failed to get user statistics:", error);
    console.error("Error code:", error.code);
    console.error("Error stack:", error.stack);

    // Enhanced error messages for different error types
    let errorMessage = "Failed to fetch user nutrition statistics";

    if (error.code === "ETIMEDOUT" || error.message?.includes("timeout")) {
      errorMessage = "Database connection timeout. Please try again.";
    } else if (error.message?.includes("Connection terminated")) {
      errorMessage = "Database connection was terminated. Retrying...";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage =
        "Database connection refused. Please check if database is accessible.";
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
