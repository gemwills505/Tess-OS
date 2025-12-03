import React, { useState, useEffect } from 'react';

interface LandingPageProps {
    onLogin: (role: 'admin' | 'client', clientId?: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
    const [showLogin, setShowLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLogin = () => {
        if (email.toLowerCase().includes('admin')) {
            onLogin('admin'); 
        } else {
            onLogin('client', 'demo_client'); 
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden relative">
            
            {/* --- GRID BACKGROUND (The "Infinite" Feel) --- */}
            <div className="fixed inset-0 z-0 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', 
                     backgroundSize: '40px 40px' 
                 }}>
            </div>
            
            {/* --- NAVIGATION (FLOATING) --- */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${scrolled ? 'bg-[#050505]/80 backdrop-blur-xl border-white/10 py-4' : 'bg-transparent border-transparent py-8'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-3 group cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                            <div className="w-3 h-3 bg-black rounded-full"></div>
                        </div>
                        <span className="font-mono font-bold text-sm tracking-widest uppercase">Tess_OS <span className="text-gray-600">v6.0</span></span>
                    </div>
                    <button 
                        onClick={() => setShowLogin(true)}
                        className="px-5 py-2 bg-[#111] hover:bg-[#222] border border-white/10 text-white rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all hover:border-white/30"
                    >
                        Client Access //
                    </button>
                </div>
            </nav>

            {/* --- HERO SECTION --- */}
            <div className="relative pt-48 pb-32 px-6 z-10">
                <div className="max-w-5xl mx-auto text-center">
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] text-[10px] font-mono text-gray-400 mb-10 animate-fade-in backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        SYSTEM OPERATIONAL
                    </div>
                    
                    <h1 className="text-5xl md:text-8xl font-medium tracking-tighter mb-8 leading-[0.95] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40">
                        Identity Architecture.
                    </h1>
                    <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed font-light mb-12">
                        We don't build "content." We engineer <span className="text-white">psychographic infrastructure</span> for brands who need to dominate their niche.
                    </p>
                </div>
            </div>

            {/* --- THE BENTO GRID (ABSTRACT / TECHNICAL) --- */}
            <div className="max-w-7xl mx-auto px-6 pb-40 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[320px]">
                    
                    {/* CARD 1: STRATEGY MAP (The "Power Plant" Vibe) */}
                    <div className="md:col-span-2 lg:col-span-2 row-span-2 rounded-[32px] bg-[#080808] border border-white/10 p-8 flex flex-col relative overflow-hidden group">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,_rgba(100,100,100,0.1)_0%,_transparent_50%)]"></div>
                        <div className="relative z-10 mb-auto">
                            <h3 className="text-2xl font-medium text-white mb-2">Strategic Infrastructure</h3>
                            <p className="text-gray-500 text-sm max-w-sm">Visualizing the hidden pathways between audience psychology and brand revenue.</p>
                        </div>
                        
                        {/* Abstract "Node Map" Visualization */}
                        <div className="absolute bottom-0 left-0 right-0 h-[60%] opacity-40 group-hover:opacity-60 transition-opacity duration-700">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
                                {/* Center Node */}
                                <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_30px_rgba(255,255,255,0.5)]"></div>
                                {/* Orbiting Nodes */}
                                <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-gray-500 rounded-full"></div>
                                <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-gray-500 rounded-full"></div>
                                <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-gray-500 rounded-full"></div>
                                {/* Connecting Lines (SVG) */}
                                <svg className="w-full h-full absolute inset-0 pointer-events-none">
                                    <line x1="50%" y1="50%" x2="25%" y2="25%" stroke="white" strokeWidth="1" strokeOpacity="0.2" />
                                    <line x1="50%" y1="50%" x2="75%" y2="66%" stroke="white" strokeWidth="1" strokeOpacity="0.2" />
                                    <line x1="50%" y1="50%" x2="66%" y2="33%" stroke="white" strokeWidth="1" strokeOpacity="0.2" />
                                    <circle cx="50%" cy="50%" r="150" stroke="white" strokeWidth="1" strokeOpacity="0.05" fill="none" />
                                    <circle cx="50%" cy="50%" r="250" stroke="white" strokeWidth="1" strokeOpacity="0.05" fill="none" />
                                </svg>
                            </div>
                        </div>
                        
                        <div className="relative z-10 mt-auto flex gap-4">
                             <div className="px-3 py-1 bg-white/5 rounded text-[10px] font-mono text-gray-400 border border-white/5">NODE_01: VALIDATION</div>
                             <div className="px-3 py-1 bg-white/5 rounded text-[10px] font-mono text-gray-400 border border-white/5">NODE_02: RETENTION</div>
                        </div>
                    </div>

                    {/* CARD 2: PERSONA ENGINE (Code/Data View) */}
                    <div className="md:col-span-1 lg:col-span-1 row-span-2 rounded-[32px] bg-[#080808] border border-white/10 p-8 relative overflow-hidden group flex flex-col">
                        <div className="mb-4">
                            <h3 className="text-lg font-medium text-white">Persona Engine</h3>
                            <p className="text-xs text-gray-500 mt-1">14-point psychometric profiling.</p>
                        </div>
                        
                        {/* The "Code" Aesthetic */}
                        <div className="flex-1 bg-[#0c0c0c] rounded-xl border border-white/5 p-4 font-mono text-[10px] leading-relaxed overflow-hidden opacity-70 group-hover:opacity-100 transition-opacity">
                            <div className="text-gray-600">{'// Analyzing Audience...'}</div>
                            <div className="text-purple-400 mt-2">const <span className="text-white">Desires</span> = [</div>
                            <div className="pl-4 text-gray-400">"Validation",</div>
                            <div className="pl-4 text-gray-400">"Belonging",</div>
                            <div className="pl-4 text-gray-400">"Fear of Missing Out"</div>
                            <div className="text-purple-400">];</div>
                            
                            <div className="text-blue-400 mt-4">const <span className="text-white">Tone_Voice</span> = </div>
                            <div className="pl-4 text-green-400">"Anti-Corporate / Raw"</div>
                            
                            <div className="text-gray-600 mt-4">{'// Generating Neural Map...'}</div>
                            <div className="text-green-500 mt-1">Done (0.4s)</div>
                        </div>
                    </div>

                    {/* CARD 3: TREND SCANNER (Radar) */}
                    <div className="md:col-span-1 lg:col-span-1 rounded-[32px] bg-[#080808] border border-white/10 p-8 flex flex-col justify-between hover:border-white/20 transition-colors group">
                         <div>
                            <h3 className="text-lg font-medium text-white">Newsroom</h3>
                            <p className="text-xs text-gray-500 mt-1">Real-time cultural surveillance.</p>
                         </div>
                         <div className="h-20 flex items-end gap-1">
                             <div className="w-1/5 bg-white/20 h-[40%] rounded-t-sm group-hover:h-[60%] transition-all duration-500"></div>
                             <div className="w-1/5 bg-white/40 h-[70%] rounded-t-sm group-hover:h-[40%] transition-all duration-500"></div>
                             <div className="w-1/5 bg-white h-[90%] rounded-t-sm group-hover:h-[80%] transition-all duration-500"></div>
                             <div className="w-1/5 bg-white/40 h-[50%] rounded-t-sm group-hover:h-[70%] transition-all duration-500"></div>
                             <div className="w-1/5 bg-white/20 h-[30%] rounded-t-sm group-hover:h-[50%] transition-all duration-500"></div>
                         </div>
                    </div>

                    {/* CARD 4: DEPLOYMENT (Status) */}
                    <div className="md:col-span-1 lg:col-span-1 rounded-[32px] bg-[#080808] border border-white/10 p-8 flex flex-col justify-between hover:border-white/20 transition-colors">
                         <div className="flex justify-between items-start">
                            <h3 className="text-lg font-medium text-white">Deployment</h3>
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                         </div>
                         <div className="space-y-2">
                             <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                 <span>IG_REELS</span>
                                 <span className="text-white">Active</span>
                             </div>
                             <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                                 <div className="w-full h-full bg-white animate-loading"></div>
                             </div>
                         </div>
                    </div>

                    {/* CARD 5: CLIENT ACCESS (The Door) */}
                    <div className="md:col-span-3 lg:col-span-2 rounded-[32px] bg-[#111] p-10 flex flex-col justify-center items-start relative overflow-hidden group cursor-pointer border border-white/10 hover:border-white/30 transition-all" onClick={() => setShowLogin(true)}>
                        <div className="relative z-10">
                            <h3 className="text-3xl font-medium mb-2 text-white">Client Portal</h3>
                            <p className="text-gray-400 text-sm max-w-xs mb-6">
                                Secure access to your brand's neural network. Review strategy, approve content, and monitor growth.
                            </p>
                            <div className="inline-flex items-center gap-2 text-xs font-bold border-b border-white pb-0.5">
                                INITIALIZE SESSION <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </div>
                        </div>
                        {/* Abstract "Thumbprint" or "Key" Visual */}
                        <div className="absolute right-[-40px] top-1/2 -translate-y-1/2 w-48 h-48 opacity-20 group-hover:opacity-40 transition-opacity">
                            <svg viewBox="0 0 100 100" fill="none" stroke="white" strokeWidth="0.5">
                                <circle cx="50" cy="50" r="40" strokeDasharray="4 4" className="animate-spin-slow" />
                                <circle cx="50" cy="50" r="30" strokeDasharray="2 4" />
                                <circle cx="50" cy="50" r="20" />
                            </svg>
                        </div>
                    </div>

                </div>
            </div>

            {/* LOGIN MODAL (Minimalist / Terminal Style) */}
            {showLogin && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-fade-in">
                    <div className="bg-[#0a0a0a] border border-white/10 p-8 rounded-[24px] w-full max-w-sm shadow-2xl relative">
                        <button onClick={() => setShowLogin(false)} className="absolute top-6 right-6 text-gray-600 hover:text-white transition-colors">✕</button>
                        
                        <div className="mb-8">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-4">
                                <div className="w-4 h-4 bg-black rounded-sm"></div>
                            </div>
                            <h3 className="text-xl font-bold text-white">Authenticate</h3>
                            <p className="text-xs text-gray-500 mt-1 font-mono">SECURE_CONNECTION_REQUESTED</p>
                        </div>
                        
                        <div className="space-y-4">
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-[#111] border border-white/10 rounded-lg p-3 text-white text-xs font-mono outline-none focus:border-white/40 transition-all placeholder-gray-700"
                                placeholder="AGENCY_ID / EMAIL"
                                autoFocus
                            />
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-[#111] border border-white/10 rounded-lg p-3 text-white text-xs font-mono outline-none focus:border-white/40 transition-all placeholder-gray-700"
                                placeholder="ACCESS_KEY"
                                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            />
                            <button 
                                onClick={handleLogin}
                                className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-all mt-2 text-xs uppercase tracking-widest"
                            >
                                Connect
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;