import { describe, it, expect, vi } from 'vitest';
import { DamageDistortionEffect, DEFAULT_DAMAGE_CONFIG } from './DamageDistortionEffect';

function createMockGL() {
  return {
    getUniformLocation: vi.fn((_prog: unknown, name: string) => ({ name })),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
  } as unknown as WebGL2RenderingContext;
}

describe('DamageDistortionEffect', () => {
  it('uses default config when none provided', () => {
    const effect = new DamageDistortionEffect();
    expect(effect.getConfig()).toEqual(DEFAULT_DAMAGE_CONFIG);
  });

  it('merges partial config with defaults', () => {
    const effect = new DamageDistortionEffect({ maxAberration: 0.01 });
    expect(effect.getConfig().maxAberration).toBe(0.01);
    expect(effect.getConfig().maxCurvature).toBe(DEFAULT_DAMAGE_CONFIG.maxCurvature);
  });

  it('has name "damage_distortion"', () => {
    const effect = new DamageDistortionEffect();
    expect(effect.name).toBe('damage_distortion');
  });

  it('starts with zero damage intensity', () => {
    const effect = new DamageDistortionEffect();
    expect(effect.getDamageIntensity()).toBe(0);
  });

  it('clamps damage intensity to 0-1 range', () => {
    const effect = new DamageDistortionEffect();

    effect.setDamageIntensity(0.5);
    expect(effect.getDamageIntensity()).toBe(0.5);

    effect.setDamageIntensity(2.0);
    expect(effect.getDamageIntensity()).toBe(1);

    effect.setDamageIntensity(-0.5);
    expect(effect.getDamageIntensity()).toBe(0);
  });

  it('returns valid GLSL fragment source', () => {
    const effect = new DamageDistortionEffect();
    const source = effect.getFragmentSource();
    expect(source).toContain('#version 300 es');
    expect(source).toContain('uDamageIntensity');
    expect(source).toContain('uMaxAberration');
  });

  it('sets all uniforms including damage intensity', () => {
    const effect = new DamageDistortionEffect({ maxAberration: 0.01, maxCurvature: 0.05, maxNoise: 0.1 });
    effect.setDamageIntensity(0.7);

    const gl = createMockGL();
    const program = {} as WebGLProgram;

    effect.setUniforms(gl, program, 2.5, [800, 600]);

    expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'uResolution' }, 800, 600);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uTime' }, 2.5);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uDamageIntensity' }, 0.7);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uMaxAberration' }, 0.01);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uMaxCurvature' }, 0.05);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'uMaxNoise' }, 0.1);
  });
});
