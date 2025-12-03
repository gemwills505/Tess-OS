import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import FeedPlanner from './components/Dashboard'; 
import FeedDock from './components/FeedDock';     
import AgentCommand from './components/AgentCommand';
import ContentStudio from './components/ContentStudio'; 
import BrainManager from './components/BrainManager';   
import ProductionLab from './components/ProductionLab'; 
import Settings from './components/Settings';
import LandingPage from './components/LandingPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initDataLayer, setActiveClient } from './services/brain';
import { FeedPost } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [userRole, setUserRole] = useState<'admin' | 'client'>('admin');
  
  const [activeTab, setActiveTab] = useState('planner'); 
  const [rightPanel, setRightPanel] = useState<'feed' | 'agent'>('agent');
  const [isInit, setIsInit] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { 
      const start = async () => {
          await initDataLayer();
          setIsInit(true);
      };
      start();

      const handleClientChange = () => {
          setRefreshKey(prev => prev + 1);
          setActiveTab('planner'); 
      };

      window.addEventListener('client_changed', handleClientChange);
      return () => window.removeEventListener('client_changed', handleClientChange);
  }, []);

  const handleLogin = async (role: 'admin' | 'client', clientId?: string) => {
      setUserRole(role);
      if (role === 'client' && clientId) {
          // In a real app, verify ID. Here we assume 'demo_client' is valid or handled by initDataLayer defaults if missing.
          if (clientId !== 'demo_client') await setActiveClient(clientId);
          
          setRightPanel('feed'); // Clients cannot see Agent
          setActiveTab('planner');
      } else {
          // Admin defaults
          setRightPanel('agent');
      }
      setView('app');
  };

  const handleAddToFeed = (newItem: any) => {
      // Logic handled via services usually, but trigger refresh for good measure
      console.log("Add to feed requested", newItem);
      window.dispatchEvent(new Event('brain_updated')); 
  };

  const handleSyncToFeed = (posts: any[]) => {
      console.log("Sync to feed requested", posts);
      window.dispatchEvent(new Event('brain_updated')); 
  };

  const renderMainContent = () => {
    // SECURITY: If Client, only allow Planner & Settings
    if (userRole === 'client') {
        if (activeTab === 'planner') return <FeedPlanner userRole="client" />;
        if (activeTab === 'settings') return <Settings />;
        return <FeedPlanner userRole="client" />; // Fallback
    }

    switch (activeTab) {
      case 'planner': return <FeedPlanner userRole="admin" />; 
      case 'content': return <ContentStudio onAddToFeed={handleAddToFeed} />; 
      case 'create': return <ProductionLab onAddToFeed={handleAddToFeed} />;
      case 'brain': return <BrainManager />; 
      case 'settings': return <Settings />;
      default: return <FeedPlanner userRole="admin" />;
    }
  };

  if (!isInit) return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white">
          <div className="text-4xl animate-bounce mb-4">🧠</div>
          <div className="font-bold tracking-widest text-xs uppercase">Initializing Tess OS...</div>
      </div>
  );

  if (view === 'landing') return <LandingPage onLogin={handleLogin} />;

  return (
    <div className="flex h-screen w-full font-sans bg-gray-100 overflow-hidden">
      
      {/* 1. NAVIGATION (Fixed Left) */}
      <div className="shrink-0 z-30 h-full">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} />
      </div>

      {/* 2. WORKSPACE (Fluid Center) */}
      <main className="flex-1 relative overflow-hidden flex flex-col bg-gray-50 shadow-inner"> 
        <ErrorBoundary key={refreshKey}>
            {renderMainContent()}
        </ErrorBoundary>
      </main>

      {/* 3. CONTEXT DOCK (Fixed Right) */}
      <aside className="shrink-0 z-20 h-full bg-white border-l border-gray-200 flex flex-col shadow-xl w-[400px]">
        {userRole === 'admin' ? (
            <>
                <div className="flex border-b border-gray-200">
                    <button 
                        onClick={() => setRightPanel('agent')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${rightPanel === 'agent' ? 'bg-brand-dark text-white' : 'text-gray-400 hover:bg-gray-50 hover:text-brand-dark'}`}
                    >
                        🤖 Tess Agent
                    </button>
                    <button 
                        onClick={() => setRightPanel('feed')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${rightPanel === 'feed' ? 'bg-brand-purple text-white' : 'text-gray-400 hover:bg-gray-50 hover:text-brand-dark'}`}
                    >
                        🗓️ Live Grid
                    </button>
                </div>
                <div className="flex-1 overflow-hidden relative" key={refreshKey}>
                    {rightPanel === 'agent' ? (
                        <AgentCommand onSyncToFeed={handleSyncToFeed} />
                    ) : (
                        <FeedDock userRole="admin" />
                    )}
                </div>
            </>
        ) : (
            // CLIENT VIEW: Only sees Feed Dock (No Agent tab)
            <div className="flex-1 overflow-hidden relative h-full">
                <FeedDock userRole="client" />
            </div>
        )}
      </aside>

    </div>
  );
};

export default App;