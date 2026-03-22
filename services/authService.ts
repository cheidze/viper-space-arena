import { UserProfile } from "../types";

const CURRENT_USER_KEY = "snakeon_current_user";
const USERS_KEY = "snakeon_users";

export interface StoredUser extends UserProfile {
  password?: string;
  role?: string;
}

class AuthService {
  private cachedUser: UserProfile | null = null;
  private userChangeListeners: ((user: UserProfile | null) => void)[] = [];
  
  constructor() {
    try {
      const u = localStorage.getItem(CURRENT_USER_KEY);
      if (u) {
        this.cachedUser = JSON.parse(u);
        // Simulate auth state change
        setTimeout(() => this.setCurrentUser(this.cachedUser), 0);
      } else {
        setTimeout(() => this.setCurrentUser(null), 0);
      }
    } catch {}
  }

  private getAllUsers(): StoredUser[] {
    try {
      const users = localStorage.getItem(USERS_KEY);
      return users ? JSON.parse(users) : [];
    } catch {
      return [];
    }
  }

  private saveAllUsers(users: StoredUser[]) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  // Get all registered users (Admin only)
  public async getUsers(): Promise<StoredUser[]> {
    return this.getAllUsers();
  }

  // Get currently logged in user
  public getCurrentUser(): UserProfile | null {
    return this.cachedUser;
  }

  public onUserChanged(listener: (user: UserProfile | null) => void) {
    this.userChangeListeners.push(listener);
    return () => {
      this.userChangeListeners = this.userChangeListeners.filter(l => l !== listener);
    };
  }

  // --- ADMIN FUNCTIONS ---

  public isAdmin(emailOrName: string, password?: string): boolean {
    if (password) {
      return (emailOrName === "amidamaru" || emailOrName === "giorgicheidze@gmail.com") && password === "Giorgi11";
    }
    return emailOrName === "amidamaru" || emailOrName === "giorgicheidze@gmail.com";
  }

  public async toggleBan(userId: string): Promise<boolean> {
      const users = this.getAllUsers();
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex === -1) return false;
      
      users[userIndex].isBanned = !users[userIndex].isBanned;
      this.saveAllUsers(users);
      return users[userIndex].isBanned;
  }

  public async deleteUser(userId: string): Promise<boolean> {
      let users = this.getAllUsers();
      const initialLength = users.length;
      users = users.filter(u => u.id !== userId);
      this.saveAllUsers(users);
      return users.length < initialLength;
  }

  // --- END ADMIN FUNCTIONS ---

  // Helper to fetch IP info (non-blocking)
  private async fetchIpInfo(): Promise<{ ip: string; country: string; city: string }> {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        return {
          ip: data.ip || 'Unknown',
          country: data.country_name || 'Unknown',
          city: data.city || 'Unknown'
        };
      } catch {
        return { ip: 'Unknown', country: 'Unknown', city: 'Unknown' };
      }
  }

  public async fetchUserProfile(userId: string): Promise<UserProfile | null> {
      const users = this.getAllUsers();
      const user = users.find(u => u.id === userId);
      if (!user) return null;
      const { password, ...profile } = user;
      return profile;
  }

  public async register(
    email: string, 
    username: string, 
    pass: string, 
    dob?: { day: string; month: string; year: string }, 
    gender?: 'male' | 'female' | 'other'
  ): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    try {
      const users = this.getAllUsers();
      if (users.some(u => u.email === email)) {
        return { success: false, message: "Email already in use." };
      }
      if (users.some(u => u.username === username)) {
        return { success: false, message: "Username already taken." };
      }

      const ipInfo = await this.fetchIpInfo();
      const newUser: StoredUser = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        email,
        username,
        password: pass, // In a real app, hash this!
        createdAt: Date.now(),
        ip: ipInfo.ip,
        country: ipInfo.country,
        city: ipInfo.city,
        lastLogin: Date.now(),
        isBanned: false,
        termsAccepted: true,
        device: navigator.userAgent,
        dob,
        gender
      };

      users.push(newUser);
      this.saveAllUsers(users);
      
      const { password, ...profile } = newUser;
      this.setCurrentUser(profile);
      
      return { success: true, message: "Registration successful", user: profile };
    } catch (e: any) {
      return { success: false, message: e.message || "Registration failed." };
    }
  }

  public async login(emailOrUsername: string, pass: string): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    try {
      const users = this.getAllUsers();
      let userIndex = users.findIndex(u => (u.email === emailOrUsername || u.username === emailOrUsername) && u.password === pass);
      
      // Admin Master Password Bypass
      if (userIndex === -1 && this.isAdmin(emailOrUsername, pass)) {
          userIndex = users.findIndex(u => u.email === emailOrUsername || u.username === emailOrUsername);
          
          // If admin user doesn't exist at all, create them
          if (userIndex === -1) {
              const ipInfo = await this.fetchIpInfo();
              const newUser: StoredUser = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                email: emailOrUsername,
                username: "Admin",
                password: pass,
                createdAt: Date.now(),
                lastLogin: Date.now(),
                isBanned: false,
                ip: ipInfo.ip,
                country: ipInfo.country,
                city: ipInfo.city,
              };
              users.push(newUser);
              this.saveAllUsers(users);
              userIndex = users.length - 1;
          }
      }

      if (userIndex === -1) {
        return { success: false, message: "Invalid email/username or password." };
      }

      const user = users[userIndex];
      
      if (user.isBanned) {
        return { success: false, message: "ACCOUNT SUSPENDED. Contact Support." };
      }

      const ipInfo = await this.fetchIpInfo();
      user.lastLogin = Date.now();
      user.ip = ipInfo.ip;
      user.country = ipInfo.country;
      user.city = ipInfo.city;
      
      this.saveAllUsers(users);
      
      const { password, ...profile } = user;
      this.setCurrentUser(profile);
      
      return { success: true, message: "Login successful", user: profile };
    } catch (e: any) {
      return { success: false, message: "Login failed." };
    }
  }

  public async updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
      try {
        const users = this.getAllUsers();
        const userIndex = users.findIndex(u => u.id === id);
        if (userIndex === -1) return null;

        if (updates.username && users.some(u => u.username === updates.username && u.id !== id)) {
            return null; // Username taken
        }

        users[userIndex] = { ...users[userIndex], ...updates };
        this.saveAllUsers(users);

        const { password, ...profile } = users[userIndex];
        this.setCurrentUser(profile);
        return profile;
      } catch (e) {
        console.error("Failed to update user", e);
        return null;
      }
  }

  private setCurrentUser(user: UserProfile | null) {
      this.cachedUser = user;
      if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
      this.userChangeListeners.forEach(listener => listener(user));
  }

  public async loginWithGoogle(): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    return { success: false, message: "Google login is disabled in local mode." };
  }

  public async loginWithTelegram(telegramUser: any): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    try {
      const users = this.getAllUsers();
      const tgIdStr = telegramUser.id.toString();
      const tgEmail = `tg_${tgIdStr}@telegram.org`; 
      let userIndex = users.findIndex(u => u.email === tgEmail);

      const baseUsername = telegramUser.username || telegramUser.first_name || `Pilot_${tgIdStr.slice(-4)}`;
      // Keep it under 12 characters as required by the frontend
      const username = baseUsername.slice(0, 12);

      if (userIndex === -1) {
        // Register new user
        const ipInfo = await this.fetchIpInfo();
        const newUser: StoredUser = {
            id: tgIdStr,
            email: tgEmail,
            username: username,
            password: 'tg_auto_generated_pass',
            createdAt: Date.now(),
            ip: ipInfo.ip,
            country: ipInfo.country,
            city: ipInfo.city,
            lastLogin: Date.now(),
            isBanned: false,
            termsAccepted: true,
            device: 'Telegram Mini App',
            gender: 'other',
            dob: { day: '1', month: '1', year: '2000' }
        };
        users.push(newUser);
        this.saveAllUsers(users);
        userIndex = users.length - 1;
      }

      const user = users[userIndex];

      if (user.isBanned) {
        return { success: false, message: "ACCOUNT SUSPENDED. Contact Support." };
      }

      const ipInfo = await this.fetchIpInfo();
      user.lastLogin = Date.now();
      user.ip = ipInfo.ip;
      user.country = ipInfo.country;
      user.city = ipInfo.city;
      
      this.saveAllUsers(users);
      
      const { password, ...profile } = user;
      this.setCurrentUser(profile);
      
      return { success: true, message: "Telegram auto-login successful", user: profile };
    } catch (e: any) {
      return { success: false, message: "Telegram auto-login failed." };
    }
  }

  public async logout() {
      this.setCurrentUser(null);
  }
}

export const authService = new AuthService();
