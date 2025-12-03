import React, { useState } from 'react';

interface LandingPageProps {
    onLogin: (role: 'admin' | 'client', clientId?: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
    const [showLogin, setShowLogin] = useState(false);
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');

    const handleLogin = () => {
        // SIMULATED AUTHENTICATION
        if (email.toLowerCase().includes('admin')) {
            onLogin('admin'); // Log in as YOU (The Creator)
        } else {
            // In a real app, you'd fetch the client ID based on email
            // Here we simulate logging in as a specific client
            onLogin('client', 'demo_client'); 
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-brand-purple selection:text-white overflow-hidden relative">
            {/* Ambient Background */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>

            {/* Nav */}
            <nav className="flex justify-between items-center p-8 max-w-7xl mx-auto relative z-10">
                <div className="text-2xl font-black tracking-tighter flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
                    <span>Tess<span className="text-gray-600">OS</span></span>
                </div>
                <button 
                    onClick={() => setShowLogin(true)}
                    className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold transition-all border border-white/10 hover:border-white/30 backdrop-blur-sm"
                >
                    Portal Access
                </button>
            </nav>

            {/* Hero */}
            <div className="flex flex-col items-center justify-center text-center mt-20 px-6 relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-8 animate-fade-in backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                    The Future of Brand Architecture
                </div>
                <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-8 max-w-5xl leading-[0.9] bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-600">
                    Data-Driven <br/> Identity Design.
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl leading-relaxed mb-12 font-medium">
                    We don't guess. We build brands based on deep psychographic analysis, 
                    competitor scanning, and algorithmic content strategy.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-8">
                    {[
                        { title: "Deep Analytics", desc: "14-point psychometric audience scanning.", icon: "📊" },
                        { title: "Persona Architecture", desc: "Building the perfect brand voice using data.", icon: "🧠" },
                        { title: "Strategic Deployment", desc: "High-conversion content roadmaps.", icon: "🚀" }
                    ].map((item, i) => (
                        <div key={i} className="p-8 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-purple-500/30 transition-all hover:bg-white/[0.05] text-left group backdrop-blur-sm">
                            <div className="text-3xl mb-4 group-hover:scale-110 transition-transform origin-left">{item.icon}</div>
                            <h3 className="text-lg font-bold mb-2 text-white">{item.title}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* LOGIN MODAL */}
            {showLogin && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-[#0a0a0a] border border-gray-800 p-8 rounded-[32px] w-full max-w-md shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                        
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black tracking-tight text-white">Portal Access</h3>
                            <button onClick={() => setShowLogin(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">✕</button>
                        </div>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 tracking-widest">Email</label>
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#151515] border border-gray-800 rounded-xl p-4 text-white outline-none focus:border-purple-500/50 focus:bg-[#1a1a1a] transition-all text-sm font-medium"
                                    placeholder="client@brand.com"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 tracking-widest">Password</label>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#151515] border border-gray-800 rounded-xl p-4 text-white outline-none focus:border-purple-500/50 focus:bg-[#1a1a1a] transition-all text-sm font-medium"
                                    placeholder="••••••••"
                                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                />
                            </div>
                            <button 
                                onClick={handleLogin}
                                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all transform active:scale-95 mt-2"
                            >
                                Enter Secure Portal
                            </button>
                            <p className="text-[10px] text-center text-gray-700 mt-4 font-mono">
                                *Admin access requires 2FA key verification.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;