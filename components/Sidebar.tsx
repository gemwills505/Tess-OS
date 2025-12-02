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
  
  useEffect(() => {
      setClients(getClients());
      setActiveClientId(getActiveClientId());
      window.addEventListener('client_changed', () => { setClients(getClients()); setActiveClientId(getActiveClientId()); });
  }, []);

  const navItems = [
    { id: 'planner', label: 'Feed Planner', icon: '🗓️' },
    { id: 'content', label: 'Content Engine', icon: '⚡️' }, 
    { id: 'create', label: 'Production Lab', icon: '🎨' },
    { id: 'brain', label: 'Brand Brain', icon: '🧠' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-white h-full flex flex-col z-20 border-r border-gray-200">
      <div className="p-6">
         <h1 className="font-extrabold text-brand-dark text-lg">Tess OS</h1>
         <p className="text-xs text-gray-400">{activeClientId === 'tess_admin' ? 'Agency Mode' : 'Client Mode'}</p>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === item.id ? 'bg-brand-purple/10 text-brand-purple' : 'text-gray-500 hover:bg-gray-50'}`}>
            <span>{item.icon}</span><span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
export default Sidebar;