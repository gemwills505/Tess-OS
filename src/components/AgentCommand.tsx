import React, { useState, useRef, useEffect } from 'react';
import { generateWeekPlan, generateTrendReport, analyzeVision, transcribeVideo, generateHooksFromTranscript, getPersonaStatus, detectAgentIntent } from '../services/geminiService';
import { savePlaybook, getPlaybook } from '../services/brain';
import { AgentMessage, AgentTool } from '../types';

interface AgentCommandProps {
  onSyncToFeed: (posts: any[]) => void;
}

const AgentCommand: React.FC<AgentCommandProps> = ({ onSyncToFeed }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AgentMessage[]>([{ role: 'agent', text: "I'm ready. Upload video/image or ask for trends.", type: 'text', timestamp: Date.now() }]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<{data: string, mimeType: string, type: 'image' | 'video'} | null>(null);
  const [personaStatus, setPersonaStatus] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getPersonaStatus().then(setPersonaStatus); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isProcessing]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64Raw = reader.result as string;
              const base64Data = base64Raw.split(',')[1];
              setUploadedFile({ data: base64Data, mimeType: file.type, type: file.type.startsWith('video/') ? 'video' : 'image' });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !uploadedFile) return;
    const userText = input;
    const fileData = uploadedFile;
    setMessages(prev => [...prev, { role: 'user', text: userText || (fileData?.type === 'video' ? '[Video]' : '[Image]'), type: 'text', timestamp: Date.now(), data: fileData }]);
    setInput(''); setUploadedFile(null); setIsProcessing(true);

    try {
        if (fileData?.type === 'video') {
            setProcessingStep('Watching video...');
            const transcript = await transcribeVideo(fileData.data, fileData.mimeType);
            if (transcript) {
                const fullText = transcript.transcript.map(t => t.dialogue).join(' ');
                const hooks = await generateHooksFromTranscript(fullText);
                setMessages(prev => [...prev, { role: 'agent', text: "Video analyzed.", type: 'vision', data: { analysis: `**TRANSCRIPT:**\n"${fullText}"\n\n**HOOKS:**\n${hooks.map(h => `• ${h.text}`).join('\n')}` }, timestamp: Date.now() }]);
            }
            setIsProcessing(false); return;
        }

        const intent = await detectAgentIntent(userText, !!fileData);
        if (intent === AgentTool.TRENDS) {
            setProcessingStep('Hunting trends...');
            const report = await generateTrendReport(userText || "Social Media Trends");
            const cards = report.text?.split('\n').filter(l => l.includes('TREND_CARD')).map(l => {
                const p = l.split('|'); return { title: p[0]?.replace('TREND_CARD:', '').trim(), origin: p[1]?.trim(), vibe: p[2]?.trim(), strategy: p[3]?.trim() };
            }) || [];
            setMessages(prev => [...prev, { role: 'agent', text: `Found trends.`, type: 'trends', data: { cards }, timestamp: Date.now() }]);
        } else if (intent === AgentTool.VISION && fileData) {
            setProcessingStep('Analyzing visual...');
            const analysis = await analyzeVision(fileData.data, fileData.mimeType);
            setMessages(prev => [...prev, { role: 'agent', text: "Visual breakdown:", type: 'vision', data: { analysis, image: fileData }, timestamp: Date.now() }]);
        } else if (intent === AgentTool.PLANNER) {
            setProcessingStep('Drafting...');
            const result = await generateWeekPlan(userText);
            setMessages(prev => [...prev, { role: 'agent', text: `Drafted plan.`, type: 'plan', data: result.posts, timestamp: Date.now() }]);
        } else {
             setMessages(prev => [...prev, { role: 'agent', text: "I'm listening.", type: 'text', timestamp: Date.now() }]);
        }
    } catch (error) { setMessages(prev => [...prev, { role: 'agent', text: "Error.", type: 'text', timestamp: Date.now() }]); } 
    finally { setIsProcessing(false); setProcessingStep(''); }
  };

  const saveTrend = (c: any) => { savePlaybook([...getPlaybook(), c]); alert("Saved!"); };

  return (
    <div className="flex flex-col h-full bg-white">
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[90%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-gray-100' : 'bg-white border border-gray-100 shadow-sm'}`}>
                        {msg.data?.type === 'image' && <img src={`data:${msg.data.mimeType};base64,${msg.data.data}`} className="w-32 rounded mb-2" />}
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                        {msg.type === 'trends' && <div className="mt-2 space-y-2">{msg.data.cards.map((c: any, i: number) => (<div key={i} className="bg-gray-50 p-2 rounded border flex justify-between"><div><div className="font-bold text-xs">{c.title}</div><div className="text-[10px]">{c.strategy}</div></div><button onClick={() => saveTrend(c)} className="text-xs">📌</button></div>))}</div>}
                        {msg.type === 'vision' && <div className="mt-2 text-xs font-mono bg-gray-50 p-2 rounded whitespace-pre-wrap">{msg.data.analysis?.critique || msg.data.analysis}</div>}
                    </div>
                </div>
            ))}
            {isProcessing && <div className="text-xs text-gray-400 p-4 animate-pulse">⚡️ {processingStep}</div>}
            <div ref={chatEndRef} />
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2 bg-white">
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-brand-purple">📎</button>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-1 outline-none text-sm bg-gray-50 rounded-xl px-4" placeholder="Ask Tess..." />
            <button onClick={handleSendMessage} className="font-bold text-brand-purple px-2">➤</button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
        </div>
    </div>
  );
};
export default AgentCommand;