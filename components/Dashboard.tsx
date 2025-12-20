import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { ScanResult } from '../types';
import MapViz from './MapViz';
import { insertSampleData, addTestScan } from '../testUtils';
import { Activity, Package, MapPin, AlertCircle, TrendingUp, TrendingDown, Clock, BarChart3, Database, TestTube } from 'lucide-react';

interface DashboardProps {
  history: ScanResult[];
}

const Dashboard: React.FC<DashboardProps> = ({ history }) => {
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  
  // Test functions for real-time data
  const handleInsertSampleData = async () => {
    setIsLoadingData(true);
    setTestMessage(null);
    try {
      const result = await insertSampleData();
      if (result.success) {
        setTestMessage(`✅ Successfully loaded ${result.count} sample records`);
      } else {
        setTestMessage(`❌ Error: ${JSON.stringify(result.error) || 'Unknown error'}`);
      }
    } catch (error) {
      setTestMessage(`❌ Error: ${error}`);
    }
    setIsLoadingData(false);
    // Clear message after 3 seconds
    setTimeout(() => setTestMessage(null), 3000);
  };

  const handleAddTestScan = async () => {
    setIsLoadingData(true);
    setTestMessage(null);
    try {
      const result = await addTestScan();
      if (result.success) {
        setTestMessage(`✅ Test scan added: ${result.data?.id}`);
      } else {
        setTestMessage(`❌ Error: ${JSON.stringify(result.error) || 'Unknown error'}`);
      }
    } catch (error) {
      setTestMessage(`❌ Error: ${error}`);
    }
    setIsLoadingData(false);
    setTimeout(() => setTestMessage(null), 3000);
  };
  // Compute Stats
  const totalScans = history.length;
  const avgConfidence = history.length > 0 
    ? Math.round(history.reduce((acc, curr) => acc + (curr.data?.confidence || 0), 0) / history.length) 
    : 0;
  
  const isPositiveTrend = avgConfidence > 80;

  // Mock data for charts if empty history
  const chartData = history.length > 0 
    ? history.slice(-10).map((h, i) => ({ name: `Scan ${i+1}`, confidence: h.data?.confidence || 0 }))
    : [
      { name: '09:00', confidence: 85 },
      { name: '10:00', confidence: 92 },
      { name: '11:00', confidence: 78 },
      { name: '12:00', confidence: 95 },
      { name: '13:00', confidence: 88 },
      { name: '14:00', confidence: 94 },
    ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Stats Cards - India Post Theme */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Package className="w-5 h-5 text-white" />} 
          color="blue"
          label="कुल स्कैन | Total Processed" 
          value={totalScans.toString()} 
          trend="+12%"
          trendUp={true}
        />
        <StatCard 
          icon={<Activity className="w-5 h-5 text-white" />} 
          color="emerald"
          label="सटीकता | Accuracy Rate" 
          value={`${avgConfidence}%`} 
          trend={isPositiveTrend ? "+2.4%" : "-1.1%"}
          trendUp={isPositiveTrend}
        />
        <StatCard 
          icon={<MapPin className="w-5 h-5 text-white" />} 
          color="indigo"
          label="सक्रिय केंद्र | Active Centers" 
          value="14" 
          subtext="भारत भर में | Across India"
        />
        <StatCard 
          icon={<AlertCircle className="w-5 h-5 text-white" />} 
          color="amber"
          label="समीक्षा | Review Required" 
          value={history.filter(h => (h.data?.confidence || 100) < 70).length.toString()} 
          subtext="Manual Check Needed"
          alert={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white/90 p-8 rounded-3xl shadow-lg border border-orange-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-600" />
                प्रदर्शन मेट्रिक्स | Performance Metrics
              </h3>
              <p className="text-sm text-slate-600 mt-1">OCR confidence trends over time</p>
            </div>
            <select className="text-sm border-orange-200 rounded-xl px-4 py-2 text-slate-600 focus:ring-orange-500 bg-orange-50 font-medium cursor-pointer hover:bg-orange-100 transition-colors">
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
            </select>
          </div>
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6600" stopOpacity={0.3}/>
                    <stop offset="50%" stopColor="#138808" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#000080" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="confidence" 
                  stroke="#FF6600" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorConfidence)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Map */}
        <div className="bg-white/90 p-6 rounded-3xl shadow-lg border border-orange-200 hover:shadow-xl transition-all duration-300 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
               <h3 className="text-xl font-bold text-slate-800">लाइव मैप | Live Map</h3>
               <p className="text-sm text-slate-600">Regional Distribution</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 shadow-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-green-700 font-bold uppercase tracking-wide">ऑनलाइन | Online</span>
            </div>
          </div>
          <div className="flex-1 min-h-[300px] relative rounded-2xl overflow-hidden border border-orange-100 shadow-inner">
            <MapViz />
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Recent Scans</h3>
            <p className="text-sm text-slate-500">Latest processed operations</p>
          </div>
          <button className="text-sm text-blue-600 font-bold hover:text-blue-700 hover:underline px-4 py-2 bg-blue-50 rounded-lg transition-colors">View All History</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50">
              <tr>
                <th className="px-8 py-4 font-bold tracking-wider">Time</th>
                <th className="px-8 py-4 font-bold tracking-wider">Recipient</th>
                <th className="px-8 py-4 font-bold tracking-wider">PIN/ZIP</th>
                <th className="px-8 py-4 font-bold tracking-wider">Sorting Center</th>
                <th className="px-8 py-4 font-bold tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    No recent activity found.
                  </td>
                </tr>
              ) : (
                history.slice().reverse().slice(0, 5).map((scan) => (
                  <tr key={scan.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-8 py-4">
                      <div className="font-bold text-slate-800">{new Date(scan.timestamp).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}</div>
                      <div className="text-xs text-slate-400 font-medium">{new Date(scan.timestamp).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        month: 'short',
                        day: 'numeric'
                      })}</div>
                    </td>
                    <td className="px-8 py-4 font-medium text-slate-700">{scan.data?.recipient || 'Unknown'}</td>
                    <td className="px-8 py-4 font-mono text-slate-600">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{scan.data?.pin_code}</span>
                    </td>
                    <td className="px-8 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {scan.data?.sorting_center_id}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      {(scan.data?.confidence || 0) > 80 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Review
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Testing Panel - Moved to bottom for better UX */}
      <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-2xl p-6 border border-purple-500/30 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <TestTube className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Real-time Testing</h3>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={handleInsertSampleData}
            disabled={isLoadingData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <Database className="w-4 h-4" />
            {isLoadingData ? 'Loading...' : 'Load Sample Data'}
          </button>
          <button
            onClick={handleAddTestScan}
            disabled={isLoadingData}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <Package className="w-4 h-4" />
            {isLoadingData ? 'Adding...' : 'Add Test Scan'}
          </button>
          {testMessage && (
            <div className={`px-3 py-1 rounded-lg text-sm ${
              testMessage.startsWith('✅') ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
            }`}>
              {testMessage}
            </div>
          )}
        </div>
        <p className="text-slate-400 text-sm mt-2">
          Use these buttons to test real-time data updates in NetworkViz and MapViz. Watch the visualizations update automatically!
        </p>
      </div>
    </div>
  );
};

const StatCard = ({ icon, color, label, value, subtext, trend, trendUp, alert }: { 
  icon: React.ReactNode, color: 'blue' | 'emerald' | 'indigo' | 'amber', label: string, value: string, subtext?: string, trend?: string, trendUp?: boolean, alert?: boolean 
}) => {
  const bgStyles = {
    blue: 'bg-blue-500 shadow-blue-200',
    emerald: 'bg-emerald-500 shadow-emerald-200',
    indigo: 'bg-indigo-500 shadow-indigo-200',
    amber: 'bg-amber-500 shadow-amber-200',
  };

  return (
    <div className={`bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover-card relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className={`p-3.5 rounded-2xl shadow-lg ${bgStyles[color]} text-white`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      
      <div className="relative z-10">
        <h4 className={`text-3xl font-black tracking-tight mb-1 ${alert ? 'text-amber-600' : 'text-slate-800'}`}>{value}</h4>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        {subtext && <p className="text-xs text-slate-400 mt-2 font-medium">{subtext}</p>}
      </div>
      
      {/* Decorative blob */}
      <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-5 bg-${color}-500`}></div>
    </div>
  );
};

export default Dashboard;