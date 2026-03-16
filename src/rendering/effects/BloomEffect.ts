import { ShaderEffect } from '../ShaderEffect';

export interface BloomEffectConfig {
  /** Luminance threshold for bloom extraction (0-1). Pixels below this won't glow. */
  threshold: number;
  /** Bloom intensity — how bright the glow is (0 = off, 1 = full). */
  intensity: number;
  /** Blur radius in texels. Higher = wider glow but more expensive. */
  radius: number;
}

export const DEFAULT_BLOOM_CONFIG: BloomEffectConfig = {
  threshold: 0.25,
  intensity: 0.45,
  radius: 4.0,
};

// Single-pass bloom: extract bright pixels, apply a 13-tap blur kernel, and composite
// additively with the original. Uses a weighted star pattern for wide coverage
// without requiring multiple passes.
const BLOOM_FRAGMENT = `#version 300 es
precision mediump float;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uThreshold;
uniform float uIntensity;
uniform float uRadius;
uniform float uFlipY;

out vec4 fragColor;

vec3 sampleBright(vec2 uv) {
  vec3 c = texture(uSource, uv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c * max(0.0, lum - uThreshold) / max(lum, 0.001);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  if (uFlipY > 0.5) uv.y = 1.0 - uv.y;

  vec3 original = texture(uSource, uv).rgb;

  vec2 texel = uRadius / uResolution;

  // 13-tap star kernel: center + 4 cardinal + 4 diagonal + 4 far cardinal
  vec3 bloom = sampleBright(uv) * 0.2;

  // Cardinal neighbors (weight 0.1 each)
  bloom += sampleBright(uv + vec2( texel.x, 0.0)) * 0.1;
  bloom += sampleBright(uv + vec2(-texel.x, 0.0)) * 0.1;
  bloom += sampleBright(uv + vec2(0.0,  texel.y)) * 0.1;
  bloom += sampleBright(uv + vec2(0.0, -texel.y)) * 0.1;

  // Diagonal neighbors (weight 0.06 each)
  bloom += sampleBright(uv + vec2( texel.x,  texel.y)) * 0.06;
  bloom += sampleBright(uv + vec2(-texel.x,  texel.y)) * 0.06;
  bloom += sampleBright(uv + vec2( texel.x, -texel.y)) * 0.06;
  bloom += sampleBright(uv + vec2(-texel.x, -texel.y)) * 0.06;

  // Far cardinal (2x radius, weight 0.04 each)
  bloom += sampleBright(uv + vec2( texel.x * 2.0, 0.0)) * 0.04;
  bloom += sampleBright(uv + vec2(-texel.x * 2.0, 0.0)) * 0.04;
  bloom += sampleBright(uv + vec2(0.0,  texel.y * 2.0)) * 0.04;
  bloom += sampleBright(uv + vec2(0.0, -texel.y * 2.0)) * 0.04;

  fragColor = vec4(original + bloom * uIntensity, 1.0);
}
`;

export class BloomEffect implements ShaderEffect {
  readonly name = 'bloom';
  private config: BloomEffectConfig;

  constructor(config: Partial<BloomEffectConfig> = {}) {
    this.config = { ...DEFAULT_BLOOM_CONFIG, ...config };
  }

  getConfig(): BloomEffectConfig {
    return this.config;
  }

  init(_gl: WebGL2RenderingContext): void {
    // No additional GL resources needed
  }

  getFragmentSource(): string {
    return BLOOM_FRAGMENT;
  }

  setUniforms(gl: WebGL2RenderingContext, program: WebGLProgram, _time: number, resolution: [number, number]): void {
    gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), resolution[0], resolution[1]);
    gl.uniform1f(gl.getUniformLocation(program, 'uThreshold'), this.config.threshold);
    gl.uniform1f(gl.getUniformLocation(program, 'uIntensity'), this.config.intensity);
    gl.uniform1f(gl.getUniformLocation(program, 'uRadius'), this.config.radius);
  }

  dispose(_gl: WebGL2RenderingContext): void {
    // No resources to clean up
  }
}
