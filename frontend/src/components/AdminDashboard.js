import React, { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  DollarSign, 
  IndianRupee,
  Zap, 
  Activity,
  RefreshCw,
  Database,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Demo Data ---
const DEMO_DATA = {
  summary: {
    totalTokens: 2753,
    totalInputTokens: 1887,
    totalOutputTokens: 866,
    totalCost: 3.86,
    totalInputCost: 1.50,
    totalOutputCost: 2.36,
    averageCostPerRequest: 0.0425,
    requestCount: 192,
    mostUsedOperation: "food_analysis",
    mostUsedModel: "gemini-2.5-flash-lite"
  },
  dailyStats: [
    { date: "2025-12-10", totalCost: 0.20, requestCount: 12 },
    { date: "2025-12-11", totalCost: 0.45, requestCount: 24 },
    { date: "2025-12-12", totalCost: 0.30, requestCount: 18 },
    { date: "2025-12-13", totalCost: 0.85, requestCount: 42 },
    { date: "2025-12-14", totalCost: 0.60, requestCount: 30 },
    { date: "2025-12-15", totalCost: 0.95, requestCount: 48 },
    { date: "2025-12-16", totalCost: 0.51, requestCount: 26 }
  ],
  recentUsage: [
    {
      id: 1,
      operationType: "food_analysis",
      modelName: "gemini-2.5-flash-lite",
      totalTokens: 1183,
      totalTokenCost: 0.0467,
      inputTokens: 1037,
      outputTokens: 146,
      createdAt: "2025-12-16T12:43:59.000Z"
    },
    {
      id: 2,
      operationType: "weight_detection",
      modelName: "gemini-2.5-flash-lite",
      totalTokens: 970,
      totalTokenCost: 0.0384,
      inputTokens: 850,
      outputTokens: 120,
      createdAt: "2025-12-16T11:43:59.000Z"
    },
    {
      id: 3,
      operationType: "food_analysis",
      modelName: "gemini-2.5-flash-lite",
      totalTokens: 850,
      totalTokenCost: 0.0320,
      inputTokens: 700,
      outputTokens: 150,
      createdAt: "2025-12-15T18:20:00.000Z"
    },
    {
      id: 4,
      operationType: "chat_completion",
      modelName: "gemini-2.5-flash",
      totalTokens: 420,
      totalTokenCost: 0.0150,
      inputTokens: 300,
      outputTokens: 120,
      createdAt: "2025-12-15T14:10:00.000Z"
    }
  ]
};

// --- Components ---

const SimpleLineChart = ({ data, color = "#22c55e" }) => {
  const [activePoint, setActivePoint] = useState(null);

  if (!data || data.length < 2) return null;

  const height = 100;
  const width = 300;
  const padding = 10;

  const maxVal = Math.max(...data.map(d => d.totalCost));
  const minVal = 0;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((d.totalCost - minVal) / (maxVal - minVal || 1)) * (height - padding * 2) - padding;
    return { x, y, ...d };
  });

  const pathData = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full h-40 flex items-center justify-center relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M ${points[0].x},${height} ${pathData} L ${points[points.length - 1].x},${height} Z`}
          fill="url(#gradient)"
          stroke="none"
        />
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          d={`M ${pathData}`}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, i) => (
           <g key={i}>
             {/* Hit Area */}
             <circle 
               cx={point.x} 
               cy={point.y} 
               r="15" 
               fill="transparent" 
               className="cursor-pointer"
               onMouseEnter={() => setActivePoint(point)}
               onMouseLeave={() => setActivePoint(null)}
               onTouchStart={() => setActivePoint(point)}
             />
             {/* Visible Dot */}
             <circle 
               cx={point.x} 
               cy={point.y} 
               r={activePoint === point ? 5 : 3} 
               fill="white" 
               stroke={color} 
               strokeWidth="2" 
               className="pointer-events-none transition-all duration-200"
             />
             {/* Active Ring */}
             {activePoint === point && (
               <circle 
                 cx={point.x} 
                 cy={point.y} 
                 r="8" 
                 fill="none" 
                 stroke={color} 
                 strokeOpacity="0.3" 
                 strokeWidth="4" 
                 className="pointer-events-none animate-pulse"
               />
             )}
           </g>
        ))}
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {activePoint && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bg-white text-gray-800 text-xs rounded-xl py-2 px-3 shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-gray-100 pointer-events-none z-10 min-w-[100px]"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${(activePoint.y / height) * 100}%`,
              transform: 'translate(-50%, -130%)'
            }}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-gray-900 text-sm">₹{Number(activePoint.totalCost).toFixed(2)}</span>
              <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md">
                {new Date(activePoint.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[10px] text-gray-500 border-t border-gray-50 pt-1 mt-1">
              <Zap className="w-3 h-3 text-blue-500" />
              <span>{activePoint.requestCount || 0} requests</span>
            </div>
            
            {/* Arrow */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2.5 h-2.5 bg-white border-r border-b border-gray-100"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminDashboard = ({ user, onClose }) => {
  const [timeRange, setTimeRange] = useState('month');
  const [tokenData, setTokenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDemoData, setShowDemoData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchTokenData = async () => {
    if (showDemoData) {
      setTokenData(DEMO_DATA);
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
      return;
    }

    try {
      setRefreshing(true);
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      const response = await fetch(
        `${apiBaseUrl}/api/get-token-usage?email=${encodeURIComponent(user?.email)}&timeRange=${timeRange}`
      );
      
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
  }, [timeRange, showDemoData]);

  const formatCurrency = (val) => `₹${Number(val).toFixed(2)}`;
  const formatNumber = (val) => Number(val).toLocaleString();
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const summary = tokenData?.summary || {};
  const dailyStats = tokenData?.dailyStats || [];
  const recentUsage = tokenData?.recentUsage || [];

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="bg-green-100 p-2 rounded-lg">
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-800">AI Monitor</h1>
        </div>
        <div className="flex items-center space-x-2">
           <button 
            onClick={fetchTokenData}
            className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${refreshing ? 'animate-spin text-green-600' : 'text-gray-500'}`}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          >
            <X className="w-6 h-6" />
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
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                timeRange === range
                  ? 'bg-green-600 text-white shadow-md shadow-green-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats Box */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-medium text-gray-500 mb-4 uppercase tracking-wider">Usage Summary</h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <Zap className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-400">Total Requests</span>
              </div>
              <p className="text-3xl font-bold text-gray-800">{formatNumber(summary.requestCount || 0)}</p>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <IndianRupee className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-400">Total Cost</span>
              </div>
              <p className="text-3xl font-bold text-gray-800">{formatCurrency(summary.totalCost || 0)}</p>
            </div>
          </div>
        </motion.div>

        {/* Line Graph */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Cost Trend</h2>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          {dailyStats.length > 0 ? (
            <SimpleLineChart data={dailyStats} />
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
              No trend data available
            </div>
          )}
        </motion.div>

        {/* Transactions Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Recent Transactions</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentUsage.length > 0 ? (
              recentUsage.map((item) => (
                <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      item.operationType === 'food_analysis' ? 'bg-green-500' : 
                      item.operationType === 'weight_detection' ? 'bg-blue-500' : 'bg-purple-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-800 capitalize">
                        {item.operationType.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(item.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">{formatCurrency(item.totalTokenCost)}</p>
                    <p className="text-xs text-gray-400">{formatNumber(item.totalTokens)} tokens</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-400 text-sm">
                No recent transactions
              </div>
            )}
          </div>
        </motion.div>

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
