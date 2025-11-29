

export enum LocationId {
  LOC_DESK = 'LOC_DESK',
  LOC_TOILET = 'LOC_TOILET',
  LOC_STAIRS = 'LOC_STAIRS',
  LOC_CORRIDOR = 'LOC_CORRIDOR',
  LOC_PRET = 'LOC_PRET',
  LOC_BED = 'LOC_BED',
  LOC_KITCHEN = 'LOC_KITCHEN',
  LOC_LIVING = 'LOC_LIVING',
  LOC_CAR = 'LOC_CAR',
  LOC_WHITEBOARD = 'LOC_WHITEBOARD',
  LOC_STREET = 'LOC_STREET',
  LOC_TRAIN = 'LOC_TRAIN',
  LOC_OFFICE = 'LOC_OFFICE',
  LOC_POOL = 'LOC_POOL',
  LOC_LOCKER = 'LOC_LOCKER',
}

export interface LocationData {
  id: string;
  name: string;
  visualData: string;
  defaultContext: string;
  imageUrl?: string;
  imageUrls?: string[];
  is360?: boolean;
}

export interface SocialStats {
  platform: 'Instagram' | 'TikTok' | 'LinkedIn' | 'Twitter';
  handle: string;
  followers: string;
  following: string;
}

export interface Relationship {
  id: string;
  name: string;
  role: string; 
  dynamic: string; 
  sentiment: 'positive' | 'negative' | 'neutral' | 'complicated';
  avatar?: string;
}

export interface VoiceExample {
  id: string;
  input: string; 
  output: string; 
  notes?: string;
}

export interface StyleGuide {
  persona_definition: string;
  visual_identity: string;
  content_pillars: string;
  content_examples: string;
  humor_pillars: string;
  color_palette?: string[]; 
  font_pairing?: string[]; 
}

export interface PersonalityTraits {
    confidence: number; 
    sarcasm: number; 
    friendliness: number; 
    chaos: number; 
    humor_style: 'Dry' | 'Silly' | 'Deadpan' | 'Witty' | 'None';
}

export interface BrainStrategy {
    trojan_strategy: string;
    anti_influencer_angle: string;
    emotional_hooks: string[];
    content_archetypes: string[];
    community_dynamics: string[];
    conversion_philosophy: string;
    viral_triggers: string[];
    business_hook: string;
    skills: string[];
    experience: string[];
}

export interface BrandFont {
    name: string;
    data: string; 
}

export interface ThumbnailStyle {
    referenceImage?: string; // User uploaded example
    fontFamily?: string;
    textColor?: string;
    overlayColor?: string;
}

export interface Product {
  id: string;
  name: string;
  price: string;
  description: string;
  imageUrl: string;
}

export interface BusinessInfo {
    name: string;
    industry: string;
    tagline: string;
    what_we_sell: string;
    target_audience: string;
    key_offers: string[];
    competitors: string[];
    tone_of_voice: string; 
    values: string;
    logo?: string; 
    visual_assets?: string[]; 
    raw_knowledge?: string; 
    templates?: any[]; 
    fonts?: BrandFont[]; 
    thumbnailStyle?: ThumbnailStyle;
    uniforms?: string;
    businessAssets?: string[];
    products: Product[]; // New field for products
}

export interface AppSettings {
    modelTier: 'fast' | 'smart';
    imageEngine: 'nano-fast' | 'nano-pro' | 'seedream';
}

export interface BrandContext {
  category: string;
  subcategory?: string;
  region: string;
  visualSignals: string[];
  offerTypes: string[];
  priceTier: 'budget' | 'mid' | 'premium' | 'luxury';
  competitorRefs: string[];
  contentFootprint: {
    instagramPosts?: number;
    tikTokPosts?: number;
    youtubeUploads?: number;
    lastActiveDays?: number;
  };
}

export interface PersonaCV {
  audienceArchetype: string;
  fears: string[];
  desires: string[]; 
  platformHabits: {
    instagram: { consumes: string[]; avoids: string[]; trusts: string[]; hates: string[]; };
    tiktok: { consumes: string[]; avoids: string[]; trusts: string[]; hates: string[]; };
    youtube: { consumes: string[]; avoids: string[]; trusts: string[]; hates: string[]; };
  };
  commentBehaviour: {
    tone: string[]; 
    triggers: string[]; 
    redFlags: string[]; 
  };
  priceSensitivity: 'low' | 'mid' | 'high';
  visualTolerance: {
    clutter: 'low' | 'mid' | 'high';
    motion: 'low' | 'mid' | 'high';
    faceTime: 'low' | 'mid' | 'high'; 
  };
  callToActionRules: string[]; 
  bannedAngles: string[]; 
}

export interface VoiceMode {
    title: string;          // e.g. "Calm Matriarch"
    mission: string;        // e.g. "To soothe the audience..."
    voiceDescription: string; // e.g. "Talks like a tired older sister..."
    samplePost: string;     // e.g. "Listen, it's okay to do nothing today."
    chaosLevel: number;
    sarcasmLevel: number;
}

export interface AvatarCandidate {
  id: string;
  name: string;
  img: string;
  label: string;
  tagline: string;
  traits: string[];
  visualPrompt: string;
  skills: string[];
  mission: string;
  chaosLevel: number;
  sarcasmLevel: number;
  archetype?: 'employee' | 'megafan';
  voiceModes: VoiceMode[];
  location?: string;
  pet?: string;
  hobby?: string;
  // NEW FIELDS
  pronouns?: string;
  birthday?: string;
  day_job?: string; // e.g. "Head Barista" (Employee) or "Accountant" (Super Fan)
  uniform?: string; // e.g. "Black branded apron" or "Business Casual"
}

export interface FacebookProfile {
    coverPhoto: string;
    profilePhoto: string;
    name: string;
    intro: string;
    friendsCount: string;
    posts: Array<{
        date: string;
        content: string;
        likes: number;
    }>;
}

export interface BrainData {
  isConfigured: boolean;
  onboardingType?: 'employee' | 'megafan';
  identity: {
    name: string;
    role: string;
    age: number;
    pronouns: string;
    birthday: string;
    bio: string;
    backstory: string;
    daily_routine: string;
    personality: PersonalityTraits;
    psychology: {
      motivation: string;
      fear: string;
      hobbies: string[];
      habits: string[];
    };
    voice: {
      tone: string;
      keywords: string[];
      forbidden: string[];
      emoji_style: string;
    };
    avatar: string;
    avatarReferences?: {
        front: string;
        side: string;
        candid: string;
    };
    referenceImages?: string[]; 
    cameraRoll?: string[];
    socials: SocialStats[];
    raw_knowledge?: string; 
  };
  relationships: Relationship[];
  training: VoiceExample[];
  brand: BusinessInfo;
  brandContext?: BrandContext;
  personaCV?: PersonaCV;
  styleGuide: StyleGuide;
  strategy?: BrainStrategy; 
  assets: {
    miso_cat: {
      description: string;
      imageUrl: string;
    };
    accessories?: string[]; 
  };
  locations: Record<string, LocationData>;
  candidates?: AvatarCandidate[];
  gallery?: Array<{ id: string; url: string; label: string; }>; // The 6-image consistent gallery
  facebookProfile?: FacebookProfile; // For Mega Fan view
}

export interface TrendCard {
  title: string;
  origin: string;
  vibe: string;
  strategy: string;
  url?: string;
}

export interface FeedPost {
  id: string;
  imageUrl: string | null;
  videoUrl?: string | null;
  caption: string;
  date: string;
  status: 'draft' | 'scheduled' | 'posted';
  notes?: string;
  type: 'image' | 'video' | 'empty';
  aiPrompt?: string;
  transcript?: string; 
}

export interface StoryItem {
    id: string;
    imageUrl: string | null;
    caption: string;
    type: 'story';
    relatedPostId?: string;
}

export interface VideoTranscript {
    title: string;
    transcript: { timestamp: string; speaker: string; dialogue: string; }[];
}

export interface FeedItem {
  id: string;
  imageUrls: string[];
  caption: string;
  hashtags: string[];
  type: 'video' | 'image';
  metadata?: any; 
}

export enum AgentTool {
  PLANNER = 'TOOL_PLANNER',
  TRENDS = 'TOOL_TRENDS',
  VISION = 'TOOL_VISION',
  BRAIN_UPDATE = 'TOOL_BRAIN_UPDATE',
  CHAT = 'TOOL_CHAT'
}

export interface BrainUpdateProposal {
  fieldPath: string;
  currentValue: any;
  newValue: any;
  reasoning: string;
}

export interface AgentMessage {
  role: 'user' | 'agent';
  text: string;
  type: 'text' | 'plan' | 'trends' | 'vision' | 'brain_update';
  data?: any;
  timestamp: number;
}

export interface ClientMeta {
    id: string;
    name: string;
    isConfigured: boolean;
}

export type TessPillar = 
  | 'Workday Chaos'
  | 'Undercover Discovery'
  | 'Silent Execution'
  | 'Quick & Dirty Hacks'
  | 'Micro Cultural Commentary'
  | 'Industry Tea'
  | 'Pet + Life Distraction'
  | 'Evidence Dump' // New for 14 day
  | 'Aesthetic Filler'; // New for 14 day

export interface TessDayPlan {
  day: number;
  pillar: TessPillar;
  format: 'Reel (9-12s)' | 'Carousel' | 'Static' | 'Story';
  hook: string;
  caption: string;
  visualPrompt: string;
  thumbnailHeadline: string;
  whyItWorks: string;
  assetType: 'camera_roll' | 'generate';
  veoPrompt: string;
  script?: string;
  textOverlay: string;
  nanoModel: string;
}

export type SprintDuration = 7 | 14;

// -- MISSING TYPES ADDED BELOW --

export enum CampaignPackage {
    WEEKLY_7 = 'WEEKLY_7'
}

export interface CampaignStrategy {
    comedic_angle: string;
    character_arc: string;
    shadow_selling_points: string[];
    visual_theme: string;
}

export interface WeeklyPostPlan {
    category: string;
    format: 'VIDEO' | 'IMAGE' | 'CAROUSEL';
    caption: string;
    hashtags: string[];
    visualPrompt: string;
    location: string;
    trendingHook?: string;
}

export interface CanvasConfig {
    width: number;
    height: number;
    name: string;
    backgroundColor: string;
}

export interface EditorLayer {
    id: string;
    type: 'image' | 'text' | 'shape';
    name: string;
    visible: boolean;
    locked: boolean;
    opacity: number;
    rotation: number;
    zIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    textAlign?: 'left' | 'center' | 'right';
    color?: string;
    src?: string;
    backgroundColor?: string;
    shapeType?: 'rectangle' | 'circle';
}

export interface EditorHistoryState {
    layers: EditorLayer[];
    canvasConfig: CanvasConfig;
    timestamp: number;
}

export interface DesignTemplate {
    id: string;
    name: string;
    thumbnail: string;
    layers: EditorLayer[];
    canvasConfig: CanvasConfig;
    lastModified: number;
    type: 'design' | 'overlay';
}

export interface VisionAnalysisResult {
    critique: string;
    caption: string;
    hashtags: string[];
    povText: string;
    veoPrompt: string;
    imagePrompt: string;
}