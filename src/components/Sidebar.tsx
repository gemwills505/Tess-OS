import React, { useState, useEffect, useRef } from 'react';
import { getClients, setActiveClient, getActiveClientId, createClient, getBrain } from '../services/brain';
import { ClientMeta } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: 'admin' | 'client';
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userRole, onLogout }) => {
  const [clients, setClients] = useState<ClientMeta[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>('');
  const [activeClientName, setActiveClientName] = useState<string>('Agency Mode');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      const load = () => {
          const allClients = getClients();
          const activeId = getActiveClientId();
          const currentBrain = getBrain();
          
          setClients(allClients);
          setActiveClientId(activeId);
          
          if (activeId === 'tess_admin') {
              setActiveClientName('Tess (Agency)');
          } else {
              const metaName = allClients.find(c => c.id === activeId)?.name || 'Client';
              const brainName = currentBrain.brand?.name;
              setActiveClientName(brainName || metaName);
          }
      };
      
      load();
      window.addEventListener('client_changed', load);
      window.addEventListener('brain_updated', load);
      
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setIsDropdownOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      
      return () => {
          window.removeEventListener('client_changed', load);
          window.removeEventListener('brain_updated', load);
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, []);

  const handleSwitchClient = async (id: string) => {
      await setActiveClient(id);
      setIsDropdownOpen(false);
  };

  const handleCreateClient = async () => {
      if (!newClientName.trim()) return;
      setIsCreating(true);
      try {
          const newId = await createClient(newClientName);
          await setActiveClient(newId);
          setNewClientName('');
          setIsDropdownOpen(false);
      } catch (e) {
          alert("Failed to create client");
      } finally {
          setIsCreating(false);
      }
  };

  const navItems = userRole === 'admin' ? [
    { id: 'planner', label: 'Feed Planner', icon: '🗓️' },
    { id: 'content', label: 'Content Engine', icon: '⚡️' }, 
    { id: 'create', label: 'Production Lab', icon: '🎨' },
    { id: 'brain', label: 'Brand Brain', icon: '🧠' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ] : [
    { id: 'planner', label: 'My Feed', icon: '🗓️' },
    { id: 'settings', label: 'My Account', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-white h-full flex flex-col z-20 border-r border-gray-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      
      {/* HEADER LOGIC */}
      {userRole === 'admin' ? (
          <div className="p-4 border-b border-gray-100 relative z-50" ref={dropdownRef}>
             <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200 text-left group"
             >
                 <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-dark to-gray-800 text-white flex items-center justify-center font-bold shadow-md group-hover:shadow-lg transition-all">
                     {activeClientName.substring(0,1)}
                 </div>
                 <div className="flex-1 min-w-0">
                     <h1 className="font-bold text-brand-dark text-sm truncate">{activeClientName}</h1>
                     <p className="text-[10px] text-gray-400 font-medium">Switch Client ▼</p>
                 </div>
             </button>

             {isDropdownOpen && (
                 <div className="absolute top-full left-4 right-4 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in">
                     <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                         <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Accounts</h3>
                         {clients.map(client => (
                             <button 
                                key={client.id}
                                onClick={() => handleSwitchClient(client.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold mb-1 flex items-center justify-between ${activeClientId === client.id ? 'bg-brand-purple text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                             >
                                 <span className="truncate">{client.name}</span>
                                 {activeClientId === client.id && <span>●</span>}
                             </button>
                         ))}
                     </div>
                     <div className="p-3 border-t border-gray-100 bg-gray-50">
                         <input 
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            placeholder="New Client Name..."
                            className="w-full text-xs p-2 rounded border border-gray-200 mb-2 outline-none focus:border-brand-purple"
                         />
                         <button 
                            onClick={handleCreateClient}
                            disabled={isCreating || !newClientName.trim()}
                            className="w-full bg-brand-dark text-white text-xs font-bold py-2 rounded hover:bg-gray-800 disabled:opacity-50"
                         >
                             {isCreating ? 'Creating...' : '+ Create Dashboard'}
                         </button>
                     </div>
                 </div>
             )}
          </div>
      ) : (
          <div className="p-6 border-b border-gray-100">
             <div className="w-12 h-12 rounded-2xl bg-brand-purple flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg shadow-brand-purple/20">
                 {activeClientName.substring(0,1)}
             </div>
             <h1 className="font-extrabold text-brand-dark text-xl leading-tight mb-1">{activeClientName}</h1>
             <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Client Portal</p>
             </div>
          </div>
      )}

      {/* NAVIGATION */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <button 
            key={item.id} 
            onClick={() => setActiveTab(item.id)} 
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 group ${activeTab === item.id ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20 translate-x-1' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-dark'}`}
          >
            <span className={`text-lg transition-transform group-hover:scale-110 ${activeTab === item.id ? 'scale-110' : ''}`}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      
      {/* Footer / Info */}
      <div className="p-6 border-t border-gray-100 bg-gray-50/50">
          <button 
            onClick={onLogout}
            className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-bold hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all shadow-sm group"
          >
              <span className="group-hover:-translate-x-1 transition-transform">←</span> Log Out
          </button>
          
          <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
              <span>Tess Agency OS</span>
              <span>v5.6</span>
          </div>
      </div>
    </div>
  );
};
export default Sidebar;