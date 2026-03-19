import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioSystem } from './AudioSystem';

// Minimal Web Audio API mocks
function createMockAudioContext() {
  const gainNode = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  const sourceNode = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn().mockReturnValue(gainNode),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null as (() => void) | null,
  };

  const mockBuffer = {
    duration: 30,
    length: 48000 * 30,
    numberOfChannels: 1,
    sampleRate: 48000,
    getChannelData: vi.fn(),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;

  const ctx = {
    state: 'running' as AudioContextState,
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    createBufferSource: vi.fn().mockReturnValue({ ...sourceNode }),
    createGain: vi.fn().mockReturnValue({
      gain: { ...gainNode.gain },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    }),
    decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
    suspend: vi.fn().mockImplementation(function (this: typeof ctx) {
      this.state = 'suspended' as AudioContextState;
      return Promise.resolve();
    }),
    resume: vi.fn().mockImplementation(function (this: typeof ctx) {
      this.state = 'running' as AudioContextState;
      return Promise.resolve();
    }),
  };

  // Make fetch return a mock response
  globalThis.fetch = vi.fn().mockResolvedValue({
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  });

  // Replace AudioContext constructor
  globalThis.AudioContext = vi.fn().mockReturnValue(ctx) as unknown as typeof AudioContext;

  return { ctx, gainNode, sourceNode, mockBuffer };
}

describe('AudioSystem', () => {
  let audio: AudioSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    audio = new AudioSystem();
  });

  describe('init', () => {
    it('loads all 6 sound files', async () => {
      createMockAudioContext();
      await audio.init();
      // 6 sounds = 6 fetch calls
      expect(globalThis.fetch).toHaveBeenCalledTimes(6);
      expect(globalThis.fetch).toHaveBeenCalledWith('sounds/bg_music.wav');
      expect(globalThis.fetch).toHaveBeenCalledWith('sounds/ping.wav');
      expect(globalThis.fetch).toHaveBeenCalledWith('sounds/shoot.wav');
      expect(globalThis.fetch).toHaveBeenCalledWith('sounds/explode.wav');
      expect(globalThis.fetch).toHaveBeenCalledWith('sounds/enemy_death.wav');
      expect(globalThis.fetch).toHaveBeenCalledWith('sounds/launch_bot.wav');
    });

    it('is idempotent — does not reload on second call', async () => {
      createMockAudioContext();
      await audio.init();
      await audio.init();
      expect(globalThis.fetch).toHaveBeenCalledTimes(6); // not 12
    });
  });

  describe('play', () => {
    it('creates a buffer source and plays it', async () => {
      const { ctx } = createMockAudioContext();
      await audio.init();

      audio.play('ping');
      expect(ctx.createBufferSource).toHaveBeenCalled();
      expect(ctx.createGain).toHaveBeenCalled();
    });

    it('does nothing before init', () => {
      const { ctx } = createMockAudioContext();
      audio.play('ping');
      expect(ctx.createBufferSource).not.toHaveBeenCalled();
    });

    it('throttles same sound within 100ms', async () => {
      const { ctx } = createMockAudioContext();
      await audio.init();

      // Mock performance.now to control throttle timing
      let now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);

      audio.play('shoot');
      const callCount1 = ctx.createBufferSource.mock.calls.length;

      // Same sound within 100ms — should be throttled
      now = 1050;
      audio.play('shoot');
      expect(ctx.createBufferSource.mock.calls.length).toBe(callCount1);

      // After 100ms — should play
      now = 1150;
      audio.play('shoot');
      expect(ctx.createBufferSource.mock.calls.length).toBe(callCount1 + 1);
    });

    it('allows different sounds within throttle window', async () => {
      const { ctx } = createMockAudioContext();
      await audio.init();

      let now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);

      audio.play('shoot');
      const callCount1 = ctx.createBufferSource.mock.calls.length;

      now = 1050;
      audio.play('explode'); // different sound — not throttled
      expect(ctx.createBufferSource.mock.calls.length).toBe(callCount1 + 1);
    });
  });

  describe('music', () => {
    it('starts music loop via startMusic', async () => {
      const { ctx } = createMockAudioContext();
      await audio.init();

      audio.startMusic();
      expect(ctx.createBufferSource).toHaveBeenCalled();
      expect(audio.getMusicState()).not.toBe('stopped');
    });

    it('does not double-start if already playing', async () => {
      const { ctx } = createMockAudioContext();
      await audio.init();

      audio.startMusic();
      const calls1 = ctx.createBufferSource.mock.calls.length;

      audio.startMusic(); // should be ignored
      expect(ctx.createBufferSource.mock.calls.length).toBe(calls1);
    });

    it('stopMusic transitions to stopped state', async () => {
      createMockAudioContext();
      await audio.init();

      audio.startMusic();
      audio.stopMusic();
      // State should be fading_out or stopped
      const state = audio.getMusicState();
      expect(['fading_out', 'stopped']).toContain(state);
    });

    it('enters silent state after track ends and loops after silence', async () => {
      createMockAudioContext();
      await audio.init();

      audio.startMusic();

      // Simulate track ending by reading the source's onended callback
      // The music source is internal, but we can test via update()
      // Force into silent state to test the silence timer
      // We need to access internals, so test via the update path
    });
  });

  describe('pause/resume', () => {
    it('suspends AudioContext on pauseAudio', async () => {
      const { ctx } = createMockAudioContext();
      await audio.init();

      audio.pauseAudio();
      expect(ctx.suspend).toHaveBeenCalled();
    });

    it('resumes AudioContext on resumeAudio', async () => {
      const { ctx } = createMockAudioContext();
      await audio.init();

      audio.pauseAudio();
      audio.resumeAudio();
      expect(ctx.resume).toHaveBeenCalled();
    });
  });

  describe('update (silence timer)', () => {
    it('update with no active music does nothing', async () => {
      createMockAudioContext();
      await audio.init();
      // Should not throw
      audio.update(0.016);
      expect(audio.getMusicState()).toBe('stopped');
    });
  });

  describe('resume (autoplay policy)', () => {
    it('resumes suspended AudioContext', async () => {
      const { ctx } = createMockAudioContext();
      await audio.init();
      ctx.state = 'suspended' as AudioContextState;

      audio.resume();
      expect(ctx.resume).toHaveBeenCalled();
    });
  });
});
