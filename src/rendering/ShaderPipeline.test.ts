import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShaderPipeline } from './ShaderPipeline';
import { ShaderEffect } from './ShaderEffect';

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
    FRAMEBUFFER: 36160,
    COLOR_ATTACHMENT0: 36064,
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
    uniform1f: vi.fn(),
    activeTexture: vi.fn(),
    drawArrays: vi.fn(),
    viewport: vi.fn(),
    createFramebuffer: vi.fn(() => ({ __fbo: true })),
    bindFramebuffer: vi.fn(),
    deleteFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
  } as unknown as WebGL2RenderingContext;
  return gl;
}

function createMockEffect(name: string): ShaderEffect {
  return {
    name,
    init: vi.fn(),
    setUniforms: vi.fn(),
    getFragmentSource: () => `#version 300 es
precision mediump float;
uniform sampler2D uSource;
out vec4 fragColor;
void main() { fragColor = texture(uSource, vec2(0.0)); }`,
    dispose: vi.fn(),
  };
}

function withMockGL(fn: (pipeline: ShaderPipeline, gl: WebGL2RenderingContext) => void) {
  const mockGL = createMockGL();
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement, type: string) {
    if (type === 'webgl2') return mockGL;
    return origGetContext.call(this, type);
  }) as typeof origGetContext;

  try {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 800;
    sourceCanvas.height = 600;
    document.body.appendChild(sourceCanvas);
    const pipeline = ShaderPipeline.create(sourceCanvas)!;
    fn(pipeline, mockGL);
    pipeline.dispose();
  } finally {
    HTMLCanvasElement.prototype.getContext = origGetContext;
  }
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
      const pipeline = ShaderPipeline.create(sourceCanvas);
      expect(pipeline).toBeNull();
    });

    it('returns a pipeline when WebGL2 is available', () => {
      withMockGL((pipeline) => {
        expect(pipeline).not.toBeNull();
      });
    });
  });

  describe('setEnabled', () => {
    it('toggles the enabled state', () => {
      withMockGL((pipeline) => {
        expect(pipeline.enabled).toBe(true);
        pipeline.setEnabled(false);
        expect(pipeline.enabled).toBe(false);
        pipeline.setEnabled(true);
        expect(pipeline.enabled).toBe(true);
      });
    });
  });

  describe('addEffect', () => {
    it('initializes the effect and compiles its shader', () => {
      withMockGL((pipeline, gl) => {
        const effect = createMockEffect('test');
        pipeline.addEffect(effect);
        expect(effect.init).toHaveBeenCalledWith(gl);
      });
    });

    it('supports multiple effects', () => {
      withMockGL((pipeline) => {
        const e1 = createMockEffect('first');
        const e2 = createMockEffect('second');
        pipeline.addEffect(e1);
        pipeline.addEffect(e2);
        expect(pipeline.getEffect('first')).toBe(e1);
        expect(pipeline.getEffect('second')).toBe(e2);
      });
    });
  });

  describe('getEffect', () => {
    it('returns null for unknown effect names', () => {
      withMockGL((pipeline) => {
        expect(pipeline.getEffect('nonexistent')).toBeNull();
      });
    });
  });

  describe('render', () => {
    it('does nothing when disabled', () => {
      withMockGL((pipeline, gl) => {
        pipeline.setEnabled(false);
        pipeline.render(0);
        expect(gl.drawArrays).not.toHaveBeenCalled();
      });
    });

    it('renders passthrough when no effects added', () => {
      withMockGL((pipeline, gl) => {
        pipeline.render(0);
        expect(gl.drawArrays).toHaveBeenCalledTimes(1);
        // Should render to screen (framebuffer null)
        expect(gl.bindFramebuffer).toHaveBeenCalledWith(gl.FRAMEBUFFER, null);
      });
    });

    it('renders single effect directly to screen', () => {
      withMockGL((pipeline, gl) => {
        const effect = createMockEffect('test');
        pipeline.addEffect(effect);
        pipeline.render(1.0);
        expect(effect.setUniforms).toHaveBeenCalled();
        expect(gl.drawArrays).toHaveBeenCalledTimes(1);
      });
    });

    it('renders multiple effects with intermediate FBOs', () => {
      withMockGL((pipeline, gl) => {
        pipeline.addEffect(createMockEffect('first'));
        pipeline.addEffect(createMockEffect('second'));
        pipeline.render(1.0);
        // Two draw calls: one to FBO, one to screen
        expect(gl.drawArrays).toHaveBeenCalledTimes(2);
        // First effect renders to FBO, second to screen
        expect(gl.createFramebuffer).toHaveBeenCalled();
      });
    });
  });

  describe('dispose', () => {
    it('cleans up all GL resources including FBOs', () => {
      withMockGL((pipeline, gl) => {
        pipeline.addEffect(createMockEffect('first'));
        pipeline.addEffect(createMockEffect('second'));
        // Force FBO creation by rendering
        pipeline.render(0);
        pipeline.dispose();
        expect(gl.deleteTexture).toHaveBeenCalled();
        expect(gl.deleteVertexArray).toHaveBeenCalled();
        expect(gl.deleteProgram).toHaveBeenCalled();
        expect(gl.deleteFramebuffer).toHaveBeenCalled();
      });
    });
  });
});
