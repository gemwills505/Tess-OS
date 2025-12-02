
import React, { useState, useEffect } from 'react';
import { getBrain, updateBrain } from '../services/brain';
import { BrainData, ContentPillar } from '../types';
import { generateGenAiImage } from '../services/geminiService';

const SocialStrategy: React.FC = () => {
    const [brain, setBrain] = useState<BrainData | null>(null);
    const [pillars, setPillars] = useState<ContentPillar[]>([]);
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    // Changed to store arrays of images for carousel support
    const [pillarVisuals, setPillarVisuals] = useState<Record<string, string[]>>({});

    useEffect(() => {
        const data = getBrain();
        setBrain(data);
        if (data?.strategy?.active_pillars) {
            setPillars(data.strategy.active_pillars);
        }
    }, []);

    const handleUpdatePillar = (index: number, field: keyof ContentPillar, value: any) => {
        const newPillars = [...pillars];
        newPillars[index] = { ...newPillars[index], [field]: value };
        setPillars(newPillars);
        if (brain && brain.strategy) {
            updateBrain({ ...brain, strategy: { ...brain.strategy, active_pillars: newPillars } });
        }
    };

    const handleGenerateVisual = async (pillar: ContentPillar) => {
        if (!brain) return;
        setGeneratingId(pillar.id);
        
        try {
            if (pillar.format === 'CAROUSEL') {
                // Generate 5 distinct images for the "Descent into Madness" vlog style
                const slides = [
                    { context: "Morning, optimistic start. Holding coffee, smiling.", time: "9:00 AM" },
                    { context: "At desk, slight annoyance, looking at screen.", time: "11:00 AM" },
                    { context: "Busy environment, messy desk, looking stressed.", time: "1:00 PM" },
                    { context: "Close up face, disassociated stare, chaotic background.", time: "3:00 PM" },
                    { context: "Giving up, head on desk or leaving office exhausted.", time: "5:00 PM" }
                ];

                const promises = slides.map(slide => {
                    const prompt = `${pillar.visualStyle}. ${slide.context}. Subject: ${brain.identity.name}. SINGLE IMAGE. NO SPLIT SCREEN. NO TEXT OVERLAY. Cinematic lighting.`;
                    return generateGenAiImage(prompt, true, false, null, '9:16');
                });

                const images = await Promise.all(promises);
                // Filter out any failed generations
                const validImages = images.filter((img): img is string => !!img);
                
                if (validImages.length > 0) {
                    setPillarVisuals(prev => ({ ...prev, [pillar.id]: validImages }));
                }

            } else {
                // Standard Single Image Generation
                let prompt = "";
                if (pillar.id === "PILLAR_NOTES") {
                    // For Notes, we want a pure screenshot look
                    prompt = `Digital user interface screenshot of the Apple Notes app. Text: "${pillar.example.substring(0, 50)}...". Yellow paper texture background. High resolution UI design. Flat 2D image. NO phone device. NO hands.`;
                } else if (pillar.id === "PILLAR_MASCOT") {
                    prompt = `A funny photo of a ${brain.assets?.miso_cat?.description || "pet"}. ${pillar.visualStyle}. Looking directly at the camera with a judgmental expression. Authentic home lighting. SINGLE IMAGE. NO SPLIT SCREEN.`;
                } else {
                    prompt = `${pillar.visualStyle}. Subject: ${brain.identity.name} (${brain.identity.avatarReferences?.candid}). Context: ${pillar.description}. Style: Authentic social media aesthetic. SINGLE IMAGE. NO SPLIT SCREEN. NO TEXT.`;
                }

                const img = await generateGenAiImage(prompt, true, false, null, '9:16');
                if (img) {
                    setPillarVisuals(prev => ({ ...prev, [pillar.id]: [img] }));
                }
            }
        } catch (e) {
            console.error(e);
            alert("Failed to visualize.");
        } finally {
            setGeneratingId(null);
        }
    };

    if (!brain) return <div className="p-10">Loading Strategy...</div>;

    return (
        <div className="p-10 max-w-7xl mx-auto pb-32 animate-fade-in">
            <header className="mb-12">
                <div className="inline-block px-4 py-1 bg-brand-dark text-white text-[10px] font-bold rounded-full uppercase tracking-widest mb-4">Core Strategy</div>
                <h2 className="text-5xl font-extrabold text-brand-dark mb-4 tracking-tight">The Content Pillars</h2>
                <p className="text-xl text-brand-muted max-w-3xl">
                    We don't post "randomly". We rotate through these 5 proven formats to build authority, trust, and entertainment.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {pillars.map((pillar, idx) => (
                    <div key={pillar.id} className="bg-white rounded-[32px] p-8 shadow-xl border border-gray-100 flex flex-col relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-purple to-brand-pink opacity-50"></div>
                        
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                {pillar.format}
                            </div>
                            <div className="text-4xl opacity-20 grayscale group-hover:grayscale-0 transition-all">
                                {pillar.id === 'PILLAR_VLOG' && '📹'}
                                {pillar.id === 'PILLAR_NOTES' && '📝'}
                                {pillar.id === 'PILLAR_MASCOT' && '🐾'}
                                {pillar.id === 'PILLAR_AESTHETIC' && '✨'}
                                {pillar.id === 'PILLAR_FLY' && '👂'}
                            </div>
                        </div>

                        <h3 className="text-2xl font-black text-brand-dark mb-2 leading-tight">{pillar.title}</h3>
                        <textarea 
                            value={pillar.description}
                            onChange={(e) => handleUpdatePillar(idx, 'description', e.target.value)}
                            className="text-sm text-gray-500 font-medium bg-transparent outline-none resize-none mb-6 h-12 w-full"
                        />

                        {/* Visualizer Area */}
                        <div className="bg-gray-50 rounded-2xl mb-6 relative overflow-hidden group/vis border border-gray-100 min-h-[300px]">
                            
                            {pillarVisuals[pillar.id] && pillarVisuals[pillar.id].length > 0 ? (
                                pillar.format === 'CAROUSEL' ? (
                                    /* Carousel View */
                                    <div className="flex overflow-x-auto gap-2 p-2 snap-x snap-mandatory h-full custom-scrollbar">
                                        {pillarVisuals[pillar.id].map((src, i) => (
                                            <div key={i} className="flex-shrink-0 w-[85%] h-full relative snap-center rounded-xl overflow-hidden shadow-sm">
                                                <img src={src} className="w-full h-full object-cover" />
                                                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md">
                                                    Slide {i + 1}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* Single Image View */
                                    <img src={pillarVisuals[pillar.id][0]} className="w-full h-full object-cover" />
                                )
                            ) : (
                                /* Fallback / Empty State */
                                pillar.id === 'PILLAR_NOTES' ? (
                                    <div className="w-full h-full bg-[#fffdf0] p-6 flex flex-col font-sans" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                                        {/* Notes App Header Simulation */}
                                        <div className="flex justify-between items-center mb-4 text-[#eeb23b]">
                                            <div className="flex items-center gap-1 text-xs font-semibold">
                                                <span>❮</span> Folders
                                            </div>
                                            <div className="text-xs">•••</div>
                                        </div>
                                        
                                        <div className="flex-1 overflow-hidden">
                                            {/* Logic to split Title (first line) and body */}
                                            {(() => {
                                                const lines = pillar.example.split('\n');
                                                const title = lines[0];
                                                const body = lines.slice(1).join('\n');
                                                return (
                                                    <div className="whitespace-pre-wrap">
                                                        <h4 className="text-2xl font-bold text-black leading-tight mb-2 tracking-tight">{title}</h4>
                                                        <div className="text-sm text-gray-500 leading-relaxed">
                                                            {body}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        
                                        {/* Notes App Bottom Bar */}
                                        <div className="flex justify-between items-center pt-4 mt-auto text-[#eeb23b] text-xl opacity-80">
                                            <span>☑️</span>
                                            <span>📷</span>
                                            <span>✏️</span>
                                            <span>📝</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2 p-8 text-center">
                                        <span className="text-3xl">👁️</span>
                                        <span className="text-xs font-bold uppercase">
                                            {pillar.format === 'CAROUSEL' ? 'Generate 5 Slides' : 'Generate Visual'}
                                        </span>
                                    </div>
                                )
                            )}
                            
                            {/* Hover Action */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/vis:opacity-100 transition-opacity flex items-center justify-center z-10">
                                <button 
                                    onClick={() => handleGenerateVisual(pillar)}
                                    disabled={generatingId === pillar.id}
                                    className="bg-white text-brand-dark px-6 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                                >
                                    {generatingId === pillar.id ? <span className="animate-spin">⚡️</span> : <span>✨</span>}
                                    {pillar.format === 'CAROUSEL' ? 'Generate 5 Slides' : 'Generate Concept'}
                                </button>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-4 flex-1">
                            <div>
                                <label className="text-[10px] font-bold text-brand-purple uppercase tracking-widest block mb-1">Visual Style</label>
                                <textarea 
                                    value={pillar.visualStyle}
                                    onChange={(e) => handleUpdatePillar(idx, 'visualStyle', e.target.value)}
                                    className="w-full text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-transparent focus:border-brand-purple focus:bg-white outline-none resize-none h-20"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-brand-pink uppercase tracking-widest block mb-1">Hook Strategy</label>
                                <input 
                                    value={pillar.hookStyle}
                                    onChange={(e) => handleUpdatePillar(idx, 'hookStyle', e.target.value)}
                                    className="w-full text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-transparent focus:border-brand-pink focus:bg-white outline-none"
                                />
                            </div>
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
};

export default SocialStrategy;
