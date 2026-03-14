import { ShaderEffect } from '../ShaderEffect';

export interface CRTEffectConfig {
  /** Barrel distortion curvature amount (0 = none, 0.05 = heavy) */
  curvature: number;
  /** Scanline darkness (0 = no scanlines, 1 = fully dark lines) */
  scanlineIntensity: number;
  /** Vignette edge darkening (0 = none, 1 = heavy) */
  vignetteStrength: number;
  /** Chromatic aberration offset in UV space */
  aberrationAmount: number;
  /** Phosphor glow bloom strength */
  glowStrength: number;
}

export const DEFAULT_CRT_CONFIG: CRTEffectConfig = {
  curvature: 0.02,
  scanlineIntensity: 0.15,
  vignetteStrength: 0.1,
  aberrationAmount: 0.001,
  glowStrength: 0.15,
};

const CRT_FRAGMENT = `#version 300 es
precision mediump float;

uniform sampler2D uSource;
uniform float uTime;
uniform vec2 uResolution;
uniform float uCurvature;
uniform float uScanlineIntensity;
uniform float uVignetteStrength;
uniform float uAberrationAmount;
uniform float uGlowStrength;

out vec4 fragColor;

vec2 barrelDistort(vec2 uv) {
  vec2 centered = uv - 0.5;
  float r2 = dot(centered, centered);
  centered *= 1.0 + uCurvature * r2;
  return centered + 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // Flip Y: WebGL has origin at bottom-left, canvas at top-left
  uv.y = 1.0 - uv.y;

  // Barrel distortion
  vec2 distorted = barrelDistort(uv);

  // Discard pixels outside the curved screen
  if (distorted.x < 0.0 || distorted.x > 1.0 || distorted.y < 0.0 || distorted.y > 1.0) {
    fragColor = vec4(0.0);
    return;
  }

  // Chromatic aberration — offset R and B channels
  float r = texture(uSource, vec2(distorted.x + uAberrationAmount, distorted.y)).r;
  float g = texture(uSource, distorted).g;
  float b = texture(uSource, vec2(distorted.x - uAberrationAmount, distorted.y)).b;
  vec3 color = vec3(r, g, b);

  // Phosphor glow — sample blurred neighbors and add
  vec2 texel = 1.0 / uResolution;
  vec3 blur = vec3(0.0);
  blur += texture(uSource, distorted + vec2(-texel.x, 0.0)).rgb;
  blur += texture(uSource, distorted + vec2( texel.x, 0.0)).rgb;
  blur += texture(uSource, distorted + vec2(0.0, -texel.y)).rgb;
  blur += texture(uSource, distorted + vec2(0.0,  texel.y)).rgb;
  blur *= 0.25;
  color += (blur - color) * uGlowStrength;

  // Scanlines — horizontal darkening
  float scanline = sin(distorted.y * uResolution.y * 3.14159) * 0.5 + 0.5;
  color *= 1.0 - uScanlineIntensity * (1.0 - scanline);

  // Vignette
  vec2 vigUV = distorted - 0.5;
  float vignette = 1.0 - dot(vigUV, vigUV) * uVignetteStrength * 4.0;
  color *= clamp(vignette, 0.0, 1.0);

  fragColor = vec4(color, 1.0);
}
`;

export class CRTEffect implements ShaderEffect {
  readonly name = 'crt';
  private config: CRTEffectConfig;

  constructor(config: Partial<CRTEffectConfig> = {}) {
    this.config = { ...DEFAULT_CRT_CONFIG, ...config };
  }

  getConfig(): CRTEffectConfig {
    return this.config;
  }

  init(_gl: WebGL2RenderingContext): void {
    // No additional GL resources needed — all config is via uniforms
  }

  getFragmentSource(): string {
    return CRT_FRAGMENT;
  }

  setUniforms(gl: WebGL2RenderingContext, program: WebGLProgram, time: number, resolution: [number, number]): void {
    gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
    gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), resolution[0], resolution[1]);
    gl.uniform1f(gl.getUniformLocation(program, 'uCurvature'), this.config.curvature);
    gl.uniform1f(gl.getUniformLocation(program, 'uScanlineIntensity'), this.config.scanlineIntensity);
    gl.uniform1f(gl.getUniformLocation(program, 'uVignetteStrength'), this.config.vignetteStrength);
    gl.uniform1f(gl.getUniformLocation(program, 'uAberrationAmount'), this.config.aberrationAmount);
    gl.uniform1f(gl.getUniformLocation(program, 'uGlowStrength'), this.config.glowStrength);
  }

  dispose(_gl: WebGL2RenderingContext): void {
    // No resources to clean up
  }
}
