import React, { useState, useEffect, useRef } from 'react';
import { getBrain, saveContentSprint, getContentSprint } from '../services/brain';
import { TessDayPlan, FeedItem, BrainData, ContentScenario } from '../types';
import { generateTessWeek, generateGenAiImage, generateTessCard } from '../services/geminiService';
import { UploadIcon, MagicIcon, RefreshIcon, CheckIcon } from './icons';

interface ContentStudioProps { onAddToFeed?: (item: FeedItem) => void; }

const ContentStudio: React.FC<ContentStudioProps> = ({ onAddToFeed }) => {
  const [brain, setBrain] = useState<BrainData>(getBrain());
  
  // Workflow State
  const [uiState, setUiState] = useState<'selection' | 'briefing' | 'review'>('selection');
  const [selectedScenario, setSelectedScenario] = useState<ContentScenario | null>(null);
  const [sprintDuration, setSprintDuration] = useState<7 | 14>(7);
  
  const [weekPlan, setWeekPlan] = useState<TessDayPlan[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const [briefingText, setBriefingText] = useState('');
  const [briefingImage, setBriefingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setBrain(getBrain()); }, []);

  const handleScenarioSelect = (scenario: ContentScenario, days: 7 | 14) => {
      setSelectedScenario(scenario);
      setSprintDuration(days);
      setBriefingText('');
      setBriefingImage(null);
      setUiState('briefing');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => setBriefingImage(ev.target?.result as string);
          reader.readAsDataURL(e.target.files[0]);
      }
  };

  const handleGeneratePlan = async () => {
      if (!briefingText) return alert("Give me a little context first!");
      setLoading(true);
      try {
          const context = briefingImage ? `${briefingText} [User uploaded a reference image]` : briefingText;
          const plan = await generateTessWeek(brain, context, sprintDuration, [], [], selectedScenario || 'RELATABLE');
          setWeekPlan(plan);
          setSelectedIndices(plan.map((_, i) => i)); // Select all by default
          setUiState('review');
      } catch (e) { alert("My brain froze. Try again."); } 
      finally { setLoading(false); }
  };

  const handleRefreshCard = async (index: number, pillar: string) => {
      setGeneratingId(index);
      try {
          const newCard = await generateTessCard(brain, pillar);
          if (newCard) {
              const newPlan = [...weekPlan];
              newPlan[index] = { ...newCard, day: weekPlan[index].day }; // Keep day number
              setWeekPlan(newPlan);
          }
      } catch (e) { alert("Failed to refresh card."); } 
      finally { setGeneratingId(null); }
  };

  const handleConfirmAndCreate = async () => {
      if (selectedIndices.length === 0) return;
      setLoading(true);
      setProcessingProgress(0);
      
      const total = selectedIndices.length;
      let completed = 0;

      for (const idx of selectedIndices) {
          const card = weekPlan[idx];
          let img = card.imageUrl;
          
          // Generate Visual if missing
          if (!img && card.assetType === 'generate') {
              try {
                  img = await generateGenAiImage(card.visualPrompt, true, false, briefingImage, '9:16');
              } catch (e) { console.error("Img Gen Failed", e); }
          } else if (briefingImage && card.assetType === 'camera_roll') {
              img = briefingImage;
          }

          if (onAddToFeed) {
              onAddToFeed({
                  id: `SPRINT_${Date.now()}_${idx}`,
                  caption: `${card.hook}\n\n${card.caption}`,
                  imageUrls: img ? [img] : [],
                  type: 'image',
                  status: 'draft',
                  notes: `Strategy: ${card.pillar} | Hook: ${card.hook}`,
                  hashtags: []
              });
          }
          
          completed++;
          setProcessingProgress(Math.round((completed / total) * 100));
      }
      
      setLoading(false);
      setUiState('selection'); // Reset to start
      alert("✅ All assets created and sent to Feed Planner!");
  };

  const toggleSelection = (index: number) => {
      setSelectedIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden relative">
        
        {/* VIEW 1: SCENARIO SELECTION */}
        {uiState === 'selection' && (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-8 animate-fade-in overflow-y-auto">
                <div className="text-center mb-10">
                    <h3 className="text-4xl font-black text-brand-dark mb-2 tracking-tight">Content Engine</h3>
                    <p className="text-gray-500 text-lg">Choose your mission.</p>
                </div>
                
                <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-3 gap-6">
                    {[
                        { id: 'LAUNCH', label: 'Product Launch', icon: '🚀', desc: 'Hype & Reveals' },
                        { id: 'NEWS', label: 'Industry News', icon: '📰', desc: 'Hot Takes & Reaction' },
                        { id: 'PROMO', label: 'Hard Promo', icon: '💸', desc: 'Sales & Offers' },
                        { id: 'VLOG_WEEK', label: 'Vlog Week', icon: '📹', desc: 'Documentation & Reality' },
                        { id: 'RELATABLE', label: 'Relatable Filler', icon: '☕️', desc: 'Vibes & Routine' },
                        { id: 'EDUCATION', label: 'Education', icon: '🧠', desc: 'Value & Tips' },
                    ].map((scen) => (
                        <div key={scen.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:border-brand-purple hover:shadow-xl transition-all group flex flex-col justify-between">
                            <div className="mb-4">
                                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform origin-left">{scen.icon}</div>
                                <h4 className="text-xl font-bold text-brand-dark">{scen.label}</h4>
                                <p className="text-xs text-gray-400 mt-1">{scen.desc}</p>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => handleScenarioSelect(scen.id as ContentScenario, 7)} className="flex-1 py-2 bg-gray-50 hover:bg-brand-purple hover:text-white rounded-xl text-xs font-bold transition-colors">7 Days</button>
                                <button onClick={() => handleScenarioSelect(scen.id as ContentScenario, 14)} className="flex-1 py-2 bg-gray-50 hover:bg-brand-pink hover:text-white rounded-xl text-xs font-bold transition-colors">14 Days</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* VIEW 2: BRIEFING */}
        {uiState === 'briefing' && (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-6 animate-fade-in">
                <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-gray-100 max-w-lg w-full relative">
                    <button onClick={() => setUiState('selection')} className="absolute top-8 right-8 text-gray-400 hover:text-brand-dark">✕</button>
                    
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-brand-dark text-white flex items-center justify-center text-3xl shadow-lg">🤖</div>
                        <div>
                            <div className="text-[10px] font-bold text-brand-purple uppercase tracking-widest">{selectedScenario} • {sprintDuration} DAYS</div>
                            <h3 className="text-xl font-bold text-brand-dark leading-tight">What are we focusing on?</h3>
                        </div>
                    </div>

                    <textarea 
                        value={briefingText}
                        onChange={(e) => setBriefingText(e.target.value)}
                        placeholder="e.g. We are launching the summer collection next Friday..." 
                        className="w-full h-32 bg-gray-50 rounded-2xl p-5 text-base border border-gray-100 focus:border-brand-purple outline-none resize-none mb-4 shadow-inner"
                        autoFocus
                    />

                    <div className="flex gap-2 mb-6">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 h-16 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand-purple hover:bg-brand-purple/5 transition-all text-gray-400 gap-2"
                        >
                            {briefingImage ? <span className="text-green-500 font-bold flex items-center gap-2"><CheckIcon className="w-4 h-4"/> Image Added</span> : <><UploadIcon className="w-4 h-4" /><span className="text-xs font-bold">Add Visual Context</span></>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </div>

                    <button 
                        onClick={handleGeneratePlan} 
                        disabled={loading}
                        className="w-full py-5 bg-brand-dark text-white rounded-2xl font-bold text-xl shadow-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loading ? <span className="animate-spin">🌀</span> : <MagicIcon className="w-6 h-6" />}
                        {loading ? 'Thinking...' : 'Generate Plan'}
                    </button>
                </div>
            </div>
        )}

        {/* VIEW 3: POP-UP REVIEW (THE MODAL) */}
        {uiState === 'review' && (
            <div className="fixed inset-0 z-50 bg-gray-100/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
                <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[40px] shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                        <div>
                            <h3 className="text-2xl font-black text-brand-dark tracking-tight">Review {sprintDuration}-Day Sprint</h3>
                            <p className="text-gray-500 text-sm">Select the posts you want to create.</p>
                        </div>
                        <button onClick={() => setUiState('selection')} className="px-6 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors">Cancel</button>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-8 bg-gray-50 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {weekPlan.map((card, idx) => (
                                <div key={idx} className={`relative bg-white p-5 rounded-3xl border transition-all hover:shadow-lg flex flex-col gap-3 group ${selectedIndices.includes(idx) ? 'border-brand-purple ring-1 ring-brand-purple' : 'border-gray-100 opacity-60'}`}>
                                    {/* Selection Checkbox */}
                                    <div className="absolute top-4 left-4 z-10">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIndices.includes(idx)} 
                                            onChange={() => toggleSelection(idx)}
                                            className="w-5 h-5 rounded-full text-brand-purple focus:ring-brand-purple cursor-pointer accent-brand-purple"
                                        />
                                    </div>
                                    
                                    {/* Refresh Button */}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleRefreshCard(idx, card.pillar); }}
                                        disabled={generatingId === idx}
                                        className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-brand-purple hover:text-white rounded-full text-gray-400 transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                                        title="Regenerate Idea"
                                    >
                                        {generatingId === idx ? <span className="animate-spin block">⚡️</span> : <RefreshIcon className="w-4 h-4"/>}
                                    </button>

                                    <div className="mt-6">
                                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded uppercase tracking-wider">{card.pillar}</span>
                                    </div>
                                    
                                    <h4 className="font-bold text-brand-dark leading-snug min-h-[3rem]">"{card.hook}"</h4>
                                    <p className="text-xs text-gray-500 line-clamp-3">{card.caption}</p>
                                    
                                    <div className="mt-auto pt-3 border-t border-gray-100 text-[10px] font-mono text-gray-400">
                                        Day {card.day} • {card.format}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 bg-white border-t border-gray-100 flex justify-between items-center shrink-0">
                        <div className="text-sm font-bold text-gray-500">
                            {selectedIndices.length} posts selected
                        </div>
                        <button 
                            onClick={handleConfirmAndCreate}
                            disabled={loading || selectedIndices.length === 0}
                            className="bg-brand-dark text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl hover:scale-105 transition-transform flex items-center gap-3 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin">⚡️</span> 
                                    Creating Assets {processingProgress}%...
                                </>
                            ) : (
                                <>
                                    <span>🚀</span> 
                                    Generate & Send to Workspace
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ContentStudio;