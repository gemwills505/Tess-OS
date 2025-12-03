import React, { useState, useEffect } from 'react';
import { getAppSettings, saveAppSettings, getBrain } from '../services/brain';
import { constructImageGenPrompt } from '../services/geminiService';

const Settings: React.FC = () => {
  const [modelTier, setModelTier] = useState<'fast' | 'smart' | 'pro'>('smart');
  const [imageEngine, setImageEngine] = useState<'nano-fast' | 'nano-pro'>('nano-pro');
  const [geminiKey, setGeminiKey] = useState('');
  const [elevenKey, setElevenKey] = useState('');
  const [zapierWebhook, setZapierWebhook] = useState('');
  const [isKeysSaved, setIsKeysSaved] = useState(false);
  const [testPrompt, setTestPrompt] = useState('A cat sitting on a desk');
  const [testEnvironment, setTestEnvironment] = useState(false);
  const [resultPrompt, setResultPrompt] = useState('');

  const hasEnvKey = !!process.env.API_KEY;

  useEffect(() => {
      const settings = getAppSettings();
      setModelTier(settings.modelTier || 'smart');
      setImageEngine(settings.imageEngine as any || 'nano-pro');
      setElevenKey(settings.elevenLabsKey || '');
      setZapierWebhook(settings.zapierWebhook || '');
      const storedGemini = localStorage.getItem('tess_gemini_key');
      if (storedGemini) setGeminiKey(storedGemini);
  }, []);

  const handleSaveKeys = () => {
      if (geminiKey) localStorage.setItem('tess_gemini_key', geminiKey);
      saveAppSettings({ modelTier, imageEngine, elevenLabsKey: elevenKey, zapierWebhook });
      setIsKeysSaved(true);
      setTimeout(() => setIsKeysSaved(false), 2000);
  };

  const runPromptLab = () => {
      const brain = getBrain();
      const output = constructImageGenPrompt(testPrompt, imageEngine, testEnvironment, brain);
      setResultPrompt(output);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto pb-32 animate-fade-in">
      <header className="mb-8">
        <h2 className="text-3xl font-extrabold text-brand-dark mb-2">Settings</h2>
        <p className="text-gray-500 text-sm">Manage API keys and AI behavior.</p>
      </header>

      <div className="space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-lg text-brand-dark">🔑 API Keys</h3>
                 <button onClick={handleSaveKeys} className={`px-6 py-2 rounded-xl font-bold text-xs shadow-md transition-all ${isKeysSaved ? 'bg-green-500 text-white' : 'bg-brand-dark text-white hover:bg-gray-800'}`}>{isKeysSaved ? 'Saved!' : 'Save Changes'}</button>
             </div>
             <div className="space-y-4">
                 <div>
                     <div className="flex justify-between mb-2"><label className="text-xs font-bold text-brand-purple uppercase">Gemini API Key</label>{hasEnvKey && <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold">ENV ACTIVE</span>}</div>
                     <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder={hasEnvKey ? "Using Environment Variable" : "Paste Google AI Studio Key..."} className="input-std" />
                 </div>
                 <div>
                     <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">ElevenLabs Key (Voice)</label>
                     <input type="password" value={elevenKey} onChange={(e) => setElevenKey(e.target.value)} placeholder="Paste ElevenLabs Key..." className="input-std" />
                 </div>
                 <div>
                     <label className="text-xs font-bold text-orange-500 uppercase mb-2 block">Zapier Webhook (Auto-Post)</label>
                     <input type="password" value={zapierWebhook} onChange={(e) => setZapierWebhook(e.target.value)} placeholder="https://hooks.zapier.com/..." className="input-std" />
                 </div>
             </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
             <h3 className="font-bold text-lg text-brand-dark mb-4">🔮 Neural Configuration</h3>
             <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-gray-50 rounded-xl">
                     <label className="label-sm">Brain Model</label>
                     <select value={modelTier} onChange={(e) => setModelTier(e.target.value as any)} className="w-full bg-white p-2 rounded-lg border border-gray-200 text-sm"><option value="fast">Flash (Fast)</option><option value="smart">Flash (Default)</option><option value="pro">Pro (Smartest)</option></select>
                 </div>
                 <div className="p-4 bg-gray-50 rounded-xl">
                     <label className="label-sm">Vision Engine</label>
                     <select value={imageEngine} onChange={(e) => setImageEngine(e.target.value as any)} className="w-full bg-white p-2 rounded-lg border border-gray-200 text-sm"><option value="nano-fast">Nano Banana (Fast)</option><option value="nano-pro">Nano Banana PRO (High Quality)</option></select>
                 </div>
             </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
             <h3 className="font-bold text-lg text-brand-dark mb-4">🧪 Prompt Logic Test</h3>
             <div className="flex gap-4 mb-4">
                 <input value={testPrompt} onChange={(e) => setTestPrompt(e.target.value)} className="input-std flex-1" />
                 <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={testEnvironment} onChange={(e) => setTestEnvironment(e.target.checked)} /> Is Room?</label>
             </div>
             <button onClick={runPromptLab} className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold mb-4">Generate Prompt</button>
             {resultPrompt && <div className="p-4 bg-gray-900 text-green-400 font-mono text-xs rounded-xl whitespace-pre-wrap">{resultPrompt}</div>}
        </div>
        
        <div className="text-center pt-8">
            <button onClick={() => { if(confirm("Factory Reset? Wipes ALL data.")) { localStorage.clear(); window.location.reload(); } }} className="text-red-400 hover:text-red-600 text-xs font-bold border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50">⚠️ Factory Reset</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;