import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import FeedPlanner from './components/Dashboard'; 
import FeedDock from './components/FeedDock';     
import AgentCommand from './components/AgentCommand';
import ContentStudio from './components/ContentStudio';
import BrainManager from './components/BrainManager';
import ProductionLab from './components/ProductionLab';
import Settings from './components/Settings';
import { initDataLayer, saveFeed, getFeed } from './services/brain';
import { FeedPost } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('planner'); 
  const [rightPanel, setRightPanel] = useState<'feed' | 'agent'>('agent');
  const [isInit, setIsInit] = useState(false);

  useEffect(() => { initDataLayer().then(() => setIsInit(true)); }, []);

  const handleAddToFeed = (newItem: any) => {
      const current = getFeed();
      const emptyIdx = current.findIndex(p => p.type === 'empty');
      const newPosts = [...current];
      const post: FeedPost = {
          id: newItem.id || `POST_${Date.now()}`,
          caption: newItem.caption || '',
          imageUrl: newItem.imageUrls?.[0] || newItem.imageUrl || null,
          date: new Date().toISOString(),
          status: 'draft' as const,
          type: newItem.type || 'image',
          notes: newItem.notes || ''
      };
      if (emptyIdx !== -1) newPosts[emptyIdx] = post; else newPosts.unshift(post);
      saveFeed(newPosts);
      setRightPanel('feed');
  };

  const handleSyncToFeed = (posts: any[]) => {
      const current = getFeed();
      const actualContent = current.filter(p => p.type !== 'empty');
      const merged = [...posts, ...actualContent].slice(0, 50);
      while(merged.length < 9) merged.push({ id: `pad_${Date.now()}_${Math.random()}`, type: 'empty' as const, status: 'draft' as const, date: '', imageUrl: null, caption: '' });
      saveFeed(merged);
      setRightPanel('feed');
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case 'planner': return <FeedPlanner />; 
      case 'content': return <ContentStudio onAddToFeed={handleAddToFeed} />; // Includes TrendHunter
      case 'create': return <ProductionLab onAddToFeed={handleAddToFeed} />;  // Includes Studio, Voice, Vision
      case 'brain': return <BrainManager />; // Includes Strategy
      case 'settings': return <Settings />;
      default: return <FeedPlanner />;
    }
  };

  if (!isInit) return <div className="h-screen w-full flex items-center justify-center">Loading...</div>;

  return (
    <div className="flex h-screen w-full font-sans bg-gray-100 overflow-hidden">
      <div className="shrink-0 z-30 h-full"><Sidebar activeTab={activeTab} setActiveTab={setActiveTab} /></div>
      <main className="flex-1 relative overflow-hidden flex flex-col bg-gray-50 shadow-inner">{renderMainContent()}</main>
      <aside className="shrink-0 z-20 h-full bg-white border-l border-gray-200 flex flex-col shadow-xl w-[350px]">
        <div className="flex border-b border-gray-200">
            <button onClick={() => setRightPanel('agent')} className={`flex-1 py-3 text-xs font-bold uppercase ${rightPanel === 'agent' ? 'bg-brand-dark text-white' : 'text-gray-500'}`}>🤖 Agent</button>
            <button onClick={() => setRightPanel('feed')} className={`flex-1 py-3 text-xs font-bold uppercase ${rightPanel === 'feed' ? 'bg-brand-purple text-white' : 'text-gray-500'}`}>🗓️ Grid</button>
        </div>
        <div className="flex-1 overflow-hidden relative">
            {rightPanel === 'agent' ? <AgentCommand onSyncToFeed={handleSyncToFeed} /> : <FeedDock />}
        </div>
      </aside>
    </div>
  );
};

export default App;