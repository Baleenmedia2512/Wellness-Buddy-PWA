import React, { useState, useEffect } from "react";
import {
  X,
  DollarSign,
import React, { useState, useEffect } from "react";
import {
  X,
  DollarSign,
  IndianRupee,
  Zap,
  Zap,
  Activity,
  RefreshCw,
  Database,
  Clock,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Check,
  Edit3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getUsdToInrRate } from "../services/tokenCost/tokenCostConfig";
import { clearUserPricingCache } from "../services/tokenCost/userPricingManager";
import { clearPricingCache } from "../services/tokenCost/tokenCostConfig";
import { App as CapacitorApp } from "@capacitor/app";
import TouchFeedbackButton from "./TouchFeedbackButton";

// --- Dynamic Demo Data Generator ---
// COMMENTED OUT - Demo data disabled
/*
const generateDemoData = () => {
  const today = new Date();
  
  // User database with realistic patterns
  const users = [
    { id: "USR001", name: "John Doe", email: "john.doe@wellness.com", activityLevel: 0.9 },
    { id: "USR002", name: "Emily Rodriguez", email: "emily.rodriguez@wellness.com", activityLevel: 0.85 },
    { id: "USR003", name: "Sarah Johnson", email: "sarah.johnson@wellness.com", activityLevel: 0.75 },
    { id: "USR004", name: "James Patel", email: "james.patel@wellness.com", activityLevel: 0.72 },
    { id: "USR005", name: "David Kim", email: "david.kim@wellness.com", activityLevel: 0.68 },
    { id: "USR006", name: "Lisa Anderson", email: "lisa.anderson@wellness.com", activityLevel: 0.65 },
    { id: "USR007", name: "Mike Chen", email: "mike.chen@wellness.com", activityLevel: 0.62 },
    { id: "USR008", name: "Jessica Martinez", email: "jessica.martinez@wellness.com", activityLevel: 0.58 },
    { id: "USR009", name: "Robert Taylor", email: "robert.taylor@wellness.com", activityLevel: 0.55 },
    { id: "USR010", name: "Amanda White", email: "amanda.white@wellness.com", activityLevel: 0.52 },
    { id: "USR011", name: "Kevin Brown", email: "kevin.brown@wellness.com", activityLevel: 0.48 },
    { id: "USR012", name: "Michelle Garcia", email: "michelle.garcia@wellness.com", activityLevel: 0.45 },
    { id: "USR013", name: "Chris Lee", email: "chris.lee@wellness.com", activityLevel: 0.42 },
    { id: "USR014", name: "Jennifer Nguyen", email: "jennifer.nguyen@wellness.com", activityLevel: 0.38 },
    { id: "USR015", name: "Brian Thomas", email: "brian.thomas@wellness.com", activityLevel: 0.35 },
    { id: "USR016", name: "Melissa Wilson", email: "melissa.wilson@wellness.com", activityLevel: 0.32 },
    { id: "USR017", name: "Daniel Moore", email: "daniel.moore@wellness.com", activityLevel: 0.28 },
    { id: "USR018", name: "Nicole Jackson", email: "nicole.jackson@wellness.com", activityLevel: 0.25 },
    { id: "USR019", name: "Ryan Harris", email: "ryan.harris@wellness.com", activityLevel: 0.22 },
    { id: "USR020", name: "Stephanie Clark", email: "stephanie.clark@wellness.com", activityLevel: 0.18 },
    { id: "USR021", name: "Tyler Martinez", email: "tyler.martinez@wellness.com", activityLevel: 0.15 },
    { id: "USR022", name: "Rachel Green", email: "rachel.green@wellness.com", activityLevel: 0.12 },
    { id: "USR023", name: "Alex Turner", email: "alex.turner@wellness.com", activityLevel: 0.10 },
    { id: "USR024", name: "Sophie Chen", email: "sophie.chen@wellness.com", activityLevel: 0.08 },
    { id: "USR025", name: "Marcus Johnson", email: "marcus.johnson@wellness.com", activityLevel: 0.05 }
  ];

  const operations = [
    { type: "food_analysis", weight: 0.60, avgTokens: 850, variance: 300 },
    { type: "weight_detection", weight: 0.28, avgTokens: 420, variance: 150 },
    { type: "background_analysis", weight: 0.12, avgTokens: 1200, variance: 400 }
  ];

  const models = [
    { name: "gemini-2.5-flash-lite", weight: 0.82, costPerToken: 0.00012 },
    { name: "gemini-2.0-flash", weight: 0.18, costPerToken: 0.00015 }
  ];

  // Generate daily stats for last 30 days
  const dailyStats = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Weekend pattern: lower usage on Sat/Sun
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendFactor = isWeekend ? 0.6 : 1.0;
    
    // Add some natural variation
    const randomFactor = 0.8 + Math.random() * 0.4;
    const baseRequests = Math.floor(25 * weekendFactor * randomFactor);
    const baseTokens = baseRequests * (800 + Math.random() * 400);
    const baseCost = baseTokens * 0.00012;
    
    dailyStats.push({
      date: dateStr,
      totalTokens: Math.floor(baseTokens),
      totalCost: Number(baseCost.toFixed(2)),
      requestCount: baseRequests
    });
  }
  dailyStats.reverse();

  // Generate user spending with realistic distribution
  const userSpending = users.map(user => {
    const baseRequests = Math.floor(45 * user.activityLevel * (0.8 + Math.random() * 0.4));
    const avgTokensPerRequest = 650 + Math.random() * 400;
    const totalTokens = Math.floor(baseRequests * avgTokensPerRequest);
    const inputTokens = Math.floor(totalTokens * 0.62); // 62% input
    const outputTokens = totalTokens - inputTokens; // 38% output
    const totalCost = Number((totalTokens * 0.00012 * (0.9 + Math.random() * 0.2)).toFixed(2));
    
    return {
      userId: user.id,
      email: user.email,
      userName: user.name,
      inputTokens,
      outputTokens,
      totalCost,
      totalTokens,
      requestCount: baseRequests
    };
  }).filter(u => u.requestCount > 0);

  // Generate recent usage (last 10 transactions)
  const recentUsage = [];
  for (let i = 0; i < 10; i++) {
    const user = users[Math.floor(Math.random() * Math.min(10, users.length))];
    const operation = operations[Math.random() < 0.6 ? 0 : Math.random() < 0.85 ? 1 : 2];
    const model = models[Math.random() < 0.82 ? 0 : 1];
    const tokens = Math.floor(operation.avgTokens + (Math.random() - 0.5) * operation.variance);
    const cost = Number((tokens * model.costPerToken * (0.9 + Math.random() * 0.2)).toFixed(2));
    
    const timestamp = new Date(today);
    timestamp.setHours(timestamp.getHours() - i * 2);
    
    recentUsage.push({
      id: i + 1,
      userId: user.id,
      email: user.email,
      operationType: operation.type,
      modelName: model.name,
      totalTokens: tokens,
      totalTokenCost: cost,
      createdAt: timestamp.toISOString()
    });
  }

  // Calculate totals
  const totalCost = userSpending.reduce((sum, u) => sum + u.totalCost, 0);
  const totalTokens = userSpending.reduce((sum, u) => sum + u.totalTokens, 0);
  const totalRequests = userSpending.reduce((sum, u) => sum + u.requestCount, 0);

  // Operation breakdown
  const byOperation = operations.map(op => {
    const opTokens = Math.floor(totalTokens * op.weight);
    const opCost = Number((opTokens * 0.00012).toFixed(2));
    const opRequests = Math.floor(totalRequests * op.weight);
    return {
      operationType: op.type,
      totalTokens: opTokens,
      totalCost: opCost,
      requestCount: opRequests,
      percentage: (op.weight * 100).toFixed(1)
    };
  });

  // Model breakdown
  const byModel = models.map(model => {
    const modelTokens = Math.floor(totalTokens * model.weight);
    const modelCost = Number((modelTokens * model.costPerToken).toFixed(2));
    const modelRequests = Math.floor(totalRequests * model.weight);
    return {
      modelName: model.name,
      totalTokens: modelTokens,
      totalCost: modelCost,
      requestCount: modelRequests,
      percentage: (model.weight * 100).toFixed(1)
    };
  });

  return {
    summary: {
      totalTokens,
      totalInputTokens: Math.floor(totalTokens * 0.62),
      totalOutputTokens: Math.floor(totalTokens * 0.38),
      totalCost: Number(totalCost.toFixed(4)),
      totalInputCost: Number((totalCost * 0.42).toFixed(4)),
      totalOutputCost: Number((totalCost * 0.58).toFixed(4)),
      averageCostPerRequest: Number((totalCost / totalRequests).toFixed(4)),
      requestCount: totalRequests,
      mostUsedOperation: operations[0].type,
      mostUsedModel: models[0].name
    },
    byOperation,
    byModel,
    dailyStats,
    recentUsage,
    userSpending
  };
};
*/

// Generate demo data on load
// const DEMO_DATA = generateDemoData();

// Filter demo data based on time range
/*
const filterDemoDataByTimeRange = (timeRange, customStartDate = null, customEndDate = null) => {
  const now = new Date();
  let startDateObj;
  let endDateObj = now;
  
  // Calculate date range
  if (timeRange === 'custom' && customStartDate && customEndDate) {
    startDateObj = new Date(customStartDate);
    endDateObj = new Date(customEndDate);
    endDateObj.setHours(23, 59, 59, 999);
  } else {
    switch (timeRange) {
      case 'today':
        startDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDateObj = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDateObj = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
      default:
        startDateObj = new Date(0); // Beginning of time
        break;
    }
  }

  // Filter daily stats by date range
  const filteredDailyStats = DEMO_DATA.dailyStats.filter(stat => {
    const statDate = new Date(stat.date);
    return statDate >= startDateObj && statDate <= endDateObj;
  });

  // Filter recent usage by date range
  const filteredRecentUsage = DEMO_DATA.recentUsage.filter(usage => {
    const usageDate = new Date(usage.createdAt);
    return usageDate >= startDateObj && usageDate <= endDateObj;
  });

  // Recalculate summary from filtered daily stats
  const filteredTotalTokens = filteredDailyStats.reduce((sum, stat) => sum + stat.totalTokens, 0);
  const filteredTotalCost = filteredDailyStats.reduce((sum, stat) => sum + stat.totalCost, 0);
  const filteredRequestCount = filteredDailyStats.reduce((sum, stat) => sum + stat.requestCount, 0);

  // Recalculate operation and model breakdowns proportionally
  const ratio = filteredTotalTokens / DEMO_DATA.summary.totalTokens || 0;
  
  const filteredByOperation = DEMO_DATA.byOperation.map(op => ({
    ...op,
    totalTokens: Math.floor(op.totalTokens * ratio),
    totalCost: Number((op.totalCost * ratio).toFixed(2)),
    requestCount: Math.floor(op.requestCount * ratio)
  }));

  const filteredByModel = DEMO_DATA.byModel.map(model => ({
    ...model,
    totalTokens: Math.floor(model.totalTokens * ratio),
    totalCost: Number((model.totalCost * ratio).toFixed(2)),
    requestCount: Math.floor(model.requestCount * ratio)
  }));

  // Recalculate user spending based on filtered data
  const filteredUserSpending = DEMO_DATA.userSpending.map(user => {
    const filteredTotalTokens = Math.floor(user.totalTokens * ratio);
    const filteredInputTokens = Math.floor(user.inputTokens * ratio);
    const filteredOutputTokens = Math.floor(user.outputTokens * ratio);
    return {
      ...user,
      inputTokens: filteredInputTokens,
      outputTokens: filteredOutputTokens,
      totalTokens: filteredTotalTokens,
      totalCost: Number((user.totalCost * ratio).toFixed(2)),
      requestCount: Math.floor(user.requestCount * ratio)
    };
  }).filter(user => user.requestCount > 0);

  return {
    summary: {
      ...DEMO_DATA.summary,
      totalTokens: filteredTotalTokens,
      totalInputTokens: Math.floor(filteredTotalTokens * 0.62),
      totalOutputTokens: Math.floor(filteredTotalTokens * 0.38),
      totalCost: Number(filteredTotalCost.toFixed(4)),
      totalInputCost: Number((filteredTotalCost * 0.42).toFixed(4)),
      totalOutputCost: Number((filteredTotalCost * 0.58).toFixed(4)),
      averageCostPerRequest: filteredRequestCount > 0 ? Number((filteredTotalCost / filteredRequestCount).toFixed(4)) : 0,
      requestCount: filteredRequestCount
    },
    byOperation: filteredByOperation,
    byModel: filteredByModel,
    dailyStats: filteredDailyStats,
    recentUsage: filteredRecentUsage,
    userSpending: filteredUserSpending
  };
};
*/

// --- Components ---

const DateRangePicker = ({ startDate, endDate, onSelect, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const daysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handleDateClick = (day) => {
    const clickedDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );

    // Prevent selecting future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (clickedDate > today) {
      return;
    }

    if (selectingStart) {
      setTempStart(clickedDate);
      setTempEnd(null);
      setSelectingStart(false);
    } else {
      if (clickedDate < tempStart) {
        setTempEnd(tempStart);
        setTempStart(clickedDate);
      } else {
        setTempEnd(clickedDate);
      }
      // Auto-confirm after selecting both dates
      setTimeout(() => {
        onSelect(tempStart, clickedDate < tempStart ? tempStart : clickedDate);
      }, 200);
    }
  };

  const isInRange = (day) => {
    if (!tempStart || !tempEnd) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    return date >= tempStart && date <= tempEnd;
  };

  const isStartDate = (day) => {
    if (!tempStart) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    return date.toDateString() === tempStart.toDateString();
  };

  const isEndDate = (day) => {
    if (!tempEnd) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    return date.toDateString() === tempEnd.toDateString();
  };

  const isFutureDate = (day) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  };

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    );
  };

  const days = daysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const blanks = Array(firstDay).fill(null);
  const dayNumbers = Array.from({ length: days }, (_, i) => i + 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="text-center">
          <h3 className="font-semibold text-gray-800">
            {currentMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {selectingStart ? "Select start date" : "Select end date"}
          </p>
        </div>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}
        {dayNumbers.map((day) => {
          const isStart = isStartDate(day);
          const isEnd = isEndDate(day);
          const inRange = isInRange(day);
          const isFuture = isFutureDate(day);

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              disabled={isFuture}
              className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${
                isFuture
                  ? "text-gray-300 cursor-not-allowed"
                  : isStart || isEnd
                  ? "bg-green-600 text-white font-bold shadow-md"
                  : inRange
                  ? "bg-green-100 text-green-700"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setTempStart(null);
            setTempEnd(null);
            setSelectingStart(true);
          }}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>
    </motion.div>
  );
};

const AdminDashboard = ({ user, onClose }) => {
  const [timeRange, setTimeRange] = useState("month");
  const [tokenData, setTokenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null); // Track API errors for display
  // const [showDemoData, setShowDemoData] = useState(false); // COMMENTED OUT - Demo disabled
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("totalCost");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [tokenCosts, setTokenCosts] = useState({ inputCost: 0, outputCost: 0 });
  const [tokenCostInputs, setTokenCostInputs] = useState({
    inputCost: "",
    outputCost: "",
  });
  const [originalTokenCosts, setOriginalTokenCosts] = useState({
    inputCost: 0,
    outputCost: 0,
  });
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [popupJustOpened, setPopupJustOpened] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState(null);
  const [perMillionCosts, setPerMillionCosts] = useState({
    inputPerMillion: 0.1,
    outputPerMillion: 0.4,
  });
  const [perMillionInputs, setPerMillionInputs] = useState({
    inputPerMillion: "0.10",
    outputPerMillion: "0.40",
  });
  const [totalTokenCounts, setTotalTokenCounts] = useState({
    inputTokens: 0,
    outputTokens: 0,
  });
  const [manuallyEditedINR, setManuallyEditedINR] = useState({
    input: false,
    output: false,
  }); // Track if user manually edited INR fields
  const [originalPerMillionCosts, setOriginalPerMillionCosts] = useState({
    inputPerMillion: 0.1,
    outputPerMillion: 0.4,
  }); // Store original USD per million costs
  const [originalINRCosts, setOriginalINRCosts] = useState({
    inputCost: 0,
    outputCost: 0,
  }); // Store original INR costs for comparison
  const [savedCorrection, setSavedCorrection] = useState(null); // Store saved correction with time range info

  const fetchTokenData = async () => {
    // DEMO DATA DISABLED
    /*
    if (showDemoData) {
      // Add delay for demo mode to test loading skeleton
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Filter demo data based on current time range
      const filteredData = filterDemoDataByTimeRange(timeRange, customStartDate, customEndDate);
      setTokenData(filteredData);
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
      return;
    }
    */

    try {
      setLoading(true);
      setRefreshing(true);
      setApiError(null); // Clear previous errors
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

      // Format dates in local timezone to prevent date shifting (YYYY-MM-DD)
      const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      // Build URL with custom date range if selected
      let url = `${apiBaseUrl}/api/get-token-usage?email=${encodeURIComponent(
        user?.email,
      )}`;

      // Always send user's local today date to ensure timezone consistency in production
      const userToday = formatLocalDate(new Date());
      url += `&userToday=${userToday}`;

      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${formatLocalDate(
          customStartDate,
        )}&endDate=${formatLocalDate(customEndDate)}`;
      } else {
        url += `&timeRange=${timeRange}`;
      }

      console.log("[AdminDashboard] Fetching token data from:", url);

      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      const data = await response.json();
      console.log("[AdminDashboard] API Response:", {
        status: response.status,
        data,
      });

      if (response.ok && data.success) {
        setTokenData(data.data);
        setLastUpdated(new Date());
        setApiError(null);
      } else {
        // Log the error for debugging - API returned an error
        console.error(
          "[AdminDashboard] API Error:",
          data.message || "Unknown error",
        );
        setApiError(data.message || `API Error: ${response.status}`);
        // Still show empty data to indicate something is wrong
        setTokenData(null);
      }
    } catch (error) {
      console.error("[AdminDashboard] Network/Fetch error:", error);
      setApiError(`Network error: ${error.message}`);
      setTokenData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTokenData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, customStartDate, customEndDate]); // showDemoData removed - demo disabled

  // Fetch token costs when edit popup opens or filter changes
  // Logic: Show edited values UNLESS new usage was added after the last edit
  useEffect(() => {
    const fetchTokenCosts = async () => {
      if (showEditPopup) {
        if (!popupJustOpened) {
          setPopupJustOpened(true);
          // Reset manual edit flags when popup opens
          setManuallyEditedINR({ input: false, output: false });
        }

        try {
          // Fetch current exchange rate
          const exchangeRate = await getUsdToInrRate();
          setCurrentExchangeRate(exchangeRate);

          const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

          // Fetch custom pricing configuration
          const pricingResponse = await fetch(
            `${apiBaseUrl}/api/get-token-pricing?email=${encodeURIComponent(
              user?.email,
            )}&modelName=gemini-2.5-flash-lite`,
            {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
            },
          );

          if (pricingResponse.ok) {
            const pricingData = await pricingResponse.json();
            if (pricingData.success && pricingData.data) {
              const pricing = pricingData.data;
              setPerMillionCosts({
                inputPerMillion: pricing.inputPerMillion,
                outputPerMillion: pricing.outputPerMillion,
              });
              // Store original USD per million costs
              setOriginalPerMillionCosts({
                inputPerMillion: pricing.inputPerMillion,
                outputPerMillion: pricing.outputPerMillion,
              });
              setPerMillionInputs({
                inputPerMillion: pricing.inputPerMillion.toFixed(2),
                outputPerMillion: pricing.outputPerMillion.toFixed(2),
              });
              console.log("📊 Loaded pricing config:", pricing);
            }
          }

          // ALWAYS check for saved correction FIRST for this specific timeRange
          // Build params for get-token-correction with time range
          const correctionParams = new URLSearchParams({
            email: user?.email,
            timeRange: timeRange,
          });
          
          if (timeRange === "custom" && customStartDate && customEndDate) {
            correctionParams.append("startDate", formatLocalDate(customStartDate));
            correctionParams.append("endDate", formatLocalDate(customEndDate));
          }
          
          console.log(`🔍 Checking for saved correction (timeRange: ${timeRange})`);
          
          // Check if there's a saved correction in the database for this time range
          const correctionResponse = await fetch(
            `${apiBaseUrl}/api/get-token-correction?${correctionParams.toString()}`,
            {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
            },
          );

          let useSavedCorrection = false;
          if (correctionResponse.ok) {
            const correctionData = await correctionResponse.json();
            if (correctionData.success && correctionData.data) {
              const { inputCost, outputCost, correctionTimestamp } = correctionData.data;
              const { latestUsageTimestamp } = correctionData;

              // Use saved correction (always use it for this timeRange if it exists)
              console.log("✅ Found saved correction for timeRange:", timeRange);
              const costs = {
                inputCost: parseFloat(inputCost || 0),
                outputCost: parseFloat(outputCost || 0),
              };
              
              // Store total token counts for recalculation (from current dashboard if available)
              if (tokenData && tokenData.summary) {
                setTotalTokenCounts({
                  inputTokens: tokenData.summary.totalInputTokens || 0,
                  outputTokens: tokenData.summary.totalOutputTokens || 0,
                });
              }
              
              setTokenCosts(costs);
              setTokenCostInputs({
                inputCost: costs.inputCost === 0 ? "0" : costs.inputCost.toFixed(4),
                outputCost: costs.outputCost === 0 ? "0" : costs.outputCost.toFixed(4),
              });
              setOriginalTokenCosts(costs);
              setOriginalINRCosts({
                inputCost: costs.inputCost,
                outputCost: costs.outputCost,
              });
              useSavedCorrection = true;
              return; // Exit early - we found saved correction
            } else {
              console.log("⚠️ No saved correction found for timeRange:", timeRange);
            }
          } else {
            console.log("⚠️ Failed to fetch correction:", correctionResponse.status);
          }
          
          // No saved correction found - use dashboard summary data if available
          if (tokenData && tokenData.summary) {
            console.log("📊 Using current dashboard summary data (no saved correction)");
            const summaryData = tokenData.summary;
            const costs = {
              inputCost: parseFloat(summaryData.totalInputCost || 0),
              outputCost: parseFloat(summaryData.totalOutputCost || 0),
            };

            // Store total token counts for recalculation
            setTotalTokenCounts({
              inputTokens: summaryData.totalInputTokens || 0,
              outputTokens: summaryData.totalOutputTokens || 0,
            });

            setTokenCosts(costs);
            setTokenCostInputs({
              inputCost: costs.inputCost === 0 ? "0" : costs.inputCost.toFixed(4),
              outputCost: costs.outputCost === 0 ? "0" : costs.outputCost.toFixed(4),
            });
            setOriginalTokenCosts(costs);
            setOriginalINRCosts({
              inputCost: costs.inputCost,
              outputCost: costs.outputCost,
            });
            return; // Exit early - we have all we need
          }

          // No saved correction and no dashboard summary - fetch calculated totals
          console.log("📊 Fetching calculated totals from API");
          
          // Helper function for formatting dates
          const formatLocalDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
          };

          // Build URL with current filter settings
          let url = `${apiBaseUrl}/api/get-token-usage?email=${encodeURIComponent(
            user?.email,
          )}`;

          // Always send user's local today date
          const userToday = formatLocalDate(new Date());
          url += `&userToday=${userToday}`;

          // Use the currently selected time range or custom dates
          if (timeRange === "custom" && customStartDate && customEndDate) {
            url += `&startDate=${formatLocalDate(
              customStartDate,
            )}&endDate=${formatLocalDate(customEndDate)}`;
          } else {
            url += `&timeRange=${timeRange}`;
          }

          const response = await fetch(url, {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.summary) {
              const summaryData = data.data.summary;
              const costs = {
                inputCost: parseFloat(summaryData.totalInputCost || 0),
                outputCost: parseFloat(summaryData.totalOutputCost || 0),
              };

              // Store total token counts for recalculation
              setTotalTokenCounts({
                inputTokens: summaryData.totalInputTokens || 0,
                outputTokens: summaryData.totalOutputTokens || 0,
              });

              setTokenCosts(costs);
              setTokenCostInputs({
                inputCost:
                  costs.inputCost === 0 ? "0" : costs.inputCost.toFixed(4),
                outputCost:
                  costs.outputCost === 0 ? "0" : costs.outputCost.toFixed(4),
              });
              setOriginalTokenCosts(costs);
              // Store original INR costs for comparison
              setOriginalINRCosts({
                inputCost: costs.inputCost,
                outputCost: costs.outputCost,
              });
            }
          }
        } catch (error) {
          console.error("Error fetching token costs:", error);
        }
      } else if (!showEditPopup && popupJustOpened) {
        // Reset when popup closes
        setPopupJustOpened(false);
        setManuallyEditedINR({ input: false, output: false });
        const defaultCosts = { inputCost: 0, outputCost: 0 };
        setTokenCosts(defaultCosts);
        setTokenCostInputs({ inputCost: "0", outputCost: "0" });
        setOriginalTokenCosts(defaultCosts);
      }
    };

    fetchTokenCosts();
  }, [showEditPopup, user?.email, timeRange, customStartDate, customEndDate]);

  // Recalculate Input INR cost only
  const recalculateInputINRCost = (inputPerMillion, exchangeRate, force = false) => {
    if (!exchangeRate || exchangeRate <= 0) return;
    // Skip auto-recalculation if user manually edited INR (unless forced)
    if (manuallyEditedINR.input && !force) return;

    // Check if USD cost matches original - if so, restore original INR to avoid drift
    if (Math.abs(inputPerMillion - originalPerMillionCosts.inputPerMillion) < 0.00001) {
      setTokenCosts((prev) => ({
        ...prev,
        inputCost: originalINRCosts.inputCost,
      }));
      setTokenCostInputs((prev) => ({
        ...prev,
        inputCost: originalINRCosts.inputCost === 0 ? "0" : originalINRCosts.inputCost.toFixed(4),
      }));
      console.log("🔄 Restored original Input INR cost:", originalINRCosts.inputCost.toFixed(4));
      return;
    }

    // Calculate INR cost: (tokens / 1,000,000) × USD_per_million × exchange_rate
    const newInputCost =
      (totalTokenCounts.inputTokens / 1000000) * inputPerMillion * exchangeRate;

    setTokenCosts((prev) => ({
      ...prev,
      inputCost: newInputCost,
    }));

    setTokenCostInputs((prev) => ({
      ...prev,
      inputCost: newInputCost === 0 ? "0" : newInputCost.toFixed(4),
    }));

    console.log("🔄 Recalculated Input INR cost:", {
      inputTokens: totalTokenCounts.inputTokens,
      inputPerMillion,
      exchangeRate,
      newInputCost: newInputCost.toFixed(4),
    });
  };

  // Recalculate Output INR cost only
  const recalculateOutputINRCost = (outputPerMillion, exchangeRate, force = false) => {
    if (!exchangeRate || exchangeRate <= 0) return;
    // Skip auto-recalculation if user manually edited INR (unless forced)
    if (manuallyEditedINR.output && !force) return;

    // Check if USD cost matches original - if so, restore original INR to avoid drift
    if (Math.abs(outputPerMillion - originalPerMillionCosts.outputPerMillion) < 0.00001) {
      setTokenCosts((prev) => ({
        ...prev,
        outputCost: originalINRCosts.outputCost,
      }));
      setTokenCostInputs((prev) => ({
        ...prev,
        outputCost: originalINRCosts.outputCost === 0 ? "0" : originalINRCosts.outputCost.toFixed(4),
      }));
      console.log("🔄 Restored original Output INR cost:", originalINRCosts.outputCost.toFixed(4));
      return;
    }

    // Calculate INR cost: (tokens / 1,000,000) × USD_per_million × exchange_rate
    const newOutputCost =
      (totalTokenCounts.outputTokens / 1000000) * outputPerMillion * exchangeRate;

    setTokenCosts((prev) => ({
      ...prev,
      outputCost: newOutputCost,
    }));

    setTokenCostInputs((prev) => ({
      ...prev,
      outputCost: newOutputCost === 0 ? "0" : newOutputCost.toFixed(4),
    }));

    console.log("🔄 Recalculated Output INR cost:", {
      outputTokens: totalTokenCounts.outputTokens,
      outputPerMillion,
      exchangeRate,
      newOutputCost: newOutputCost.toFixed(4),
    });
  };

  // Save token correction
  const handleSaveTokenCorrection = async () => {
    setSavingCorrection(true);
    try {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      
      // Format dates for API
      const formatLocalDate = (date) => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const requestBody = {
        email: user?.email,
        originalInputCost: originalTokenCosts.inputCost,
        originalOutputCost: originalTokenCosts.outputCost,
        correctedInputCost: tokenCosts.inputCost,
        correctedOutputCost: tokenCosts.outputCost,
        inputPerMillion: perMillionCosts.inputPerMillion,
        outputPerMillion: perMillionCosts.outputPerMillion,
        timeRange: timeRange,
        startDate: timeRange === "custom" ? formatLocalDate(customStartDate) : null,
        endDate: timeRange === "custom" ? formatLocalDate(customEndDate) : null,
      };

      console.log("💾 Saving correction for time range:", timeRange);
      
      const response = await fetch(`${apiBaseUrl}/api/save-token-correction`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("✅ Token correction saved successfully:", data.data);

        // Clear ALL pricing caches so new pricing is fetched on next use
        clearUserPricingCache(user?.email);
        clearPricingCache(user?.email);
        console.log("🗑️ All pricing caches cleared");

        // Update the original costs to the newly saved values
        setOriginalTokenCosts({
          inputCost: tokenCosts.inputCost,
          outputCost: tokenCosts.outputCost,
        });

        // No longer need in-memory savedCorrection - data is in database per time range
        // Update the main view with the saved costs for current time range only
        if (tokenData?.summary) {
          setTokenData({
            ...tokenData,
            summary: {
              ...tokenData.summary,
              totalInputCost: tokenCosts.inputCost,
              totalOutputCost: tokenCosts.outputCost,
              totalCost: tokenCosts.inputCost + tokenCosts.outputCost,
            },
          });
        }

        setShowSuccessMessage(true);
        setTimeout(() => {
          setShowSuccessMessage(false);
          setShowEditPopup(false);
        }, 1500);
      } else {
        // Handle error response
        console.error("Failed to save token correction:", data);
        alert(
          `Failed to save token costs: ${data.message || "Unknown error"}. Please try again.`,
        );
      }
    } catch (error) {
      console.error("Error saving token correction:", error);
      alert(
        "Network error while saving token costs. Please check your connection and try again.",
      );
    } finally {
      setSavingCorrection(false);
    }
  };

  // Android back button handler
  useEffect(() => {
    let backButtonListener;

    const setupBackButton = async () => {
      try {
        backButtonListener = await CapacitorApp.addListener(
          "backButton",
          ({ canGoBack }) => {
            // Close this modal and go back to main page
            onClose();
          },
        );
      } catch (error) {
        console.log("Back button handler not available:", error);
      }
    };

    setupBackButton();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [onClose]);

  const handleDateRangeSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setTimeRange("custom");
    setShowDatePicker(false);
  };

  const getDateRangeLabel = () => {
    if (timeRange === "custom" && customStartDate && customEndDate) {
      return `${customStartDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${customEndDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;
    }
    return "Custom Range";
  };

  const formatCurrency = (val) => `₹${Number(val).toFixed(4)}`;
  const formatNumber = (val) => Number(val).toLocaleString();
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  };

  const summary = tokenData?.summary || {};
  const userSpending = tokenData?.userSpending || [];

  // Sorting handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Filter and sort users
  const filteredAndSortedUsers = userSpending
    .filter((user) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        user.userName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle string sorting (userName, email)
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredAndSortedUsers.slice(startIndex, endIndex);

  // Reset to page 1 when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection]);

  // Sort indicator component
  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-green-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-green-600" />
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between">
          <TouchFeedbackButton
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700"
            ariaLabel="Go back"
          >
            <ChevronLeft className="w-6 h-6" />
          </TouchFeedbackButton>

          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-gray-800">AI Monitor</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Track token usage and spending
            </p>
          </div>


          <div className="flex items-center gap-1">
            <TouchFeedbackButton
              onClick={() => setShowEditPopup(true)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
              ariaLabel="Edit token pricing"
            >
              <Edit3 className="w-5 h-5" />
            </TouchFeedbackButton>
            {showSuccessMessage && (
              <div className="text-green-600 text-sm mr-2">Saved!</div>
            )}
            <TouchFeedbackButton
              onClick={fetchTokenData}
              className={`p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors ${
                refreshing ? "animate-spin text-green-600" : "text-gray-500"
              }`}
              ariaLabel="Refresh data"
            >
              <RefreshCw className="w-5 h-5" />
            </TouchFeedbackButton>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6 pb-20">
        {/* Date Range Filter */}
        <div 
          className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide" 
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {["today", "yesterday", "week", "month", "all"].map((range) => (
            <TouchFeedbackButton
              key={range}
              onClick={() => {
                setTimeRange(range);
                setCustomStartDate(null);
                setCustomEndDate(null);
                setShowDatePicker(false);
              }}
              className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 min-w-fit ${
                timeRange === range
                  ? "bg-green-600 text-white shadow-md shadow-green-200"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
              ariaLabel={`Filter by ${range}`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </TouchFeedbackButton>
          ))}
          <TouchFeedbackButton
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 min-w-fit ${
              timeRange === "custom"
                ? "bg-green-600 text-white shadow-md shadow-green-200"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
            ariaLabel="Custom date range"
          >
            <CalendarIcon className="w-4 h-4 flex-shrink-0" />
            <span>
              {timeRange === "custom" ? getDateRangeLabel() : "Custom"}
            </span>
          </TouchFeedbackButton>
        </div>

        {/* Date Range Picker */}
        <AnimatePresence>
          {showDatePicker && (
            <DateRangePicker
              startDate={customStartDate}
              endDate={customEndDate}
              onSelect={handleDateRangeSelect}
              onClose={() => setShowDatePicker(false)}
            />
          )}
        </AnimatePresence>

        {loading ? (
          <>
            {/* Skeleton for Stats Box */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="h-4 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className="h-6 sm:h-8 bg-gray-200 rounded w-16 sm:w-20 mx-auto mb-1 animate-pulse"></div>
                  <div className="flex items-center justify-center space-x-1">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-14 animate-pulse"></div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="h-6 sm:h-8 bg-gray-200 rounded w-16 sm:w-20 mx-auto mb-1 animate-pulse"></div>
                  <div className="flex items-center justify-center space-x-1">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="h-6 sm:h-8 bg-gray-200 rounded w-16 sm:w-20 mx-auto mb-1 animate-pulse"></div>
                  <div className="flex items-center justify-center space-x-1">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-14 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Skeleton for Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-14 animate-pulse"></div>
                </div>
                <div className="h-10 bg-gray-100 rounded-lg animate-pulse"></div>
              </div>
              <div className="divide-y divide-gray-50">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div
                    key={i}
                    className="px-6 py-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-28 mb-2 animate-pulse"></div>
                      <div className="h-3 bg-gray-100 rounded w-40 animate-pulse"></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
                      <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
                      <div className="h-4 bg-gray-200 rounded w-10 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <div className="h-3 bg-gray-100 rounded w-20 animate-pulse"></div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-gray-100 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
                  <div className="h-8 w-8 bg-gray-100 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Error Alert */}
            {apiError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4"
              >
                <p className="text-red-700 font-medium text-sm">
                  Failed to load data
                </p>
                <p className="text-red-600 text-xs mt-1">{apiError}</p>
              </motion.div>
            )}

            {/* Stats Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <h2 className="text-sm font-medium text-gray-500 mb-4 uppercase tracking-wider">
                Usage Summary
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-gray-800 mb-1">
                    {formatCurrency(summary.totalCost || 0)}
                  </p>
                  <div className="flex items-center justify-center space-x-1">
                    <IndianRupee className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      Total Cost
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-gray-800 mb-1">
                    {formatCurrency(summary.totalInputCost || 0)}
                  </p>
                  <div className="flex items-center justify-center space-x-1">
                    <IndianRupee className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      Input Cost
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-gray-800 mb-1">
                    {formatCurrency(summary.totalOutputCost || 0)}
                  </p>
                  <div className="flex items-center justify-center space-x-1">
                    <IndianRupee className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" />
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      Output Cost
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* User Spending Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    User Spending
                  </h2>
                  <span className="text-xs text-gray-400">
                    {filteredAndSortedUsers.length} users
                  </span>
                </div>
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                {filteredAndSortedUsers.length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th
                          onClick={() => handleSort("userName")}
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                        >
                          <div className="flex items-center space-x-1">
                            <span>User</span>
                            <SortIcon field="userName" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort("totalCost")}
                          className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                        >
                          <div className="flex items-center justify-end space-x-1">
                            <span>Cost</span>
                            <SortIcon field="totalCost" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort("totalTokens")}
                          className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                        >
                          <div className="flex items-center justify-end space-x-1">
                            <span>Total Tokens</span>
                            <SortIcon field="totalTokens" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort("inputTokens")}
                          className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                        >
                          <div className="flex items-center justify-end space-x-1">
                            <span>Input Tokens</span>
                            <SortIcon field="inputTokens" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort("outputTokens")}
                          className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                        >
                          <div className="flex items-center justify-end space-x-1">
                            <span>Output Tokens</span>
                            <SortIcon field="outputTokens" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedUsers.map((user, index) => (
                        <tr
                          key={user.userId || index}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {user.userName}
                              </p>
                              <p className="text-xs text-gray-400 truncate max-w-[180px]">
                                {user.email}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-sm font-bold text-green-600">
                              {formatCurrency(user.totalCost)}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-sm font-medium text-gray-800">
                              {formatNumber(user.totalTokens)}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-sm font-medium text-gray-800">
                              {formatNumber(user.inputTokens || 0)}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-sm font-medium text-gray-800">
                              {formatNumber(user.outputTokens || 0)}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-6 text-center text-sm">
                    {apiError ? (
                      <div className="text-red-500">
                        <p className="font-medium">Error loading data</p>
                        <p className="text-xs mt-1">{apiError}</p>
                      </div>
                    ) : searchQuery ? (
                      <span className="text-gray-400">{`No users found matching "${searchQuery}"`}</span>
                    ) : (
                      <span className="text-gray-400">
                        No user spending data
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredAndSortedUsers.length > 0 && (
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50/30 overflow-visible">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 overflow-visible">
                    {/* Page navigation - Left side */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                      <button
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                      </button>

                      {/* Page numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((page) => {
                            // Show first page, last page, current page, and adjacent pages
                            return (
                              page === 1 ||
                              page === totalPages ||
                              (page >= currentPage - 1 &&
                                page <= currentPage + 1)
                            );
                          })
                          .map((page, index, array) => (
                            <React.Fragment key={page}>
                              {/* Show ellipsis if there's a gap */}
                              {index > 0 && array[index - 1] !== page - 1 && (
                                <span className="px-1.5 text-gray-400 text-sm select-none">
                                  •••
                                </span>
                              )}
                              <button
                                onClick={() => setCurrentPage(page)}
                                className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-all ${
                                  currentPage === page
                                    ? "bg-green-600 text-white shadow-sm"
                                    : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
                                }`}
                                aria-label={`Page ${page}`}
                                aria-current={
                                  currentPage === page ? "page" : undefined
                                }
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          ))}
                      </div>

                      <button
                        onClick={() =>
                          setCurrentPage(Math.min(totalPages, currentPage + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                        aria-label="Next page"
                      >
                        <ChevronRight className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>

                    {/* Items per page selector - Right side */}
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end overflow-visible">
                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        {startIndex + 1}-
                        {Math.min(endIndex, filteredAndSortedUsers.length)} of{" "}
                        {filteredAndSortedUsers.length}
                      </span>
                      <span className="text-gray-400">|</span>
                      <div className="flex items-center gap-2 overflow-visible">
                        <label className="text-sm text-gray-600 whitespace-nowrap">
                          Show:
                        </label>
                        <div className="relative overflow-visible">
                          <button
                            type="button"
                            onClick={() =>
                              setShowItemsDropdown(!showItemsDropdown)
                            }
                            className="text-sm border-2 border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 cursor-pointer flex items-center gap-2 min-w-[70px] justify-between hover:border-gray-400 transition-colors"
                          >
                            <span className="font-medium">{itemsPerPage}</span>
                            <ChevronDown
                              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                                showItemsDropdown ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {/* Dropdown Options */}
                          {showItemsDropdown && (
                            <div
                              className="fixed inset-0 z-[999]"
                              onClick={() => setShowItemsDropdown(false)}
                            >
                              <div
                                className="absolute bg-white border-2 border-gray-200 rounded-lg shadow-2xl min-w-[100px] overflow-hidden"
                                style={{
                                  top: "auto",
                                  bottom: "60px",
                                  right: "16px",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {[5, 10, 20, 50].map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => {
                                      setItemsPerPage(value);
                                      setCurrentPage(1);
                                      setShowItemsDropdown(false);
                                    }}
                                    className={`w-full px-4 py-3 text-sm text-left transition-all flex items-center justify-between border-b border-gray-100 last:border-b-0 ${
                                      itemsPerPage === value
                                        ? "bg-green-500 text-white font-bold"
                                        : "text-gray-700 hover:bg-green-50 active:bg-green-100"
                                    }`}
                                  >
                                    <span>{value}</span>
                                    {itemsPerPage === value && (
                                      <Check
                                        className="w-5 h-5"
                                        strokeWidth={3}
                                      />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}

        {lastUpdated && (
          <div className="text-center text-xs text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Edit Token Cost Popup */}
      <AnimatePresence>
        {showEditPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Token Cost Summary
                  </h2>
                  {currentExchangeRate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Current Rate: $1 USD = ₹{currentExchangeRate.toFixed(2)}{" "}
                      INR
                    </p>
                  )}
                </div>
                <TouchFeedbackButton
                  onClick={() => setShowEditPopup(false)}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                  ariaLabel="Close modal"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </TouchFeedbackButton>
              </div>

              {/* Success Message */}
              <AnimatePresence>
                {showSuccessMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 p-4 bg-green-500 text-white rounded-lg flex items-center gap-3"
                  >
                    <Check className="w-5 h-5" />
                    <span className="font-medium">
                      Token costs saved successfully!
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                {/* Per Million Token Costs */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Input Token Cost (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-sm text-gray-400">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={perMillionInputs.inputPerMillion}
                        onChange={(e) => {
                          const val = e.target.value;
                          const numVal = parseFloat(val) || 0;
                          setPerMillionInputs((prev) => ({
                            ...prev,
                            inputPerMillion: val,
                          }));
                          setPerMillionCosts((prev) => ({
                            ...prev,
                            inputPerMillion: numVal,
                          }));
                          // Recalculate only Input INR cost
                          recalculateInputINRCost(numVal, currentExchangeRate);
                        }}
                        className="w-full pl-6 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0.10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Output Token Cost (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-sm text-gray-400">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={perMillionInputs.outputPerMillion}
                        onChange={(e) => {
                          const val = e.target.value;
                          const numVal = parseFloat(val) || 0;
                          setPerMillionInputs((prev) => ({
                            ...prev,
                            outputPerMillion: val,
                          }));
                          setPerMillionCosts((prev) => ({
                            ...prev,
                            outputPerMillion: numVal,
                          }));
                          // Recalculate only Output INR cost
                          recalculateOutputINRCost(numVal, currentExchangeRate);
                        }}
                        className="w-full pl-6 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0.40"
                      />
                    </div>
                  </div>
                </div>

                {/* Total Costs in INR */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Total Input Cost (INR)
                    </label>
                    {manuallyEditedINR.input && (
                      <button
                        type="button"
                        onClick={() => {
                          setManuallyEditedINR((prev) => ({ ...prev, input: false }));
                          recalculateInputINRCost(
                            perMillionCosts.inputPerMillion,
                            currentExchangeRate,
                            true // force recalculation
                          );
                        }}
                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reset to calculated
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={tokenCostInputs.inputCost}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTokenCostInputs((prev) => ({
                          ...prev,
                          inputCost: val,
                        }));
                        setTokenCosts((prev) => ({
                          ...prev,
                          inputCost: parseFloat(val) || 0,
                        }));
                        // Mark as manually edited
                        setManuallyEditedINR((prev) => ({
                          ...prev,
                          input: true,
                        }));
                      }}
                      className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-medium ${
                        manuallyEditedINR.input
                          ? "border-orange-300 bg-orange-50"
                          : "border-gray-200"
                      }`}
                      placeholder="0.001"
                    />
                  </div>
                  {manuallyEditedINR.input && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ Manual value - won't auto-update from USD changes
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Total Output Cost (INR)
                    </label>
                    {manuallyEditedINR.output && (
                      <button
                        type="button"
                        onClick={() => {
                          setManuallyEditedINR((prev) => ({ ...prev, output: false }));
                          recalculateOutputINRCost(
                            perMillionCosts.outputPerMillion,
                            currentExchangeRate,
                            true // force recalculation
                          );
                        }}
                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reset to calculated
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={tokenCostInputs.outputCost}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTokenCostInputs((prev) => ({
                          ...prev,
                          outputCost: val,
                        }));
                        setTokenCosts((prev) => ({
                          ...prev,
                          outputCost: parseFloat(val) || 0,
                        }));
                        // Mark as manually edited
                        setManuallyEditedINR((prev) => ({
                          ...prev,
                          output: true,
                        }));
                      }}
                      className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-medium ${
                        manuallyEditedINR.output
                          ? "border-orange-300 bg-orange-50"
                          : "border-gray-200"
                      }`}
                      placeholder="0.004"
                    />
                  </div>
                  {manuallyEditedINR.output && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ Manual value - won't auto-update from USD changes
                    </p>
                  )}
                </div>
              </div>

              {!savingCorrection ? (
                <div className="flex gap-3 mt-6">
                  <TouchFeedbackButton
                    onClick={() => setShowEditPopup(false)}
                    className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    ariaLabel="Close without saving"
                  >
                    Close
                  </TouchFeedbackButton>
                  <TouchFeedbackButton
                    onClick={handleSaveTokenCorrection}
                    className="flex-1 px-4 py-3 text-white rounded-xl transition-colors font-medium bg-green-600 hover:bg-green-700"
                    ariaLabel="Save token costs"
                  >
                    Save
                  </TouchFeedbackButton>
                </div>
              ) : (
                <div className="flex justify-center mt-6">
                  <div className="flex items-center gap-2 text-gray-500">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Saving...</span>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
