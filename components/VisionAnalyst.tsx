
import React, { useState, useRef } from 'react';
import { analyzeVision } from '../services/geminiService';
import { getBrain } from '../services/brain';
import { VisionAnalysisResult } from '../types';

const VisionAnalyst: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [analysis, setAnalysis] = useState<VisionAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const performAnalysis = async (base64Data: string, type: string) => {
    setLoading(true);
    try {
      const brain = getBrain();
      const result = await analyzeVision(base64Data, type, brain);
      setAnalysis(result);
    } catch (error) {
      alert("Error processing image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1]; 
        setSelectedImage(base64Data);
        setMimeType(file.type);
        setAnalysis(null);
        performAnalysis(base64Data, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Copied!");
  };

  return (
    <div className="p-10 max-w-6xl mx-auto pb-20">
      <header className="mb-10">
        <h2 className="text-4xl font-extrabold text-brand-dark mb-2 tracking-tight">Vision Analyst</h2>
        <p className="text-brand-muted text-lg">Upload content to get <span className="text-brand-purple font-medium">Magic Captions, VEO Prompts, and Strategy</span>.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
            <div 
                className="border-2 border-dashed border-brand-muted/30 rounded-3xl h-[600px] flex flex-col items-center justify-center bg-white/40 hover:bg-white/60 transition-all cursor-pointer relative overflow-hidden group"
                onClick={() => fileInputRef.current?.click()}
            >
                {selectedImage ? (
                    <div className="w-full h-full relative">
                        <img 
                            src={`data:${mimeType};base64,${selectedImage}`} 
                            alt="Upload Preview" 
                            className="w-full h-full object-contain p-4"
                        />
                        {loading && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-brand-purple z-10">
                                <div className="text-6xl animate-spin mb-6">🔮</div>
                                <span className="text-xl font-bold animate-pulse">Consulting the Brain...</span>
                            </div>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setAnalysis(null); }} className="absolute top-4 right-4 bg-white/80 p-2 rounded-full hover:bg-red-50 text-red-500 shadow-md">✕</button>
                    </div>
                ) : (
                    <div className="text-center p-8 transition-transform group-hover:scale-105">
                        <div className="text-6xl mb-6">
                            📤
                        </div>
                        <p className="text-2xl font-bold text-brand-dark">Drop image here</p>
                        <p className="text-sm text-brand-muted mt-2">Screenshots, Photos, Thumbnails</p>
                    </div>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange}
                />
            </div>
        </div>

        <div className="h-[600px] overflow-y-auto custom-scrollbar pr-2 space-y-6">
             {analysis ? (
                 <div className="animate-fade-in space-y-6">
                     
                     {/* Critique Card */}
                     <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Tess's Take</h3>
                         <p className="text-sm text-brand-dark leading-relaxed italic">"{analysis.critique}"</p>
                     </div>

                     {/* Content Card */}
                     <div className="bg-white p-6 rounded-3xl shadow-lg border border-brand-purple/20 relative overflow-hidden">
                         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-purple to-brand-pink"></div>
                         <h3 className="text-xs font-bold text-brand-purple uppercase tracking-widest mb-4">Steal This Content</h3>
                         
                         <div className="mb-4">
                             <div className="flex justify-between items-end mb-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">POV Overlay</label>
                                <button onClick={() => copyToClipboard(analysis.povText)} className="text-[10px] text-brand-purple hover:underline">Copy</button>
                             </div>
                             <div className="bg-gray-50 p-3 rounded-xl text-sm font-black text-brand-dark text-center font-socialModern uppercase">{analysis.povText}</div>
                         </div>

                         <div className="mb-4">
                             <div className="flex justify-between items-end mb-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Caption</label>
                                <button onClick={() => copyToClipboard(analysis.caption)} className="text-[10px] text-brand-purple hover:underline">Copy</button>
                             </div>
                             <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">{analysis.caption}</div>
                         </div>

                         <div>
                             <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Hashtags</label>
                             <div className="flex flex-wrap gap-2">
                                 {analysis.hashtags.map((tag, i) => (
                                     <span key={i} className="text-xs text-blue-500 font-medium">{tag}</span>
                                 ))}
                             </div>
                         </div>
                     </div>

                     {/* Remix Card */}
                     <div className="bg-gray-900 p-6 rounded-3xl shadow-xl text-white">
                         <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4">AI Remix Lab</h3>
                         
                         <div className="mb-6">
                             <div className="flex justify-between items-end mb-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">VEO 3.1 Video Prompt</label>
                                <button onClick={() => copyToClipboard(analysis.veoPrompt)} className="text-[10px] text-purple-300 hover:text-white">Copy</button>
                             </div>
                             <div className="bg-white/10 p-3 rounded-xl text-xs font-mono text-gray-300 border border-white/10">{analysis.veoPrompt}</div>
                         </div>

                         <div>
                             <div className="flex justify-between items-end mb-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Nano Banana Image Prompt</label>
                                <button onClick={() => copyToClipboard(analysis.imagePrompt)} className="text-[10px] text-purple-300 hover:text-white">Copy</button>
                             </div>
                             <div className="bg-white/10 p-3 rounded-xl text-xs font-mono text-gray-300 border border-white/10">{analysis.imagePrompt}</div>
                         </div>
                     </div>

                 </div>
             ) : !loading && (
                <div className="h-full flex items-center justify-center text-brand-muted/40 text-sm italic border-2 border-dashed border-gray-200 rounded-3xl">
                    Results will appear here...
                </div>
             )}
        </div>
      </div>
    </div>
  );
};

export default VisionAnalyst;
