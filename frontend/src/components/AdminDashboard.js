import React, { useState, useEffect } from 'react';
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
  ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Dynamic Demo Data Generator ---
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
      totalCost: Number(totalCost.toFixed(2)),
      totalInputCost: Number((totalCost * 0.42).toFixed(2)),
      totalOutputCost: Number((totalCost * 0.58).toFixed(2)),
      averageCostPerRequest: Number((totalCost / totalRequests).toFixed(3)),
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

// Generate demo data on load
const DEMO_DATA = generateDemoData();

// Filter demo data based on time range
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
      totalCost: Number(filteredTotalCost.toFixed(2)),
      totalInputCost: Number((filteredTotalCost * 0.42).toFixed(2)),
      totalOutputCost: Number((filteredTotalCost * 0.58).toFixed(2)),
      averageCostPerRequest: filteredRequestCount > 0 ? Number((filteredTotalCost / filteredRequestCount).toFixed(3)) : 0,
      requestCount: filteredRequestCount
    },
    byOperation: filteredByOperation,
    byModel: filteredByModel,
    dailyStats: filteredDailyStats,
    recentUsage: filteredRecentUsage,
    userSpending: filteredUserSpending
  };
};

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
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    
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
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date >= tempStart && date <= tempEnd;
  };

  const isStartDate = (day) => {
    if (!tempStart) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toDateString() === tempStart.toDateString();
  };

  const isEndDate = (day) => {
    if (!tempEnd) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toDateString() === tempEnd.toDateString();
  };

  const isFutureDate = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
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
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="text-center">
          <h3 className="font-semibold text-gray-800">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {selectingStart ? 'Select start date' : 'Select end date'}
          </p>
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
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
                  ? 'text-gray-300 cursor-not-allowed'
                  : isStart || isEnd
                  ? 'bg-green-600 text-white font-bold shadow-md'
                  : inRange
                  ? 'bg-green-100 text-green-700'
                  : 'hover:bg-gray-100 text-gray-700'
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
  const [timeRange, setTimeRange] = useState('month');
  const [tokenData, setTokenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDemoData, setShowDemoData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('totalCost');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchTokenData = async () => {
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

    try {
      setRefreshing(true);
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      
      // Build URL with custom date range if selected
      let url = `${apiBaseUrl}/api/get-token-usage?email=${encodeURIComponent(user?.email)}`;
      
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate.toISOString()}&endDate=${customEndDate.toISOString()}`;
      } else {
        url += `&timeRange=${timeRange}`;
      }
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTokenData(data.data);
          setLastUpdated(new Date());
        }
      }
    } catch (error) {
      console.error('Error fetching token data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTokenData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, showDemoData, customStartDate, customEndDate]);

  const handleDateRangeSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setTimeRange('custom');
    setShowDatePicker(false);
  };

  const getDateRangeLabel = () => {
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      return `${customStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${customEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return 'Custom Range';
  };

  const formatCurrency = (val) => `₹${Number(val).toFixed(2)}`;
  const formatNumber = (val) => Number(val).toLocaleString();
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const summary = tokenData?.summary || {};
  const userSpending = tokenData?.userSpending || [];

  // Sorting handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and sort users
  const filteredAndSortedUsers = userSpending
    .filter(user => {
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
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
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
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-3.5 h-3.5 text-green-600" /> : 
      <ArrowDown className="w-3.5 h-3.5 text-green-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-gray-800">AI Monitor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Track token usage and spending</p>
          </div>
          
          <button 
            onClick={fetchTokenData}
            className={`p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors ${refreshing ? 'animate-spin text-green-600' : 'text-gray-500'}`}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6 pb-20">
        
        {/* Demo Toggle */}
        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Database className="w-4 h-4" />
            <span>Demo Data</span>
          </div>
          <button
            onClick={() => setShowDemoData(!showDemoData)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showDemoData ? 'bg-green-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showDemoData ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Date Range Filter */}
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide">
          {['today', 'week', 'month', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => {
                setTimeRange(range);
                setCustomStartDate(null);
                setCustomEndDate(null);
                setShowDatePicker(false);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                timeRange === range
                  ? 'bg-green-600 text-white shadow-md shadow-green-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center space-x-1 ${
              timeRange === 'custom'
                ? 'bg-green-600 text-white shadow-md shadow-green-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>{timeRange === 'custom' ? getDateRangeLabel() : 'Custom'}</span>
          </button>
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
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="h-10 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-28"></div>
                </div>
                <div>
                  <div className="h-10 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </div>

            {/* Skeleton for Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                </div>
                <div className="h-10 bg-gray-100 rounded animate-pulse"></div>
              </div>
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between animate-pulse">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-48"></div>
                    </div>
                    <div className="flex gap-8">
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                      <div className="h-4 bg-gray-200 rounded w-12"></div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Stats Box */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <h2 className="text-sm font-medium text-gray-500 mb-4 uppercase tracking-wider">Usage Summary</h2>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-3xl font-bold text-gray-800 mb-2">{formatNumber(summary.requestCount || 0)}</p>
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-gray-400">Total Requests</span>
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800 mb-2">{formatCurrency(summary.totalCost || 0)}</p>
                  <div className="flex items-center space-x-2">
                    <IndianRupee className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-gray-400">Total Cost</span>
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
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">User Spending</h2>
              <span className="text-xs text-gray-400">{filteredAndSortedUsers.length} users</span>
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
                  onClick={() => setSearchQuery('')}
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
                      onClick={() => handleSort('userName')}
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center space-x-1">
                        <span>User</span>
                        <SortIcon field="userName" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('inputTokens')}
                      className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>IN Tokens</span>
                        <SortIcon field="inputTokens" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('outputTokens')}
                      className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>OUT Tokens</span>
                        <SortIcon field="outputTokens" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('totalTokens')}
                      className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Total Tokens</span>
                        <SortIcon field="totalTokens" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('requestCount')}
                      className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Requests</span>
                        <SortIcon field="requestCount" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('totalCost')}
                      className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Cost</span>
                        <SortIcon field="totalCost" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedUsers.map((user, index) => (
                    <tr key={user.userId || index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{user.userName}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[180px]">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-medium text-gray-800">{formatNumber(user.inputTokens || 0)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-medium text-gray-800">{formatNumber(user.outputTokens || 0)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-medium text-gray-800">{formatNumber(user.totalTokens)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-medium text-gray-800">{formatNumber(user.requestCount)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-bold text-green-600">{formatCurrency(user.totalCost)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-gray-400 text-sm">
                {searchQuery ? `No users found matching "${searchQuery}"` : 'No user spending data'}
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredAndSortedUsers.length > 0 && (
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                {/* Page navigation - Left side */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                  </button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first page, last page, current page, and adjacent pages
                        return (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        );
                      })
                      .map((page, index, array) => (
                        <React.Fragment key={page}>
                          {/* Show ellipsis if there's a gap */}
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-1.5 text-gray-400 text-sm select-none">•••</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-all ${
                              currentPage === page
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                            }`}
                            aria-label={`Page ${page}`}
                            aria-current={currentPage === page ? 'page' : undefined}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>

                {/* Items per page selector - Right side */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <span className="text-sm text-gray-600 whitespace-nowrap">
                    {startIndex + 1}-{Math.min(endIndex, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length}
                  </span>
                  <span className="text-gray-400">|</span>
                  <div className="flex items-center gap-2">
                    <label htmlFor="items-per-page" className="text-sm text-gray-600 whitespace-nowrap">
                      Show:
                    </label>
                    <select
                      id="items-per-page"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
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
    </div>
  );
};

export default AdminDashboard;
