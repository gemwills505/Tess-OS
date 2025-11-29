
import React, { useState, useRef, useEffect } from 'react';
import { 
    generateWeekPlan, 
    generateGenAiImage, 
    getPersonaStatus, 
    detectAgentIntent, 
    generateTrendReport, 
    analyzeVision, 
    generateBrainUpdateProposal 
} from '../services/geminiService';
import { applyBrainPatch } from '../services/brain';
import { WeeklyPostPlan, AgentMessage, AgentTool, BrainUpdateProposal } from '../types';

interface AgentCommandProps {
  onSyncToFeed: (posts: any[]) => void;
}

const AgentCommand: React.FC<AgentCommandProps> = ({ onSyncToFeed }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AgentMessage[]>([
    { role: 'agent', text: "I'm online. You can ask me to plan content, find trends, analyze images, or even update my personality settings.", type: 'text', timestamp: Date.now() }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  
  // Planner State
  const [generatedAssets, setGeneratedAssets] = useState<Record<string, string>>({}); // Keyed by post index + timestamp to be unique
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  
  // Upload State
  const [uploadedImage, setUploadedImage] = useState<{data: string, mimeType: string} | null>(null);
  const [personaStatus, setPersonaStatus] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      getPersonaStatus().then(setPersonaStatus);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const handleSendMessage = async () => {
    if (!input.trim() && !uploadedImage) return;

    const userText = input;
    const hasImage = !!uploadedImage;
    
    // Add User Message
    const userMsg: AgentMessage = { 
        role: 'user', 
        text: userText, 
        type: 'text',
        timestamp: Date.now(),
        data: uploadedImage // Store image in data if present
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);
    setProcessingStep('Analyzing intent...');

    try {
        // 1. Router: Decide what to do
        const intent = await detectAgentIntent(userText, hasImage);
        
        // 2. Execute based on Intent
        if (intent === AgentTool.TRENDS) {
            setProcessingStep('Scanning Google Search & TikTok...');
            const report = await generateTrendReport(userText || "Social Media Trends");
            
            // Parse report for cards (simplified logic from TrendHunter)
            const cards = report.text?.split('\n').filter(l => l.includes('TREND_CARD')).map(l => {
                const p = l.split('|');
                return { title: p[0]?.replace('TREND_CARD:', '').trim(), origin: p[1]?.trim(), vibe: p[2]?.trim(), strategy: p[3]?.trim() };
            }) || [];

            setMessages(prev => [...prev, {
                role: 'agent',
                text: `Found some trends for "${userText}".`,
                type: 'trends',
                data: { cards, raw: report.text },
                timestamp: Date.now()
            }]);

        } else if (intent === AgentTool.VISION) {
            setProcessingStep('Analyzing visual strategy...');
            if (!uploadedImage) throw new Error("No image provided for vision analysis.");
            
            const analysis = await analyzeVision(uploadedImage.data, uploadedImage.mimeType);
            setMessages(prev => [...prev, {
                role: 'agent',
                text: "Here is the breakdown.",
                type: 'vision',
                data: { analysis, image: uploadedImage },
                timestamp: Date.now()
            }]);

        } else if (intent === AgentTool.BRAIN_UPDATE) {
            setProcessingStep('Configuring personality matrix...');
            const proposal = await generateBrainUpdateProposal(userText);
            if (proposal) {
                setMessages(prev => [...prev, {
                    role: 'agent',
                    text: "I propose the following update to my configuration:",
                    type: 'brain_update',
                    data: proposal,
                    timestamp: Date.now()
                }]);
            } else {
                setMessages(prev => [...prev, { role: 'agent', text: "I couldn't figure out what setting to change. Can you be more specific?", type: 'text', timestamp: Date.now() }]);
            }

        } else if (intent === AgentTool.PLANNER) {
            setProcessingStep('Drafting content plan...');
            // If image is attached, include it in context
            const contextPrompt = hasImage ? "Analyze this image and generate content ideas based on it." : userText;
            
            const result = await generateWeekPlan(contextPrompt, uploadedImage || undefined);
            setMessages(prev => [...prev, {
                role: 'agent',
                text: `I've drafted ${result.posts.length} posts based on that.`,
                type: 'plan',
                data: result.posts,
                timestamp: Date.now()
            }]);
        } else {
             // Chat / Q&A
             setMessages(prev => [...prev, { role: 'agent', text: "I'm listening. (Chat logic would go here)", type: 'text', timestamp: Date.now() }]);
        }

    } catch (error) {
        console.error(error);
        setMessages(prev => [...prev, { role: 'agent', text: "I encountered an error processing that request.", type: 'text', timestamp: Date.now() }]);
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
              // strip prefix
              const base64Data = base64Raw.split(',')[1];
              setUploadedImage({
                  data: base64Data,
                  mimeType: file.type
              });
          };
          reader.readAsDataURL(file);
      }
  };

  const executeBrainUpdate = (proposal: BrainUpdateProposal) => {
      try {
          applyBrainPatch(proposal.fieldPath, proposal.newValue);
          setMessages(prev => [...prev, { role: 'agent', text: `✅ Updated ${proposal.fieldPath}.`, type: 'text', timestamp: Date.now() }]);
      } catch (e) {
          alert("Failed to update brain.");
      }
  };

  const handleGenerateAsset = async (uniqueKey: string, visualPrompt: string, format: string) => {
      setGeneratingId(uniqueKey);
      try {
          const img = await generateGenAiImage(visualPrompt);
          if (img) {
              setGeneratedAssets(prev => ({ ...prev, [uniqueKey]: img }));
          }
      } catch (e) {
          alert("Generation failed");
      } finally {
          setGeneratingId(null);
      }
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
      setMessages(prev => [...prev, { role: 'agent', text: "Synced items to Feed Planner.", type: 'text', timestamp: Date.now() }]);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-200">
        <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-dark flex items-center justify-center text-white text-xl">🤖</div>
                <div>
                    <h3 className="font-bold text-brand-dark text-sm">Tess Command</h3>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${personaStatus?.batteryLevel > 20 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Online</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-gray-100 text-brand-dark rounded-br-none' : 'bg-white border border-gray-100 shadow-sm text-gray-700 rounded-bl-none'}`}>
                        {msg.data && msg.data.mimeType && (
                            <img src={`data:${msg.data.mimeType};base64,${msg.data.data}`} className="w-32 h-32 object-cover rounded-lg mb-2" />
                        )}
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>

                    {/* WIDGETS */}
                    {msg.type === 'trends' && (
                        <div className="w-full mt-2 grid grid-cols-2 gap-2">
                            {msg.data?.cards?.slice(0, 4).map((c: any, i: number) => (
                                <div key={i} className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                                    <div className="font-bold text-brand-purple mb-1 truncate">{c.title}</div>
                                    <div className="text-gray-500 line-clamp-2">{c.strategy}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {msg.type === 'vision' && (
                        <div className="w-full mt-2 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs whitespace-pre-wrap font-mono text-gray-600">
                            {msg.data.analysis}
                        </div>
                    )}

                    {msg.type === 'brain_update' && (
                        <div className="mt-2 bg-purple-50 p-4 rounded-xl border border-purple-100 w-full max-w-sm">
                            <div className="text-xs font-bold text-purple-700 mb-2 uppercase tracking-wider">Configuration Change</div>
                            <div className="mb-2 text-sm">
                                <span className="text-gray-500">{msg.data.fieldPath}:</span> <span className="font-mono bg-white px-1 rounded">{JSON.stringify(msg.data.currentValue)}</span> → <span className="font-mono bg-white px-1 rounded font-bold text-brand-dark">{JSON.stringify(msg.data.newValue)}</span>
                            </div>
                            <div className="text-xs text-gray-500 italic mb-4">"{msg.data.reasoning}"</div>
                            <button onClick={() => executeBrainUpdate(msg.data)} className="w-full py-2 bg-brand-dark text-white rounded-lg text-xs font-bold">Approve Update</button>
                        </div>
                    )}

                    {msg.type === 'plan' && (
                        <div className="w-full mt-4 space-y-3">
                            {msg.data.map((post: WeeklyPostPlan, i: number) => (
                                <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex gap-3 items-start">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden relative group">
                                        {generatedAssets[`${idx}_${i}`] ? (
                                            <img src={generatedAssets[`${idx}_${i}`]} className="w-full h-full object-cover" />
                                        ) : (
                                            <button 
                                                onClick={() => handleGenerateAsset(`${idx}_${i}`, post.visualPrompt, post.format)}
                                                disabled={generatingId === `${idx}_${i}`}
                                                className="w-full h-full flex flex-col items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
                                            >
                                                {generatingId === `${idx}_${i}` ? <span className="animate-spin text-xs">⏳</span> : <span className="text-lg">🎨</span>}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600 uppercase">{post.category}</span>
                                            <span className="text-[10px] text-gray-400">{post.format}</span>
                                        </div>
                                        <p className="text-xs text-gray-800 mt-1 line-clamp-2">{post.caption}</p>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => handleSyncPlan(msg.data, idx)} className="w-full py-3 bg-brand-purple text-white rounded-xl font-bold text-sm shadow-md hover:bg-brand-pink transition-colors">Add All to Feed Planner</button>
                        </div>
                    )}
                </div>
            ))}
            {isProcessing && (
                <div className="flex items-center gap-2 text-gray-400 text-xs italic p-2">
                    <span className="animate-spin">⚡️</span> {processingStep}
                </div>
            )}
            <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-gray-100">
            <div className="relative flex items-center bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-brand-purple focus-within:ring-2 focus-within:ring-brand-purple/20 transition-all">
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-brand-dark transition-colors">
                    📎
                </button>
                <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask Tess to plan, analyze, or create..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-brand-dark placeholder-gray-400 h-12"
                />
                <button onClick={handleSendMessage} disabled={!input.trim() && !uploadedImage} className="p-3 text-brand-purple font-bold hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
                    ➤
                </button>
                {uploadedImage && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white p-1 rounded-lg border border-gray-200 shadow-lg">
                        <img src={`data:${uploadedImage.mimeType};base64,${uploadedImage.data}`} className="w-16 h-16 object-cover rounded" />
                        <button onClick={() => setUploadedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">✕</button>
                    </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
        </div>
    </div>
  );
};

export default AgentCommand;
