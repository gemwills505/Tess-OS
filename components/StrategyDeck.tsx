
import React, { useState } from 'react';
import { CampaignPackage, CampaignStrategy } from '../types';
import { generateCampaignStrategy, generateBulkCampaignPosts, generateGenAiImage } from '../services/geminiService';
import { getBrain } from '../services/brain';

interface StrategyDeckProps {
    onSyncToFeed: (posts: any[]) => void;
}

const StrategyDeck: React.FC<StrategyDeckProps> = ({ onSyncToFeed }) => {
    const [focus, setFocus] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [strategy, setStrategy] = useState<CampaignStrategy | null>(null);
    const [isGeneratingPosts, setIsGeneratingPosts] = useState(false);
    const [progress, setProgress] = useState(0);
    const [generatedCount, setGeneratedCount] = useState(0);

    const handleGenerateStrategy = async () => {
        setIsAnalyzing(true);
        setStrategy(null);
        try {
            // Always uses WEEKLY_7 package logic for 7-day sprint
            const result = await generateCampaignStrategy(CampaignPackage.WEEKLY_7, focus);
            setStrategy(result);
        } catch (e) {
            alert("Failed to analyze brand strategy. Check API Key.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleExecuteCampaign = async () => {
        if (!strategy) return;
        setIsGeneratingPosts(true);
        setProgress(10);

        try {
            // 1. Generate Text Content (Gemini 3 Pro) - Defaults to 7 posts
            const posts = await generateBulkCampaignPosts(CampaignPackage.WEEKLY_7, strategy);
            setProgress(40);
            
            // 2. Generate Visuals (Nano Banana Pro)
            const feedPosts = [];
            const chunkSize = 3; 
            
            for (let i = 0; i < posts.length; i += chunkSize) {
                const chunk = posts.slice(i, i + chunkSize);
                const promises = chunk.map(async (p) => {
                    let img = null;
                    try {
                        // Nano Banana Pro Generation - USE 9:16 for Social Content
                        img = await generateGenAiImage(p.visualPrompt, true, false, null, '9:16');
                    } catch (e) { console.error("Image Gen Error", e); }
                    
                    return {
                        id: `CAMP_${Date.now()}_${Math.random()}`,
                        caption: `${p.caption}\n.\n.\n${p.hashtags.join(' ')}`,
                        imageUrl: img, 
                        videoUrl: null, 
                        date: new Date().toISOString(),
                        status: 'draft',
                        type: p.format === 'VIDEO' ? 'video' : 'image',
                        notes: `[${p.category}] ${p.trendingHook || ''}`,
                        aiPrompt: p.visualPrompt
                    };
                });
                
                const processedChunk = await Promise.all(promises);
                feedPosts.push(...processedChunk);
                setGeneratedCount(prev => prev + processedChunk.length);
                
                const currentPct = 40 + Math.floor(((i + chunkSize) / posts.length) * 60);
                setProgress(Math.min(98, currentPct));
            }

            setProgress(100);
            onSyncToFeed(feedPosts);
            alert(`✅ Success! ${feedPosts.length} posts added to planner.`);

        } catch (e) {
            console.error(e);
            alert("Campaign generation failed partway through.");
        } finally {
            setIsGeneratingPosts(false);
        }
    };

    return (
        <div className="p-10 max-w-5xl mx-auto pb-32 animate-fade-in">
            <header className="mb-12 text-center">
                <div className="inline-block px-4 py-1 bg-brand-dark text-white text-[10px] font-bold rounded-full uppercase tracking-widest mb-4">Weekly Sprint</div>
                <h2 className="text-5xl font-extrabold text-brand-dark mb-4 tracking-tight">Weekly Content Engine</h2>
                <p className="text-xl text-brand-muted max-w-2xl mx-auto">
                    Tell Tess what's happening this week (Trends, Launches, News). <br/> She'll build a <span className="text-brand-purple font-bold">7-Day Plan</span> around it.
                </p>
            </header>

            {!strategy ? (
                /* STEP 1: WEEKLY FOCUS INPUT */
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">What is the focus this week?</label>
                        <textarea 
                            value={focus}
                            onChange={(e) => setFocus(e.target.value)}
                            placeholder="e.g. We are launching a new summer menu, or 'Just keep engagement up', or 'Talk about the new Taylor Swift album'"
                            className="w-full h-32 p-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/10 outline-none resize-none text-lg text-brand-dark placeholder-gray-400 mb-6"
                        />
                        
                        <button 
                            onClick={handleGenerateStrategy}
                            disabled={isAnalyzing}
                            className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
                        >
                            {isAnalyzing ? (
                                <>
                                    <span className="animate-spin">⚡️</span>
                                    <span>Analyzing Context...</span>
                                </>
                            ) : (
                                <>
                                    <span>🚀</span>
                                    <span>Draft Weekly Strategy</span>
                                </>
                            )}
                        </button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-6">
                        Tess will apply the "Trojan Horse" method: blending your news with entertainment.
                    </p>
                </div>
            ) : (
                /* STEP 2: STRATEGY REVIEW */
                <div className="animate-fade-in">
                    <div className="glass-effect p-8 rounded-3xl border border-brand-purple/20 shadow-2xl mb-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-purple to-brand-pink"></div>
                        
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-extrabold text-brand-dark">The Strategy (7 Days)</h3>
                                <p className="text-brand-muted">Focus: <span className="font-bold text-brand-dark">{focus || "General Engagement"}</span></p>
                            </div>
                            <button onClick={() => setStrategy(null)} className="text-xs font-bold text-gray-400 hover:text-brand-dark">Change Focus</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Comedic Premise</h4>
                                <p className="text-sm font-bold text-brand-dark leading-relaxed">
                                    "{strategy.comedic_angle}"
                                </p>
                            </div>
                            <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Story Arc</h4>
                                <p className="text-sm text-gray-600 italic">
                                    "{strategy.character_arc}"
                                </p>
                            </div>
                            <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Shadow Sales</h4>
                                <ul className="space-y-2">
                                    {strategy.shadow_selling_points.map((p, i) => (
                                        <li key={i} className="text-xs text-green-600 font-medium">🤫 {p}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <h4 className="text-xs font-bold text-brand-purple uppercase mb-3">Visual Aesthetic</h4>
                                <p className="text-sm leading-relaxed text-gray-700">{strategy.visual_theme}</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-gray-50 p-6 rounded-2xl">
                            <div>
                                <h4 className="font-bold text-brand-dark">Ready to Generate?</h4>
                                <p className="text-xs text-gray-500">
                                    Creating 7 posts. Mix of Trends, News, and "Main Character" energy.
                                </p>
                            </div>
                            <button 
                                onClick={handleExecuteCampaign}
                                disabled={isGeneratingPosts}
                                className="bg-brand-dark text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-3 disabled:opacity-50 disabled:scale-100"
                            >
                                {isGeneratingPosts ? (
                                    <>
                                        <span className="animate-spin">⚡️</span>
                                        <span>Cooking {generatedCount}/7... ({progress}%)</span>
                                    </>
                                ) : (
                                    <>
                                        <span>📸</span>
                                        <span>Generate 7 Posts</span>
                                    </>
                                )}
                            </button>
                        </div>
                        
                        {isGeneratingPosts && (
                            <div className="absolute bottom-0 left-0 h-1 bg-brand-purple transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StrategyDeck;
