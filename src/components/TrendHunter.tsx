import React, { useState, useMemo, useEffect } from 'react';
import { generateTrendReport, generateTrendScript, generateGenAiImage } from '../services/geminiService';
import { TrendCard, BrainData } from '../types';
import { getPlaybook, savePlaybook, getFeed, saveFeed, getBrain } from '../services/brain';
import { TrashIcon } from './icons';

const EXPERT_STRATEGIES: TrendCard[] = [
    {
        title: "The 3-Act Structure",
        origin: "Storytelling",
        vibe: "Cinematic",
        strategy: "Hook (Problem) -> Twist (Solution) -> CTA (Result). Use for tutorials."
    },
    {
        title: "The 'Comment Bait' Mistake",
        origin: "Engagement Hack",
        vibe: "Sneaky",
        strategy: "Intentionally mispronounce a word or leave a small error to drive corrections in comments."
    },
    {
        title: "The Negative Hook",
        origin: "Psychology",
        vibe: "Warning",
        strategy: "Start with 'Stop doing X' or 'Why your X is failing'. Loss aversion drives clicks."
    },
    {
        title: "POV: relatable situation",
        origin: "Meme Culture",
        vibe: "Relatable",
        strategy: "Use text overlay 'POV: You just realized...' with a reaction video. Zero speaking needed."
    },
    {
        title: "The Carousel Swipe-Through",
        origin: "Educational",
        vibe: "Value",
        strategy: "Slide 1: Big Promise. Slide 2-4: Steps. Last Slide: 'Save for later'. High save rate."
    }
];

const TrendHunter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'trends' | 'playbook'>('trends');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'raw'>('cards');
  const [searchQuery, setSearchQuery] = useState("Viral TikTok Audio UK");
  
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedScript, setGeneratedScript] = useState<any | null>(null);
  const [activeStrategy, setActiveStrategy] = useState<TrendCard | null>(null);
  
  // New state for saving process
  const [isSavingToPlanner, setIsSavingToPlanner] = useState(false);

  const [savedTrends, setSavedTrends] = useState<TrendCard[]>([]);
  const [brain, setBrain] = useState<BrainData>(getBrain());

  useEffect(() => {
      const saved = getPlaybook();
      setSavedTrends(saved);
      setBrain(getBrain());
  }, []);

  const handleHunt = async () => {
    setLoading(true);
    setReport(null);
    setSources([]);
    setGeneratedScript(null);
    try {
      const result = await generateTrendReport(searchQuery);
      setReport(result.text || "No results found.");
      setSources(result.grounding);
    } catch (error) {
      setReport("Error fetching trends. Please check API Key and try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleGenerateScript = async (trend: TrendCard) => {
      setGeneratingId(trend.title);
      setActiveStrategy(trend); // Ensure modal is open if triggered from search
      try {
          const script = await generateTrendScript(trend);
          if (script) {
              setGeneratedScript(script);
          } else {
              alert("Failed to generate script. Please check your API key and Brain settings.");
          }
      } catch (e) {
          alert("Failed to generate script");
      } finally {
          setGeneratingId(null);
      }
  };

  const handleSaveTrend = (trend: TrendCard) => {
      const newSaved = [...savedTrends, trend];
      setSavedTrends(newSaved);
      savePlaybook(newSaved);
      alert("Saved to Growth Playbook!");
  };

  const handleDeleteTrend = (title: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (!confirm("Remove this trend?")) return;
      const newSaved = savedTrends.filter(t => t.title !== title);
      setSavedTrends(newSaved);
      savePlaybook(newSaved);
      if (activeStrategy?.title === title) setActiveStrategy(null);
  };
  
  const handleSendToPlanner = async () => {
      if (!generatedScript || !activeTrend) return;
      
      setIsSavingToPlanner(true);
      
      try {
          // Generate Image based on Visual Cue
          let generatedImage = null;
          if (generatedScript.visual_cue) {
              // Add style keywords to ensure high quality
              const visualPrompt = `${generatedScript.visual_cue}. Style: High quality social media aesthetic, authentic, cinematic lighting.`;
              // USE 9:16 for Trend adaptation visuals
              generatedImage = await generateGenAiImage(visualPrompt, true, false, null, '9:16');
          }

          const feed = getFeed();
          const emptyIdx = feed.findIndex((p: any) => p.type === 'empty');
          
          const newPost = { 
              id: `TREND_${Date.now()}`,
              type: 'image' as const, // Default to image so it shows up, user can 'Generate Video' in dashboard
              status: 'draft' as const, 
              caption: `${generatedScript.hook_text}\n\n${generatedScript.caption}`,
              notes: `Trend: ${activeTrend.title}\nStrategy: ${generatedScript.why_it_works}\nVisual Cue: ${generatedScript.visual_cue}`,
              imageUrl: generatedImage,
              date: new Date().toISOString()
          };

          if (emptyIdx !== -1) {
              feed[emptyIdx] = newPost;
              saveFeed([...feed]);
              alert("Sent to Feed Planner! (Check slot " + (emptyIdx + 1) + ")");
          } else {
              saveFeed([newPost, ...feed]);
              alert("Added to top of Feed!");
          }
          
          // Close modal
          setActiveStrategy(null); 
          setGeneratedScript(null);

      } catch (e) {
          console.error(e);
          alert("Error saving to planner");
      } finally {
          setIsSavingToPlanner(false);
      }
  };

  const activeTrend = activeStrategy;

  const parsedTrends: TrendCard[] = useMemo(() => {
    if (!report) return [];
    const lines = report.split('\n');
    const trends: TrendCard[] = [];
    lines.forEach(line => {
        const match = line.match(/(?:AUDIO_CARD|TREND_CARD):\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*)/);
        if (match) {
            trends.push({
                title: match[1].trim(),
                origin: match[2].trim(),
                vibe: match[3].trim(),
                strategy: match[4].trim()
            });
        }
    });
    return trends;
  }, [report]);

  return (
    <div className="p-10 max-w-6xl mx-auto animate-fade-in pb-32 relative">
      {activeStrategy && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                      <div>
                          <div className="flex gap-2 items-center mb-2">
                              <span className="text-[10px] font-bold uppercase bg-brand-purple text-white px-2 py-0.5 rounded tracking-wider">{activeStrategy.origin}</span>
                              <span className="text-[10px] font-bold uppercase bg-gray-200 text-gray-600 px-2 py-0.5 rounded">{activeStrategy.vibe}</span>
                          </div>
                          <h3 className="text-3xl font-black text-brand-dark tracking-tight">{activeStrategy.title}</h3>
                      </div>
                      <button onClick={() => {setActiveStrategy(null); setGeneratedScript(null);}} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 hover:text-brand-dark transition-colors">✕</button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-0 flex flex-col md:flex-row">
                      
                      {/* Left: Original Strategy Context */}
                      <div className="w-full md:w-1/3 p-8 border-r border-gray-100 bg-white">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Original Trend</h4>
                          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                              <p className="text-lg text-brand-dark font-medium leading-relaxed">"{activeStrategy.strategy}"</p>
                          </div>
                          
                          <div className="mt-8">
                              <button onClick={() => handleDeleteTrend(activeStrategy.title)} className="text-red-400 text-xs font-bold hover:text-red-600 flex items-center gap-2 px-4 py-2 hover:bg-red-50 rounded-lg transition-colors">
                                  <TrashIcon className="w-3 h-3" /> Remove from Playbook
                              </button>
                          </div>
                      </div>

                      {/* Right: AI Adaptation */}
                      <div className="w-full md:w-2/3 p-8 bg-gray-50/50">
                          {!generatedScript ? (
                              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                  <div className="w-16 h-16 bg-brand-dark text-white rounded-full flex items-center justify-center text-3xl mb-6 shadow-xl">✨</div>
                                  <h3 className="text-xl font-bold text-brand-dark mb-2">Adapt for {brain.identity.name}</h3>
                                  <p className="text-sm text-gray-500 mb-8 max-w-sm">Tess will rewrite this trend to fit your specific niche, tone of voice, and business goals.</p>
                                  <button 
                                    onClick={() => handleGenerateScript(activeStrategy)}
                                    disabled={generatingId === activeStrategy.title}
                                    className="bg-brand-dark text-white px-10 py-4 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-3"
                                  >
                                      {generatingId === activeStrategy.title ? (
                                          <><span className="animate-spin">⚡️</span> Working...</>
                                      ) : (
                                          <>🚀 Generate Script</>
                                      )}
                                  </button>
                              </div>
                          ) : (
                              <div className="animate-fade-in space-y-6">
                                  <div className="flex justify-between items-center">
                                      <h4 className="text-xs font-bold text-brand-purple uppercase tracking-widest flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-brand-purple animate-pulse"></span>
                                          Generated Concept
                                      </h4>
                                      <button onClick={() => setGeneratedScript(null)} className="text-xs text-gray-400 hover:text-brand-purple font-bold">↻ Regenerate</button>
                                  </div>

                                  <div className="space-y-4">
                                      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">Visual Direction</label>
                                          <p className="text-sm text-gray-800 leading-relaxed">{generatedScript.visual_cue}</p>
                                      </div>

                                      <div className="grid grid-cols-1 gap-4">
                                          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-brand-pink">
                                              <label className="text-[10px] font-bold text-brand-pink uppercase block mb-2">Hook Overlay</label>
                                              <p className="text-lg font-black text-brand-dark font-socialModern uppercase leading-tight">{generatedScript.hook_text}</p>
                                          </div>
                                          
                                          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">Caption</label>
                                              <p className="text-sm text-gray-600 italic">"{generatedScript.caption}"</p>
                                          </div>
                                      </div>
                                      
                                      <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                                          <p className="text-xs text-green-800 font-medium"><strong>Why it works:</strong> {generatedScript.why_it_works}</p>
                                      </div>
                                  </div>

                                  <div className="pt-4 border-t border-gray-200">
                                      <button 
                                        onClick={handleSendToPlanner} 
                                        disabled={isSavingToPlanner}
                                        className="w-full bg-gradient-to-r from-brand-purple to-brand-pink text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:scale-100"
                                      >
                                          {isSavingToPlanner ? (
                                              <><span className="animate-spin">🎨</span> Generating Visuals & Saving...</>
                                          ) : (
                                              <>📮 Accept & Send to Planner</>
                                          )}
                                      </button>
                                      <p className="text-center text-[10px] text-gray-400 mt-2">This will generate a visual and add a draft post to your feed.</p>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      <header className="mb-10 flex items-end justify-between">
        <div><h2 className="text-4xl font-extrabold text-brand-dark mb-2 tracking-tight">Trend Hunter</h2><p className="text-brand-muted text-lg">Scans live culture and turns them into <span className="text-brand-purple font-semibold">Actionable Scripts</span>.</p></div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
             <button onClick={() => setActiveTab('trends')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'trends' ? 'bg-white shadow text-brand-dark' : 'text-gray-500'}`}>Live Search</button>
             <button onClick={() => setActiveTab('playbook')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'playbook' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}>Growth Playbook 📚</button>
        </div>
      </header>

      {activeTab === 'trends' ? (
          <div className="glass-effect rounded-3xl p-8 transition-all duration-500 min-h-[400px] relative">
            {!report && !loading && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-brand-muted/50 z-10">
                    <div className="p-8 bg-white rounded-full mb-6 shadow-lg shadow-brand-purple/10 animate-bounce-slow text-4xl">
                        🎯
                    </div>
                    <h3 className="text-2xl font-bold text-brand-dark mb-2">What are we hunting?</h3>
                    <div className="flex gap-2 w-full max-w-md mb-4">
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 px-6 py-4 rounded-2xl bg-white border border-gray-200 shadow-sm text-brand-dark font-bold outline-none focus:ring-2 focus:ring-brand-purple/20" placeholder="Enter topic..." />
                        <button onClick={handleHunt} className="px-8 py-4 rounded-2xl font-bold text-white shadow-xl shadow-brand-purple/30 transition-all transform hover:scale-105 bg-gradient-to-r from-brand-purple to-brand-pink text-lg">Hunt</button>
                    </div>
                 </div>
            )}
            {loading && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/80 backdrop-blur-sm rounded-3xl">
                     <div className="text-6xl animate-spin mb-4">📡</div>
                     <p className="font-bold text-brand-purple animate-pulse">Scanning live trends for "{searchQuery}"...</p>
                 </div>
            )}
            {report && !loading && viewMode === 'cards' && (
                <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-brand-dark">Results for: "{searchQuery}"</h3>
                        <button onClick={() => setReport(null)} className="text-sm font-bold text-gray-400 hover:text-brand-dark transition-colors">New Search</button>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        {parsedTrends.map((trend, idx) => (
                            <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-xl shadow-md">#{idx + 1}</div>
                                        <div><h4 className="font-extrabold text-lg text-brand-dark">{trend.title}</h4><div className="flex gap-2 text-xs font-medium text-gray-500"><span className="bg-gray-100 px-2 py-0.5 rounded">{trend.origin}</span><span className="bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded uppercase tracking-wide">{trend.vibe}</span></div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a href={`https://www.tiktok.com/search?q=${encodeURIComponent(trend.title)}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-brand-purple text-xs font-bold border border-gray-200 rounded px-2 py-1 transition-colors">
                                            🔗 Link
                                        </a>
                                        <button onClick={() => handleSaveTrend(trend)} className="text-gray-400 hover:text-brand-purple text-lg" title="Save to Playbook">📌</button>
                                    </div>
                                </div>
                                <div className="bg-brand-cyan/5 border-l-4 border-brand-cyan p-4 rounded-r-lg italic text-brand-dark text-sm">"{trend.strategy}"</div>
                                <div className="flex justify-end pt-2 border-t border-gray-100">
                                     <button onClick={() => handleGenerateScript(trend)} disabled={generatingId === trend.title} className="bg-brand-dark text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-md">{generatingId === trend.title ? 'Adapting...' : `✨ Adapt for ${brain.identity.name}`}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
      ) : (
          <div className="animate-fade-in">
              <div className="mb-10">
                  <h3 className="text-sm font-extrabold text-brand-muted uppercase tracking-widest mb-4">Tess's Top Picks (Expert Strategies)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {EXPERT_STRATEGIES.map((trend, idx) => (
                          <div key={`expert_${idx}`} onClick={() => setActiveStrategy(trend)} className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-6 shadow-sm border border-white hover:border-brand-purple/30 hover:shadow-lg transition-all cursor-pointer group">
                              <h3 className="font-bold text-lg text-brand-dark mb-2 leading-tight group-hover:text-brand-purple transition-colors">{trend.title}</h3>
                              <p className="text-xs text-gray-500 line-clamp-2">{trend.strategy}</p>
                          </div>
                      ))}
                  </div>
              </div>
              <div>
                   <h3 className="text-sm font-extrabold text-brand-muted uppercase tracking-widest mb-4">My Saved Collection</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {savedTrends.map((trend, idx) => (
                          <div key={`saved_${idx}`} onClick={() => setActiveStrategy(trend)} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col hover:border-brand-purple/30 hover:shadow-lg transition-all cursor-pointer group relative">
                              <button 
                                onClick={(e) => handleDeleteTrend(trend.title, e)} 
                                className="absolute top-4 right-4 bg-white hover:bg-red-50 text-gray-300 hover:text-red-500 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10 shadow-sm"
                                title="Remove from Playbook"
                              >
                                  <TrashIcon className="w-4 h-4" />
                              </button>
                              <h3 className="font-bold text-lg text-brand-dark mb-2 group-hover:text-brand-purple transition-colors pr-8">{trend.title}</h3>
                              <p className="text-sm text-gray-600 mb-4 flex-1 line-clamp-3">"{trend.strategy}"</p>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TrendHunter;