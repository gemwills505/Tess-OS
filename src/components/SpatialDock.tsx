import React, { useState, useEffect } from 'react';
import { getClients, setActiveClient, getActiveClientId, createClient, TESS_ID } from '../services/brain';
import { ClientMeta } from '../types';

interface SpatialDockProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: 'admin' | 'client';
  onLogout: () => void;
}

const SpatialDock: React.FC<SpatialDockProps> = ({ activeTab, setActiveTab, userRole, onLogout }) => {
  const [clients, setClients] = useState<ClientMeta[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>('');
  const [showClientMenu, setShowClientMenu] = useState(false);
  
  // Refresh Data
  useEffect(() => {
      const load = () => {
          setClients(getClients());
          setActiveClientId(getActiveClientId());
      };
      load();
      window.addEventListener('client_changed', load);
      return () => window.removeEventListener('client_changed', load);
  }, []);

  // Helper to get initial
  const getClientInitial = () => {
      if (activeClientId === TESS_ID) return 'T';
      const c = clients.find(cl => cl.id === activeClientId);
      return c ? c.name.substring(0,1).toUpperCase() : 'C';
  };

  // Define Tools with Icons
  const tools = userRole === 'admin' ? [
    { id: 'planner', icon: '🗓️', label: 'Feed' },
    { id: 'content', icon: '⚡️', label: 'Sprint' },
    { id: 'create', icon: '🎨', label: 'Studio' },
    { id: 'brain', icon: '🧠', label: 'Brain' },
  ] : [
    { id: 'planner', icon: '🗓️', label: 'Feed' },
    { id: 'brain', icon: '🧠', label: 'Brand' },
  ];

  return (
    <div className="h-full flex flex-col items-center py-6 px-4 z-50">
        
        {/* 1. CLIENT SWITCHER (FLOATING ORB) */}
        <div className="relative mb-8">
            <button 
                onClick={() => userRole === 'admin' && setShowClientMenu(!showClientMenu)}
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-dark to-gray-800 text-white font-black text-xl shadow-lg hover:scale-110 transition-transform flex items-center justify-center border-2 border-white/20 ${userRole === 'client' ? 'cursor-default' : 'cursor-pointer'}`}
            >
                {getClientInitial()}
            </button>
            
            {/* Client Menu Popover */}
            {showClientMenu && userRole === 'admin' && (
                <div className="absolute left-16 top-0 w-64 bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-4 animate-fade-in origin-top-left z-[100]">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">Workspaces</h3>
                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                        {clients.map(c => (
                            <button 
                                key={c.id}
                                onClick={() => { setActiveClient(c.id); setShowClientMenu(false); }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors ${activeClientId === c.id ? 'bg-brand-dark text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* 2. NAVIGATION DOCK */}
        <div className="spatial-dock flex flex-col gap-4">
            {tools.map(tool => (
                <div key={tool.id} className="relative group">
                    <button
                        onClick={() => setActiveTab(tool.id)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-300 ${activeTab === tool.id ? 'bg-brand-purple text-white shadow-md scale-110' : 'text-gray-400 hover:bg-gray-100 hover:text-brand-dark'}`}
                    >
                        {tool.icon}
                    </button>
                    
                    {/* Hover Label (Tooltip) */}
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-brand-dark text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50">
                        {tool.label}
                    </div>
                </div>
            ))}
        </div>

        {/* 3. SETTINGS & LOGOUT (BOTTOM) */}
        <div className="mt-auto flex flex-col gap-3">
            <button 
                onClick={() => setActiveTab('settings')}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all hover:rotate-90 ${activeTab === 'settings' ? 'text-brand-dark' : 'text-gray-300 hover:text-gray-500'}`}
                title="Settings"
            >
                ⚙️
            </button>
            <button 
                onClick={onLogout}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all hover:bg-red-50 text-gray-300 hover:text-red-500"
                title="Log Out"
            >
                ✕
            </button>
        </div>
    </div>
  );
};

export default SpatialDock;