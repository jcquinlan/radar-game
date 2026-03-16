import { describe, it, expect, vi } from 'vitest';
import { BloomEffect, DEFAULT_BLOOM_CONFIG } from './BloomEffect';

function createMockGL() {
  return {
    getUniformLocation: vi.fn((_prog: unknown, name: string) => ({ name })),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
  } as unknown as WebGL2RenderingContext;
}

describe('BloomEffect', () => {
  it('uses default config when none provided', () => {
    const effect = new BloomEffect();
    expect(effect.getConfig()).toEqual(DEFAULT_BLOOM_CONFIG);
  });

  it('merges partial config with defaults', () => {
    const effect = new BloomEffect({ threshold: 0.5 });
    expect(effect.getConfig().threshold).toBe(0.5);
    expect(effect.getConfig().intensity).toBe(0.3);
    expect(effect.getConfig().radius).toBe(3.5);
  });

  it('has name "bloom"', () => {
    const effect = new BloomEffect();
    expect(effect.name).toBe('bloom');
  });

  it('returns valid GLSL fragment source', () => {
    const effect = new BloomEffect();
    const source = effect.getFragmentSource();
    expect(source).toContain('#version 300 es');
    expect(source).toContain('uSource');
    expect(source).toContain('uThreshold');
    expect(source).toContain('uIntensity');
  });

  it('sets all uniforms with config values', () => {
    const effect = new BloomEffect({ threshold: 0.4, intensity: 0.6, radius: 5.0 });
    const gl = createMockGL();
    const program = {} as WebGLProgram;

    effect.setUniforms(gl, program, 1.0, [800, 600]);

    expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'uResolution' }, 800, 600);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uThreshold' }, 0.4);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uIntensity' }, 0.6);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uRadius' }, 5.0);
  });
});
