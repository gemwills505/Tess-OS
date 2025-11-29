
import React, { useState, useRef, useEffect } from 'react';
import { 
    generateWeekPlan, 
    generateGenAiImage, 
    getPersonaStatus, 
    detectAgentIntent, 
    generateTrendReport, 
    analyzeVision, 
    generateBrainUpdateProposal,
    generateAgentChat
} from '../services/geminiService';
import { applyBrainPatch } from '../services/brain';
import { WeeklyPostPlan, AgentMessage, AgentTool, BrainUpdateProposal } from '../types';

interface AgentOmniBarProps {
  activeTab: string;
  onSyncToFeed: (posts: any[]) => void;
}

const CHAT_STORAGE_KEY = 'tess_os_chat_history_v1';

const AgentOmniBar: React.FC<AgentOmniBarProps> = ({ activeTab, onSyncToFeed }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  
  const [messages, setMessages] = useState<AgentMessage[]>(() => {
      try {
          const saved = localStorage.getItem(CHAT_STORAGE_KEY);
          return saved ? JSON.parse(saved) : [
            { role: 'agent', text: "I'm online. Let's work.", type: 'text', timestamp: Date.now() }
          ];
      } catch (e) {
          return [{ role: 'agent', text: "I'm online. Let's work.", type: 'text', timestamp: Date.now() }];
      }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [generatedAssets, setGeneratedAssets] = useState<Record<string, string>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<{data: string, mimeType: string} | null>(null);
  const [personaStatus, setPersonaStatus] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isProcessing, isOpen]);

  useEffect(() => {
      getPersonaStatus().then(setPersonaStatus);
  }, []);

  const handleClearMemory = () => {
      if (confirm("Clear chat history?")) {
          const resetMsg: AgentMessage = { role: 'agent', text: "Memory wiped.", type: 'text', timestamp: Date.now() };
          setMessages([resetMsg]);
          localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify([resetMsg]));
      }
  };

  const getContextPrompt = () => {
      switch(activeTab) {
          case 'planner': return "User is currently looking at the Grid/Feed Planner (Drag & Drop grid).";
          case 'brain': return "User is currently editing your Identity/Brain (Persona settings).";
          case 'trends': return "User is currently looking at the Trend Hunter page (Viral trends & Playbook).";
          case 'content': return "User is in the Content Studio (Generating prompts).";
          case 'vision': return "User is using the Vision Analyst tool (Image analysis).";
          case 'studio': return "User is in the Thumbnail Studio (Image editor).";
          default: return "User is navigating the dashboard.";
      }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !uploadedImage) return;

    const userText = input;
    const hasImage = !!uploadedImage;
    const currentContext = getContextPrompt();
    
    const userMsg: AgentMessage = { 
        role: 'user', 
        text: userText, 
        type: 'text', 
        timestamp: Date.now(),
        data: uploadedImage 
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);
    setIsOpen(true);
    setProcessingStep('Thinking...');

    try {
        const intent = await detectAgentIntent(userText, hasImage);
        
        if (intent === AgentTool.TRENDS) {
            setProcessingStep('Scanning Trends...');
            const report = await generateTrendReport(userText || "Social Media Trends");
            const cards = report.text?.split('\n').filter(l => l.includes('TREND_CARD')).map(l => {
                const p = l.split('|');
                return { title: p[0]?.replace('TREND_CARD:', '').trim(), origin: p[1]?.trim(), vibe: p[2]?.trim(), strategy: p[3]?.trim() };
            }) || [];

            setMessages(prev => [...prev, {
                role: 'agent',
                text: cards.length > 0 ? `I found ${cards.length} trending topics.` : "Here is what I found:",
                type: 'trends',
                data: { cards, raw: report.text },
                timestamp: Date.now()
            }]);

        } else if (intent === AgentTool.VISION) {
            setProcessingStep('Analyzing image...');
            if (!uploadedImage) throw new Error("No image provided.");
            const analysis = await analyzeVision(uploadedImage.data, uploadedImage.mimeType);
            setMessages(prev => [...prev, {
                role: 'agent',
                text: "Visual breakdown complete.",
                type: 'vision',
                data: { analysis, image: uploadedImage },
                timestamp: Date.now()
            }]);

        } else if (intent === AgentTool.BRAIN_UPDATE) {
            setProcessingStep('Configuring...');
            const proposal = await generateBrainUpdateProposal(userText);
            if (proposal) {
                setMessages(prev => [...prev, {
                    role: 'agent',
                    text: "Review change.",
                    type: 'brain_update',
                    data: proposal,
                    timestamp: Date.now()
                }]);
            } else {
                setMessages(prev => [...prev, { role: 'agent', text: "I couldn't parse that.", type: 'text', timestamp: Date.now() }]);
            }

        } else if (intent === AgentTool.PLANNER) {
            setProcessingStep('Drafting...');
            const contextPrompt = `${userText}. (Context: ${currentContext})`;
            const result = await generateWeekPlan(contextPrompt, uploadedImage || undefined);
            setMessages(prev => [...prev, {
                role: 'agent',
                text: `I've drafted ${result.posts.length} posts.`,
                type: 'plan',
                data: result.posts,
                timestamp: Date.now()
            }]);
        } else {
             const history = messages.map(m => ({ role: m.role, text: m.text }));
             const response = await generateAgentChat(userText, currentContext, history);
             
             let msgData: any = { sources: response.sources };
             
             if (response.image) {
                 try {
                     // Check if it's already a data URL or just base64. 
                     // generateGenAiImage usually returns full data URL.
                     const [meta, base64] = response.image.split(',');
                     const mime = meta.split(':')[1].split(';')[0];
                     msgData = { mimeType: mime, data: base64 };
                 } catch(e) {
                     console.error("Failed to parse image response", e);
                 }
             }

             setMessages(prev => [...prev, { 
                 role: 'agent', 
                 text: response.text || "Copy that.", 
                 type: 'text', 
                 data: msgData,
                 timestamp: Date.now() 
             }]);
        }

    } catch (error) {
        setMessages(prev => [...prev, { role: 'agent', text: "System error.", type: 'text', timestamp: Date.now() }]);
    } finally {
        setIsProcessing(false);
        setUploadedImage(null);
        setProcessingStep('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64Raw = reader.result as string;
              setUploadedImage({
                  data: base64Raw.split(',')[1],
                  mimeType: file.type
              });
              setIsOpen(true);
          };
          reader.readAsDataURL(file);
      }
  };

  const executeBrainUpdate = (proposal: BrainUpdateProposal) => {
      try {
          applyBrainPatch(proposal.fieldPath, proposal.newValue);
          setMessages(prev => [...prev, { role: 'agent', text: `✅ Applied.`, type: 'text', timestamp: Date.now() }]);
      } catch (e) { alert("Failed."); }
  };

  const handleGenerateAsset = async (uniqueKey: string, visualPrompt: string, format: string) => {
      setGeneratingId(uniqueKey);
      try {
          const img = await generateGenAiImage(visualPrompt);
          if (img) setGeneratedAssets(prev => ({ ...prev, [uniqueKey]: img }));
      } catch (e) { alert("Failed"); } 
      finally { setGeneratingId(null); }
  };

  const handleSyncPlan = (plan: WeeklyPostPlan[], msgIndex: number) => {
      const feedPosts = plan.map((p, idx) => ({
          id: `AI_${Date.now()}_${idx}`,
          caption: `${p.caption}\n.\n.\n${p.hashtags.join(' ')}`,
          imageUrl: generatedAssets[`${msgIndex}_${idx}`] || null,
          date: new Date().toISOString(),
          status: 'draft',
          type: p.format === 'VIDEO' ? 'video' : 'image',
          notes: `Strategy: ${p.category} | Location: ${p.location}`
      }));
      onSyncToFeed(feedPosts);
      setMessages(prev => [...prev, { role: 'agent', text: "Synced to Feed.", type: 'text', timestamp: Date.now() }]);
  };

  const handleSendImageToFeed = (imgData: string) => {
        const newPost = {
            id: `AI_CHAT_${Date.now()}`,
            imageUrl: imgData,
            caption: '',
            date: new Date().toISOString(),
            status: 'draft',
            type: 'image',
            notes: 'Generated in Chat'
        };
        onSyncToFeed([newPost]);
        setPreviewImage(null);
        setMessages(prev => [...prev, { role: 'agent', text: "Sent image to Feed Planner.", type: 'text', timestamp: Date.now() }]);
  };

  return (
    <>
        {/* Floating Toggle Button */}
        {!isOpen && (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-brand-dark text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-transform animate-fade-in border-4 border-white/20"
            >
                <span className="text-2xl">🤖</span>
                {personaStatus?.batteryLevel < 20 && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-brand-dark"></span>
                )}
            </button>
        )}

        {/* Chat Widget Window */}
        {isOpen && (
            <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in">
                
                {/* Header */}
                <div className="bg-brand-dark p-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">🤖</div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Tess AI</h3>
                            <p className="text-[10px] text-gray-400 flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${personaStatus?.batteryLevel < 20 ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                {activeTab.toUpperCase()}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleClearMemory} className="text-gray-400 hover:text-white text-xs" title="Clear Memory">🗑️</button>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 custom-scrollbar">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.role === 'agent' ? 'bg-white text-brand-dark rounded-tl-none border border-gray-100' : 'bg-brand-purple text-white rounded-tr-none'}`}>
                                {msg.data && msg.data.mimeType && (
                                    <div className="relative group">
                                        <img 
                                            src={`data:${msg.data.mimeType};base64,${msg.data.data}`} 
                                            className="w-32 h-32 object-cover rounded-lg mb-2 block cursor-zoom-in border border-gray-200" 
                                            onClick={() => setPreviewImage(`data:${msg.data.mimeType};base64,${msg.data.data}`)}
                                        />
                                        <button 
                                            onClick={() => handleSendImageToFeed(`data:${msg.data.mimeType};base64,${msg.data.data}`)}
                                            className="absolute bottom-2 right-2 bg-brand-dark text-white p-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold"
                                            title="Send to Feed"
                                        >
                                            📮
                                        </button>
                                    </div>
                                )}
                                <div className="whitespace-pre-wrap">{msg.text}</div>
                                {msg.type === 'text' && msg.data?.sources && msg.data.sources.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-white/20 flex flex-wrap gap-1">
                                        {msg.data.sources.map((chunk: any, i: number) => chunk.web?.uri && (
                                            <a key={i} href={chunk.web.uri} target="_blank" rel="noreferrer" className="text-[9px] underline opacity-80 block truncate max-w-[150px]">
                                                {chunk.web.title}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* WIDGETS IN CHAT */}
                            {msg.type === 'trends' && (
                                <div className="w-full">
                                    {msg.data?.cards && msg.data.cards.length > 0 ? (
                                        <div className="w-full overflow-x-auto flex gap-2 pb-2">
                                            {msg.data.cards.map((c: any, i: number) => (
                                                <div key={i} className="min-w-[180px] bg-white p-2 rounded-xl border border-gray-200 text-xs shadow-sm">
                                                    <div className="font-bold truncate">{c.title}</div>
                                                    <div className="text-[10px] text-brand-purple">{c.strategy}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        // FALLBACK IF NO CARDS FOUND BUT RAW TEXT EXISTS
                                        <div className="bg-white p-3 rounded-xl border border-gray-200 text-xs text-gray-600 whitespace-pre-wrap">
                                            {msg.data?.raw || "No trend data returned."}
                                        </div>
                                    )}
                                </div>
                            )}
                            {msg.type === 'vision' && (
                                <div className="w-full bg-white p-3 rounded-xl border border-gray-200 text-[10px] whitespace-pre-wrap shadow-sm">
                                    {msg.data.analysis}
                                </div>
                            )}
                            {msg.type === 'brain_update' && (
                                <div className="w-full bg-white p-3 rounded-xl border border-brand-purple/30 shadow-sm">
                                    <div className="text-xs font-bold mb-2">Config Update</div>
                                    <div className="text-[10px] bg-green-50 text-green-700 p-1 rounded mb-2">{JSON.stringify(msg.data.newValue)}</div>
                                    <button onClick={() => executeBrainUpdate(msg.data)} className="w-full bg-brand-dark text-white text-[10px] py-1 rounded font-bold">Confirm</button>
                                </div>
                            )}
                            {msg.type === 'plan' && (
                                <div className="w-full bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-xs font-bold">Weekly Plan</span>
                                        <button onClick={() => handleSyncPlan(msg.data, idx)} className="text-[10px] bg-brand-purple text-white px-2 py-0.5 rounded font-bold">Sync</button>
                                    </div>
                                    {msg.data.slice(0,3).map((p:any, i:number) => (
                                        <div key={i} className="flex gap-2 items-center border-b border-gray-100 py-1 last:border-0">
                                            <div className="w-8 h-8 bg-gray-100 rounded shrink-0 relative">
                                                {generatedAssets[`${idx}_${i}`] ? <img src={generatedAssets[`${idx}_${i}`]} className="w-full h-full object-cover rounded"/> : <button onClick={() => handleGenerateAsset(`${idx}_${i}`, p.visualPrompt, p.format)} className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">GEN</button>}
                                            </div>
                                            <div className="text-[10px] truncate flex-1">{p.category}</div>
                                        </div>
                                    ))}
                                    {msg.data.length > 3 && <div className="text-[9px] text-center text-gray-400 mt-1">+{msg.data.length - 3} more</div>}
                                </div>
                            )}
                        </div>
                    ))}
                    {isProcessing && <div className="text-xs text-gray-400 animate-pulse pl-2">{processingStep}</div>}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white border-t border-gray-100 relative">
                    {uploadedImage && (
                        <div className="absolute bottom-full left-0 mb-2 ml-2 bg-white border border-gray-200 rounded-lg shadow-sm p-1 flex items-center gap-2">
                            <img src={`data:${uploadedImage.mimeType};base64,${uploadedImage.data}`} className="w-8 h-8 rounded object-cover" />
                            <button onClick={() => setUploadedImage(null)} className="text-red-500 text-xs font-bold">✕</button>
                        </div>
                    )}
                    <div className="flex gap-2 items-center">
                        <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-brand-purple transition-colors">📷</button>
                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                            placeholder="Ask Tess..."
                            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-purple/20 text-brand-dark"
                        />
                        <button onClick={handleSendMessage} disabled={!input.trim() && !uploadedImage} className="bg-brand-dark text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:bg-gray-800 disabled:opacity-50">➤</button>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </div>
            </div>
        )}

        {/* FULL SCREEN IMAGE PREVIEW */}
        {previewImage && (
            <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
                <img src={previewImage} className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
                <div className="absolute bottom-10 flex gap-4">
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleSendImageToFeed(previewImage); }} 
                        className="bg-white text-brand-dark px-6 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                    >
                        <span>📮</span> Send to Feed Planner
                    </button>
                </div>
                <button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 text-white text-2xl hover:text-gray-300 w-10 h-10 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40">✕</button>
            </div>
        )}
    </>
  );
};

export default AgentOmniBar;
