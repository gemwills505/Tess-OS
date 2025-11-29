import React, { useState, useEffect, useRef } from 'react';
import { getBrain, updateBrain, getBank, saveBank } from '../services/brain';
import { TessDayPlan, FeedItem, BrainData, SprintDuration, Product } from '../types';
import { generateTessWeek, generateTessCard, generateWeeklyFocusIdeas } from '../services/geminiService';

interface ContentStudioProps {
    onAddToFeed?: (item: FeedItem) => void;
}

// --- IMAGE UTILS ---
const resizeImage = (file: File, maxWidth = 800, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
    });
};

const ContentStudio: React.FC<ContentStudioProps> = ({ onAddToFeed }) => {
  const [brain, setBrain] = useState<BrainData>(getBrain());
  const [weekPlan, setWeekPlan] = useState<TessDayPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState('');
  const [sprintDuration, setSprintDuration] = useState<SprintDuration>(14); // Default to 2 weeks for more variety
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [activeCard, setActiveCard] = useState<TessDayPlan | null>(null);
  
  // Ideas State
  const [focusIdeas, setFocusIdeas] = useState<string[]>([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  
  // Product Selection State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  
  // Launch Assets State
  const [launchAssets, setLaunchAssets] = useState<string[]>([]);
  
  // Phone Gallery State
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const launchAssetInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setBrain(getBrain());
  }, []);

  const handleGiveMeWeek = async () => {
      if (!focus.trim()) {
          alert("Please enter a focus for the sprint.");
          return;
      }
      setLoading(true);
      setWeekPlan([]);
      try {
          const activeProducts = brain.brand.products.filter(p => selectedProductIds.includes(p.id));
          const plan = await generateTessWeek(brain, focus, sprintDuration, activeProducts, launchAssets);
          setWeekPlan(plan);
      } catch (e) {
          alert("Failed to generate the plan. Check API connection.");
      } finally {
          setLoading(false);
      }
  };

  const handleInspireMe = async () => {
      setIsLoadingIdeas(true);
      try {
          const ideas = await generateWeeklyFocusIdeas(brain);
          setFocusIdeas(ideas);
      } catch (e) {
          setFocusIdeas(["It's a slow news week, just vibes", "Launch a new offer", "Customer appreciation week", "Seasonal trend report", "Day in the life of the CEO"]);
      } finally {
          setIsLoadingIdeas(false);
      }
  };

  const handleSwapCard = async (index: number, pillar: string) => {
      setRegeneratingIndex(index);
      try {
          const newCard = await generateTessCard(brain, pillar);
          if (newCard) {
              setWeekPlan(prev => {
                  const next = [...prev];
                  next[index] = newCard;
                  return next;
              });
          }
      } catch (e) {
          alert("Failed to swap card.");
      } finally {
          setRegeneratingIndex(null);
      }
  };

  const handleUseCard = (card: TessDayPlan) => {
      if (!onAddToFeed) return;
      
      let imageUrl = null;
      if (card.assetType === 'camera_roll' && brain.identity.cameraRoll && brain.identity.cameraRoll.length > 0) {
          // If it's a "Miso" card, look for Miso context? For now random from roll.
          const randomIndex = Math.floor(Math.random() * brain.identity.cameraRoll.length);
          imageUrl = brain.identity.cameraRoll[randomIndex];
      }

      onAddToFeed({
          id: `TESS_WEEK_${Date.now()}`,
          type: 'image',
          imageUrls: imageUrl ? [imageUrl] : [],
          caption: `${card.hook}\n\n${card.caption}`,
          hashtags: ['#tess_os'],
          metadata: {
              pillar: card.pillar,
              format: card.format,
              why: card.whyItWorks,
              veo: card.veoPrompt
          }
      });
      
      alert("Sent to Feed Planner!");
  };

  // --- SMART THUMBNAIL MAKER ---
  const generateSmartThumbnail = async (card: TessDayPlan) => {
      if (!card.textOverlay) return;
      alert(`Generating branded thumbnail with text: "${card.textOverlay}" (Canvas Logic Stub)`);
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const resized = await resizeImage(file);
          const newRoll = [...(brain.identity.cameraRoll || []), resized];
          const newBrain = { ...brain, identity: { ...brain.identity, cameraRoll: newRoll } };
          setBrain(newBrain);
          updateBrain(newBrain);
      }
  };
  
  const handleLaunchAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files) as File[];
          const newAssets: string[] = [];
          
          for (const file of files) {
              const resized = await resizeImage(file);
              newAssets.push(resized);
          }
          setLaunchAssets(prev => [...prev, ...newAssets]);
      }
      e.target.value = '';
  };

  const removeLaunchAsset = (idx: number) => {
      setLaunchAssets(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSendToBank = (photoUrl: string) => {
      const currentBank = getBank();
      const newBank = [...currentBank, { id: `BANK_${Date.now()}`, imageUrl: photoUrl }];
      saveBank(newBank);
      alert("Saved to Thumbnail Bank!");
  };

  const handleDeletePhoto = (photoUrl: string) => {
      const newRoll = (brain.identity.cameraRoll || []).filter(p => p !== photoUrl);
      const newBrain = { ...brain, identity: { ...brain.identity, cameraRoll: newRoll } };
      setBrain(newBrain);
      updateBrain(newBrain);
      setSelectedPhoto(null);
  };
  
  const toggleProductSelection = (id: string) => {
      setSelectedProductIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto h-screen overflow-hidden flex flex-col">
      <header className="mb-4 flex-shrink-0">
        <div className="inline-block px-3 py-1 bg-brand-dark text-white text-[10px] font-bold rounded-full uppercase tracking-widest mb-2">Content Engine</div>
        <h2 className="text-3xl font-extrabold text-brand-dark tracking-tight">Content Studio</h2>
      </header>

      <div className="flex-1 flex gap-8 overflow-hidden pb-10">
          {/* LEFT: THE MACHINE */}
          <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* FOCUS INPUT */}
              {!weekPlan.length && !loading && (
                  <div className="flex-1 flex flex-col items-center justify-center mb-10 overflow-y-auto custom-scrollbar">
                      <div className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex-shrink-0">
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">What is the focus this sprint?</label>
                          <textarea 
                              value={focus}
                              onChange={(e) => setFocus(e.target.value)}
                              placeholder="e.g. 'Just keep engagement up', or 'Talk about the new launch', or 'It's raining so everyone is sad'"
                              className="w-full h-24 p-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-brand-purple outline-none resize-none text-lg text-brand-dark placeholder-gray-300 mb-4 text-center"
                          />
                          
                          {/* LAUNCH ASSETS (New) */}
                          <div className="mb-6">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Launch Assets (Optional)</label>
                              <div className="flex flex-wrap gap-2 justify-center">
                                  {launchAssets.map((asset, i) => (
                                      <div key={i} className="w-12 h-12 relative rounded-lg overflow-hidden border border-gray-200 group">
                                          <img src={asset} className="w-full h-full object-cover" />
                                          <button onClick={() => removeLaunchAsset(i)} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                      </div>
                                  ))}
                                  <button 
                                    onClick={() => launchAssetInputRef.current?.click()}
                                    className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-brand-purple hover:text-brand-purple transition-colors"
                                  >
                                      +
                                  </button>
                                  <input type="file" multiple accept="image/*" ref={launchAssetInputRef} className="hidden" onChange={handleLaunchAssetUpload} />
                              </div>
                              <p className="text-[10px] text-center text-gray-400 mt-2">Upload product shots or vibes for the AI to analyze.</p>
                          </div>
                          
                          {/* PRODUCT SELECTOR */}
                          {brain.brand.products.length > 0 && (
                              <div className="mb-6">
                                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Featured Products (Shadow Selling)</label>
                                  <div className="flex flex-wrap gap-2 justify-center max-h-32 overflow-y-auto custom-scrollbar p-1">
                                      {brain.brand.products.map(prod => (
                                          <button 
                                              key={prod.id}
                                              onClick={() => toggleProductSelection(prod.id)}
                                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${selectedProductIds.includes(prod.id) ? 'bg-brand-purple text-white border-brand-purple shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                          >
                                              {prod.imageUrl && <img src={prod.imageUrl} className="w-4 h-4 rounded-full object-cover" />}
                                              {prod.name}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}
                          
                          {/* SPRINT DURATION TOGGLE */}
                          <div className="flex justify-center gap-4 mb-6">
                              <button 
                                onClick={() => setSprintDuration(7)} 
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${sprintDuration === 7 ? 'bg-brand-purple text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                              >
                                7 Days (Sprint)
                              </button>
                              <button 
                                onClick={() => setSprintDuration(14)} 
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${sprintDuration === 14 ? 'bg-brand-purple text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                              >
                                14 Days (Marathon)
                              </button>
                          </div>
                          
                          {/* INSPIRE ME SECTION */}
                          <div className="mb-6">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] font-bold text-brand-purple uppercase tracking-wider">Need Ideas?</span>
                                  <button onClick={handleInspireMe} disabled={isLoadingIdeas} className="text-[10px] font-bold text-gray-500 hover:text-brand-purple flex items-center gap-1 transition-colors">
                                      {isLoadingIdeas ? <span className="animate-spin">⚡️</span> : '✨'} Inspire Me
                                  </button>
                              </div>
                              {focusIdeas.length > 0 && (
                                  <div className="flex flex-wrap gap-2 justify-center">
                                      {focusIdeas.map((idea, i) => (
                                          <button 
                                              key={i} 
                                              onClick={() => setFocus(idea)} 
                                              className="text-[10px] font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full hover:border-brand-purple hover:bg-brand-purple/5 hover:text-brand-purple transition-all text-gray-600"
                                          >
                                              {idea}
                                          </button>
                                      ))}
                                  </div>
                              )}
                          </div>

                          <button 
                              onClick={handleGiveMeWeek}
                              className="group relative w-full py-6 bg-brand-dark rounded-2xl shadow-lg hover:scale-105 transition-transform duration-300 overflow-hidden"
                          >
                              <div className="absolute inset-0 bg-gradient-to-r from-brand-purple/20 to-brand-pink/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              <h3 className="text-xl font-black text-white relative z-10 flex items-center justify-center gap-2">
                                  <span>🚀</span> Draft {sprintDuration}-Day Strategy
                              </h3>
                          </button>
                      </div>
                  </div>
              )}

              {loading && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="text-6xl mb-6 animate-bounce">👀</div>
                      <h3 className="text-2xl font-bold text-brand-dark animate-pulse">Stalking your niche...</h3>
                      <p className="text-brand-purple font-mono mt-2 text-sm">Validating personality. Checking role...</p>
                  </div>
              )}

              {weekPlan.length > 0 && (
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-4">
                      <div className="flex justify-between items-center mb-2">
                          <h3 className="font-bold text-brand-muted text-xs uppercase tracking-widest">{sprintDuration}-Day Deployment Plan</h3>
                          <button onClick={() => setWeekPlan([])} className="text-xs text-red-400 hover:underline">Reset</button>
                      </div>
                      
                      {weekPlan.map((card, idx) => (
                          <div key={idx} onClick={() => setActiveCard(card)} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex gap-6 group relative overflow-hidden cursor-pointer">
                              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand-purple to-brand-pink"></div>
                              
                              {/* Thumbnail Preview */}
                              <div className="w-24 h-32 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden relative">
                                  <div className="absolute inset-0 flex items-center justify-center text-center p-2 bg-brand-dark/5">
                                      <span className="text-[10px] font-black text-brand-dark uppercase leading-tight">{card.thumbnailHeadline}</span>
                                  </div>
                                  <div className="absolute bottom-1 right-1 text-[8px] bg-white/80 px-1 rounded shadow font-bold">{card.assetType === 'camera_roll' ? 'GALLERY' : 'AI GEN'}</div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[10px] font-bold bg-brand-dark text-white px-2 py-0.5 rounded uppercase">Day {card.day}</span>
                                      <span className="text-[10px] font-bold text-brand-purple uppercase tracking-wider">{card.pillar}</span>
                                      {card.assetType === 'generate' && <span className="text-[8px] font-mono text-gray-400 border border-gray-200 px-1 rounded">NANO BANANA</span>}
                                  </div>
                                  <h4 className="text-lg font-black text-brand-dark mb-2 leading-tight">"{card.hook}"</h4>
                                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{card.caption}</p>
                                  <div className="flex items-center gap-3">
                                      <span className="text-[10px] font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{card.format}</span>
                                      <span className="text-[10px] text-green-600 font-bold italic truncate">Why: {card.whyItWorks}</span>
                                  </div>
                              </div>

                              {/* Actions */}
                              <div className="flex flex-col justify-center gap-2">
                                  <button 
                                      onClick={(e) => { e.stopPropagation(); handleUseCard(card); }}
                                      className="bg-brand-dark text-white px-4 py-2 rounded-lg text-xs font-bold hover:scale-105 transition-transform shadow-lg"
                                  >
                                      Use
                                  </button>
                                  <button 
                                      onClick={(e) => { e.stopPropagation(); handleSwapCard(idx, card.pillar); }}
                                      disabled={regeneratingIndex === idx}
                                      className="bg-white border border-gray-200 text-gray-500 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors"
                                  >
                                      {regeneratingIndex === idx ? '...' : 'Swap'}
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          {/* RIGHT: PHONE MOCKUP */}
          <div className="w-[380px] flex-shrink-0 flex flex-col items-center justify-center relative">
              <div className="w-full h-[750px] bg-white rounded-[50px] shadow-2xl border-[12px] border-gray-100 overflow-hidden relative ring-4 ring-gray-200">
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-7 w-28 bg-gray-100 rounded-b-2xl z-20"></div>
                  <div className="w-full h-full bg-white flex flex-col">
                      <div className="h-12 flex justify-between items-center px-6 pt-2">
                          <span className="text-xs font-bold text-black">9:41</span>
                          <div className="flex gap-1 text-xs text-black">📶 🔋</div>
                      </div>
                      <div className="px-6 pb-4 flex justify-between items-end">
                          <h3 className="text-2xl font-bold text-black">Photos</h3>
                          <button onClick={() => fileInputRef.current?.click()} className="text-brand-purple font-bold text-sm">Select</button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-1">
                          <div className="grid grid-cols-3 gap-0.5">
                              {(brain.identity.cameraRoll || []).map((photo, idx) => (
                                  <div key={idx} onClick={() => setSelectedPhoto(photo)} className="aspect-square bg-gray-100 relative cursor-pointer">
                                      <img src={photo} className="w-full h-full object-cover" />
                                  </div>
                              ))}
                              <div onClick={() => fileInputRef.current?.click()} className="aspect-square bg-gray-50 flex items-center justify-center cursor-pointer hover:bg-gray-100">
                                  <span className="text-2xl text-gray-300">+</span>
                              </div>
                          </div>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} />
                      </div>
                      <div className="h-20 bg-white/90 backdrop-blur border-t border-gray-200 flex justify-around items-start pt-4 pb-8 px-6">
                          <div className="flex flex-col items-center gap-1 text-blue-500"><div className="w-6 h-6 bg-blue-500 rounded-md"></div><span className="text-[10px] font-medium">Library</span></div>
                      </div>
                  </div>
                  {selectedPhoto && (
                      <div className="absolute inset-0 bg-black z-30 flex flex-col animate-fade-in">
                          <div className="flex-1 flex items-center justify-center relative">
                              <img src={selectedPhoto} className="max-w-full max-h-full object-contain" />
                              <button onClick={() => setSelectedPhoto(null)} className="absolute top-4 left-4 text-white font-bold text-lg">❮ Back</button>
                          </div>
                          <div className="h-24 bg-black/80 backdrop-blur flex items-center justify-around px-6">
                              <button onClick={() => handleSendToBank(selectedPhoto)} className="flex flex-col items-center gap-1 text-blue-400"><span className="text-xl">📤</span><span className="text-[10px]">To Bank</span></button>
                              <button onClick={() => handleDeletePhoto(selectedPhoto)} className="flex flex-col items-center gap-1 text-red-500"><span className="text-xl">🗑️</span><span className="text-[10px]">Delete</span></button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* DETAIL MODAL */}
      {activeCard && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl relative">
                  <button onClick={() => setActiveCard(null)} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full">✕</button>
                  <div className="mb-6">
                      <span className="text-[10px] font-bold bg-brand-purple text-white px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">{activeCard.pillar}</span>
                      <h2 className="text-3xl font-black text-brand-dark">{activeCard.hook}</h2>
                  </div>
                  <div className="space-y-6">
                      <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                          <h4 className="text-xs font-bold text-green-700 uppercase mb-1">Why it works</h4>
                          <p className="text-sm text-green-900">{activeCard.whyItWorks}</p>
                      </div>
                      <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">VEO 3.1 Prompt</h4>
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm font-mono text-gray-700">{activeCard.veoPrompt}</div>
                      </div>
                      <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Script</h4>
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm italic text-gray-700">"{activeCard.script || "No speech"}"</div>
                      </div>
                      <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Smart Thumbnail</h4>
                          <div className="flex gap-4 items-center">
                              <div className="flex-1 bg-gray-100 p-3 rounded-xl text-sm font-bold text-gray-700 border border-gray-200">{activeCard.textOverlay}</div>
                              <button onClick={() => generateSmartThumbnail(activeCard)} className="bg-brand-dark text-white px-4 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-gray-800">Generate</button>
                          </div>
                      </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                      <button onClick={() => { handleUseCard(activeCard); setActiveCard(null); }} className="bg-brand-purple text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-brand-pink transition-colors">Confirm & Add to Feed</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ContentStudio;