#!/usr/bin/env bun
/**
 * Sound effect & music generator for radar-game.
 *
 * SFX: jsfxr (JS port of sfxr) — retro-style procedural sound effects
 * Music: Pure synthesis (oscillators + envelopes) — Tone.js requires Web Audio
 *        which doesn't exist in bun/node, so we synthesize directly.
 *
 * Run:  bun generate-sounds.js
 * Output: sounds/*.wav (16-bit PCM)
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// jsfxr for sound effects
const { sfxr } = await import("jsfxr");

const SAMPLE_RATE = 44100;
const OUT_DIR = join(import.meta.dir, "sounds");

mkdirSync(OUT_DIR, { recursive: true });

// ─── WAV encoding (16-bit PCM) ───────────────────────────────────────

function encodeWav(samples, sampleRate = SAMPLE_RATE, numChannels = 1) {
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;

  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write samples (clamp to [-1, 1], convert to 16-bit signed int)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(headerSize + i * 2, Math.round(s * 32767), true);
  }

  return Buffer.from(buffer);
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ─── SFX via jsfxr ──────────────────────────────────────────────────

function generateSfx(name, params) {
  // toWave().buffer gives normalized float samples in [-1, 1]
  // (toBuffer() returns raw PCM bytes, not floats — wrong for our encoder)
  const floats = sfxr.toWave(params).buffer;
  const wav = encodeWav(floats, SAMPLE_RATE);
  const path = join(OUT_DIR, `${name}.wav`);
  writeFileSync(path, wav);
  const duration = (floats.length / SAMPLE_RATE).toFixed(2);
  console.log(`  ${name}.wav — ${floats.length} samples (${duration}s)`);
}

// Shoot: short punchy laser/projectile
const shootParams = {
  oldParams: true,
  wave_type: 1, // sawtooth
  p_env_attack: 0,
  p_env_sustain: 0.12,
  p_env_decay: 0.15,
  p_env_punch: 0.4,
  p_base_freq: 0.45,
  p_freq_limit: 0,
  p_freq_ramp: -0.35,
  p_freq_dramp: 0,
  p_vib_strength: 0,
  p_vib_speed: 0,
  p_arp_mod: 0,
  p_arp_speed: 0,
  p_duty: 0.5,
  p_duty_ramp: 0,
  p_repeat_speed: 0,
  p_pha_offset: 0,
  p_pha_ramp: 0,
  p_lpf_freq: 1,
  p_lpf_ramp: 0,
  p_lpf_resonance: 0,
  p_hpf_freq: 0.15,
  p_hpf_ramp: 0,
  sound_vol: 0.6,
  sample_rate: SAMPLE_RATE,
  sample_size: 16,
};

// Explode: satisfying explosion
const explodeParams = {
  oldParams: true,
  wave_type: 3, // noise
  p_env_attack: 0,
  p_env_sustain: 0.25,
  p_env_decay: 0.4,
  p_env_punch: 0.3,
  p_base_freq: 0.15,
  p_freq_limit: 0,
  p_freq_ramp: -0.1,
  p_freq_dramp: 0,
  p_vib_strength: 0,
  p_vib_speed: 0,
  p_arp_mod: 0,
  p_arp_speed: 0,
  p_duty: 0,
  p_duty_ramp: 0,
  p_repeat_speed: 0,
  p_pha_offset: 0,
  p_pha_ramp: 0,
  p_lpf_freq: 0.7,
  p_lpf_ramp: -0.2,
  p_lpf_resonance: 0,
  p_hpf_freq: 0,
  p_hpf_ramp: 0,
  sound_vol: 0.7,
  sample_rate: SAMPLE_RATE,
  sample_size: 16,
};

// Enemy death: distinct from explosion — higher pitch, more tonal
const enemyDeathParams = {
  oldParams: true,
  wave_type: 0, // square
  p_env_attack: 0,
  p_env_sustain: 0.15,
  p_env_decay: 0.3,
  p_env_punch: 0.2,
  p_base_freq: 0.35,
  p_freq_limit: 0,
  p_freq_ramp: -0.5,
  p_freq_dramp: 0,
  p_vib_strength: 0,
  p_vib_speed: 0,
  p_arp_mod: -0.3,
  p_arp_speed: 0.6,
  p_duty: 0.5,
  p_duty_ramp: 0,
  p_repeat_speed: 0,
  p_pha_offset: 0,
  p_pha_ramp: 0,
  p_lpf_freq: 1,
  p_lpf_ramp: 0,
  p_lpf_resonance: 0,
  p_hpf_freq: 0.1,
  p_hpf_ramp: 0,
  sound_vol: 0.55,
  sample_rate: SAMPLE_RATE,
  sample_size: 16,
};

// Launch bot: mechanical/techy deployment
const launchBotParams = {
  oldParams: true,
  wave_type: 1, // sawtooth
  p_env_attack: 0.02,
  p_env_sustain: 0.2,
  p_env_decay: 0.25,
  p_env_punch: 0.1,
  p_base_freq: 0.25,
  p_freq_limit: 0,
  p_freq_ramp: 0.3,
  p_freq_dramp: -0.05,
  p_vib_strength: 0.15,
  p_vib_speed: 0.5,
  p_arp_mod: 0.2,
  p_arp_speed: 0.4,
  p_duty: 0.4,
  p_duty_ramp: 0.1,
  p_repeat_speed: 0,
  p_pha_offset: 0.05,
  p_pha_ramp: 0.02,
  p_lpf_freq: 0.8,
  p_lpf_ramp: 0,
  p_lpf_resonance: 0.3,
  p_hpf_freq: 0.05,
  p_hpf_ramp: 0,
  sound_vol: 0.55,
  sample_rate: SAMPLE_RATE,
  sample_size: 16,
};

console.log("Generating sound effects...");
generateSfx("shoot", shootParams);
generateSfx("explode", explodeParams);
generateSfx("enemy_death", enemyDeathParams);
generateSfx("launch_bot", launchBotParams);

// Radar ping: low-pitched sonar blip with ~1s reverb tail
// Hand-synthesized because sfxr can't do long reverb tails
{
  const pingDuration = 1.3; // total length including reverb decay
  const pingSamples = Math.floor(pingDuration * SAMPLE_RATE);
  const pingBuf = new Float64Array(pingSamples);
  const freq = 180; // low sonar tone

  // Initial blip: quick attack, short sustain, then exponential decay
  for (let i = 0; i < pingSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Sharp attack (~5ms), then exponential decay over ~1s
    const attack = Math.min(t / 0.005, 1);
    const decay = Math.exp(-t * 4.5); // long tail
    const env = attack * decay;

    // Sine tone with slight detuned pair for warmth
    const sig = Math.sin(2 * Math.PI * freq * t) * 0.7
              + Math.sin(2 * Math.PI * freq * 1.002 * t) * 0.3;

    pingBuf[i] = sig * env;
  }

  // Simulate reverb: layer delayed copies with decay and LPF
  const delays = [
    { ms: 60,  gain: 0.25 },
    { ms: 130, gain: 0.18 },
    { ms: 210, gain: 0.12 },
    { ms: 340, gain: 0.08 },
    { ms: 500, gain: 0.05 },
    { ms: 720, gain: 0.03 },
  ];

  // Copy dry signal, then mix in delayed reflections
  const dry = Float64Array.from(pingBuf);
  for (const { ms, gain } of delays) {
    const delaySamples = Math.floor((ms / 1000) * SAMPLE_RATE);
    // Simple one-pole LPF state for each reflection (darker = more distant)
    let lpfState = 0;
    const lpfCoeff = 0.4 + (ms / 1000) * 0.4; // later reflections are darker
    for (let i = 0; i < pingSamples - delaySamples; i++) {
      const src = dry[i];
      lpfState += lpfCoeff * (src - lpfState);
      pingBuf[i + delaySamples] += lpfState * gain;
    }
  }

  // Normalize
  let peak = 0;
  for (let i = 0; i < pingSamples; i++) {
    if (Math.abs(pingBuf[i]) > peak) peak = Math.abs(pingBuf[i]);
  }
  const pingGain = 0.7 / peak;
  for (let i = 0; i < pingSamples; i++) pingBuf[i] *= pingGain;

  const pingWav = encodeWav(pingBuf, SAMPLE_RATE);
  writeFileSync(join(OUT_DIR, "ping.wav"), pingWav);
  console.log(`  ping.wav — ${pingSamples} samples (${pingDuration}s)`);
}

// ─── Background music: spacey ambient loop ──────────────────────────
//
// Pure synthesis — sine/triangle oscillators, slow pad chords, gentle
// arpeggio, minor/modal tonality. ~32 seconds, designed to loop cleanly.

console.log("\nGenerating background music...");

const MUSIC_DURATION = 32; // seconds (power of 2 bars for clean loop)
const MUSIC_SAMPLES = MUSIC_DURATION * SAMPLE_RATE;
const BPM = 72;
const BEAT = 60 / BPM; // seconds per beat

// D minor / Dorian mode — spacey, melancholic but not dark
// Frequencies in Hz
const NOTES = {
  D3: 146.83, F3: 174.61, A3: 220.0, C4: 261.63,
  D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
  A4: 440.0, C5: 523.25, D5: 587.33,
};

// Chord progression: Dm - Am/C - Bb(F) - Gm(C) — 4 bars, repeated
const CHORDS = [
  { notes: [NOTES.D3, NOTES.A3, NOTES.D4, NOTES.F4], bars: 2 },
  { notes: [NOTES.A3, NOTES.C4, NOTES.E4], bars: 2 },
  { notes: [NOTES.F3, NOTES.A3, NOTES.C4, NOTES.F4], bars: 2 },
  { notes: [NOTES.D3, NOTES.A3, NOTES.D4, NOTES.E4], bars: 2 },
];

// Arpeggio pattern (quarter notes, cycling through chord tones + extensions)
const ARP_PATTERNS = [
  [NOTES.D4, NOTES.F4, NOTES.A4, NOTES.D5, NOTES.A4, NOTES.F4, NOTES.D4, NOTES.C4],
  [NOTES.C4, NOTES.E4, NOTES.A4, NOTES.C5, NOTES.A4, NOTES.E4, NOTES.C4, NOTES.A3],
  [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.F4, NOTES.C5, NOTES.A4, NOTES.F4, NOTES.C4],
  [NOTES.D4, NOTES.E4, NOTES.A4, NOTES.D5, NOTES.A4, NOTES.E4, NOTES.D4, NOTES.A3],
];

function sine(t, freq) {
  return Math.sin(2 * Math.PI * freq * t);
}

function triangle(t, freq) {
  const p = ((t * freq) % 1 + 1) % 1;
  return 4 * Math.abs(p - 0.5) - 1;
}

// Smooth envelope: attack-sustain-release
function envelope(t, attack, sustain, release) {
  const total = attack + sustain + release;
  if (t < 0 || t > total) return 0;
  if (t < attack) return t / attack;
  if (t < attack + sustain) return 1;
  return 1 - (t - attack - sustain) / release;
}

// Slow fade envelope for pads
function padEnvelope(t, duration) {
  const fadeTime = Math.min(duration * 0.15, 1.5);
  if (t < fadeTime) return t / fadeTime;
  if (t > duration - fadeTime) return (duration - t) / fadeTime;
  return 1;
}

const musicSamples = new Float64Array(MUSIC_SAMPLES);

// Layer 1: Pad chords (warm sine + triangle blend, very quiet)
const padBarDuration = BEAT * 4; // 4 beats per bar
let padTime = 0;

for (let rep = 0; rep < Math.ceil(MUSIC_DURATION / (padBarDuration * 8)); rep++) {
  for (const chord of CHORDS) {
    const chordDuration = chord.bars * padBarDuration;
    const startSample = Math.floor(padTime * SAMPLE_RATE);

    for (let i = 0; i < Math.floor(chordDuration * SAMPLE_RATE); i++) {
      const sampleIdx = startSample + i;
      if (sampleIdx >= MUSIC_SAMPLES) break;
      const t = i / SAMPLE_RATE;
      let val = 0;
      for (const freq of chord.notes) {
        // Detuned pair for thickness
        val += sine(t, freq) * 0.08;
        val += sine(t, freq * 1.003) * 0.04;
        val += triangle(t, freq * 0.5) * 0.03; // sub octave
      }
      val *= padEnvelope(t, chordDuration);
      musicSamples[sampleIdx] += val;
    }
    padTime += chordDuration;
  }
}

// Layer 2: Gentle arpeggio (sine, soft attack, quiet)
let arpTime = 0;
const arpNoteDuration = BEAT; // quarter notes
const arpAttack = 0.08;
const arpSustain = arpNoteDuration * 0.4;
const arpRelease = arpNoteDuration * 0.5;

for (let rep = 0; rep < Math.ceil(MUSIC_DURATION / (padBarDuration * 8)); rep++) {
  for (let ci = 0; ci < ARP_PATTERNS.length; ci++) {
    const pattern = ARP_PATTERNS[ci];
    const barsForThisChord = CHORDS[ci].bars;
    const notesInChord = barsForThisChord * 4; // 4 beats per bar
    for (let ni = 0; ni < notesInChord; ni++) {
      const freq = pattern[ni % pattern.length];
      const noteStart = Math.floor(arpTime * SAMPLE_RATE);
      const noteSamples = Math.floor((arpAttack + arpSustain + arpRelease) * SAMPLE_RATE);

      for (let i = 0; i < noteSamples; i++) {
        const sampleIdx = noteStart + i;
        if (sampleIdx >= MUSIC_SAMPLES) break;
        const t = i / SAMPLE_RATE;
        const env = envelope(t, arpAttack, arpSustain, arpRelease);
        const val = sine(t, freq) * env * 0.12;
        musicSamples[sampleIdx] += val;
      }
      arpTime += arpNoteDuration;
    }
  }
}

// Layer 3: Sub bass (very low sine following root notes)
let bassTime = 0;
const bassRoots = [NOTES.D3 / 2, NOTES.A3 / 2, NOTES.F3 / 2, NOTES.D3 / 2];

for (let rep = 0; rep < Math.ceil(MUSIC_DURATION / (padBarDuration * 8)); rep++) {
  for (let ci = 0; ci < bassRoots.length; ci++) {
    const freq = bassRoots[ci];
    const duration = CHORDS[ci].bars * padBarDuration;
    const startSample = Math.floor(bassTime * SAMPLE_RATE);

    for (let i = 0; i < Math.floor(duration * SAMPLE_RATE); i++) {
      const sampleIdx = startSample + i;
      if (sampleIdx >= MUSIC_SAMPLES) break;
      const t = i / SAMPLE_RATE;
      const env = padEnvelope(t, duration);
      musicSamples[sampleIdx] += sine(t, freq) * env * 0.15;
    }
    bassTime += duration;
  }
}

// Layer 4: Sparse high shimmer (very quiet, random-ish timing)
// Deterministic pseudo-random using simple seed
let seed = 42;
function pseudoRandom() {
  seed = (seed * 16807 + 0) % 2147483647;
  return seed / 2147483647;
}

for (let t = 0; t < MUSIC_DURATION; t += BEAT * 2) {
  if (pseudoRandom() > 0.4) continue; // skip most beats
  const freq = [NOTES.D5, NOTES.A4, NOTES.C5, NOTES.F4][Math.floor(pseudoRandom() * 4)];
  const startSample = Math.floor(t * SAMPLE_RATE);
  const shimmerDuration = 1.5 + pseudoRandom() * 1.5;
  const shimmerSamples = Math.floor(shimmerDuration * SAMPLE_RATE);

  for (let i = 0; i < shimmerSamples; i++) {
    const sampleIdx = startSample + i;
    if (sampleIdx >= MUSIC_SAMPLES) break;
    const st = i / SAMPLE_RATE;
    const env = envelope(st, 0.3, shimmerDuration * 0.3, shimmerDuration * 0.5);
    // Detuned pair for shimmer
    const val = (sine(st, freq) + sine(st, freq * 1.005)) * env * 0.04;
    musicSamples[sampleIdx] += val;
  }
}

// Apply gentle fade at very start and end for seamless loop
const fadeLen = Math.floor(0.05 * SAMPLE_RATE); // 50ms crossfade zone
for (let i = 0; i < fadeLen; i++) {
  const fade = i / fadeLen;
  musicSamples[i] *= fade;
  musicSamples[MUSIC_SAMPLES - 1 - i] *= fade;
}

// Normalize to ~80% peak to avoid clipping
let peak = 0;
for (let i = 0; i < MUSIC_SAMPLES; i++) {
  const abs = Math.abs(musicSamples[i]);
  if (abs > peak) peak = abs;
}
if (peak > 0) {
  const gain = 0.8 / peak;
  for (let i = 0; i < MUSIC_SAMPLES; i++) {
    musicSamples[i] *= gain;
  }
}

const musicWav = encodeWav(musicSamples, SAMPLE_RATE);
const musicPath = join(OUT_DIR, "bg_music.wav");
writeFileSync(musicPath, musicWav);
console.log(`  bg_music.wav — ${MUSIC_SAMPLES} samples (${MUSIC_DURATION}s)`);

console.log(`\nDone! All files written to ${OUT_DIR}/`);
