import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Clock, Target, Zap, BarChart3, PieChart, Calendar, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, BarChart, Bar, AreaChart, Area, Pie } from 'recharts';

interface AdvancedAnalyticsProps {
  scanHistory: any[];
}

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ scanHistory }) => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'volume' | 'accuracy' | 'speed'>('volume');

  // Generate comprehensive analytics data
  const generateAnalyticsData = () => {
    const now = new Date();
    const timeRanges = {
      '24h': Array.from({ length: 24 }, (_, i) => new Date(now.getTime() - (23 - i) * 60 * 60 * 1000)),
      '7d': Array.from({ length: 7 }, (_, i) => new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000)),
      '30d': Array.from({ length: 30 }, (_, i) => new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000))
    };

    return timeRanges[timeRange].map(date => ({
      time: timeRange === '24h' ? date.getHours() + ':00' : date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      volume: Math.floor(Math.random() * 150 + 50),
      accuracy: Math.floor(Math.random() * 15 + 85),
      speed: Math.floor(Math.random() * 500 + 1200), // milliseconds
      throughput: Math.floor(Math.random() * 300 + 200)
    }));
  };

  const performanceData = generateAnalyticsData();

  // PIN Code distribution
  const pinCodeData = [
    { name: 'Mumbai (400xxx)', value: 35, color: '#FF6600' },
    { name: 'Delhi (110xxx)', value: 25, color: '#138808' },
    { name: 'Bangalore (560xxx)', value: 20, color: '#000080' },
    { name: 'Chennai (600xxx)', value: 12, color: '#FF9933' },
    { name: 'Others', value: 8, color: '#cccccc' }
  ];

  // Processing efficiency metrics
  const efficiencyMetrics = [
    {
      title: 'औसत सटीकता | Avg Accuracy',
      value: '96.8%',
      change: '+2.1%',
      trend: 'up',
      icon: <Target className="w-5 h-5" />,
      color: 'text-[#138808]'
    },
    {
      title: 'प्रोसेसिंग गति | Avg Speed',
      value: '1.2s',
      change: '-0.3s',
      trend: 'down',
      icon: <Zap className="w-5 h-5" />,
      color: 'text-[#FF6600]'
    },
    {
      title: 'दैनिक थ्रूपुट | Daily Throughput',
      value: '2,847',
      change: '+14.2%',
      trend: 'up',
      icon: <Activity className="w-5 h-5" />,
      color: 'text-[#000080]'
    },
    {
      title: 'त्रुटि दर | Error Rate',
      value: '1.2%',
      change: '-0.8%',
      trend: 'down',
      icon: <Award className="w-5 h-5" />,
      color: 'text-emerald-600'
    }
  ];

  // Peak hours analysis
  const peakHoursData = Array.from({ length: 24 }, (_, hour) => ({
    hour: hour.toString().padStart(2, '0') + ':00',
    volume: Math.floor(Math.random() * 200 + (hour >= 9 && hour <= 17 ? 300 : 100))
  }));

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