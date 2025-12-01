
import React, { useState, useRef, useEffect } from 'react';
import { getVoices, convertSpeechToSpeech } from '../services/elevenLabsService';
import { UploadIcon, DownloadIcon } from './icons';

interface Voice {
    voice_id: string;
    name: string;
    category: string;
    preview_url?: string;
}

const VoiceChanger: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [voices, setVoices] = useState<Voice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [resultAudioUrl, setResultAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
    
    // Video Export State
    const [isExporting, setIsExporting] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const previewAudioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadVoices();
    }, []);

    const loadVoices = async () => {
        try {
            const v = await getVoices();
            setVoices(v);
            if (v.length > 0) setSelectedVoice(v[0].voice_id);
        } catch (e) {
            setError("Could not load voices. Check your ElevenLabs API Key in Settings.");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            setFileUrl(URL.createObjectURL(f));
            setResultAudioUrl(null); // Reset previous result
            setError(null);
        }
    };

    const handleGenerate = async () => {
        if (!file || !selectedVoice) return;
        setIsProcessing(true);
        setError(null);

        try {
            const resultBlob = await convertSpeechToSpeech(file, selectedVoice);
            const url = URL.createObjectURL(resultBlob);
            setResultAudioUrl(url);
        } catch (e: any) {
            setError(e.message || "Conversion failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Synchronize Playback
    const togglePlay = () => {
        if (videoRef.current && audioRef.current && resultAudioUrl) {
            if (isPlaying) {
                videoRef.current.pause();
                audioRef.current.pause();
            } else {
                // Sync start
                videoRef.current.currentTime = 0;
                audioRef.current.currentTime = 0;
                videoRef.current.play();
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        } else if (videoRef.current && !resultAudioUrl) {
            // Just play original if no result yet
            if (isPlaying) videoRef.current.pause(); else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const onEnded = () => {
        setIsPlaying(false);
        if (videoRef.current) videoRef.current.pause();
        if (audioRef.current) audioRef.current.pause();
    };

    const handlePlayPreview = (voiceId: string, previewUrl?: string) => {
        if (!previewUrl || !previewAudioRef.current) return;

        if (previewVoiceId === voiceId) {
            // Stop
            previewAudioRef.current.pause();
            previewAudioRef.current.currentTime = 0;
            setPreviewVoiceId(null);
        } else {
            // Play new
            previewAudioRef.current.src = previewUrl;
            previewAudioRef.current.play();
            setPreviewVoiceId(voiceId);
        }
    };

    const getSupportedMimeType = () => {
        if (typeof MediaRecorder === 'undefined') return 'video/webm';
        
        const types = [
            'video/mp4', // Safari
            'video/webm;codecs=vp9', // Chrome/Firefox (High Quality)
            'video/webm', // Standard Fallback
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return 'video/webm';
    };

    const handleDownloadVideo = async () => {
        if (!videoRef.current || !resultAudioUrl) return;
        if (typeof MediaRecorder === 'undefined') {
            alert("Video recording is not supported in this browser.");
            return;
        }
        
        setIsExporting(true);
        
        try {
            const video = videoRef.current;
            // Use browser captureStream (prefixed in some browsers)
            const stream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
            
            // Prepare Audio Context to decode the blob
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const dest = audioCtx.createMediaStreamDestination();
            const response = await fetch(resultAudioUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(dest);
            
            // Combine Video Stream + New Audio Stream
            // Note: We use video tracks from the captured video element, and audio tracks from the audio context destination
            const combinedStream = new MediaStream([
                ...stream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ]);
            
            // Determine format
            const mimeType = getSupportedMimeType();
            const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
            
            // Setup Recorder
            const recorder = new MediaRecorder(combinedStream, { mimeType });
            const chunks: Blob[] = [];
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };
            
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `voice_swap_${Date.now()}.${extension}`;
                a.click();
                
                // Cleanup
                setIsExporting(false);
                setIsPlaying(false);
                video.onended = onEnded; // Restore original handler
                video.currentTime = 0;
                video.muted = false;
            };
            
            // === START RECORDING SEQUENCE ===
            
            // 1. Reset positions
            video.currentTime = 0;
            video.muted = true; // Ensure we don't record original audio or feedback loops
            
            // 2. Start recording
            recorder.start();
            
            // 3. Play sources
            // We need to play the video element so captureStream gets frames
            await video.play(); 
            source.start(0);
            
            // 4. Handle End
            // Stop recording when video ends
            video.onended = () => {
                recorder.stop();
                source.stop();
                video.pause();
            };

        } catch (e) {
            console.error("Export failed", e);
            alert("Failed to render video. Browser might not support this feature.");
            setIsExporting(false);
        }
    };

    return (
        <div className="p-10 max-w-5xl mx-auto pb-32 animate-fade-in">
            <header className="mb-10">
                <div className="inline-block px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold rounded-full uppercase tracking-widest mb-2">Powered by ElevenLabs</div>
                <h2 className="text-4xl font-extrabold text-brand-dark mb-2 tracking-tight">Voice Lab</h2>
                <p className="text-brand-muted text-lg">Upload content and swap voices using <span className="text-indigo-500 font-semibold">Speech-to-Speech</span>.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT: Controls */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block">1. Source File</label>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="h-60 border-2 border-dashed border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-indigo-300 transition-all group"
                        >
                            {file ? (
                                <div className="text-center">
                                    <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🎥</div>
                                    <p className="text-sm font-bold text-gray-700 truncate max-w-[200px]">{file.name}</p>
                                    <p className="text-[10px] text-indigo-500 font-bold mt-1">Click to change</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform text-gray-300">📂</div>
                                    <p className="text-sm font-bold text-gray-600">Upload Video or Audio</p>
                                    <p className="text-[10px] text-gray-400 mt-1">MP4, MOV, MP3, WAV</p>
                                </div>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="video/*,audio/*" className="hidden" onChange={handleFileChange} />
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block">2. Target Voice</label>
                        {error && <div className="text-xs text-red-500 bg-red-50 p-2 rounded mb-2">{error}</div>}
                        
                        {voices.length > 0 ? (
                            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                                {voices.map(voice => (
                                    <div 
                                        key={voice.voice_id}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${selectedVoice === voice.voice_id ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' : 'bg-gray-50 border border-transparent hover:bg-gray-100 text-gray-700'}`}
                                    >
                                        <div 
                                            className="flex items-center gap-3 flex-1 cursor-pointer"
                                            onClick={() => setSelectedVoice(voice.voice_id)}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold shadow-sm border border-gray-100">
                                                {voice.name.substring(0,2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold">{voice.name}</div>
                                                <div className="text-[10px] opacity-70">{voice.category}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {voice.preview_url && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handlePlayPreview(voice.voice_id, voice.preview_url); }}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border ${previewVoiceId === voice.voice_id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-200 hover:border-indigo-400 hover:text-indigo-500'}`}
                                                >
                                                    {previewVoiceId === voice.voice_id ? '⬛' : '▶'}
                                                </button>
                                            )}
                                            {selectedVoice === voice.voice_id && <span className="text-indigo-600 font-bold">✓</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-gray-400 text-xs">Loading voices...</div>
                        )}
                        <audio ref={previewAudioRef} onEnded={() => setPreviewVoiceId(null)} className="hidden" />
                    </div>

                    <button 
                        onClick={handleGenerate}
                        disabled={!file || !selectedVoice || isProcessing}
                        className="w-full py-4 bg-brand-dark text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-gray-800 disabled:opacity-50 disabled:scale-100 transition-all transform hover:scale-[1.02]"
                    >
                        {isProcessing ? (
                            <span className="flex items-center justify-center gap-2"><span className="animate-spin">⚡️</span> Processing...</span>
                        ) : (
                            "Generate New Voice"
                        )}
                    </button>
                </div>

                {/* RIGHT: Preview Studio */}
                <div className="lg:col-span-2 bg-[#111] rounded-[40px] shadow-2xl overflow-hidden relative border-8 border-white ring-1 ring-gray-200 flex flex-col">
                    <div className="flex-1 relative flex items-center justify-center bg-black">
                        {fileUrl ? (
                            file.type.includes('video') ? (
                                <video 
                                    ref={videoRef} 
                                    src={fileUrl} 
                                    className="max-h-full max-w-full" 
                                    muted={!!resultAudioUrl} // Mute video if we have new audio to play separately
                                    playsInline 
                                    onEnded={onEnded}
                                    crossOrigin="anonymous" 
                                />
                            ) : (
                                <div className="text-white flex flex-col items-center">
                                    <div className="text-6xl mb-4 animate-pulse">🎵</div>
                                    <p className="font-mono text-sm text-gray-400">Audio File Loaded</p>
                                </div>
                            )
                        ) : (
                            <div className="text-gray-700 font-bold text-xl">Preview Area</div>
                        )}
                        
                        {/* Hidden Audio Player for Result */}
                        {resultAudioUrl && (
                            <audio ref={audioRef} src={resultAudioUrl} onEnded={onEnded} />
                        )}
                        
                        {isExporting && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <div className="text-white font-bold text-lg animate-pulse">Rendering Video...</div>
                                <div className="text-gray-400 text-xs mt-2">Please do not close this window</div>
                            </div>
                        )}
                    </div>

                    {/* Playback Controls */}
                    <div className="h-24 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-8">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={togglePlay}
                                disabled={!fileUrl || isExporting}
                                className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50"
                            >
                                {isPlaying ? '⏸' : '▶'}
                            </button>
                            <div className="text-white text-xs">
                                <div className="font-bold uppercase tracking-wider text-gray-500">Status</div>
                                {resultAudioUrl ? <span className="text-green-400">Voice Swapped</span> : <span className="text-gray-400">Original</span>}
                            </div>
                        </div>

                        {resultAudioUrl && file?.type.includes('video') && (
                            <button 
                                onClick={handleDownloadVideo}
                                disabled={isExporting}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-xs font-bold hover:bg-indigo-500 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isExporting ? 'Creating...' : <span><DownloadIcon className="w-4 h-4 inline mr-1"/> Download Video</span>}
                            </button>
                        )}
                        
                        {resultAudioUrl && !file?.type.includes('video') && (
                             <a 
                                href={resultAudioUrl} 
                                download={`voice_swap_${Date.now()}.mp3`}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-xs font-bold hover:bg-indigo-500 transition-colors flex items-center gap-2"
                            >
                                <span><DownloadIcon className="w-4 h-4 inline mr-1"/> Download Audio</span>
                            </a>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default VoiceChanger;
