import React, { useState } from 'react';
import { LayoutDashboard, ScanLine, History, Settings, Mail } from 'lucide-react';
import Scanner from './components/Scanner';
import Dashboard from './components/Dashboard';
import { AppView, ScanResult } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [history, setHistory] = useState<ScanResult[]>([]);

  const handleScanComplete = (result: ScanResult) => {
    setHistory(prev => [...prev, result]);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 fixed h-full z-10 hidden md:flex flex-col transition-all">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
             <Mail className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight">SmartMail</h1>
            <p className="text-xs text-slate-500">Sorter Pro v1.0</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavButton 
            active={currentView === AppView.DASHBOARD} 
            onClick={() => setCurrentView(AppView.DASHBOARD)}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard"
          />
          <NavButton 
            active={currentView === AppView.SCANNER} 
            onClick={() => setCurrentView(AppView.SCANNER)}
            icon={<ScanLine className="w-5 h-5" />}
            label="Scan & Sort"
          />
          <NavButton 
            active={currentView === AppView.HISTORY} 
            onClick={() => setCurrentView(AppView.DASHBOARD)} // Re-using dashboard for history in this demo
            icon={<History className="w-5 h-5" />}
            label="Log History"
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-2">System Status</p>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-sm font-medium text-slate-200">ML Model Online</span>
            </div>
            <div className="text-xs text-slate-500">Backend: Gemini 2.5 Flash</div>
          </div>
        </div>
      </aside>

      {/* Mobile Header (visible only on small screens) */}
      <div className="md:hidden fixed top-0 w-full bg-slate-900 text-white z-20 p-4 flex items-center justify-between">
         <span className="font-bold">SmartMailSorter</span>
         <button onClick={() => setCurrentView(currentView === AppView.SCANNER ? AppView.DASHBOARD : AppView.SCANNER)}>
            {currentView === AppView.SCANNER ? <LayoutDashboard /> : <ScanLine />}
         </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 min-h-screen">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {currentView === AppView.DASHBOARD && 'Operational Dashboard'}
                {currentView === AppView.SCANNER && 'Envelope Processing'}
                {currentView === AppView.HISTORY && 'Scan Log'}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {currentView === AppView.DASHBOARD && 'Real-time metrics and accuracy reporting'}
                {currentView === AppView.SCANNER && 'Upload, process, and classify mail items'}
              </p>
            </div>
            
            {/* Simple Date Display */}
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-slate-900">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p className="text-xs text-slate-500">Center ID: NYC-HUB-01</p>
            </div>
          </header>

          <div className="flex-1">
            {currentView === AppView.DASHBOARD && <Dashboard history={history} />}
            {currentView === AppView.SCANNER && <Scanner onScanComplete={handleScanComplete} />}
          </div>
        </div>
      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    {icon}
    <span className="font-medium text-sm">{label}</span>
  </button>
);

export default App;