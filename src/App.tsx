import React, { useState, useEffect } from 'react';
import SpatialDock from './components/SpatialDock'; 
import FeedPlanner from './components/Dashboard'; 
import FeedDock from './components/FeedDock';     
import AgentCommand from './components/AgentCommand';
import ContentStudio from './components/ContentStudio'; 
import BrainManager from './components/BrainManager';   
import ProductionLab from './components/ProductionLab'; 
import Settings from './components/Settings';
import LandingPage from './components/LandingPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initDataLayer, saveFeed, getFeed, setActiveClient } from './services/brain';
import { FeedPost } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [userRole, setUserRole] = useState<'admin' | 'client'>('admin');
  const [activeTab, setActiveTab] = useState('planner'); 
  const [rightPanel, setRightPanel] = useState<'feed' | 'agent'>('agent');
  const [isInit, setIsInit] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { 
      initDataLayer().then(() => setIsInit(true));
      window.addEventListener('client_changed', () => setRefreshKey(prev => prev + 1));
  }, []);

  const handleLogin = async (role: 'admin' | 'client', clientId?: string) => {
      setUserRole(role);
      if (role === 'client' && clientId) {
          await setActiveClient(clientId);
          setRightPanel('feed'); 
      } else {
          setRightPanel('agent');
      }
      setView('app');
  };

  const handleLogout = () => {
      setView('landing');
      setUserRole('admin'); 
  };

  const handleAddToFeed = (newItem: any) => {
      console.log("Add to feed requested", newItem);
      window.dispatchEvent(new Event('brain_updated')); 
  };

  const handleSyncToFeed = (posts: any[]) => {
      console.log("Sync to feed requested", posts);
      window.dispatchEvent(new Event('brain_updated')); 
  };

  const renderMainContent = () => {
     if (userRole === 'client') {
        if (activeTab === 'planner') return <FeedPlanner userRole="client" />;
        if (activeTab === 'brain') return <BrainManager />;
        return <Settings />;
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

  if (!isInit) return <div className="h-screen w-full flex items-center justify-center bg-gray-50">Loading...</div>;
  if (view === 'landing') return <LandingPage onLogin={handleLogin} />;

  return (
    // SPATIAL CONTAINER
    <div className="h-screen w-full bg-gray-50 font-sans overflow-hidden relative bg-dot-grid-animate flex">
      
      {/* 1. FLOATING DOCK (Left) */}
      <div className="shrink-0 z-50">
          <SpatialDock activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} onLogout={handleLogout} />
      </div>

      {/* 2. MAIN STAGE (Center Bento Card) */}
      <main className="flex-1 relative py-4 pr-2 pl-0"> 
        <div className="h-full w-full bento-card overflow-hidden shadow-2xl relative z-10 flex flex-col">
            <ErrorBoundary key={refreshKey}>
                {renderMainContent()}
            </ErrorBoundary>
        </div>
      </main>

      {/* 3. RIGHT PANEL (Glass Panel) */}
      <aside className="w-[380px] shrink-0 py-4 pr-4 pl-2 z-40 flex flex-col gap-4">
        {/* Agent/Feed Toggle */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl p-1.5 flex shadow-sm border border-white/40 shrink-0">
             <button onClick={() => setRightPanel('agent')} className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${rightPanel === 'agent' ? 'bg-white shadow-md text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}>🤖 Agent</button>
             <button onClick={() => setRightPanel('feed')} className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${rightPanel === 'feed' ? 'bg-white shadow-md text-brand-purple' : 'text-gray-400 hover:text-gray-600'}`}>🗓️ Grid</button>
        </div>
        
        {/* The Content Card */}
        <div className="flex-1 bento-card overflow-hidden relative">
            {userRole === 'admin' ? (
                <div className="h-full" key={refreshKey}>
                    {rightPanel === 'agent' ? <AgentCommand onSyncToFeed={handleSyncToFeed} userRole="admin" /> : <FeedDock userRole="admin" />}
                </div>
            ) : (
                <div className="h-full">
                   {rightPanel === 'feed' ? <FeedDock userRole="client" /> : <AgentCommand onSyncToFeed={()=>{}} userRole="client" />}
                </div>
            )}
        </div>
      </aside>
    </div>
  );
};

export default App;