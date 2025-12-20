import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ScanLine, History, Share2, Mail, Menu, Bell, User, BarChart3, FileText, TrendingUp, Map } from 'lucide-react';
import Scanner from './components/Scanner';
import Dashboard from './components/Dashboard';
import HistoryLog from './components/HistoryLog';
import NetworkViz from './components/NetworkViz';
import MapViz from './components/MapViz';
import Analytics from './components/Analytics';
import NotificationCenter from './components/NotificationCenter';
import BulkProcessor from './components/BulkProcessor';
import AdvancedAnalytics from './components/AdvancedAnalytics';
import UserProfile from './components/UserProfile';
import { AppView, ScanResult } from './types';
import { supabase } from './supabaseClient';
import './testMapData'; // Import test data utilities
import './csvImporter'; // Import CSV import utilities

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCompactSidebar, setIsCompactSidebar] = useState(false);

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
      {/* Sidebar - India Post Theme */}
      <aside className={`fixed inset-y-0 left-0 z-50 ${isCompactSidebar ? 'w-20' : 'w-72'} bg-slate-800 text-white transform transition-all duration-300 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 flex flex-col shadow-2xl ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 flex items-center gap-4 border-b border-white/20">
          <div className="relative group">
             <div className="absolute inset-0 bg-white rounded-xl blur opacity-40 group-hover:opacity-60 transition-opacity"></div>
             <div className="relative bg-orange-500 p-2.5 rounded-xl shadow-lg border-2 border-white/30">
               <Mail className="w-6 h-6 text-white" />
             </div>
          </div>
          {!isCompactSidebar && (
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight leading-none">India Post AI</h1>
              <p className="text-xs text-orange-100 font-medium mt-1">स्मार्ट डाक सेवा</p>
              <p className="text-xs text-blue-100 font-medium">Digital India Initiative</p>
            </div>
          )}

          <div className="ml-auto">
            <button
              aria-pressed={isCompactSidebar ? "true" : "false"}
              aria-label={isCompactSidebar ? 'Expand sidebar' : 'Compact sidebar'}
              title={isCompactSidebar ? 'Expand sidebar' : 'Compact sidebar'}
              onClick={() => setIsCompactSidebar(s => !s)}
              className="p-2 rounded-md text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav role="navigation" aria-label="Main menu" className="flex-1 p-6 space-y-3 mt-2">
          <p className="px-4 text-xs font-bold text-orange-200 uppercase tracking-wider mb-2">मुख्य मेनू | Main Menu</p>
          <NavButton 
            active={currentView === AppView.DASHBOARD} 
            onClick={() => { setCurrentView(AppView.DASHBOARD); setIsMobileMenuOpen(false); }}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="डैशबोर्ड | Dashboard"
            description="Overview & Stats"
            color="bg-orange-500"
            compact={isCompactSidebar}
          />
          <NavButton 
            active={currentView === AppView.NETWORK} 
            onClick={() => { setCurrentView(AppView.NETWORK); setIsMobileMenuOpen(false); }}
            icon={<Share2 className="w-5 h-5" />}
            label="नेटवर्क | Network"
            description="Topology & Status"
            color="bg-green-600"
            compact={isCompactSidebar}
          /> 
          <NavButton 
            active={currentView === AppView.MAP} 
            onClick={() => { setCurrentView(AppView.MAP); setIsMobileMenuOpen(false); }} 
            icon={<Map className="w-5 h-5" />}
            label="मानचित्र | Live Map"
            description="Geographic View"
            color="bg-emerald-600"
            compact={isCompactSidebar}
          /> 
          <NavButton 
            active={currentView === AppView.SCANNER} 
            onClick={() => { setCurrentView(AppView.SCANNER); setIsMobileMenuOpen(false); }}
            icon={<ScanLine className="w-5 h-5" />}
            label="स्कैन | Scan & Sort"
            description="Process Mail"
            color="bg-blue-600"
            compact={isCompactSidebar}
          />
          <NavButton 
            active={currentView === AppView.HISTORY} 
            onClick={() => { setCurrentView(AppView.HISTORY); setIsMobileMenuOpen(false); }} 
            icon={<History className="w-5 h-5" />}
            label="इतिहास | History"
            description="Archive & Exports"
            color="bg-red-500"
            compact={isCompactSidebar}
          />
          <NavButton 
            active={currentView === AppView.BULK} 
            onClick={() => { setCurrentView(AppView.BULK); setIsMobileMenuOpen(false); }} 
            icon={<FileText className="w-5 h-5" />}
            label="बल्क | Bulk Process"
            description="Multiple Scans"
            color="bg-indigo-600"
            compact={isCompactSidebar}
          />
          <NavButton 
            active={currentView === AppView.ANALYTICS} 
            onClick={() => { setCurrentView(AppView.ANALYTICS); setIsMobileMenuOpen(false); }} 
            icon={<BarChart3 className="w-5 h-5" />}
            label="विश्लेषण | Analytics"
            description="Data & Reports"
            color="bg-purple-600"
            compact={isCompactSidebar}
          />
          <NavButton 
            active={currentView === AppView.ADVANCED_ANALYTICS} 
            onClick={() => { setCurrentView(AppView.ADVANCED_ANALYTICS); setIsMobileMenuOpen(false); }} 
            icon={<TrendingUp className="w-5 h-5" />}
            label="उन्नत विश्लेषण | Advanced"
            description="Deep Insights"
            color="bg-emerald-600"
            compact={isCompactSidebar}
          />
        </nav>

        <div className="p-6 border-t border-white/20 bg-black/20">
          <div className="bg-gradient-to-r from-orange-600/50 to-green-600/50 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-orange-100 uppercase tracking-wider">सिस्टम स्थिति | System Status</span>
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-white text-sm font-medium">
              Connected | जुड़ा हुआ
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-orange-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Header - India Post Theme */}
        <header className="bg-white/90 backdrop-blur-md border-b border-orange-200 sticky top-0 z-30 shadow-sm">
          <div className="max-w-7xl mx-0 px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
                title="Toggle menu"
                className="md:hidden p-2 text-orange-600 hover:text-orange-800 hover:bg-orange-100 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-50 border border-orange-200">
                  <Mail className="w-5 h-5 text-orange-600" aria-hidden />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                    {currentView === AppView.DASHBOARD && 'India Post Dashboard | डैशबोर्ड'}
                    {currentView === AppView.NETWORK && 'Network Overview | नेटवर्क अवलोकन'}
                    {currentView === AppView.SCANNER && 'Mail Processing | डाक प्रसंस्करण'}
                    {currentView === AppView.HISTORY && 'Scan History | स्कैन इतिहास'}
                    {currentView === AppView.ANALYTICS && 'Data Analytics | डेटा विश्लेषण'}
                    {currentView === AppView.BULK && 'Bulk Processing | बल्क प्रोसेसिंग'}
                    {currentView === AppView.ADVANCED_ANALYTICS && 'Advanced Analytics | उन्नत विश्लेषण'}
                  </h2>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-sm font-semibold text-slate-700">{new Date().toLocaleDateString('hi-IN', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                <span className="text-xs text-orange-600">भारतीय डाक विभाग</span>
              </div>
              <NotificationCenter onNewScan={(data) => console.log('New scan notification:', data)} />
              <UserProfile onAction={(action) => console.log('User action:', action)} />
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-full mx-0 h-full flex flex-col">
            <div className="flex-1 animate-fade-in">
              {currentView === AppView.DASHBOARD && <Dashboard history={history} />}
              {currentView === AppView.NETWORK && <NetworkViz scanHistory={history} />}
              {currentView === AppView.MAP && <MapViz scanHistory={history} />}
              {currentView === AppView.SCANNER && <Scanner onScanComplete={handleScanComplete} />}
              {currentView === AppView.HISTORY && <HistoryLog history={history} />}
              {currentView === AppView.ANALYTICS && <Analytics />}
              {currentView === AppView.BULK && <BulkProcessor onBulkProcess={(results) => {
                const newScans = results.map(result => ({ ...result, timestamp: new Date().getTime() }));
                setHistory(prev => [...newScans, ...prev]);
              }} />}
              {currentView === AppView.ADVANCED_ANALYTICS && <AdvancedAnalytics scanHistory={history} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label, description, color, compact }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, description: string, color: string, compact?: boolean }) => (
  <button
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    aria-current={active ? 'page' : undefined}
    aria-label={label}
    title={compact ? label : undefined}
    className={`w-full group flex items-center gap-4 ${compact ? 'justify-center' : 'px-4 py-3.5'} rounded-2xl transition-all duration-300 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      active 
        ? `${color} text-white shadow-lg shadow-black/20` 
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
    }`}
  >
    <div className={`p-2 rounded-xl transition-colors ${active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500 group-hover:text-slate-300 group-hover:bg-slate-700'}`}>
      {icon}
    </div>
    {!compact && (
      <div className="text-left">
        <p className={`font-semibold text-sm ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{label}</p>
        <p className={`text-xs ${active ? 'text-white/70' : 'text-slate-500 group-hover:text-slate-400'}`}>{description}</p>
      </div>
    )}
  </button>
);

export default App;