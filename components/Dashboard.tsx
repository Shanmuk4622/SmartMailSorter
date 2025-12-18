import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line 
} from 'recharts';
import { ScanResult } from '../types';
import MapViz from './MapViz';
import { Activity, Package, MapPin, AlertCircle } from 'lucide-react';

interface DashboardProps {
  history: ScanResult[];
}

const Dashboard: React.FC<DashboardProps> = ({ history }) => {
  // Compute Stats
  const totalScans = history.length;
  const avgConfidence = history.length > 0 
    ? Math.round(history.reduce((acc, curr) => acc + (curr.data?.confidence || 0), 0) / history.length) 
    : 0;
  
  const scansLastHour = history.filter(h => Date.now() - h.timestamp < 3600000).length;

  // Mock data for charts if empty history
  const chartData = history.length > 0 
    ? history.slice(-10).map((h, i) => ({ name: `Scan ${i+1}`, confidence: h.data?.confidence || 0 }))
    : [
      { name: '10:00', confidence: 85 },
      { name: '10:15', confidence: 92 },
      { name: '10:30', confidence: 78 },
      { name: '10:45', confidence: 95 },
      { name: '11:00', confidence: 88 },
    ];

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Package className="text-blue-600" />} label="Total Scanned" value={totalScans.toString()} subtext="+12% from yesterday" />
        <StatCard icon={<Activity className="text-emerald-600" />} label="Avg Accuracy" value={`${avgConfidence}%`} subtext="Based on confidence score" />
        <StatCard icon={<MapPin className="text-indigo-600" />} label="Active Centers" value="14" subtext="Across 3 regions" />
        <StatCard icon={<AlertCircle className="text-amber-600" />} label="Flagged Items" value={history.filter(h => (h.data?.confidence || 100) < 70).length.toString()} subtext="Requires manual review" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">OCR Confidence Trend</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="confidence" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Map Visualization */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Live Tracking Map</h3>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-slate-500 uppercase font-medium">Live</span>
            </div>
          </div>
          <div className="flex-1 min-h-[300px] relative">
            <MapViz />
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">Recent Scans</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Recipient</th>
                <th className="px-6 py-3">PIN/ZIP</th>
                <th className="px-6 py-3">Sorting Center</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No scans yet. Go to Scanner to start.
                  </td>
                </tr>
              ) : (
                history.slice().reverse().slice(0, 5).map((scan) => (
                  <tr key={scan.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {new Date(scan.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{scan.data?.recipient || 'Unknown'}</td>
                    <td className="px-6 py-4 font-mono text-slate-600">{scan.data?.pin_code}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {scan.data?.sorting_center_id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(scan.data?.confidence || 0) > 80 ? (
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Verified
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Review
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
    </div>
  );
};

const StatCard = ({ icon, label, value, subtext }: { icon: React.ReactNode, label: string, value: string, subtext: string }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
    <div className="flex items-center justify-between mb-4">
      <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
      <span className="text-xs font-medium text-slate-400 uppercase">Last 24h</span>
    </div>
    <div className="mb-1">
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
    </div>
    <p className="text-sm text-slate-500">{label}</p>
    <p className="text-xs text-emerald-600 mt-2 font-medium">{subtext}</p>
  </div>
);

export default Dashboard;