
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { authService, StoredUser } from '../services/authService';
import { loadPlayerData, savePlayerData, deletePlayerData, deleteSettings } from '../services/playerService';
import { PlayerData, GameSettings, BotDifficulty } from '../types';
import { DEFAULT_SKINS, DEFAULT_COLLECTIBLES } from '../services/constants';
import { GlobalConfig, saveGlobalConfig } from '../services/globalConfigService';

interface Props {
    onLogout: () => void;
    onBackToMenu: () => void;
    settings: GameSettings;
    onUpdateSettings: (s: Partial<GameSettings>) => void;
    currentUser: StoredUser | null;
    onUpdatePlayerData: (data: PlayerData) => void;
    globalConfig: GlobalConfig;
}

interface EnrichedUser extends StoredUser {
    playerData: PlayerData;
}

const AdminPanel: React.FC<Props> = ({ onLogout, onBackToMenu, settings, onUpdateSettings, currentUser, onUpdatePlayerData, globalConfig }) => {
    const [users, setUsers] = useState<EnrichedUser[]>([]);
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [localConfig, setLocalConfig] = useState<GlobalConfig>(globalConfig);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
    const [activityData, setActivityData] = useState<{ time: string, activeUsers: number, totalUsers: number }[]>([]);
    const [modal, setModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'alert' | 'confirm' | 'prompt';
        defaultValue?: string;
        onConfirm?: (value?: string) => void;
    } | null>(null);

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setModal({ isOpen: true, title, message, type: 'confirm', onConfirm });
    };

    const showPrompt = (title: string, message: string, defaultValue: string, onConfirm: (value: string) => void) => {
        setModal({ isOpen: true, title, message, type: 'prompt', defaultValue, onConfirm });
    };

    const showAlert = (title: string, message: string) => {
        setModal({ isOpen: true, title, message, type: 'alert' });
    };

    useEffect(() => {
        setLocalConfig(globalConfig);
    }, [globalConfig]);

    const handleSaveConfig = async () => {
        setIsSaving(true);
        setSaveMessage(null);
        try {
            await saveGlobalConfig(localConfig);
            setSaveMessage({ text: "Configuration saved successfully!", type: 'success' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error("Error saving config:", error);
            setSaveMessage({ text: "Failed to save configuration.", type: 'error' });
            setTimeout(() => setSaveMessage(null), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const refreshData = async () => {
        const allUsers = await authService.getUsers();
        // Enrich with Player Data (Levels, Gold, etc)
        const enriched = await Promise.all(allUsers.map(async (u) => ({
            ...u,
            playerData: await loadPlayerData(u.id)
        })));
        setUsers(enriched);

        const now = Date.now();
        // Active in the last 5 minutes
        const activeCount = enriched.filter(u => u.lastLogin && (now - u.lastLogin < 5 * 60 * 1000)).length;
        const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        setActivityData(prev => {
            const newData = [...prev, { time: timeStr, activeUsers: activeCount, totalUsers: enriched.length }];
            if (newData.length > 20) newData.shift();
            return newData;
        });
    };

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 5000); // Auto-refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const handleBanToggle = async (id: string) => {
        const newStatus = await authService.toggleBan(id);
        // Optimistic update
        setUsers(prev => prev.map(u => u.id === id ? { ...u, isBanned: newStatus } : u));
    };

    const handleDeleteUser = async (id: string) => {
        showConfirm("Delete User", "Are you sure you want to delete this user permanently?", async () => {
            if (await authService.deleteUser(id)) {
                await deletePlayerData(id);
                await deleteSettings(id);
                setUsers(prev => prev.filter(u => u.id !== id));
            }
        });
    };

    const handleGiftGold = (id: string) => {
        showPrompt("Gift Gold", "Enter amount of Gold to gift:", "", (amountStr) => {
            if (!amountStr) return;
            const amount = parseInt(amountStr);
            if (isNaN(amount) || amount <= 0) return;
            
            const user = users.find(u => u.id === id);
            if (user) {
                const newData = { ...user.playerData, gold: user.playerData.gold + amount };
                savePlayerData(id, newData);
                if (currentUser && currentUser.id === id) {
                    onUpdatePlayerData(newData);
                }
                refreshData();
            }
        });
    };

    const handleGiftXP = (id: string) => {
        showPrompt("Gift XP", "Enter amount of XP to gift:", "", (amountStr) => {
            if (!amountStr) return;
            const amount = parseInt(amountStr);
            if (isNaN(amount) || amount <= 0) return;
            
            const user = users.find(u => u.id === id);
            if (user) {
                const newData = { ...user.playerData, xp: user.playerData.xp + amount };
                while (newData.xp >= newData.xpToNext) {
                    newData.xp -= newData.xpToNext;
                    newData.level += 1;
                    newData.xpToNext = Math.floor(newData.xpToNext * 1.5);
                }
                savePlayerData(id, newData);
                if (currentUser && currentUser.id === id) {
                    onUpdatePlayerData(newData);
                }
                refreshData();
            }
        });
    };

    const handleGiftTON = (id: string) => {
        showPrompt("Gift TON", "Enter amount of TON to gift:", "", (amountStr) => {
            if (!amountStr) return;
            const amount = parseFloat(amountStr);
            if (isNaN(amount) || amount <= 0) return;
            
            const user = users.find(u => u.id === id);
            if (user) {
                const newData = { ...user.playerData, ton: (user.playerData.ton || 0) + amount };
                savePlayerData(id, newData);
                if (currentUser && currentUser.id === id) {
                    onUpdatePlayerData(newData);
                }
                refreshData();
            }
        });
    };

    const handleUnlockAll = (id: string) => {
        showConfirm("Unlock All", "Unlock all skins and collectibles for this user?", () => {
            const user = users.find(u => u.id === id);
            if (user) {
                const allSkins = DEFAULT_SKINS.map(s => s.id);
                const allCollectibles = DEFAULT_COLLECTIBLES.map(c => c.id);
                const newData = { 
                    ...user.playerData, 
                    unlockedSkinIds: allSkins,
                    unlockedCollectibles: allCollectibles
                };
                savePlayerData(id, newData);
                if (currentUser && currentUser.id === id) {
                    onUpdatePlayerData(newData);
                }
                refreshData();
            }
        });
    };

    const handleResetAccount = (id: string) => {
        showConfirm("Reset Progress", "WARNING: This will reset all gold, XP, and items for this user. Continue?", () => {
            const user = users.find(u => u.id === id);
            if (user) {
                const newData: PlayerData = {
                    ...user.playerData,
                    gold: 0,
                    selectedSkinId: "classic",
                    unlockedSkinIds: ["classic"],
                    unlockedCollectibles: [],
                    selectedCollectibleId: null,
                    xp: 0,
                    level: 1,
                    xpToNext: 100,
                    highScore: 0,
                    stats: {
                        gamesPlayed: 0,
                        totalKills: 0,
                        longestSnake: 0,
                        totalPlayTime: 0
                    }
                };
                savePlayerData(id, newData);
                if (currentUser && currentUser.id === id) {
                    onUpdatePlayerData(newData);
                }
                refreshData();
            }
        });
    };

    const handleEditName = async (id: string) => {
        const user = users.find(u => u.id === id);
        if (!user) return;
        showPrompt("Edit Username", "Enter new username:", user.username, async (newName) => {
            if (newName && newName.trim() !== "") {
                const updatedUser = await authService.updateUser(id, { username: newName.trim() });
                if (!updatedUser) {
                    showAlert("Error", "Failed to update username. It might already be taken.");
                } else {
                    refreshData();
                }
            }
        });
    };

    const handleResetLeaderboard = () => {
        showConfirm("Reset Leaderboard", "WARNING: This will reset ALL players' high scores to 0. Are you sure?", () => {
            users.forEach(user => {
                const newData = { ...user.playerData, highScore: 0 };
                savePlayerData(user.id, newData);
                if (currentUser && currentUser.id === user.id) {
                    onUpdatePlayerData(newData);
                }
            });
            refreshData();
            showAlert("Success", "Leaderboard has been reset!");
        });
    };

    const filteredUsers = users.filter(u => 
        (u.username?.toLowerCase().includes(filter.toLowerCase()) || '') ||
        (u.email?.toLowerCase().includes(filter.toLowerCase()) || '') ||
        (u.ip?.includes(filter) || '')
    );

    const sortedUsers = React.useMemo(() => {
        let sortable = [...filteredUsers];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof typeof a];
                let bValue: any = b[sortConfig.key as keyof typeof b];
                
                // Handle nested properties
                if (sortConfig.key === 'level') { aValue = a.playerData.level; bValue = b.playerData.level; }
                if (sortConfig.key === 'gold') { aValue = a.playerData.gold; bValue = b.playerData.gold; }
                if (sortConfig.key === 'ton') { aValue = a.playerData.ton || 0; bValue = b.playerData.ton || 0; }
                if (sortConfig.key === 'xp') { aValue = a.playerData.xp; bValue = b.playerData.xp; }
                if (sortConfig.key === 'username') { aValue = a.username?.toLowerCase() || ''; bValue = b.username?.toLowerCase() || ''; }
                if (sortConfig.key === 'totalKills') { aValue = a.playerData.stats?.totalKills || 0; bValue = b.playerData.stats?.totalKills || 0; }
                if (sortConfig.key === 'totalPlayTime') { aValue = a.playerData.stats?.totalPlayTime || 0; bValue = b.playerData.stats?.totalPlayTime || 0; }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [filteredUsers, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (!sortConfig || sortConfig.key !== columnKey) return <span className="text-gray-600 ml-1">↕</span>;
        return <span className="text-neon-blue ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return 'Never';
        return new Date(timestamp).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatPlayTime = (seconds: number) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const hasUnsavedChanges = JSON.stringify(localConfig) !== JSON.stringify(globalConfig);

    return (
        <div className="absolute inset-0 z-50 bg-black text-white p-6 md:p-10 font-mono overflow-y-auto custom-scrollbar pb-24">
            {/* Admin Header */}
            <div className="flex justify-between items-center mb-8 border-b border-red-500/30 pb-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-600 rounded flex items-center justify-center font-bold text-2xl shadow-[0_0_20px_#ff0000]">
                        ⚡
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-red-500 tracking-widest uppercase text-shadow-neon">God Mode</h1>
                        <p className="text-xs text-gray-400">VIPER ADMINISTRATION</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={onBackToMenu}
                        className="px-6 py-2 border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors rounded uppercase font-bold"
                    >
                        Back to Game
                    </button>
                    <button 
                        onClick={onLogout}
                        className="px-6 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors rounded uppercase font-bold"
                    >
                        Exit System
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-gray-900 border border-gray-800 p-4 rounded">
                    <p className="text-gray-500 text-xs uppercase">Total Users</p>
                    <p className="text-2xl font-bold text-white">{users.length}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 p-4 rounded">
                    <p className="text-gray-500 text-xs uppercase">Banned Users</p>
                    <p className="text-2xl font-bold text-red-500">{users.filter(u => u.isBanned).length}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 p-4 rounded">
                    <p className="text-gray-500 text-xs uppercase">Total Gold</p>
                    <p className="text-2xl font-bold text-yellow-400">{users.reduce((acc, u) => acc + u.playerData.gold, 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 p-4 rounded">
                    <p className="text-gray-500 text-xs uppercase">Total Games</p>
                    <p className="text-2xl font-bold text-blue-400">{users.reduce((acc, u) => acc + (u.playerData.stats?.gamesPlayed || 0), 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 p-4 rounded">
                    <p className="text-gray-500 text-xs uppercase">Active (24h)</p>
                    <p className="text-2xl font-bold text-green-400">
                        {users.filter(u => u.lastLogin && (Date.now() - u.lastLogin < 86400000)).length}
                    </p>
                </div>
            </div>

            {/* Real-time Activity Chart */}
            <div className="bg-gray-900/50 border border-neon-purple/30 p-6 rounded-lg mb-8 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
                <h2 className="text-xl font-bold text-neon-purple uppercase tracking-wider flex items-center gap-2 mb-4">
                    <span>📈</span> Live User Activity
                </h2>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activityData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" stroke="#4b5563" fontSize={12} tickMargin={10} />
                            <YAxis stroke="#4b5563" fontSize={12} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }}
                                itemStyle={{ color: '#a855f7' }}
                            />
                            <Area type="monotone" dataKey="activeUsers" stroke="#a855f7" fillOpacity={1} fill="url(#colorActive)" name="Active Users (Last 5m)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Game Configuration Panel */}
            <div className="bg-gray-900/50 border border-neon-blue/30 p-6 rounded-lg mb-8 shadow-[0_0_20px_rgba(0,243,255,0.05)]">
                 <div className="flex justify-between items-center mb-4">
                     <h2 className="text-xl font-bold text-neon-blue uppercase tracking-wider flex items-center gap-2">
                        <span>🎮</span> Game Configuration
                     </h2>
                     <div className="flex items-center gap-4">
                         {saveMessage && (
                             <span className={`text-sm font-bold ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                 {saveMessage.text}
                             </span>
                         )}
                         <button
                             onClick={handleSaveConfig}
                             disabled={isSaving}
                             className="px-6 py-2 bg-neon-blue text-black font-bold uppercase rounded hover:bg-white transition-colors disabled:opacity-50"
                         >
                             {isSaving ? "Saving..." : "Save Configuration"}
                         </button>
                     </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     
                     {/* Bot Count Control */}
                     <div className="space-y-2">
                         <div className="flex justify-between items-center">
                             <label className="text-gray-300 font-bold uppercase text-sm">Active Bots</label>
                             <span className="text-neon-blue font-mono text-xl font-bold">{localConfig.botCount}</span>
                         </div>
                         <input 
                             type="range" 
                             min="0" 
                             max="200" 
                             step="1"
                             value={localConfig.botCount}
                             onChange={(e) => setLocalConfig({ ...localConfig, botCount: parseInt(e.target.value) })}
                             className="w-full h-3 bg-gray-800 rounded-lg appearance-none cursor-pointer hover:bg-gray-700 transition-colors"
                             style={{ accentColor: '#00f3ff' }}
                         />
                         <p className="text-xs text-gray-500">Adjust the density of AI opponents in real-time.</p>
                     </div>

                     {/* Bot Difficulty Control */}
                     <div className="space-y-2">
                         <label className="text-gray-300 font-bold uppercase text-sm block">Global AI Difficulty</label>
                         <div className="grid grid-cols-4 gap-2">
                             {(['easy', 'medium', 'hard', 'nightmare'] as BotDifficulty[]).map(diff => (
                                 <button
                                     key={diff}
                                     onClick={() => setLocalConfig({ ...localConfig, botDifficulty: diff })}
                                     className={`py-2 rounded text-xs font-bold uppercase border transition-all ${
                                         localConfig.botDifficulty === diff
                                         ? 'bg-neon-blue/20 text-neon-blue border-neon-blue shadow-[0_0_10px_rgba(0,243,255,0.2)]'
                                         : 'bg-black/40 text-gray-500 border-gray-700 hover:bg-white/5'
                                     }`}
                                 >
                                     {diff}
                                 </button>
                             ))}
                         </div>
                         <p className="text-xs text-gray-500">Determines speed, turn rate and aggression of bots.</p>
                     </div>

                     {/* Boss Configuration */}
                     <div className="space-y-4 md:col-span-2 mt-4 border-t border-gray-800 pt-4">
                         <label className="text-gray-300 font-bold uppercase text-sm block">Boss Configuration</label>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-2">
                                 <div className="flex justify-between items-center">
                                     <label className="text-gray-400 font-bold uppercase text-xs">Spawn Interval (Seconds)</label>
                                     <span className="text-neon-blue font-mono text-sm font-bold">{localConfig.bossSpawnInterval}s</span>
                                 </div>
                                 <input 
                                     type="range" 
                                     min="10" 
                                     max="300" 
                                     step="10"
                                     value={localConfig.bossSpawnInterval}
                                     onChange={(e) => setLocalConfig({ ...localConfig, bossSpawnInterval: parseInt(e.target.value) })}
                                     className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer hover:bg-gray-700 transition-colors"
                                     style={{ accentColor: '#00f3ff' }}
                                 />
                                 <p className="text-[10px] text-gray-500">How often the Boss Snake spawns.</p>
                             </div>
                             <div className="space-y-2">
                                 <div className="flex justify-between items-center">
                                     <label className="text-gray-400 font-bold uppercase text-xs">Boss Size Multiplier</label>
                                     <span className="text-neon-blue font-mono text-sm font-bold">{localConfig.bossSizeMultiplier.toFixed(1)}x</span>
                                 </div>
                                 <input 
                                     type="range" 
                                     min="0.5" 
                                     max="5.0" 
                                     step="0.1"
                                     value={localConfig.bossSizeMultiplier}
                                     onChange={(e) => setLocalConfig({ ...localConfig, bossSizeMultiplier: parseFloat(e.target.value) })}
                                     className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer hover:bg-gray-700 transition-colors"
                                     style={{ accentColor: '#00f3ff' }}
                                 />
                                 <p className="text-[10px] text-gray-500">Scales the size and length of the Boss.</p>
                             </div>
                         </div>
                     </div>

                     {/* Global Message Control */}
                     <div className="space-y-2 md:col-span-2 mt-4 border-t border-gray-800 pt-4">
                         <label className="text-gray-300 font-bold uppercase text-sm block">Global Server Message</label>
                         <div className="flex gap-2">
                             <input
                                 type="text"
                                 placeholder="Enter announcement (leave empty to clear)..."
                                 value={localConfig.globalMessage || ''}
                                 onChange={(e) => setLocalConfig({ ...localConfig, globalMessage: e.target.value })}
                                 className="flex-1 bg-black/50 border border-gray-700 rounded px-3 py-2 text-white focus:border-neon-blue focus:outline-none"
                             />
                             <button
                                 onClick={handleSaveConfig}
                                 className="px-4 py-2 bg-neon-blue/20 text-neon-blue border border-neon-blue/50 rounded hover:bg-neon-blue hover:text-black font-bold uppercase transition-colors"
                             >
                                 Broadcast
                             </button>
                         </div>
                         <p className="text-xs text-gray-500">This message will appear as a banner in the main menu for all players.</p>
                     </div>

                     {/* Danger Zone */}
                     <div className="space-y-2 md:col-span-2 mt-4 border-t border-red-900/50 pt-4">
                         <label className="text-red-400 font-bold uppercase text-sm block">Danger Zone</label>
                         <button
                             onClick={handleResetLeaderboard}
                             className="px-4 py-2 bg-red-900/50 text-red-300 border border-red-700 rounded hover:bg-red-700 hover:text-white font-bold uppercase transition-colors"
                         >
                             Reset All Leaderboards
                         </button>
                         <p className="text-xs text-gray-500 mt-1">Sets every player's high score to 0. Use for new seasons.</p>
                     </div>
                 </div>
            </div>

            {/* Global Assets & Content Panel */}
            <div className="bg-gray-900/50 border border-neon-pink/30 p-6 rounded-lg mb-8 shadow-[0_0_20px_rgba(255,0,255,0.05)]">
                 <div className="flex justify-between items-center mb-4">
                     <h2 className="text-xl font-bold text-neon-pink uppercase tracking-wider flex items-center gap-2">
                        <span>🎨</span> Assets & Content
                     </h2>
                     <button
                         onClick={handleSaveConfig}
                         disabled={isSaving}
                         className="px-6 py-2 bg-neon-pink text-black font-bold uppercase rounded hover:bg-white transition-colors disabled:opacity-50"
                     >
                         {isSaving ? "Saving..." : "Save Configuration"}
                     </button>
                 </div>
                 <div className="grid grid-cols-1 gap-8">
                     {/* Loading Screen Logo */}
                     <div className="space-y-2">
                         <label className="text-gray-300 font-bold uppercase text-sm block">Loading Screen Logo URL</label>
                         <div className="flex gap-2 items-center">
                             <input
                                 type="text"
                                 placeholder="https://example.com/logo.png"
                                 value={localConfig.loadingScreenLogoUrl || ''}
                                 onChange={(e) => setLocalConfig({ ...localConfig, loadingScreenLogoUrl: e.target.value })}
                                 className="flex-1 bg-black/50 border border-gray-700 rounded px-3 py-2 text-white focus:border-neon-pink focus:outline-none"
                             />
                             <label className="cursor-pointer px-4 py-2 bg-neon-pink/20 text-neon-pink border border-neon-pink/50 rounded hover:bg-neon-pink hover:text-black font-bold uppercase transition-colors whitespace-nowrap">
                                 Upload
                                 <input 
                                     type="file" 
                                     accept="image/*" 
                                     className="hidden" 
                                     onChange={(e) => {
                                         const file = e.target.files?.[0];
                                         if (file) {
                                             if (file.size > 500 * 1024) {
                                                 showAlert("Error", "Image is too large. Please select an image under 500KB.");
                                                 return;
                                             }
                                             const reader = new FileReader();
                                             reader.onloadend = () => {
                                                 const base64String = reader.result as string;
                                                 setLocalConfig({ ...localConfig, loadingScreenLogoUrl: base64String });
                                             };
                                             reader.readAsDataURL(file);
                                         }
                                     }} 
                                 />
                             </label>
                         </div>
                         <p className="text-xs text-gray-500">URL for the logo displayed during the loading screen. You can also upload a small image (max 500KB).</p>
                     </div>

                     {/* Quests Configuration */}
                     <div className="space-y-2 border-t border-gray-800 pt-4">
                         <div className="flex justify-between items-center mb-2">
                             <label className="text-gray-300 font-bold uppercase text-sm block">Quests</label>
                             <button
                                 onClick={() => {
                                     const newQuests = [...(localConfig.quests || []), { id: Date.now().toString(), title: 'New Quest', description: 'Description', target: 10, reward: 100, type: 'daily' }];
                                     setLocalConfig({ ...localConfig, quests: newQuests });
                                 }}
                                 className="px-3 py-1 bg-neon-pink/20 text-neon-pink border border-neon-pink/50 rounded hover:bg-neon-pink hover:text-black font-bold uppercase text-xs transition-colors"
                             >
                                 + Add Quest
                             </button>
                         </div>
                         <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                             {(localConfig.quests || []).map((quest: any, index: number) => (
                                 <div key={quest.id || index} className="flex gap-2 items-center bg-black/30 p-2 rounded border border-gray-800">
                                     <input
                                         type="text"
                                         value={quest.title}
                                         onChange={(e) => {
                                             const newQuests = [...(localConfig.quests || [])];
                                             newQuests[index] = { ...newQuests[index], title: e.target.value };
                                             setLocalConfig({ ...localConfig, quests: newQuests });
                                         }}
                                         className="w-1/4 bg-black/50 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                                         placeholder="Title"
                                     />
                                     <input
                                         type="text"
                                         value={quest.description}
                                         onChange={(e) => {
                                             const newQuests = [...(localConfig.quests || [])];
                                             newQuests[index] = { ...newQuests[index], description: e.target.value };
                                             setLocalConfig({ ...localConfig, quests: newQuests });
                                         }}
                                         className="flex-1 bg-black/50 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                                         placeholder="Description"
                                     />
                                     <input
                                         type="number"
                                         value={quest.target}
                                         onChange={(e) => {
                                             const newQuests = [...(localConfig.quests || [])];
                                             newQuests[index] = { ...newQuests[index], target: parseInt(e.target.value) || 0 };
                                             setLocalConfig({ ...localConfig, quests: newQuests });
                                         }}
                                         className="w-16 bg-black/50 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                                         placeholder="Target"
                                     />
                                     <input
                                         type="number"
                                         value={quest.reward}
                                         onChange={(e) => {
                                             const newQuests = [...(localConfig.quests || [])];
                                             newQuests[index] = { ...newQuests[index], reward: parseInt(e.target.value) || 0 };
                                             setLocalConfig({ ...localConfig, quests: newQuests });
                                         }}
                                         className="w-20 bg-black/50 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                                         placeholder="Reward"
                                     />
                                     <select
                                         value={quest.type}
                                         onChange={(e) => {
                                             const newQuests = [...(localConfig.quests || [])];
                                             newQuests[index] = { ...newQuests[index], type: e.target.value as 'daily' | 'lifetime' };
                                             setLocalConfig({ ...localConfig, quests: newQuests });
                                         }}
                                         className="bg-black/50 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                                     >
                                         <option value="daily">Daily</option>
                                         <option value="lifetime">Lifetime</option>
                                     </select>
                                     <button
                                         onClick={() => {
                                             const newQuests = (localConfig.quests || []).filter((_: any, i: number) => i !== index);
                                             setLocalConfig({ ...localConfig, quests: newQuests });
                                         }}
                                         className="text-red-500 hover:text-red-400 font-bold px-2"
                                     >
                                         ×
                                     </button>
                                 </div>
                             ))}
                         </div>
                     </div>

                     {/* Lucky Wheel Prizes Configuration */}
                     <div className="space-y-2 border-t border-gray-800 pt-4">
                         <div className="flex justify-between items-center mb-2">
                             <label className="text-gray-300 font-bold uppercase text-sm block">Lucky Wheel Prizes</label>
                             <button
                                 onClick={() => {
                                     const newPrizes = [...(localConfig.luckyWheelPrizes || []), { label: 'New Prize', type: 'gold', amount: 100, color: '#FFFFFF', icon: '🎁' }];
                                     setLocalConfig({ ...localConfig, luckyWheelPrizes: newPrizes });
                                 }}
                                 className="px-3 py-1 bg-neon-pink/20 text-neon-pink border border-neon-pink/50 rounded hover:bg-neon-pink hover:text-black font-bold uppercase text-xs transition-colors"
                             >
                                 + Add Prize
                             </button>
                         </div>
                         <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                             {(localConfig.luckyWheelPrizes || []).map((prize: any, index: number) => (
                                 <div key={index} className="flex gap-2 items-center bg-black/30 p-2 rounded border border-gray-800">
                                     <input
                                         type="text"
                                         value={prize.label}
                                         onChange={(e) => {
                                             const newPrizes = [...(localConfig.luckyWheelPrizes || [])];
                                             newPrizes[index] = { ...newPrizes[index], label: e.target.value };
                                             setLocalConfig({ ...localConfig, luckyWheelPrizes: newPrizes });
                                         }}
                                         className="flex-1 bg-black/50 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                                         placeholder="Label"
                                     />
                                     <select
                                         value={prize.type}
                                         onChange={(e) => {
                                             const newPrizes = [...(localConfig.luckyWheelPrizes || [])];
                                             newPrizes[index] = { ...newPrizes[index], type: e.target.value as 'gold' | 'xp' | 'ton' };
                                             setLocalConfig({ ...localConfig, luckyWheelPrizes: newPrizes });
                                         }}
                                         className="bg-black/50 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                                     >
                                         <option value="gold">Gold</option>
                                         <option value="xp">XP</option>
                                         <option value="ton">TON</option>
                                     </select>
                                     <input
                                         type="number"
                                         value={prize.amount}
                                         onChange={(e) => {
                                             const newPrizes = [...(localConfig.luckyWheelPrizes || [])];
                                             newPrizes[index] = { ...newPrizes[index], amount: parseFloat(e.target.value) || 0 };
                                             setLocalConfig({ ...localConfig, luckyWheelPrizes: newPrizes });
                                         }}
                                         className="w-20 bg-black/50 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                                         placeholder="Amount"
                                     />
                                     <input
                                         type="color"
                                         value={prize.color}
                                         onChange={(e) => {
                                             const newPrizes = [...(localConfig.luckyWheelPrizes || [])];
                                             newPrizes[index] = { ...newPrizes[index], color: e.target.value };
                                             setLocalConfig({ ...localConfig, luckyWheelPrizes: newPrizes });
                                         }}
                                         className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                                     />
                                     <input
                                         type="text"
                                         value={prize.icon}
                                         onChange={(e) => {
                                             const newPrizes = [...(localConfig.luckyWheelPrizes || [])];
                                             newPrizes[index] = { ...newPrizes[index], icon: e.target.value };
                                             setLocalConfig({ ...localConfig, luckyWheelPrizes: newPrizes });
                                         }}
                                         className="w-10 bg-black/50 border border-gray-700 rounded px-2 py-1 text-white text-xs text-center"
                                         placeholder="Icon"
                                     />
                                     <button
                                         onClick={() => {
                                             const newPrizes = (localConfig.luckyWheelPrizes || []).filter((_: any, i: number) => i !== index);
                                             setLocalConfig({ ...localConfig, luckyWheelPrizes: newPrizes });
                                         }}
                                         className="text-red-500 hover:text-red-400 font-bold px-2"
                                     >
                                         ×
                                     </button>
                                 </div>
                             ))}
                         </div>
                     </div>
                 </div>
            </div>

            {/* Controls */}
            <div className="mb-4">
                <input 
                    type="text" 
                    placeholder="Search by Username, Email or IP..." 
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="w-full md:w-1/3 bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:border-red-500 focus:outline-none"
                />
            </div>

            {/* Main Table */}
            <div className="w-full overflow-x-auto bg-gray-900 border border-gray-800 rounded-lg shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                            <th className="p-4 border-b border-gray-700 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('username')}>
                                User <SortIcon columnKey="username" />
                            </th>
                            <th className="p-4 border-b border-gray-700">Personal Info</th>
                            <th className="p-4 border-b border-gray-700">Location / IP</th>
                            <th className="p-4 border-b border-gray-700">Device</th>
                            <th className="p-4 border-b border-gray-700 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('lastLogin')}>
                                Activity <SortIcon columnKey="lastLogin" />
                            </th>
                            <th className="p-4 border-b border-gray-700 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('level')}>
                                Game Stats <SortIcon columnKey="level" />
                            </th>
                            <th className="p-4 border-b border-gray-700 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('totalKills')}>
                                Performance <SortIcon columnKey="totalKills" />
                            </th>
                            <th className="p-4 border-b border-gray-700">Status</th>
                            <th className="p-4 border-b border-gray-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {sortedUsers.map(user => (
                            <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        {user.picture ? (
                                            <img src={user.picture} alt="" className="w-8 h-8 rounded-full bg-black object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">👤</div>
                                        )}
                                        <div>
                                            <div className="font-bold text-white text-sm">{user.username || 'Incomplete'}</div>
                                            <div className="text-xs text-gray-500 font-mono">{user.id}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm text-gray-300">{user.email}</div>
                                    <div className="text-xs text-gray-600 font-mono mt-1">
                                        Pass: {user.password || '<GoogleAuth>'}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        DOB: {user.dob ? `${user.dob.day}/${user.dob.month}/${user.dob.year}` : 'N/A'} • {user.gender || '?'}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        {user.country && user.country !== 'WW' && (
                                            <img src={`https://flagcdn.com/w20/${user.country.toLowerCase()}.png`} alt="" />
                                        )}
                                        <span className="text-sm font-mono text-cyan-400">{user.ip || 'Unknown'}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">{user.city}, {user.country}</div>
                                </td>
                                <td className="p-4 max-w-[150px]">
                                    <div className="truncate text-xs text-gray-400 cursor-help" title={user.device}>
                                        {user.device || 'Unknown Device'}
                                    </div>
                                </td>
                                <td className="p-4 text-sm">
                                    <div className="text-gray-400">
                                        <span className="text-xs text-gray-600 block">Last Login:</span>
                                        {formatDate(user.lastLogin)}
                                    </div>
                                    <div className="text-gray-400 mt-2">
                                        <span className="text-xs text-gray-600 block">Joined:</span>
                                        {formatDate(user.createdAt)}
                                    </div>
                                    <div className="text-gray-500 text-xs mt-1">Terms: <span className="text-green-500">Agreed</span></div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-neon-purple font-bold">Lvl {user.playerData.level}</span>
                                        <span className="text-gray-600">|</span>
                                        <span className="text-yellow-500">{user.playerData.gold} G</span>
                                        <span className="text-gray-600">|</span>
                                        <span className="text-cyan-400">{user.playerData.ton || 0} TON</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        XP: {user.playerData.xp}
                                    </div>
                                </td>
                                <td className="p-4 text-sm">
                                    <div className="text-gray-400">
                                        <span className="text-xs text-gray-600 block">Total Kills:</span>
                                        <span className="text-red-400 font-bold">{user.playerData.stats?.totalKills || 0}</span>
                                    </div>
                                    <div className="text-gray-400 mt-1">
                                        <span className="text-xs text-gray-600 block">Playtime:</span>
                                        <span className="text-blue-400 font-bold">{formatPlayTime(user.playerData.stats?.totalPlayTime || 0)}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    {user.isBanned ? (
                                        <span className="bg-red-900/50 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-500/30 uppercase">
                                            BANNED
                                        </span>
                                    ) : (
                                        <span className="bg-green-900/30 text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-500/30 uppercase">
                                            Active
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex flex-col gap-2 items-end">
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleEditName(user.id)}
                                                className="px-2 py-1 rounded text-[10px] font-bold uppercase transition-all bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600 hover:text-white"
                                            >
                                                Edit Name
                                            </button>
                                            <button 
                                                onClick={() => handleGiftGold(user.id)}
                                                className="px-2 py-1 rounded text-[10px] font-bold uppercase transition-all bg-yellow-600/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-600 hover:text-white"
                                            >
                                                +Gold
                                            </button>
                                            <button 
                                                onClick={() => handleGiftTON(user.id)}
                                                className="px-2 py-1 rounded text-[10px] font-bold uppercase transition-all bg-cyan-600/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-600 hover:text-white"
                                            >
                                                +TON
                                            </button>
                                            <button 
                                                onClick={() => handleGiftXP(user.id)}
                                                className="px-2 py-1 rounded text-[10px] font-bold uppercase transition-all bg-purple-600/20 text-purple-400 border border-purple-500/50 hover:bg-purple-600 hover:text-white"
                                            >
                                                +XP
                                            </button>
                                            <button 
                                                onClick={() => handleUnlockAll(user.id)}
                                                className="px-2 py-1 rounded text-[10px] font-bold uppercase transition-all bg-neon-blue/20 text-neon-blue border border-neon-blue/50 hover:bg-neon-blue hover:text-black"
                                            >
                                                Unlock All
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleBanToggle(user.id)}
                                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                                                    user.isBanned 
                                                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                                                    : 'bg-red-600/20 text-red-500 border border-red-500/50 hover:bg-red-600 hover:text-white'
                                                }`}
                                            >
                                                {user.isBanned ? 'Unban' : 'Ban'}
                                            </button>
                                            <button 
                                                onClick={() => handleResetAccount(user.id)}
                                                className="px-2 py-1 rounded text-[10px] font-bold uppercase transition-all bg-orange-900/50 text-orange-400 border border-orange-700 hover:bg-orange-700 hover:text-white"
                                            >
                                                Reset
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="px-2 py-1 rounded text-[10px] font-bold uppercase transition-all bg-red-900/50 text-red-300 border border-red-700 hover:bg-red-700 hover:text-white"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-8 text-center text-gray-600 text-xs">
                SECURE CONNECTION • VIPER ADMIN SYSTEM v4.0.2
            </div>
            {/* Sticky Save Bar */}
            {hasUnsavedChanges && (
                <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-neon-blue p-4 flex justify-between items-center z-50 shadow-[0_-5px_20px_rgba(0,243,255,0.2)]">
                    <div className="text-neon-blue font-bold uppercase tracking-wider flex items-center gap-2">
                        <span>⚠️</span> You have unsaved changes
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setLocalConfig(globalConfig)}
                            disabled={isSaving}
                            className="px-6 py-2 bg-gray-800 text-white font-bold uppercase rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            Discard
                        </button>
                        <button
                            onClick={handleSaveConfig}
                            disabled={isSaving}
                            className="px-6 py-2 bg-neon-blue text-black font-bold uppercase rounded hover:bg-white transition-colors disabled:opacity-50"
                        >
                            {isSaving ? "Saving..." : "Save All Changes"}
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Modal */}
            {modal && modal.isOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
                    <div className="bg-gray-900 border border-neon-blue rounded-lg p-6 max-w-md w-full shadow-[0_0_30px_rgba(0,243,255,0.2)]">
                        <h3 className="text-xl font-bold text-white mb-2">{modal.title}</h3>
                        <p className="text-gray-300 mb-6">{modal.message}</p>
                        
                        {modal.type === 'prompt' && (
                            <input 
                                type="text"
                                id="modal-prompt-input"
                                defaultValue={modal.defaultValue}
                                className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white mb-6 focus:border-neon-blue focus:outline-none"
                                autoFocus
                            />
                        )}

                        <div className="flex justify-end gap-3">
                            {modal.type !== 'alert' && (
                                <button 
                                    onClick={() => setModal(null)}
                                    className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 font-bold"
                                >
                                    Cancel
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    if (modal.type === 'prompt') {
                                        const input = document.getElementById('modal-prompt-input') as HTMLInputElement;
                                        if (modal.onConfirm) modal.onConfirm(input.value);
                                    } else {
                                        if (modal.onConfirm) modal.onConfirm();
                                    }
                                    setModal(null);
                                }}
                                className="px-4 py-2 bg-neon-blue text-black rounded hover:bg-white font-bold"
                            >
                                {modal.type === 'alert' ? 'OK' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
