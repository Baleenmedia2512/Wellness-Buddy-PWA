import React, { useState, useEffect, useRef } from "react";
import {
  X,
  DollarSign,
  IndianRupee,
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
import { getUsdToInrRate } from "../../../shared/services/tokenCost/tokenCostConfig";
import { clearUserPricingCache } from "../../../shared/services/tokenCost/userPricingManager";
import { clearPricingCache } from "../../../shared/services/tokenCost/tokenCostConfig";
import { App as CapacitorApp } from "@capacitor/app";
import TouchFeedbackButton from "../../../shared/components/TouchFeedbackButton";
import { istToLocalDate, formatISTToLocalDate } from "../../../utils/timezoneUtils";

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

    // Prevent selecting future dates.
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
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [summaryTab, setSummaryTab] = useState("cost"); // 'cost' | 'tokens'
  const summarySwipeStartX = useRef(null);
  const summaryCardRef = useRef(null);

  useEffect(() => {
    const el = summaryCardRef.current;
    if (!el) return;
    const onStart = (e) => {
      summarySwipeStartX.current = e.touches[0].clientX;
    };
    const onMove = (e) => {
      if (summarySwipeStartX.current == null) return;
      const dx = Math.abs(summarySwipeStartX.current - e.touches[0].clientX);
      const dy = Math.abs(e.touches[0].clientY - e.touches[0].clientY); // always 0, just prevent horizontal scroll
      if (dx > 5) e.preventDefault(); // stop page scroll on horizontal swipe
    };
    const onEnd = (e) => {
      if (summarySwipeStartX.current == null) return;
      const diff = summarySwipeStartX.current - e.changedTouches[0].clientX;
      summarySwipeStartX.current = null;
      if (Math.abs(diff) > 40) {
        setSummaryTab((prev) => (diff > 0 ? "tokens" : "cost"));
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [loading]);
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
    inputPerMillion: null,
    outputPerMillion: null,
  });
  const [perMillionInputs, setPerMillionInputs] = useState({
    inputPerMillion: "",
    outputPerMillion: "",
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
    inputPerMillion: null,
    outputPerMillion: null,
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
      let url = `${apiBaseUrl}/api/token/usage?email=${encodeURIComponent(
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

  // Fetch pricing configuration from database on component mount
  useEffect(() => {
    const fetchPricingFromDB = async () => {
      try {
        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
        const pricingResponse = await fetch(
          `${apiBaseUrl}/api/token/pricing?email=${encodeURIComponent(
            user?.email,
          )}&modelName=gemini-2.5-flash-lite&t=${Date.now()}`,
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
            setOriginalPerMillionCosts({
              inputPerMillion: pricing.inputPerMillion,
              outputPerMillion: pricing.outputPerMillion,
            });
            setPerMillionInputs({
              inputPerMillion: pricing.inputPerMillion.toFixed(2),
              outputPerMillion: pricing.outputPerMillion.toFixed(2),
            });
            console.log("ðŸ“Š Loaded pricing from DB on mount:", pricing);
          }
        } else {
          console.warn("âš ï¸ Failed to fetch pricing from DB");
        }
      } catch (error) {
        console.error("âŒ Error fetching pricing from DB:", error);
      }
    };

    if (user?.email) {
      fetchPricingFromDB();
    }
  }, [user?.email]); // Fetch once on mount when user email is available

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
            `${apiBaseUrl}/api/token/pricing?email=${encodeURIComponent(
              user?.email,
            )}&modelName=gemini-2.5-flash-lite&t=${Date.now()}`,
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
              console.log("ðŸ“Š Loaded pricing config:", pricing);
            }
          }

          // ALWAYS check for saved correction FIRST for this specific timeRange
          // Build params for get-token-correction with time range
          const correctionParams = new URLSearchParams({
            email: user?.email,
            timeRange: timeRange,
          });

          if (timeRange === "custom" && customStartDate && customEndDate) {
            correctionParams.append(
              "startDate",
              formatLocalDate(customStartDate),
            );
            correctionParams.append("endDate", formatLocalDate(customEndDate));
          }

          console.log(
            `ðŸ” Checking for saved correction (timeRange: ${timeRange})`,
          );

          // Check if there's a saved correction in the database for this time range
          const correctionResponse = await fetch(
            `${apiBaseUrl}/api/token/correction?${correctionParams.toString()}`,
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
              const { inputCost, outputCost, correctionTimestamp } =
                correctionData.data;
              const { latestUsageTimestamp } = correctionData;

              // Use saved correction (always use it for this timeRange if it exists)
              console.log(
                "âœ… Found saved correction for timeRange:",
                timeRange,
              );
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
                inputCost:
                  costs.inputCost === 0 ? "0" : costs.inputCost.toFixed(4),
                outputCost:
                  costs.outputCost === 0 ? "0" : costs.outputCost.toFixed(4),
              });
              setOriginalTokenCosts(costs);
              setOriginalINRCosts({
                inputCost: costs.inputCost,
                outputCost: costs.outputCost,
              });
              useSavedCorrection = true;
              return; // Exit early - we found saved correction
            } else {
              console.log(
                "âš ï¸ No saved correction found for timeRange:",
                timeRange,
              );
            }
          } else {
            console.log(
              "âš ï¸ Failed to fetch correction:",
              correctionResponse.status,
            );
          }

          // No saved correction found - use dashboard summary data if available
          if (tokenData && tokenData.summary) {
            console.log(
              "ðŸ“Š Using current dashboard summary data (no saved correction)",
            );
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
              inputCost:
                costs.inputCost === 0 ? "0" : costs.inputCost.toFixed(4),
              outputCost:
                costs.outputCost === 0 ? "0" : costs.outputCost.toFixed(4),
            });
            setOriginalTokenCosts(costs);
            setOriginalINRCosts({
              inputCost: costs.inputCost,
              outputCost: costs.outputCost,
            });
            return; // Exit early - we have all we need
          }

          // No saved correction and no dashboard summary - fetch calculated totals
          console.log("ðŸ“Š Fetching calculated totals from API");

          // Helper function for formatting dates
          const formatLocalDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
          };

          // Build URL with current filter settings
          let url = `${apiBaseUrl}/api/token/usage?email=${encodeURIComponent(
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
  const recalculateInputINRCost = (
    inputPerMillion,
    exchangeRate,
    force = false,
  ) => {
    if (!exchangeRate || exchangeRate <= 0) return;
    // Skip auto-recalculation if user manually edited INR (unless forced)
    if (manuallyEditedINR.input && !force) return;

    // Check if USD cost matches original - if so, restore original INR to avoid drift
    if (
      Math.abs(inputPerMillion - originalPerMillionCosts.inputPerMillion) <
      0.00001
    ) {
      setTokenCosts((prev) => ({
        ...prev,
        inputCost: originalINRCosts.inputCost,
      }));
      setTokenCostInputs((prev) => ({
        ...prev,
        inputCost:
          originalINRCosts.inputCost === 0
            ? "0"
            : originalINRCosts.inputCost.toFixed(4),
      }));
      console.log(
        "ðŸ”„ Restored original Input INR cost:",
        originalINRCosts.inputCost.toFixed(4),
      );
      return;
    }

    // Calculate INR cost: (tokens / 1,000,000) Ã— USD_per_million Ã— exchange_rate
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

    console.log("ðŸ”„ Recalculated Input INR cost:", {
      inputTokens: totalTokenCounts.inputTokens,
      inputPerMillion,
      exchangeRate,
      newInputCost: newInputCost.toFixed(4),
    });
  };

  // Recalculate Output INR cost only
  const recalculateOutputINRCost = (
    outputPerMillion,
    exchangeRate,
    force = false,
  ) => {
    if (!exchangeRate || exchangeRate <= 0) return;
    // Skip auto-recalculation if user manually edited INR (unless forced)
    if (manuallyEditedINR.output && !force) return;

    // Check if USD cost matches original - if so, restore original INR to avoid drift
    if (
      Math.abs(outputPerMillion - originalPerMillionCosts.outputPerMillion) <
      0.00001
    ) {
      setTokenCosts((prev) => ({
        ...prev,
        outputCost: originalINRCosts.outputCost,
      }));
      setTokenCostInputs((prev) => ({
        ...prev,
        outputCost:
          originalINRCosts.outputCost === 0
            ? "0"
            : originalINRCosts.outputCost.toFixed(4),
      }));
      console.log(
        "ðŸ”„ Restored original Output INR cost:",
        originalINRCosts.outputCost.toFixed(4),
      );
      return;
    }

    // Calculate INR cost: (tokens / 1,000,000) Ã— USD_per_million Ã— exchange_rate
    const newOutputCost =
      (totalTokenCounts.outputTokens / 1000000) *
      outputPerMillion *
      exchangeRate;

    setTokenCosts((prev) => ({
      ...prev,
      outputCost: newOutputCost,
    }));

    setTokenCostInputs((prev) => ({
      ...prev,
      outputCost: newOutputCost === 0 ? "0" : newOutputCost.toFixed(4),
    }));

    console.log("ðŸ”„ Recalculated Output INR cost:", {
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
        startDate:
          timeRange === "custom" ? formatLocalDate(customStartDate) : null,
        endDate: timeRange === "custom" ? formatLocalDate(customEndDate) : null,
      };

      console.log("ðŸ’¾ Saving correction for time range:", timeRange);

      const response = await fetch(`${apiBaseUrl}/api/token/correction`, {
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
        console.log("âœ… Token correction saved successfully:", data.data);

        // Clear ALL pricing caches so new pricing is fetched on next use
        clearUserPricingCache(user?.email);
        clearPricingCache(user?.email);
        console.log("ðŸ—‘ï¸ All pricing caches cleared");

        // Refetch pricing configuration from database to confirm it was saved
        try {
          const pricingResponse = await fetch(
            `${apiBaseUrl}/api/token/pricing?email=${encodeURIComponent(
              user?.email,
            )}&modelName=gemini-2.5-flash-lite&t=${Date.now()}`,
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
              setOriginalPerMillionCosts({
                inputPerMillion: pricing.inputPerMillion,
                outputPerMillion: pricing.outputPerMillion,
              });
              setPerMillionInputs({
                inputPerMillion: pricing.inputPerMillion.toFixed(2),
                outputPerMillion: pricing.outputPerMillion.toFixed(2),
              });
              console.log("âœ… Pricing reloaded from DB after save:", pricing);
            }
          }
        } catch (pricingError) {
          console.error("âš ï¸ Error reloading pricing after save:", pricingError);
        }

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
          `Failed to save token costs: ${
            data.message || "Unknown error"
          }. Please try again.`,
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

  const formatCurrency = (val) => `â‚¹${Number(val).toFixed(4)}`;
  const formatNumber = (val) => Number(val).toLocaleString();
  const formatDate = (dateString) => {
    return formatISTToLocalDate(dateString, { month: "short", day: "numeric" });
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
    <div className="fixed inset-0 z-50 bg-green-50 overflow-y-auto">
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-4"
        style={{
          backgroundColor: "#a8dbb5",
          borderBottom: "1px solid #93c9a1",
        }}
      >
        <div className="flex items-center justify-between">
          <TouchFeedbackButton
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700"
            ariaLabel="Go back"
          >
            <ChevronLeft className="w-6 h-6" />
          </TouchFeedbackButton>

          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-gray-800">
              AI Token Monitor
            </h1>
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
            WebkitOverflowScrolling: "touch",
            scrollBehavior: "smooth",
            overscrollBehaviorX: "contain",
          }}
        >
          {["today", "yesterday", "week", "month", "all"].map((range) => {
            const labels = {
              today: "Today",
              yesterday: "Yesterday",
              week: "Last 7 Days",
              month: "Last 30 Days",
              all: "All",
            };

            return (
              <TouchFeedbackButton
                key={range}
                onClick={() => {
                  setTimeRange(range);
                  setCustomStartDate(null);
                  setCustomEndDate(null);
                  setShowDatePicker(false);
                }}
                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 min-w-fit focus:outline-none focus:ring-0 cursor-pointer ${
                  timeRange === range
                    ? "bg-green-600 text-white shadow-md shadow-green-200"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
                ariaLabel={`Filter by ${range}`}
              >
                {labels[range]}
              </TouchFeedbackButton>
            );
          })}
          <TouchFeedbackButton
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 min-w-fit focus:outline-none focus:ring-0 cursor-pointer ${
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

            {/* Skeleton for Tiles */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-14 animate-pulse"></div>
                </div>
                <div className="flex gap-2">
                  <div className="h-10 bg-gray-100 rounded-lg animate-pulse flex-1"></div>
                  <div className="h-10 w-20 bg-gray-100 rounded-lg animate-pulse"></div>
                </div>
              </div>
              <div className="space-y-3 p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
                          <div className="h-3 bg-gray-100 rounded w-48 mb-1 animate-pulse"></div>
                          <div className="h-3 bg-gray-100 rounded w-24 animate-pulse"></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="h-6 bg-gray-200 rounded w-16 mb-1 animate-pulse"></div>
                          <div className="h-3 bg-gray-100 rounded w-12 animate-pulse"></div>
                        </div>
                        <div className="h-5 w-5 bg-gray-100 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50/30">
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-100 rounded w-20 animate-pulse"></div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
                    <div className="h-8 w-8 bg-gray-100 rounded animate-pulse"></div>
                  </div>
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
            <div
              ref={summaryCardRef}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              style={{ touchAction: "pan-y", userSelect: "none" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  {summaryTab === "cost" ? "Usage Summary" : "Token Usage"}
                </h2>
              </div>

              <AnimatePresence mode="wait">
                {summaryTab === "cost" ? (
                  <motion.div
                    key="cost"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-3 gap-2"
                  >
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
                  </motion.div>
                ) : (
                  <motion.div
                    key="tokens"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-3 gap-2"
                  >
                    <div className="text-center">
                      <p className="text-lg sm:text-2xl font-bold text-gray-800 mb-1">
                        {formatNumber(summary.totalTokens || 0)}
                      </p>
                      <div className="flex items-center justify-center space-x-1">
                        <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          Total Tokens
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-2xl font-bold text-gray-800 mb-1">
                        {formatNumber(summary.totalInputTokens || 0)}
                      </p>
                      <div className="flex items-center justify-center space-x-1">
                        <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          Input Tokens
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-2xl font-bold text-gray-800 mb-1">
                        {formatNumber(summary.totalOutputTokens || 0)}
                      </p>
                      <div className="flex items-center justify-center space-x-1">
                        <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" />
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          Output Tokens
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dots indicator - centered at bottom */}
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <button
                  onClick={() => setSummaryTab("cost")}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    summaryTab === "cost"
                      ? "bg-green-500 w-4"
                      : "bg-gray-300 w-2"
                  }`}
                />
                <button
                  onClick={() => setSummaryTab("tokens")}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    summaryTab === "tokens"
                      ? "bg-green-500 w-4"
                      : "bg-gray-300 w-2"
                  }`}
                />
              </div>
            </div>

            {/* User Spending Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="px-4 sm:px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    User Spending
                  </h2>
                  <span className="text-xs text-gray-400">
                    {filteredAndSortedUsers.length} users
                  </span>
                </div>
                {/* Search Bar and Sort */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
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
                  {/* Sort Button */}
                  <TouchFeedbackButton
                    onClick={() => handleSort(sortField)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors flex-shrink-0"
                    ariaLabel="Toggle sort direction"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    {sortDirection === "asc" ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                  </TouchFeedbackButton>
                </div>
              </div>
              <div className="space-y-3 p-4">
                {filteredAndSortedUsers.length > 0 ? (
                  <AnimatePresence>
                    {paginatedUsers.map((user, index) => (
                      <motion.div
                        key={user.userId || index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        layout
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* User Card Content */}
                        <div
                          onClick={() =>
                            setExpandedUserId(
                              expandedUserId === user.userId
                                ? null
                                : user.userId,
                            )
                          }
                          className="p-3 sm:p-4 flex items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors"
                        >
                          {/* Avatar */}
                          <div className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold border-2 bg-gradient-to-br from-green-50 to-green-100 border-green-200 text-green-700">
                            {(user.userName || "U").charAt(0).toUpperCase()}
                          </div>

                          {/* Name + email + tokens */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-sm sm:text-[15px] leading-tight break-words">
                              {user.userName}
                            </h3>
                            <p className="text-[10px] sm:text-xs text-gray-400 truncate mt-0.5">
                              {user.email}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-400 font-medium mt-0.5">
                              {formatNumber(user.totalTokens)} tokens
                            </p>
                          </div>

                          {/* Cost + chevron */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-base sm:text-lg font-bold text-green-600 leading-tight">
                                {formatCurrency(user.totalCost)}
                              </div>
                              <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider text-right">
                                Cost
                              </div>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 text-gray-300 transition-transform flex-shrink-0 ${
                                expandedUserId === user.userId
                                  ? "rotate-180"
                                  : ""
                              }`}
                            />
                          </div>
                        </div>
                        {/* Expanded Token Details */}
                        <AnimatePresence>
                          {expandedUserId === user.userId && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-gray-50 bg-gray-50/30"
                            >
                              <div className="p-4">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                  Token Breakdown
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                  {/* Input Tokens */}
                                  <div className="flex flex-col items-center p-3 rounded-lg bg-white border border-blue-100">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border bg-blue-50 border-blue-200 text-blue-700 mb-2">
                                      <ArrowDown className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                                      Input
                                    </span>
                                    <span className="text-sm font-bold text-gray-800 mt-1">
                                      {formatNumber(user.inputTokens || 0)}
                                    </span>
                                    <span className="text-xs text-blue-600 font-semibold mt-0.5">
                                      {formatCurrency(user.inputCost || 0)}
                                    </span>
                                  </div>
                                  {/* Output Tokens */}
                                  <div className="flex flex-col items-center p-3 rounded-lg bg-white border border-purple-100">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border bg-purple-50 border-purple-200 text-purple-700 mb-2">
                                      <ArrowUp className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                                      Output
                                    </span>
                                    <span className="text-sm font-bold text-gray-800 mt-1">
                                      {formatNumber(user.outputTokens || 0)}
                                    </span>
                                    <span className="text-xs text-purple-600 font-semibold mt-0.5">
                                      {formatCurrency(user.outputCost || 0)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="px-4 pb-4 pt-0 text-center">
                                <p className="text-[11px] sm:text-xs text-gray-400 font-medium">
                                  Total: {formatNumber(user.totalTokens)} tokens
                                  â€¢ {formatCurrency(user.totalCost)}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                ) : (
                  <div className="p-6 text-center text-sm">
                    {apiError ? (
                      <div className="text-red-500">
                        <p className="font-medium">Error loading data</p>
                        <p className="text-xs mt-1">{apiError}</p>
                      </div>
                    ) : searchQuery ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Search className="h-8 w-8 text-gray-300" />
                        </div>
                        <h3 className="text-gray-900 font-medium">
                          No users found
                        </h3>
                        <p className="text-gray-500 text-sm mt-1">
                          No users found matching "{searchQuery}"
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Activity className="h-8 w-8 text-gray-300" />
                        </div>
                        <h3 className="text-gray-900 font-medium">
                          No data available
                        </h3>
                        <p className="text-gray-500 text-sm mt-1">
                          No user spending data for this period
                        </p>
                      </div>
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
                                  â€¢â€¢â€¢
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
                      Current Rate: $1 USD = â‚¹{currentExchangeRate.toFixed(2)}{" "}
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

                {/* Total Costs in INR - COMMENTED OUT */}
                {/* 
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
                      âš ï¸ Manual value - won't auto-update from USD changes
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
                      âš ï¸ Manual value - won't auto-update from USD changes
                    </p>
                  )}
                </div>
                */}
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
