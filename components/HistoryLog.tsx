import React, { useState, useMemo } from 'react';
import { ScanResult } from '../types';
import { ArrowUp, ArrowDown, FileText, Search, X, Calendar, Download, Filter } from 'lucide-react';

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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
      {/* Header and Controls */}
      <div className="px-6 py-6 border-b border-slate-100 flex flex-col gap-6 bg-slate-50/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600 shadow-sm">
               <FileText className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-lg font-bold text-slate-800">Scan History Log</h3>
               <p className="text-sm text-slate-500 font-medium">
                 {filteredHistory.length} <span className="text-slate-400">records found</span>
               </p>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={sortedHistory.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
            >
              {sortOrder === 'desc' ? (
                <>
                  <ArrowDown className="w-4 h-4 text-slate-400" />
                  <span>Newest</span>
                </>
              ) : (
                <>
                  <ArrowUp className="w-4 h-4 text-slate-400" />
                  <span>Oldest</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search by recipient, address, or PIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center px-2 text-slate-400">
               <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="py-1.5 px-2 border-none text-sm text-slate-600 focus:ring-0 bg-transparent font-medium"
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="py-1.5 px-2 border-none text-sm text-slate-600 focus:ring-0 bg-transparent font-medium"
            />
          </div>

          {hasFilters && (
             <button
              onClick={clearFilters}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors"
             >
               <X className="w-4 h-4" />
               Clear
             </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th scope="col" className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Timestamp</th>
              <th scope="col" className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Recipient</th>
              <th scope="col" className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Address Detail</th>
              <th scope="col" className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Classification</th>
              <th scope="col" className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-center">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortedHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                    <div className="p-4 bg-slate-50 rounded-full">
                       <Filter className="w-8 h-8 opacity-40" />
                    </div>
                    <p className="font-medium">{hasFilters ? 'No records match your filters.' : 'No scan history available.'}</p>
                    {hasFilters && (
                       <button onClick={clearFilters} className="text-blue-500 hover:text-blue-700 text-xs font-semibold underline">Clear Filters</button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              sortedHistory.map((scan) => (
                <tr key={scan.id} className="hover:bg-slate-50/80 transition-colors group border-l-4 border-l-transparent hover:border-l-blue-500">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-slate-900">
                      {new Date(scan.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      {new Date(scan.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{scan.data?.recipient || 'Unknown'}</div>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                     <div className="text-slate-900 truncate font-medium" title={scan.data?.address}>{scan.data?.address}</div>
                     <div className="text-xs text-slate-500 mt-0.5">{scan.data?.city}, {scan.data?.country}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-start gap-1">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {scan.data?.sorting_center_id}
                      </span>
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 rounded">
                        {scan.data?.pin_code}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                     <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full border-4 text-xs font-bold ${
                        (scan.data?.confidence || 0) > 80 
                          ? 'border-emerald-100 text-emerald-700 bg-emerald-50' 
                          : 'border-amber-100 text-amber-700 bg-amber-50'
                     }`}>
                       {scan.data?.confidence}%
                     </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer / Pagination Placeholder */}
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-400 flex justify-between items-center">
        <span>Showing {sortedHistory.length} items</span>
        <div className="flex gap-2">
           <button disabled className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-50">Prev</button>
           <button disabled className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
};

export default HistoryLog;