import { describe, it, expect, vi } from 'vitest';
import { compileShader, createProgram } from './ShaderEffect';

function createMockGL(overrides: Record<string, unknown> = {}) {
  return {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    createShader: vi.fn(() => ({ __shader: true })),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({ __program: true })),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram: vi.fn(),
    ...overrides,
  } as unknown as WebGL2RenderingContext;
}

describe('compileShader', () => {
  it('compiles a shader and returns it', () => {
    const gl = createMockGL();
    const shader = compileShader(gl, gl.VERTEX_SHADER, 'void main() {}');
    expect(gl.createShader).toHaveBeenCalledWith(gl.VERTEX_SHADER);
    expect(gl.shaderSource).toHaveBeenCalledWith(shader, 'void main() {}');
    expect(gl.compileShader).toHaveBeenCalledWith(shader);
    expect(shader).toEqual({ __shader: true });
  });

  it('throws when createShader returns null', () => {
    const gl = createMockGL({ createShader: vi.fn(() => null) });
    expect(() => compileShader(gl, gl.VERTEX_SHADER, '')).toThrow('Failed to create shader');
  });

  it('throws with info log when compilation fails', () => {
    const gl = createMockGL({
      getShaderParameter: vi.fn(() => false),
      getShaderInfoLog: vi.fn(() => 'syntax error at line 1'),
    });
    expect(() => compileShader(gl, gl.FRAGMENT_SHADER, 'bad')).toThrow('Shader compile error: syntax error at line 1');
    expect(gl.deleteShader).toHaveBeenCalled();
  });
});

describe('createProgram', () => {
  it('links a program and returns it', () => {
    const gl = createMockGL();
    const vs = {} as WebGLShader;
    const fs = {} as WebGLShader;
    const program = createProgram(gl, vs, fs);
    expect(gl.attachShader).toHaveBeenCalledWith(program, vs);
    expect(gl.attachShader).toHaveBeenCalledWith(program, fs);
    expect(gl.linkProgram).toHaveBeenCalledWith(program);
    expect(program).toEqual({ __program: true });
  });

  it('throws when createProgram returns null', () => {
    const gl = createMockGL({ createProgram: vi.fn(() => null) });
    expect(() => createProgram(gl, {} as WebGLShader, {} as WebGLShader)).toThrow('Failed to create program');
  });

  it('throws with info log when linking fails', () => {
    const gl = createMockGL({
      getProgramParameter: vi.fn(() => false),
      getProgramInfoLog: vi.fn(() => 'link error: varying mismatch'),
    });
    expect(() => createProgram(gl, {} as WebGLShader, {} as WebGLShader)).toThrow('Program link error: link error: varying mismatch');
    expect(gl.deleteProgram).toHaveBeenCalled();
  });
});
