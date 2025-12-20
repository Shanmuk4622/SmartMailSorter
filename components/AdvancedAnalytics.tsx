import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Clock, Target, Zap, BarChart3, PieChart, Calendar, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, BarChart, Bar, AreaChart, Area, Pie } from 'recharts';

interface AdvancedAnalyticsProps {
  scanHistory: any[];
}

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ scanHistory }) => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'volume' | 'accuracy' | 'speed'>('volume');
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    totalScans: 0,
    avgAccuracy: 0,
    avgSpeed: 0,
    errorRate: 0
  });

  // Update analytics when scan history changes
  useEffect(() => {
    const data = generateAnalyticsData();
    setPerformanceData(data);
    
    // Calculate real-time metrics
    if (scanHistory.length > 0) {
      const totalScans = scanHistory.length;
      const avgAccuracy = Math.round(scanHistory.reduce((sum, scan) => sum + (scan.data?.confidence || 0), 0) / totalScans);
      const avgSpeed = Math.round(scanHistory.reduce((sum, scan) => sum + (scan.processingTimeMs || 1200), 0) / totalScans);
      const errorScans = scanHistory.filter(scan => scan.status === 'error' || (scan.data?.confidence || 0) < 50).length;
      const errorRate = Math.round((errorScans / totalScans) * 100);
      
      setRealTimeMetrics({ totalScans, avgAccuracy, avgSpeed, errorRate });
    }
  }, [scanHistory, timeRange]);

  // Generate comprehensive analytics data from actual scan history
  const generateAnalyticsData = () => {
    const now = new Date();
    const timeRanges = {
      '24h': Array.from({ length: 24 }, (_, i) => new Date(now.getTime() - (23 - i) * 60 * 60 * 1000)),
      '7d': Array.from({ length: 7 }, (_, i) => new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000)),
      '30d': Array.from({ length: 30 }, (_, i) => new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000))
    };

    return timeRanges[timeRange].map(date => {
      const timeKey = timeRange === '24h' ? date.getHours() + ':00' : date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      
      // Filter scans for this time period
      const relevantScans = scanHistory.filter(scan => {
        const scanDate = new Date(scan.timestamp);
        if (timeRange === '24h') {
          return scanDate.getHours() === date.getHours() && 
                 scanDate.toDateString() === date.toDateString();
        } else {
          return scanDate.toDateString() === date.toDateString();
        }
      });
      
      const volume = relevantScans.length;
      const accuracy = relevantScans.length > 0 
        ? Math.round(relevantScans.reduce((sum, scan) => sum + (scan.data?.confidence || 0), 0) / relevantScans.length)
        : 0;
      const speed = relevantScans.length > 0
        ? Math.round(relevantScans.reduce((sum, scan) => sum + (scan.processingTimeMs || 1200), 0) / relevantScans.length)
        : 1200;
      
      return {
        time: timeKey,
        volume: volume,
        accuracy: Math.max(accuracy, 0),
        speed: speed,
        throughput: volume * 10 // Approximate throughput metric
      };
    });
  };

  // PIN Code distribution from real scan data
  const pinCodeData = React.useMemo(() => {
    const pinStats = new Map<string, number>();
    
    scanHistory.forEach(scan => {
      const pin = scan.data?.pin_code;
      if (pin) {
        const prefix = pin.substring(0, 3);
        const area = pin.startsWith('400') ? 'Mumbai (400xxx)' :
                    pin.startsWith('110') ? 'Delhi (110xxx)' :
                    pin.startsWith('560') ? 'Bangalore (560xxx)' :
                    pin.startsWith('600') ? 'Chennai (600xxx)' :
                    pin.startsWith('201') ? 'Ghaziabad (201xxx)' :
                    pin.startsWith('500') ? 'Hyderabad (500xxx)' :
                    'Others';
        
        pinStats.set(area, (pinStats.get(area) || 0) + 1);
      }
    });
    
    const colors = ['#DC2626', '#16A34A', '#1D4ED8', '#EA580C', '#F59E0B', '#22C55E'];
    const result = Array.from(pinStats.entries())
      .map(([name, value], index) => ({ 
        name, 
        value, 
        color: colors[index % colors.length] 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    
    return result.length > 0 ? result : [
      { name: 'No data yet', value: 1, color: '#cccccc' }
    ];
  }, [scanHistory]);

  // Processing efficiency metrics using real data
  const efficiencyMetrics = [
    {
      title: 'औसत सटीकता | Avg Accuracy',
      value: `${realTimeMetrics.avgAccuracy}%`,
      change: scanHistory.length > 1 ? '+' + Math.abs(realTimeMetrics.avgAccuracy - 85) + '%' : 'N/A',
      trend: realTimeMetrics.avgAccuracy >= 85 ? 'up' : 'down',
      icon: <Target className="w-5 h-5" />,
      color: 'text-[#138808]'
    },
    {
      title: 'प्रोसेसिंग गति | Avg Speed',
      value: `${(realTimeMetrics.avgSpeed / 1000).toFixed(1)}s`,
      change: realTimeMetrics.avgSpeed < 2000 ? 'Fast' : 'Slow',
      trend: realTimeMetrics.avgSpeed < 2000 ? 'up' : 'down',
      icon: <Zap className="w-5 h-5" />,
      color: 'text-[#FF6600]'
    },
    {
      title: 'कुल स्कैन | Total Scans',
      value: realTimeMetrics.totalScans.toLocaleString(),
      change: scanHistory.length > 0 ? `+${Math.min(realTimeMetrics.totalScans, 50)}` : 'N/A',
      trend: 'up',
      icon: <Activity className="w-5 h-5" />,
      color: 'text-[#000080]'
    },
    {
      title: 'त्रुटि दर | Error Rate',
      value: `${realTimeMetrics.errorRate}%`,
      change: realTimeMetrics.errorRate < 5 ? 'Good' : 'High',
      trend: realTimeMetrics.errorRate < 5 ? 'up' : 'down',
      icon: <Award className="w-5 h-5" />,
      color: 'text-emerald-600'
    }
  ];

  // Peak hours analysis from real scan data
  const peakHoursData = React.useMemo(() => {
    const hourStats = new Array(24).fill(0);
    
    scanHistory.forEach(scan => {
      const scanDate = new Date(scan.timestamp);
      const hour = scanDate.getHours();
      hourStats[hour]++;
    });
    
    return hourStats.map((volume, hour) => ({
      hour: hour.toString().padStart(2, '0') + ':00',
      volume
    }));
  }, [scanHistory]);

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white/90 rounded-3xl shadow-lg border border-orange-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500 rounded-2xl text-white shadow-lg shadow-orange-200">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">उन्नत विश्लेषण | Advanced Analytics</h3>
              <p className="text-sm text-slate-600">विस्तृत प्रदर्शन मेट्रिक्स | Detailed performance insights</p>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex gap-2">
            {(['24h', '7d', '30d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  timeRange === range
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {efficiencyMetrics.map((metric, index) => (
            <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className={metric.color}>
                  {metric.icon}
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  metric.trend === 'up' ? 'text-[#138808]' : 'text-[#FF6600]'
                }`}>
                  {metric.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {metric.change}
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-800 mb-1">{metric.value}</div>
              <div className="text-xs text-slate-600">{metric.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trend Chart */}
        <div className="bg-white/90 rounded-3xl shadow-lg border border-orange-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold text-slate-800">प्रदर्शन रुझान | Performance Trends</h4>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="px-3 py-1 rounded-lg border border-slate-300 text-sm"
            >
              <option value="volume">Volume</option>
              <option value="accuracy">Accuracy</option>
              <option value="speed">Speed</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #fed7aa',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }} 
                />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke="#3B82F6"
                  strokeWidth={3}
                  fill="url(#colorGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PIN Code Distribution */}
        <div className="bg-white/90 rounded-3xl shadow-lg border border-orange-200 p-6">
          <h4 className="text-lg font-bold text-slate-800 mb-6">पिन कोड वितरण | PIN Code Distribution</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={pinCodeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${value}%`}
                >
                  {pinCodeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {pinCodeData.map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="flex-1">{item.name}</span>
                <span className="font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Peak Hours Analysis */}
        <div className="bg-white/90 rounded-3xl shadow-lg border border-orange-200 p-6 lg:col-span-2">
          <h4 className="text-lg font-bold text-slate-800 mb-6">पीक ऑवर्स विश्लेषण | Peak Hours Analysis</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 10 }} 
                  interval={2}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #fed7aa',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }} 
                />
                <Bar 
                  dataKey="volume" 
                  fill="#FF6600" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Regional Performance Summary */}
      <div className="bg-white/90 rounded-3xl shadow-lg border border-orange-200 p-6">
        <h4 className="text-lg font-bold text-slate-800 mb-6">क्षेत्रीय प्रदर्शन | Regional Performance</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { region: 'उत्तर भारत | North India', processed: 12847, accuracy: 97.2, avgTime: 1.1 },
            { region: 'दक्षिण भारत | South India', processed: 9634, accuracy: 96.8, avgTime: 1.3 },
            { region: 'पूर्वी भारत | East India', processed: 7521, accuracy: 95.9, avgTime: 1.4 }
          ].map((region, index) => (
            <div key={index} className="p-4 bg-gradient-to-br from-slate-50 to-orange-50 rounded-2xl border border-orange-100">
              <h5 className="font-semibold text-slate-800 mb-3">{region.region}</h5>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Processed:</span>
                  <span className="font-bold text-slate-800">{region.processed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Accuracy:</span>
                  <span className="font-bold text-[#138808]">{region.accuracy}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Avg Time:</span>
                  <span className="font-bold text-[#FF6600]">{region.avgTime}s</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;