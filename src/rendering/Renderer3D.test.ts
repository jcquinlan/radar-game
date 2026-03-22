import { describe, it, expect, vi } from 'vitest';
import { Renderer3D } from './Renderer3D';

function createMockGL() {
  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    DEPTH_TEST: 2929,
    LEQUAL: 515,
    CULL_FACE: 2884,
    BACK: 1029,
    COLOR_BUFFER_BIT: 16384,
    DEPTH_BUFFER_BIT: 256,
    TRIANGLES: 4,
    UNSIGNED_SHORT: 5123,
    FLOAT: 5126,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    STATIC_DRAW: 35044,
    createShader: vi.fn(() => ({ __shader: true })),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    createProgram: vi.fn(() => ({ __program: true })),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn(() => ({ __loc: true })),
    uniform1f: vi.fn(),
    uniform3fv: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    enable: vi.fn(),
    depthFunc: vi.fn(),
    cullFace: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    viewport: vi.fn(),
    createVertexArray: vi.fn(() => ({ __vao: true })),
    bindVertexArray: vi.fn(),
    deleteVertexArray: vi.fn(),
    createBuffer: vi.fn(() => ({ __buffer: true })),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    deleteBuffer: vi.fn(),
    drawElements: vi.fn(),
    deleteProgram: vi.fn(),
  } as unknown as WebGL2RenderingContext;
  return gl;
}

function withMockRenderer(fn: (renderer: Renderer3D, gl: ReturnType<typeof createMockGL>) => void) {
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
    const renderer = Renderer3D.create(sourceCanvas)!;
    expect(renderer).not.toBeNull();
    fn(renderer, mockGL);
    renderer.dispose();
  } finally {
    HTMLCanvasElement.prototype.getContext = origGetContext;
  }
}

describe('Renderer3D', () => {
  describe('create', () => {
    it('returns null when WebGL2 is not available', () => {
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = 800;
      sourceCanvas.height = 600;
      document.body.appendChild(sourceCanvas);
      const renderer = Renderer3D.create(sourceCanvas);
      expect(renderer).toBeNull();
    });

    it('creates a 3D canvas behind the source canvas', () => {
      withMockRenderer((renderer) => {
        const canvas3d = renderer.getCanvas();
        expect(canvas3d).toBeInstanceOf(HTMLCanvasElement);
        expect(canvas3d.style.zIndex).toBe('0');
        expect(canvas3d.style.pointerEvents).toBe('none');
      });
    });
  });

  describe('setClearColor', () => {
    it('sets the clear color from a 6-digit hex string', () => {
      withMockRenderer((renderer, gl) => {
        renderer.setClearColor('#1a2b3c');
        // Need to call beginFrame to see the clearColor call
        renderer.beginFrame(0, 0, 0, 1);
        expect(gl.clearColor).toHaveBeenCalledWith(
          expect.closeTo(0x1a / 255, 2),
          expect.closeTo(0x2b / 255, 2),
          expect.closeTo(0x3c / 255, 2),
          1
        );
      });
    });

    it('sets the clear color from a 3-digit hex string', () => {
      withMockRenderer((renderer, gl) => {
        renderer.setClearColor('#abc');
        renderer.beginFrame(0, 0, 0, 1);
        expect(gl.clearColor).toHaveBeenCalledWith(
          expect.closeTo(0xaa / 255, 2),
          expect.closeTo(0xbb / 255, 2),
          expect.closeTo(0xcc / 255, 2),
          1
        );
      });
    });
  });

  describe('drawMeshTinted', () => {
    it('sets tint and flash uniforms before drawing, then resets them', () => {
      withMockRenderer((renderer, gl) => {
        const mesh = renderer.uploadMesh({
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          colors: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0]),
          indices: new Uint16Array([0, 1, 2]),
        });

        renderer.beginFrame(0, 0, 0, 1);

        // Clear call counts to isolate drawMeshTinted calls
        (gl.uniform3fv as ReturnType<typeof vi.fn>).mockClear();
        (gl.uniform1f as ReturnType<typeof vi.fn>).mockClear();

        renderer.drawMeshTinted(mesh, 10, 20, 0, 1, 0.8, 0.2, 0.1, 0.5);

        // Should have set tint color, then reset it (2 calls)
        const uniform3fvCalls = (gl.uniform3fv as ReturnType<typeof vi.fn>).mock.calls;
        expect(uniform3fvCalls.length).toBe(2);
        // First call: set tint
        expect(uniform3fvCalls[0][1]).toEqual([0.8, 0.2, 0.1]);
        // Second call: reset to white
        expect(uniform3fvCalls[1][1]).toEqual([1, 1, 1]);

        // Should have set flash, then reset it (2 calls)
        const uniform1fCalls = (gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls;
        expect(uniform1fCalls.length).toBe(2);
        expect(uniform1fCalls[0][1]).toBe(0.5);
        expect(uniform1fCalls[1][1]).toBe(0);
      });
    });
  });

  describe('getCanvas', () => {
    it('returns the underlying 3D canvas element', () => {
      withMockRenderer((renderer) => {
        const canvas3d = renderer.getCanvas();
        expect(canvas3d).toBeInstanceOf(HTMLCanvasElement);
        expect(canvas3d.style.position).toBe('absolute');
      });
    });
  });
});
