import React, { useEffect, useState, useRef } from "react";
import { GameEngine } from "../services/gameEngine";
import { Snake, PlayerData } from "../types";
import XPBar from "./XPBar";

interface Props {
  engine: GameEngine;
  playerData: PlayerData;
  themeColor?: string;
  onReturnToMenu: () => void;
  isSpectating?: boolean;
}

interface LocalStats {
  length: number;
  rank: number;
  name: string;
  country: string;
}

interface BossStats {
  name: string;
  health: number;
  maxHealth: number;
}

const HUD: React.FC<Props> = ({
  engine,
  playerData,
  themeColor = "#00f3ff",
  onReturnToMenu,
  isSpectating = false,
}) => {
  const [leaderboard, setLeaderboard] = useState<Snake[]>([]);
  const [isLeaderboardExpanded, setIsLeaderboardExpanded] = useState(false);
  const [myStats, setMyStats] = useState<LocalStats>({
    length: 0,
    rank: 0,
    name: "",
    country: "WW",
  });
  const [spectatingStats, setSpectatingStats] = useState<LocalStats | null>(
    null,
  );
  const minimapRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const snakes: Snake[] = Array.from(engine.state.snakes.values());
      snakes.sort((a, b) => b.score - a.score);

      const top10 = snakes.slice(0, 10);
      setLeaderboard(top10);

      const mySnake = engine.getMySnake();
      if (mySnake) {
        const rank = snakes.findIndex((s) => s.id === mySnake.id) + 1;
        setMyStats({
          length: Math.floor(mySnake.score),
          rank,
          name: mySnake.name,
          country: mySnake.country || "WW",
        });
      }

      if (isSpectating) {
        const spectatingSnake = engine.getSpectatingSnake();
        if (spectatingSnake) {
          const rank = snakes.findIndex((s) => s.id === spectatingSnake.id) + 1;
          setSpectatingStats({
            length: Math.floor(spectatingSnake.score),
            rank,
            name: spectatingSnake.name,
            country: spectatingSnake.country || "WW",
          });
        } else {
          setSpectatingStats(null);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [engine, isSpectating]);

  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const renderMinimap = () => {
      const worldSize = engine.state.worldSize;
      const size = canvas.width;
      const scale = size / worldSize;

      ctx.clearRect(0, 0, size, size);

      // Draw background
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, size, size);

      // Draw border
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, size, size);

      // Draw snakes
      const snakes = Array.from(engine.state.snakes.values()) as Snake[];
      snakes.forEach((snake) => {
        if (snake.isDead) return;
        const head = snake.body[0];
        if (!head) return;

        const isMe = snake.id === engine.state.myId;
        const isBoss = snake.isBoss;

        if (isBoss) {
          ctx.fillStyle = Date.now() % 500 < 250 ? "#ff0000" : "#8b0000";
          ctx.beginPath();
          ctx.arc(head.x * scale, head.y * scale, 5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = isMe ? "#ffffff" : snake.skin.colors[0];
          ctx.beginPath();
          ctx.arc(head.x * scale, head.y * scale, isMe ? 3 : 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw viewport
      const mySnake = engine.getMySnake();
      const spectatingSnake = isSpectating
        ? engine.getSpectatingSnake()
        : undefined;
      const targetSnake =
        mySnake && !mySnake.isDead ? mySnake : spectatingSnake;

      if (targetSnake && !targetSnake.isDead) {
        const head = targetSnake.body[0];
        if (head) {
          const viewW = window.innerWidth * scale;
          const viewH = window.innerHeight * scale;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 1;
          ctx.strokeRect(
            head.x * scale - viewW / 2,
            head.y * scale - viewH / 2,
            viewW,
            viewH,
          );
        }
      }

      animationFrameId = requestAnimationFrame(renderMinimap);
    };

    renderMinimap();

    return () => cancelAnimationFrame(animationFrameId);
  }, [engine, themeColor, isSpectating]);

  const renderFlag = (code: string) => {
    if (!code || code === "WW" || code === "🌐")
      return <span className="text-base leading-none">🌐</span>;
    return (
      <img
        src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
        alt={code}
        className="w-4 h-2.5 object-cover rounded-[1px]"
      />
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {/* Top Left: Minimap */}
      <div className="absolute top-2 left-2 md:top-4 md:left-4 pointer-events-auto">
        <div
          className="glass-panel rounded-lg p-1 animate-in fade-in slide-in-from-left-10 duration-500 border-l-2"
          style={{ borderLeftColor: themeColor }}
        >
          <canvas
            ref={minimapRef}
            width={100}
            height={100}
            className="rounded opacity-80"
          />
        </div>
      </div>

      {/* Top Right: Leaderboard & Menu */}
      <div className="absolute top-2 right-2 w-[140px] md:w-[180px] pointer-events-auto flex flex-col gap-2">
        {/* Menu Button */}
        <button
          onClick={onReturnToMenu}
          className="glass-panel w-full py-1.5 rounded-lg flex items-center justify-center gap-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors border-l-2 text-[10px] md:text-xs font-bold uppercase tracking-wider shadow-sm"
          style={{ borderLeftColor: themeColor }}
        >
          <span>←</span> Menu
        </button>

        {/* Leaderboard */}
        <div
          className="glass-panel rounded-lg p-2 md:p-3 animate-in fade-in slide-in-from-right-10 duration-500 border-l-2 shadow-sm transition-all"
          style={{ borderLeftColor: themeColor }}
        >
          <div 
            className="flex justify-between items-center mb-2 border-b border-white/10 pb-1 cursor-pointer group"
            onClick={() => setIsLeaderboardExpanded(!isLeaderboardExpanded)}
          >
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 tracking-widest uppercase group-hover:text-white transition-colors">
              Leaderboard
            </h3>
            <span className="text-gray-400 group-hover:text-white transition-colors text-[10px]">
              {isLeaderboardExpanded ? "▲" : "▼"}
            </span>
          </div>
          <ul className="space-y-1 md:space-y-1.5">
            {(isLeaderboardExpanded ? leaderboard : leaderboard.slice(0, 5)).map((snake, idx) => (
              <li
                key={snake.id}
                className={`flex justify-between text-[10px] md:text-xs items-center ${snake.id === engine.state.myId ? "font-bold bg-white/5 rounded px-1 -mx-1" : "text-gray-300"}`}
                style={{
                  color:
                    snake.id === engine.state.myId ? themeColor : undefined,
                }}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-gray-500 w-3 md:w-4 text-right">
                    {idx + 1}.
                  </span>
                  <div className="shrink-0 flex items-center">
                    {renderFlag(snake.country)}
                  </div>
                  <span className="truncate max-w-[60px] md:max-w-[80px]">
                    {snake.name}
                  </span>
                </div>
                <span className="font-mono opacity-80">
                  {Math.floor(snake.score)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom Right: Compact Stats */}
      <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4">
        <div
          className="glass-panel rounded-lg px-3 py-2 flex flex-col min-w-[130px] animate-in fade-in slide-in-from-right-10 duration-500 border-r-2 scale-95 origin-bottom-right"
          style={{ borderRightColor: themeColor }}
        >
          {isSpectating ? (
            <div className="flex flex-col mb-1.5 pointer-events-auto">
              <span className="text-gray-400 text-[9px] uppercase tracking-wider">
                Mode
              </span>
              <span className="text-xl font-black text-white font-mono text-shadow-neon leading-none mb-2">
                SPECTATOR
              </span>
              {spectatingStats && (
                <div className="border-t border-white/10 pt-2 mt-1">
                  <span className="text-gray-400 text-[9px] uppercase tracking-wider block mb-1">
                    Following
                  </span>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="shrink-0 w-4 h-3">
                      {renderFlag(spectatingStats.country)}
                    </div>
                    <span className="font-bold text-white text-xs truncate max-w-[80px]">
                      {spectatingStats.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-400">
                      Score:{" "}
                      <span className="text-white font-mono">
                        {spectatingStats.length}
                      </span>
                    </span>
                    <span style={{ color: themeColor }}>
                      Rank #{spectatingStats.rank}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 mt-2">
                    <button
                      onClick={() => engine.cycleSpectateTarget(-1)}
                      className="flex-1 bg-white/10 hover:bg-white/20 rounded py-1 text-xs font-bold transition-colors"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => engine.cycleSpectateTarget(1)}
                      className="flex-1 bg-white/10 hover:bg-white/20 rounded py-1 text-xs font-bold transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {myStats.name && (
                <div className="flex items-center gap-2 mb-1.5 border-b border-white/10 pb-1.5">
                  <div className="shrink-0 w-5 h-3.5">
                    {myStats.country === "WW" || myStats.country === "🌐" ? (
                      <span className="text-lg leading-none">🌐</span>
                    ) : (
                      <img
                        src={`https://flagcdn.com/w40/${myStats.country.toLowerCase()}.png`}
                        alt={myStats.country}
                        className="w-full h-full object-cover rounded shadow-sm"
                      />
                    )}
                  </div>
                  <span className="font-bold text-white text-xs truncate max-w-[80px]">
                    {myStats.name}
                  </span>
                </div>
              )}
              <div className="flex flex-col mb-1.5">
                <span className="text-gray-400 text-[9px] uppercase tracking-wider">
                  Score
                </span>
                <span className="text-xl font-black text-white font-mono text-shadow-neon leading-none">
                  {myStats.length}
                </span>
                <span
                  className="text-[10px] font-bold mt-0.5"
                  style={{ color: themeColor }}
                >
                  Rank #{myStats.rank}
                </span>
              </div>

              <div className="mt-1 pt-1 border-t border-white/10">
                <XPBar
                  level={playerData.level}
                  xp={playerData.xp}
                  xpToNext={playerData.xpToNext}
                  compact
                />
              </div>
            </>
          )}
        </div>
      </div>
      {/* Bottom Left: Removed (Moved to Leaderboard) */}
    </div>
  );
};

export default HUD;
