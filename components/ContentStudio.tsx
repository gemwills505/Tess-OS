import React, { useState, useEffect } from 'react';
import { getBrain, saveContentSprint, getContentSprint } from '../services/brain';
import { TessDayPlan, BrainData } from '../types';
import { generateTessWeek, generateGenAiImage } from '../services/geminiService';
import TrendHunter from './TrendHunter'; // <--- CRITICAL IMPORT

interface ContentStudioProps { onAddToFeed?: (item: any) => void; }

const ContentStudio: React.FC<ContentStudioProps> = ({ onAddToFeed }) => {
  const [viewMode, setViewMode] = useState<'sprint' | 'trends'>('sprint');
  const [brain, setBrain] = useState<BrainData>(getBrain());
  const [weekPlan, setWeekPlan] = useState<TessDayPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState('');
  
  useEffect(() => {
      setBrain(getBrain());
      const saved = getContentSprint();
      if (saved && saved.length > 0) setWeekPlan(saved);
  }, []);

  const handleGenerate = async () => {
      if (!focus) return alert("Enter a focus!");
      setLoading(true);
      try {
          const plan = await generateTessWeek(brain, focus, 7, brain.brand.products || [], []);
          setWeekPlan(plan);
          saveContentSprint(plan);
      } catch (e) { alert("Failed to generate."); } 
      finally { setLoading(false); }
  };

  const handleAddToFeedLocal = async (card: TessDayPlan) => {
      if (!onAddToFeed) return;
      let img = card.imageUrl;
      if (!img && card.assetType === 'generate') {
          // Auto generate if missing
          img = await generateGenAiImage(card.visualPrompt, true, false, null, '9:16');
      }
      onAddToFeed({
          id: `SPRINT_${Date.now()}`,
          caption: `${card.hook}\n\n${card.caption}`,
          imageUrls: img ? [img] : [],
          type: 'image',
          status: 'draft',
          notes: `Strategy: ${card.pillar}`,
          hashtags: []
      });
      alert("Added to Grid!");
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shrink-0">
            <h2 className="text-xl font-extrabold text-brand-dark">Content Engine</h2>
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('sprint')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'sprint' ? 'bg-white shadow text-brand-dark' : 'text-gray-500'}`}>⚡️ Strategy Sprint</button>
                <button onClick={() => setViewMode('trends')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'trends' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}>📈 Trend Hunter</button>
            </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
            {viewMode === 'trends' ? (
                <div className="h-full overflow-y-auto"><TrendHunter /></div>
            ) : (
                <div className="h-full flex flex-col p-8 overflow-hidden">
                    {!weekPlan.length && (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block">Sprint Focus</label>
                                <textarea value={focus} onChange={(e) => setFocus(e.target.value)} className="w-full h-32 p-4 bg-gray-50 rounded-xl border border-gray-200 mb-6 text-lg" placeholder="e.g. Slow sales week..." />
                                <button onClick={handleGenerate} disabled={loading} className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold shadow-lg disabled:opacity-50">{loading ? 'Thinking...' : '🚀 Generate Sprint'}</button>
                            </div>
                        </div>
                    )}
                    {weekPlan.length > 0 && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                            <div className="flex justify-between"><h3 className="font-bold text-xs uppercase">7-Day Plan</h3><button onClick={() => setWeekPlan([])} className="text-xs text-red-400">Reset</button></div>
                            {weekPlan.map((card, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-4">
                                    <div className="w-20 h-28 bg-gray-100 rounded-lg shrink-0 overflow-hidden">{card.imageUrl && <img src={card.imageUrl} className="w-full h-full object-cover"/>}</div>
                                    <div className="flex-1">
                                        <div className="flex gap-2 mb-1"><span className="text-[10px] bg-brand-dark text-white px-2 rounded">Day {card.day}</span><span className="text-[10px] font-bold text-brand-purple">{card.pillar}</span></div>
                                        <h4 className="font-black text-sm mb-1">{card.hook}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-2">{card.caption}</p>
                                        <button onClick={() => handleAddToFeedLocal(card)} className="mt-2 text-[10px] bg-brand-purple text-white px-3 py-1.5 rounded font-bold hover:bg-brand-pink">Use Card</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default ContentStudio;