
import React, { useState } from 'react';
import { VideoTranscript } from '../types';

interface AnalysisDisplayProps {
    transcript: VideoTranscript;
    summary: string | null;
    isSummarizing: boolean;
    summaryError: string | null;
    onSummarize: () => void;
}

export const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ transcript, summary, isSummarizing, summaryError, onSummarize }) => {
    const [isCopied, setIsCopied] = useState(false);

    const formatTranscriptForCopy = () => {
        let text = `${transcript.title}\n\n`;
        transcript.transcript.forEach(line => {
            text += `${line.timestamp} | ${line.speaker}: "${line.dialogue}"\n`;
        });
        return text;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(formatTranscriptForCopy());
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className="glass-effect rounded-xl overflow-hidden h-full flex flex-col">
            <div className="p-3 space-y-2 flex-grow flex flex-col">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[--c-purple] to-[--c-cyan] flex items-center justify-center flex-shrink-0 text-xs">
                        ✨
                    </div>
                    <h3 className="text-md font-bold text-[--text-dark] truncate">{transcript.title}</h3>
                </div>

                <div className="bg-black/5 rounded-md border border-[--border-light] flex-grow overflow-hidden flex flex-col">
                    <div className="grid grid-cols-[auto,auto,1fr] gap-3 p-2 text-xs font-semibold text-[--text-light] border-b border-[--border-light] tracking-widest uppercase flex-shrink-0">
                        <div>Time</div>
                        <div>Speaker</div>
                        <div>Dialogue</div>
                    </div>

                    <div className="divide-y divide-[--border-light] overflow-y-auto hide-scrollbar flex-grow">
                    {transcript.transcript.map((line, index) => (
                        <div key={index} className="grid grid-cols-[auto,auto,1fr] gap-3 p-2 text-xs">
                            <div className="font-mono text-black/50">{line.timestamp}</div>
                            <div className="font-semibold text-black/90 whitespace-nowrap">{line.speaker}</div>
                            <div className="text-black/70">"{line.dialogue}"</div>
                        </div>
                    ))}
                    </div>
                </div>

                {summary && (
                    <div className="pt-2 animate-fade-in flex-shrink-0">
                        <h4 className="text-xs font-bold text-[--text-dark] mb-1 uppercase tracking-widest">AI Summary</h4>
                        <p className="text-[--text-light] text-xs bg-black/5 p-2 rounded-md border border-[--border-light]">{summary}</p>
                    </div>
                )}
                {summaryError && <p className="text-red-500 text-xs text-center">{summaryError}</p>}
                
                <div className="flex items-center justify-end gap-2 pt-2 flex-shrink-0">
                    <button onClick={onSummarize} disabled={isSummarizing} className="flex items-center gap-1.5 text-xs font-bold text-[--text-dark] transition-colors px-2.5 py-1.5 rounded-md bg-black/5 hover:bg-black/10 border border-[--border-light] disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSummarizing ? "Summarizing..." : "📝 Summarize"}
                    </button>
                    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-bold text-[--text-dark] transition-colors px-2.5 py-1.5 rounded-md bg-black/5 hover:bg-black/10 border border-[--border-light]">
                        {isCopied ? '✅ Copied!' : '📋 Copy'}
                    </button>
                </div>
            </div>
        </div>
    );
};
