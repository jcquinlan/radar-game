import { ShaderEffect } from '../ShaderEffect';

export interface GrainEffectConfig {
  /** Grain intensity — how visible the grain texture is (0 = off, 1 = very heavy). */
  intensity: number;
  /** Grain scale — higher values make the grain pattern coarser. 1.0 = per-pixel grain. */
  scale: number;
}

export const DEFAULT_GRAIN_CONFIG: GrainEffectConfig = {
  intensity: 0.06,
  scale: 1.0,
};

// Film grain shader: applies sharp, animated noise that gives a colored-paper texture.
// Uses a high-frequency hash function for crisp per-pixel grain (no blur, no smoothing).
// The grain is mixed multiplicatively so it tints darks and lights differently,
// giving the "colored paper" look where brighter areas show lighter grain and
// darker areas show darker grain — like ink printed on textured stock.
const GRAIN_FRAGMENT = `#version 300 es
precision mediump float;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uScale;
uniform float uFlipY;

out vec4 fragColor;

// High-frequency hash — produces sharp, non-repeating noise per pixel.
// Two different hashes give independent grain per color channel for subtle
// chromatic texture (paper fibers catch light differently per wavelength).
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  if (uFlipY > 0.5) uv.y = 1.0 - uv.y;

  vec4 color = texture(uSource, uv);

  // Grain coordinates: floor to scale grid, offset by time for animation
  vec2 grainCoord = floor(gl_FragCoord.xy / uScale) * uScale;
  float t = floor(uTime * 24.0); // 24 fps grain refresh — fast enough to animate, slow enough to read as texture

  // Per-channel grain for subtle chromatic variation (paper fiber effect)
  float grainR = hash(grainCoord + t * 1.1) - 0.5;
  float grainG = hash(grainCoord + t * 1.3 + 100.0) - 0.5;
  float grainB = hash(grainCoord + t * 1.7 + 200.0) - 0.5;

  // Multiplicative blend: grain modulates the existing color rather than
  // adding flat noise. This keeps dark areas dark-grained and bright areas
  // light-grained, like real paper texture under colored ink.
  vec3 grain = vec3(grainR, grainG, grainB) * uIntensity;
  color.rgb += color.rgb * grain;

  fragColor = vec4(clamp(color.rgb, 0.0, 1.0), color.a);
}
`;

export class GrainEffect implements ShaderEffect {
  readonly name = 'grain';
  private config: GrainEffectConfig;

  constructor(config: Partial<GrainEffectConfig> = {}) {
    this.config = { ...DEFAULT_GRAIN_CONFIG, ...config };
  }

  getConfig(): GrainEffectConfig {
    return this.config;
  }

  init(_gl: WebGL2RenderingContext): void {
    // No additional GL resources needed
  }

  getFragmentSource(): string {
    return GRAIN_FRAGMENT;
  }

  setUniforms(gl: WebGL2RenderingContext, program: WebGLProgram, time: number, resolution: [number, number]): void {
    gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), resolution[0], resolution[1]);
    gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
    gl.uniform1f(gl.getUniformLocation(program, 'uIntensity'), this.config.intensity);
    gl.uniform1f(gl.getUniformLocation(program, 'uScale'), this.config.scale);
  }

  dispose(_gl: WebGL2RenderingContext): void {
    // No resources to clean up
  }
}
