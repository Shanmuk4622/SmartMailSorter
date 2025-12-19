import React, { useState, useEffect } from 'react';
import { BarChart3, Globe, TrendingUp, MapPin, Users, Clock, Mail } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface AnalyticsData {
  totalScans: number;
  uniqueCenters: number;
  avgConfidence: number;
  countryCounts: { [key: string]: number };
  topCenters: Array<{
    sorting_center_id: string;
    sorting_center_name: string;
    city: string;
    state: string;
    total_scans: number;
    avg_confidence: number;
  }>;
  dailyScans: Array<{
    date: string;
    count: number;
  }>;
}

const Analytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch total scans
      const { data: scans, error: scansError } = await supabase
        .from('mail_scans')
        .select('*');

      if (scansError) throw scansError;

      // Fetch analytics view
      const { data: centerAnalytics, error: analyticsError } = await supabase
        .from('mail_scan_analytics')
        .select('*')
        .limit(10);

      if (analyticsError) {
        console.warn('Analytics view not available, using basic analytics');
      }

      // Process data
      const totalScans = scans?.length || 0;
      const uniqueCenters = new Set(scans?.map(s => s.sorting_center_id).filter(Boolean)).size;
      const avgConfidence = scans?.reduce((sum, scan) => sum + (scan.confidence || 100), 0) / totalScans || 0;

      // Country distribution
      const countryCounts: { [key: string]: number } = {};
      scans?.forEach(scan => {
        const country = scan.country || 'Unknown';
        countryCounts[country] = (countryCounts[country] || 0) + 1;
      });

      // Daily scans (last 7 days)
      const dailyScans: { [key: string]: number } = {};
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      });

      last7Days.forEach(date => {
        dailyScans[date] = 0;
      });

      scans?.forEach(scan => {
        const scanDate = new Date(scan.created_at).toISOString().split('T')[0];
        if (dailyScans.hasOwnProperty(scanDate)) {
          dailyScans[scanDate]++;
        }
      });

      // Top centers processing
      const centerStats: { [key: string]: any } = {};
      scans?.forEach(scan => {
        const centerId = scan.sorting_center_id;
        if (!centerId || centerId === 'N/A') return;

        if (!centerStats[centerId]) {
          centerStats[centerId] = {
            sorting_center_id: centerId,
            sorting_center_name: scan.sorting_center_name || centerId,
            city: scan.city || 'Unknown',
            state: scan.state || '',
            total_scans: 0,
            total_confidence: 0
          };
        }
        
        centerStats[centerId].total_scans++;
        centerStats[centerId].total_confidence += (scan.confidence || 100);
      });

      const topCenters = Object.values(centerStats)
        .map((center: any) => ({
          ...center,
          avg_confidence: Math.round(center.total_confidence / center.total_scans)
        }))
        .sort((a: any, b: any) => b.total_scans - a.total_scans)
        .slice(0, 10);

      setAnalytics({
        totalScans,
        uniqueCenters,
        avgConfidence: Math.round(avgConfidence),
        countryCounts,
        topCenters,
        dailyScans: Object.entries(dailyScans).map(([date, count]) => ({ date, count }))
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center text-gray-500 py-12">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p>No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <Mail className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500">Total Scans</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalScans.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-500">Active Centers</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.uniqueCenters}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500">Avg Confidence</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.avgConfidence}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <Globe className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-sm text-gray-500">Countries</p>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(analytics.countryCounts).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sorting Centers */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Top Sorting Centers</h3>
          <div className="space-y-3">
            {analytics.topCenters.slice(0, 8).map((center, index) => (
              <div key={center.sorting_center_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{center.sorting_center_name}</p>
                    <p className="text-sm text-gray-500">{center.city}{center.state ? `, ${center.state}` : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{center.total_scans} scans</p>
                  <p className="text-sm text-gray-500">{center.avg_confidence}% confidence</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Country Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Country Distribution</h3>
          <div className="space-y-3">
            {Object.entries(analytics.countryCounts)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 8)
              .map(([country, count]) => (
              <div key={country} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{country}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(count / analytics.totalScans) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-12 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSV Import Section */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Data Management</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={() => (window as any).importCSVData?.()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Import CSV Data
          </button>
          <p className="text-sm text-gray-500">
            Import rich data from the CSV export to enhance visualizations
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;