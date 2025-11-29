
import React, { useState, useRef, useEffect, useReducer } from 'react';
import { FeedItem, EditorLayer, DesignTemplate, EditorHistoryState, CanvasConfig } from '../types';
import VideoProcessor from './VideoProcessor';
import { getBrain, saveDesignTemplate } from '../services/brain';
import { 
    UndoIcon, RedoIcon, LayersIcon, AlignLeftIcon, AlignCenterIcon, 
    AlignRightIcon, LockIcon, UnlockIcon, EyeIcon, EyeOffIcon, 
    TrashIcon, CopyLayerIcon, GroupIcon, LayoutIcon, DownloadIcon, 
    TextIcon, UploadIcon, GenerateIcon, CheckIcon
} from './icons';
import { generateGenAiImage } from '../services/geminiService';

const CANVAS_PRESETS = [
    { name: 'Vertical 2:3', width: 1080, height: 1620 },
    { name: 'IG Portrait', width: 1080, height: 1350 },
    { name: 'IG Story', width: 1080, height: 1920 },
    { name: 'Square', width: 1080, height: 1080 },
    { name: 'Landscape', width: 1920, height: 1080 },
];

const DEFAULT_BRAND_FONTS = [
    { name: 'Inter', family: '"Inter", sans-serif' },
    { name: 'Anton', family: '"Anton", sans-serif' },
    { name: 'Playfair', family: '"Playfair Display", serif' },
    { name: 'Courier', family: '"Courier Prime", monospace' },
    { name: 'Permanent Marker', family: '"Permanent Marker", cursive' },
    { name: 'Oswald', family: '"Oswald", sans-serif' },
    { name: 'Dancing Script', family: '"Dancing Script", cursive' },
    { name: 'Montserrat', family: '"Montserrat", sans-serif' },
    { name: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
];

const INITIAL_CANVAS_CONFIG: CanvasConfig = {
    width: 1080,
    height: 1620,
    name: 'Untitled Design',
    backgroundColor: '#ffffff'
};

interface EditorState {
    layers: EditorLayer[];
    selectedLayerIds: string[];
    canvasConfig: CanvasConfig;
    history: EditorHistoryState[];
    historyIndex: number;
    zoom: number;
    pan: { x: number, y: number };
}

type EditorAction = 
    | { type: 'ADD_LAYER', layer: EditorLayer }
    | { type: 'UPDATE_LAYER', id: string, updates: Partial<EditorLayer> }
    | { type: 'DELETE_LAYERS', ids: string[] }
    | { type: 'SELECT_LAYER', id: string, multi: boolean }
    | { type: 'DESELECT_ALL' }
    | { type: 'SET_CANVAS_CONFIG', config: Partial<CanvasConfig> }
    | { type: 'REORDER_LAYER', id: string, direction: 'up' | 'down' | 'top' | 'bottom' }
    | { type: 'MOVE_LAYER', fromIndex: number, toIndex: number }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'SET_ZOOM', zoom: number }
    | { type: 'SET_PAN', x: number, y: number }
    | { type: 'LOAD_TEMPLATE', template: DesignTemplate }
    | { type: 'RESET' };

const generateId = () => `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
    });
};

const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
    const pushHistory = (newState: EditorState): EditorState => {
        const history = state.history.slice(0, state.historyIndex + 1);
        const newEntry: EditorHistoryState = {
            layers: JSON.parse(JSON.stringify(newState.layers)),
            canvasConfig: { ...newState.canvasConfig },
            timestamp: Date.now()
        };
        return {
            ...newState,
            history: [...history, newEntry],
            historyIndex: history.length
        };
    };

    switch (action.type) {
        case 'ADD_LAYER':
            return pushHistory({
                ...state,
                layers: [...state.layers, action.layer],
                selectedLayerIds: [action.layer.id]
            });

        case 'UPDATE_LAYER':
            return pushHistory({
                ...state,
                layers: state.layers.map(l => l.id === action.id ? { ...l, ...action.updates } : l)
            });

        case 'DELETE_LAYERS':
            return pushHistory({
                ...state,
                layers: state.layers.filter(l => !action.ids.includes(l.id)),
                selectedLayerIds: []
            });

        case 'SELECT_LAYER':
            if (action.multi) {
                const isSelected = state.selectedLayerIds.includes(action.id);
                return {
                    ...state,
                    selectedLayerIds: isSelected 
                        ? state.selectedLayerIds.filter(id => id !== action.id)
                        : [...state.selectedLayerIds, action.id]
                };
            }
            return { ...state, selectedLayerIds: [action.id] };

        case 'DESELECT_ALL': return { ...state, selectedLayerIds: [] };

        case 'SET_CANVAS_CONFIG':
            return pushHistory({ ...state, canvasConfig: { ...state.canvasConfig, ...action.config } });
        
        case 'REORDER_LAYER':
            const layers = [...state.layers];
            const index = layers.findIndex(l => l.id === action.id);
            if (index === -1) return state;
            const layer = layers[index];
            layers.splice(index, 1);
            if (action.direction === 'up') layers.splice(Math.min(layers.length, index + 1), 0, layer);
            if (action.direction === 'down') layers.splice(Math.max(0, index - 1), 0, layer);
            if (action.direction === 'top') layers.push(layer);
            if (action.direction === 'bottom') layers.unshift(layer);
            return pushHistory({ ...state, layers: layers.map((l, i) => ({ ...l, zIndex: i + 1 })) });

        case 'MOVE_LAYER': {
            const { fromIndex, toIndex } = action;
            if (fromIndex === toIndex) return state;
            const newLayers = [...state.layers];
            const [movedLayer] = newLayers.splice(fromIndex, 1);
            newLayers.splice(toIndex, 0, movedLayer);
            return pushHistory({ ...state, layers: newLayers.map((l, i) => ({ ...l, zIndex: i + 1 })) });
        }

        case 'UNDO':
            if (state.historyIndex <= 0) return state;
            const prev = state.history[state.historyIndex - 1];
            return { ...state, layers: prev.layers, canvasConfig: prev.canvasConfig, historyIndex: state.historyIndex - 1, selectedLayerIds: [] };

        case 'REDO':
            if (state.historyIndex >= state.history.length - 1) return state;
            const next = state.history[state.historyIndex + 1];
            return { ...state, layers: next.layers, canvasConfig: next.canvasConfig, historyIndex: state.historyIndex + 1, selectedLayerIds: [] };

        case 'SET_ZOOM': return { ...state, zoom: action.zoom };
        case 'SET_PAN': return { ...state, pan: { x: action.x, y: action.y } };
            
        case 'LOAD_TEMPLATE':
            if (action.template.type === 'overlay') {
                const templateLayers = action.template.layers.map(l => ({ ...l, id: generateId(), zIndex: state.layers.length + l.zIndex }));
                return pushHistory({ ...state, layers: [...state.layers, ...templateLayers], selectedLayerIds: templateLayers.map(l => l.id) });
            }
            return pushHistory({ ...state, layers: action.template.layers, canvasConfig: action.template.canvasConfig, selectedLayerIds: [] });
            
        case 'RESET': return { ...state, layers: [], canvasConfig: INITIAL_CANVAS_CONFIG, history: [], historyIndex: -1 };
        default: return state;
    }
};

type Tab = 'design' | 'text' | 'elements' | 'uploads' | 'brand' | 'video' | 'templates';

const ThumbnailMaker: React.FC<{ onAddToFeed: (item: FeedItem) => void }> = ({ onAddToFeed }) => {
    const [activeTab, setActiveTab] = useState<Tab>('design');
    const [state, dispatch] = useReducer(editorReducer, {
        layers: [], selectedLayerIds: [], canvasConfig: INITIAL_CANVAS_CONFIG, history: [], historyIndex: -1, zoom: 0.35, pan: { x: 0, y: 0 }
    });
    
    const canvasRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [uploads, setUploads] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false); 
    const [draggedLayerIndex, setDraggedLayerIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    
    const [resizeState, setResizeState] = useState<{ active: boolean; layerId: string; handle: string; startX: number; startY: number; startLayer: EditorLayer; } | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [saveAsOverlay, setSaveAsOverlay] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingToFeed, setIsSavingToFeed] = useState(false);

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging || resizeState) {
                setIsDragging(false); setResizeState(null); setDragStart(null);
            }
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('mouseleave', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            window.removeEventListener('mouseleave', handleGlobalMouseUp);
        };
    }, [isDragging, resizeState]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpacePressed(true);
            if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedLayerIds.length > 0 && (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')) {
                dispatch({ type: 'DELETE_LAYERS', ids: state.selectedLayerIds });
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                e.shiftKey ? dispatch({ type: 'REDO' }) : dispatch({ type: 'UNDO' });
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(false); };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, [state.selectedLayerIds]);

    const addLayer = (type: EditorLayer['type'], props: Partial<EditorLayer> = {}) => {
        const defaults = { width: type === 'image' ? 1 : 0.3, height: type === 'image' ? 1 : 0.3, x: 0.5, y: 0.5 };
        const newLayer: EditorLayer = {
            id: generateId(), name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${state.layers.length + 1}`, type, locked: false, visible: true, rotation: 0, opacity: 1, zIndex: state.layers.length + 1, ...defaults, ...props
        };
        dispatch({ type: 'ADD_LAYER', layer: newLayer });
    };

    const captureCanvas = async () => {
        const { width, height, backgroundColor } = state.canvasConfig;
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = width;
        exportCanvas.height = height;
        const ctx = exportCanvas.getContext("2d");
        if (!ctx) return null;

        ctx.fillStyle = backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, width, height);

        const layers = [...state.layers].sort((a, b) => a.zIndex - b.zIndex);
        for (const layer of layers) {
            if (!layer.visible) continue;
            if (layer.type === "text") {
                ctx.save();
                ctx.translate(layer.x * width, layer.y * height);
                ctx.rotate((layer.rotation * Math.PI) / 180);
                ctx.textAlign = layer.textAlign || "center";
                ctx.fillStyle = layer.color || "#000000";
                ctx.font = `${layer.fontWeight || 400} ${layer.fontSize}px ${layer.fontFamily ? layer.fontFamily.replace(/"/g, '') : "sans-serif"}`;
                ctx.fillText(layer.content || "", 0, 0);
                ctx.restore();
            }
            if (layer.type === "image" && layer.src) {
                await new Promise<void>((resolve) => {
                    const img = new Image();
                    if (layer.src?.startsWith('http')) img.crossOrigin = "anonymous";
                    img.src = layer.src!;
                    img.onload = () => {
                        ctx.save();
                        ctx.translate(layer.x * width, layer.y * height);
                        ctx.rotate((layer.rotation * Math.PI) / 180);
                        const w = layer.width * width;
                        const h = layer.height * height;
                        ctx.drawImage(img, -w/2, -h/2, w, h);
                        ctx.restore();
                        resolve();
                    };
                    img.onerror = () => resolve();
                });
            }
            if (layer.type === "shape") {
                ctx.save();
                ctx.translate(layer.x * width, layer.y * height);
                ctx.rotate((layer.rotation * Math.PI) / 180);
                ctx.fillStyle = layer.backgroundColor || "#000";
                const w = layer.width * width;
                const h = layer.height * height;
                ctx.fillRect(-w/2, -h/2, w, h);
                ctx.restore();
            }
        }
        return exportCanvas.toDataURL("image/png");
    };

    const handleExport = async () => {
        const url = await captureCanvas();
        if (!url) return alert("Export failed.");
        const link = document.createElement("a");
        link.download = `nosho_${Date.now()}.png`;
        link.href = url;
        link.click();
    };
    
    const handleSaveTemplateClick = () => { setSaveName(`Template ${new Date().toLocaleDateString()}`); setSaveAsOverlay(false); setShowSaveModal(true); };

    const confirmSaveTemplate = async () => {
        if (!canvasRef.current || !saveName) return;
        setIsSaving(true);
        try {
            const thumbnail = await captureCanvas();
            if (!thumbnail) throw new Error("Failed to capture thumbnail");
            const layersToSave = saveAsOverlay ? state.layers.filter(l => l.type !== 'image') : state.layers;
            const template: DesignTemplate = {
                id: `tpl_${Date.now()}`, name: saveName, thumbnail, layers: layersToSave, canvasConfig: state.canvasConfig, lastModified: Date.now(), type: saveAsOverlay ? 'overlay' : 'design'
            };
            saveDesignTemplate(template);
            setShowSaveModal(false);
            setActiveTab('templates');
        } catch (e) { console.error("Template Save Failed", e); } finally { setIsSaving(false); }
    };
    
    const handleSendToPlanner = async () => {
        setIsSavingToFeed(true);
        try {
            const url = await captureCanvas();
            if (!url) throw new Error("Failed to generate feed image");
            onAddToFeed({ id: `design_${Date.now()}`, type: 'image', imageUrls: [url], caption: 'Designed in Studio', hashtags: ['#design'] });
        } catch (e) { console.error("Failed to save to feed", e); } finally { setIsSavingToFeed(false); }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            for (const file of files) {
                const url = await fileToDataUrl(file as File);
                setUploads(prev => [url, ...prev]);
            }
        }
    };
    
    const handleVideoAssetAdd = (feedItem: FeedItem) => {
        setActiveTab('design');
        if (feedItem.imageUrls[0]) addLayer('image', { src: feedItem.imageUrls[0], name: 'Video Frame' });
        if (feedItem.caption) addLayer('text', { content: feedItem.caption, fontSize: 80, fontWeight: '900', color: '#ffffff', width: 0.8, x: 0.5, y: 0.5, textAlign: 'center', name: 'Hook Text' });
    };

    const handleLayerDragStart = (e: React.DragEvent, index: number) => { setDraggedLayerIndex(index); e.dataTransfer.effectAllowed = "move"; };
    const handleLayerDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); if (draggedLayerIndex === null || draggedLayerIndex === index) return; setDragOverIndex(index); };
    const handleLayerDrop = (e: React.DragEvent, targetIndex: number) => { e.preventDefault(); setDragOverIndex(null); if (draggedLayerIndex === null || draggedLayerIndex === targetIndex) return; dispatch({ type: 'MOVE_LAYER', fromIndex: draggedLayerIndex, toIndex: targetIndex }); setDraggedLayerIndex(null); };
    const handleCanvasDrop = (e: React.DragEvent) => { e.preventDefault(); const type = e.dataTransfer.getData("type"); const src = e.dataTransfer.getData("src"); if (type === 'upload' && src) addLayer('image', { src, width: 1, height: 1, x: 0.5, y: 0.5 }); };
    const handleCanvasDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };

    const handleResizeStart = (e: React.MouseEvent, layerId: string, handle: string) => {
        e.stopPropagation(); const layer = state.layers.find(l => l.id === layerId); if (!layer) return;
        setResizeState({ active: true, layerId, handle, startX: e.clientX, startY: e.clientY, startLayer: { ...layer } });
    };

    const handleMouseDown = (e: React.MouseEvent, layerId: string | null) => {
        if (isSpacePressed) { setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); return; }
        if (layerId) { e.stopPropagation(); dispatch({ type: 'SELECT_LAYER', id: layerId, multi: e.shiftKey }); setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); } 
        else { dispatch({ type: 'DESELECT_ALL' }); }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (resizeState?.active && canvasRef.current) {
            e.preventDefault(); e.stopPropagation();
            const rect = canvasRef.current.getBoundingClientRect();
            const deltaX = (e.clientX - resizeState.startX); const deltaY = (e.clientY - resizeState.startY);
            const dxPct = deltaX / rect.width; const dyPct = deltaY / rect.height;
            const { handle, startLayer } = resizeState;
            let newW = startLayer.width; let newH = startLayer.height;
            if (handle.includes('e')) newW = Math.max(0.01, startLayer.width + dxPct);
            if (handle.includes('s')) newH = Math.max(0.01, startLayer.height + dyPct);
            dispatch({ type: 'UPDATE_LAYER', id: resizeState.layerId, updates: { width: newW, height: newH } });
            return;
        }
        if (!isDragging || !dragStart) return;
        if (isSpacePressed) {
            const dx = e.clientX - dragStart.x; const dy = e.clientY - dragStart.y;
            dispatch({ type: 'SET_PAN', x: state.pan.x + dx, y: state.pan.y + dy });
            setDragStart({ x: e.clientX, y: e.clientY });
        } else if (state.selectedLayerIds.length > 0 && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const dx = (e.clientX - dragStart.x) / (rect.width); const dy = (e.clientY - dragStart.y) / (rect.height);
            state.selectedLayerIds.forEach(id => { const layer = state.layers.find(l => l.id === id); if (layer && !layer.locked) dispatch({ type: 'UPDATE_LAYER', id, updates: { x: layer.x + dx, y: layer.y + dy } }); });
            setDragStart({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => { setIsDragging(false); setResizeState(null); setDragStart(null); };
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); const delta = e.deltaY > 0 ? 0.9 : 1.1; dispatch({ type: 'SET_ZOOM', zoom: Math.max(0.1, state.zoom * delta) }); } 
        else { dispatch({ type: 'SET_PAN', x: state.pan.x - e.deltaX, y: state.pan.y - e.deltaY }); }
    };

    const renderPropertiesPanel = () => {
        if (state.selectedLayerIds.length === 0) {
            return (
                <div className="p-4 space-y-6">
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Canvas Size</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {CANVAS_PRESETS.map(p => (
                                <button key={p.name} onClick={() => dispatch({ type: 'SET_CANVAS_CONFIG', config: { width: p.width, height: p.height } })} className={`p-3 text-xs border rounded-lg hover:bg-gray-50 flex justify-between items-center ${state.canvasConfig.width === p.width && state.canvasConfig.height === p.height ? 'border-brand-purple bg-brand-purple/5 text-brand-purple font-bold' : 'border-gray-200 text-gray-600'}`}><span>{p.name}</span><span className="opacity-50 text-[10px]">{p.width}x{p.height}</span></button>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }
        const layer = state.layers.find(l => l.id === state.selectedLayerIds[0]);
        if (!layer) return null;
        return (
            <div className="p-4 space-y-6 h-full overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                    <span className="text-xs font-bold uppercase text-gray-400">{layer.type} Properties</span>
                    <div className="flex gap-1">
                        <button onClick={() => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { locked: !layer.locked } })} className={`p-1.5 rounded hover:bg-gray-100 ${layer.locked ? 'text-brand-purple' : 'text-gray-400'}`}>{layer.locked ? '🔒' : '🔓'}</button>
                        <button onClick={() => dispatch({ type: 'DELETE_LAYERS', ids: [layer.id] })} className="p-1.5 rounded hover:bg-red-50 text-red-500">🗑️</button>
                    </div>
                </div>
                <div><label className="text-xs font-bold text-gray-500 block mb-1">Opacity</label><input type="range" min="0" max="1" step="0.05" value={layer.opacity} onChange={(e) => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { opacity: parseFloat(e.target.value) } })} className="w-full accent-brand-purple"/></div>
                {layer.type === 'text' && (
                    <>
                        <div><label className="text-xs font-bold text-gray-500 block mb-1">Content</label><textarea value={layer.content} onChange={(e) => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { content: e.target.value } })} className="w-full p-2 border rounded text-xs" /></div>
                        <div><label className="text-xs font-bold text-gray-500 block mb-1">Font Size</label><input type="number" value={layer.fontSize} onChange={(e) => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { fontSize: parseInt(e.target.value) } })} className="w-full p-2 border rounded text-xs" /></div>
                        <div><label className="text-xs font-bold text-gray-500 block mb-1">Color</label><input type="color" value={layer.color} onChange={(e) => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { color: e.target.value } })} className="w-full h-8 rounded cursor-pointer" /></div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Font Family</label>
                            <select value={layer.fontFamily} onChange={(e) => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { fontFamily: e.target.value } })} className="w-full p-2 border rounded text-xs">
                                {DEFAULT_BRAND_FONTS.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                            </select>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-screen w-full bg-gray-100 font-sans overflow-hidden select-none" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <div className="w-20 bg-[#0f0f0f] flex flex-col items-center border-r border-gray-800 shrink-0 z-30">
                <div className="flex-1 w-full flex flex-col items-center py-4 space-y-1">
                    {[{ id: 'design', label: 'Design', icon: '📚' }, { id: 'templates', label: 'Templates', icon: '📐' }, { id: 'text', label: 'Text', icon: '🔤' }, { id: 'elements', label: 'Elements', icon: '🔷' }, { id: 'uploads', label: 'Uploads', icon: '📤' }, { id: 'brand', label: 'Brand', icon: '🏢' }, { id: 'video', label: 'Video', icon: '📹' }].map((tool) => (
                        <button key={tool.id} onClick={() => setActiveTab(tool.id as Tab)} className={`w-full flex flex-col items-center justify-center py-3 gap-1 transition-all relative ${activeTab === tool.id ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}>{activeTab === tool.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-purple rounded-r"></div>}<span className="text-xl">{tool.icon}</span><span className="text-[10px] font-medium">{tool.label}</span></button>
                    ))}
                </div>
                <div className="pb-4 w-full flex flex-col items-center"><button onClick={() => dispatch({ type: 'RESET' })} className="p-2 text-gray-600 hover:text-white transition-colors">🗑️</button></div>
            </div>

            {activeTab === 'video' ? (
                <div className="flex-1 bg-[#1e1e1e] flex flex-col h-full overflow-hidden relative">
                    <div className="absolute inset-0 z-0 opacity-5 bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[length:20px_20px]"></div>
                    <div className="relative z-10 h-full flex flex-col">
                        <div className="flex-1 bg-white overflow-hidden shadow-2xl border border-gray-800">
                            <VideoProcessor onAddToFeed={handleVideoAssetAdd} />
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="w-80 bg-[#1e1e1e] flex flex-col border-r border-gray-800 shrink-0 z-20 transition-all duration-300 shadow-xl">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                            {activeTab === 'design' && (
                                <div className="space-y-6 animate-fade-in">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Layers</h3>
                                    <div className="space-y-1">
                                        {[...state.layers].reverse().map((layer, i) => {
                                            const realIndex = state.layers.length - 1 - i;
                                            const isSelected = state.selectedLayerIds.includes(layer.id);
                                            return (
                                                <div key={layer.id} draggable onDragStart={(e) => handleLayerDragStart(e, realIndex)} onDragOver={(e) => handleLayerDragOver(e, realIndex)} onDrop={(e) => handleLayerDrop(e, realIndex)} onDragLeave={() => setDragOverIndex(null)} onClick={(e) => dispatch({ type: 'SELECT_LAYER', id: layer.id, multi: e.shiftKey })} className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer border transition-all group ${isSelected ? 'bg-brand-purple/20 border-brand-purple' : 'bg-[#2a2a2a] border-transparent hover:bg-[#333]'} ${draggedLayerIndex === realIndex ? 'opacity-50' : 'opacity-100'}`}>
                                                    <div className="text-gray-600 hover:text-white cursor-grab active:cursor-grabbing">⋮⋮</div>
                                                    <div className="text-gray-400 group-hover:text-white transition-colors">{layer.type === 'text' && 'T'}{layer.type === 'image' && '🖼️'}{layer.type === 'shape' && '⬜️'}</div>
                                                    <span className={`text-xs font-medium truncate flex-1 ${isSelected ? 'text-white' : 'text-gray-300'}`}>{layer.name || layer.content || 'Layer'}</span>
                                                </div>
                                            );
                                        })}
                                        {state.layers.length === 0 && <p className="text-xs text-gray-600 text-center py-10">Canvas is empty</p>}
                                    </div>
                                </div>
                            )}
                            {activeTab === 'text' && (
                                <div className="space-y-4 animate-fade-in">
                                    <button onClick={() => addLayer('text', { fontSize: 80, fontWeight: '900', content: 'Heading' })} className="w-full bg-[#333] hover:bg-[#444] p-4 rounded-lg text-left border border-white/5 transition-colors"><h1 className="text-2xl font-bold text-white">Add a heading</h1></button>
                                    <button onClick={() => addLayer('text', { fontSize: 50, fontWeight: 'bold', content: 'Subheading' })} className="w-full bg-[#333] hover:bg-[#444] p-3 rounded-lg text-left border border-white/5 transition-colors"><h2 className="text-lg font-semibold text-gray-200">Add a subheading</h2></button>
                                </div>
                            )}
                            {activeTab === 'uploads' && (
                                <div className="space-y-4 animate-fade-in">
                                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-brand-purple text-white font-bold py-3 rounded-lg shadow-lg hover:bg-brand-pink transition-colors flex items-center justify-center gap-2">📤 Upload Media</button>
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    <div className="grid grid-cols-2 gap-2">{uploads.map((url, i) => (<img key={i} src={url} className="aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 border border-transparent hover:border-brand-purple" onClick={() => addLayer('image', { src: url, width: 1, height: 1, x: 0.5, y: 0.5 })} draggable onDragStart={(e) => { e.dataTransfer.setData("type", "upload"); e.dataTransfer.setData("src", url); }} />))}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-w-0 bg-gray-100 relative">
                        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-20">
                            <div className="flex items-center gap-2">
                                <button onClick={() => dispatch({ type: 'UNDO' })} className="p-2 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-50" disabled={state.historyIndex <= 0}>↩️</button>
                                <button onClick={() => dispatch({ type: 'REDO' })} className="p-2 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-50" disabled={state.historyIndex >= state.history.length - 1}>↪️</button>
                                <div className="h-4 w-px bg-gray-300 mx-2"></div>
                                <button onClick={handleSaveTemplateClick} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-bold flex items-center gap-1 transition-colors">💾 Save Template</button>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-700 hover:bg-gray-50">⬇️ Export</button>
                                <button onClick={handleSendToPlanner} disabled={isSavingToFeed} className="flex items-center gap-1 px-4 py-1.5 bg-brand-dark text-white rounded text-xs font-bold shadow-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">📮 {isSavingToFeed ? "Saving..." : "Save to Feed"}</button>
                            </div>
                        </div>

                        <div className={`flex-1 overflow-hidden relative flex items-center justify-center bg-gray-100 ${isSpacePressed ? 'cursor-grab' : 'cursor-default'}`} onMouseDown={(e) => handleMouseDown(e, null)} onWheel={handleWheel}>
                            <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundPosition: `${state.pan.x}px ${state.pan.y}px` }}></div>
                            <div ref={containerRef} className="shadow-2xl transition-transform duration-75 ease-out origin-center bg-white relative shrink-0" style={{ width: state.canvasConfig.width, height: state.canvasConfig.height, transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`, backgroundColor: state.canvasConfig.backgroundColor }}>
                                <div ref={canvasRef} id="main-canvas-layer-area" className="w-full h-full relative overflow-hidden" style={{backgroundColor: state.canvasConfig.backgroundColor}} onDrop={handleCanvasDrop} onDragOver={handleCanvasDragOver}>
                                    {state.layers.map(layer => {
                                        const isSelected = state.selectedLayerIds.includes(layer.id);
                                        if (!layer.visible) return null;
                                        return (
                                            <div key={layer.id} onMouseDown={(e) => handleMouseDown(e, layer.id)} className={`absolute group select-none ${isSelected ? 'z-[1000]' : ''}`} style={{ left: `${layer.x * 100}%`, top: `${layer.y * 100}%`, width: `${layer.width * 100}%`, height: layer.type === 'text' ? 'auto' : `${layer.height * 100}%`, transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`, zIndex: layer.zIndex, opacity: layer.opacity, cursor: isSpacePressed ? 'grab' : 'move' }}>
                                                {layer.type === 'text' && <div style={{ fontFamily: layer.fontFamily, fontSize: `${layer.fontSize}px`, fontWeight: layer.fontWeight, textAlign: layer.textAlign, color: layer.color, whiteSpace: 'pre-wrap' }}>{layer.content}</div>}
                                                {layer.type === 'shape' && <div style={{ width: '100%', height: '100%', backgroundColor: layer.backgroundColor, borderRadius: layer.shapeType === 'circle' ? '50%' : '0' }}></div>}
                                                {layer.type === 'image' && <img src={layer.src} className="w-full h-full object-cover pointer-events-none block" />}
                                                {isSelected && !layer.locked && <div className="absolute -inset-1 border border-brand-purple pointer-events-none"><div onMouseDown={(e) => handleResizeStart(e, layer.id, 'se')} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-brand-purple rounded-full shadow-sm cursor-se-resize pointer-events-auto"></div></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0 z-20 shadow-lg">{renderPropertiesPanel()}</div>
                </>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-lg font-bold text-brand-dark mb-4">Save as Template</h3>
                        <div className="space-y-4 mb-6">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label><input autoFocus value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Template Name..." className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-brand-purple text-sm" onKeyDown={(e) => e.key === 'Enter' && confirmSaveTemplate()} /></div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-gray-500 font-bold text-xs hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={confirmSaveTemplate} disabled={isSaving || !saveName} className="px-6 py-2 bg-brand-purple text-white font-bold text-xs rounded-lg hover:bg-brand-pink transition-colors disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Template'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThumbnailMaker;
