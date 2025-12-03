import React, { useState, useEffect, useRef } from 'react';
import { getBrain, updateBrain, resetBrain, getActiveClientId, TESS_ID } from '../services/brain';
import { BrainData, LocationData, Product } from '../types';
import { generateGenAiImage, analyzeLocationImage } from '../services/geminiService';
import { TrashIcon, EyeIcon, DownloadIcon, CloseIcon, RefreshIcon } from './icons';
import SocialStrategy from './SocialStrategy'; 

// --- AUTO-RESIZE TEXTAREA ---
const AutoResizeTextarea = ({ value, onChange, placeholder, className }: { value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, placeholder?: string, className?: string }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        const el = textareaRef.current;
        if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
    }, [value]);
    return <textarea ref={textareaRef} value={value} onChange={onChange} placeholder={placeholder} className={`${className} overflow-hidden resize-none min-h-[3rem]`} rows={1} />;
};

const resizeImage = (file: File, maxWidth = 1024, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height = (maxWidth / width) * height; width = maxWidth; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality));
            };
        };
    });
};

const BrainManager: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'tess' | 'strategy' | 'locations' | 'nosho' | 'training' | 'bible' | 'cv' | 'products'>('tess');
  const [brain, setBrain] = useState<BrainData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isGeneratingLocations, setIsGeneratingLocations] = useState(false);
  const [previewLocImage, setPreviewLocImage] = useState<{url: string, name: string} | null>(null);
  
  const isFirstRender = useRef(true);
  const isInternalUpdate = useRef(false); // Flag to prevent infinite loops

  // Initial Load
  useEffect(() => {
    const load = () => {
        // If WE just triggered the update, don't reload and cause a re-render loop
        if (isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }
        const loaded = getBrain();
        if (loaded) setBrain(loaded);
    };
    load();
    window.addEventListener('brain_updated', load);
    return () => window.removeEventListener('brain_updated', load);
  }, []);

  // Auto-Save Logic (Debounced)
  useEffect(() => {
      if (isFirstRender.current) { isFirstRender.current = false; return; }
      if (!brain) return;
      
      // Optimization: Don't save if nothing changed (simple ref check)
      const currentStored = getBrain();
      if (JSON.stringify(brain) === JSON.stringify(currentStored)) return;

      setSaveStatus('saving');
      const timer = setTimeout(() => { 
          isInternalUpdate.current = true; // Mark as internal update
          updateBrain(brain); 
          setSaveStatus('saved'); 
          setTimeout(() => setSaveStatus('idle'), 2000); 
      }, 1500);
      
      return () => clearTimeout(timer);
  }, [brain]);

  // --- HANDLERS ---
  const handleReset = () => { 
      if (confirm("Reset Brain to Defaults?")) { 
          const fresh = resetBrain();
          setBrain(fresh); 
      } 
  };
  
  const handleGenerateLocationImages = async () => {
      if (!brain) return; setIsGeneratingLocations(true);
      try {
          const newLocs = { ...brain.locations };
          for (const key of Object.keys(newLocs)) {
              if (newLocs[key].imageUrl) continue;
              const prompt = `MASTER SHOT: ${newLocs[key].name}. ${newLocs[key].visualData}. EMPTY ROOM. NO PEOPLE.`;
              const img = await generateGenAiImage(prompt, false, true, null, '16:9', brain);
              if (img) newLocs[key] = { ...newLocs[key], imageUrl: img, imageUrls: [img] };
          }
          setBrain({ ...brain, locations: newLocs });
      } catch (e) { alert("Generation failed"); } finally { setIsGeneratingLocations(false); }
  };

  const handleLocationImageUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0] && brain) {
          const base64 = await resizeImage(e.target.files[0]);
          setBrain({...brain, locations: {...brain.locations, [key]: {...brain.locations[key], imageUrl: base64}}});
      }
  };

  if (!brain) return <div className="p-10">Loading...</div>;
  const isTessAdmin = getActiveClientId() === TESS_ID;

  return (
    // FIX 1: Added h-full overflow-y-auto to enable scrolling
    <div className="h-full overflow-y-auto custom-scrollbar p-8 pb-32 animate-fade-in relative">
      <div className="max-w-6xl mx-auto">
          <header className="mb-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-md py-4 px-6 rounded-2xl border border-white/50 shadow-sm">
            <div><h2 className="text-3xl font-extrabold text-brand-dark tracking-tight">Persona Engine</h2><p className="text-brand-muted text-sm">Configure identity, strategy, and aesthetics.</p></div>
            <div className="flex gap-3 items-center">
                {isTessAdmin && <button onClick={handleReset} className="px-4 py-2 rounded-xl bg-brand-dark text-white text-xs font-bold shadow-md">Restore Tess Defaults</button>}
                {!isTessAdmin && <button onClick={handleReset} className="px-4 py-2 rounded-xl text-red-400 hover:bg-red-50 text-xs font-bold border border-red-100">Reset to Blank</button>}
                <div className="flex items-center gap-2 px-4">{saveStatus === 'saving' && <span className="text-xs font-bold text-brand-purple animate-pulse">Saving...</span>}{saveStatus === 'saved' && <span className="text-xs font-bold text-green-500">Saved</span>}</div>
            </div>
          </header>

          <div className="flex gap-2 mb-8 p-1 bg-gray-100 rounded-xl inline-flex overflow-x-auto max-w-full custom-scrollbar">
            {[{ id: 'tess', label: '👤 Identity' }, { id: 'strategy', label: '♟️ Strategy' }, { id: 'cv', label: '📄 CV' }, { id: 'locations', label: '📍 Locations' }, { id: 'products', label: '🛍️ Products' }, { id: 'bible', label: '💅 Style' }, { id: 'nosho', label: '🏢 Brand' }].map((tab) => (
                <button key={tab.id} onClick={() => setActiveSection(tab.id as any)} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeSection === tab.id ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>{tab.label}</button>
            ))}
          </div>

          {activeSection === 'strategy' && <div className="animate-fade-in"><SocialStrategy /></div>}

          {activeSection === 'tess' && (
              <div className="glass-effect p-8 rounded-3xl animate-fade-in space-y-6">
                  <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest mb-6">Core Identity</h3>
                  <div className="grid grid-cols-2 gap-4"><div><label className="label-sm">Name</label><input value={brain.identity.name} onChange={(e) => setBrain({...brain, identity: {...brain.identity, name: e.target.value}})} className="input-std" /></div><div><label className="label-sm">Role</label><input value={brain.identity.role} onChange={(e) => setBrain({...brain, identity: {...brain.identity, role: e.target.value}})} className="input-std" /></div></div>
                  <div><label className="label-sm">Bio</label><AutoResizeTextarea value={brain.identity.bio} onChange={(e) => setBrain({...brain, identity: {...brain.identity, bio: e.target.value}})} className="input-area" /></div>
                  <div><label className="label-sm">Backstory</label><AutoResizeTextarea value={brain.identity.backstory} onChange={(e) => setBrain({...brain, identity: {...brain.identity, backstory: e.target.value}})} className="input-area" /></div>
              </div>
          )}

          {activeSection === 'locations' && (
                 <div className="animate-fade-in space-y-6">
                     <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                         <h3 className="text-xl font-bold text-brand-dark">Locations</h3>
                         <button onClick={handleGenerateLocationImages} disabled={isGeneratingLocations} className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50">{isGeneratingLocations ? 'Generating...' : 'Generate Visuals'}</button>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {(Object.entries(brain.locations) as [string, LocationData][]).map(([key, loc]) => (
                             <div key={key} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
                                 <input value={loc.name} onChange={(e) => setBrain({...brain, locations: {...brain.locations, [key]: {...loc, name: e.target.value}}})} className="font-bold text-lg text-brand-dark w-full bg-transparent border-none p-0 focus:ring-0" />
                                 <div className="aspect-video bg-gray-50 rounded-xl overflow-hidden relative group">
                                     {loc.imageUrl ? <img src={loc.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300">No Image</div>}
                                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                         <label className="cursor-pointer bg-white text-black px-3 py-1.5 rounded text-xs font-bold">Upload<input type="file" className="hidden" onChange={(e) => handleLocationImageUpload(key, e)} /></label>
                                         {loc.imageUrl && <button onClick={() => setPreviewLocImage({url: loc.imageUrl!, name: loc.name})} className="bg-brand-purple text-white px-3 py-1.5 rounded text-xs font-bold">View</button>}
                                     </div>
                                 </div>
                                 <AutoResizeTextarea value={loc.visualData} onChange={(e) => setBrain({...brain, locations: {...brain.locations, [key]: {...loc, visualData: e.target.value}}})} className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg" placeholder="Visual description..." />
                             </div>
                         ))}
                     </div>
                 </div>
          )}

          {/* Preview Modal */}
          {previewLocImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-fade-in" onClick={() => setPreviewLocImage(null)}>
                    <img src={previewLocImage.url} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
                    <button onClick={() => { const a = document.createElement('a'); a.href = previewLocImage.url; a.download = 'location.png'; a.click(); }} className="mt-4 bg-white text-black px-6 py-3 rounded-full font-bold">Download</button>
                </div>
          )}
      </div>
    </div>
  );
};

export default BrainManager;