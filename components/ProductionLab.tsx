import React, { useState } from 'react';
import ThumbnailMaker from './ThumbnailMaker';
import VoiceChanger from './VoiceChanger';
import VisionAnalyst from './VisionAnalyst';
import { FeedItem } from '../types';

interface ProductionLabProps { onAddToFeed: (item: FeedItem) => void; }

const ProductionLab: React.FC<ProductionLabProps> = ({ onAddToFeed }) => {
    const [activeTool, setActiveTool] = useState<'studio' | 'voice' | 'vision'>('studio');

    return (
        <div className="flex flex-col h-full bg-gray-50">
            <div className="bg-white border-b border-gray-200 px-8 pt-6 pb-0 flex gap-8 shrink-0">
                <button onClick={() => setActiveTool('studio')} className={`pb-4 text-sm font-bold border-b-2 transition-all ${activeTool === 'studio' ? 'border-brand-purple text-brand-dark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>🎨 Thumbnail Studio</button>
                <button onClick={() => setActiveTool('voice')} className={`pb-4 text-sm font-bold border-b-2 transition-all ${activeTool === 'voice' ? 'border-brand-purple text-brand-dark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>🎙️ Voice Lab</button>
                <button onClick={() => setActiveTool('vision')} className={`pb-4 text-sm font-bold border-b-2 transition-all ${activeTool === 'vision' ? 'border-brand-purple text-brand-dark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>👁️ Vision Analyst</button>
            </div>
            <div className="flex-1 overflow-hidden relative">
                <div className={`h-full w-full ${activeTool === 'studio' ? 'block' : 'hidden'}`}><ThumbnailMaker onAddToFeed={onAddToFeed} /></div>
                <div className={`h-full w-full overflow-y-auto ${activeTool === 'voice' ? 'block' : 'hidden'}`}><VoiceChanger /></div>
                <div className={`h-full w-full overflow-y-auto ${activeTool === 'vision' ? 'block' : 'hidden'}`}><VisionAnalyst /></div>
            </div>
        </div>
    );
};

export default ProductionLab;