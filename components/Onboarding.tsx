
import React, { useState, useEffect, useRef } from 'react';
import { getBrain, updateBrain, saveAppSettings } from '../services/brain';
import { performInitialResearch, generateOnboardingCandidates, generateStarterEnvironments, generateDeepPersona, generatePersonaGallery } from '../services/geminiService';
import { BrainData, AvatarCandidate, BrandContext, PersonaCV, BusinessInfo, VoiceMode, LocationData } from '../types';
import { CheckIcon, CloseIcon } from './icons';

declare global {
    interface Window {
        html2canvas: any;
    }
}

interface OnboardingProps {
  onComplete: () => void;
}

// Client-facing talking points explaining the "Why" and "Benefit"
const LOADING_STEPS = [
    "Analyzing Brand DNA... Decoding your unique voice so the AI feels like a human team member, not a bot.",
    "Scanning Competitors... Identifying gaps in the market so you can step in and steal their engagement.",
    "Decoding Audience Psychology... Finding the emotional triggers that turn passive followers into obsessed fans.",
    "Calibrating Tone of Voice... Fine-tuning the slang and cadence to match your specific demographic perfectly.",
    "Drafting Content Pillars... Shifting from 'random posting' to 'strategic storytelling' that drives revenue.",
    "Building Persona Backstories... Because people trust people. We're creating characters your audience will love.",
    "Aligning Visual Aesthetics... Ensuring every generated image matches your brand's premium look and feel.",
    "Simulating Customer Interactions... Testing how this persona handles DMs, complaints, and praise.",
    "Mapping Sales Funnels... Integrating 'Shadow Selling' techniques to sell without being salesy.",
    "Reviewing Industry Trends... Ensuring the persona is up-to-date with the latest viral movements.",
    "Constructing Narrative Arcs... Planning months of storytelling content, not just one-off posts.",
    "Generating Face Geometry... Creating a consistent, recognizable face for your brand ambassador.",
    "Checking Trademark Vibes... Ensuring the personality is distinct enough to be ownable.",
    "Synthesizing Humor Modules... Teaching the AI what is funny to *your* specific customer."
];

const HIRING_STEPS = [
    "Synthesizing Persona Psychology... Creating deep-seated motivations that drive authentic behavior.",
    "Designing the Living Space... Generating a home environment that reflects their specific income and taste.",
    "Validating Visual Context... Ensuring the background details match the persona's backstory.",
    "Constructing Childhood Memories... Giving them a history so they don't feel like a chatbot.",
    "Generating 'Work' Environment... Building a specific office space to anchor their professional content.",
    "Calibrating Facial Geometry... Ensuring the face looks identical across every single generated image.",
    "Simulating Social Habits... Determining how they reply to DMs based on their 'Chaos Level'.",
    "Finalizing Visual Assets... Rendering high-fidelity photos of the persona in their new home."
];

const CLIENT_BENEFITS = [
    {
        title: "Constructing the Persona's Mind",
        text: "We aren't just generating a face. We are simulating a full human psychology—memories, irrational fears, and daily habits. **Why?** Because audiences connect with *flaws and humanity*, not perfect robotic avatars."
    },
    {
        title: "Architecting Their Environment",
        text: "The AI is now building a 3D-consistent world for them to live in—a messy apartment, a specific office desk, a favorite coffee shop. **Why?** To create a 'sitcom-like' familiarity where followers recognize the background in every video."
    },
    {
        title: "Locking Visual Consistency",
        text: "We are generating a unique facial geometry map and applying it to every scene. **Why?** This ensures that whether they are at the gym or in a meeting, they are unmistakably the same person, building trust over time."
    },
    {
        title: "Simulating Professional Experience",
        text: "We are injecting 'Day Job' memories into their backstory. **Why?** So they can speak with authority about your industry, using the correct jargon and understanding the specific pain points of your customers."
    },
    {
        title: "Aligning Commercial Strategy",
        text: "The AI is learning how to weave your key selling points into casual, entertaining stories ('Shadow Selling'). **Why?** To drive revenue through entertainment without feeling 'salesy' or corporate."
    },
    {
        title: "Calibrating Tone of Voice",
        text: "We're fine-tuning the slang, cadence, and emoji usage based on the persona's age and location. **Why?** This ensures the persona sounds exactly like a native to your specific niche, avoiding the 'corporate bot' feel."
    }
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [url, setUrl] = useState('');
  const [researchData, setResearchData] = useState<string | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false); 
  const [isHiring, setIsHiring] = useState(false);
  
  const [loadingStep, setLoadingStep] = useState(0);
  const [hiringStep, setHiringStep] = useState(0);
  const [benefitIndex, setBenefitIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [researchProgress, setResearchProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  
  const [step, setStep] = useState<'input' | 'researching' | 'archetype_selection' | 'generating' | 'review' | 'cv_review'>('input');
  
  const [selectedArchetype, setSelectedArchetype] = useState<'employee' | 'megafan'>('employee');
  const [candidates, setCandidates] = useState<AvatarCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedVoiceModeIndex, setSelectedVoiceModeIndex] = useState<number>(1);
  
  // Card Deck State
  const [cardIndex, setCardIndex] = useState(0);
  
  // Drag Physics State
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  
  const [brandContext, setBrandContext] = useState<BrandContext | null>(null);
  const [personaCV, setPersonaCV] = useState<PersonaCV | null>(null);
  const [businessInfo, setBusinessInfo] = useState<Partial<BusinessInfo> | null>(null);

  // Cycle through loading messages (7 seconds)
  useEffect(() => {
      if (!isAnalyzing && !isGenerating && !isLoadingMore) return;
      const interval = setInterval(() => {
          setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
      }, 7000); 
      return () => clearInterval(interval);
  }, [isAnalyzing, isGenerating, isLoadingMore]);
  
  // Cycle through hiring messages (7 seconds)
  useEffect(() => {
      if (!isHiring) return;
      const interval = setInterval(() => {
          setHiringStep(prev => (prev + 1) % HIRING_STEPS.length);
      }, 7000); 
      return () => clearInterval(interval);
  }, [isHiring]);

  // Cycle through benefits (7 seconds)
  useEffect(() => {
      if (!isHiring && !isLoadingMore) return;
      const interval = setInterval(() => {
          setBenefitIndex(prev => (prev + 1) % CLIENT_BENEFITS.length);
      }, 7000); 
      return () => clearInterval(interval);
  }, [isHiring, isLoadingMore]);

  useEffect(() => {
      if (isAnalyzing) {
          setResearchProgress(0);
          const interval = setInterval(() => {
              setResearchProgress(prev => {
                  if (prev >= 95) return prev;
                  const remaining = 95 - prev;
                  const inc = Math.max(0.1, remaining * 0.05);
                  return prev + inc;
              });
          }, 500); 
          return () => clearInterval(interval);
      } else {
          setResearchProgress(100);
      }
  }, [isAnalyzing]);

  useEffect(() => {
      if (isGenerating) {
          setGenerationProgress(0);
          const interval = setInterval(() => {
              setGenerationProgress(prev => {
                  if (prev >= 99) return prev;
                  const remaining = 99 - prev;
                  const inc = Math.max(0.1, remaining * 0.05);
                  return prev + inc;
              });
          }, 200); 
          return () => clearInterval(interval);
      } else {
          setGenerationProgress(100);
      }
  }, [isGenerating]);

  useEffect(() => {
      const storedKey = localStorage.getItem('tess_gemini_key');
      if (storedKey) setApiKey(storedKey);
      saveAppSettings({ modelTier: 'smart', imageEngine: 'nano-pro' });
  }, []);

  // Global Drag Listeners
  useEffect(() => {
      const handleGlobalMouseMove = (e: MouseEvent) => {
          if (!isDragging) return;
          const delta = e.clientX - dragStartX.current;
          setDragX(delta);
      };

      const handleGlobalMouseUp = () => {
          if (!isDragging) return;
          setIsDragging(false);
          
          if (dragX < -150) {
              handlePass();
          } else if (dragX > 150) {
              handleSelectCandidate(candidates[cardIndex].id);
          }
          setDragX(0);
      };

      if (isDragging) {
          window.addEventListener('mousemove', handleGlobalMouseMove);
          window.addEventListener('mouseup', handleGlobalMouseUp);
      }

      return () => {
          window.removeEventListener('mousemove', handleGlobalMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
  }, [isDragging, dragX, cardIndex, candidates]);

  const handleSaveSettings = () => {
      if (apiKey) localStorage.setItem('tess_gemini_key', apiKey);
      setShowSettings(false);
      if (error && error.toLowerCase().includes('api')) setError(null);
  };

  const handleStartResearch = async () => {
    if (!url.trim()) return;
    let cleanUrl = url;
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;

    setStep('researching');
    setIsAnalyzing(true);
    setError(null);

    try {
        const rawData = await performInitialResearch(cleanUrl);
        setResearchData(rawData);
        setStep('archetype_selection');
    } catch (e) {
        console.error(e);
        const errorMsg = e instanceof Error ? e.message : "Research failed";
        setError(`Error: ${errorMsg}. Please try again.`);
        setStep('input');
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleArchetypeSelect = async (type: 'employee' | 'megafan') => {
      if (!researchData) return;
      
      setSelectedArchetype(type);
      setStep('generating');
      setIsGenerating(true);
      
      try {
          const result = await generateOnboardingCandidates(researchData, type);
          setCandidates(result.candidates);
          setBrandContext(result.brandContext);
          setPersonaCV(result.personaCV);
          setBusinessInfo(result.businessInfo);
          setCardIndex(0);
          setStep('review');
      } catch (e) {
          console.error(e);
          setError("Failed to generate candidates.");
          setStep('archetype_selection');
      } finally {
          setIsGenerating(false);
      }
  };

  const handlePass = () => {
      if (cardIndex < candidates.length) {
          setCardIndex(prev => prev + 1);
      }
  };
  
  const handleLoadMore = async () => {
      if (!researchData) return;
      setIsLoadingMore(true); 
      // Do NOT reset cardIndex. We append to the list.
      
      try {
          const result = await generateOnboardingCandidates(researchData, selectedArchetype);
          setCandidates(prev => [...prev, ...result.candidates]);
      } catch (e) {
          console.error("Failed to load more");
          setError("Failed to load more candidates. Please try again.");
      } finally {
          setIsLoadingMore(false);
      }
  };

  const handleSelectCandidate = (id: string) => {
      setSelectedCandidateId(id);
      setSelectedVoiceModeIndex(1);
      setStep('cv_review');
  };

  const handleRestoreCard = (index: number) => {
      setCardIndex(index);
  };

  const handleCardMouseDown = (e: React.MouseEvent) => {
      if (step !== 'review') return;
      setIsDragging(true);
      dragStartX.current = e.clientX;
  };

  const handleConfirmHire = async () => {
      if (!brandContext || !personaCV || !selectedCandidateId || !businessInfo) return;
      
      const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);
      if (!selectedCandidate) return;

      const mode = selectedCandidate.voiceModes[selectedVoiceModeIndex];

      setIsHiring(true);
      
      // 1. Generate Deep Persona
      let deepPersona: any = null;
      try {
          deepPersona = await generateDeepPersona(selectedCandidate, mode, businessInfo);
      } catch (e) {
          console.error("Deep persona gen failed", e);
          deepPersona = { backstory: "", daily_routine: "", psychology: { motivation: "", fear: "", habits: [], hobbies: [] }, lore: "", visual_attributes: {}, content_pillars: "", humor_pillars: "" };
      }

      // 2. Draft Brain for Locations (Needs bio & style)
      const draftBrain: BrainData = {
          ...getBrain(),
          brandContext,
          personaCV,
          onboardingType: selectedArchetype,
          brand: { ...getBrain().brand, ...businessInfo, name: businessInfo?.name || "Brand" },
          identity: {
              ...getBrain().identity,
              name: selectedCandidate.name || "Tess",
              role: selectedCandidate.day_job || "Operator",
              bio: mode.voiceDescription,
          },
          styleGuide: {
              ...getBrain().styleGuide,
              persona_definition: `**Appearance:** ${deepPersona.visual_attributes?.clothing_style}, ${deepPersona.visual_attributes?.hair_style}.\n**Vibe:** ${mode.title}.`,
          }
      };

      // 3. Generate Locations (Using Draft Brain)
      let newLocations: Record<string, LocationData> = {};
      try {
         newLocations = await generateStarterEnvironments(draftBrain, () => {});
      } catch (e) { console.error("Loc Gen Failed", e); }

      // 4. Generate Gallery (Using Candidate + Generated Locations)
      let generatedGallery: Array<{id: string, url: string, label: string}> = [];
      try {
          generatedGallery = await generatePersonaGallery(selectedCandidate, businessInfo, deepPersona, newLocations);
      } catch (e) { console.error("Gallery gen failed", e); }

      // 5. Final Brain Construction
      const currentBrain = getBrain();
      const locationPart = selectedCandidate.location ? ` Based in ${selectedCandidate.location}.` : '';
      const petPart = selectedCandidate.pet ? ` Owner of ${selectedCandidate.pet}.` : '';
      const jobPart = selectedCandidate.day_job ? ` Works as a ${selectedCandidate.day_job}.` : '';
      const enhancedBio = `${mode.voiceDescription || selectedCandidate.mission}${locationPart}${petPart}${jobPart}`;

      const newBrain: BrainData = {
          ...currentBrain,
          brandContext,
          personaCV,
          onboardingType: selectedArchetype,
          brand: {
              ...currentBrain.brand,
              ...businessInfo,
              name: businessInfo?.name || currentBrain.brand.name || "New Brand",
              key_offers: businessInfo?.key_offers || currentBrain.brand.key_offers,
              values: businessInfo?.values || currentBrain.brand.values,
              raw_knowledge: businessInfo?.raw_knowledge || currentBrain.brand.raw_knowledge
          },
          identity: {
              ...currentBrain.identity,
              name: selectedCandidate.name || "Tess",
              role: selectedCandidate.day_job || (selectedCandidate.archetype === 'employee' ? "Internal Operator" : "Super Fan Creator"),
              bio: enhancedBio,
              age: 28,
              pronouns: selectedCandidate.pronouns || "They/Them",
              birthday: selectedCandidate.birthday || "Jan 1st",
              avatar: selectedCandidate.img,
              backstory: deepPersona.backstory,
              daily_routine: deepPersona.daily_routine,
              raw_knowledge: deepPersona.lore,
              psychology: {
                  ...currentBrain.identity.psychology,
                  motivation: deepPersona.psychology.motivation,
                  fear: deepPersona.psychology.fear,
                  habits: deepPersona.psychology.habits,
                  hobbies: [selectedCandidate.hobby || "Hobby", ...(deepPersona.psychology.hobbies || [])].filter(h => h)
              },
              personality: {
                  ...currentBrain.identity.personality,
                  chaos: mode.chaosLevel || 50,
                  sarcasm: mode.sarcasmLevel || 50
              },
              voice: {
                  ...currentBrain.identity.voice,
                  tone: `${mode.title}. ${mode.voiceDescription}`,
                  emoji_style: "Authentic & Minimal",
                  keywords: [],
                  forbidden: []
              },
              avatarReferences: {
                  front: `Close up portrait of ${selectedCandidate.name}. ${deepPersona.visual_attributes?.hair_style || ''}.`,
                  side: `Side profile of ${selectedCandidate.name}. ${deepPersona.visual_attributes?.clothing_style || ''}.`,
                  candid: `Candid lifestyle shot of ${selectedCandidate.name} with ${selectedCandidate.pet || 'pet'}.`
              },
              referenceImages: [selectedCandidate.img, ...generatedGallery.map(g => g.url)],
              cameraRoll: generatedGallery.map(g => g.url),
              socials: currentBrain.identity.socials
          },
          assets: {
              ...currentBrain.assets,
              miso_cat: {
                  description: `${selectedCandidate.pet || 'Pet'}. ${deepPersona.lore}`,
                  imageUrl: generatedGallery.find(g => g.label.includes("Pet"))?.url || ""
              }
          },
          styleGuide: {
              ...currentBrain.styleGuide,
              persona_definition: `**Appearance:** ${deepPersona.visual_attributes?.clothing_style}, ${deepPersona.visual_attributes?.hair_style}, ${deepPersona.visual_attributes?.accessories}.\n**Vibe:** ${mode.title}.`,
              visual_identity: "Authentic, candid, 'Shot on iPhone' aesthetic. No studio lighting.",
              content_pillars: deepPersona.content_pillars || "",
              humor_pillars: deepPersona.humor_pillars || ""
          },
          gallery: generatedGallery,
          locations: newLocations,
          candidates: [],
          isConfigured: true
      };
      
      updateBrain(newBrain);
      localStorage.setItem('tess_just_hired', 'true');
      
      setTimeout(() => {
          setIsHiring(false);
          onComplete();
      }, 1000);
  };

  // ... (SettingsModal remains same) ...
  const SettingsModal = () => (
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-2xl text-brand-dark mb-4">Setup</h3>
            <div className="space-y-6">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Gemini API Key</label>
                    <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste Key Here..." className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-brand-purple" />
                </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
                <button onClick={() => setShowSettings(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                <button onClick={handleSaveSettings} className="px-6 py-3 bg-brand-dark text-white rounded-xl font-bold hover:bg-gray-800">Save</button>
            </div>
        </div>
    </div>
  );

  // VIEW: INPUT URL
  if (step === 'input') {
      return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 font-sans overflow-y-auto">
          <button onClick={() => setShowSettings(true)} className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors text-gray-500 z-50" title="Settings">⚙️</button>
          {showSettings && <SettingsModal />}
          <div className="w-full max-w-2xl relative mt-20">
              <div className="flex flex-col items-center justify-center mb-12 text-center animate-fade-in">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center text-white font-bold text-3xl shadow-xl mb-6">T</div>
                  <h1 className="text-4xl font-extrabold text-brand-dark mb-3 tracking-tight">Tess OS v5.6</h1>
                  <p className="text-xl text-gray-500 max-w-lg">Operating System for Service Businesses. <br/> Enter your URL to begin.</p>
              </div>
              <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 shadow-xl transition-all hover:shadow-2xl animate-fade-in">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Business URL</label>
                  <div className="flex gap-3">
                      <input autoFocus type="text" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleStartResearch()} placeholder="e.g. www.mylocalsalon.com" className="flex-1 p-4 rounded-xl bg-white border border-gray-200 text-lg outline-none focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/10 transition-all text-brand-dark" />
                      <button onClick={handleStartResearch} disabled={!url.trim()} className="bg-brand-dark text-white px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 shadow-lg">Activate Agent</button>
                  </div>
                  {error && <div className="mt-4 p-3 bg-red-50 text-red-500 text-xs rounded-lg font-bold flex items-center gap-2"><span>⚠️</span> {error}</div>}
              </div>
          </div>
      </div>
      );
  }

  // VIEW: RESEARCHING
  if (step === 'researching') {
      return (
          <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6">
              <div className="bg-gray-50 p-10 rounded-3xl border border-gray-100 shadow-xl text-center w-full max-w-md">
                  <div className="w-16 h-16 border-4 border-brand-purple border-t-transparent rounded-full animate-spin mb-6 mx-auto"></div>
                  <h3 className="text-2xl font-bold text-brand-dark mb-4">Deep Researching... {Math.round(researchProgress)}%</h3>
                  <div className="h-20 flex items-center justify-center mb-6">
                      <p className="text-brand-purple font-medium text-sm leading-relaxed transition-all duration-300">
                          {LOADING_STEPS[loadingStep]}
                      </p>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1"><div className="h-full bg-brand-purple transition-all duration-300 ease-out" style={{ width: `${researchProgress}%` }}></div></div>
              </div>
          </div>
      );
  }

  // VIEW: ARCHETYPE SELECTION (Same as before)
  if (step === 'archetype_selection') {
      return (
          <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 animate-fade-in">
              <div className="max-w-4xl w-full text-center">
                  <h2 className="text-4xl font-extrabold text-brand-dark mb-4 tracking-tight">Who is running the account?</h2>
                  <p className="text-lg text-gray-500 mb-12">Choose the persona perspective for your content strategy.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <button onClick={() => handleArchetypeSelect('employee')} className="bg-gray-50 hover:bg-white border-2 border-gray-100 hover:border-brand-purple rounded-[40px] p-10 transition-all hover:shadow-2xl hover:scale-[1.02] group text-left relative overflow-hidden">
                          <div className="w-full flex justify-center mb-6"><div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><span className="text-6xl">💼</span></div></div>
                          <div className="text-center"><h3 className="text-2xl font-black text-brand-dark mb-2 group-hover:text-brand-purple transition-colors">The Insider</h3><span className="inline-block px-3 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-full mb-4">Employee</span><p className="text-gray-600 leading-relaxed font-medium">"I work here. I know the team. I share behind-the-scenes secrets and expert tips."</p><div className="mt-6 text-sm font-bold text-gray-400 group-hover:text-brand-dark">Perspective: <span className="text-brand-dark">"We"</span></div></div>
                      </button>
                      <button onClick={() => handleArchetypeSelect('megafan')} className="bg-gray-50 hover:bg-white border-2 border-gray-100 hover:border-brand-pink rounded-[40px] p-10 transition-all hover:shadow-2xl hover:scale-[1.02] group text-left relative overflow-hidden">
                          <div className="w-full flex justify-center mb-6"><div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><span className="text-6xl">🤩</span></div></div>
                          <div className="text-center"><h3 className="text-2xl font-black text-brand-dark mb-2 group-hover:text-brand-pink transition-colors">The Super Fan</h3><span className="inline-block px-3 py-1 bg-pink-100 text-pink-600 text-xs font-bold rounded-full mb-4">UGC Creator / Ambassador</span><p className="text-gray-600 leading-relaxed font-medium">"I buy everything. I'm obsessed with the brand. I share my unboxings, reviews, and lifestyle."</p><div className="mt-6 text-sm font-bold text-gray-400 group-hover:text-brand-dark">Perspective: <span className="text-brand-dark">"I"</span></div></div>
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // VIEW: GENERATING CANDIDATES (FULL SCREEN)
  if (step === 'generating') {
      return (
          <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6">
              <div className="text-center max-w-lg w-full">
                  <div className="w-20 h-20 bg-brand-dark text-white rounded-2xl flex items-center justify-center text-4xl mb-6 animate-bounce shadow-xl mx-auto">
                      {selectedArchetype === 'employee' ? '💼' : '🤩'}
                  </div>
                  <h3 className="text-2xl font-bold text-brand-dark mb-4">Drafting {selectedArchetype === 'employee' ? 'Insider' : 'Super Fan'} Candidates...</h3>
                  <div className="min-h-[100px] flex items-center justify-center mb-6">
                      <div className="px-6 py-4 bg-brand-purple/5 rounded-2xl border border-brand-purple/10">
                          <p className="text-brand-purple font-medium text-sm animate-pulse leading-relaxed">{LOADING_STEPS[loadingStep]}</p>
                      </div>
                  </div>
                  <div className="mt-4 w-64 mx-auto">
                      <div className="flex justify-between text-xs font-bold text-brand-dark mb-1"><span>Progress</span><span>{Math.round(generationProgress)}%</span></div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-brand-purple transition-all duration-200 ease-out" style={{ width: `${generationProgress}%` }}></div></div>
                  </div>
              </div>
          </div>
      );
  }

  // VIEW: FINALIZING HIRE (WHITE BACKGROUND + TALKING POINTS)
  if (isHiring) {
      const selectedName = candidates.find(c => c.id === selectedCandidateId)?.name || "Tess";
      const currentBenefit = CLIENT_BENEFITS[benefitIndex];

      return (
          <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6">
              <div className="text-center animate-fade-in max-w-2xl w-full">
                  <div className="w-24 h-24 rounded-full border-4 border-gray-100 border-t-brand-purple animate-spin mb-8 mx-auto"></div>
                  <h2 className="text-4xl font-black text-brand-dark mb-2 tracking-tight">{selectedName} is joining the team...</h2>
                  <p className="text-brand-purple font-mono text-sm font-bold uppercase tracking-widest mb-12">{HIRING_STEPS[hiringStep]}</p>
                  
                  {/* Talking Points Card */}
                  <div className="bg-gray-50 border border-gray-200 rounded-3xl p-8 shadow-xl relative overflow-hidden transition-all duration-500">
                      <div className="absolute top-0 left-0 w-1 h-full bg-brand-purple"></div>
                      <h3 className="text-lg font-bold text-brand-dark mb-3 flex items-center justify-center gap-2"><span className="text-xl">💡</span> {currentBenefit.title}</h3>
                      <p className="text-gray-600 text-lg leading-relaxed">"{currentBenefit.text}"</p>
                      <div className="mt-6 flex justify-center gap-2">
                          {CLIENT_BENEFITS.map((_, i) => (
                              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === benefitIndex ? 'w-8 bg-brand-purple' : 'w-2 bg-gray-300'}`}></div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // VIEW: CV REVIEW
  if (step === 'cv_review' && selectedCandidateId) {
      const candidate = candidates.find(c => c.id === selectedCandidateId);
      if (!candidate) return null;

      const currentMode = candidate.voiceModes?.[selectedVoiceModeIndex] || {
          title: candidate.label, mission: candidate.mission, voiceDescription: "Standard voice.", samplePost: "Check this out!", chaosLevel: candidate.chaosLevel, sarcasmLevel: candidate.sarcasmLevel
      };

      return (
          <div className="fixed inset-0 z-50 bg-gray-100 flex items-center justify-center p-6 animate-fade-in overflow-y-auto">
              <div className="max-w-5xl w-full bg-white rounded-[40px] shadow-2xl border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] h-auto max-h-[95vh]">
                  <div className="w-full md:w-2/5 bg-gray-100 relative h-64 md:h-auto flex-shrink-0">
                      {candidate.img ? <img src={candidate.img} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">👤</div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden"></div>
                      <button onClick={() => setStep('review')} className="absolute top-6 left-6 bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/40 transition-colors z-20">← Back</button>
                  </div>
                  <div className="w-full md:w-3/5 p-8 md:p-12 overflow-y-auto custom-scrollbar flex flex-col">
                      <div className="mb-6">
                          <span className="text-[10px] font-black text-brand-purple uppercase tracking-[0.2em] border border-brand-purple/20 px-2 py-1 rounded mb-3 inline-block">Candidate Profile</span>
                          <h2 className="text-5xl font-black text-brand-dark tracking-tight mb-2">{candidate.name}</h2>
                          <div className="flex gap-3 items-center mb-4 flex-wrap">
                              <p className="text-xl font-medium text-gray-500">"{candidate.tagline}"</p>
                              {candidate.pronouns && <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded font-bold">{candidate.pronouns}</span>}
                              {candidate.birthday && <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded font-bold">🎂 {candidate.birthday}</span>}
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                              {candidate.location && <span className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 flex items-center gap-2">📍 {candidate.location}</span>}
                              {candidate.day_job && <span className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 flex items-center gap-2">💼 {candidate.day_job}</span>}
                              {candidate.pet && <span className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 flex items-center gap-2">🐾 {candidate.pet}</span>}
                              {candidate.hobby && <span className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 flex items-center gap-2">🎨 {candidate.hobby}</span>}
                          </div>
                      </div>
                      <div className="space-y-8 flex-1">
                          <div>
                              <h3 className="text-xs font-bold text-brand-dark uppercase tracking-widest mb-3">Choose Personality Engine</h3>
                              <div className="grid grid-cols-3 gap-3">
                                  {['Calm', 'Balanced', 'Chaotic'].map((modeName, idx) => (
                                      <button key={idx} onClick={() => setSelectedVoiceModeIndex(idx)} className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border-2 ${selectedVoiceModeIndex === idx ? 'border-brand-purple bg-brand-purple/5 text-brand-purple shadow-sm transform scale-[1.02]' : 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>{modeName}</button>
                                  ))}
                              </div>
                          </div>
                          <div className="animate-fade-in">
                              <h3 className="text-2xl font-bold text-brand-dark mb-2">{currentMode.title}</h3>
                              <div className="bg-brand-purple/5 p-6 rounded-2xl border-l-4 border-brand-purple mb-6">
                                  <h4 className="text-[10px] font-bold text-brand-purple uppercase tracking-widest mb-2">My Mission</h4>
                                  <p className="text-brand-dark font-medium italic leading-relaxed">"{currentMode.mission}"</p>
                              </div>
                              <div className="grid grid-cols-1 gap-6 mb-6">
                                  <div>
                                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Voice Analysis</h4>
                                      <p className="text-sm text-gray-700 leading-relaxed font-medium mb-3">{currentMode.voiceDescription}</p>
                                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm text-gray-600 italic"><span className="block text-[10px] font-bold text-gray-400 uppercase mb-1 not-italic">Sample Output:</span>"{currentMode.samplePost}"</div>
                                  </div>
                              </div>
                              <div>
                                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Personality Matrix</h3>
                                  <div className="space-y-4">
                                      <div>
                                          <div className="flex justify-between mb-1"><span className="text-xs font-bold text-gray-700">Chaos Level</span><span className="text-xs font-bold text-brand-purple">{currentMode.chaosLevel}%</span></div>
                                          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-brand-purple transition-all duration-1000 ease-out" style={{ width: `${currentMode.chaosLevel}%` }}></div></div>
                                      </div>
                                      <div>
                                          <div className="flex justify-between mb-1"><span className="text-xs font-bold text-gray-700">Sarcasm</span><span className="text-xs font-bold text-brand-pink">{currentMode.sarcasmLevel}%</span></div>
                                          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-brand-pink transition-all duration-1000 ease-out" style={{ width: `${currentMode.sarcasmLevel}%` }}></div></div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="mt-10 pt-6 border-t border-gray-100 flex justify-end">
                          <button onClick={handleConfirmHire} className="bg-brand-dark text-white px-10 py-4 rounded-xl font-black text-lg shadow-xl hover:scale-105 transition-transform flex items-center gap-3 w-full md:w-auto justify-center">Confirm Hire <span className="text-green-400">✔</span></button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // DEFAULT: Tinder Deck (Step = 'review')
  return (
      <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col items-center justify-center p-6 overflow-hidden select-none">
          <div className="max-w-4xl w-full h-full max-h-[800px] flex flex-col relative items-center">
              <div className="text-center mb-6 mt-4">
                  <h2 className="text-2xl font-black text-brand-dark tracking-tighter">Choose Your Operator</h2>
                  <p className="text-xs text-gray-500 mt-1">Swipe <span className="text-red-500 font-bold">Left</span> to Pass, <span className="text-green-500 font-bold">Right</span> to Hire.</p>
              </div>
              <div className="relative flex-1 w-full max-w-md perspective-1000">
                  {candidates.map((candidate, index) => {
                      let style: React.CSSProperties = {};
                      let isCurrent = index === cardIndex;
                      let isPassed = index < cardIndex;
                      let isUpcoming = index > cardIndex;

                      if (isCurrent) {
                          style = { zIndex: 50, transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`, cursor: isDragging ? 'grabbing' : 'grab', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' };
                      } else if (isPassed) {
                          const stackOffset = (cardIndex - index) * 5; 
                          style = { zIndex: 10 + index, transform: `translateX(-350px) translateY(${stackOffset}px) rotate(-10deg) scale(0.85)`, opacity: 0.6, cursor: 'pointer', filter: 'grayscale(100%)' };
                      } else if (isUpcoming) {
                          const offset = index - cardIndex;
                          style = { zIndex: 30 - offset, transform: `scale(${1 - offset * 0.05}) translateY(${offset * 12}px)`, opacity: 1, backgroundColor: 'white', pointerEvents: 'none' };
                      }

                      return (
                          <div 
                              key={candidate.id}
                              onMouseDown={isCurrent ? handleCardMouseDown : undefined}
                              onClick={isPassed ? () => handleRestoreCard(index) : undefined}
                              className={`absolute top-0 left-0 right-0 bottom-0 bg-white rounded-[32px] shadow-2xl border border-gray-200 overflow-hidden transition-transform duration-300 ease-out origin-bottom ${isDragging && isCurrent ? 'transition-none' : ''}`}
                              style={style}
                          >
                              {isCurrent && dragX > 100 && <div className="absolute top-10 left-10 border-4 border-green-500 text-green-500 font-black text-4xl px-4 py-2 rounded-xl transform -rotate-12 z-50">HIRE</div>}
                              {isCurrent && dragX < -100 && <div className="absolute top-10 right-10 border-4 border-red-500 text-red-500 font-black text-4xl px-4 py-2 rounded-xl transform rotate-12 z-50">PASS</div>}
                              <div className="h-[75%] bg-gray-100 relative overflow-hidden pointer-events-none">
                                  {candidate.img ? <img src={candidate.img} className="w-full h-full object-cover" alt={candidate.label} draggable={false} /> : <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-400 p-6 text-center"><span className="text-4xl mb-2">📷</span><span className="text-xs font-bold uppercase tracking-wide">Visualizing...</span></div>}
                                  <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/40 to-transparent"></div>
                                  <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-sm font-black uppercase tracking-widest shadow-sm text-brand-dark border border-white">{candidate.name}</div>
                              </div>
                              <div className="h-[25%] p-6 flex flex-col justify-between bg-white relative z-10 pointer-events-none">
                                  <div>
                                      <div className="flex gap-2 overflow-hidden mb-2">
                                          {candidate.traits.slice(0, 3).map(t => (<span key={t} className="text-[9px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-md whitespace-nowrap uppercase tracking-wide">{t}</span>))}
                                      </div>
                                      <p className="text-xs font-bold text-brand-purple uppercase tracking-wider mb-1">{candidate.label}</p>
                                      <p className="text-lg font-bold text-brand-dark leading-snug">"{candidate.tagline}"</p>
                                  </div>
                                  <div className="flex justify-between items-end"><span className="text-[10px] font-bold text-gray-300 uppercase">Verified {selectedArchetype === 'employee' ? 'Insider' : 'Super Fan'}</span><span className="text-xl">✨</span></div>
                              </div>
                          </div>
                      );
                  })}
                  
                  {cardIndex >= candidates.length && (
                      isLoadingMore ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-[32px] shadow-2xl border border-gray-200 z-10 p-8 text-center">
                             <div className="w-16 h-16 border-4 border-brand-purple border-t-transparent rounded-full animate-spin mb-6 mx-auto"></div>
                             <h3 className="text-xl font-bold text-brand-dark mb-4">Recruiting new talent...</h3>
                             <div className="bg-brand-purple/5 p-4 rounded-xl border border-brand-purple/10">
                                 <h4 className="text-xs font-bold text-brand-purple uppercase tracking-widest mb-2">AI Strategy Logic</h4>
                                 <p className="text-gray-600 text-xs font-medium leading-relaxed">"{CLIENT_BENEFITS[benefitIndex].text}"</p>
                             </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-[32px] border border-dashed border-gray-300 text-gray-400 z-0">
                            <div className="text-6xl mb-4">💔</div>
                            <p className="font-bold mb-2 text-brand-dark text-lg">No more candidates nearby.</p>
                            <p className="text-xs text-gray-400 mb-8 uppercase tracking-widest">Widen your search parameters?</p>
                            <div className="flex gap-2">
                                <button onClick={() => setCardIndex(0)} className="bg-white border border-gray-200 text-gray-600 px-6 py-3 rounded-xl shadow-lg font-bold text-sm hover:bg-gray-50 transition-colors">Start Over</button>
                                <button onClick={handleLoadMore} className="bg-brand-dark text-white px-6 py-3 rounded-xl shadow-lg font-bold text-sm hover:bg-gray-800 transition-colors">Search Further</button>
                            </div>
                        </div>
                      )
                  )}
              </div>
              
              {cardIndex < candidates.length && (
                  <div className="h-24 flex items-center justify-center gap-10 mt-8 pb-4 relative z-[200]">
                      <button onClick={handlePass} className="w-16 h-16 rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.1)] border border-gray-100 text-red-500 flex items-center justify-center hover:scale-110 hover:bg-red-50 transition-all active:scale-95 cursor-pointer" title="Pass"><CloseIcon className="w-8 h-8" /></button>
                      <button onClick={() => handleSelectCandidate(candidates[cardIndex].id)} className="w-16 h-16 rounded-full bg-brand-dark shadow-[0_8px_25px_rgba(17,24,39,0.4)] border border-brand-dark text-green-400 flex items-center justify-center hover:scale-110 hover:shadow-2xl transition-all active:scale-95 cursor-pointer" title="Select Operator"><CheckIcon className="w-8 h-8" /></button>
                  </div>
              )}
          </div>
      </div>
  );
};

export default Onboarding;
