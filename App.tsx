import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ScanLine, History, Share2, Mail, Menu, Bell, User } from 'lucide-react';
import Scanner from './components/Scanner';
import Dashboard from './components/Dashboard';
import HistoryLog from './components/HistoryLog';
import NetworkViz from './components/NetworkViz';
import { AppView, ScanResult } from './types';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch data from Supabase on mount
  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('mail_scans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching history:', error);
      } else if (data) {
        const mappedHistory: ScanResult[] = data.map((row: any) => ({
          id: row.id,
          timestamp: new Date(row.created_at).getTime(),
          status: row.status,
          originalImageUrl: row.original_image_url || undefined,
          data: {
            recipient: row.recipient,
            address: row.address,
            pin_code: row.pin_code,
            city: row.city,
            state: row.state,
            country: row.country,
            sorting_center_id: row.sorting_center_id,
            sorting_center_name: row.sorting_center_name,
            confidence: row.confidence
          }
        }));
        setHistory(mappedHistory);
      }
    };

    fetchHistory();
  }, []);

  const handleScanComplete = (result: ScanResult) => {
    setHistory(prev => [result, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar - Vibrant Dark Theme */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#0f172a] text-slate-300 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 flex flex-col shadow-2xl ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 flex items-center gap-4 border-b border-indigo-900/30">
          <div className="relative group">
             <div className="absolute inset-0 bg-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition-opacity"></div>
             <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg border border-indigo-400/20">
               <Mail className="w-6 h-6 text-white" />
             </div>
          </div>
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight leading-none">SmartMail</h1>
            <p className="text-xs text-indigo-300 font-medium mt-1">Sorter Pro v2.0</p>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3 mt-2">
          <p className="px-4 text-xs font-bold text-indigo-400/80 uppercase tracking-wider mb-2">Main Menu</p>
          <NavButton 
            active={currentView === AppView.DASHBOARD} 
            onClick={() => { setCurrentView(AppView.DASHBOARD); setIsMobileMenuOpen(false); }}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard"
            description="Overview & Stats"
            color="bg-blue-500"
          />
          <NavButton 
            active={currentView === AppView.NETWORK} 
            onClick={() => { setCurrentView(AppView.NETWORK); setIsMobileMenuOpen(false); }}
            icon={<Share2 className="w-5 h-5" />}
            label="Network"
            description="Topology & Status"
            color="bg-purple-500"
          />
          <NavButton 
            active={currentView === AppView.SCANNER} 
            onClick={() => { setCurrentView(AppView.SCANNER); setIsMobileMenuOpen(false); }}
            icon={<ScanLine className="w-5 h-5" />}
            label="Scan & Sort"
            description="Process Envelopes"
            color="bg-emerald-500"
          />
          <NavButton 
            active={currentView === AppView.HISTORY} 
            onClick={() => { setCurrentView(AppView.HISTORY); setIsMobileMenuOpen(false); }} 
            icon={<History className="w-5 h-5" />}
            label="Log History"
            description="Archive & Exports"
            color="bg-amber-500"
          />
        </nav>

        <div className="p-6 border-t border-indigo-900/30 bg-[#0f172a]/50">
          <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 backdrop-blur-sm rounded-xl p-4 border border-indigo-500/20 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">System Status</span>
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-indigo-100 text-sm font-medium">
              Connected
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-0 px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
                title="Toggle menu"
                className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100">
                  <Mail className="w-5 h-5 text-indigo-600" aria-hidden />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                    {currentView === AppView.DASHBOARD && 'Operational Dashboard'}
                    {currentView === AppView.NETWORK && 'Network Overview'}
                    {currentView === AppView.SCANNER && 'Envelope Processing'}
                    {currentView === AppView.HISTORY && 'Scan Log'}
                  </h2>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-sm font-semibold text-slate-700">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                <span className="text-xs text-slate-500">NYC-HUB-01</span>
              </div>
              <button aria-label="Notifications" title="Notifications" className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 border-2 border-white shadow-md flex items-center justify-center text-white font-bold">
                <User className="w-5 h-5" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-full mx-0 h-full flex flex-col">
            <div className="flex-1 animate-fade-in">
              {currentView === AppView.DASHBOARD && <Dashboard history={history} />}
              {currentView === AppView.NETWORK && <NetworkViz />}
              {currentView === AppView.SCANNER && <Scanner onScanComplete={handleScanComplete} />}
              {currentView === AppView.HISTORY && <HistoryLog history={history} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label, description, color }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, description: string, color: string }) => (
  <button
    onClick={onClick}
    className={`w-full group flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 relative overflow-hidden ${
      active 
        ? `${color} text-white shadow-lg shadow-black/20` 
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
    }`}
  >
    <div className={`p-2 rounded-xl transition-colors ${active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500 group-hover:text-slate-300 group-hover:bg-slate-700'}`}>
      {icon}
    </div>
    <div className="text-left">
      <p className={`font-semibold text-sm ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{label}</p>
      <p className={`text-xs ${active ? 'text-white/70' : 'text-slate-500 group-hover:text-slate-400'}`}>{description}</p>
    </div>
  </button>
);

export default App;