import React, { useState, useRef } from 'react';
import { PlayerData } from '../types';
import { audioService } from '../services/audioService';

interface Props {
  playerData: PlayerData;
  onClose: () => void;
  onWin: (prizeType: 'gold' | 'xp' | 'ton', amount: number) => void;
  themeColor?: string;
  prizes?: any[];
}

const DEFAULT_PRIZES = [
  { label: '500 Gold', type: 'gold', amount: 500, color: '#FFD700', icon: '💰' },
  { label: '0.1 TON', type: 'ton', amount: 0.1, color: '#0088CC', icon: '💎' },
  { label: '2000 Gold', type: 'gold', amount: 2000, color: '#FF8C00', icon: '💰' },
  { label: '500 XP', type: 'xp', amount: 500, color: '#FF00FF', icon: '⭐' },
  { label: '1000 Gold', type: 'gold', amount: 1000, color: '#32CD32', icon: '💰' },
  { label: '1 TON', type: 'ton', amount: 1, color: '#00AEEF', icon: '💎' },
  { label: '5000 Gold', type: 'gold', amount: 5000, color: '#FF4500', icon: '💰' },
  { label: '100 XP', type: 'xp', amount: 100, color: '#00FFFF', icon: '⭐' },
];

const SPIN_COST = 1000;

const LuckyWheel: React.FC<Props> = ({ playerData, onClose, onWin, themeColor = '#00f3ff', prizes = DEFAULT_PRIZES }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<typeof DEFAULT_PRIZES[0] | null>(null);
  const [error, setError] = useState('');

  const activePrizes = prizes && prizes.length > 0 ? prizes : DEFAULT_PRIZES;

  const spinWheel = () => {
    if (isSpinning) return;
    if (playerData.gold < SPIN_COST) {
      setError('Not enough gold!');
      return;
    }

    setError('');
    setIsSpinning(true);
    setResult(null);
    audioService.playClick();

    onWin('gold', -SPIN_COST);

    const spinDuration = 4000;
    const extraSpins = 5;
    const prizeIndex = Math.floor(Math.random() * activePrizes.length);
    const sliceAngle = 360 / activePrizes.length;
    
    const targetAngle = extraSpins * 360 + (360 - (prizeIndex * sliceAngle + sliceAngle / 2));
    const newRotation = rotation + targetAngle + (360 - (rotation % 360));

    setRotation(newRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setResult(activePrizes[prizeIndex]);
      onWin(activePrizes[prizeIndex].type as 'gold' | 'xp' | 'ton', activePrizes[prizeIndex].amount);
    }, spinDuration);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { if (!isSpinning) onClose(); }}>
      <div 
        className="w-full max-w-md bg-gray-900 border-2 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
        style={{ borderColor: `${themeColor}60` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/40">
          <h2 className="text-2xl font-black italic tracking-widest text-white">LUCKY WHEEL</h2>
          <button 
            onClick={() => { if (!isSpinning) { audioService.playClick(); onClose(); } }}
            disabled={isSpinning}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/80 flex items-center justify-center transition-colors font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center relative">
          <p className="text-gray-400 text-sm mb-8 text-center">Spin the wheel for <span className="font-bold text-neon-yellow">{SPIN_COST} Gold</span>!</p>

          <div className="relative w-72 h-72 mb-8">
            {/* Outer Glow */}
            <div className={`absolute inset-0 rounded-full blur-[20px] opacity-30 ${isSpinning ? 'animate-pulse' : ''}`} style={{ backgroundColor: themeColor }}></div>
            
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 z-20 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-white drop-shadow-[0_0_10px_rgba(255,255,255,1)]"></div>
            
            {/* Wheel Container */}
            <div className="absolute inset-0 rounded-full border-[6px] border-gray-800 shadow-[0_0_20px_rgba(0,0,0,1)_inset] z-10 overflow-hidden">
              {/* Wheel */}
              <div 
                className="w-full h-full rounded-full relative transition-transform ease-out"
                style={{ 
                  transform: `rotate(${rotation}deg)`,
                  transitionDuration: isSpinning ? '4s' : '0s',
                  background: 'conic-gradient(' + activePrizes.map((p, i) => `${p.color} ${i * (360/activePrizes.length)}deg ${(i+1) * (360/activePrizes.length)}deg`).join(', ') + ')'
                }}
              >
                {/* Inner segments and text */}
                {activePrizes.map((prize, i) => {
                  const angle = i * (360 / activePrizes.length) + (360 / activePrizes.length) / 2;
                  return (
                    <div 
                      key={i}
                      className="absolute top-0 left-1/2 w-10 h-1/2 origin-bottom -translate-x-1/2 flex items-start justify-center pt-6"
                      style={{ transform: `rotate(${angle}deg)` }}
                    >
                      <span className="text-black font-black text-sm whitespace-nowrap transform -rotate-90 origin-center drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)] flex items-center gap-1">
                        <span>{prize.icon}</span> {prize.label}
                      </span>
                    </div>
                  );
                })}
                
                {/* Center Hub */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900 rounded-full border-4 border-gray-700 shadow-[0_0_15px_rgba(0,0,0,0.8)] z-20 flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 font-bold mb-4 animate-pulse">{error}</p>}
          
          {result && !isSpinning && (
            <div className="mb-4 text-center animate-in zoom-in duration-300 bg-black/60 p-4 rounded-xl border w-full shadow-[0_0_20px_rgba(0,0,0,0.5)]" style={{ borderColor: result.color }}>
              <p className="text-white text-sm uppercase tracking-widest mb-1">You won</p>
              <p className="text-3xl font-black drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] flex items-center justify-center gap-2" style={{ color: result.color }}>
                <span>{result.icon}</span> {result.label}!
              </p>
            </div>
          )}

          <button
            onClick={spinWheel}
            disabled={isSpinning}
            className={`w-full py-4 rounded-xl font-black text-2xl tracking-widest uppercase transition-all ${
              isSpinning 
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-neon-yellow via-neon-pink to-neon-blue text-white hover:scale-[1.02] shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:shadow-[0_0_30px_rgba(255,215,0,0.6)] bg-[length:200%_auto] animate-gradient'
            }`}
          >
            {isSpinning ? 'SPINNING...' : 'SPIN NOW'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LuckyWheel;
