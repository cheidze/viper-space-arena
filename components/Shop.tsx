
import React, { useState } from 'react';
import { DEFAULT_SKINS, DEFAULT_COLLECTIBLES } from '../services/constants';
import { SnakeSkin, Collectible } from '../types';
import { audioService } from '../services/audioService';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { buildTONTransaction } from '../services/tonService';

interface Props {
  gold: number;
  unlockedSkins: string[];
  selectedSkinId: string;
  unlockedCollectibles: string[];
  selectedCollectibleId: string | null;
  themeColor?: string; // New prop for UI theming
  onBuySkin: (skin: SnakeSkin) => boolean;
  onEquipSkin: (skinId: string) => void;
  onBuyCollectible: (item: Collectible) => boolean;
  onEquipCollectible: (itemId: string) => void;
  onBuyGoldWithTon?: (amountInTon: number, goldAmount: number) => void;
  onClose: () => void;
}

const Shop: React.FC<Props> = ({ 
    gold, 
    unlockedSkins, 
    selectedSkinId, 
    unlockedCollectibles,
    selectedCollectibleId,
    themeColor = '#00f3ff', // Default Neon Blue
    onBuySkin, 
    onEquipSkin, 
    onBuyCollectible,
    onEquipCollectible,
    onBuyGoldWithTon,
    onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'skins' | 'particles' | 'themes' | 'gold'>('skins');
  const [tonConnectUI] = useTonConnectUI();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'unlocked'>('price-asc');
  const [priceFilter, setPriceFilter] = useState<'all' | '0-500' | '501-1000' | '1001+'>('all');
  
  // State for skin preview interaction (Store preview mode per skin ID if needed, 
  // but simpler to just have a generic hover state or local state map)
  const [previewModes, setPreviewModes] = useState<Record<string, string | 'gradient'>>({});

  const filterAndSortItems = <T extends { id: string; name: string; price: number }>(
    items: T[],
    unlockedIds: string[]
  ) => {
    let result = items.filter(item => {
      if (priceFilter === '0-500') return item.price <= 500;
      if (priceFilter === '501-1000') return item.price > 500 && item.price <= 1000;
      if (priceFilter === '1001+') return item.price > 1000;
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'unlocked') {
        const aUnlocked = unlockedIds.includes(a.id);
        const bUnlocked = unlockedIds.includes(b.id);
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;
        return 0;
      }
      return 0;
    });

    return result;
  };

  const handleBuySkin = (skin: SnakeSkin) => {
    const success = onBuySkin(skin);
    if (success) {
      audioService.playClick();
      setErrorMsg(null);
    } else {
      setErrorMsg("Not enough gold!");
      setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  const handleBuyCollectible = (item: Collectible) => {
    const success = onBuyCollectible(item);
    if (success) {
      audioService.playClick();
      setErrorMsg(null);
    } else {
      setErrorMsg("Not enough gold!");
      setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  const setSkinPreview = (skinId: string, mode: string | 'gradient') => {
      setPreviewModes(prev => ({...prev, [skinId]: mode}));
  };

  const handleTonPurchase = async (tonAmount: number, goldAmount: number) => {
    try {
      if (!tonConnectUI.connected) {
        setErrorMsg("Please connect TON wallet first!");
        setTimeout(() => setErrorMsg(null), 2000);
        return;
      }
      
      const tx = buildTONTransaction(tonAmount);
      await tonConnectUI.sendTransaction(tx);
      
      if (onBuyGoldWithTon) {
          onBuyGoldWithTon(tonAmount, goldAmount);
          audioService.playClick();
          setErrorMsg("Success! Gold added.");
          setTimeout(() => setErrorMsg(null), 2000);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Transaction cancelled or failed.");
      setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  const displaySkins = filterAndSortItems(DEFAULT_SKINS, unlockedSkins);
  const displayParticles = filterAndSortItems(DEFAULT_COLLECTIBLES.filter(c => c.type === 'particle'), unlockedCollectibles);
  const displayThemes = filterAndSortItems(DEFAULT_COLLECTIBLES.filter(c => c.type === 'theme'), unlockedCollectibles);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="glass-panel w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden relative transition-colors duration-500"
        style={{ borderColor: `${themeColor}40`, boxShadow: `0 0 50px ${themeColor}20` }}
      >
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-center bg-white/5 gap-4 relative">
          <div className="flex flex-col items-center md:items-start w-full md:w-auto">
            <h2 
                className="text-2xl md:text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400"
                style={{ backgroundImage: `linear-gradient(to right, ${themeColor}, #ffffff)` }}
            >
                MARKETPLACE
            </h2>
            <div className="flex gap-2 md:gap-4 mt-2 overflow-x-auto max-w-full pb-1 custom-scrollbar">
                {(['skins', 'particles', 'themes', 'gold'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => { audioService.playClick(); setActiveTab(tab); }}
                        className={`text-xs md:text-sm font-bold uppercase tracking-widest border-b-2 px-2 pb-1 transition-all whitespace-nowrap ${
                            activeTab === tab 
                            ? 'text-white border-opacity-100 scale-105' 
                            : 'text-gray-500 border-transparent hover:text-gray-300'
                        }`}
                        style={{ borderColor: activeTab === tab ? themeColor : 'transparent' }}
                    >
                        {tab}
                    </button>
                ))}
            </div>
          </div>

          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <div className="bg-black/40 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                <span className="text-lg md:text-xl">💰</span>
                <span className="font-mono font-bold text-neon-yellow text-lg md:text-xl">{gold}</span>
            </div>
          </div>
          <button 
              onClick={() => { audioService.playClick(); onClose(); }}
              className="absolute top-4 right-4 md:static w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-red-500/80 flex items-center justify-center transition-colors font-bold text-lg md:text-xl z-10"
          >
              ✕
          </button>
        </div>

        {/* Filters and Sorting */}
        <div className="p-3 md:p-4 border-b border-white/10 bg-black/40 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs text-gray-400 uppercase font-bold whitespace-nowrap">Sort By:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/50 w-full sm:w-auto transition-colors"
            >
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A-Z</option>
              <option value="name-desc">Name: Z-A</option>
              <option value="unlocked">Unlock Status</option>
            </select>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs text-gray-400 uppercase font-bold whitespace-nowrap">Price:</label>
            <select 
              value={priceFilter} 
              onChange={(e) => setPriceFilter(e.target.value as any)}
              className="bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/50 w-full sm:w-auto transition-colors"
            >
              <option value="all">All Prices</option>
              <option value="0-500">0 - 500 💰</option>
              <option value="501-1000">501 - 1000 💰</option>
              <option value="1001+">1001+ 💰</option>
            </select>
          </div>
        </div>

        {errorMsg && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-2 rounded-full font-bold shadow-lg animate-bounce z-50">
                {errorMsg}
            </div>
        )}

        {/* Grid Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-black/20">
            
            {/* SKINS TAB */}
            {activeTab === 'skins' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displaySkins.length === 0 ? (
                        <div className="col-span-full text-center py-10 text-gray-400 italic">No skins match your filters.</div>
                    ) : displaySkins.map(skin => {
                        const isUnlocked = unlockedSkins.includes(skin.id);
                        const isEquipped = selectedSkinId === skin.id;
                        const previewMode = previewModes[skin.id] || 'gradient';

                        return (
                            <div 
                                key={skin.id} 
                                className={`relative p-4 rounded-xl border-2 transition-all duration-200 group ${
                                    isEquipped 
                                    ? 'bg-white/10' 
                                    : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20'
                                }`}
                                style={{ borderColor: isEquipped ? themeColor : undefined }}
                            >
                                {/* Skin Preview Box */}
                                <div 
                                    className="h-32 rounded-lg bg-black/40 mb-4 flex flex-col items-center justify-center relative overflow-hidden transition-all"
                                >
                                    {/* Active Preview Layer */}
                                    <div 
                                        className="absolute inset-0 transition-colors duration-300"
                                        style={{ 
                                            background: previewMode === 'gradient' 
                                                ? `linear-gradient(45deg, ${skin.colors[0]}, ${skin.colors[1] || skin.colors[0]})`
                                                : previewMode
                                        }}
                                    />
                                    
                                    {/* Overlay for depth */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50"></div>

                                    {!isUnlocked && (
                                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm z-20">
                                            <span className="text-3xl">🔒</span>
                                        </div>
                                    )}

                                    {/* Visual Indicator of what is selected */}
                                    <span className="relative z-10 font-mono text-xs font-bold bg-black/50 px-2 py-1 rounded text-white border border-white/10">
                                        {previewMode === 'gradient' ? 'GRADIENT' : 'SOLID COLOR'}
                                    </span>
                                </div>

                                {/* Color Pickers / Gradient Selector */}
                                <div className="flex gap-2 justify-center mb-4">
                                    {/* Gradient Option */}
                                    <button 
                                        onClick={() => setSkinPreview(skin.id, 'gradient')}
                                        className={`w-6 h-6 rounded-full border-2 shadow-lg transition-transform hover:scale-110 ${previewMode === 'gradient' ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                        style={{ background: `linear-gradient(135deg, ${skin.colors[0]}, ${skin.colors[1] || skin.colors[0]})` }}
                                        title="Preview Gradient"
                                    />
                                    {/* Individual Colors */}
                                    {skin.colors.map((c, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => setSkinPreview(skin.id, c)}
                                            className={`w-6 h-6 rounded-full border-2 shadow-lg transition-transform hover:scale-110 ${previewMode === c ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                            style={{ backgroundColor: c }}
                                            title={`Preview Color ${i+1}`}
                                        />
                                    ))}
                                </div>

                                <div className="flex justify-between items-center mb-4 border-t border-white/10 pt-2">
                                    <h3 className="font-bold text-lg text-white">{skin.name}</h3>
                                    {skin.pattern && skin.pattern !== 'none' && (
                                        <span className="text-[10px] font-bold uppercase bg-white/10 px-2 py-1 rounded text-gray-300">
                                            {skin.pattern}
                                        </span>
                                    )}
                                </div>

                                {isUnlocked ? (
                                    <button 
                                        onClick={() => { audioService.playClick(); onEquipSkin(skin.id); }}
                                        disabled={isEquipped}
                                        className={`w-full py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all ${
                                            isEquipped ? 'bg-white/20 text-white cursor-default' : 'bg-white/10 hover:text-black text-white'
                                        }`}
                                        style={{ 
                                            backgroundColor: isEquipped ? `${themeColor}40` : undefined,
                                            color: isEquipped ? themeColor : undefined
                                        }}
                                        onMouseEnter={(e) => { if(!isEquipped) e.currentTarget.style.backgroundColor = themeColor; }}
                                        onMouseLeave={(e) => { if(!isEquipped) e.currentTarget.style.backgroundColor = ''; }}
                                    >
                                        {isEquipped ? 'Equipped' : 'Equip'}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleBuySkin(skin)}
                                        className="w-full py-2 rounded-lg font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                                    >
                                        <span>Buy</span>
                                        <span className="bg-black/20 px-2 rounded text-xs">{skin.price} 💰</span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* PARTICLES TAB */}
            {activeTab === 'particles' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayParticles.length === 0 ? (
                        <div className="col-span-full text-center py-10 text-gray-400 italic">No particles match your filters.</div>
                    ) : displayParticles.map(item => {
                        const isUnlocked = unlockedCollectibles.includes(item.id);
                        const isEquipped = selectedCollectibleId === item.id;

                        return (
                             <div 
                                key={item.id} 
                                className={`relative p-4 rounded-xl border-2 transition-all duration-200 group ${
                                    isEquipped ? 'bg-white/10' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20'
                                }`}
                                style={{ borderColor: isEquipped ? themeColor : undefined }}
                            >
                                <div className="h-32 rounded-lg bg-black/40 mb-4 flex flex-col items-center justify-center relative overflow-hidden text-center p-2">
                                    <div className="absolute w-full h-full opacity-20" style={{ background: `radial-gradient(circle, ${item.color} 0%, transparent 70%)` }}></div>
                                    <div className="text-5xl mb-2 relative z-10 drop-shadow-lg transform group-hover:scale-110 transition-transform animate-bounce">{item.icon}</div>
                                    <p className="text-xs text-gray-400 relative z-10 italic">{item.description}</p>

                                    {!isUnlocked && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-20">
                                            <span className="text-3xl">🔒</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-lg text-white">{item.name}</h3>
                                </div>

                                {isUnlocked ? (
                                    <button 
                                        onClick={() => { audioService.playClick(); onEquipCollectible(item.id); }}
                                        disabled={isEquipped}
                                        className="w-full py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all text-white"
                                        style={{ 
                                            backgroundColor: isEquipped ? `${themeColor}40` : 'rgba(255,255,255,0.1)',
                                            color: isEquipped ? themeColor : 'white'
                                        }}
                                    >
                                        {isEquipped ? 'Active' : 'Activate'}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleBuyCollectible(item)}
                                        className="w-full py-2 rounded-lg font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                                    >
                                        <span>Buy</span>
                                        <span className="bg-black/20 px-2 rounded text-xs">{item.price} 💰</span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

             {/* THEMES TAB */}
             {activeTab === 'themes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayThemes.length === 0 ? (
                        <div className="col-span-full text-center py-10 text-gray-400 italic">No themes match your filters.</div>
                    ) : displayThemes.map(item => {
                        const isUnlocked = unlockedCollectibles.includes(item.id);
                        const isEquipped = selectedCollectibleId === item.id;

                        return (
                             <div 
                                key={item.id} 
                                className={`relative p-4 rounded-xl border-2 transition-all duration-200 group ${
                                    isEquipped ? 'bg-white/10' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20'
                                }`}
                                style={{ borderColor: isEquipped ? themeColor : undefined }}
                            >
                                {/* Theme Preview */}
                                <div 
                                    className="h-32 rounded-lg mb-4 flex flex-col items-center justify-center relative overflow-hidden border-2 border-white/10"
                                    style={{ backgroundColor: item.id === 'theme_dark' ? '#000' : '#2a2a2a' }}
                                >
                                    {/* Mock UI Elements */}
                                    <div className="absolute top-2 left-2 right-2 h-4 rounded bg-white/10 flex items-center px-2 gap-1">
                                        <div className="w-2 h-2 rounded-full" style={{ background: item.color }}></div>
                                        <div className="w-10 h-1 bg-white/20 rounded"></div>
                                    </div>
                                    <div 
                                        className="w-16 h-8 rounded flex items-center justify-center font-bold text-xs shadow-lg"
                                        style={{ border: `1px solid ${item.color}`, color: item.color, background: `${item.color}20` }}
                                    >
                                        UI
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 italic">{item.description}</p>

                                    {!isUnlocked && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-20">
                                            <span className="text-3xl">🔒</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-lg text-white">{item.name}</h3>
                                    <div className="w-4 h-4 rounded-full shadow-sm" style={{ background: item.color }}></div>
                                </div>

                                {isUnlocked ? (
                                    <button 
                                        onClick={() => { audioService.playClick(); onEquipCollectible(item.id); }}
                                        disabled={isEquipped}
                                        className="w-full py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all text-white"
                                        style={{ 
                                            backgroundColor: isEquipped ? `${item.color}40` : 'rgba(255,255,255,0.1)',
                                            color: isEquipped ? item.color : 'white',
                                            borderColor: isEquipped ? item.color : 'transparent'
                                        }}
                                    >
                                        {isEquipped ? 'Active' : 'Activate'}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleBuyCollectible(item)}
                                        className="w-full py-2 rounded-lg font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                                    >
                                        <span>Buy</span>
                                        <span className="bg-black/20 px-2 rounded text-xs">{item.price} 💰</span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

             {/* GOLD TAB */}
             {activeTab === 'gold' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                    {[
                        { id: 'pack1', name: 'Starter Pack', gold: 5000, ton: 0.1, icon: '💰' },
                        { id: 'pack2', name: 'Pro Pack', gold: 15000, ton: 0.25, icon: '💎' },
                        { id: 'pack3', name: 'Whale Pack', gold: 50000, ton: 0.5, icon: '👑' },
                    ].map(pack => (
                        <div 
                            key={pack.id} 
                            className="relative p-8 rounded-2xl border-2 border-white/10 bg-black/60 hover:bg-white/5 transition-all text-center flex flex-col items-center group shadow-xl"
                            style={{ borderColor: themeColor }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none"></div>
                            <div className="text-7xl mb-6 group-hover:scale-110 transition-transform drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{pack.icon}</div>
                            <h3 className="font-black text-2xl text-white mb-2 uppercase tracking-wide">{pack.name}</h3>
                            <div className="text-neon-yellow font-bold text-xl mb-8 flex items-center gap-2">
                                <span>+ {pack.gold.toLocaleString()}</span>
                                <span className="text-sm">GOLD</span>
                            </div>
                            
                            <button 
                                onClick={() => handleTonPurchase(pack.ton, pack.gold)}
                                className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white shadow-[0_0_20px_rgba(0,136,204,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(0,136,204,0.6)]"
                                style={{ background: 'linear-gradient(135deg, #0088cc, #005580)' }}
                            >
                                BUY FOR {pack.ton} TON
                            </button>
                        </div>
                    ))}
                </div>
             )}

        </div>
      </div>
    </div>
  );
};

export default Shop;
