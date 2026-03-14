import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShaderPipeline } from './ShaderPipeline';

function createMockGL() {
  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    TEXTURE_2D: 3553,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    LINEAR: 9729,
    CLAMP_TO_EDGE: 33071,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    TEXTURE0: 33984,
    TRIANGLES: 4,
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
    createTexture: vi.fn(() => ({ __texture: true })),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    deleteTexture: vi.fn(),
    createVertexArray: vi.fn(() => ({ __vao: true })),
    bindVertexArray: vi.fn(),
    deleteVertexArray: vi.fn(),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn(() => ({ __loc: true })),
    uniform1i: vi.fn(),
    activeTexture: vi.fn(),
    drawArrays: vi.fn(),
    viewport: vi.fn(),
  } as unknown as WebGL2RenderingContext;
  return gl;
}

describe('ShaderPipeline', () => {
  let sourceCanvas: HTMLCanvasElement;

  beforeEach(() => {
    sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 800;
    sourceCanvas.height = 600;
    document.body.appendChild(sourceCanvas);
  });

  describe('create', () => {
    it('returns null when WebGL2 is not available', () => {
      // jsdom does not support WebGL2, so getContext("webgl2") returns null
      const pipeline = ShaderPipeline.create(sourceCanvas);
      expect(pipeline).toBeNull();
    });

    it('returns a pipeline when WebGL2 is available', () => {
      const mockGL = createMockGL();
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement, type: string) {
        if (type === 'webgl2') return mockGL;
        return origGetContext.call(this, type);
      }) as typeof origGetContext;

      try {
        const pipeline = ShaderPipeline.create(sourceCanvas);
        expect(pipeline).not.toBeNull();
        pipeline!.dispose();
      } finally {
        HTMLCanvasElement.prototype.getContext = origGetContext;
      }
    });
  });

  describe('setEnabled', () => {
    it('toggles the enabled state', () => {
      const mockGL = createMockGL();
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement, type: string) {
        if (type === 'webgl2') return mockGL;
        return origGetContext.call(this, type);
      }) as typeof origGetContext;

      try {
        const pipeline = ShaderPipeline.create(sourceCanvas)!;
        expect(pipeline.enabled).toBe(true);

        pipeline.setEnabled(false);
        expect(pipeline.enabled).toBe(false);

        pipeline.setEnabled(true);
        expect(pipeline.enabled).toBe(true);

        pipeline.dispose();
      } finally {
        HTMLCanvasElement.prototype.getContext = origGetContext;
      }
    });
  });

  describe('dispose', () => {
    it('cleans up GL resources', () => {
      const mockGL = createMockGL();
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement, type: string) {
        if (type === 'webgl2') return mockGL;
        return origGetContext.call(this, type);
      }) as typeof origGetContext;

      try {
        const pipeline = ShaderPipeline.create(sourceCanvas)!;
        pipeline.dispose();
        expect(mockGL.deleteTexture).toHaveBeenCalled();
        expect(mockGL.deleteVertexArray).toHaveBeenCalled();
        expect(mockGL.deleteProgram).toHaveBeenCalled();
      } finally {
        HTMLCanvasElement.prototype.getContext = origGetContext;
      }
    });
  });
});
