import React, { useState, useEffect } from "react";
import { GameSettings, PlayerData, BotDifficulty, UserProfile } from "../types";
import { audioService } from "../services/audioService";
import { authService } from "../services/authService";
import { getLeaderboard, getClaimableQuestsCount } from "../services/playerService";
import { PLAYER_COUNTRIES } from "../services/constants";
import XPBar from "./XPBar";
import CountrySelector from "./CountrySelector";
import QuestsPopup from "./QuestsPopup";

import { GlobalConfig } from '../services/globalConfigService';
import { TonConnectButton } from '@tonconnect/ui-react';

interface Props {
  onStart: (name: string) => void;
  onOpenShop: () => void;
  settings: GameSettings;
  updateSettings: (s: Partial<GameSettings>) => void;
  playerData: PlayerData;
  userCountry: string;
  onSelectCountry: (flag: string) => void;
  themeColor?: string;
  currentUser: UserProfile | null;
  onLogin: (user: UserProfile) => void;
  onLogout: () => void;
  onAdminLogin: () => void; // New callback
  onOpenLuckyWheel: () => void;
  onUpdatePlayerData: (data: PlayerData) => void;
  globalConfig: GlobalConfig;
}

const MainMenu: React.FC<Props> = ({
  onStart,
  onOpenShop,
  settings,
  updateSettings,
  playerData,
  userCountry,
  onSelectCountry,
  themeColor = "#00f3ff",
  currentUser,
  onLogin,
  onLogout,
  onAdminLogin,
  onOpenLuckyWheel,
  onUpdatePlayerData,
  globalConfig,
}) => {
  // View state: 'auth' | 'profile-completion' | 'main' | 'settings' | 'user-profile' | 'leaderboard' | 'info'
  const [view, setView] = useState<
    | "auth"
    | "profile-completion"
    | "main"
    | "settings"
    | "user-profile"
    | "leaderboard"
    | "info"
  >("auth");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Auth inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  // Date of Birth state
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editUsernameInput, setEditUsernameInput] = useState("");
  const [editUsernameError, setEditUsernameError] = useState("");

  const [error, setError] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [hasUnseenQuests, setHasUnseenQuests] = useState(false);
  const [infoLang, setInfoLang] = useState<"ka" | "en" | "ru">("en");

  // Check for unseen quests or claimable rewards
  useEffect(() => {
    if (!currentUser) return;
    const count = getClaimableQuestsCount(playerData);
    const storageKey = `quests_last_seen_${currentUser.id}`;
    const lastSeenStr = localStorage.getItem(storageKey);
    const lastSeenCount = lastSeenStr ? parseInt(lastSeenStr, 10) : -1;
    
    if (count > lastSeenCount) {
      setHasUnseenQuests(true);
    } else if (count < lastSeenCount) {
      localStorage.setItem(storageKey, count.toString());
    }
  }, [playerData, currentUser]);

  // Strict check for profile completeness
  useEffect(() => {
    if (currentUser) {
      const isProfileComplete =
        currentUser.username &&
        currentUser.username.trim() !== "" &&
        currentUser.dob &&
        currentUser.dob.day &&
        currentUser.dob.year &&
        currentUser.gender;

      if (!isProfileComplete) {
        setView("profile-completion");
      } else {
        setView("main");
      }
    } else {
      setView("auth");
    }
  }, [currentUser]);

  useEffect(() => {
    if (view === "leaderboard") {
      setIsLeaderboardLoading(true);
      getLeaderboard().then(data => {
        setLeaderboardData(data);
        setIsLeaderboardLoading(false);
      }).catch(err => {
        console.error("Failed to load leaderboard", err);
        setIsLeaderboardLoading(false);
      });
    }
  }, [view]);

  const handleStart = () => {
    audioService.playClick();
    updateSettings({ playerName: currentUser?.username || "Guest" });
    onStart(currentUser?.username || "Guest");
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (authMode === "login") {
      if (!password) {
        setError("Password required");
        return;
      }
      const res = await authService.login(email, password);
      if (res.success && res.user) {
        onLogin(res.user);
      } else {
        setError(res.message);
      }
    } else {
      // Register validation
      if (!username) {
        setError("Username required");
        return;
      }
      if (!password) {
        setError("Password required");
        return;
      }
      if (!dobDay || !dobMonth || !dobYear) {
        setError("Date of birth required");
        return;
      }
      if (!gender) {
        setError("Gender required");
        return;
      }

      const res = await authService.register(
        email,
        username,
        password,
        {
          day: dobDay,
          month: dobMonth,
          year: dobYear,
        },
        gender as any,
      );

      if (res.success && res.user) {
        onLogin(res.user);
      } else {
        setError(res.message);
      }
    }
  };

  const handleSaveUsername = async () => {
    if (!currentUser) return;
    const newName = editUsernameInput.trim();
    if (!newName) {
      setEditUsernameError("Username cannot be empty");
      return;
    }
    if (newName.length > 12) {
      setEditUsernameError("Username max 12 chars");
      return;
    }
    if (newName === currentUser.username) {
      setIsEditingUsername(false);
      return;
    }

    const updatedUser = await authService.updateUser(currentUser.id, { username: newName });
    if (updatedUser) {
      onLogin(updatedUser); // Update currentUser in App.tsx
      setIsEditingUsername(false);
      setEditUsernameError("");
    } else {
      setEditUsernameError("Username already taken");
    }
  };

  const handleGoogleLogin = async () => {
    audioService.playClick();
    setIsGoogleLoading(true);
    try {
      const res = await authService.loginWithGoogle();
      if (res.success && res.user) {
        onLogin(res.user);
      } else {
        if (res.message !== "Login cancelled") {
          setError(res.message);
        }
      }
    } catch (e) {
      setError("Connection Error");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleProfileCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!username.trim()) {
      setError("Username required");
      return;
    }
    if (!dobDay || !dobMonth || !dobYear) {
      setError("Date of birth required");
      return;
    }
    if (!gender) {
      setError("Gender required");
      return;
    }

    const updatedUser = await authService.updateUser(currentUser.id, {
      username,
      dob: { day: dobDay, month: dobMonth, year: dobYear },
      gender: gender as any,
    });

    if (updatedUser) {
      onLogin(updatedUser); // This updates state and triggers useEffect -> switches to 'main'
    } else {
      setError("Username is already taken.");
    }
  };

  const getFlagContent = () => {
    const code = userCountry.toLowerCase();
    if (code === "ww") return <span className="text-2xl">🌐</span>;
    return (
      <img
        src={`https://flagcdn.com/w80/${code}.png`}
        alt={userCountry}
        className="w-8 h-auto object-cover rounded shadow-sm"
      />
    );
  };

  // Helper to render Avatar or Fallback
  const renderAvatar = (
    sizeClass: string = "w-20 h-20",
    textClass: string = "text-3xl",
  ) => {
    if (currentUser?.picture) {
      return (
        <img
          src={currentUser.picture}
          alt="Profile"
          className={`${sizeClass} rounded-full border-2 object-cover bg-black`}
          style={{ borderColor: themeColor }}
        />
      );
    }
    return (
      <div
        className={`${sizeClass} rounded-full bg-gradient-to-tr from-gray-800 to-gray-700 border-2 flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)]`}
        style={{ borderColor: themeColor }}
      >
        <span className={textClass}>👨‍🚀</span>
      </div>
    );
  };

  const cyberBtnStyle = {
    clipPath: "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)",
  };

  // Styles
  const inputStyle =
    "w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-neon-blue focus:outline-none mb-3";
  const labelStyle =
    "block text-xs text-gray-400 uppercase font-bold mb-1 ml-1";

  return (
    <div className="absolute inset-0 z-50 bg-dark-bg/90 backdrop-blur-sm overflow-y-auto custom-scrollbar">
      {globalConfig.globalMessage && globalConfig.globalMessage.trim() !== '' && (
        <div className="fixed top-0 left-0 w-full bg-red-600/90 text-white text-sm font-bold py-2 px-4 text-center z-[100] border-b border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.5)] flex items-center justify-center gap-2">
          <span className="animate-pulse">⚠️</span>
          <span>{globalConfig.globalMessage}</span>
          <span className="animate-pulse">⚠️</span>
        </div>
      )}
      <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-8">
        <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
          <div
            className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"
            style={{ backgroundColor: themeColor }}
          ></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500 rounded-full mix-blend-screen filter blur-[100px] animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center w-full max-w-md py-8">
        <div className="mb-6 text-center group cursor-default">
          <h1
            className="text-6xl md:text-7xl font-black italic text-transparent bg-clip-text drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] tracking-wide transform -skew-x-6 transition-transform duration-500 group-hover:skew-x-0 group-hover:scale-105"
            style={{
              backgroundImage: `linear-gradient(to right, ${themeColor}, #ffffff, #bd00ff)`,
            }}
          >
            VIPER
          </h1>
          <p
            className="tracking-widest font-mono mt-2 text-shadow-neon animate-pulse"
            style={{ color: themeColor }}
          >
            SPACE ARENA
          </p>
        </div>

        {/* AUTH VIEW */}
        {view === "auth" && (
          <div
            className="w-full glass-panel p-8 rounded-2xl animate-in zoom-in-95 duration-300"
            style={{ borderColor: `${themeColor}40` }}
          >
            <h2 className="text-xl font-bold text-white mb-6 text-center uppercase tracking-widest">
              {authMode === "login" ? "Login" : "New Account"}
            </h2>

            <form onSubmit={handleAuthSubmit}>
              <div>
                <label className={labelStyle}>{authMode === "login" ? "Email or Username" : "Email"}</label>
                <input
                  type={authMode === "register" ? "email" : "text"}
                  placeholder="pilot@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputStyle}
                  required
                />
              </div>

              {authMode === "register" && (
                <div>
                  <label className={labelStyle}>Callsign (Username)</label>
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputStyle}
                    required
                    maxLength={12}
                  />
                </div>
              )}

              <div>
                <label className={labelStyle}>Password</label>
                <input
                  type="password"
                  placeholder="******"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputStyle}
                  required
                />
              </div>

              {authMode === "register" && (
                <>
                  <div className="mb-3">
                    <label className={labelStyle}>Date of Birth</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="DD"
                        min="1"
                        max="31"
                        value={dobDay}
                        onChange={(e) => setDobDay(e.target.value)}
                        className={`${inputStyle} mb-0`}
                        required
                      />
                      <select
                        value={dobMonth}
                        onChange={(e) => setDobMonth(e.target.value)}
                        className={`${inputStyle} mb-0`}
                        required
                      >
                        <option value="" disabled>
                          MM
                        </option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i} value={i + 1}>
                            {new Date(0, i).toLocaleString("default", {
                              month: "short",
                            })}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="YYYY"
                        min="1900"
                        max={new Date().getFullYear()}
                        value={dobYear}
                        onChange={(e) => setDobYear(e.target.value)}
                        className={`${inputStyle} mb-0`}
                        required
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className={labelStyle}>Gender</label>
                    <div className="flex gap-2">
                      {["male", "female", "other"].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g as any)}
                          className={`flex-1 py-2 rounded border ${
                            gender === g
                              ? `bg-white/20 border-${themeColor} text-white`
                              : "bg-black/50 border-white/10 text-gray-500"
                          } uppercase text-xs font-bold transition-all`}
                          style={{
                            borderColor: gender === g ? themeColor : "",
                          }}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Terms Simulation */}
                  <div className="text-[10px] text-gray-500 mb-4 text-center">
                    By registering, you agree to our Terms of Service.
                  </div>
                </>
              )}

              {error && (
                <p className="text-red-500 text-sm mb-3 font-bold text-center bg-red-500/10 py-2 rounded">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-lg font-bold text-black uppercase tracking-widest transition-transform hover:scale-[1.02] mb-4 shadow-lg mt-2"
                style={{
                  background: `linear-gradient(to right, ${themeColor}, #bd00ff)`,
                }}
                onClick={() => audioService.playClick()}
              >
                {authMode === "login" ? "ENTER" : "REGISTER"}
              </button>
            </form>

            <div className="relative flex py-2 items-center mb-4">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase">
                Or
              </span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* CYBERPUNK GOOGLE BUTTON - MONOCHROME & GLOWING */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="relative group w-full py-3 bg-[#0a0a0a] border border-neon-blue/40 rounded-lg overflow-hidden transition-all hover:border-neon-blue hover:shadow-[0_0_20px_rgba(0,243,255,0.6)] flex items-center justify-center gap-3 mb-4"
            >
              <div className="absolute inset-0 bg-neon-blue/5 group-hover:bg-neon-blue/10 transition-colors duration-300"></div>

              {isGoogleLoading ? (
                <span className="animate-pulse text-neon-blue font-bold relative z-10 uppercase text-xs tracking-widest">
                  Connecting...
                </span>
              ) : (
                <>
                  {/* Monochrome Google 'G' Icon (White fill) */}
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 relative z-10">
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="text-white w-full h-full"
                    >
                      <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
                    </svg>
                  </div>
                  <span className="text-white text-sm font-bold tracking-wide relative z-10 group-hover:text-neon-blue transition-colors uppercase">
                    Sign in with Google
                  </span>
                </>
              )}
            </button>

            <div className="text-center">
              <button
                onClick={() => {
                  audioService.playClick();
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setError("");
                }}
                className="text-sm text-gray-400 hover:text-white underline"
              >
                {authMode === "login"
                  ? "Need an account? Register"
                  : "Have an account? Login"}
              </button>
            </div>
          </div>
        )}

        {/* PROFILE COMPLETION VIEW (AFTER GOOGLE LOGIN) */}
        {view === "profile-completion" && (
          <div
            className="w-full glass-panel p-8 rounded-2xl animate-in zoom-in-95 duration-300"
            style={{ borderColor: `${themeColor}40` }}
          >
            <h2 className="text-xl font-bold text-white mb-2 text-center uppercase tracking-widest">
              Complete Profile
            </h2>
            <p className="text-xs text-center text-gray-400 mb-6">
              Google provided your email, but we need your pilot details to
              continue.
            </p>

            <form onSubmit={handleProfileCompletion}>
              <div>
                <label className={labelStyle}>Choose Username</label>
                <input
                  type="text"
                  placeholder="Callsign"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputStyle}
                  required
                  maxLength={12}
                />
              </div>

              <div className="mb-3">
                <label className={labelStyle}>Date of Birth</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="DD"
                    min="1"
                    max="31"
                    value={dobDay}
                    onChange={(e) => setDobDay(e.target.value)}
                    className={`${inputStyle} mb-0`}
                    required
                  />
                  <select
                    value={dobMonth}
                    onChange={(e) => setDobMonth(e.target.value)}
                    className={`${inputStyle} mb-0`}
                    required
                  >
                    <option value="" disabled>
                      MM
                    </option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {new Date(0, i).toLocaleString("default", {
                          month: "short",
                        })}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="YYYY"
                    min="1900"
                    max={new Date().getFullYear()}
                    value={dobYear}
                    onChange={(e) => setDobYear(e.target.value)}
                    className={`${inputStyle} mb-0`}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className={labelStyle}>Gender</label>
                <div className="flex gap-2">
                  {["male", "female", "other"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g as any)}
                      className={`flex-1 py-2 rounded border ${
                        gender === g
                          ? `bg-white/20 border-${themeColor} text-white`
                          : "bg-black/50 border-white/10 text-gray-500"
                      } uppercase text-xs font-bold transition-all`}
                      style={{ borderColor: gender === g ? themeColor : "" }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm mb-3 font-bold text-center">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-lg font-bold text-black uppercase tracking-widest shadow-lg"
                style={{
                  background: `linear-gradient(to right, ${themeColor}, #bd00ff)`,
                }}
                onClick={() => audioService.playClick()}
              >
                FINISH SETUP
              </button>
            </form>
          </div>
        )}

        {/* MAIN MENU VIEW */}
        {view === "main" && currentUser && (
          <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-8 duration-500">
            
            {/* Floating Action Buttons (Right Side of Screen) */}
            <div className="fixed safe-top-4 right-4 md:right-8 flex flex-col gap-4 z-50">
              {/* Quests/Daily Check-in Floating Button */}
              <button
                onClick={() => {
                  audioService.playClick();
                  setShowQuests(true);
                  setHasUnseenQuests(false); // Mark as seen when opened
                  if (currentUser) {
                    const count = getClaimableQuestsCount(playerData);
                    localStorage.setItem(`quests_last_seen_${currentUser.id}`, count.toString());
                  }
                }}
                className={`w-14 h-14 rounded-full bg-black border-2 flex items-center justify-center shadow-[0_0_15px_rgba(255,215,0,0.5)] hover:scale-110 transition-transform ${hasUnseenQuests ? "animate-bounce" : ""}`}
                style={{ borderColor: themeColor }}
                title="Daily Quests & Check-in"
              >
                <span className="text-4xl drop-shadow-[0_0_5px_rgba(255,255,255,0.8)] leading-none flex items-center justify-center w-full h-full">
                  🎯
                </span>
                {hasUnseenQuests && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-black animate-pulse"></div>
                )}
              </button>

              {/* Lucky Wheel Floating Button */}
              <button
                onClick={() => {
                  audioService.playClick();
                  onOpenLuckyWheel();
                }}
                className="w-14 h-14 rounded-full bg-black border-2 flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.5)] hover:scale-110 transition-transform"
                style={{ borderColor: themeColor }}
                title="Lucky Wheel"
              >
                <span className="text-4xl drop-shadow-[0_0_5px_rgba(255,255,255,0.8)] leading-none flex items-center justify-center w-full h-full">
                  🎡
                </span>
              </button>
            </div>

            {/* Player Stats Card */}
            <div
              className="w-full mb-6 bg-black/40 p-4 rounded-2xl border shadow-lg transition-colors relative"
              style={{ borderColor: `${themeColor}30` }}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  {/* AVATAR DISPLAY IN HEADER */}
                  <div className="w-10 h-10 shrink-0">
                    {renderAvatar("w-10 h-10", "text-lg")}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase">
                      Pilot
                    </span>
                    <span className="font-bold text-white text-lg leading-tight">
                      {currentUser.username}
                    </span>
                    {currentUser.telegramUsername && (
                      <span className="text-xs text-blue-400 font-mono tracking-wider font-bold">
                        {currentUser.telegramUsername}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  <span className="font-mono font-bold text-neon-yellow text-xl text-shadow-neon">
                    {playerData.gold}
                  </span>
                </div>
              </div>
              <XPBar
                level={playerData.level}
                xp={playerData.xp}
                xpToNext={playerData.xpToNext}
              />
            </div>
            
            <div className="w-full flex justify-center mb-4">
              <TonConnectButton />
            </div>

            <div className="flex items-center gap-2 w-full max-w-[300px] sm:max-w-xs mb-4 transform transition-all z-20">
              <button
                onClick={() => setShowCountrySelector(true)}
                className="w-16 h-14 flex items-center justify-center bg-black/60 border-b-2 transition-all rounded-lg overflow-hidden hover:bg-white/10"
                style={{ borderColor: themeColor }}
                title="Change Region"
              >
                {getFlagContent()}
              </button>

              {/* View Profile Button */}
              <button
                onClick={() => {
                  audioService.playClick();
                  setView("user-profile");
                }}
                className="flex-1 h-14 bg-black/60 border-b-2 border-white/20 hover:border-white/50 text-white hover:bg-white/5 rounded-lg font-bold text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <span>👤</span> PROFILE
              </button>
            </div>

            {/* PLAY BUTTON */}
            <button
              onClick={handleStart}
              className="w-full max-w-[300px] sm:max-w-xs h-16 mb-4 relative group focus:outline-none"
            >
              <div
                className="absolute inset-0 rounded-xl blur opacity-60 group-hover:opacity-100 group-hover:blur-md transition-all duration-300 animate-pulse"
                style={{
                  background: `linear-gradient(to right, ${themeColor}, #bd00ff)`,
                }}
              ></div>
              <div
                className="relative h-full bg-black/80 border border-white/20 flex items-center justify-center gap-3 transition-all duration-300 group-hover:scale-[1.05] group-active:scale-95"
                style={{
                  ...cyberBtnStyle,
                  boxShadow: `inset 0 0 0px ${themeColor}`,
                }}
              >
                <span
                  className="text-2xl font-black italic text-white tracking-widest drop-shadow-md transition-all duration-300 group-hover:tracking-[0.15em]"
                  style={{ textShadow: `0 0 10px ${themeColor}` }}
                >
                  PLAY ONLINE
                </span>
              </div>
            </button>

            {/* SHOP BUTTON */}
            <button
              onClick={() => {
                audioService.playClick();
                onOpenShop();
              }}
              className="w-full max-w-[300px] sm:max-w-xs h-14 mb-3 relative group focus:outline-none transition-transform duration-300 hover:scale-[1.05]"
            >
              <div
                className="relative h-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300"
                style={{
                  ...cyberBtnStyle,
                  borderColor: `rgba(255,255,255,0.1)`,
                }}
              >
                <div
                  className="absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100"
                  style={{
                    border: `1px solid ${themeColor}`,
                    boxShadow: `0 0 15px ${themeColor}`,
                  }}
                />
                <div className="flex items-center justify-center h-full">
                  <span className="font-bold text-xl uppercase tracking-wider text-white group-hover:tracking-[0.2em] transition-all duration-300 drop-shadow-md group-hover:text-white">
                    SHOP
                  </span>
                </div>
              </div>
            </button>

            {/* SPECTATE BUTTON */}
            <button
              onClick={() => {
                audioService.playClick();
                onStart("Spectator");
              }}
              className="w-full max-w-[300px] sm:max-w-xs h-14 mb-3 relative group focus:outline-none transition-transform duration-300 hover:scale-[1.05]"
            >
              <div
                className="relative h-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300"
                style={{
                  ...cyberBtnStyle,
                  borderColor: `rgba(255,255,255,0.1)`,
                }}
              >
                <div
                  className="absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100"
                  style={{
                    border: `1px solid ${themeColor}`,
                    boxShadow: `0 0 15px ${themeColor}`,
                  }}
                />
                <div className="flex items-center justify-center h-full">
                  <span className="font-bold text-xl uppercase tracking-wider text-white group-hover:tracking-[0.2em] transition-all duration-300 drop-shadow-md group-hover:text-white">
                    SPECTATE
                  </span>
                </div>
              </div>
            </button>

            {/* LEADERBOARD BUTTON */}
            <button
              onClick={() => {
                audioService.playClick();
                setView("leaderboard");
              }}
              className="w-64 h-14 mb-3 relative group focus:outline-none transition-transform duration-300 hover:scale-[1.05]"
            >
              <div
                className="relative h-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300"
                style={{
                  ...cyberBtnStyle,
                  borderColor: `rgba(255,255,255,0.1)`,
                }}
              >
                <div
                  className="absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100"
                  style={{
                    border: `1px solid ${themeColor}`,
                    boxShadow: `0 0 15px ${themeColor}`,
                  }}
                />
                <div className="flex items-center justify-center h-full">
                  <span className="font-bold text-xl uppercase tracking-wider text-white group-hover:tracking-[0.2em] transition-all duration-300 drop-shadow-md group-hover:text-white">
                    LEADERBOARD
                  </span>
                </div>
              </div>
            </button>

            {/* SETTINGS BUTTON */}
            <button
              onClick={() => {
                audioService.playClick();
                setView("settings");
              }}
              className="w-64 h-14 mb-3 relative group focus:outline-none transition-transform duration-300 hover:scale-[1.05]"
            >
              <div
                className="relative h-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300"
                style={cyberBtnStyle}
              >
                <div
                  className="absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100"
                  style={{
                    border: `1px solid ${themeColor}`,
                    boxShadow: `0 0 15px ${themeColor}`,
                  }}
                />
                <div className="flex items-center justify-center h-full">
                  <span className="font-bold text-xl uppercase tracking-wider text-white group-hover:tracking-[0.2em] transition-all duration-300 drop-shadow-md">
                    SETTINGS
                  </span>
                </div>
              </div>
            </button>

            {/* INFO BUTTON */}
            <button
              onClick={() => {
                audioService.playClick();
                setView("info");
              }}
              className="w-64 h-14 mb-3 relative group focus:outline-none transition-transform duration-300 hover:scale-[1.05]"
            >
              <div
                className="relative h-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300"
                style={cyberBtnStyle}
              >
                <div
                  className="absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100"
                  style={{
                    border: `1px solid ${themeColor}`,
                    boxShadow: `0 0 15px ${themeColor}`,
                  }}
                />
                <div className="flex items-center justify-center h-full">
                  <span className="font-bold text-xl uppercase tracking-wider text-white group-hover:tracking-[0.2em] transition-all duration-300 drop-shadow-md">
                    INFO
                  </span>
                </div>
              </div>
            </button>

            {/* ADMIN PANEL BUTTON */}
            {authService.isAdmin(currentUser.email) && (
              <button
                onClick={() => {
                  audioService.playClick();
                  onAdminLogin();
                }}
                className="w-64 h-14 relative group focus:outline-none transition-transform duration-300 hover:scale-[1.05]"
              >
                <div
                  className="relative h-full bg-red-900/30 border border-red-500/50 hover:bg-red-900/50 transition-all duration-300"
                  style={cyberBtnStyle}
                >
                  <div
                    className="absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100"
                    style={{
                      border: `1px solid #ff0000`,
                      boxShadow: `0 0 15px #ff0000`,
                    }}
                  />
                  <div className="flex items-center justify-center h-full">
                    <span className="font-bold text-xl uppercase tracking-wider text-red-500 group-hover:tracking-[0.2em] transition-all duration-300 drop-shadow-md">
                      ADMIN PANEL
                    </span>
                  </div>
                </div>
              </button>
            )}

            {/* Logout Link */}
            <button
              onClick={onLogout}
              className="mt-4 text-red-400/50 hover:text-red-400 text-xs font-bold uppercase tracking-widest hover:underline"
            >
              Log Out
            </button>
          </div>
        )}

        {/* QUESTS POPUP */}
        {showQuests && (
          <QuestsPopup
            onClose={() => setShowQuests(false)}
            themeColor={themeColor}
            playerData={playerData}
            onUpdatePlayerData={onUpdatePlayerData}
            globalConfig={globalConfig}
          />
        )}

        {/* USER PROFILE VIEW */}
        {view === "user-profile" && currentUser && (
          <div
            className="w-full relative glass-panel p-6 rounded-2xl animate-in fade-in zoom-in-95 duration-300 border shadow-[0_0_30px_rgba(0,0,0,0.5)]"
            style={{ borderColor: `${themeColor}40` }}
          >
            <button
              onClick={() => {
                audioService.playClick();
                setView("main");
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/80 flex items-center justify-center transition-colors font-bold text-white z-10"
            >
              ✕
            </button>
            <div className="text-center mb-6">
              <div className="mx-auto mb-3">
                {renderAvatar("w-24 h-24", "text-4xl")}
              </div>
              
              {isEditingUsername ? (
                <div className="flex flex-col items-center justify-center gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editUsernameInput}
                      onChange={(e) => setEditUsernameInput(e.target.value)}
                      className="bg-black/50 border border-white/20 rounded px-3 py-1 text-white text-center focus:border-neon-blue focus:outline-none"
                      maxLength={12}
                      autoFocus
                    />
                    <button 
                      onClick={handleSaveUsername}
                      className="bg-green-500/20 text-green-400 hover:bg-green-500/40 px-3 py-1 rounded font-bold text-sm transition-colors"
                    >
                      SAVE
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditingUsername(false);
                        setEditUsernameError("");
                      }}
                      className="bg-red-500/20 text-red-400 hover:bg-red-500/40 px-3 py-1 rounded font-bold text-sm transition-colors"
                    >
                      CANCEL
                    </button>
                  </div>
                  {editUsernameError && <p className="text-red-500 text-xs font-bold">{editUsernameError}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-white uppercase tracking-wider mb-0 leading-none">
                      {currentUser.username}
                    </h2>
                    {currentUser.telegramUsername && (
                      <span className="text-sm text-blue-400 font-mono text-center">
                        {currentUser.telegramUsername}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      setEditUsernameInput(currentUser.username);
                      setIsEditingUsername(true);
                      setEditUsernameError("");
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Edit Username"
                  >
                    ✏️
                  </button>
                </div>
              )}

              <p className="text-xs text-neon-blue uppercase font-bold tracking-widest">
                Level {playerData.level} Pilot
              </p>
            </div>

            <div className="space-y-4 mb-6 bg-black/30 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Email
                </span>
                <span className="text-gray-300 text-sm">
                  {currentUser.email}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Location
                </span>
                <span className="text-gray-300 text-sm">
                  {currentUser.city && currentUser.country
                    ? `${currentUser.city}, ${currentUser.country}`
                    : "Unknown"}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Date of Birth
                </span>
                <span className="text-gray-300 text-sm">
                  {currentUser.dob
                    ? `${currentUser.dob.day}/${currentUser.dob.month}/${currentUser.dob.year}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Gender
                </span>
                <span className="text-gray-300 text-sm capitalize">
                  {currentUser.gender || "Unknown"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Member Since
                </span>
                <span className="text-gray-300 text-sm">
                  {new Date(currentUser.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-6 bg-black/30 p-4 rounded-xl border border-white/5">
              <h3 className="text-neon-blue text-sm uppercase font-bold tracking-widest mb-2 border-b border-white/10 pb-2">
                Game Statistics
              </h3>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Games Played
                </span>
                <span className="text-gray-300 text-sm">
                  {playerData.stats?.gamesPlayed || 0}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Total Kills
                </span>
                <span className="text-gray-300 text-sm">
                  {playerData.stats?.totalKills || 0}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Longest Viper
                </span>
                <span className="text-gray-300 text-sm">
                  {Math.floor(playerData.stats?.longestSnake || 0)}"
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Total Play Time
                </span>
                <span className="text-gray-300 text-sm">
                  {Math.floor((playerData.stats?.totalPlayTime || 0) / 60)} mins
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                audioService.playClick();
                setView("main");
              }}
              className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg font-bold tracking-widest transition-all hover:text-white hover:border-white"
            >
              BACK
            </button>
          </div>
        )}

        {view === "leaderboard" && (
          <div
            className="w-full relative glass-panel p-6 rounded-2xl animate-in fade-in zoom-in-95 duration-300 border shadow-[0_0_30px_rgba(0,0,0,0.5)]"
            style={{ borderColor: `${themeColor}40` }}
          >
            <button
              onClick={() => {
                audioService.playClick();
                setView("main");
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/80 flex items-center justify-center transition-colors font-bold text-white z-10"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-6 text-center text-white tracking-wider border-b border-white/10 pb-4">
              LEADERBOARD
            </h2>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by username..."
                value={leaderboardSearch}
                onChange={(e) => setLeaderboardSearch(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-white/30 transition-colors placeholder:text-gray-600"
              />
            </div>

            <div className="space-y-2 mb-8 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {isLeaderboardLoading ? (
                <div className="text-center text-gray-500 py-8 italic">
                  Loading leaderboard...
                </div>
              ) : (() => {
                const filteredLeaderboard = leaderboardData.filter((entry) =>
                  entry.username.toLowerCase().includes(leaderboardSearch.toLowerCase())
                );

                if (filteredLeaderboard.length === 0) {
                  return (
                    <div className="text-center text-gray-500 py-8 italic">
                      {leaderboardData.length === 0 ? "No scores yet. Be the first!" : "No results found."}
                    </div>
                  );
                }

                return filteredLeaderboard.map((entry, idx) => {
                  // Find actual rank in the full leaderboard
                  const actualRank = leaderboardData.findIndex(e => e.id === entry.id) + 1;
                  
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-bold w-6 text-center ${actualRank === 1 ? "text-yellow-400" : actualRank === 2 ? "text-gray-300" : actualRank === 3 ? "text-amber-600" : "text-gray-500"}`}
                        >
                          #{actualRank}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-white">
                            {entry.username}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest">
                            Level {entry.level}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className="font-mono font-bold text-lg"
                          style={{ color: themeColor }}
                        >
                          {entry.highScore}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <button
              onClick={() => {
                audioService.playClick();
                setView("main");
              }}
              className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg font-bold tracking-widest transition-all hover:text-white hover:border-white"
            >
              BACK
            </button>
          </div>
        )}

        {view === "settings" && (
          <div
            className="w-full relative glass-panel p-6 rounded-2xl animate-in fade-in zoom-in-95 duration-300 border shadow-[0_0_30px_rgba(0,0,0,0.5)]"
            style={{ borderColor: `${themeColor}40` }}
          >
            <button
              onClick={() => {
                audioService.playClick();
                setView("main");
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/80 flex items-center justify-center transition-colors font-bold text-white z-10"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-6 text-center text-white tracking-wider border-b border-white/10 pb-4">
              SETTINGS
            </h2>

            <div className="space-y-6 mb-8">
              <div className="flex justify-between items-center p-2 hover:bg-white/5 rounded-lg transition-colors">
                <span className="font-bold text-gray-200">Sound Effects</span>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.soundVolume}
                    onChange={(e) =>
                      updateSettings({
                        soundVolume: parseFloat(e.target.value),
                      })
                    }
                    className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: themeColor }}
                  />
                  <button
                    onClick={() => {
                      const newState = !settings.soundEnabled;
                      updateSettings({ soundEnabled: newState });
                      audioService.setEnabled(newState);
                      audioService.playClick();
                    }}
                    className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${settings.soundEnabled ? "bg-green-500" : "bg-gray-700"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${settings.soundEnabled ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center p-2 hover:bg-white/5 rounded-lg transition-colors">
                <span className="font-bold text-gray-200">Music</span>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.musicVolume}
                    onChange={(e) =>
                      updateSettings({
                        musicVolume: parseFloat(e.target.value),
                      })
                    }
                    className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: themeColor }}
                  />
                  <button
                    onClick={() => {
                      const newState = !settings.musicEnabled;
                      updateSettings({ musicEnabled: newState });
                      audioService.setMusicEnabled(newState);
                      audioService.playClick();
                    }}
                    className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${settings.musicEnabled ? "bg-green-500" : "bg-gray-700"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${settings.musicEnabled ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>
              </div>

              <div className="space-y-2 p-2 hover:bg-white/5 rounded-lg transition-colors">
                <span className="text-sm text-gray-400 font-bold uppercase block">
                  Visual Effects
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(["minimal", "full"] as const).map((fx) => (
                    <button
                      key={fx}
                      onClick={() => updateSettings({ visualEffects: fx })}
                      className={`px-2 py-2 rounded text-xs font-bold uppercase border transition-all ${
                        settings.visualEffects === fx
                          ? "bg-neon-blue/20 text-neon-blue border-neon-blue"
                          : "bg-black/40 text-gray-500 border-white/5 hover:bg-white/5"
                      }`}
                      style={{
                        borderColor:
                          settings.visualEffects === fx
                            ? themeColor
                            : undefined,
                        color:
                          settings.visualEffects === fx
                            ? themeColor
                            : undefined,
                        backgroundColor:
                          settings.visualEffects === fx
                            ? `${themeColor}20`
                            : undefined,
                      }}
                    >
                      {fx}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 p-2 hover:bg-white/5 rounded-lg transition-colors">
                <span className="text-sm text-gray-400 font-bold uppercase block">
                  Control Scheme
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(["mouse", "joystick", "hybrid"] as const).map((scheme) => (
                    <button
                      key={scheme}
                      onClick={() => updateSettings({ controlScheme: scheme })}
                      className={`px-2 py-2 rounded text-xs font-bold uppercase border transition-all ${
                        settings.controlScheme === scheme
                          ? "bg-neon-blue/20 text-neon-blue border-neon-blue"
                          : "bg-black/40 text-gray-500 border-white/5 hover:bg-white/5"
                      }`}
                      style={{
                        borderColor:
                          settings.controlScheme === scheme
                            ? themeColor
                            : undefined,
                        color:
                          settings.controlScheme === scheme
                            ? themeColor
                            : undefined,
                        backgroundColor:
                          settings.controlScheme === scheme
                            ? `${themeColor}20`
                            : undefined,
                      }}
                    >
                      {scheme}
                    </button>
                  ))}
                </div>
              </div>

              {/* GAME MODE */}
              <div className="space-y-2 p-2 hover:bg-white/5 rounded-lg transition-colors">
                <span className="text-sm text-gray-400 font-bold uppercase block">
                  Game Mode
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      "classic",
                      "survival",
                      "time-attack",
                      "free-for-all",
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateSettings({ gameMode: mode })}
                      className={`px-2 py-2 rounded text-xs font-bold uppercase border transition-all ${
                        settings.gameMode === mode
                          ? "bg-neon-blue/20 text-neon-blue border-neon-blue"
                          : "bg-black/40 text-gray-500 border-white/5 hover:bg-white/5"
                      }`}
                      style={{
                        borderColor:
                          settings.gameMode === mode ? themeColor : undefined,
                        color:
                          settings.gameMode === mode ? themeColor : undefined,
                        backgroundColor:
                          settings.gameMode === mode
                            ? `${themeColor}20`
                            : undefined,
                      }}
                    >
                      {mode.replace("-", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* BOT DIFFICULTY */}
              <div className="space-y-2 p-2 hover:bg-white/5 rounded-lg transition-colors">
                <span className="text-sm text-gray-400 font-bold uppercase block">
                  Bot Difficulty
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    ["easy", "medium", "hard", "nightmare"] as BotDifficulty[]
                  ).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => updateSettings({ botDifficulty: diff })}
                      className={`px-2 py-2 rounded text-xs font-bold uppercase border transition-all ${
                        settings.botDifficulty === diff
                          ? "bg-neon-blue/20 text-neon-blue border-neon-blue"
                          : "bg-black/40 text-gray-500 border-white/5 hover:bg-white/5"
                      }`}
                      style={{
                        borderColor:
                          settings.botDifficulty === diff
                            ? themeColor
                            : undefined,
                        color:
                          settings.botDifficulty === diff
                            ? themeColor
                            : undefined,
                        backgroundColor:
                          settings.botDifficulty === diff
                            ? `${themeColor}20`
                            : undefined,
                      }}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                audioService.playClick();
                setView("main");
              }}
              className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg font-bold tracking-widest transition-all hover:text-white hover:border-white"
            >
              BACK
            </button>
          </div>
        )}

        {/* INFO VIEW */}
        {view === "info" && (
          <div
            className="w-full max-w-3xl glass-panel p-6 md:p-8 rounded-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden"
            style={{ borderColor: `${themeColor}50`, boxShadow: `0 0 30px ${themeColor}20` }}
          >
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" style={{ backgroundImage: `linear-gradient(to bottom, ${themeColor}20, transparent)` }}></div>

            <button
              onClick={() => {
                audioService.playClick();
                setView("main");
              }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/5 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all hover:scale-110 hover:rotate-90 z-20"
              style={{ color: themeColor, boxShadow: `0 0 10px ${themeColor}40` }}
            >
              ✕
            </button>

            <div className="flex justify-start mb-6 relative z-10">
              {/* Language Selector */}
              <div className="flex bg-black/50 rounded-lg p-1 border border-white/10">
                {(['en', 'ka', 'ru'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => {
                      audioService.playClick();
                      setInfoLang(lang);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${infoLang === lang ? 'bg-white/20 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    {lang === 'en' ? 'EN' : lang === 'ka' ? 'GE' : 'RU'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6 text-gray-300 text-sm leading-relaxed relative z-10">
              
              {/* HOW TO PLAY */}
              <section className="bg-black/40 border border-white/10 p-5 rounded-xl hover:border-white/20 transition-colors relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full transition-all duration-300 group-hover:w-2" style={{ backgroundColor: themeColor }}></div>
                <h3 className="text-lg font-bold text-white mb-3 uppercase tracking-wide flex items-center gap-2">
                  <span>🎮</span> {infoLang === 'ka' ? 'როგორ ვითამაშოთ' : infoLang === 'en' ? 'HOW TO PLAY' : 'КАК ИГРАТЬ'}
                </h3>
                <p className="text-gray-400 text-base leading-relaxed">
                  {infoLang === 'ka' ? (
                    <>მართე შენი გველი და იკვებე მანათობელი წერტილებით, რომ გაიზარდო. <strong className="text-white">ნადირობის დროა!</strong> მოიმწყვდიე სხვა გველები ისე, რომ შენს სხეულს შეეჯახონ. როცა ისინი ნადგურდებიან, გადაიქცევიან უზარმაზარ ენერგიად — <strong className="text-white">შეჭამე მათი ნარჩენები</strong> და გახდი არენის ყველაზე დიდი მტაცებელი! ფრთხილად იყავი, სხვებმაც არ შეგჭამონ!</>
                  ) : infoLang === 'en' ? (
                    <>Control your snake and feed on glowing orbs to grow. <strong className="text-white">It's hunting time!</strong> Trap other snakes and force them to crash into your body. When they are destroyed, they turn into massive energy—<strong className="text-white">devour their remains</strong> and become the biggest predator in the arena! Be careful not to get eaten yourself!</>
                  ) : (
                    <>Управляйте своей змеей и питайтесь светящимися сферами, чтобы расти. <strong className="text-white">Время охоты!</strong> Загоняйте других змей в ловушку, заставляя их врезаться в ваше тело. Когда они уничтожены, они превращаются в огромную энергию — <strong className="text-white">пожирайте их останки</strong> и станьте крупнейшим хищником на арене! Будьте осторожны, чтобы не съели вас!</>
                  )}
                </p>
              </section>

              {/* POWERUPS */}
              <section className="bg-black/40 border border-white/10 p-5 rounded-xl">
                <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wide flex items-center gap-2 border-b border-white/10 pb-2">
                  <span>✨</span> {infoLang === 'ka' ? 'ძალები (Powerups)' : infoLang === 'en' ? 'POWERUPS' : 'БОНУСЫ (POWERUPS)'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Magnet */}
                  <div className="bg-gradient-to-br from-purple-900/40 to-black/60 p-4 rounded-lg border border-purple-500/30 hover:border-purple-500/60 transition-all flex items-start gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-500/50 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                      <span className="text-xl">🧲</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-purple-400 uppercase tracking-wider text-sm mb-1">
                        {infoLang === 'ka' ? 'მაგნიტი' : infoLang === 'en' ? 'Magnet' : 'Магнит'}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {infoLang === 'ka' ? 'ავტომატურად იზიდავს ახლომდებარე საკვებს და მონეტებს.' : infoLang === 'en' ? 'Automatically attracts nearby food and coins.' : 'Автоматически притягивает ближайшую еду и монеты.'}
                      </p>
                    </div>
                  </div>
                  {/* Speed */}
                  <div className="bg-gradient-to-br from-blue-900/40 to-black/60 p-4 rounded-lg border border-blue-500/30 hover:border-blue-500/60 transition-all flex items-start gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/50 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                      <span className="text-xl">⚡</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-400 uppercase tracking-wider text-sm mb-1">
                        {infoLang === 'ka' ? 'სიჩქარე' : infoLang === 'en' ? 'Speed' : 'Скорость'}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {infoLang === 'ka' ? 'მნიშვნელოვნად ზრდის გადაადგილების სიჩქარეს.' : infoLang === 'en' ? 'Significantly increases your movement speed.' : 'Значительно увеличивает скорость передвижения.'}
                      </p>
                    </div>
                  </div>
                  {/* Invincible */}
                  <div className="bg-gradient-to-br from-yellow-900/40 to-black/60 p-4 rounded-lg border border-yellow-500/30 hover:border-yellow-500/60 transition-all flex items-start gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0 border border-yellow-500/50 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                      <span className="text-xl">🌟</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-yellow-400 uppercase tracking-wider text-sm mb-1">
                        {infoLang === 'ka' ? 'დაუმარცხებელი' : infoLang === 'en' ? 'Invincible' : 'Неуязвимость'}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {infoLang === 'ka' ? 'სხვა გველებთან შეჯახებისას არ კვდებით, ისინი ნადგურდებიან და შეგიძლიათ მათი შეჭმა.' : infoLang === 'en' ? 'You don\'t die when hitting other snakes; instead, they are destroyed and you can devour them.' : 'Вы не умираете при столкновении с другими змеями; вместо этого они уничтожаются, и вы можете их съесть.'}
                      </p>
                    </div>
                  </div>
                  {/* Ghost */}
                  <div className="bg-gradient-to-br from-gray-700/40 to-black/60 p-4 rounded-lg border border-gray-400/30 hover:border-gray-400/60 transition-all flex items-start gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/30 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                      <span className="text-xl">👻</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-300 uppercase tracking-wider text-sm mb-1">
                        {infoLang === 'ka' ? 'მოჩვენება' : infoLang === 'en' ? 'Ghost' : 'Призрак'}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {infoLang === 'ka' ? 'გადიხართ სხვა გველების სხეულში და დაბრკოლებებში დაუზიანებლად.' : infoLang === 'en' ? 'Pass through other snakes and obstacles without taking damage.' : 'Проходите сквозь других змей и препятствия без урона.'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* BOSS */}
              <section className="bg-gradient-to-r from-red-950/40 to-black/60 border border-red-500/30 p-5 rounded-xl relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-6xl opacity-10 group-hover:opacity-20 transition-opacity group-hover:scale-110 duration-500">💀</div>
                <h3 className="text-lg font-bold text-red-500 mb-2 uppercase tracking-wide flex items-center gap-2 text-shadow-neon">
                  <span>💀</span> {infoLang === 'ka' ? 'ბოსი (The Great Devourer)' : infoLang === 'en' ? 'THE GREAT DEVOURER (BOSS)' : 'ВЕЛИКИЙ ПОЖИРАТЕЛЬ (БОСС)'}
                </h3>
                <p className="text-gray-400 relative z-10">
                  {infoLang === 'ka' ? (
                    <>რუკაზე პერიოდულად ჩნდება გიგანტური ბოსი. მისი დამარცხება შესაძლებელია მხოლოდ <strong className="text-yellow-400">დაუმარცხებელი (Invincible)</strong> ძალის გამოყენებით და მასთან შეჯახებით. ბოსის შეჭმა გაძლევთ უზარმაზარ რაოდენობით მონეტებს!</>
                  ) : infoLang === 'en' ? (
                    <>A giant boss periodically spawns on the map. It can only be defeated by using the <strong className="text-yellow-400">Invincible</strong> powerup and crashing into it. Devouring the boss grants a massive amount of coins!</>
                  ) : (
                    <>На карте периодически появляется гигантский босс. Его можно победить только используя бонус <strong className="text-yellow-400">Неуязвимость (Invincible)</strong> и врезавшись в него. Пожирание босса дает огромное количество монет!</>
                  )}
                </p>
              </section>
            </div>
          </div>
        )}
      </div>

      {showCountrySelector && (
        <CountrySelector
          currentFlag={userCountry}
          onSelect={(flag) => {
            onSelectCountry(flag);
            setShowCountrySelector(false);
          }}
          onClose={() => setShowCountrySelector(false)}
        />
      )}
      </div>
    </div>
  );
};

export default MainMenu;
