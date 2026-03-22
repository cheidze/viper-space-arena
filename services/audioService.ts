
class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  
  private boostOsc: OscillatorNode | null = null;
  private boostGain: GainNode | null = null;

  private musicEnabled: boolean = true;
  private isMusicPlaying: boolean = false;
  private musicGain: GainNode | null = null;
  private musicAudioElement: HTMLAudioElement | null = null;
  private musicSourceNode: MediaElementAudioSourceNode | null = null;

  private musicVolume: number = 0.5;
  private soundVolume: number = 0.5;

  constructor() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 1.0; // Master volume is 1.0, individual volumes control the rest
      }
    } catch (e) {
      console.warn("AudioContext not supported");
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
        this.stopBoost();
    }
    // Resume context on user interaction
    if (enabled && this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(e => console.error("Audio resume failed", e));
    }
  }

  public setSoundVolume(volume: number) {
    this.soundVolume = volume;
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMenuMusic();
    }
  }

  public setMusicVolume(volume: number) {
    this.musicVolume = volume;
    if (this.musicGain) {
      this.musicGain.gain.value = volume;
    }
    if (this.musicAudioElement) {
      this.musicAudioElement.volume = volume;
    }
  }

  public playMenuMusic() {
    if (!this.musicEnabled || !this.ctx || this.isMusicPlaying) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    this.isMusicPlaying = true;
    
    if (!this.musicAudioElement) {
      this.musicAudioElement = new Audio('/don-t-wait-up-d93vja1n_TQaJnMm3 (1).wav');
      this.musicAudioElement.loop = true;
      this.musicAudioElement.volume = this.musicVolume;
      
      try {
        this.musicSourceNode = this.ctx.createMediaElementSource(this.musicAudioElement);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicVolume;
        this.musicSourceNode.connect(this.musicGain);
        this.musicGain.connect(this.masterGain!);
      } catch (e) {
        console.warn("Could not create media element source", e);
      }
    }
    
    this.musicAudioElement.play().catch(e => console.warn("Audio play failed", e));
  }

  public stopMenuMusic() {
    this.isMusicPlaying = false;
    if (this.musicAudioElement) {
      this.musicAudioElement.pause();
      this.musicAudioElement.currentTime = 0;
    }
  }

  public playEat() {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    // Higher pitch "bloop"
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.2 * this.soundVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playDie() {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    // Low pitch descending crash
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.4 * this.soundVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  public startBoost() {
    if (!this.enabled || !this.ctx || !this.masterGain || this.boostOsc) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    this.boostOsc = this.ctx.createOscillator();
    this.boostGain = this.ctx.createGain();
    
    this.boostOsc.type = 'sine'; // Softer boost sound
    this.boostOsc.frequency.setValueAtTime(100, this.ctx.currentTime);
    this.boostOsc.frequency.linearRampToValueAtTime(150, this.ctx.currentTime + 0.3);
    
    this.boostGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.boostGain.gain.linearRampToValueAtTime(0.03 * this.soundVolume, this.ctx.currentTime + 0.1);
    
    // Low pass filter to muffle the square wave a bit
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    this.boostOsc.connect(filter);
    filter.connect(this.boostGain);
    this.boostGain.connect(this.masterGain);
    
    this.boostOsc.start();
  }

  public stopBoost() {
    if (this.boostOsc && this.ctx) {
        const now = this.ctx.currentTime;
        if (this.boostGain) {
            this.boostGain.gain.cancelScheduledValues(now);
            this.boostGain.gain.setValueAtTime(this.boostGain.gain.value, now);
            this.boostGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        }
        if (this.boostOsc) {
            this.boostOsc.stop(now + 0.15);
        }
        
        // Cleanup refs after sound fades
        const currentOsc = this.boostOsc;
        const currentGain = this.boostGain;
        setTimeout(() => {
            try {
                currentOsc?.disconnect();
                currentGain?.disconnect();
            } catch (e) {}
        }, 200);
        
        this.boostOsc = null;
        this.boostGain = null;
    }
  }

  public playCoin() {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Bright "ding"
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(0.15 * this.soundVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  public playMagnet() {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.2);
    osc.frequency.linearRampToValueAtTime(400, this.ctx.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2 * this.soundVolume, this.ctx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  public playLevelUp() {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.type = 'sine';
    osc2.type = 'triangle';
    
    osc1.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);
    osc1.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.3);
    
    osc2.frequency.setValueAtTime(554.37, this.ctx.currentTime); // C#
    osc2.frequency.exponentialRampToValueAtTime(1108.73, this.ctx.currentTime + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(2217.46, this.ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2 * this.soundVolume, this.ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    
    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.5);
    osc2.stop(this.ctx.currentTime + 0.5);
  }

  public playHit() {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.2 * this.soundVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playClick() {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.1 * this.soundVolume, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }
}

export const audioService = new AudioService();
