
import React, { useState, useEffect, useRef } from 'react';
import { getBrain, updateBrain, resetBrain, getActiveClientId, TESS_ID } from '../services/brain';
import { BrainData, LocationData, Relationship, VoiceExample, BrandFont, LocationId, Product } from '../types';
import { generateAvatarSet, generateBrainFromUrl, processBrainDump, processPersonaDump, conductPersonaInterview, generateGenAiImage, generateTrainingExamples, analyzeLocationImage } from '../services/geminiService';
import { TrashIcon } from './icons';

// --- AUTO-RESIZE TEXTAREA ---
const AutoResizeTextarea = ({ value, onChange, placeholder, className }: { value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, placeholder?: string, className?: string }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            // Reset height to auto to shrink if text was deleted, then set to scrollHeight
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`${className} overflow-hidden resize-none min-h-[3rem]`}
            rows={1}
        />
    );
};

// --- IMAGE UTILS ---
const resizeImage = (file: File, maxWidth = 1024, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const outputType = (file.type === 'image/png' || file.type === 'image/webp') ? file.type : 'image/jpeg';
                resolve(canvas.toDataURL(outputType, quality));
            };
        };
    });
};

const BrainManager: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'importer' | 'tess' | 'locations' | 'nosho' | 'training' | 'bible' | 'cv' | 'products'>('tess');
  const [brain, setBrain] = useState<BrainData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isGeneratingLocations, setIsGeneratingLocations] = useState(false);
  const [isGeneratingTraining, setIsGeneratingTraining] = useState(false);
  const [analyzingLocs, setAnalyzingLocs] = useState<Record<string, boolean>>({});
  
  const [dumpMode, setDumpMode] = useState<'chooser' | 'brand' | 'persona'>('chooser');
  const [dumpText, setDumpText] = useState('');
  const [dumpImages, setDumpImages] = useState<{data: string, mimeType: string, preview: string}[]>([]);
  const [isProcessingDump, setIsProcessingDump] = useState(false);
  
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  const isFirstRender = useRef(true);

  // Initial Load & Self-Healing
  useEffect(() => {
    const loadedBrain = getBrain();
    const currentId = getActiveClientId();

    // If we are Admin but data is missing or name is empty, force a reset (which loads Gold Copy)
    if (currentId === TESS_ID && (!loadedBrain || !loadedBrain.identity || !loadedBrain.identity.name)) {
        console.warn("BrainManager: Admin data corrupted/empty. Restoring defaults...");
        const restored = resetBrain();
        setBrain(restored);
        return;
    }

    if (loadedBrain) {
        // Ensure structure exists even if empty to prevent crashes (Self-Healing Logic)
        if (!loadedBrain.identity) loadedBrain.identity = { ...getBrain().identity } as any;
        if (!loadedBrain.identity.psychology) loadedBrain.identity.psychology = { motivation: "", fear: "", hobbies: [], habits: [] };
        if (!loadedBrain.identity.voice) loadedBrain.identity.voice = { tone: "", keywords: [], forbidden: [], emoji_style: "" };
        if (!loadedBrain.identity.socials) loadedBrain.identity.socials = [];
        
        if (!loadedBrain.styleGuide) loadedBrain.styleGuide = { persona_definition: "", visual_identity: "", content_pillars: "", content_examples: "", humor_pillars: "" };
        if (!loadedBrain.training) loadedBrain.training = [];
        if (!loadedBrain.locations) loadedBrain.locations = {};
        if (!loadedBrain.relationships) loadedBrain.relationships = [];
        if (!loadedBrain.strategy) loadedBrain.strategy = { ...getBrain().strategy } as any;
        if (!loadedBrain.brand.products) loadedBrain.brand.products = [];
        
        setBrain(loadedBrain);
    }
    
    const justHired = localStorage.getItem('tess_just_hired');
    if (justHired) {
        setActiveSection('locations');
        localStorage.removeItem('tess_just_hired');
    }
  }, []);

  useEffect(() => {
      if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
      }
      if (brain) {
          setSaveStatus('saving');
          const timer = setTimeout(() => {
              try {
                  updateBrain(brain);
                  setSaveStatus('saved');
                  setTimeout(() => setSaveStatus('idle'), 2000);
              } catch (e) {
                  setSaveStatus('idle');
                  alert("Error saving data.");
              }
          }, 1500);
          return () => clearTimeout(timer);
      }
  }, [brain]);

  // Drag Drop Handlers
  const handleDragOver = (e: React.DragEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActiveId(id);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActiveId(null);
  };

  const processLocationFiles = async (locId: string, files: FileList) => {
        if (!brain) return;
        setAnalyzingLocs(prev => ({ ...prev, [locId]: true }));
        try {
            const newImages: string[] = [];
            const fileArray = Array.from(files);
            for (const file of fileArray) {
                const base64 = await resizeImage(file, 1024);
                newImages.push(base64);
            }

            const loc = brain.locations[locId];
            // Only keep new image if we are replacing, or push if multi? 
            // For now, let's treat upload as "Replace" or "Add" depending on context. 
            // But usually we just want one main image. Let's prepend.
            const updatedImages = [...newImages, ...(loc.imageUrls || [])];
            let newVisualData = loc.visualData;
            
            if (newImages.length > 0) {
                 const firstImageBase64 = newImages[0];
                 const mimeType = firstImageBase64.split(';')[0].split(':')[1];
                 const cleanBase64 = firstImageBase64.split(',')[1];
                 const analysis = await analyzeLocationImage(cleanBase64, mimeType);
                 if (analysis) newVisualData = analysis;
            }

            setBrain({ 
                ...brain, 
                locations: { 
                    ...brain.locations, 
                    [locId]: { 
                        ...loc, 
                        imageUrls: updatedImages, 
                        imageUrl: updatedImages[0], 
                        visualData: newVisualData 
                    } 
                } 
            });
        } catch (error) {
            console.error(error);
            alert("Error processing images");
        } finally {
            setAnalyzingLocs(prev => ({ ...prev, [locId]: false }));
        }
  };

  const handleLocationDrop = (e: React.DragEvent, locId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActiveId(null);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processLocationFiles(locId, e.dataTransfer.files);
        }
  };

  const handleLogoDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActiveId(null);
        const file = e.dataTransfer.files?.[0];
        if (file && brain) {
            const base64 = await resizeImage(file);
            setBrain({ ...brain, brand: { ...brain.brand, logo: base64 } });
        }
  };

  const handleThumbRefDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActiveId(null);
        const file = e.dataTransfer.files?.[0];
        if (file && brain) {
            const base64 = await resizeImage(file);
            setBrain({ ...brain, brand: { ...brain.brand, thumbnailStyle: { ...brain.brand.thumbnailStyle, referenceImage: base64 } } });
        }
  };

  const handleReset = () => {
    if (confirm("Are you sure? This will revert all changes to the current profile.")) {
        const defaults = resetBrain();
        setBrain(defaults);
    }
  }

  const handleGenerateTraining = async () => {
      if (!brain) return;
      setIsGeneratingTraining(true);
      try {
          const examples = await generateTrainingExamples(brain);
          if (examples.length > 0) {
              const newTraining = [...(brain.training || []), ...examples];
              setBrain({ ...brain, training: newTraining });
          }
      } catch (e) {
          alert("Failed to generate examples.");
      } finally {
          setIsGeneratingTraining(false);
      }
  };

  const handleGenerateLocationImages = async () => {
      if (!brain) return;
      setIsGeneratingLocations(true);
      const newLocations = { ...brain.locations };
      try {
          const keys = Object.keys(newLocations);
          for (const key of keys) {
              const loc = newLocations[key];
              if (loc.imageUrl) continue;
              const masterPrompt = `MASTER SHOT: ${loc.name}. ${loc.visualData}. ${loc.defaultContext}. Style: High-end architectural photography, natural light, cinematic, realistic textures. NO TEXT OVERLAYS.`;
              // USE 16:9 for locations
              const masterImage = await generateGenAiImage(masterPrompt, false, true, null, '16:9');
              if (masterImage) {
                  newLocations[key] = { ...loc, imageUrl: masterImage, imageUrls: [masterImage] };
                  setBrain(prev => prev ? ({ ...prev, locations: { ...newLocations } }) : null);
                  updateBrain({ locations: newLocations });
              }
          }
      } catch (e) { alert("Generation failed"); } finally { setIsGeneratingLocations(false); }
  };

  const handleSingleLocationGenerate = async (locId: string) => {
      if (!brain) return;
      setIsGeneratingLocations(true);
      const loc = brain.locations[locId];
      try {
          const masterPrompt = `MASTER SHOT: ${loc.name}. ${loc.visualData}. ${loc.defaultContext}. Style: High-end architectural photography, natural light, cinematic, realistic textures. NO TEXT OVERLAYS.`;
          // USE 16:9 for locations
          const masterImage = await generateGenAiImage(masterPrompt, false, true, null, '16:9');
          if (masterImage) {
              const newLocations = { ...brain.locations };
              newLocations[locId] = { ...loc, imageUrl: masterImage, imageUrls: [masterImage] };
              setBrain(prev => prev ? ({ ...prev, locations: newLocations }) : null);
          }
      } catch (e) { console.error(e); } finally { setIsGeneratingLocations(false); }
  };

  const handleRelImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && brain) {
          const file = e.target.files[0];
          const base64 = await resizeImage(file);
          const newRels = [...(brain.relationships || [])];
          newRels[index] = { ...newRels[index], avatar: base64 };
          setBrain({ ...brain, relationships: newRels });
      }
  };

  const handleDumpFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newImages = [];
          const files = Array.from(e.target.files) as File[];
          for (const file of files) {
              const base64 = await resizeImage(file);
              const mimeType = base64.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
              newImages.push({ data: base64.split(',')[1], mimeType, preview: base64 });
          }
          setDumpImages(prev => [...prev, ...newImages]);
      }
  };

  const handleBrandDumpProcess = async () => {
      if (!brain) return;
      setIsProcessingDump(true);
      try {
          const result = await processBrainDump(dumpText, dumpImages);
          const newBrain = { ...brain, brand: { ...brain.brand, ...result.brand }, styleGuide: { ...brain.styleGuide, ...result.styleGuide } };
          if (result.logoIndex !== undefined && dumpImages[result.logoIndex]) newBrain.brand.logo = dumpImages[result.logoIndex].preview;
          setBrain(newBrain);
          updateBrain(newBrain);
          setDumpText('');
          setDumpImages([]);
          alert("✅ Brand Data Extracted!");
          setActiveSection('nosho');
          setDumpMode('chooser');
      } catch (e) { alert("Failed"); } finally { setIsProcessingDump(false); }
  };

  const handlePersonaDumpProcess = async () => {
      if (!brain) return;
      setIsProcessingDump(true);
      try {
          const result = await processPersonaDump(dumpText);
          const newBrain = { ...brain, identity: { ...brain.identity, ...result, voice: { ...brain.identity.voice, ...result.voice }, psychology: { ...brain.identity.psychology, ...result.psychology } } };
          setBrain(newBrain);
          updateBrain(newBrain);
          setDumpText('');
          alert("✅ Persona Analyzed!");
          setActiveSection('tess');
          setDumpMode('chooser');
      } catch(e) { alert("Failed"); } finally { setIsProcessingDump(false); }
  };

  const handleLocationImageUpload = async (locId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0 && brain) {
          processLocationFiles(locId, e.target.files);
          e.target.value = ''; 
      }
  };

  const handleRemoveImageOnly = (locId: string) => {
      if (!brain) return;
      const loc = brain.locations[locId];
      setBrain({
          ...brain,
          locations: {
              ...brain.locations,
              [locId]: {
                  ...loc,
                  imageUrl: "",
                  imageUrls: [] 
              }
          }
      });
  };
  
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0] && brain) {
          const base64 = await resizeImage(e.target.files[0]);
          setBrain({ ...brain, brand: { ...brain.brand, logo: base64 } });
      }
  };

  const handleThumbnailStyleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0] && brain) {
          const base64 = await resizeImage(e.target.files[0]);
          setBrain({ ...brain, brand: { ...brain.brand, thumbnailStyle: { ...brain.brand.thumbnailStyle, referenceImage: base64 } } });
      }
  };

  const handleArrayChange = (path: 'psychology.hobbies' | 'psychology.habits', value: string) => {
      if (!brain) return;
      const items = value.split(',').map(s => s.trim());
      if (path === 'psychology.hobbies') {
          setBrain({...brain, identity: {...brain.identity, psychology: {...brain.identity.psychology, hobbies: items}}});
      } else {
          setBrain({...brain, identity: {...brain.identity, psychology: {...brain.identity.psychology, habits: items}}});
      }
  };

  const handleAddLocation = () => {
      if (!brain) return;
      const newId = `LOC_${Date.now()}`;
      const newLocation: LocationData = {
          id: newId,
          name: "New Location",
          visualData: "",
          defaultContext: "",
          imageUrls: [],
          is360: false
      };
      setBrain({
          ...brain,
          locations: {
              ...brain.locations,
              [newId]: newLocation
          }
      });
  };

  const handleDeleteLocation = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!brain) return;
      if (confirm("Delete this location?")) {
          const newLocs = { ...brain.locations };
          delete newLocs[id];
          const newBrain = { ...brain, locations: newLocs };
          setBrain(newBrain);
          updateBrain(newBrain); // Immediate save
      }
  };

  const handleClearLocations = () => {
      if (!brain) return;
      if (confirm("Delete ALL locations? This cannot be undone.")) {
          setBrain({ ...brain, locations: {} });
      }
  };

  // --- PRODUCT HANDLERS ---
  const handleAddProduct = () => {
      if (!brain) return;
      const newProduct: Product = {
          id: `PROD_${Date.now()}`,
          name: "New Item",
          price: "£0.00",
          description: "",
          imageUrl: ""
      };
      const newProducts = [...(brain.brand.products || []), newProduct];
      setBrain({ ...brain, brand: { ...brain.brand, products: newProducts } });
  };

  const handleDeleteProduct = (id: string) => {
      if (!brain) return;
      if (confirm("Delete product?")) {
          const newProducts = brain.brand.products.filter(p => p.id !== id);
          setBrain({ ...brain, brand: { ...brain.brand, products: newProducts } });
      }
  };

  const handleProductChange = (id: string, field: keyof Product, value: string) => {
      if (!brain) return;
      const newProducts = brain.brand.products.map(p => p.id === id ? { ...p, [field]: value } : p);
      setBrain({ ...brain, brand: { ...brain.brand, products: newProducts } });
  };

  const handleProductImageUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && brain) {
          const file = e.target.files[0];
          const base64 = await resizeImage(file);
          const newProducts = brain.brand.products.map(p => p.id === id ? { ...p, imageUrl: base64 } : p);
          setBrain({ ...brain, brand: { ...brain.brand, products: newProducts } });
      }
  };

  if (!brain) return <div className="p-10">Loading...</div>;

  const isTessAdmin = getActiveClientId() === TESS_ID;

  return (
    <div className="p-8 max-w-6xl mx-auto pb-32 animate-fade-in relative">
      <header className="mb-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-md py-4 px-6 rounded-2xl border border-white/50 shadow-sm">
        <div className="flex-1">
            <h2 className="text-3xl font-extrabold text-brand-dark tracking-tight">Persona Engine</h2>
            <p className="text-brand-muted text-sm">Configure the AI's brain, relationships, and known locations.</p>
        </div>
        <div className="flex gap-3 items-center">
            {isTessAdmin && (
                <button onClick={handleReset} className="px-4 py-2 rounded-xl bg-brand-dark text-white text-xs font-bold transition-colors hover:bg-gray-800 shadow-md">
                    Restore Tess Defaults
                </button>
            )}
            {!isTessAdmin && (
                <button onClick={handleReset} className="px-4 py-2 rounded-xl text-red-400 hover:bg-red-50 text-xs font-bold transition-colors">
                    Reset to Blank
                </button>
            )}
            <div className="flex items-center gap-2 px-4">
                {saveStatus === 'saving' && <span className="text-xs font-bold text-brand-purple animate-pulse">Saving...</span>}
                {saveStatus === 'saved' && <span className="text-xs font-bold text-green-500">Saved</span>}
            </div>
        </div>
      </header>

      <div className="flex gap-2 mb-8 p-1 bg-gray-100 rounded-xl inline-flex overflow-x-auto max-w-full custom-scrollbar">
        {[
            { id: 'tess', label: '👤 Identity & Network' },
            { id: 'cv', label: '📄 The CV' },
            { id: 'locations', label: '📍 Locations' },
            { id: 'products', label: '🛍️ Products' },
            { id: 'importer', label: '📥 Knowledge Dump' },
            { id: 'bible', label: '💅 The Style Guide' },
            { id: 'training', label: '🎙️ Voice Tuner' },
            { id: 'nosho', label: '🏢 Brand Strategy' }
        ].map((tab) => (
            <button 
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeSection === tab.id ? 'bg-white text-brand-dark shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'}`}
            >
                {tab.label}
            </button>
        ))}
      </div>

      {activeSection === 'importer' && (
          <div className="space-y-6 animate-fade-in">
              {dumpMode === 'chooser' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 max-w-4xl mx-auto">
                      <div onClick={() => setDumpMode('brand')} className="bg-white p-10 rounded-3xl shadow-lg border border-gray-100 hover:border-brand-cyan hover:shadow-brand-cyan/20 transition-all cursor-pointer group">
                          <h3 className="text-xl font-extrabold text-brand-dark mb-2">Brand Vault</h3>
                          <p className="text-sm text-gray-500 leading-relaxed">Upload "Brand Bibles", Logo files, or strategy text.</p>
                      </div>
                      <div onClick={() => setDumpMode('persona')} className="bg-white p-10 rounded-3xl shadow-lg border border-gray-100 hover:border-brand-purple hover:shadow-brand-purple/20 transition-all cursor-pointer group">
                          <h3 className="text-xl font-extrabold text-brand-dark mb-2">Persona Dossier</h3>
                          <p className="text-sm text-gray-500 leading-relaxed">Paste "Day in the Life" notes, diaries, or character descriptions.</p>
                      </div>
                  </div>
              )}
               {dumpMode !== 'chooser' && (
                   <div className="space-y-6">
                       <div className="text-center"><button onClick={() => setDumpMode('chooser')} className="text-sm text-gray-500 hover:text-brand-dark">← Back to Chooser</button></div>
                       <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 max-w-4xl mx-auto">
                           <h3 className="text-xl font-bold text-brand-dark mb-4">{dumpMode === 'brand' ? 'Brand Knowledge Dump' : 'Persona Dossier Upload'}</h3>
                           <AutoResizeTextarea value={dumpText} onChange={(e) => setDumpText(e.target.value)} placeholder="Paste data here..." className="w-full p-4 rounded-xl border border-gray-200 mb-4 outline-none focus:border-brand-purple bg-gray-50" />
                           <button onClick={dumpMode === 'brand' ? handleBrandDumpProcess : handlePersonaDumpProcess} disabled={isProcessingDump} className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold hover:bg-gray-800 transition-colors">{isProcessingDump ? 'Processing...' : 'Analyze & Update Brain'}</button>
                       </div>
                   </div>
               )}
          </div>
      )}
      
      {activeSection === 'tess' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
            <div className="space-y-6">
                {/* CORE IDENTITY */}
                <div className="glass-effect p-8 rounded-3xl">
                    <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest mb-6">Core Identity</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="label-sm">Full Name</label><input type="text" value={brain.identity.name} onChange={(e) => setBrain({...brain, identity: {...brain.identity, name: e.target.value}})} className="input-std" /></div>
                            <div><label className="label-sm">Job Role</label><input type="text" value={brain.identity.role} onChange={(e) => setBrain({...brain, identity: {...brain.identity, role: e.target.value}})} className="input-std" /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div><label className="label-sm">Age</label><input type="number" value={brain.identity.age} onChange={(e) => setBrain({...brain, identity: {...brain.identity, age: parseInt(e.target.value)}})} className="input-std" /></div>
                            <div><label className="label-sm">Pronouns</label><input type="text" value={brain.identity.pronouns} onChange={(e) => setBrain({...brain, identity: {...brain.identity, pronouns: e.target.value}})} className="input-std" /></div>
                            <div><label className="label-sm">Birthday</label><input type="text" value={brain.identity.birthday} onChange={(e) => setBrain({...brain, identity: {...brain.identity, birthday: e.target.value}})} className="input-std" /></div>
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <label className="label-sm">Bio</label>
                                <span className={`text-[10px] font-bold ${brain.identity.bio.length >= 150 ? 'text-red-500' : 'text-gray-400'}`}>
                                    {brain.identity.bio.length}/150
                                </span>
                            </div>
                            <textarea 
                                value={brain.identity.bio} 
                                onChange={(e) => setBrain({...brain, identity: {...brain.identity, bio: e.target.value}})} 
                                className="input-area h-24 min-h-[6rem]" 
                                placeholder="Short, punchy bio with emojis ✨" 
                                maxLength={150}
                            />
                        </div>
                    </div>
                </div>

                {/* SOCIAL STATS */}
                <div className="glass-effect p-8 rounded-3xl">
                    <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest mb-6">Social Presence</h3>
                    {brain.identity.socials.map((social, idx) => (
                        <div key={idx} className="grid grid-cols-3 gap-4 mb-2">
                            <div><label className="label-sm">Handle</label><input value={social.handle} onChange={(e) => {
                                const newSocials = [...brain.identity.socials];
                                newSocials[idx].handle = e.target.value;
                                setBrain({...brain, identity: {...brain.identity, socials: newSocials}});
                            }} className="input-std" /></div>
                            <div><label className="label-sm">Followers</label><input value={social.followers} onChange={(e) => {
                                const newSocials = [...brain.identity.socials];
                                newSocials[idx].followers = e.target.value;
                                setBrain({...brain, identity: {...brain.identity, socials: newSocials}});
                            }} className="input-std" /></div>
                            <div><label className="label-sm">Following</label><input value={social.following} onChange={(e) => {
                                const newSocials = [...brain.identity.socials];
                                newSocials[idx].following = e.target.value;
                                setBrain({...brain, identity: {...brain.identity, socials: newSocials}});
                            }} className="input-std" /></div>
                        </div>
                    ))}
                </div>
                
                <div className="glass-effect p-8 rounded-3xl">
                    <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest mb-6">Character Consistency / Reference Photos</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {brain.identity.referenceImages?.map((img, idx) => (
                            <div key={idx} className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden group">
                                <img src={img} className="w-full h-full object-cover" />
                                <button onClick={() => {
                                    const newRefs = [...(brain.identity.referenceImages || [])];
                                    newRefs.splice(idx, 1);
                                    setBrain({...brain, identity: {...brain.identity, referenceImages: newRefs}});
                                }} className="absolute top-2 right-2 bg-black/50 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                            </div>
                        ))}
                        <label className="aspect-[3/4] bg-white border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-brand-purple transition-colors">
                            <span className="text-2xl text-gray-400">+</span>
                            <span className="text-[10px] font-bold text-gray-500 mt-2 uppercase">Add Reference</span>
                            <input type="file" multiple accept="image/*" className="hidden" onChange={async (e) => {
                                if (e.target.files) {
                                    const files = Array.from(e.target.files) as File[];
                                    const newImages = await Promise.all(files.map(f => resizeImage(f)));
                                    setBrain({...brain, identity: {...brain.identity, referenceImages: [...(brain.identity.referenceImages || []), ...newImages]}});
                                }
                            }} />
                        </label>
                    </div>
                    <p className="text-[10px] text-gray-400">Upload clear photos of the subject (Front, Side, Candid) to help the AI maintain consistency.</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* DEEP PSYCHOLOGY */}
                <div className="glass-effect p-8 rounded-3xl">
                    <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest mb-6">Psychology & Routine</h3>
                    <div className="space-y-4">
                        <div><label className="label-sm">Backstory</label><AutoResizeTextarea value={brain.identity.backstory} onChange={(e) => setBrain({...brain, identity: {...brain.identity, backstory: e.target.value}})} className="input-area" placeholder="Where did they come from? How did they get here?" /></div>
                        <div><label className="label-sm">Daily Routine</label><AutoResizeTextarea value={brain.identity.daily_routine} onChange={(e) => setBrain({...brain, identity: {...brain.identity, daily_routine: e.target.value}})} className="input-area" placeholder="Morning coffee order? Commute? Evening unwind?" /></div>
                        <div><label className="label-sm">Core Motivation</label><input type="text" value={brain.identity.psychology?.motivation || ''} onChange={(e) => setBrain({...brain, identity: {...brain.identity, psychology: {...(brain.identity.psychology || {}), motivation: e.target.value} as any}})} className="input-std" /></div>
                        <div><label className="label-sm">Biggest Fear</label><input type="text" value={brain.identity.psychology?.fear || ''} onChange={(e) => setBrain({...brain, identity: {...brain.identity, psychology: {...(brain.identity.psychology || {}), fear: e.target.value} as any}})} className="input-std" /></div>
                        <div><label className="label-sm">Hobbies (comma separated)</label><input type="text" value={brain.identity.psychology?.hobbies?.join(', ') || ''} onChange={(e) => handleArrayChange('psychology.hobbies', e.target.value)} className="input-std" /></div>
                        <div><label className="label-sm">Habits / Quirks (comma separated)</label><input type="text" value={brain.identity.psychology?.habits?.join(', ') || ''} onChange={(e) => handleArrayChange('psychology.habits', e.target.value)} className="input-std" /></div>
                    </div>
                </div>

                {/* RELATIONSHIPS */}
                <div className="glass-effect p-8 rounded-3xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest">Network / Relationships</h3>
                        <button onClick={() => {
                            const newRel = { id: `REL_${Date.now()}`, name: "New Person", role: "Friend", dynamic: "Close", sentiment: "positive" as const, avatar: "" };
                            setBrain({...brain, relationships: [...brain.relationships, newRel]});
                        }} className="text-xs font-bold text-brand-purple hover:underline">+ Add Person</button>
                    </div>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {brain.relationships.map((rel, idx) => (
                            <div key={rel.id} className="bg-white/50 p-4 rounded-xl border border-gray-100 flex gap-4">
                                <div className="relative group shrink-0">
                                    <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden">
                                        {rel.avatar ? <img src={rel.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>}
                                    </div>
                                    <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 cursor-pointer">
                                        Edit
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleRelImageUpload(idx, e)} />
                                    </label>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <input value={rel.name} onChange={(e) => {
                                            const newRels = [...brain.relationships];
                                            newRels[idx].name = e.target.value;
                                            setBrain({...brain, relationships: newRels});
                                        }} className="input-std py-1 px-2 text-xs font-bold" placeholder="Name" />
                                        <input value={rel.role} onChange={(e) => {
                                            const newRels = [...brain.relationships];
                                            newRels[idx].role = e.target.value;
                                            setBrain({...brain, relationships: newRels});
                                        }} className="input-std py-1 px-2 text-xs" placeholder="Role (e.g. Boss)" />
                                    </div>
                                    <AutoResizeTextarea value={rel.dynamic} onChange={(e) => {
                                        const newRels = [...brain.relationships];
                                        newRels[idx].dynamic = e.target.value;
                                        setBrain({...brain, relationships: newRels});
                                    }} className="input-area py-1 px-2 text-xs" placeholder="Describe their dynamic..." />
                                    <div className="flex justify-between items-center">
                                        <select value={rel.sentiment} onChange={(e) => {
                                            const newRels = [...brain.relationships];
                                            newRels[idx].sentiment = e.target.value as any;
                                            setBrain({...brain, relationships: newRels});
                                        }} className="bg-transparent text-xs font-bold text-gray-500 border-none outline-none cursor-pointer">
                                            <option value="positive">Positive 💚</option>
                                            <option value="neutral">Neutral 😐</option>
                                            <option value="negative">Negative 😡</option>
                                            <option value="complicated">Complicated 🌀</option>
                                        </select>
                                        <button onClick={() => {
                                            const newRels = brain.relationships.filter((_, i) => i !== idx);
                                            setBrain({...brain, relationships: newRels});
                                        }} className="text-xs text-red-300 hover:text-red-500">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
      )}

      {activeSection === 'nosho' && (
            <div className="glass-effect p-8 rounded-3xl animate-fade-in">
                <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest mb-6">Brand Strategy</h3>
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className="label-sm">Brand Name</label><input type="text" value={brain.brand.name} onChange={(e) => setBrain({...brain, brand: {...brain.brand, name: e.target.value}})} className="input-std" /></div>
                        <div><label className="label-sm">Industry</label><input type="text" value={brain.brand.industry} onChange={(e) => setBrain({...brain, brand: {...brain.brand, industry: e.target.value}})} className="input-std" /></div>
                     </div>
                     <div><label className="label-sm">Tagline</label><input type="text" value={brain.brand.tagline} onChange={(e) => setBrain({...brain, brand: {...brain.brand, tagline: e.target.value}})} className="input-std" /></div>
                     <div><label className="label-sm">What we sell</label><AutoResizeTextarea value={brain.brand.what_we_sell} onChange={(e) => setBrain({...brain, brand: {...brain.brand, what_we_sell: e.target.value}})} className="input-area" /></div>
                     <div><label className="label-sm">Target Audience</label><AutoResizeTextarea value={brain.brand.target_audience} onChange={(e) => setBrain({...brain, brand: {...brain.brand, target_audience: e.target.value}})} className="input-area" /></div>
                     <div><label className="label-sm">Key Offers (comma separated)</label><input type="text" value={brain.brand.key_offers.join(', ')} onChange={(e) => setBrain({...brain, brand: {...brain.brand, key_offers: e.target.value.split(',').map(s => s.trim())}})} className="input-std" /></div>
                     <div><label className="label-sm">Competitors (comma separated)</label><input type="text" value={brain.brand.competitors.join(', ')} onChange={(e) => setBrain({...brain, brand: {...brain.brand, competitors: e.target.value.split(',').map(s => s.trim())}})} className="input-std" /></div>
                     <div><label className="label-sm">Tone of Voice</label><AutoResizeTextarea value={brain.brand.tone_of_voice} onChange={(e) => setBrain({...brain, brand: {...brain.brand, tone_of_voice: e.target.value}})} className="input-area" /></div>
                     <div><label className="label-sm">Brand Values</label><AutoResizeTextarea value={brain.brand.values} onChange={(e) => setBrain({...brain, brand: {...brain.brand, values: e.target.value}})} className="input-area" /></div>
                     <div><label className="label-sm">Raw Knowledge Base</label><AutoResizeTextarea value={brain.brand.raw_knowledge} onChange={(e) => setBrain({...brain, brand: {...brain.brand, raw_knowledge: e.target.value}})} className="input-area" /></div>
                     
                     <div className="grid grid-cols-2 gap-6 mt-6">
                        <div>
                            <label className="label-sm mb-2 block">Brand Logo</label>
                            <div 
                                className={`flex items-center gap-4 p-2 rounded-xl transition-all ${dragActiveId === 'logo' ? 'bg-brand-purple/10 ring-2 ring-brand-purple' : ''}`}
                                onDragOver={(e) => handleDragOver(e, 'logo')}
                                onDragLeave={handleDragLeave}
                                onDrop={handleLogoDrop}
                            >
                                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                    {brain.brand.logo ? <img src={brain.brand.logo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Logo</div>}
                                </div>
                                <input type="file" onChange={handleLogoUpload} className="text-xs" />
                            </div>
                        </div>
                        <div>
                            <label className="label-sm mb-2 block">Thumbnail Style Ref</label>
                            <div 
                                className={`flex items-center gap-4 p-2 rounded-xl transition-all ${dragActiveId === 'thumb_ref' ? 'bg-brand-purple/10 ring-2 ring-brand-purple' : ''}`}
                                onDragOver={(e) => handleDragOver(e, 'thumb_ref')}
                                onDragLeave={handleDragLeave}
                                onDrop={handleThumbRefDrop}
                            >
                                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                    {brain.brand.thumbnailStyle?.referenceImage ? <img src={brain.brand.thumbnailStyle.referenceImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Ref</div>}
                                </div>
                                <input type="file" onChange={handleThumbnailStyleUpload} className="text-xs" />
                            </div>
                        </div>
                     </div>
                </div>
            </div>
      )}

      {activeSection === 'cv' && (
             <div className="glass-effect p-8 rounded-3xl animate-fade-in">
                 <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest mb-6">Persona CV</h3>
                 {!brain.personaCV ? (
                     <div className="text-center py-10 text-gray-400">Run a Brand Scan to generate the CV.</div>
                 ) : (
                     <div className="space-y-4">
                         <div><label className="label-sm">Audience Archetype</label><input type="text" value={brain.personaCV.audienceArchetype} onChange={(e) => setBrain({...brain, personaCV: {...brain.personaCV!, audienceArchetype: e.target.value}})} className="input-std" /></div>
                         <div className="grid grid-cols-2 gap-4">
                            <div><label className="label-sm">Fears</label><AutoResizeTextarea value={brain.personaCV.fears.join('\n')} onChange={(e) => setBrain({...brain, personaCV: {...brain.personaCV!, fears: e.target.value.split('\n')}})} className="input-area" /></div>
                            <div><label className="label-sm">Desires</label><AutoResizeTextarea value={brain.personaCV.desires.join('\n')} onChange={(e) => setBrain({...brain, personaCV: {...brain.personaCV!, desires: e.target.value.split('\n')}})} className="input-area" /></div>
                         </div>
                         <div><label className="label-sm">Price Sensitivity</label><select value={brain.personaCV.priceSensitivity} onChange={(e) => setBrain({...brain, personaCV: {...brain.personaCV!, priceSensitivity: e.target.value as any}})} className="input-std"><option value="low">Low</option><option value="mid">Mid</option><option value="high">High</option></select></div>
                     </div>
                 )}
             </div>
      )}

      {activeSection === 'products' && (
          <div className="glass-effect p-8 rounded-3xl animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest">Inventory & Products</h3>
                      <p className="text-xs text-gray-500 mt-1">Upload products for Tess to "Shadow Sell" in her content.</p>
                  </div>
                  <button onClick={handleAddProduct} className="text-xs font-bold bg-brand-dark text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">+ Add Product</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {brain.brand.products.length === 0 && <div className="text-center text-gray-400 py-10 col-span-2">No products added yet.</div>}
                  {brain.brand.products.map((prod) => (
                      <div key={prod.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-3 relative group">
                          <button 
                              onClick={() => handleDeleteProduct(prod.id)} 
                              className="absolute top-4 right-4 bg-white text-gray-300 hover:text-red-500 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-gray-100 z-10"
                          >
                              <TrashIcon className="w-4 h-4" />
                          </button>
                          
                          <div className="flex gap-4">
                              <div className="w-24 h-24 bg-gray-50 rounded-lg shrink-0 overflow-hidden relative border border-gray-200 group/img">
                                  {prod.imageUrl ? (
                                      <img src={prod.imageUrl} className="w-full h-full object-cover" />
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">🛍️</div>
                                  )}
                                  <label className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white text-xs font-bold cursor-pointer transition-opacity">
                                      Upload
                                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleProductImageUpload(prod.id, e)} />
                                  </label>
                              </div>
                              <div className="flex-1 space-y-2">
                                  <input 
                                      value={prod.name} 
                                      onChange={(e) => handleProductChange(prod.id, 'name', e.target.value)} 
                                      className="input-std py-1.5 px-3 text-sm font-bold" 
                                      placeholder="Product Name" 
                                  />
                                  <input 
                                      value={prod.price} 
                                      onChange={(e) => handleProductChange(prod.id, 'price', e.target.value)} 
                                      className="input-std py-1.5 px-3 text-sm" 
                                      placeholder="Price (e.g. £90)" 
                                  />
                              </div>
                          </div>
                          
                          <AutoResizeTextarea 
                              value={prod.description} 
                              onChange={(e) => handleProductChange(prod.id, 'description', e.target.value)} 
                              className="input-area py-2 px-3 text-xs" 
                              placeholder="Describe product (e.g. 'New limited edition sneakers')" 
                          />
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeSection === 'locations' && (
             <div className="animate-fade-in space-y-6">
                 <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                     <div>
                        <h3 className="text-xl font-bold text-brand-dark">Locations</h3>
                        <p className="text-sm text-gray-500">Visual contexts for content generation.</p>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={handleClearLocations} className="bg-white border border-red-200 text-red-500 px-4 py-3 rounded-xl font-bold text-sm hover:bg-red-50 shadow-sm">Clear All</button>
                        <button onClick={handleAddLocation} className="bg-white border border-gray-200 text-brand-dark px-4 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 shadow-sm">+ Add Location</button>
                        <button onClick={handleGenerateLocationImages} disabled={isGeneratingLocations} className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50">{isGeneratingLocations ? 'Generating Visuals...' : 'Generate All Visuals'}</button>
                     </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {Object.entries(brain.locations).map(([key, rawLoc]) => {
                         const loc = rawLoc as LocationData;
                         return (
                         <div key={key} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 relative group/card hover:shadow-md transition-shadow">
                             
                             {/* 1. Header: Name + Delete Location */}
                             <div className="flex items-start justify-between gap-3">
                                 <div className="flex-1">
                                     <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Location Name</label>
                                     <input 
                                        value={loc.name} 
                                        onChange={(e) => setBrain({...brain, locations: {...brain.locations, [key]: {...loc, name: e.target.value}}})} 
                                        className="font-bold text-lg text-brand-dark w-full bg-transparent border-b border-transparent focus:border-gray-200 p-0 focus:ring-0 placeholder-gray-300" 
                                        placeholder="e.g. Living Room" 
                                     />
                                 </div>
                                 <button 
                                    type="button"
                                    onClick={(e) => handleDeleteLocation(key, e)}
                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Delete this Location Card"
                                 >
                                     <TrashIcon className="w-5 h-5" />
                                 </button>
                             </div>
                             
                             {/* 2. Visual Area */}
                             <div 
                                className={`aspect-video bg-gray-50 rounded-xl overflow-hidden relative group/image border border-gray-100 transition-all ${dragActiveId === key ? 'ring-4 ring-brand-purple border-transparent' : ''}`}
                                onDragOver={(e) => handleDragOver(e, key)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleLocationDrop(e, key)}
                             >
                                 {loc.imageUrl ? (
                                     <>
                                        <img src={loc.imageUrl} className="w-full h-full object-cover" />
                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-brand-dark/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                                            
                                            <div className="flex gap-2">
                                                <label className="cursor-pointer bg-white text-brand-dark px-4 py-2 rounded-lg text-xs font-bold hover:scale-105 transition-transform shadow-lg flex items-center gap-2">
                                                    <span>📷</span> Replace
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleLocationImageUpload(key, e)} />
                                                </label>
                                                <button onClick={() => handleSingleLocationGenerate(key)} className="bg-brand-purple text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-pink hover:scale-105 transition-all shadow-lg flex items-center gap-2">
                                                    <span>✨</span> Regenerate
                                                </button>
                                            </div>

                                            <button 
                                                onClick={() => handleRemoveImageOnly(key)} 
                                                className="text-white/80 hover:text-red-400 text-xs font-bold flex items-center gap-1 mt-2 hover:underline"
                                            >
                                                <TrashIcon className="w-3 h-3" /> Remove Image
                                            </button>
                                        </div>
                                     </>
                                 ) : (
                                     <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                                         <span className="text-4xl opacity-20">🖼️</span>
                                         <div className="flex flex-col gap-2 items-center">
                                             <p className="text-xs font-medium">No Image</p>
                                             <div className="flex gap-2">
                                                 <label className="cursor-pointer text-brand-purple bg-brand-purple/5 border border-brand-purple/20 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-purple hover:text-white transition-colors">
                                                     Upload
                                                     <input type="file" className="hidden" accept="image/*" onChange={(e) => handleLocationImageUpload(key, e)} />
                                                 </label>
                                                 <button onClick={() => handleSingleLocationGenerate(key)} className="text-brand-purple bg-brand-purple/5 border border-brand-purple/20 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-purple hover:text-white transition-colors">
                                                     AI Generate
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                 )}
                                 
                                 {/* Drag Overlay */}
                                 {dragActiveId === key && (
                                     <div className="absolute inset-0 bg-brand-purple/20 flex items-center justify-center pointer-events-none z-20">
                                         <div className="bg-white px-4 py-2 rounded-full font-bold text-brand-purple shadow-lg animate-bounce">
                                             Drop to Upload
                                         </div>
                                     </div>
                                 )}

                                 {/* 360 Badge */}
                                 <div className="absolute top-2 right-2 z-10">
                                     <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setBrain({...brain, locations: {...brain.locations, [key]: {...loc, is360: !loc.is360}}}); }}
                                        className={`text-[10px] font-black px-2 py-1 rounded-md shadow-sm transition-all border ${loc.is360 ? 'bg-brand-purple text-white border-brand-purple' : 'bg-white/90 text-gray-400 border-gray-200 hover:bg-white'}`}
                                     >
                                         360° {loc.is360 ? 'ON' : 'OFF'}
                                     </button>
                                 </div>
                             </div>

                             {/* 3. Description */}
                             <div>
                                 <div className="flex justify-between items-end mb-1">
                                     <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Visual Prompt (AI)</label>
                                     {analyzingLocs[loc.id] && <span className="text-[10px] font-bold text-brand-purple animate-pulse">Analyzing...</span>}
                                 </div>
                                 <AutoResizeTextarea 
                                    value={loc.visualData} 
                                    onChange={(e) => setBrain({...brain, locations: {...brain.locations, [key]: {...loc, visualData: e.target.value}}})} 
                                    className="text-sm text-gray-700 w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none transition-all leading-relaxed" 
                                    placeholder="Describe the environment..." 
                                 />
                             </div>

                         </div>
                     );
                     })}
                 </div>
             </div>
      )}

      {activeSection === 'bible' && (
             <div className="glass-effect p-8 rounded-3xl animate-fade-in space-y-6">
                 <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest mb-6">Style Guide</h3>
                 <div><label className="label-sm">Persona Definition</label><AutoResizeTextarea value={brain.styleGuide.persona_definition} onChange={(e) => setBrain({...brain, styleGuide: {...brain.styleGuide, persona_definition: e.target.value}})} className="input-area" /></div>
                 <div><label className="label-sm">Visual Identity</label><AutoResizeTextarea value={brain.styleGuide.visual_identity} onChange={(e) => setBrain({...brain, styleGuide: {...brain.styleGuide, visual_identity: e.target.value}})} className="input-area" /></div>
                 <div><label className="label-sm">Content Pillars</label><AutoResizeTextarea value={brain.styleGuide.content_pillars} onChange={(e) => setBrain({...brain, styleGuide: {...brain.styleGuide, content_pillars: e.target.value}})} className="input-area" /></div>
                 <div><label className="label-sm">Humor Pillars</label><AutoResizeTextarea value={brain.styleGuide.humor_pillars} onChange={(e) => setBrain({...brain, styleGuide: {...brain.styleGuide, humor_pillars: e.target.value}})} className="input-area" /></div>
             </div>
      )}

      {activeSection === 'training' && (
             <div className="glass-effect p-8 rounded-3xl animate-fade-in">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-widest">Voice Tuner</h3>
                    <button onClick={handleGenerateTraining} disabled={isGeneratingTraining} className="text-xs font-bold text-brand-purple hover:underline">{isGeneratingTraining ? 'Generating...' : 'Generate Examples'}</button>
                 </div>
                 <div className="space-y-4">
                     {brain.training.map((ex, i) => (
                         <div key={i} className="bg-white p-4 rounded-xl border border-gray-100">
                             <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Input</label><div className="text-sm text-gray-600">{ex.input}</div></div>
                             <div><label className="text-[10px] text-brand-purple uppercase font-bold">Output (Voice)</label><AutoResizeTextarea value={ex.output} onChange={(e) => {
                                 const newTraining = [...brain.training];
                                 newTraining[i].output = e.target.value;
                                 setBrain({...brain, training: newTraining});
                             }} className="w-full p-2 bg-gray-50 rounded border border-gray-200 text-sm mt-1" /></div>
                         </div>
                     ))}
                     {brain.training.length === 0 && <div className="text-center text-gray-400 py-10">No training examples yet.</div>}
                 </div>
             </div>
      )}
    </div>
  );
};

export default BrainManager;
