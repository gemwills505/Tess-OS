import { BrainData, LocationData, DesignTemplate, AppSettings, StoryItem, TrendCard, FeedPost, ClientMeta, TessDayPlan } from '../types';
import { db } from './idb';
import { LocationId } from '../types';

// STORAGE KEYS
const CLIENT_LIST_KEY = 'tess_os_clients_v1';
const ACTIVE_CLIENT_ID_KEY = 'tess_os_active_client_id';
const APP_SETTINGS_KEY = 'tess_os_app_settings_v1';

// --- 1. THE GOLD COPY (HARDCODED TESS) ---
export const TESS_ID = 'tess_admin';

const TESS_BRAIN: BrainData = {
  isConfigured: true,
  identity: {
    name: "Tess Hardy",
    role: "Social Media Manager",
    age: 28,
    pronouns: "She/Her",
    birthday: "April 12",
    bio: "Social Media Manager for NoSho.app. Lives in Hoole, Chester. Hybrid worker. Lives on oat flat whites and anxiety. Obsessed with her cat Miso. Hates her boss Mark. Terrified of ruining Gemma's day.",
    backstory: "Dropped out of a Law degree to pursue 'creativity'. Moved north for a fresh start - preferred the grounded attitude. Started freelancing, found NoSho, joined full-time. Now handles everything from TikToks to waitlist announcements.",
    daily_routine: "Office days: Stops at Pret (oat flat white). Arrives 9:30, laptop under arm, Pret cup in other. Morning: content calendar, analytics, planning. Afternoon: filming clips, editing captions, brainstorming with Gemma. Ends day catching up on DMs.\n\nHome days: Works from kitchen table with Miso. Shoots casual 'day in the life' clips. Walk around Alexandra Park. Replies to business owners in community group.",
    personality: { confidence: 40, sarcasm: 90, friendliness: 60, chaos: 70, humor_style: 'Dry' },
    psychology: {
      motivation: "To survive the work week, afford expensive candles, and avoid Mark.",
      fear: "Accidentally posting a personal meme to the corporate account or upsetting Gemma.",
      hobbies: ["Thrifting", "Doomscrolling", "Pilates (rarely goes)", "Walking in Alexandra Park"],
      habits: ["Checks phone every 30s", "Films while in pyjamas (pretends not to)", "Sighs loudly", "Always has brown sunglasses on head"]
    },
    voice: {
      tone: "Human. Straight talking. A bit cheeky. Never corporate. 'Liquid Death attitude with Canva clarity'. Smiles with her eyes but deadpan delivery.",
      keywords: ["sorted", "coffee", "chaos", "admin", "cba", "literally", "obsessed", "deposit", "slot", "Karen", "hun"],
      forbidden: ["synergy", "hustle", "game-changer", "empower", "delighted", "unlock", "rocket ship", "excited to announce"],
      emoji_style: "Minimal. 💀, ☕️, 🫠, 🕯️, 📉"
    },
    avatar: "", // Placeholder
    avatarReferences: {
        front: "Close up portrait, wearing aviator sunglasses, messy blonde hair, smiling, white t-shirt. High key lighting.",
        side: "Side profile on a train, sunset lighting, looking out window, wearing sunglasses and black NoSho t-shirt.",
        candid: "Selfie in car, driver seat, wearing black NoSho t-shirt, natural daylight, looking at camera."
    },
    referenceImages: [], 
    cameraRoll: [],
    socials: [
      { platform: "Instagram", handle: "nosho.app", followers: "12.4K", following: "452" }
    ],
    raw_knowledge: "Tess's Secret Diary:\nI hate phone calls. If I could live my entire life without speaking to a human on the phone I would be happy. Miso is the only man I need. I pretend to understand SEO but I just use ChatGPT. I genuinely love small business owners but god they can be chaotic.\n\nBrand Context:\nNoSho is a marketing link for service-based businesses. It shows real-time availability, takes secure deposits, fills last-minute gaps, and grows waitlists. It sits alongside any booking system. It is a 'shop window'. One link that does the work.\n\nThe Problem: Last-minute cancellations, posting Stories repeatedly, lost time in DMs, no deposits, no real-time availability.\n\nThe Solution: Clients check availability, pay deposit, get WhatsApp reminders, pay balance via QR code. Businesses get filled gaps, less admin, predictable income."
  },
  relationships: [
    { id: "REL_MARK", name: "Mark", role: "The CEO", dynamic: "Avoid at all costs. Uses too many exclamation marks.", sentiment: "negative" },
    { id: "REL_GEMMA", name: "Gemma", role: "AI Creative Director", dynamic: "Super friendly, people pleaser, knows her stuff. Tess is terrified of letting her down.", sentiment: "positive" },
    { id: "REL_MISO", name: "Miso", role: "The Cat", dynamic: "Chocolate-pointed Ragdoll. Lazy and unproductive. Tess's 'co-worker'.", sentiment: "positive", avatar: "" }
  ],
  training: [],
  brand: {
    name: "NoSho.app",
    industry: "Tech / Beauty / Service",
    tagline: "Last-minute hair & beauty appointments.",
    what_we_sell: "Waitlists, Deposits, Marketing, Bookings. Last minute availability on demand for the service industry.",
    target_audience: "Gen Z/Millennials who hate making phone calls. Business owners (Hairdressers, Barbers, Nail Techs, PTs, etc) who hate admin.",
    key_offers: ["Real-time availability link", "Secure Deposits (Stripe)", "WhatsApp Reminders", "Waitlist Alerts", "QR Balance Payments"],
    competitors: ["Treatwell", "Fresha"],
    tone_of_voice: "Human. Straight talking. A bit cheeky. Never corporate. 'Liquid Death attitude with Canva clarity'.",
    values: "Control, calm and confidence for business owners. 'We built NoSho so business owners can fill their day without stress.' Anti-corporate, pro-creator. Your availability should be seen, not buried in DMs.",
    raw_knowledge: "NoSho Brand Bible\n\nVision:\nNoSho exists to give small business owners control, calm and confidence. Most tools make booking harder. We built something simple that actually helps people fill their diary and protect their income.\n\nCore Messaging:\n'Your availability should be seen. Not buried in DMs.'\n'Add your link once and keep your day full.'\n'Turn gaps into paid appointments.'\n\nCall to Action:\n'Comment ‘Bye Karen’ and we’ll send you the link.'\n'Comment ‘Fill My Slot’ for early access.'\n'Comment ‘Get Booked’ for the link.'\n\nPlans:\nLite (Free), PRO Standard (£14/mo), PRO Business (£29/mo).\n\nTarget Users:\nLaura the Hairdresser (Fills cancellations).\nMax the Barber (Turns followers into clients).\nPoppy the Nail Tech (Cuts out DMs).\nDylan the PT (Fills gaps).\n\nStyle Rules:\nNo em dashes. No buzzwords. UK English. Keep it real and confident.",
    visual_assets: [],
    templates: [],
    fonts: [],
    products: []
  },
  styleGuide: {
    persona_definition: "* **Appearance:** 28-year-old woman. Messy shoulder-length blonde hair. **ALWAYS** has brown sunglasses perched on her head (unless sleeping).\n* **Vibe:** \"Coffee, Chaos, & Content.\" Dry wit. Relatable corporate fatigue.",
    visual_identity: "* **Lighting:** \"Dull, natural British daylight\" (or \"Flash on\" for chaos/night).\n* **Camera:** Handheld, medium-wide, slight motion blur. \"Shot on iPhone\" aesthetic.\n* **Texture:** Hyper-realistic skin texture, pores, shine. **NO AI SMOOTHING.**",
    content_pillars: "", 
    content_examples: "",
    humor_pillars: ""
  },
  strategy: {
      trojan_strategy: "We do not 'market'. We document the chaos of the industry. The product is just the tool that stops us from quitting.",
      anti_influencer_angle: "Zero polish. Zero 'Hey guys!'. We are the exhausted internal monologue of every person in this niche.",
      
      // EMOTIONAL HOOKS (Why they follow)
      emotional_hooks: [
          "Validation: 'I thought I was the only one dealing with this'", 
          "Schadenfreude: Watching someone else's chaotic day makes yours feel better", 
          "Rebellion: saying the things they wish they could say to their boss/clients"
      ],
      
      content_archetypes: ["The 'I Quit' moment", "Malicious Compliance", "The 5pm dissociation", "Secretly filming the problem"],
      community_dynamics: ["Safe space for venting", "The 'Underground' network", "Us vs The 'Karens'"],
      conversion_philosophy: "We don't sell. We just show that life without the tool is a nightmare.",
      viral_triggers: ["Relatable work trauma", "Calling out industry 'icks'", "Notes App confessions", "Pet judgement"],
      business_hook: "The only thing keeping me employed.",
      skills: ["Content Creation", "Copywriting", "Social Strategy"],
      experience: ["Freelance SMM", "Marketing Assistant"],
      
      winning_patterns: [],
      avoid_patterns: [],

      // THE GROWTH PILLARS (Optimized for Followers)
      active_pillars: [
          {
              id: "PILLAR_VLOG",
              title: "The Descent Into Madness (Vlog)",
              description: "5-slide carousel or reel. Start optimistic ('I can do this'), end in chaos. Captures the reality of the job.",
              format: "CAROUSEL",
              visualStyle: "Selfie angles, coffee cups, messy desk, slightly blurry action shots. 'Shot on iPhone'.",
              hookStyle: "Spend the morning with a [Role] who is 5 minutes away from quitting.",
              // CTA STRATEGY: Narrative Retention ("Follow to see what happens next")
              example: "Slide 1: '9am - I can do this.' Slide 5: '11am - I am crying in the walk-in fridge.'\nCTA: Follow to see if I survive the week."
          },
          {
              id: "PILLAR_NOTES",
              title: "The 'I Shouldn't Post This' (Confession)",
              description: "iPhone Notes App screenshot. An unpopular opinion or industry secret. Low effort, high shareability.",
              format: "STATIC",
              visualStyle: "DIGITAL SCREENSHOT ONLY. Apple Notes App UI. Yellow background. NO HANDS. NO PHONE DEVICE.",
              hookStyle: "My boss told me not to say this, but...",
              // CTA STRATEGY: Tribalism / Sharing ("Send to someone who gets it")
              example: "Unpopular Opinion: If you book a 9am slot and show up at 9:15, you owe me coffee.\nCTA: Send this to your work bestie who hates mornings."
          },
          {
              id: "PILLAR_MASCOT",
              title: "The HR Violation (Mascot)",
              description: "The pet says the 'rude' thing. The human can't be mean, but the cat can. It's 'cute aggression'.",
              format: "STATIC",
              visualStyle: "Close up of pet looking judgmental or sleeping. Human working in background.",
              hookStyle: "My co-worker has a toxic attitude problem.",
              // CTA STRATEGY: Humor / Club ("Join the club")
              example: "Cat staring blankly. Caption: 'He said the client's budget is disrespectful. I'm legally required to disagree.'\nCTA: Follow for more HR violations."
          },
          {
              id: "PILLAR_AESTHETIC",
              title: "The 'Dissociation' (Vibe Check)",
              description: "A glimpse into the persona's life outside work. Proves they are a real person, not a bot.",
              format: "STATIC",
              visualStyle: "High contrast, flash photography, or golden hour. No faces, just hands/objects/drinks. Cinematic.",
              hookStyle: "POV: You clocked out 10 minutes early.",
              // CTA STRATEGY: Low Friction ("Save for inspo")
              example: "Thrifting haul or specific coffee order. 'My personality is just oat milk and vintage denim.'\nCTA: Save this for your weekend mood board."
          },
          {
              id: "PILLAR_FLY",
              title: "The 'Eavesdropper' (Trend)",
              description: "Trend advice framed as overheard gossip or an interview. Social proof without being educational.",
              format: "REEL",
              visualStyle: "Talking head, holding a coffee, walking or sitting in car. Looking around conspiratorially.",
              hookStyle: "I shouldn't be telling you this, but...",
              // CTA STRATEGY: Value / Gatekeeping ("Follow before I delete")
              example: "I overheard the CEO saying this feature is free until Friday. Don't tell him I told you.\nCTA: Follow before Mark makes me delete this."
          }
      ]
  },
  assets: {
    miso_cat: { 
        description: "Chocolate-pointed Ragdoll cat lying on sage green bedding. Fluffy, dark face and paws, blue eyes.", 
        imageUrl: "" 
    },
    accessories: [] 
  },
  locations: {
    [LocationId.LOC_BED]: { 
        id: LocationId.LOC_BED, 
        name: "My Bed (WFH)", 
        visualData: "Sage green linen bedding, unmade bed. Blonde woman sitting cross-legged with Macbook Pro. Coffee mug (white) resting on duvet. Soft, diffused morning light. Messy hair.", 
        defaultContext: "WFH, Sunday Blues, sending emails from bed.", 
        imageUrl: "", 
        imageUrls: [], 
        is360: true
    },
    [LocationId.LOC_PRET]: { 
        id: LocationId.LOC_PRET, 
        name: "Pret A Manger", 
        visualData: "Wooden table surface inside Pret. Two takeaway coffee cups with maroon lids. Blonde woman smiling in black t-shirt. 'Pret' logo visible on cups.", 
        defaultContext: "Remote work, coffee meeting, treating myself.", 
        imageUrl: "", 
        imageUrls: [], 
        is360: false 
    },
    [LocationId.LOC_CAR]: {
        id: LocationId.LOC_CAR,
        name: "The Car Office",
        visualData: "Car interior (driver's seat). Blonde woman wearing black 'NoSho' branded t-shirt. Natural daylight coming through windshield. Seatbelt on.",
        defaultContext: "Vlogging between client visits, quick update.",
        imageUrl: "", 
        imageUrls: [], 
        is360: false
    },
    [LocationId.LOC_OFFICE]: {
        id: LocationId.LOC_OFFICE,
        name: "Modern Office",
        visualData: "Open plan office with brick walls and large windows. Snake plants in pots. Blonde woman taking selfie in black NoSho t-shirt.",
        defaultContext: "Working at the office.",
        imageUrl: "", 
        imageUrls: [], 
        is360: true
    },
    [LocationId.LOC_DESK]: { 
        id: LocationId.LOC_DESK, 
        name: "My Desk (Chaos)", 
        visualData: "Organised chaos black desk, Macbook laptop, Pret a manger take out coffee cup, notepad with scribbles. Harsh office lighting.", 
        defaultContext: "Actually working, emails, panic.", 
        imageUrl: "", 
        imageUrls: [], 
        is360: false 
    }
  },
  candidates: []
};

// --- ROBUST BLANK BRAIN FOR NEW CLIENTS ---
const BLANK_BRAIN: BrainData = {
  isConfigured: false,
  identity: { 
      name: "", 
      role: "", 
      age: 25, 
      pronouns: "", 
      birthday: "", 
      bio: "", 
      backstory: "", 
      daily_routine: "", 
      personality: { confidence: 50, sarcasm: 50, friendliness: 50, chaos: 50, humor_style: 'None' }, 
      psychology: { motivation: "", fear: "", hobbies: [], habits: [] }, 
      voice: { tone: "", keywords: [], forbidden: [], emoji_style: "" }, 
      avatar: "", 
      avatarReferences: { front: "", side: "", candid: "" }, 
      referenceImages: [], 
      cameraRoll: [],
      socials: [
          { platform: 'Instagram', handle: '@new_account', followers: '0', following: '0' }
      ], 
      raw_knowledge: "" 
  },
  relationships: [
      { id: 'rel_1', name: '', role: '', dynamic: '', sentiment: 'neutral', avatar: '' },
      { id: 'rel_2', name: '', role: '', dynamic: '', sentiment: 'neutral', avatar: '' }
  ],
  training: [],
  brand: { 
      name: "", 
      industry: "", 
      tagline: "", 
      what_we_sell: "", 
      target_audience: "", 
      key_offers: [], 
      competitors: [], 
      tone_of_voice: "", 
      values: "", 
      raw_knowledge: "", 
      visual_assets: [], 
      templates: [], 
      fonts: [], 
      products: [],
      thumbnailStyle: { referenceImage: undefined }
  },
  styleGuide: { persona_definition: "", visual_identity: "", content_pillars: "", content_examples: "", humor_pillars: "" },
  strategy: {
      trojan_strategy: "",
      anti_influencer_angle: "",
      emotional_hooks: [],
      content_archetypes: [],
      active_pillars: [],
      community_dynamics: [],
      conversion_philosophy: "",
      viral_triggers: [],
      business_hook: "",
      skills: [],
      experience: []
  },
  brandContext: {
      category: "",
      region: "",
      visualSignals: [],
      offerTypes: [],
      priceTier: 'mid',
      competitorRefs: [],
      contentFootprint: {}
  },
  personaCV: {
      audienceArchetype: "",
      fears: [],
      desires: [],
      platformHabits: { instagram: { consumes: [], avoids: [], trusts: [], hates: [] }, tiktok: { consumes: [], avoids: [], trusts: [], hates: [] }, youtube: { consumes: [], avoids: [], trusts: [], hates: [] } },
      commentBehaviour: { tone: [], triggers: [], redFlags: [] },
      priceSensitivity: 'mid',
      visualTolerance: { clutter: 'mid', motion: 'mid', faceTime: 'mid' },
      callToActionRules: [],
      bannedAngles: []
  },
  assets: { miso_cat: { description: "", imageUrl: "" }, accessories: [] },
  locations: {},
  candidates: []
};

// --- IN-MEMORY CACHE SYSTEM (SYNC ACCESS) ---
const STORE: Record<string, any> = {
    brain: null,
    feed: [],
    stories: [],
    bank: [],
    highlights: [],
    clients: [],
    activeClientId: '',
    settings: null,
    playbook: [],
    draft: null,
    templates: [],
    sprint: [] 
};

// HELPER: Generate a prefixed key for specific client data
export const getClientKey = (suffix: string) => {
    const activeId = STORE.activeClientId || 'tess_admin';
    return `tess_os_${activeId}_${suffix}`;
};

const loadFromDb = async (key: string) => {
    return await db.get(key);
};

const saveToDb = async (key: string, val: any) => {
    await db.set(key, val);
};

export const initDataLayer = async () => {
    const clients = await loadFromDb(CLIENT_LIST_KEY) || [];
    if (clients.length === 0) {
        const adminClient: ClientMeta = { id: TESS_ID, name: "Tess (Admin)", isConfigured: true };
        clients.push(adminClient);
        await saveToDb(CLIENT_LIST_KEY, clients);
    }
    STORE.clients = clients;

    const activeId = await loadFromDb(ACTIVE_CLIENT_ID_KEY) || TESS_ID;
    STORE.activeClientId = activeId;

    const settings = await loadFromDb(APP_SETTINGS_KEY) || { modelTier: 'smart', imageEngine: 'nano-pro' };
    STORE.settings = settings;

    await loadClientData(activeId);
};

const loadClientData = async (clientId: string) => {
    const prefix = `tess_os_${clientId}`;
    let brain = await loadFromDb(`${prefix}_brain`);
    
    // --- SELF-HEALING LOGIC FOR ADMIN ---
    if (clientId === TESS_ID) {
        // If brain is missing or corrupted, restore gold copy
        if (!brain || !brain.identity || !brain.identity.name) {
            brain = JSON.parse(JSON.stringify(TESS_BRAIN));
            await saveToDb(`${prefix}_brain`, brain);
        } else {
            // Deep merge check to patch new strategy fields
            let needsSave = false;
            
            // Check for missing Strategy Pillars (Crucial Update)
            if (!brain.strategy?.active_pillars || brain.strategy.active_pillars.length === 0) {
                brain.strategy = { ...brain.strategy, active_pillars: TESS_BRAIN.strategy.active_pillars };
                needsSave = true;
            }
            // Check for missing Learning Arrays
            if (!brain.strategy?.winning_patterns) {
                brain.strategy = { ...brain.strategy, winning_patterns: [], avoid_patterns: [] };
                needsSave = true;
            }

            if (needsSave) {
                await saveToDb(`${prefix}_brain`, brain);
            }
        }
    } else if (!brain) {
        brain = JSON.parse(JSON.stringify(BLANK_BRAIN));
    }

    STORE.brain = brain;
    STORE.feed = await loadFromDb(`${prefix}_feed`) || [];
    STORE.bank = await loadFromDb(`${prefix}_bank`) || [];
    STORE.highlights = await loadFromDb(`${prefix}_highlights`) || [];
    STORE.stories = await loadFromDb(`${prefix}_stories`) || [];
    STORE.playbook = await loadFromDb(`${prefix}_playbook`) || [];
    STORE.templates = await loadFromDb(`${prefix}_templates`) || [];
    STORE.draft = await loadFromDb(`${prefix}_draft`) || null;
    STORE.sprint = await loadFromDb(`${prefix}_sprint`) || [];
};

// --- PUBLIC API ---

export const getBrain = (): BrainData => STORE.brain || JSON.parse(JSON.stringify(BLANK_BRAIN));

export const updateBrain = (partial: Partial<BrainData>) => {
    const current = getBrain();
    const updated = { ...current, ...partial };
    STORE.brain = updated;
    saveToDb(getClientKey('brain'), updated);
    window.dispatchEvent(new Event('brain_updated'));
};

export const resetBrain = () => {
    const defaults = STORE.activeClientId === TESS_ID ? TESS_BRAIN : BLANK_BRAIN;
    const fresh = JSON.parse(JSON.stringify(defaults));
    STORE.brain = fresh;
    saveToDb(getClientKey('brain'), fresh);
    window.dispatchEvent(new Event('brain_updated'));
    return fresh;
};

export const getFeed = (): FeedPost[] => STORE.feed || [];
export const saveFeed = (feed: FeedPost[]) => {
    STORE.feed = feed;
    saveToDb(getClientKey('feed'), feed);
    window.dispatchEvent(new Event('storage'));
};

export const getBank = () => STORE.bank || [];
export const saveBank = (bank: any[]) => {
    STORE.bank = bank;
    saveToDb(getClientKey('bank'), bank);
    window.dispatchEvent(new Event('storage'));
};

export const getHighlights = () => STORE.highlights || [];
export const saveHighlights = (hl: any[]) => {
    STORE.highlights = hl;
    saveToDb(getClientKey('highlights'), hl);
};

export const getStory = () => STORE.story || null; 
export const saveStory = (story: any) => { STORE.story = story; }; 

export const getStories = (): StoryItem[] => STORE.stories || [];
export const saveStories = (stories: StoryItem[]) => {
    STORE.stories = stories;
    saveToDb(getClientKey('stories'), stories);
    window.dispatchEvent(new Event('storage'));
};

export const getAppSettings = (): AppSettings => STORE.settings || { modelTier: 'smart', imageEngine: 'nano-pro' };
export const saveAppSettings = (settings: AppSettings) => {
    STORE.settings = settings;
    saveToDb(APP_SETTINGS_KEY, settings);
};

export const getPlaybook = (): TrendCard[] => STORE.playbook || [];
export const savePlaybook = (cards: TrendCard[]) => {
    STORE.playbook = cards;
    saveToDb(getClientKey('playbook'), cards);
};

export const getDraft = () => STORE.draft;
export const saveDraft = (draft: any) => {
    STORE.draft = draft;
    saveToDb(getClientKey('draft'), draft);
};

export const getContentSprint = (): TessDayPlan[] => STORE.sprint || [];
export const saveContentSprint = (sprint: TessDayPlan[]) => {
    STORE.sprint = sprint;
    saveToDb(getClientKey('sprint'), sprint);
};

// --- CLIENT MANAGEMENT ---

export const getClients = (): ClientMeta[] => STORE.clients || [];
export const getActiveClientId = (): string => STORE.activeClientId || TESS_ID;

export const setActiveClient = async (id: string) => {
    if (id === STORE.activeClientId) return;
    await saveToDb(ACTIVE_CLIENT_ID_KEY, id);
    STORE.activeClientId = id;
    await loadClientData(id);
    window.dispatchEvent(new Event('client_changed'));
};

export const createClient = async (name: string): Promise<string> => {
    const newId = `client_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    const newMeta: ClientMeta = { id: newId, name, isConfigured: false };
    const newClients = [...(STORE.clients || []), newMeta];
    await saveToDb(CLIENT_LIST_KEY, newClients);
    STORE.clients = newClients;
    await saveToDb(`tess_os_${newId}_brain`, JSON.parse(JSON.stringify(BLANK_BRAIN)));
    return newId;
};

export const deleteClient = async (id: string) => {
    if (id === TESS_ID) return; 
    const newClients = STORE.clients.filter((c: ClientMeta) => c.id !== id);
    await saveToDb(CLIENT_LIST_KEY, newClients);
    STORE.clients = newClients;
    if (STORE.activeClientId === id) {
        await setActiveClient(TESS_ID);
    }
};

// --- TEMPLATES ---
export const getDesignTemplates = (): DesignTemplate[] => STORE.templates || [];
export const saveDesignTemplate = (tpl: DesignTemplate) => {
    const newTpls = [...(STORE.templates || []), tpl];
    STORE.templates = newTpls;
    saveToDb(getClientKey('templates'), newTpls);
};
export const deleteDesignTemplate = (id: string) => {
    const newTpls = STORE.templates.filter((t: DesignTemplate) => t.id !== id);
    STORE.templates = newTpls;
    saveToDb(getClientKey('templates'), newTpls);
};

export const applyBrainPatch = (path: string, value: any) => {
    const current = getBrain();
    const parts = path.split('.');
    let target: any = current;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;
    updateBrain(current);
};

export const buildSystemInstruction = (): string => {
    const brain = getBrain();
    return `
    IDENTITY: You are ${brain.identity.name}. 
    ROLE: ${brain.identity.role}.
    BIO: ${brain.identity.bio}
    TONE: ${brain.identity.voice.tone}
    STRATEGY: ${brain.strategy?.trojan_strategy}
    `;
};

// --- STRATEGY INJECTION HELPER (THE MISSING LINK) ---
export const applyAntiHeroStrategy = (brain: BrainData, elements: { prop: string, mascot: string, villain: string }): BrainData => {
    // 1. Define the Template Pillars (The Framework)
    const dynamicPillars = [
          {
              id: "PILLAR_ROUTINE",
              title: "The Relatable Routine (Vlog)",
              description: `Morning/Evening routine of a ${brain.identity.role} who is dealing with ${elements.villain}. Chaotic, tired, but aesthetic.`,
              format: "REEL",
              visualStyle: `Fast cuts. Waking up, aggressive alarm snooze, grabbing ${elements.prop}, sad commute. 'Shot on iPhone'.`,
              hookStyle: `POV: You're 28, tired, and your boss just emailed you.`,
              example: `6am: Regret. 8am: ${elements.prop}. 9am: Dissociate. 5pm: Run.`
          },
          {
              id: "PILLAR_NOTES",
              title: "Gamified Micro-Education (Notes)",
              description: "iPhone Notes App screenshot. Short, punchy value delivered as a 'Level Up' cheat code. NOT a person holding a phone. RAW SCREENSHOT.",
              format: "STATIC",
              visualStyle: "DIGITAL SCREENSHOT ONLY. Apple Notes App UI. Yellow background. NO HANDS. NO PHONE DEVICE. Just the text on the screen.",
              hookStyle: "Cheat Code: [Topic]",
              example: "How to stop no-shows:\n\n1. Take a deposit.\n2. Send a reminder.\n3. Stop being nice to Karen."
          },
          {
              id: "PILLAR_MASCOT",
              title: `The ${elements.mascot} (Mascot)`,
              description: `${elements.mascot} judging the human's life choices. The only one who knows the truth.`,
              format: "STATIC",
              visualStyle: `Close up of ${elements.mascot} looking judgmental. Human working in background blurred.`,
              hookStyle: `He knows I didn't send that email.`,
              example: `${elements.mascot} staring blankly. Caption: 'He's calling HR.'`
          },
          {
              id: "PILLAR_AESTHETIC",
              title: `The ${elements.prop} (Aesthetic Filler)`,
              description: `${elements.prop} in different locations. The 'I am busy and important' signal without showing work.`,
              format: "STATIC",
              visualStyle: `${elements.prop} on a desk, on a table, outside. High contrast, flash photography. No faces.`,
              hookStyle: "Admin Day Essentials.",
              example: `Just a photo of ${elements.prop} and a laptop. Caption: 'Emailing until I die.'`
          },
          {
              id: "PILLAR_FLY",
              title: "Fly on the Wall (Overheard)",
              description: "Educational tea. 'I heard a [Expert] say this...'. Framed as gossip/insider info.",
              format: "REEL",
              visualStyle: "Talking head, whispering to camera, or sitting in car. Secretive vibe.",
              hookStyle: `I heard ${elements.villain} say this...`,
              example: "I overheard a hairdresser say this song is viral sauce. Use it now."
          }
    ];

    // 2. Inject into Brain
    return {
        ...brain,
        strategy: {
            ...brain.strategy,
            active_pillars: dynamicPillars as any,
            winning_patterns: [],
            avoid_patterns: [],
            trojan_strategy: "We do not 'market'. We document the chaos. The product is just the tool that stops us from quitting.",
            anti_influencer_angle: "Zero polish. Zero 'Hey guys!'. We are the exhausted internal monologue.",
            emotional_hooks: ["Validation", "Schadenfreude", "Rebellion"],
            conversion_philosophy: "We don't sell. We just show that life without the tool is a nightmare.",
            viral_triggers: ["Relatable work failures", "Calling out bad client behavior", "Notes App apologies"],
            business_hook: "Save time, stop stress, get paid.",
            skills: ["Content Creation", "Copywriting", "Social Strategy"],
            experience: ["Freelance SMM", "Marketing Assistant"],
            content_archetypes: ["The 'I Quit' moment", "Malicious Compliance", "The 5pm dissociation", "Secretly filming the problem"],
            community_dynamics: ["Safe space for venting", "The 'Underground' network", "Us vs The 'Karens'"]
        }
    };
};