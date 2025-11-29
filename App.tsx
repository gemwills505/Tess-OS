
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TrendHunter from './components/TrendHunter';
import ContentStudio from './components/ContentStudio';
import VisionAnalyst from './components/VisionAnalyst';
import FeedPlanner from './components/Dashboard';
import BrainManager from './components/BrainManager';
import AgentOmniBar from './components/AgentOmniBar';
import Settings from './components/Settings';
import ThumbnailMaker from './components/ThumbnailMaker';
import Onboarding from './components/Onboarding';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedItem, FeedPost } from './types';
import { getBrain, initDataLayer, saveFeed, getFeed } from './services/brain';

const NotificationToast: React.FC<{ message: string, onClose: () => void }> = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed top-6 right-6 z-[100] animate-fade-in">
            <div className="bg-brand-dark text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-700">
                <span className="text-xl">✅</span>
                <span className="font-bold text-sm">{message}</span>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('content'); 
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isInit, setIsInit] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const loadData = async () => {
      setIsInit(false);
      try {
          await initDataLayer();
          const brain = getBrain();
          if (!brain.isConfigured) {
              setShowOnboarding(true);
          } else {
              setShowOnboarding(false);
          }
      } catch (e) {
          console.error("Initialization error:", e);
      } finally {
          setIsInit(true);
      }
  };

  useEffect(() => {
      loadData();
      const handleClientChange = () => {
          loadData();
          setActiveTab('content');
      };
      window.addEventListener('client_changed', handleClientChange);
      return () => window.removeEventListener('client_changed', handleClientChange);
  }, []);

  const handleOnboardingComplete = () => {
      setShowOnboarding(false);
      loadData();
      setActiveTab('brain');
  };
  
  const showToast = (msg: string) => {
      setNotification(msg);
  };

  const handleSyncToFeed = (newPosts: any[]) => {
      const currentPosts = getFeed();
      let finalFeed = [...currentPosts];
      const realContent = finalFeed.filter(p => p.type !== 'empty' && (p.imageUrl || p.caption));
      const combined = [...newPosts, ...realContent].slice(0, 100);
      
      while (combined.length < 9) {
          combined.push({
            id: `SLOT_PAD_${Date.now()}_${Math.random()}`,
            imageUrl: null,
            caption: '',
            date: new Date().toISOString().split('T')[0],
            status: 'draft',
            type: 'empty'
          });
      }

      saveFeed(combined);
      showToast(`Synced ${newPosts.length} posts to Planner`);
      setActiveTab('planner');
  };

  const handleAddToFeed = (item: FeedItem) => {
      const rawFeed = getFeed();
      let currentPosts = rawFeed.length > 0 ? [...rawFeed] : [];
      if (currentPosts.length === 0) {
          for (let i = 0; i < 9; i++) {
              currentPosts.push({
                  id: `SLOT_SAFE_${Date.now()}_${i}`,
                  imageUrl: null,
                  caption: '',
                  date: new Date().toISOString().split('T')[0],
                  status: 'draft',
                  type: 'empty'
              });
          }
      }
      const emptyIndex = currentPosts.findIndex((p: any) => p.type === 'empty');
      const newPost: FeedPost = {
          id: item.id,
          imageUrl: item.imageUrls[0] || null,
          caption: item.caption,
          date: new Date().toISOString().split('T')[0],
          status: 'draft',
          type: item.type,
          notes: item.hashtags.join(' ')
      };
      if (emptyIndex !== -1) {
          currentPosts[emptyIndex] = newPost;
      } else {
          currentPosts.unshift(newPost);
          if (currentPosts.length > 9) currentPosts.pop(); 
      }
      saveFeed(currentPosts);
      showToast('Added 1 item to Feed');
      setActiveTab('planner');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'planner': return <FeedPlanner />;
      case 'studio': return <ThumbnailMaker onAddToFeed={handleAddToFeed} />;
      case 'brain': return <BrainManager />;
      case 'trends': return <TrendHunter />;
      case 'content': return <ContentStudio onAddToFeed={handleAddToFeed} />;
      case 'vision': return <VisionAnalyst />;
      case 'settings': return <Settings />;
      default: return <FeedPlanner />;
    }
  };

  if (!isInit) return <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-brand-dark"><div className="w-12 h-12 border-4 border-brand-purple border-t-transparent rounded-full animate-spin mb-4"></div><h2 className="font-bold text-lg">Initializing...</h2></div>;

  if (showOnboarding) return <Onboarding onComplete={handleOnboardingComplete} />;

  return (
    <div className="flex h-screen w-full font-sans dot-grid overflow-hidden relative bg-[var(--bg-light)]">
      <div className="shrink-0">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
      <main className="flex-1 relative overflow-auto custom-scrollbar"> 
        <div className="min-h-full pb-24">
            <ErrorBoundary>
                {activeTab !== 'temp' && renderContent()}
            </ErrorBoundary>
        </div>
      </main>
      <AgentOmniBar activeTab={activeTab} onSyncToFeed={handleSyncToFeed} />
      {notification && <NotificationToast message={notification} onClose={() => setNotification(null)} />}
    </div>
  );
};

export default App;
