export interface GlobalConfig {
  botCount: number;
  botDifficulty: 'easy' | 'medium' | 'hard' | 'nightmare';
  bossSpawnInterval: number;
  bossSizeMultiplier: number;
  loadingScreenLogoUrl: string;
  quests: any[];
  luckyWheelPrizes: any[];
  globalMessage?: string;
}

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  botCount: 20,
  botDifficulty: 'medium',
  bossSpawnInterval: 60,
  bossSizeMultiplier: 1.0,
  loadingScreenLogoUrl: '/logo.jpg',
  globalMessage: '',
  quests: [
    { id: 'd1', title: 'First Blood', description: 'Kill 1 viper today', target: 1, reward: 50, type: 'daily' },
    { id: 'd2', title: 'Glutton', description: 'Eat 100 food today', target: 100, reward: 100, type: 'daily' },
    { id: 'l1', title: 'Veteran', description: 'Play 100 games', target: 100, reward: 1000, type: 'lifetime' },
    { id: 'l2', title: 'Millionaire', description: 'Collect 10,000 gold', target: 10000, reward: 5000, type: 'lifetime' },
  ],
  luckyWheelPrizes: [
    { label: '500 Gold', type: 'gold', amount: 500, color: '#FFD700', icon: '💰' },
    { label: '0.1 TON', type: 'ton', amount: 0.1, color: '#0088CC', icon: '💎' },
    { label: '2000 Gold', type: 'gold', amount: 2000, color: '#FF8C00', icon: '💰' },
    { label: '500 XP', type: 'xp', amount: 500, color: '#FF00FF', icon: '⭐' },
    { label: '1000 Gold', type: 'gold', amount: 1000, color: '#32CD32', icon: '💰' },
    { label: '1 TON', type: 'ton', amount: 1, color: '#00AEEF', icon: '💎' },
    { label: '5000 Gold', type: 'gold', amount: 5000, color: '#FF4500', icon: '💰' },
    { label: '100 XP', type: 'xp', amount: 100, color: '#00FFFF', icon: '⭐' },
  ]
};

const CONFIG_KEY = "snakeon_global_config";
let configListeners: ((config: GlobalConfig) => void)[] = [];

export const loadGlobalConfig = async (): Promise<GlobalConfig> => {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      return { ...DEFAULT_GLOBAL_CONFIG, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn("Failed to load global config", e);
  }
  return DEFAULT_GLOBAL_CONFIG;
};

export const saveGlobalConfig = async (config: GlobalConfig) => {
  try {
    const sanitizedConfig = JSON.parse(JSON.stringify(config));
    localStorage.setItem(CONFIG_KEY, JSON.stringify(sanitizedConfig));
    configListeners.forEach(listener => listener(sanitizedConfig));
  } catch (e) {
    console.warn("Failed to save global config", e);
    throw e;
  }
};

export const listenToGlobalConfig = (callback: (config: GlobalConfig) => void) => {
  configListeners.push(callback);
  
  // Initial call
  loadGlobalConfig().then(callback);
  
  return () => {
    configListeners = configListeners.filter(l => l !== callback);
  };
};
