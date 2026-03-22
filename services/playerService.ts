import { PlayerData, LevelReward, LevelUpEvent, GameSettings } from "../types";
import { DEFAULT_GOLD, DEFAULT_SKINS, BOT_COUNT } from "./constants";
import { calculateXPForNextLevel, getLevelRewards } from "./xpService";
import { authService } from "./authService";

// Base key prefix for local fallback
const STORAGE_PREFIX = "snakeon_data_";
const SETTINGS_PREFIX = "snakeon_settings_";

const DEFAULT_DATA: PlayerData = {
  gold: DEFAULT_GOLD,
  selectedSkinId: DEFAULT_SKINS[0].id,
  unlockedSkinIds: [DEFAULT_SKINS[0].id],
  unlockedCollectibles: [],
  selectedCollectibleId: null,
  xp: 0,
  level: 1,
  xpToNext: 1000,
  highScore: 0,
  hasSeenTutorial: false,
  stats: {
    gamesPlayed: 0,
    totalKills: 0,
    longestSnake: 0,
    totalPlayTime: 0,
  }
};

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  soundVolume: 0.5,
  musicEnabled: true,
  musicVolume: 0.5,
  quality: "high",
  visualEffects: "full",
  controlScheme: "hybrid",
  sensitivity: 1.0,
  playerName: "Guest",
  botDifficulty: "medium",
  botCount: BOT_COUNT,
  gameMode: "classic",
  bossSpawnInterval: 60, // 60 seconds
  bossSizeMultiplier: 1.0,
};

export const loadSettings = async (userId: string): Promise<GameSettings> => {
  try {
    const stored = localStorage.getItem(SETTINGS_PREFIX + userId);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch (e) {
    console.warn("Failed to load settings", e);
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = async (userId: string, settings: GameSettings) => {
  try {
    localStorage.setItem(SETTINGS_PREFIX + userId, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save settings", e);
  }
};

export const loadPlayerData = async (userId: string): Promise<PlayerData> => {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + userId);
    return stored ? { ...DEFAULT_DATA, ...JSON.parse(stored) } : DEFAULT_DATA;
  } catch (e) {
    console.warn("Failed to load player data", e);
  }
  return DEFAULT_DATA;
};

export const savePlayerData = async (userId: string, data: PlayerData) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save player data", e);
  }
};

export const deletePlayerData = async (userId: string) => {
  try {
    localStorage.removeItem(STORAGE_PREFIX + userId);
  } catch (e) {
    console.warn("Failed to delete player data", e);
  }
};

export const deleteSettings = async (userId: string) => {
  try {
    localStorage.removeItem(SETTINGS_PREFIX + userId);
  } catch (e) {
    console.warn("Failed to delete settings", e);
  }
};

export const getClaimableQuestsCount = (playerData: PlayerData): number => {
  let count = 0;
  
  // Check-in
  const today = new Date().toISOString().split('T')[0];
  if (playerData.lastCheckInDate !== today) {
    count += 1;
  }
  
  // Missions
  const missions = [
    { id: 'd1', progress: 0, target: 1 }, // Hardcoded for now
    { id: 'd2', progress: 45, target: 100 },
    { id: 'l1', progress: playerData.stats?.gamesPlayed || 0, target: 100 },
    { id: 'l2', progress: playerData.gold || 0, target: 10000 },
  ];
  
  missions.forEach(m => {
    if (m.progress >= m.target && !(playerData.claimedMissions || []).includes(m.id)) {
      count += 1;
    }
  });
  
  return count;
};

// Helper to process progression 
export const processMatchProgression = async (
  userId: string,
  currentData: PlayerData, 
  score: number,
  collectedGold: number,
  matchStats?: {
    kills: number;
    length: number;
    playTime: number;
  }
): Promise<{ 
  newData: PlayerData; 
  levelUpEvents: LevelUpEvent[] 
}> => {
  const gainedXP = Math.floor(score * 0.1); 
  let newData = { 
    ...currentData,
    stats: currentData.stats ? { ...currentData.stats } : { ...DEFAULT_DATA.stats! }
  };
  
  // Add XP and Gold
  newData.xp += gainedXP;
  newData.gold += collectedGold;
  if (score > (newData.highScore || 0)) {
    newData.highScore = score;
  }

  // Update stats
  if (matchStats) {
    newData.stats.gamesPlayed += 1;
    newData.stats.totalKills += matchStats.kills;
    newData.stats.totalPlayTime += matchStats.playTime;
    if (matchStats.length > newData.stats.longestSnake) {
      newData.stats.longestSnake = matchStats.length;
    }
  }

  const levelUpEvents: LevelUpEvent[] = [];

  // Level Up Loop
  while (newData.xp >= newData.xpToNext) {
    newData.xp -= newData.xpToNext;
    newData.level += 1;
    newData.xpToNext = calculateXPForNextLevel(newData.level);
    
    const levelRewards = getLevelRewards(newData.level);
    
    // Apply rewards to data
    levelRewards.forEach(r => {
        if (r.type === "gold" && r.amount) {
          newData.gold += r.amount;
        }
        if (r.type === "skin" && r.id) {
          if (!newData.unlockedSkinIds.includes(r.id)) {
            newData.unlockedSkinIds.push(r.id);
          }
        }
    });

    levelUpEvents.push({
        level: newData.level,
        rewards: levelRewards
    });
  }

  await savePlayerData(userId, newData);
  
  return { newData, levelUpEvents };
};

export interface LeaderboardEntry {
  username: string;
  highScore: number;
  level: number;
  country: string;
}

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const entries: LeaderboardEntry[] = [];
  try {
    const users = await authService.getUsers();
    
    for (const user of users) {
        const data = await loadPlayerData(user.id);
        if (data.highScore > 0) {
            entries.push({
                username: user.username,
                highScore: data.highScore || 0,
                level: data.level || 1,
                country: user.country || 'WW'
            });
        }
    }
  } catch (e) {
    console.error("Failed to load leaderboard", e);
  }
  
  // Sort by high score descending
  return entries.sort((a, b) => b.highScore - a.highScore).slice(0, 10);
};
