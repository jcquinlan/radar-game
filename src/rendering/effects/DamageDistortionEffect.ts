import { ShaderEffect } from '../ShaderEffect';

export interface DamageDistortionConfig {
  /** Max chromatic aberration offset in UV space at full intensity */
  maxAberration: number;
  /** Max barrel distortion curvature at full intensity */
  maxCurvature: number;
  /** Noise intensity at full damage */
  maxNoise: number;
}

export const DEFAULT_DAMAGE_CONFIG: DamageDistortionConfig = {
  maxAberration: 0.008,
  maxCurvature: 0.03,
  maxNoise: 0.08,
};

// Damage distortion: chromatic aberration + barrel warp + noise, all scaled by uDamageIntensity.
// At intensity 0 this is a pure passthrough (no visual effect, no wasted GPU work beyond
// the texture sample). The noise uses a simple hash function — no texture needed.
const DAMAGE_FRAGMENT = `#version 300 es
precision mediump float;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDamageIntensity;
uniform float uMaxAberration;
uniform float uMaxCurvature;
uniform float uMaxNoise;

out vec4 fragColor;

// Simple hash-based noise (no texture needed)
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 barrelDistort(vec2 uv, float curvature) {
  vec2 centered = uv - 0.5;
  float r2 = dot(centered, centered);
  centered *= 1.0 + curvature * r2;
  return centered + 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  uv.y = 1.0 - uv.y;

  float intensity = uDamageIntensity;

  // Early out: no damage = passthrough
  if (intensity < 0.001) {
    fragColor = texture(uSource, uv);
    return;
  }

  // Barrel distortion scaled by intensity
  float curvature = uMaxCurvature * intensity;
  vec2 distorted = barrelDistort(uv, curvature);

  // Chromatic aberration — offset R and B channels
  float aberration = uMaxAberration * intensity;
  float r = texture(uSource, vec2(distorted.x + aberration, distorted.y)).r;
  float g = texture(uSource, distorted).g;
  float b = texture(uSource, vec2(distorted.x - aberration, distorted.y)).b;
  vec3 color = vec3(r, g, b);

  // Noise overlay — animated hash noise
  float noise = hash(gl_FragCoord.xy + uTime * 1000.0) * uMaxNoise * intensity;
  color += noise - uMaxNoise * intensity * 0.5; // Center noise around zero

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

export class DamageDistortionEffect implements ShaderEffect {
  readonly name = 'damage_distortion';
  private config: DamageDistortionConfig;
  private damageIntensity = 0;

  constructor(config: Partial<DamageDistortionConfig> = {}) {
    this.config = { ...DEFAULT_DAMAGE_CONFIG, ...config };
  }

  getConfig(): DamageDistortionConfig {
    return this.config;
  }

  /** Set the current damage intensity (0 = no damage, 1 = max distortion). Call each frame. */
  setDamageIntensity(value: number): void {
    this.damageIntensity = Math.max(0, Math.min(1, value));
  }

  getDamageIntensity(): number {
    return this.damageIntensity;
  }

  init(_gl: WebGL2RenderingContext): void {
    // No additional GL resources needed
  }

  getFragmentSource(): string {
    return DAMAGE_FRAGMENT;
  }

  setUniforms(gl: WebGL2RenderingContext, program: WebGLProgram, time: number, resolution: [number, number]): void {
    gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), resolution[0], resolution[1]);
    gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
    gl.uniform1f(gl.getUniformLocation(program, 'uDamageIntensity'), this.damageIntensity);
    gl.uniform1f(gl.getUniformLocation(program, 'uMaxAberration'), this.config.maxAberration);
    gl.uniform1f(gl.getUniformLocation(program, 'uMaxCurvature'), this.config.maxCurvature);
    gl.uniform1f(gl.getUniformLocation(program, 'uMaxNoise'), this.config.maxNoise);
  }

  dispose(_gl: WebGL2RenderingContext): void {
    // No resources to clean up
  }
}
