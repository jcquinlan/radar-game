import { describe, it, expect, vi } from 'vitest';
import { CRTEffect, DEFAULT_CRT_CONFIG } from './CRTEffect';

function createMockGL() {
  return {
    getUniformLocation: vi.fn((_prog: unknown, name: string) => ({ name })),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
  } as unknown as WebGL2RenderingContext;
}

describe('CRTEffect', () => {
  it('initializes with default config', () => {
    const effect = new CRTEffect();
    expect(effect.name).toBe('crt');
    expect(effect.getConfig()).toEqual(DEFAULT_CRT_CONFIG);
  });

  it('accepts custom config overrides', () => {
    const effect = new CRTEffect({ curvature: 0.05, scanlineIntensity: 0.4 });
    const config = effect.getConfig();
    expect(config.curvature).toBe(0.05);
    expect(config.scanlineIntensity).toBe(0.4);
    // Other values should be defaults
    expect(config.vignetteStrength).toBe(DEFAULT_CRT_CONFIG.vignetteStrength);
    expect(config.aberrationAmount).toBe(DEFAULT_CRT_CONFIG.aberrationAmount);
    expect(config.glowStrength).toBe(DEFAULT_CRT_CONFIG.glowStrength);
  });

  it('returns a GLSL fragment shader source', () => {
    const effect = new CRTEffect();
    const source = effect.getFragmentSource();
    expect(source).toContain('#version 300 es');
    expect(source).toContain('void main()');
    expect(source).toContain('uSource');
  });

  it('sets all uniforms with correct values', () => {
    const effect = new CRTEffect({ curvature: 0.03, vignetteStrength: 0.5 });
    const gl = createMockGL();
    const program = {} as WebGLProgram;

    effect.setUniforms(gl, program, 1.5, [1920, 1080]);

    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uTime' }, 1.5);
    expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'uResolution' }, 1920, 1080);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uCurvature' }, 0.03);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uVignetteStrength' }, 0.5);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uScanlineIntensity' }, DEFAULT_CRT_CONFIG.scanlineIntensity);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uAberrationAmount' }, DEFAULT_CRT_CONFIG.aberrationAmount);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uGlowStrength' }, DEFAULT_CRT_CONFIG.glowStrength);
  });
});
