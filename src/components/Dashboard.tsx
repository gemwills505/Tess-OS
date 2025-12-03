import React, { useState, useEffect, useRef } from 'react';
import { generateCaptionFromImage, generateSocialBios, generateSmartFill, generateGenAiImage, generateStoriesFromFeed, generateVeoVideo, generateVeoPrompt } from '../services/geminiService';
import { getBrain, updateBrain, getFeed, saveFeed, getBank, saveBank, getHighlights, saveHighlights, getStory, saveStory, getStories, saveStories } from '../services/brain';
import { StoryItem, FeedPost } from '../types';

interface BankItem {
    id: string;
    imageUrl: string;
}

interface Highlight {
    id: string;
    name: string;
    coverUrl: string | null;
}

interface FeedPlannerProps {
    userRole?: 'admin' | 'client';
}

const resizeImage = (file: File, maxWidth = 1080, quality = 0.8): Promise<string> => {
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
                const outputType = (file.type === 'image/png' || file.type === 'image/jpeg') ? file.type : 'image/jpeg';
                resolve(canvas.toDataURL(outputType, quality));
            };
        };
    });
};

const FeedPlanner: React.FC<FeedPlannerProps> = ({ userRole = 'admin' }) => {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [bankItems, setBankItems] = useState<BankItem[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]); 
  
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null); 
  const [isEditingStory, setIsEditingStory] = useState(false);

  const [brain, setBrain] = useState(getBrain());
  const [loadingAi, setLoadingAi] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [isGeneratingStories, setIsGeneratingStories] = useState(false);
  const [isGeneratingVeo, setIsGeneratingVeo] = useState(false);
  const [isGeneratingVeoPrompt, setIsGeneratingVeoPrompt] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [autoFillProgress, setAutoFillProgress] = useState(0);
  
  const [storyImage, setStoryImage] = useState<string | null>(null);

  const [profileData, setProfileData] = useState({
      name: '',
      role: '',
      bio: '',
      handle: '',
      followers: '',
      following: '',
      avatar: '',
      url: ''
  });
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [generatedBios, setGeneratedBios] = useState<{style: string, text: string}[]>([]);
  const [showBioStudio, setShowBioStudio] = useState(false);
  const [generatingBios, setGeneratingBios] = useState(false);
  const [showIgModal, setShowIgModal] = useState(false);

  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [draggedBankId, setDraggedBankId] = useState<string | null>(null);
  const [isAvatarDragging, setIsAvatarDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bankInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);
  const activeUploadId = useRef<string | null>(null);
  const activeHighlightId = useRef<string | null>(null);

  const createEmptyPost = (): FeedPost => ({
    id: `SLOT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    imageUrl: null,
    caption: '',
    date: new Date().toISOString().split('T')[0],
    status: 'draft',
    type: 'empty'
  });

  const refreshData = () => {
      const currentFeed = getFeed();
      if (currentFeed.length > 0) {
          setPosts(currentFeed);
      } else {
          const initialPosts = Array(9).fill(null).map(() => createEmptyPost());
          setPosts(initialPosts);
          saveFeed(initialPosts); 
      }

      const currentBank = getBank();
      setBankItems(currentBank);
      setStories(getStories());
      
      const currentHighlights = getHighlights();
      setHighlights(currentHighlights);

      const currentStory = getStory();
      if (currentStory) setStoryImage(currentStory);

      const currentBrain = getBrain();
      setBrain(currentBrain);
      setProfileData({
          name: currentBrain.identity.name,
          role: currentBrain.identity.role,
          bio: currentBrain.identity.bio,
          handle: currentBrain.identity.socials[0]?.handle || 'username',
          followers: currentBrain.identity.socials[0]?.followers || '0',
          following: currentBrain.identity.socials[0]?.following || '0',
          avatar: currentBrain.identity.avatar,
          url: 'https://instagram.com/'
      });
      setIsProfileLoaded(true);
  };

  useEffect(() => {
    refreshData();
    window.addEventListener('brain_updated', refreshData);
    window.addEventListener('storage', refreshData);
    return () => {
        window.removeEventListener('brain_updated', refreshData);
        window.removeEventListener('storage', refreshData);
    };
  }, []);

  useEffect(() => {
      if (!isProfileLoaded) return;
      if (userRole === 'client') return; 
      
      const timer = setTimeout(() => {
          handleSaveProfile(true);
      }, 1000);
      return () => clearTimeout(timer);
  }, [profileData.name, profileData.bio, profileData.handle, profileData.followers, profileData.following, profileData.role, isProfileLoaded]);

  const handleSavePosts = (newPosts: FeedPost[]) => {
    setPosts(newPosts);
    saveFeed(newPosts);
  };
  
  const handleSaveStories = (newStories: StoryItem[]) => {
      setStories(newStories);
      saveStories(newStories);
  }

  const handleSaveBank = (newBank: BankItem[]) => {
      setBankItems(newBank);
      saveBank(newBank);
  };
  
  const handleSaveHighlights = (newHighlights: Highlight[]) => {
      setHighlights(newHighlights);
      saveHighlights(newHighlights);
  };

  const handleDeleteHighlight = (id: string, e: React.MouseEvent) => {
      if (userRole === 'client') return;
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      e.preventDefault();
      
      const hl = highlights.find(h => h.id === id);
      
      if (hl && hl.coverUrl) {
          const updated = highlights.map(h => h.id === id ? { ...h, coverUrl: null } : h);
          handleSaveHighlights(updated);
      } else {
          const updated = highlights.filter(h => h.id !== id);
          handleSaveHighlights(updated);
      }
  };

  const handleHighlightContextMenu = (e: React.MouseEvent, hl: Highlight) => {
      if (userRole === 'client') return;
      e.preventDefault();
      if (hl.coverUrl) {
          if (confirm("Clear highlight cover image?")) {
              const updated = highlights.map(h => h.id === hl.id ? { ...h, coverUrl: null } : h);
              handleSaveHighlights(updated);
          }
      }
  };

  const handleProfileChange = (field: string, value: string) => {
      if (userRole === 'client') return; 
      setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const processAvatarFile = async (file: File) => {
      try {
          const resized = await resizeImage(file, 500);
          setProfileData(prev => ({ ...prev, avatar: resized }));
          const updatedBrain = getBrain();
          const newSocials = [...updatedBrain.identity.socials];
          if (newSocials.length > 0) {
              newSocials[0] = { 
                  ...newSocials[0], 
                  handle: profileData.handle,
                  followers: profileData.followers,
                  following: profileData.following
              };
          } else {
              newSocials.push({ platform: 'Instagram', handle: profileData.handle, followers: profileData.followers, following: profileData.following });
          }
          
          const brainDataToSave = {
              ...updatedBrain,
              identity: {
                  ...updatedBrain.identity,
                  name: profileData.name, 
                  role: profileData.role, 
                  bio: profileData.bio,   
                  avatar: resized,
                  socials: newSocials
              }
          };
          updateBrain(brainDataToSave);
      } catch (err) {
          console.error("Failed to upload avatar", err);
          alert("Failed to process image.");
      }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (userRole === 'client') return;
      const file = e.target.files?.[0];
      if (file) {
          await processAvatarFile(file);
      }
      e.target.value = ''; 
  };

  const handleSaveProfile = (silent: boolean = false) => {
      if (userRole === 'client') return;
      
      const updatedBrain = getBrain();
      const newSocials = [...updatedBrain.identity.socials];
      if (newSocials.length > 0) {
          newSocials[0] = { 
              ...newSocials[0], 
              handle: profileData.handle,
              followers: profileData.followers,
              following: profileData.following
          };
      } else {
          newSocials.push({ platform: 'Instagram', handle: profileData.handle, followers: profileData.followers, following: profileData.following });
      }

      const newData = {
          ...updatedBrain,
          identity: {
              ...updatedBrain.identity,
              name: profileData.name,
              role: profileData.role,
              bio: profileData.bio,
              avatar: profileData.avatar, 
              socials: newSocials
          }
      };
      
      updateBrain(newData);
      if (!silent) console.log("Profile Auto-Saved");
  };
  
  const handleGenerateBios = async () => {
      if (userRole === 'client') return;
      setGeneratingBios(true);
      try {
          const bios = await generateSocialBios(profileData.bio);
          if (bios && bios.length > 0) {
              const bestBio = bios[0].text;
              handleProfileChange('bio', bestBio);
              setGeneratedBios(bios);
              setShowBioStudio(true); 
          } else {
              alert("The AI is silent. Check your API Key.");
          }
      } catch (e) {
          console.error(e);
          alert("Failed to connect to the Brain.");
      } finally {
          setGeneratingBios(false);
      }
  };

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const resized = await resizeImage(file, 800); 
          setStoryImage(resized);
          saveStory(resized);
      }
      e.target.value = '';
  };

  const handleHighlightClick = (hl: Highlight) => {
      if (userRole === 'client') return;
      activeHighlightId.current = hl.id;
      highlightInputRef.current?.click();
  };

  const handleHighlightImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeHighlightId.current) return;
      const file = e.target.files?.[0];
      if (file) {
          const resized = await resizeImage(file, 300);
          const updated = highlights.map(h => h.id === activeHighlightId.current ? { ...h, coverUrl: resized } : h);
          handleSaveHighlights(updated);
      }
      e.target.value = '';
  };

  const handleHighlightNameChange = (id: string, newName: string) => {
      if (userRole === 'client') return;
      const updated = highlights.map(h => h.id === id ? { ...h, name: newName } : h);
      handleSaveHighlights(updated);
  };

  const handleGenerateStories = async () => {
      setIsGeneratingStories(true);
      try {
          const newStories = await generateStoriesFromFeed(posts);
          if (newStories.length === 0) {
              alert("Add some captioned posts to your feed first!");
          } else {
              handleSaveStories(newStories);
          }
      } catch (e) {
          console.error(e);
          alert("Story generation failed.");
      } finally {
          setIsGeneratingStories(false);
      }
  };
  
  const handleStoryClick = (story: StoryItem) => {
      if (userRole === 'client') return;
      setSelectedStoryId(story.id);
      setIsEditingStory(true);
      setSelectedPostId(null);
  };

  const handleAutoFill = async () => {
      setIsAutoFilling(true);
      setAutoFillProgress(10);
      try {
          // Identify gaps
          const emptyIndices = posts.map((p, idx) => (p.type === 'empty' || (!p.imageUrl && !p.videoUrl)) ? idx : -1).filter(idx => idx !== -1);
          
          if (emptyIndices.length === 0) {
              alert("Your feed is full! Add some empty rows first.");
              setIsAutoFilling(false);
              return;
          }

          const filledPlans = await generateSmartFill(posts);
          
          if (filledPlans.length === 0) {
              alert("Tess couldn't think of anything. Check API key or add some context to other posts.");
              setIsAutoFilling(false);
              return;
          }
          
          setAutoFillProgress(30);
          const newPosts = [...posts];
          
          let completedCount = 0;
          const totalJobs = Math.min(emptyIndices.length, filledPlans.length);

          const jobs = emptyIndices.slice(0, totalJobs).map(async (idx, i) => {
               const plan = filledPlans[i];
               let img = null;
               try {
                   img = await generateGenAiImage(plan.visualPrompt, true, false, null, '9:16');
               } catch (e) { console.error("Img Gen Error", e); }
               
               completedCount++;
               setAutoFillProgress(30 + Math.floor((completedCount / totalJobs) * 70));
               return { idx, plan, img };
          });

          const results = await Promise.all(jobs);
          results.forEach(({ idx, plan, img }) => {
              newPosts[idx] = {
                  ...newPosts[idx],
                  caption: `${plan.caption}\n.\n${plan.hashtags.join(' ')}`,
                  type: 'image',
                  status: 'draft',
                  notes: `Auto-generated: ${plan.category}`,
                  imageUrl: img || null
              };
          });
          handleSavePosts([...newPosts]);
      } catch (e) {
          console.error(e);
          alert("Auto-fill failed. Check console.");
      } finally {
          setIsAutoFilling(false);
          setAutoFillProgress(0);
      }
  };

  const openMobilePopup = (url: string) => {
      window.open(url, 'instagram_popup', `width=390,height=844,top=100,left=100,resizable=yes,scrollbars=yes`);
  };

  const handleDownloadMockup = async () => {
      if (typeof (window as any).html2canvas !== 'undefined') {
          const element = document.getElementById('phone-mockup-content');
          if (element) {
              try {
                  const canvas = await (window as any).html2canvas(element, { 
                      scale: 2,
                      backgroundColor: "#ffffff", 
                      useCORS: true, 
                      logging: false
                  });
                  const link = document.createElement('a');
                  link.href = canvas.toDataURL('image/png');
                  link.download = `feed_preview_${Date.now()}.png`;
                  link.click();
              } catch (e) { alert("Failed to capture preview."); }
          }
      } else {
          alert("Capture library not loaded.");
      }
  };

  const handleBankUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          const fileArray = Array.from(files) as File[];
          for (const file of fileArray) {
              try {
                  const resized = await resizeImage(file);
                  setBankItems(prev => {
                      const updated = [...prev, { id: `BANK_${Date.now()}_${Math.random()}`, imageUrl: resized }];
                      saveBank(updated);
                      return updated;
                  });
              } catch (err) { console.error("Failed to process image"); }
          }
      }
      if (bankInputRef.current) bankInputRef.current.value = '';
  };

  const deleteFromBank = (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const newBank = bankItems.filter(b => b.id !== id);
      handleSaveBank(newBank);
  };

  const handleAddRows = () => {
    const newSlots = Array(9).fill(null).map(() => createEmptyPost());
    handleSavePosts([...newSlots, ...posts]);
  };

  const handlePostClick = (post: FeedPost) => {
    if (post.type === 'empty' && !post.imageUrl && !post.videoUrl && !post.caption) {
      if (userRole === 'admin') {
          activeUploadId.current = post.id;
          fileInputRef.current?.click();
      }
    } else {
      setSelectedPostId(post.id);
      setIsEditingStory(false);
      setSelectedStoryId(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const resized = await resizeImage(file);
        if (activeUploadId.current) {
           const updated = posts.map(p => p.id === activeUploadId.current ? { ...p, imageUrl: resized, type: 'image' as const } : p);
           handleSavePosts(updated);
           setSelectedPostId(activeUploadId.current);
           activeUploadId.current = null;
        } 
        else if (selectedPostId) {
           const updated = posts.map(p => p.id === selectedPostId ? { ...p, imageUrl: resized, type: 'image' as const } : p);
           handleSavePosts(updated);
        }
    }
    e.target.value = '';
  };

  const handleUpdatePost = (field: keyof FeedPost, value: any) => {
    if (!selectedPostId) return;
    const updated = posts.map(p => p.id === selectedPostId ? { ...p, [field]: value } : p);
    handleSavePosts(updated);
  };

  const handleDeletePost = () => {
    if (!selectedPostId) return;
    const updated = posts.map(p => p.id === selectedPostId ? createEmptyPost() : p);
    handleSavePosts(updated);
    setSelectedPostId(null);
  };
  
  const handleDeleteStory = () => {
      if (!selectedStoryId) return;
      const updated = stories.filter(s => s.id !== selectedStoryId);
      handleSaveStories(updated);
      setSelectedStoryId(null);
      setIsEditingStory(false);
  }

  const handleDeleteFeedItem = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const updated = posts.map(p => p.id === id ? createEmptyPost() : p);
      handleSavePosts(updated);
      if (selectedPostId === id) setSelectedPostId(null);
  };

  const handleMagicCaption = async () => {
    const post = posts.find(p => p.id === selectedPostId);
    if (!post || !post.imageUrl) return;
    setLoadingAi(true);
    try {
        const base64Data = post.imageUrl.split(',')[1];
        const mimeType = post.imageUrl.split(';')[0].split(':')[1];
        const caption = await generateCaptionFromImage(base64Data, mimeType, post.notes);
        if (caption) handleUpdatePost('caption', caption);
    } catch (error) { alert("AI Writer failed."); } 
    finally { setLoadingAi(false); }
  };
  
  const handleGenerateVeoPrompt = async () => {
      const post = posts.find(p => p.id === selectedPostId);
      if (!post || !post.imageUrl) return;
      setIsGeneratingVeoPrompt(true);
      try {
          const base64Data = post.imageUrl.split(',')[1];
          const mimeType = post.imageUrl.split(';')[0].split(':')[1];
          const prompt = await generateVeoPrompt(base64Data, mimeType);
          if (prompt) handleUpdatePost('aiPrompt', prompt);
      } catch (e) { alert("Failed to generate Veo prompt."); } 
      finally { setIsGeneratingVeoPrompt(false); }
  };

  const handleGenerateVeo = async () => {
      const post = posts.find(p => p.id === selectedPostId);
      if (!post || !post.aiPrompt) return;
      if ((window as any).aistudio && !await (window as any).aistudio.hasSelectedApiKey()) {
          try { await (window as any).aistudio.openSelectKey(); } catch(e) { alert("Paid API Key required for Veo."); return; }
      }
      setIsGeneratingVeo(true);
      try {
          let imageContext = undefined;
          if (post.imageUrl) {
              try {
                  const mimeType = post.imageUrl.split(';')[0].split(':')[1];
                  const data = post.imageUrl.split(',')[1];
                  imageContext = { mimeType, data };
              } catch (e) {}
          }
          const videoUrl = await generateVeoVideo(post.aiPrompt, imageContext);
          if (videoUrl) {
              handleUpdatePost('videoUrl', videoUrl);
              handleUpdatePost('type', 'video');
          } else { alert("Veo generation failed."); }
      } catch (e) { alert("Veo Error. Check API Key."); } 
      finally { setIsGeneratingVeo(false); }
  };

  const handleRegenerateImage = async () => {
      const post = posts.find(p => p.id === selectedPostId);
      if (!post || !post.aiPrompt) return;
      setIsRegeneratingImage(true);
      try {
          const img = await generateGenAiImage(post.aiPrompt, true, false, null, '9:16');
          if (img) handleUpdatePost('imageUrl', img);
      } catch(e) { alert("Failed to regenerate image"); } 
      finally { setIsRegeneratingImage(false); }
  };

  const handleFeedDragStart = (e: React.DragEvent, index: number) => {
    if (userRole === 'client') return;
    setDraggedItemIndex(index);
    setDraggedBankId(null);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", "feed");
    e.dataTransfer.setData("index", index.toString());
  };

  const handleBankDragStart = (e: React.DragEvent, id: string, imageUrl: string) => {
      if (userRole === 'client') return;
      setDraggedBankId(id);
      setDraggedItemIndex(null);
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.setData("type", "bank");
      e.dataTransfer.setData("id", id);
      e.dataTransfer.setData("imageUrl", imageUrl);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (userRole === 'client') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedBankId ? "copy" : "move";
  };

  const handleDropOnFeed = (e: React.DragEvent, dropIndex: number) => {
    if (userRole === 'client') return;
    e.preventDefault();
    const type = e.dataTransfer.getData("type");

    if (type === "feed") {
        const dragIndexStr = e.dataTransfer.getData("index");
        const dragIndex = parseInt(dragIndexStr);
        if (isNaN(dragIndex) || dragIndex === dropIndex) return;
        const newPosts = [...posts];
        const [item] = newPosts.splice(dragIndex, 1);
        newPosts.splice(dropIndex, 0, item);
        handleSavePosts(newPosts);
        setDraggedItemIndex(null);
    } 
    else if (type === "bank") {
        let imageUrl = e.dataTransfer.getData("imageUrl");
        let bankId = e.dataTransfer.getData("id");
        if (!imageUrl) return;
        
        const newPosts = [...posts];
        newPosts[dropIndex] = { ...newPosts[dropIndex], imageUrl: imageUrl, type: 'image', status: 'draft' };
        handleSavePosts(newPosts);
        
        if (bankId) {
            const currentBank = getBank();
            const newBank = currentBank.filter((b: any) => b.id !== bankId);
            handleSaveBank(newBank);
        }
        
        setDraggedBankId(null);
    }
  };

  const handleDropOnBank = async (e: React.DragEvent) => {
      if (userRole === 'client') return;
      e.preventDefault();
      const type = e.dataTransfer.getData("type");
      if (type === "feed") {
          const dragIndexStr = e.dataTransfer.getData("index");
          const dragIndex = parseInt(dragIndexStr);
          if (isNaN(dragIndex)) return;
          const post = posts[dragIndex];
          if (post && post.imageUrl) {
              const newBank = [...bankItems, { id: `BANK_${Date.now()}_${Math.random()}`, imageUrl: post.imageUrl }];
              handleSaveBank(newBank);
              const newPosts = [...posts];
              newPosts[dragIndex] = createEmptyPost();
              handleSavePosts(newPosts);
          }
          setDraggedItemIndex(null);
          return;
      }
  };

  const selectedPost = posts.find(p => p.id === selectedPostId);
  const selectedStory = stories.find(s => s.id === selectedStoryId);

  const downloadImage = (url: string, filename: string) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
  };

  const visiblePosts = userRole === 'client' 
      ? posts.map(p => (p.status === 'scheduled' || p.status === 'posted') ? p : { ...p, type: 'empty', imageUrl: null, caption: '' } as FeedPost) 
      : posts;

  return (
    <div className="h-full bg-transparent flex overflow-hidden font-sans relative">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
      <input type="file" ref={bankInputRef} className="hidden" accept="image/*" multiple onChange={handleBankUpload} />
      <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
      <input type="file" ref={storyInputRef} className="hidden" accept="image/*" onChange={handleStoryUpload} />
      <input type="file" ref={highlightInputRef} className="hidden" accept="image/*" onChange={handleHighlightImageChange} />

      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden relative">
          <button onClick={handleDownloadMockup} className="absolute top-6 right-6 z-20 flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm text-xs font-bold text-gray-600 hover:text-brand-dark hover:shadow-md transition-all border border-gray-200"><span>📸</span> Download Preview</button>

          <div id="phone-mockup-content" className="w-full max-w-[400px] h-full max-h-[850px] bg-white rounded-[35px] shadow-2xl border-[8px] border-gray-100 flex flex-col overflow-hidden relative shrink-0">
               <div className="h-7 bg-white flex justify-between items-center px-6 pt-2 select-none"><span className="text-[10px] font-bold text-black">9:41</span><div className="flex gap-1.5 items-center"><span className="text-[10px] text-black">📶</span><span className="text-[10px] text-black">🛜</span><span className="text-[10px] text-black">🔋</span></div></div>
               <div className="px-5 pt-4 pb-2 flex items-center justify-between bg-white z-10">
                    <div className="flex items-center gap-1 text-base font-bold text-gray-900 group relative"><input value={profileData.handle} onChange={(e) => handleProfileChange('handle', e.target.value)} disabled={userRole === 'client'} className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-brand-purple outline-none max-w-[150px] disabled:hover:border-transparent" /><span>▼</span></div>
                    {userRole === 'admin' && <div className="flex gap-4 items-center"><button id="save-profile-btn" onClick={() => handleSaveProfile(false)} className="text-gray-400 hover:text-brand-purple transition-colors">💾</button><button onClick={() => { setShowIgModal(true); }} className="text-gray-900 hover:text-pink-500 transition-colors">➕</button><span>☰</span></div>}
                    {userRole === 'client' && <div className="flex gap-4 items-center"><span>☰</span></div>}
              </div>

            {showIgModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fade-in transition-all duration-500 overflow-hidden">
                        <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-brand-dark flex items-center gap-2 text-lg">Link Profile</h3><button onClick={() => setShowIgModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors">✕</button></div>
                        <div className="space-y-6">
                            <div><label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Social URL</label><div className="relative"><input type="text" value={profileData.url} onChange={(e) => setProfileData(prev => ({...prev, url: e.target.value}))} className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-brand-purple font-medium text-gray-700 pl-10" placeholder="https://instagram.com/username" /><span className="absolute left-3.5 top-4 text-gray-400">🔗</span></div></div>
                            <button onClick={() => openMobilePopup(profileData.url)} className="w-full py-3 bg-purple-500 text-white rounded-xl font-bold shadow-md">Launch Live Browser</button>
                            <button onClick={() => { handleSaveProfile(); setShowIgModal(false); }} className="w-full py-4 bg-brand-dark text-white rounded-xl text-sm font-bold shadow-lg hover:bg-gray-800 transition-colors active:scale-95">Save Link & Close</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto bg-white scroll-smooth scrollbar-hide">
                 <div className="px-5 pt-2 pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div 
                            className="relative group" 
                            onClick={() => avatarInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setIsAvatarDragging(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setIsAvatarDragging(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsAvatarDragging(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file) processAvatarFile(file);
                            }}
                        >
                             <div className={`w-20 h-20 rounded-full p-[2px] cursor-pointer transition-all ${storyImage ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' : 'bg-gray-200 hover:bg-gray-300'} ${isAvatarDragging ? 'scale-110 ring-4 ring-brand-purple' : ''}`}>
                                 <div className="w-full h-full rounded-full bg-white p-[2px] overflow-hidden relative">
                                     {profileData.avatar ? <img src={profileData.avatar} className="w-full h-full rounded-full object-cover" /> : <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">👤</div>}
                                 </div>
                             </div>
                             {userRole === 'admin' && <button className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md border-2 border-white transform hover:scale-110 transition-transform z-10 text-xs font-bold pointer-events-none">+</button>}
                        </div>
                         <div className="flex flex-1 justify-around ml-4">
                            <div className="text-center"><div className="font-bold text-gray-900 text-sm">{posts.filter(p => p.imageUrl || p.videoUrl).length}</div><div className="text-xs text-gray-900">Posts</div></div>
                            <div className="text-center"><input value={profileData.followers} onChange={(e) => handleProfileChange('followers', e.target.value)} disabled={userRole === 'client'} className="font-bold text-gray-900 text-sm w-12 text-center bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand-purple outline-none disabled:hover:border-transparent" /><div className="text-xs text-gray-900">Followers</div></div>
                            <div className="text-center"><input value={profileData.following} onChange={(e) => handleProfileChange('following', e.target.value)} disabled={userRole === 'client'} className="font-bold text-gray-900 text-sm w-12 text-center bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand-purple outline-none disabled:hover:border-transparent" /><div className="text-xs text-gray-900">Following</div></div>
                        </div>
                    </div>

                    <div>
                        <input value={profileData.name} onChange={(e) => handleProfileChange('name', e.target.value)} disabled={userRole === 'client'} className="font-bold text-sm text-gray-900 w-full bg-transparent border-none p-0 focus:ring-0 placeholder-gray-400" placeholder="Name" />
                        <input value={profileData.role} onChange={(e) => handleProfileChange('role', e.target.value)} disabled={userRole === 'client'} className="text-sm text-gray-700 w-full bg-transparent border-none p-0 focus:ring-0 placeholder-transparent" placeholder="" />
                        <div className="relative group mt-1">
                            <textarea 
                                value={profileData.bio} 
                                onChange={(e) => handleProfileChange('bio', e.target.value)} 
                                disabled={userRole === 'client'}
                                className="text-sm text-gray-800 w-full bg-transparent border border-transparent hover:border-gray-200 rounded p-1 -ml-1 focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/20 outline-none resize-none leading-snug min-h-[6rem] overflow-y-auto whitespace-pre-wrap disabled:hover:border-transparent" 
                                rows={5} 
                                maxLength={150}
                                placeholder="✨ Bio vibes... (Keep it short & punchy!)" 
                            />
                            {userRole === 'admin' && (
                                <button 
                                    onClick={handleGenerateBios} 
                                    disabled={generatingBios}
                                    className="absolute top-0 right-0 p-1.5 bg-white rounded-full shadow-sm text-brand-purple opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 border border-gray-100 z-10"
                                    title="Generate Expert Bio with AI"
                                >
                                    {generatingBios ? <span className="animate-spin block">⚡️</span> : '✨'}
                                </button>
                            )}
                        </div>
                    </div>

                    {showBioStudio && userRole === 'admin' && (
                        <div className="absolute top-full left-0 right-0 z-50 p-4">
                            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
                                <div className="flex justify-between items-center mb-3"><h4 className="text-xs font-bold text-brand-purple uppercase">AI Bio Generator</h4><button onClick={handleGenerateBios} disabled={generatingBios} className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 flex items-center gap-1">🔄</button></div>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {generatedBios.map((opt, idx) => (
                                        <div key={idx} onClick={() => { handleProfileChange('bio', opt.text); setShowBioStudio(false); }} className="p-2 bg-gray-50 hover:bg-brand-purple/10 rounded-lg cursor-pointer transition-colors group">
                                            <div className="text-[10px] font-bold text-gray-500 mb-0.5 group-hover:text-brand-purple">{opt.style}</div>
                                            <div className="text-xs text-gray-800 leading-tight">{opt.text}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 overflow-x-auto mt-2 pt-6 pb-2 px-4 scrollbar-hide">
                        {highlights.map((hl) => (
                            <div 
                                key={hl.id} 
                                className="flex flex-col items-center space-y-1 flex-shrink-0 group relative"
                                onContextMenu={(e) => handleHighlightContextMenu(e, hl)}
                            >
                                <div 
                                    className="w-16 h-16 rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center overflow-hidden relative cursor-pointer"
                                    onClick={() => handleHighlightClick(hl)}
                                    title={userRole === 'admin' ? "Click to upload, Right-click to clear" : ""}
                                >
                                    {hl.coverUrl ? <img src={hl.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-100"></div>}
                                    {userRole === 'admin' && <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold">+</div>}
                                </div>
                                {userRole === 'admin' && (
                                    <button 
                                        type="button"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => handleDeleteHighlight(hl.id, e)}
                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-[100] hover:scale-110 hover:bg-red-600 cursor-pointer border-2 border-white"
                                    >
                                        ✕
                                    </button>
                                )}
                                <input value={hl.name} onChange={(e) => handleHighlightNameChange(hl.id, e.target.value)} disabled={userRole === 'client'} className="text-xs text-gray-900 text-center bg-transparent outline-none w-16 truncate focus:text-brand-purple font-medium" />
                            </div>
                        ))}
                         {userRole === 'admin' && <button onClick={() => handleSaveHighlights([...highlights, { id: `HL_${Date.now()}`, name: 'New', coverUrl: null }])} className="flex flex-col items-center space-y-1 flex-shrink-0"><div className="w-16 h-16 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-brand-purple hover:text-brand-purple transition-all">+</div><span className="text-xs text-gray-400">Add</span></button>}
                    </div>
                 </div>

                 {userRole === 'admin' && (
                    <div className="py-2 px-5 bg-gray-50 border-t border-b border-gray-100">
                        <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Daily Stories</span><button onClick={handleGenerateStories} disabled={isGeneratingStories} className="text-[10px] bg-brand-purple text-white px-2 py-0.5 rounded font-bold hover:bg-brand-pink transition-colors disabled:opacity-50">{isGeneratingStories ? 'Generating...' : '⚡️ Gen Stories'}</button></div>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {stories.length === 0 && <div className="text-[10px] text-gray-400 italic py-2">No active stories. Generate some from your feed!</div>}
                            {stories.map((story) => (
                                <div key={story.id} onClick={() => handleStoryClick(story)} className="flex-shrink-0 cursor-pointer group">
                                    <div className={`w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500`}><div className="w-full h-full rounded-full border-2 border-white overflow-hidden relative">{story.imageUrl && <img src={story.imageUrl} className="w-full h-full object-cover" />}</div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}

                {userRole === 'admin' && (
                    <div className="bg-gray-50 py-4 px-4 flex justify-center gap-2">
                        <button onClick={handleAddRows} className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">+ Rows</button>
                        <button onClick={handleAutoFill} disabled={isAutoFilling} className="bg-brand-dark hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm relative overflow-hidden">
                            {isAutoFilling ? <span className="relative z-10 flex gap-2">Thinking... {autoFillProgress}%</span> : <span className="relative z-10">⚡️ Auto-Fill</span>}
                            {isAutoFilling && <div className="absolute inset-0 bg-brand-purple/50 z-0 transition-all duration-300" style={{width: `${autoFillProgress}%`}}></div>}
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-[2px] bg-white pb-20">
                    {visiblePosts.map((post, index) => (
                        <div key={post.id || index} draggable={userRole === 'admin'} onDragStart={(e) => handleFeedDragStart(e, index)} onDragOver={handleDragOver} onDrop={(e) => handleDropOnFeed(e, index)} onClick={() => handlePostClick(post)} className={`aspect-[4/5] relative group cursor-pointer transition-opacity ${draggedItemIndex === index ? 'opacity-40' : 'opacity-100'} ${selectedPostId === post.id ? 'ring-4 ring-inset ring-blue-500 z-10' : ''}`}>
                            {post.imageUrl || post.videoUrl ? (
                                <>
                                    {post.type === 'video' ? (
                                        <div className="w-full h-full bg-gray-100 relative">
                                            {post.videoUrl ? <video src={post.videoUrl} className="w-full h-full object-cover" muted /> : <img src={post.imageUrl!} className="w-full h-full object-cover opacity-80" />}
                                            <div className="absolute top-1 right-1">🎥</div>
                                            {!post.videoUrl && <div className="absolute bottom-1 right-1 text-[8px] bg-purple-600 text-white px-1 rounded shadow-sm">REF</div>}
                                        </div>
                                    ) : (
                                        <img src={post.imageUrl!} alt="" className="w-full h-full object-cover" draggable={false} />
                                    )}
                                    {post.status !== 'draft' && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 ring-2 ring-white"></div>}
                                    
                                    {userRole === 'admin' && (
                                        <button 
                                            type="button"
                                            onClick={(e) => handleDeleteFeedItem(post.id, e)} 
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} 
                                            className="absolute top-1 left-1 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-[100] hover:bg-red-50" 
                                            title="Remove from Feed"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </>
                            ) : post.type !== 'empty' && (post.caption || post.aiPrompt) && userRole === 'admin' ? (
                                <div className={`w-full h-full flex flex-col items-center justify-center p-2 text-center relative group transition-all ${post.type === 'video' ? 'bg-purple-50' : 'bg-gray-50'}`}>
                                    <div className={`text-2xl mb-1 ${post.type === 'video' ? 'animate-pulse' : ''}`}>{post.type === 'video' ? '🎥' : '🖼️'}</div>
                                    <div className="text-[8px] font-bold uppercase tracking-wider text-gray-500 line-clamp-2">{post.notes || (post.type === 'video' ? 'Video Concept' : 'Image Concept')}</div>
                                    <button 
                                        type="button"
                                        onClick={(e) => handleDeleteFeedItem(post.id, e)} 
                                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} 
                                        className="absolute top-1 left-1 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-[100] text-[10px]"
                                    >
                                        ✕
                                    </button>
                                    {post.type === 'video' && <div className="absolute bottom-1 right-1 text-[8px] bg-purple-200 text-purple-800 px-1 rounded font-bold">VEO</div>}
                                </div>
                            ) : (
                                <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-300 hover:bg-gray-200 transition-colors relative">
                                    {userRole === 'admin' && isAutoFilling && (post.type === 'empty' || !post.imageUrl) ? <span className="animate-pulse text-2xl">⚡️</span> : ''}
                                    {userRole === 'admin' && !isAutoFilling && '+'}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
          </div>
      </div>

      {/* RIGHT SIDEBAR (Edit Post) */}
      <div className="w-[450px] bg-white border-l border-gray-200 flex flex-col shadow-xl z-20 relative">
          {selectedPostId ? (
             <>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white"><h3 className="font-bold text-lg text-gray-900">Post Details</h3><button onClick={() => setSelectedPostId(null)} className="p-2 hover:bg-gray-100 rounded-full">✕</button></div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                    {selectedPost && (
                        <>
                            <div className="relative aspect-[4/5] rounded-xl overflow-hidden group shadow-sm bg-gray-100">
                                {selectedPost.imageUrl ? <img src={selectedPost.imageUrl} className="w-full h-full object-cover" /> : selectedPost.videoUrl ? <video src={selectedPost.videoUrl} className="w-full h-full object-cover" controls /> : (
                                    <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                                        <div className="text-4xl mb-2">{selectedPost.type === 'video' ? '🎥' : '🖼️'}</div>
                                        <p className="text-sm font-bold text-gray-500">Missing Asset</p>
                                        {userRole === 'admin' && (selectedPost.type === 'video' ? <p className="text-xs">Generate with Veo below.</p> : <p className="text-xs">Upload or generate image.</p>)}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    {userRole === 'admin' && <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white rounded-lg text-sm font-bold shadow-lg">Change File</button>}
                                    {selectedPost.imageUrl && <button onClick={() => downloadImage(selectedPost.imageUrl!, `post_${selectedPost.id}.png`)} className="px-4 py-2 bg-white text-brand-dark rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-gray-100">⬇️ Download</button>}
                                </div>
                            </div>

                            {/* CLIENT VIEW: Read-Only Status */}
                            {userRole === 'client' && (
                                <div className="p-4 bg-gray-50 rounded-xl text-xs text-gray-500 border border-gray-100">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold uppercase tracking-wider">Status</span>
                                        <span className={`font-bold ${selectedPost.status === 'posted' ? 'text-green-500' : 'text-orange-500'}`}>{selectedPost.status.toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold uppercase tracking-wider block mb-1">Schedule Date</span>
                                        <span>{selectedPost.date || "Unscheduled"}</span>
                                    </div>
                                </div>
                            )}

                            {/* ADMIN: AI Tools */}
                            {userRole === 'admin' && selectedPost.type === 'image' && selectedPost.aiPrompt && (
                                <button onClick={handleRegenerateImage} disabled={isRegeneratingImage} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg flex items-center justify-center gap-2">{isRegeneratingImage ? 'Painting...' : '🔄 Regenerate Image'}</button>
                            )}

                            {/* VEO GENERATOR SECTION (Admin Only) */}
                            {userRole === 'admin' && (selectedPost.type === 'video' || selectedPost.aiPrompt || selectedPost.imageUrl) ? (
                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 animate-fade-in">
                                    <div className="flex justify-between items-center mb-2"><h4 className="text-xs font-bold text-purple-600 uppercase tracking-wider">VEO 3.1 Video Studio</h4><button onClick={handleGenerateVeoPrompt} disabled={isGeneratingVeoPrompt || !selectedPost.imageUrl} className="text-[10px] bg-purple-200 text-purple-700 px-2 py-0.5 rounded font-bold hover:bg-purple-300 transition-colors">{isGeneratingVeoPrompt ? 'Writing...' : '✨ Write Prompt'}</button></div>
                                    <div className="mb-3">
                                        {selectedPost.imageUrl && <div className="flex items-center gap-2 mb-2 p-2 bg-white rounded-lg border border-purple-100"><img src={selectedPost.imageUrl} className="w-8 h-8 rounded object-cover" /><span className="text-[10px] font-bold text-gray-500">Using Reference Scene</span></div>}
                                        <textarea className="w-full text-xs p-2 rounded bg-white border border-purple-200 h-20 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400" value={selectedPost.aiPrompt} onChange={(e) => handleUpdatePost('aiPrompt', e.target.value)} placeholder="Describe camera movement, subject action, lighting..." />
                                    </div>
                                    <button onClick={handleGenerateVeo} disabled={isGeneratingVeo || !selectedPost.aiPrompt} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">{isGeneratingVeo ? <span className="animate-spin">🌀 Generating...</span> : '🎥 Generate Video (Veo)'}</button>
                                </div>
                            ) : null}

                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Caption (SEO Heavy)</label>
                                    {userRole === 'admin' && <button onClick={handleMagicCaption} disabled={loadingAi || !selectedPost.imageUrl} className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${loadingAi ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'}`}>✨ Magic Write</button>}
                                </div>
                                <textarea 
                                    value={selectedPost.caption} 
                                    onChange={(e) => handleUpdatePost('caption', e.target.value)} 
                                    disabled={userRole === 'client'}
                                    className="w-full h-40 p-4 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none bg-gray-50 disabled:bg-gray-100 disabled:text-gray-500" 
                                    placeholder={userRole === 'admin' ? "Write your caption here..." : "Caption will appear here."} 
                                />
                            </div>

                            {/* ADMIN: Publish / Delete Actions */}
                            {userRole === 'admin' && (
                                <div className="pt-4 border-t border-gray-100 space-y-2">
                                    <button 
                                        onClick={() => handleUpdatePost('status', selectedPost.status === 'scheduled' ? 'draft' : 'scheduled')} 
                                        className={`w-full py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${selectedPost.status === 'scheduled' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}
                                    >
                                        {selectedPost.status === 'scheduled' ? '⏪ Revert to Draft' : '🚀 Push to Client (Schedule)'}
                                    </button>
                                    <button onClick={handleDeletePost} className="w-full py-3 rounded-xl border border-red-100 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2">🗑️ Clear Slot</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
             </>
          ) : isEditingStory && selectedStory && userRole === 'admin' ? (
             <>
                 <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white"><h3 className="font-bold text-lg text-gray-900">Edit Story</h3><button onClick={() => { setIsEditingStory(false); setSelectedStoryId(null); }} className="p-2 hover:bg-gray-100 rounded-full">✕</button></div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                    <div className="relative aspect-[9/16] rounded-xl overflow-hidden group shadow-lg bg-gray-100">{selectedStory.imageUrl && <img src={selectedStory.imageUrl} className="w-full h-full object-cover" />}{selectedStory.caption && <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white font-bold text-center text-xl shadow-black drop-shadow-md w-3/4">{selectedStory.caption}</div>}</div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Overlay Text</label><textarea value={selectedStory.caption} onChange={(e) => { const updated = stories.map(s => s.id === selectedStory.id ? { ...s, caption: e.target.value } : s); handleSaveStories(updated); }} className="w-full h-24 p-4 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-brand-purple/20 outline-none resize-none bg-gray-50" placeholder="Story text..." /></div>
                    <button onClick={handleDeleteStory} className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-bold text-sm hover:bg-red-100 transition-colors">🗑️ Delete Story</button>
                </div>
             </>
          ) : (
             <div className="flex flex-col h-full" onDragOver={handleDragOver} onDrop={handleDropOnBank}>
                 <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                     <h3 className="font-bold text-lg text-brand-dark tracking-tight">THUMBNAIL BANK</h3>
                     {userRole === 'admin' && <button onClick={() => bankInputRef.current?.click()} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 shadow-sm">➕</button>}
                 </div>
                <div className="flex-1 overflow-y-auto p-6 bg-gray-100/50 scrollbar-hide">
                    <div className="grid grid-cols-3 gap-3 auto-rows-fr">
                        {bankItems.map((item) => (
                            <div key={item.id} draggable={userRole === 'admin'} onDragStart={(e) => handleBankDragStart(e, item.id, item.imageUrl)} className={`aspect-square rounded-lg overflow-hidden bg-white shadow-sm relative group border border-gray-200 shadow-sm cursor-grab active:cursor-grabbing`}>
                                <img src={item.imageUrl} className="w-full h-full object-cover" draggable={false} />
                                {userRole === 'admin' && <button type="button" onClick={(e) => deleteFromBank(item.id, e)} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} className="absolute top-1 right-1 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-[100]">✕</button>}
                            </div>
                        ))}
                    </div>
                </div>
             </div>
          )}
      </div>
    </div>
  );
};

export default FeedPlanner;