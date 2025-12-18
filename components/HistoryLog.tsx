import React, { useState, useMemo } from 'react';
import { ScanResult } from '../types';
import { ArrowUp, ArrowDown, FileText, Search, X, Calendar, Download } from 'lucide-react';

interface HistoryLogProps {
  history: ScanResult[];
}

const HistoryLog: React.FC<HistoryLogProps> = ({ history }) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredHistory = useMemo(() => {
    return history.filter(scan => {
      // Text Search
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        (scan.data?.recipient?.toLowerCase().includes(query) ?? false) ||
        (scan.data?.address?.toLowerCase().includes(query) ?? false) ||
        (scan.data?.pin_code?.toLowerCase().includes(query) ?? false) ||
        (scan.data?.sorting_center_id?.toLowerCase().includes(query) ?? false);

      // Date Range
      const scanDate = new Date(scan.timestamp);
      // Normalize scan date to midnight for accurate day comparison
      const scanDay = new Date(scanDate.getFullYear(), scanDate.getMonth(), scanDate.getDate()).getTime();

      let matchesStartDate = true;
      if (startDate) {
        const start = new Date(startDate);
        // Date input gives YYYY-MM-DD which parses to UTC or local midnight depending on browser, 
        // simpler to normalize strictly from the input string components to local midnight
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const startDay = new Date(sy, sm - 1, sd).getTime();
        matchesStartDate = scanDay >= startDay;
      }

      let matchesEndDate = true;
      if (endDate) {
        const [ey, em, ed] = endDate.split('-').map(Number);
        const endDay = new Date(ey, em - 1, ed).getTime();
        matchesEndDate = scanDay <= endDay;
      }

      return matchesSearch && matchesStartDate && matchesEndDate;
    });
  }, [history, searchQuery, startDate, endDate]);

  const sortedHistory = useMemo(() => {
    return [...filteredHistory].sort((a, b) => {
      return sortOrder === 'asc' 
        ? a.timestamp - b.timestamp 
        : b.timestamp - a.timestamp;
    });
  }, [filteredHistory, sortOrder]);

  const handleExportCSV = () => {
    if (sortedHistory.length === 0) return;

    const headers = ['Timestamp', 'Recipient', 'Address', 'PIN/ZIP', 'City', 'Country', 'Sorting Center ID', 'Confidence'];
    const csvContent = [
      headers.join(','),
      ...sortedHistory.map(scan => {
        const data = scan.data;
        const row = [
          `"${new Date(scan.timestamp).toLocaleString()}"`,
          `"${(data?.recipient || '').replace(/"/g, '""')}"`,
          `"${(data?.address || '').replace(/"/g, '""')}"`,
          `"${(data?.pin_code || '').replace(/"/g, '""')}"`,
          `"${(data?.city || '').replace(/"/g, '""')}"`,
          `"${(data?.country || '').replace(/"/g, '""')}"`,
          `"${(data?.sorting_center_id || '').replace(/"/g, '""')}"`,
          data?.confidence || 0
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `smartmail_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
  };

  const hasFilters = searchQuery || startDate || endDate;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-4">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
               <FileText className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-lg font-semibold text-slate-800">Scan History Log</h3>
               <p className="text-sm text-slate-500">
                 {filteredHistory.length} {filteredHistory.length === 1 ? 'record' : 'records'} found 
                 {hasFilters && <span className="text-slate-400 ml-1">(filtered from {history.length})</span>}
               </p>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={sortedHistory.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm group whitespace-nowrap"
            >
              {sortOrder === 'desc' ? (
                <>
                  <ArrowDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  <span>Newest First</span>
                </>
              ) : (
                <>
                  <ArrowUp className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  <span>Oldest First</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col lg:flex-row gap-4 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search recipient, address, PIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-3 pr-2 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <span className="text-slate-400 text-sm">to</span>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-3 pr-2 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {hasFilters && (
             <button
              onClick={clearFilters}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
             >
               <X className="w-4 h-4" />
               Clear
             </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left relative">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100 sticky top-0">
            <tr>
              <th className="px-6 py-3">Timestamp</th>
              <th className="px-6 py-3">Recipient</th>
              <th className="px-6 py-3">Address Detail</th>
              <th className="px-6 py-3">Classification</th>
              <th className="px-6 py-3">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search className="w-8 h-8 opacity-20" />
                    <p>{hasFilters ? 'No records match your filters.' : 'No scan history available.'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedHistory.map((scan) => (
                <tr key={scan.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900">
                      {new Date(scan.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(scan.timestamp).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {scan.data?.recipient || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate text-slate-600">
                     <span className="block text-slate-900 truncate" title={scan.data?.address}>{scan.data?.address}</span>
                     <span className="text-xs text-slate-500">{scan.data?.city}, {scan.data?.country}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">
                        {scan.data?.sorting_center_id}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {scan.data?.pin_code}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${(scan.data?.confidence || 0) > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                       <span className="font-medium text-slate-700">{scan.data?.confidence}%</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryLog;