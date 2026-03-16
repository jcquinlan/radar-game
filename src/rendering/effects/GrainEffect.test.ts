import { describe, it, expect, vi } from 'vitest';
import { GrainEffect, DEFAULT_GRAIN_CONFIG } from './GrainEffect';

function createMockGL() {
  return {
    getUniformLocation: vi.fn((_prog: unknown, name: string) => ({ name })),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
  } as unknown as WebGL2RenderingContext;
}

describe('GrainEffect', () => {
  it('uses default config when none provided', () => {
    const effect = new GrainEffect();
    expect(effect.getConfig()).toEqual(DEFAULT_GRAIN_CONFIG);
  });

  it('merges partial config with defaults', () => {
    const effect = new GrainEffect({ intensity: 0.1 });
    expect(effect.getConfig().intensity).toBe(0.1);
    expect(effect.getConfig().scale).toBe(DEFAULT_GRAIN_CONFIG.scale);
  });

  it('has name "grain"', () => {
    const effect = new GrainEffect();
    expect(effect.name).toBe('grain');
  });

  it('returns valid GLSL fragment source with required uniforms', () => {
    const effect = new GrainEffect();
    const source = effect.getFragmentSource();
    expect(source).toContain('#version 300 es');
    expect(source).toContain('uSource');
    expect(source).toContain('uFlipY');
    expect(source).toContain('uTime');
    expect(source).toContain('uResolution');
  });

  it('sets all uniforms including time and resolution', () => {
    const effect = new GrainEffect({ intensity: 0.08, scale: 2.0 });
    const gl = createMockGL();
    const program = {} as WebGLProgram;

    effect.setUniforms(gl, program, 1.5, [1024, 768]);

    expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'uResolution' }, 1024, 768);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uTime' }, 1.5);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uIntensity' }, 0.08);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uScale' }, 2.0);
  });

  it('init and dispose are safe no-ops', () => {
    const effect = new GrainEffect();
    const gl = createMockGL();
    // Should not throw
    effect.init(gl);
    effect.dispose(gl);
  });
});
