export type SoundId = 'bg_music' | 'enemy_death' | 'explode' | 'launch_bot' | 'ping' | 'shoot';

const SOUND_FILES: Record<SoundId, string> = {
  bg_music: 'sounds/bg_music.wav',
  enemy_death: 'sounds/enemy_death.wav',
  explode: 'sounds/explode.wav',
  launch_bot: 'sounds/launch_bot.wav',
  ping: 'sounds/ping.wav',
  shoot: 'sounds/shoot.wav',
};

const FADE_DURATION = 2; // seconds
const SILENCE_DURATION = 15; // seconds
const MUSIC_VOLUME = 0.3;
const SFX_VOLUME = 0.5;
const THROTTLE_MS = 100;

type MusicState = 'stopped' | 'fading_in' | 'playing' | 'fading_out' | 'silent';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private buffers: Map<SoundId, AudioBuffer> = new Map();
  private lastPlayTime: Map<SoundId, number> = new Map();
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicState: MusicState = 'stopped';
  private silenceTimer = 0;
  private musicLooping = false;
  private loaded = false;

  /** Call once to load all sound buffers. Safe to call multiple times. */
  async init(): Promise<void> {
    if (this.loaded) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    await this.loadAll();
    this.loaded = true;
  }

  /** Ensure AudioContext is running (call from a user gesture handler). */
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private async loadAll(): Promise<void> {
    const ctx = this.ctx!;
    const entries = Object.entries(SOUND_FILES) as [SoundId, string][];
    const results = await Promise.allSettled(
      entries.map(async ([id, path]) => {
        const resp = await fetch(path);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        this.buffers.set(id, audioBuf);
      }),
    );
    // Log failures but don't crash — game can run without sounds
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        console.warn(`Failed to load sound: ${entries[i][0]}`);
      }
    }
  }

  /** Play a one-shot sound effect. Throttled per sound ID. */
  play(id: SoundId, volume: number = SFX_VOLUME): void {
    if (!this.ctx || !this.loaded) return;
    const buf = this.buffers.get(id);
    if (!buf) return;

    // Throttle: skip if same sound played within THROTTLE_MS
    const now = performance.now();
    const last = this.lastPlayTime.get(id) ?? 0;
    if (now - last < THROTTLE_MS) return;
    this.lastPlayTime.set(id, now);

    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.ctx.destination);
    source.start();
  }

  /** Start the background music loop (fade in → play → fade out → silence → repeat). */
  startMusic(): void {
    if (!this.ctx || !this.loaded) return;
    if (this.musicState !== 'stopped') return;
    this.musicLooping = true;
    this.beginMusicCycle();
  }

  /** Stop the background music with a fade out. */
  stopMusic(): void {
    this.musicLooping = false;
    if (this.musicState === 'stopped' || this.musicState === 'silent') {
      this.musicState = 'stopped';
      this.cleanupMusicSource();
      return;
    }
    // Fade out from current position
    if (this.ctx && this.musicGain) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(0, now + FADE_DURATION);
      this.musicState = 'fading_out';
      // Clean up after fade
      setTimeout(() => {
        this.cleanupMusicSource();
        this.musicState = 'stopped';
      }, FADE_DURATION * 1000 + 50);
    }
  }

  /** Pause all audio (for game pause). */
  pauseAudio(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  /** Resume all audio (for game unpause). */
  resumeAudio(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Must be called each frame with dt so the silence gap timer can advance. */
  update(dt: number): void {
    if (this.musicState === 'silent') {
      this.silenceTimer -= dt;
      if (this.silenceTimer <= 0 && this.musicLooping) {
        this.beginMusicCycle();
      }
    }
  }

  getMusicState(): MusicState {
    return this.musicState;
  }

  private beginMusicCycle(): void {
    if (!this.ctx) return;
    const buf = this.buffers.get('bg_music');
    if (!buf) return;

    this.cleanupMusicSource();

    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    // Fade in
    gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, this.ctx.currentTime + FADE_DURATION);
    source.connect(gain).connect(this.ctx.destination);
    source.start();

    this.musicSource = source;
    this.musicGain = gain;
    this.musicState = 'fading_in';

    // Schedule fade-in → playing transition
    setTimeout(() => {
      if (this.musicState === 'fading_in') {
        this.musicState = 'playing';
      }
    }, FADE_DURATION * 1000);

    // When the track ends naturally, fade out and enter silence
    source.onended = () => {
      if (!this.musicLooping) {
        this.musicState = 'stopped';
        return;
      }
      // Track finished — enter silence gap
      this.musicState = 'silent';
      this.silenceTimer = SILENCE_DURATION;
      this.cleanupMusicSource();
    };

    // Schedule fade-out before track end
    const fadeOutStart = buf.duration - FADE_DURATION;
    if (fadeOutStart > FADE_DURATION) {
      const fadeOutTime = this.ctx.currentTime + fadeOutStart;
      gain.gain.setValueAtTime(MUSIC_VOLUME, fadeOutTime);
      gain.gain.linearRampToValueAtTime(0, fadeOutTime + FADE_DURATION);

      setTimeout(() => {
        if (this.musicState === 'playing' || this.musicState === 'fading_in') {
          this.musicState = 'fading_out';
        }
      }, fadeOutStart * 1000);
    }
  }

  private cleanupMusicSource(): void {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        // Already stopped
      }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
    if (this.musicGain) {
      this.musicGain.disconnect();
      this.musicGain = null;
    }
  }
}

/** Singleton audio system instance */
export const audioSystem = new AudioSystem();
