
import React, { useState, useEffect } from 'react';
import { getClients, setActiveClient, getActiveClientId, createClient } from '../services/brain';
import { ClientMeta } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const [clients, setClients] = useState<ClientMeta[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>('');
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
      const load = () => {
          setClients(getClients());
          setActiveClientId(getActiveClientId());
      };
      load();
      window.addEventListener('client_changed', load);
      return () => window.removeEventListener('client_changed', load);
  }, []);

  const handleSwitch = (id: string) => {
      setActiveClient(id);
      setShowSwitcher(false);
  };

  const handleCreateClient = async () => {
      if (!newClientName) return;
      setIsCreating(true);
      try {
          const newId = await createClient(newClientName);
          setNewClientName('');
          setTimeout(() => {
              setIsCreating(false);
              handleSwitch(newId);
          }, 500);
      } catch (e) {
          console.error("Creation failed", e);
          setIsCreating(false);
      }
  };
  
  const activeClientName = clients.find(c => c.id === activeClientId)?.name || "Loading...";

  const navItems = [
    { id: 'content', label: 'Content Studio', icon: '✍️' },
    { id: 'planner', label: 'Feed Planner', icon: '🗓️' },
    { id: 'brain', label: 'Persona Engine', icon: '🧠' },
    { id: 'studio', label: 'Thumbnail Studio', icon: '🎨' },
    { id: 'trends', label: 'Trend Hunter', icon: '📈' },
    { id: 'vision', label: 'Vision Analyst', icon: '👁️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="w-72 glass-panel h-full flex flex-col z-20 shadow-sm relative shrink-0">
      <div className="p-6 border-b border-gray-200/50">
          <div 
            className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-white/50 transition-all"
            onClick={() => setShowSwitcher(!showSwitcher)}
          >
             <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md ${activeClientId === 'tess_admin' ? 'bg-gradient-to-br from-brand-purple to-brand-pink' : 'bg-brand-dark'}`}>
                 {activeClientName.substring(0, 2).toUpperCase()}
             </div>
             <div className="flex-1 min-w-0">
                 <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Active Account</div>
                 <div className="font-extrabold text-brand-dark truncate flex items-center gap-2">
                     {activeClientName}
                     <span className={`transition-transform text-xs ${showSwitcher ? 'rotate-180' : ''}`}>▼</span>
                 </div>
             </div>
          </div>

          {showSwitcher && (
              <div className="absolute top-20 left-4 right-4 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {clients.map(c => (
                          <button 
                            key={c.id}
                            onClick={() => handleSwitch(c.id)}
                            className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center justify-between hover:bg-gray-50 ${c.id === activeClientId ? 'text-brand-purple bg-brand-purple/5' : 'text-gray-600'}`}
                          >
                              {c.name}
                              {c.id === activeClientId && <span className="text-xs">●</span>}
                          </button>
                      ))}
                  </div>
                  <div className="p-3 border-t border-gray-100 bg-gray-50">
                      <div className="flex gap-2">
                          <input 
                            autoFocus
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            placeholder="New Client Name..."
                            className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-300 outline-none focus:border-brand-purple bg-white text-brand-dark"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()}
                            disabled={isCreating}
                          />
                          <button 
                            onClick={handleCreateClient} 
                            disabled={isCreating || !newClientName}
                            className="bg-brand-dark text-white px-3 rounded-lg text-xs font-bold hover:bg-gray-800 disabled:opacity-50"
                          >
                              {isCreating ? '...' : 'Add'}
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </div>
      
      <div className="px-8 py-4">
         <p className="text-xs text-brand-muted font-medium">Tess OS v5.6 • {activeClientId === 'tess_admin' ? 'Agency Mode' : 'Client Mode'}</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-semibold ${
              activeTab === item.id 
                ? 'bg-white shadow-md text-brand-dark ring-1 ring-black/5' 
                : 'text-brand-muted hover:bg-white/50 hover:text-brand-dark'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
