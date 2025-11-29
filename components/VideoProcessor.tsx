import React, { useState, useRef, useEffect } from 'react';
import { FeedItem, VideoTranscript } from '../types';
import { transcribeVideo, selectBestFrame, generateHooksFromTranscript } from '../services/geminiService';

interface VideoProcessorProps {
    onAddToFeed: (item: FeedItem) => void;
}

const VideoProcessor: React.FC<VideoProcessorProps> = ({ onAddToFeed }) => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [frames, setFrames] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState<VideoTranscript | null>(null);
    const [suggestedHooks, setSuggestedHooks] = useState<string[]>([]);
    const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
    
    // Editor State
    const [frameToShow, setFrameToShow] = useState<string | null>(null);
    const [hookText, setHookText] = useState("POV: You found this.");
    
    const imageEditorRef = useRef<HTMLDivElement>(null);
    const textBlockRef = useRef<HTMLDivElement>(null);
    
    const [textPosition, setTextPosition] = useState({ x: 50, y: 50 }); 
    const [imagePosition, setImagePosition] = useState({ x: 50, y: 50 }); 
    const [zoom, setZoom] = useState(1); 
    
    const [isDragging, setIsDragging] = useState(false);
    const [dragTarget, setDragTarget] = useState<'text' | 'image' | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setVideoFile(file);
            setVideoUrl(URL.createObjectURL(file));
            setFrames([]);
            setTranscript(null);
            setFrameToShow(null);
            setSuggestedHooks([]);
            setZoom(1);
            setImagePosition({ x: 50, y: 50 });
        }
    };

    const extractFrames = async (videoObjectUrl: string): Promise<string[]> => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = videoObjectUrl;
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = "anonymous";

            const capturedFrames: string[] = [];
            
            video.onloadedmetadata = async () => {
                const duration = video.duration;
                const timePoints = [duration * 0.2, duration * 0.5, duration * 0.8];
                
                for (const time of timePoints) {
                    video.currentTime = time;
                    await new Promise(r => { video.onseeked = () => r(true); });
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
                    capturedFrames.push(canvas.toDataURL('image/jpeg', 0.8));
                }
                resolve(capturedFrames);
            };
        });
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleProcessVideo = async () => {
        if (!videoFile || !videoUrl) return;
        setIsProcessing(true);

        try {
            const extractedFrames = await extractFrames(videoUrl);
            setFrames(extractedFrames);
            
            const base64Video = await fileToBase64(videoFile);
            const rawBase64 = base64Video.split(',')[1];
            
            const [transcriptResult, bestFrameIndices] = await Promise.all([
                transcribeVideo(rawBase64, videoFile.type),
                selectBestFrame(extractedFrames)
            ]);

            setTranscript(transcriptResult);
            
            if (bestFrameIndices.length > 0 && extractedFrames[bestFrameIndices[0]]) {
                setFrameToShow(extractedFrames[bestFrameIndices[0]]);
            } else if (extractedFrames.length > 0) {
                setFrameToShow(extractedFrames[0]);
            }

            if (transcriptResult && transcriptResult.transcript.length > 0) {
                const transcriptText = transcriptResult.transcript.map(t => t.dialogue).join(' ');
                try {
                    const aiHooks = await generateHooksFromTranscript(transcriptText);
                    const hooksList = aiHooks.map(h => h.text);
                    setSuggestedHooks(hooksList);
                    if (hooksList.length > 0) setHookText(hooksList[0]);
                } catch (e) {
                    setSuggestedHooks(["Stop scrolling 🛑", "You need to hear this 👂"]);
                }
            }

        } catch (e) {
            console.error("Video processing failed", e);
            alert("Processing failed. See console.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRegenerateHooks = async () => {
        if (!transcript) return;
        setIsGeneratingHooks(true);
        try {
            const transcriptText = transcript.transcript.map(t => t.dialogue).join(' ');
            const aiHooks = await generateHooksFromTranscript(transcriptText);
            const newHooks = aiHooks.map(h => h.text);
            setSuggestedHooks(prev => [...new Set([...prev, ...newHooks])]);
        } catch (e) {
            console.error("Failed to regenerate hooks", e);
        } finally {
            setIsGeneratingHooks(false);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!imageEditorRef.current) return;
        
        if (textBlockRef.current && textBlockRef.current.contains(e.target as Node)) {
            setIsDragging(true);
            setDragTarget('text');
            setDragStart({ x: e.clientX, y: e.clientY });
            setInitialPos({ x: textPosition.x, y: textPosition.y });
            e.stopPropagation();
            return;
        }
        
        setIsDragging(true);
        setDragTarget('image');
        setDragStart({ x: e.clientX, y: e.clientY });
        setInitialPos({ x: imagePosition.x, y: imagePosition.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !imageEditorRef.current) return;
        
        const rect = imageEditorRef.current.getBoundingClientRect();
        
        if (dragTarget === 'text') {
            const dx = ((e.clientX - dragStart.x) / rect.width) * 100;
            const dy = ((e.clientY - dragStart.y) / rect.height) * 100;
            setTextPosition({
                x: Math.min(100, Math.max(0, initialPos.x + dx)),
                y: Math.min(100, Math.max(0, initialPos.y + dy))
            });
        } else if (dragTarget === 'image') {
            const dx = ((e.clientX - dragStart.x) / rect.width) * 100;
            const dy = ((e.clientY - dragStart.y) / rect.height) * 100;
            setImagePosition({
                x: Math.max(0, Math.min(100, initialPos.x - dx)), 
                y: Math.max(0, Math.min(100, initialPos.y - dy))
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragTarget(null);
    };

    const handleSendToDesigner = async () => {
        if (!frameToShow || !imageEditorRef.current) return;
        
        onAddToFeed({
            id: `vid_frame_${Date.now()}`,
            type: 'image',
            imageUrls: [frameToShow],
            caption: hookText,
            hashtags: ['#video', '#reels'],
            metadata: {
                textPosition: textPosition,
                imageScale: zoom,
                origin: 'video_processor' 
            }
        });
    };

    return (
        <div className="flex h-full bg-gray-50">
            <div className="w-[400px] flex flex-col gap-6 p-6 overflow-y-auto custom-scrollbar border-r border-gray-200 bg-white shrink-0 z-10 shadow-lg">
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-brand-purple transition-all"
                >
                    {videoFile ? (
                        <div className="text-center">
                            <div className="text-4xl mb-2">📹</div>
                            <p className="font-bold text-brand-dark truncate max-w-[200px]">{videoFile.name}</p>
                            <button className="text-xs text-red-500 font-bold mt-2 hover:underline">Change Video</button>
                        </div>
                    ) : (
                        <>
                            <span className="text-4xl mb-4">📤</span>
                            <p className="font-bold text-gray-500">Upload Video / Reel</p>
                            <p className="text-xs text-gray-400 mt-1">MP4, MOV up to 50MB</p>
                        </>
                    )}
                    <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                </div>

                {videoFile && !transcript && (
                    <button 
                        onClick={handleProcessVideo}
                        disabled={isProcessing}
                        className="w-full bg-brand-dark text-white py-4 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <span className="animate-spin">⚡️</span> : <span>🔍</span>}
                        {isProcessing ? "Analyzing Video..." : "Analyze & Extract"}
                    </button>
                )}

                {frames.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Captured Frames</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {frames.map((frame, i) => (
                                <img 
                                    key={i} 
                                    src={frame} 
                                    onClick={() => setFrameToShow(frame)}
                                    className={`w-full aspect-[9/16] object-cover rounded-lg cursor-pointer border-2 transition-all ${frameToShow === frame ? 'border-brand-purple ring-2 ring-brand-purple/30' : 'border-transparent hover:border-gray-300'}`}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {frameToShow && (
                     <div className="space-y-6 pt-6 border-t border-gray-100">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Image Scale (Zoom)</label>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono">1x</span>
                                <input 
                                    type="range" min="1" max="5" step="0.1" 
                                    value={zoom} 
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="flex-1 accent-brand-purple h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-[10px] font-mono">5x</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Hook Text</label>
                            <div className="flex gap-2">
                                <input 
                                    value={hookText}
                                    onChange={(e) => setHookText(e.target.value)}
                                    placeholder="Enter hook text..."
                                    className="flex-1 p-3 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-900 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/10 placeholder-gray-400"
                                />
                                <button 
                                    className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-brand-purple/50 text-brand-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" 
                                    title="Regenerate with AI" 
                                    onClick={handleRegenerateHooks}
                                    disabled={isGeneratingHooks || !transcript}
                                >
                                    🔄
                                </button>
                            </div>
                            
                            {suggestedHooks.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {suggestedHooks.map((hook, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => setHookText(hook)} 
                                            className="text-[10px] bg-white border border-gray-200 px-3 py-2 rounded-lg hover:border-brand-purple hover:bg-brand-purple/5 transition-all text-left"
                                        >
                                            {hook}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={handleSendToDesigner}
                            className="w-full bg-brand-dark text-white py-4 rounded-xl font-bold shadow-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group"
                        >
                            <span>🎨</span>
                            Edit in Studio
                        </button>
                     </div>
                )}

                {transcript && (
                    <div className="mt-4">
                         <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <h4 className="font-bold text-xs text-gray-500 uppercase mb-2">Video Context</h4>
                            <p className="text-xs text-gray-700 line-clamp-4 italic">"{transcript.transcript.map(t => t.dialogue).join(' ')}"</p>
                         </div>
                    </div>
                )}
            </div>

            <div className="flex-1 bg-[#e5e5e5] flex flex-col items-center justify-center p-10 relative overflow-hidden"
                 onMouseMove={handleMouseMove}
                 onMouseUp={handleMouseUp}
                 onMouseLeave={handleMouseUp}
            >
                {!frameToShow ? (
                    <div className="text-center text-gray-400 flex flex-col items-center animate-fade-in">
                        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4 shadow-inner text-4xl">🎬</div>
                        <p className="text-lg font-bold text-gray-500">Select a frame to begin editing</p>
                        <p className="text-sm text-gray-400 mt-1">Upload a video to extract high-quality stills</p>
                    </div>
                ) : (
                    <div className="flex flex-col h-full w-full items-center justify-center animate-fade-in">
                        <div 
                            ref={imageEditorRef}
                            className="relative aspect-[4/5] h-full max-h-[85vh] w-auto max-w-full bg-black rounded-xl overflow-hidden shadow-2xl cursor-move group ring-8 ring-white"
                            onMouseDown={handleMouseDown}
                        >
                            <img 
                                src={frameToShow} 
                                className="absolute w-full h-full object-cover pointer-events-none transition-transform duration-75 ease-out select-none"
                                style={{ 
                                    objectPosition: `${imagePosition.x}% ${imagePosition.y}%`,
                                    transform: `scale(${zoom})` 
                                }}
                                draggable={false}
                            />
                            <div 
                                ref={textBlockRef}
                                className="absolute cursor-move z-20 px-6 py-4 bg-white text-brand-dark font-extrabold text-3xl uppercase text-center shadow-2xl select-none"
                                style={{
                                    top: `${textPosition.y}%`,
                                    left: `${textPosition.x}%`,
                                    transform: 'translate(-50%, -50%)',
                                    maxWidth: '85%',
                                    lineHeight: 1.1
                                }}
                                onMouseDown={handleMouseDown}
                            >
                                {hookText}
                            </div>
                            <div className="absolute inset-0 border-2 border-transparent group-hover:border-brand-purple/30 pointer-events-none transition-colors z-30">
                                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded pointer-events-none">4:5 PREVIEW</div>
                            </div>
                        </div>
                        <div className="mt-4 text-gray-400 text-xs font-bold flex gap-4">
                            <span>Drag image to pan/crop</span>
                            <span>•</span>
                            <span>Drag text to position</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoProcessor;