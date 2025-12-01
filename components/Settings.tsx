


import React, { useState, useEffect } from 'react';
import { getAppSettings, saveAppSettings, getBrain } from '../services/brain';
import { constructImageGenPrompt } from '../services/geminiService';

const Settings: React.FC = () => {
  // Locked to Smart/Pro defaults
  const [modelTier, setModelTier] = useState<'fast' | 'smart'>('smart');
  
  // API Keys state
  const [geminiKey, setGeminiKey] = useState('');
  const [elevenKey, setElevenKey] = useState('');
  const [isKeysSaved, setIsKeysSaved] = useState(false);
  
  // Prompt Lab State
  const [testPrompt, setTestPrompt] = useState('A cat sitting on a desk');
  const [testEnvironment, setTestEnvironment] = useState(false);
  const [resultPrompt, setResultPrompt] = useState('');

  const hasEnvKey = !!process.env.API_KEY;

  useEffect(() => {
      const settings = getAppSettings();
      setModelTier('smart'); // Force Smart
      
      // Load keys from storage
      const storedGemini = localStorage.getItem('tess_gemini_key');
      if (storedGemini) setGeminiKey(storedGemini);
      
      if (settings.elevenLabsKey) setElevenKey(settings.elevenLabsKey);
  }, []);

  const handleSaveKeys = () => {
      if (geminiKey) localStorage.setItem('tess_gemini_key', geminiKey);
      
      setIsKeysSaved(true);
      
      // Force settings to Pro defaults + Save ElevenLabs Key
      saveAppSettings({ 
          modelTier: 'smart', 
          imageEngine: 'nano-pro',
          elevenLabsKey: elevenKey 
      });

      setTimeout(() => setIsKeysSaved(false), 2000);
  };

  const handleFactoryReset = () => {
    if (confirm("⚠️ FACTORY RESET: This will wipe ALL data (Brain, Feed, Bank). Are you sure?")) {
      localStorage.clear(); 
      window.location.reload();
    }
  };
  
  const runPromptLab = () => {
      const brain = getBrain();
      // Test the Nano Pro Logic
      const output = constructImageGenPrompt(testPrompt, 'nano-pro', testEnvironment, brain);
      setResultPrompt(output);
  };

  return (
    <div className="p-10 max-w-4xl mx-auto animate-fade-in pb-32">
      <header className="mb-10">
        <h2 className="text-4xl font-extrabold text-brand-dark mb-2 tracking-tight">Settings</h2>
        <p className="text-brand-muted text-lg">Manage global preferences and application data.</p>
      </header>

      <div className="space-y-6">
        
        {/* DEVELOPER & API KEYS */}
        <div className="glass-effect p-8 rounded-3xl border-2 border-brand-purple/10">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2">
                    🔑 Developer & API Keys
                 </h3>
                 <button 
                    onClick={handleSaveKeys}
                    className={`px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-md ${isKeysSaved ? 'bg-green-500 text-white' : 'bg-brand-dark text-white hover:bg-gray-800'}`}
                 >
                    {isKeysSaved ? 'Saved!' : 'Save Keys 💾'}
                 </button>
             </div>
             <div className="space-y-4">
                 <p className="text-xs text-gray-500 mb-2">
                    Enter your API Keys below.
                 </p>
                 
                 {/* Gemini Key */}
                 <div className="p-4 bg-white rounded-xl border border-gray-200">
                     <div className="flex justify-between items-center mb-2">
                         <label className="text-xs font-bold text-brand-purple uppercase">Gemini API Key</label>
                         {hasEnvKey && <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold">ENV ACTIVE</span>}
                     </div>
                     <input 
                        type="password" 
                        value={geminiKey}
                        onChange={(e) => { setGeminiKey(e.target.value); setIsKeysSaved(false); }}
                        placeholder={hasEnvKey ? "Using Environment Variable" : "Paste your Google AI Studio Key..."}
                        className="w-full p-2 bg-gray-50 rounded border border-gray-200 text-sm outline-none focus:border-brand-purple"
                     />
                 </div>

                 {/* ElevenLabs Key */}
                 <div className="p-4 bg-white rounded-xl border border-gray-200">
                     <div className="flex justify-between items-center mb-2">
                         <label className="text-xs font-bold text-indigo-600 uppercase">ElevenLabs API Key</label>
                     </div>
                     <input 
                        type="password" 
                        value={elevenKey}
                        onChange={(e) => { setElevenKey(e.target.value); setIsKeysSaved(false); }}
                        placeholder="Paste your ElevenLabs Key for Voice features..."
                        className="w-full p-2 bg-gray-50 rounded border border-gray-200 text-sm outline-none focus:border-indigo-500"
                     />
                 </div>
             </div>
        </div>

        {/* PROMPT LABORATORY */}
        <div className="glass-effect p-8 rounded-3xl border border-brand-purple/20 shadow-lg">
             <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
                🧪 Nano Pro Logic Test
             </h3>
             <p className="text-xs text-gray-500 mb-4">See how your prompts are rewritten for the high-fidelity Nano Banana Pro engine.</p>
             
             <div className="mb-4">
                 <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Raw Idea</label>
                 <input 
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    className="w-full p-3 rounded-xl bg-white border border-gray-200 outline-none text-sm"
                 />
             </div>
             
             <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={testEnvironment} onChange={(e) => setTestEnvironment(e.target.checked)} className="accent-brand-purple" />
                      <span className="text-xs font-bold text-gray-600">Is Environment? (Empty Room Mode)</span>
                  </label>
             </div>

             <button onClick={runPromptLab} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg mb-4">
                 🔍 Generate Prompt Logic
             </button>

             {resultPrompt && (
                 <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-xl whitespace-pre-wrap leading-relaxed shadow-inner">
                     {resultPrompt}
                 </div>
             )}
        </div>

        {/* NEURAL CONFIGURATION (READ ONLY) */}
        <div className="glass-effect p-8 rounded-3xl">
             <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
                🔮 Neural Configuration
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                 <div className="p-4 bg-white/50 rounded-xl border border-white">
                     <div className="text-xs font-bold text-brand-muted uppercase mb-1">Brain (Reasoning)</div>
                     <div className="font-bold text-brand-pink uppercase">Gemini 3.0 Pro (Smart)</div>
                 </div>
                 <div className="p-4 bg-white/50 rounded-xl border border-white">
                     <div className="text-xs font-bold text-brand-muted uppercase mb-1">Eyes (Vision)</div>
                     <div className="font-bold text-brand-purple uppercase">Nano Banana Pro</div>
                 </div>
             </div>
        </div>

        {/* DATA MANAGEMENT */}
        <div className="glass-effect p-8 rounded-3xl">
            <h3 className="text-lg font-bold text-brand-dark mb-4">Data Management</h3>
            <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-white mb-4">
                <div>
                    <div className="font-bold text-sm text-brand-dark">Factory Reset</div>
                    <div className="text-xs text-brand-muted">Wipe all Brain data, Feed history, and Image Bank.</div>
                </div>
                <button 
                    onClick={handleFactoryReset}
                    className="px-4 py-2 bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 rounded-lg text-xs font-bold transition-colors"
                >
                    ⚠️ Reset Everything
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
