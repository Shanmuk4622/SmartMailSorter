import React, { useState } from 'react';
import { Activity, Server, MapPin, Clock, TrendingUp, Users, Wifi, Database } from 'lucide-react';

interface NetworkStatsProps {
  metrics: {
    totalScans: number;
    successRate: number;
    avgProcessingTime: number;
    totalHubs: number;
    activeRoutes: number;
    uptime: string;
  };
  sortingCenters: Array<{
    id: string;
    name: string;
    scanCount: number;
    successRate: number;
    avgProcessingTime: number;
    lastActivity: string;
  }>;
  isExpanded?: boolean;
}

const NetworkStatsPanel: React.FC<NetworkStatsProps> = ({ metrics, sortingCenters, isExpanded }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const topPerformers = sortingCenters
    .filter(center => center.scanCount > 0)
    .sort((a, b) => b.scanCount - a.scanCount)
    .slice(0, 5);

  const getStatusColor = (successRate: number) => {
    if (successRate >= 0.9) return 'text-green-400';
    if (successRate >= 0.7) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatLastActivity = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 24) return `${Math.floor(hours / 24)}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className={`${isExpanded ? 'w-80' : 'w-72'} transition-all duration-300`}>
      {/* Main Stats Card */}
      <div className="bg-slate-900/95 backdrop-blur-sm rounded-lg border border-slate-600/50 p-4 mb-3 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            NETWORK STATUS
          </h4>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-xs">LIVE</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Database className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-slate-300">Total Scans</span>
            </div>
            <p className="text-lg font-mono text-blue-300">{metrics.totalScans.toLocaleString()}</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="text-xs text-slate-300">Success Rate</span>
            </div>
            <p className={`text-lg font-mono ${getStatusColor(metrics.successRate)}`}>
              {(metrics.successRate * 100).toFixed(1)}%
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-slate-300">Avg Time</span>
            </div>
            <p className="text-lg font-mono text-yellow-300">{metrics.avgProcessingTime}ms</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Server className="w-3 h-3 text-purple-400" />
              <span className="text-xs text-slate-300">Active Hubs</span>
            </div>
            <p className="text-lg font-mono text-purple-300">
              {sortingCenters.filter(c => c.scanCount > 0).length}
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full mt-3 px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      {/* Detailed Performance Panel */}
      {showDetails && (
        <div className="bg-slate-900/95 backdrop-blur-sm rounded-lg border border-slate-600/50 p-4 shadow-lg">
          <h5 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            TOP PERFORMERS
          </h5>
          
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {topPerformers.map((center, index) => (
              <div key={center.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-slate-200 font-medium truncate max-w-20">{center.name}</p>
                    <p className="text-slate-400">{formatLastActivity(center.lastActivity)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-blue-300 font-mono">{center.scanCount}</p>
                  <p className={`font-mono ${getStatusColor(center.successRate)}`}>
                    {(center.successRate * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkStatsPanel;