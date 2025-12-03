
import React, { useState, useEffect, useRef } from 'react';
import { getFeed, saveFeed, getBank, saveBank, getBrain, updateBrain } from '../services/brain';
import { FeedPost } from '../types';
import { CopyIcon, DownloadIcon, CloseIcon, TrashIcon } from './icons';

interface FeedDockProps {
    userRole?: 'admin' | 'client';
}

const StarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.007z" clipRule="evenodd" /></svg>;
const FlopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M15.73 5.25h1.035A7.465 7.465 0 0118 9.375a7.465 7.465 0 01-1.235 4.125h-.148c-.806 0-1.534.446-2.031 1.08a9.04 9.04 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672V21a.75.75 0 01-.75.75 2.25 2.25 0 01-2.25-2.25c0-1.152.26-2.243.723-3.218C7.74 15.36 8.932 14.16 10.237 13a4.5 4.5 0 001.65-2.434c.326-1.15.533-2.36.603-3.606a3 3 0 013.24-2.71z" /></svg>;

const FeedDock: React.FC<FeedDockProps> = ({ userRole = 'admin' }) => {
    const [view, setView] = useState<'grid' | 'bank'>('grid');
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [bankItems, setBankItems] = useState<any[]>([]);
    const [activePost, setActivePost] = useState<FeedPost | null>(null);
    const bankInputRef = useRef<HTMLInputElement>(null);

    const loadData = () => {
        const currentFeed = getFeed();
        const padded = currentFeed.length > 0 ? currentFeed : Array(9).fill(null).map(() => createEmptyPost());
        setPosts(padded);
        setBankItems(getBank());
    };

    const createEmptyPost = (): FeedPost => ({
        id: `SLOT_${Date.now()}_${Math.random()}_${Math.random().toString(36).substr(2, 5)}`,
        imageUrl: null,
        caption: '',
        date: new Date().toISOString(),
        status: 'draft',
        type: 'empty'
    });

    useEffect(() => {
        loadData();
        window.addEventListener('storage', loadData);
        window.addEventListener('brain_updated', loadData);
        return () => {
            window.removeEventListener('storage', loadData);
            window.removeEventListener('brain_updated', loadData);
        };
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const newItems = files.map(f => ({
                id: `BANK_${Date.now()}_${Math.random()}`,
                imageUrl: URL.createObjectURL(f as File)
            }));
            const updatedBank = [...bankItems, ...newItems];
            saveBank(updatedBank);
            setBankItems(updatedBank);
        }
    };

    const handleFeedback = (post: FeedPost, type: 'winner' | 'flop') => {
        if (!post.imageUrl) return;

        const brain = getBrain();
        const newStrategy = { ...brain.strategy };
        
        const learningPoint = `Style: ${post.type}. Note: ${post.notes || 'No context'}. Caption tone: ${post.caption.substring(0, 30)}...`;

        if (type === 'winner') {
            newStrategy.winning_patterns = [...(newStrategy.winning_patterns || []), learningPoint];
            alert("🌟 Marked as Winner! Tess will try to do more of this.");
        } else {
            newStrategy.avoid_patterns = [...(newStrategy.avoid_patterns || []), learningPoint];
            alert("📉 Marked as Flop. Tess will avoid this style.");
        }

        updateBrain({ ...brain, strategy: newStrategy as any });

        const newPosts = posts.map(p => p.id === post.id ? { ...p, feedback: type } : p);
        saveFeed(newPosts);
        if (activePost && activePost.id === post.id) {
            setActivePost({ ...post, feedback: type });
        }
    };

    const handleDeletePost = (id: string, e: React.MouseEvent) => {
        if (userRole === 'client') return;
        e.stopPropagation();
        if(!confirm("Clear slot?")) return;
        const newPosts = posts.map(p => p.id === id ? { ...p, imageUrl: null, caption: '', type: 'empty' as const, feedback: null } : p);
        saveFeed(newPosts);
        if (activePost && activePost.id === id) setActivePost(null);
    };

    const handleDeleteBank = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newBank = bankItems.filter(i => i.id !== id);
        saveBank(newBank);
        setBankItems(newBank);
    };

    const handleShipBundle = () => {
        const activePosts = posts.filter(p => p.imageUrl && p.type !== 'empty');
        if (activePosts.length === 0) return alert("Grid is empty!");

        let fileContent = `TESS OS - SHIPPING MANIFEST\nGenerated: ${new Date().toLocaleDateString()}\n\n`;
        
        activePosts.forEach((p, i) => {
            fileContent += `--- POST ${i + 1} (${p.type.toUpperCase()}) ---\n`;
            fileContent += `Date: ${p.date}\n`;
            fileContent += `Strategy Note: ${p.notes || 'N/A'}\n`;
            fileContent += `\nCAPTION:\n${p.caption}\n\n`;
            fileContent += `-----------------------------\n\n`;
        });

        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `tess_shipping_bundle_${Date.now()}.txt`;
        link.href = url;
        link.click();
        
        alert("📦 Bundle downloaded! Use the text file to copy/paste captions.");
    };

    const handleDragStart = (e: React.DragEvent, item: any, type: 'bank' | 'grid') => {
        if (userRole === 'client') return;
        e.dataTransfer.setData("type", type);
        e.dataTransfer.setData("src", item.imageUrl || "");
        e.dataTransfer.setData("id", item.id);
    };

    const handleDropOnGrid = (e: React.DragEvent, index: number) => {
        if (userRole === 'client') return;
        const src = e.dataTransfer.getData("src");
        if (!src) return;
        const newPosts = [...posts];
        newPosts[index] = { ...newPosts[index], type: 'image', imageUrl: src, status: 'draft', feedback: null };
        saveFeed(newPosts);
    };

    const getCleanCaption = (caption: string) => caption.split('#')[0].trim();
    const getHashtags = (caption: string) => caption.match(/#[\w]+/g)?.join(' ') || '';

    const copyBriefForMilanote = (post: FeedPost) => {
        const hashtags = post.caption.match(/#[\w]+/g)?.join(' ') || 'None';
        const cleanCaption = post.caption.split('#')[0].trim();
        
        const brief = `DATE: ${post.date.split('T')[0]}
STATUS: ${post.status.toUpperCase()}

📝 CAPTION:
${cleanCaption}

💬 FIRST COMMENT (HASHTAGS):
${hashtags}

🧠 STRATEGY NOTE:
${post.notes || 'No specific strategy note.'}`;

        navigator.clipboard.writeText(brief);
        alert("📋 Brief copied! Click inside Milanote and press Cmd+V to create a card.");
    };

    const copyImageToClipboard = async (imageUrl: string) => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const item = new ClipboardItem({ [blob.type]: blob });
            await navigator.clipboard.write([item]);
            alert("🖼️ Image copied! Paste into Milanote.");
        } catch (err) {
            console.error(err);
            alert("Failed to copy image to clipboard. Please drag and drop it instead.");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copied!");
    };

    const downloadImage = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `tess_post_${Date.now()}.png`;
        link.click();
    };

    // Filter for clients: Only scheduled/posted posts are shown as "Real" posts
    const visiblePosts = userRole === 'client' 
        ? posts.map(p => (p.status === 'scheduled' || p.status === 'posted') ? p : { ...p, imageUrl: null, type: 'empty' } as FeedPost)
        : posts;

    return (
        <div className="h-full flex flex-col bg-white w-full relative">
            <div className="flex border-b border-gray-200">
                <button onClick={() => setView('grid')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${view === 'grid' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-gray-400 hover:text-gray-600'}`}>🗓️ Grid</button>
                {userRole === 'admin' && <button onClick={() => setView('bank')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${view === 'bank' ? 'text-brand-dark border-b-2 border-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}>📂 Bank ({bankItems.length})</button>}
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50">
                {view === 'grid' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            {visiblePosts.map((post, idx) => (
                                <div 
                                    key={post.id || idx} 
                                    onDragOver={(e) => userRole === 'admin' && e.preventDefault()}
                                    onDrop={(e) => handleDropOnGrid(e, idx)}
                                    onClick={() => post.imageUrl && setActivePost(post)}
                                    className="aspect-[4/5] bg-white rounded-lg overflow-hidden relative group border border-gray-200 shadow-sm cursor-pointer"
                                >
                                    {post.imageUrl ? (
                                        <>
                                            <img src={post.imageUrl} className="w-full h-full object-cover" />
                                            {post.feedback === 'winner' && <div className="absolute top-1 right-1 bg-yellow-400 text-white rounded-full p-1 shadow-sm"><StarIcon /></div>}
                                            {post.feedback === 'flop' && <div className="absolute top-1 right-1 bg-gray-400 text-white rounded-full p-1 shadow-sm"><FlopIcon /></div>}
                                            
                                            {/* Hover Controls */}
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                <div className="text-white text-[10px] font-bold uppercase tracking-widest mb-1">Click to Assist</div>
                                                {userRole === 'admin' && <button onClick={(e) => handleDeletePost(post.id, e)} className="text-[10px] bg-red-500 text-white px-2 py-1 rounded font-bold hover:bg-red-600">Clear</button>}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">{idx + 1}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {posts.some(p => p.imageUrl) && userRole === 'admin' && (
                            <button onClick={handleShipBundle} className="w-full py-3 bg-brand-dark text-white rounded-xl text-xs font-bold shadow-lg hover:bg-gray-800 transition-transform hover:scale-[1.02] flex items-center justify-center gap-2">
                                <span>📦</span> Download Shipping Bundle
                            </button>
                        )}
                    </div>
                )}

                {view === 'bank' && userRole === 'admin' && (
                    <div className="space-y-4">
                        <div onClick={() => bankInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-brand-purple hover:bg-brand-purple/5 transition-all">
                            <span className="text-2xl text-gray-400">+</span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase mt-1">Upload Media</span>
                            <input ref={bankInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {bankItems.map((item) => (
                                <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, item, 'bank')} className="aspect-square bg-white rounded-lg overflow-hidden relative group border border-gray-200 shadow-sm cursor-grab active:cursor-grabbing">
                                    <img src={item.imageUrl} className="w-full h-full object-cover" />
                                    <button onClick={(e) => handleDeleteBank(item.id, e)} className="absolute top-1 right-1 text-[10px] bg-white/90 p-1 rounded-full text-red-500 opacity-0 group-hover:opacity-100 shadow-sm"><TrashIcon className="w-3 h-3"/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* --- UPDATED POST ASSISTANT MODAL --- */}
            {activePost && (
                <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-extrabold text-brand-dark flex items-center gap-2">
                            <span>🚀</span> Post Assistant
                        </h3>
                        <button onClick={() => setActivePost(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><CloseIcon className="w-5 h-5"/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        
                        {/* MILANOTE SPEED ACTIONS */}
                        <div className="bg-brand-purple/5 p-4 rounded-xl border border-brand-purple/20">
                            <label className="text-[10px] font-bold text-brand-purple uppercase tracking-widest mb-2 block">Milanote Bridge</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => activePost.imageUrl && copyImageToClipboard(activePost.imageUrl)}
                                    className="flex-1 bg-white border border-brand-purple/20 text-brand-dark py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-brand-purple hover:text-white transition-colors flex items-center justify-center gap-2"
                                >
                                    <span>🖼️</span> Copy Image
                                </button>
                                <button 
                                    onClick={() => copyBriefForMilanote(activePost)}
                                    className="flex-1 bg-white border border-brand-purple/20 text-brand-dark py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-brand-purple hover:text-white transition-colors flex items-center justify-center gap-2"
                                >
                                    <span>📝</span> Copy Brief
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 text-center">Click a button, then Cmd+V inside Milanote.</p>
                        </div>

                        <hr className="border-gray-100" />

                        {/* MANUAL POSTING TOOLS */}
                        
                        {/* 1. Image Handoff */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Manual Download</label>
                            <div className="relative rounded-xl overflow-hidden shadow-sm border border-gray-200 group bg-gray-100">
                                <img src={activePost.imageUrl!} className="w-full max-h-48 object-contain" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button 
                                        onClick={() => activePost.imageUrl && downloadImage(activePost.imageUrl)}
                                        className="bg-white text-brand-dark px-6 py-2 rounded-xl font-bold shadow-xl hover:scale-105 transition-transform flex items-center gap-2 text-xs"
                                    >
                                        <DownloadIcon className="w-4 h-4"/> Download File
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 2. Caption Handoff */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Caption (Tap to Copy)</label>
                            <div 
                                onClick={() => copyToClipboard(getCleanCaption(activePost.caption))}
                                className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs text-gray-700 hover:border-brand-purple hover:bg-brand-purple/5 cursor-pointer transition-all active:scale-95"
                            >
                                {getCleanCaption(activePost.caption)}
                            </div>
                        </div>

                        {/* 3. First Comment */}
                        {getHashtags(activePost.caption) && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Hashtags (First Comment)</label>
                                <div 
                                    onClick={() => copyToClipboard(getHashtags(activePost.caption))}
                                    className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-xs text-blue-700 hover:bg-blue-100 cursor-pointer transition-all active:scale-95 font-medium"
                                >
                                    {getHashtags(activePost.caption)}
                                </div>
                            </div>
                        )}

                        {/* 4. Feedback - Admin Only */}
                        {userRole === 'admin' && (
                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex gap-2">
                                    <button onClick={() => handleFeedback(activePost, 'winner')} className="flex-1 py-3 bg-yellow-50 text-yellow-600 rounded-xl font-bold text-xs hover:bg-yellow-100 transition-colors flex items-center justify-center gap-2 border border-yellow-200">
                                        <span>🌟</span> Viral / Good
                                    </button>
                                    <button onClick={() => handleFeedback(activePost, 'flop')} className="flex-1 py-3 bg-red-50 text-red-500 rounded-xl font-bold text-xs hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-200">
                                        <span>📉</span> Flop / Bad
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeedDock;
