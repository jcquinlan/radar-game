import { ShaderEffect, compileShader, createProgram } from './ShaderEffect';

const VERTEX_SOURCE = `#version 300 es
// Fullscreen triangle: 3 vertices cover the entire screen
// No vertex buffer needed — vertex ID generates positions
void main() {
  float x = float((gl_VertexID & 1) << 2) - 1.0;
  float y = float((gl_VertexID & 2) << 1) - 1.0;
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

const PASSTHROUGH_FRAGMENT = `#version 300 es
precision mediump float;
uniform sampler2D uSource;
out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uSource, 0));
  fragColor = texture(uSource, uv);
}
`;

export class ShaderPipeline {
  private gl: WebGL2RenderingContext;
  private glCanvas: HTMLCanvasElement;
  private sourceCanvas: HTMLCanvasElement;
  private texture: WebGLTexture;
  private vao: WebGLVertexArrayObject;
  private program: WebGLProgram | null = null;
  private vertexShader: WebGLShader;
  private fragmentShader: WebGLShader | null = null;
  private effect: ShaderEffect | null = null;
  private _enabled = true;

  private constructor(gl: WebGL2RenderingContext, glCanvas: HTMLCanvasElement, sourceCanvas: HTMLCanvasElement) {
    this.gl = gl;
    this.glCanvas = glCanvas;
    this.sourceCanvas = sourceCanvas;

    // Create vertex shader (shared across all effects)
    this.vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);

    // Create texture for the 2D canvas source
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create VAO (empty — vertex shader uses gl_VertexID)
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    this.vao = vao;

    // Build initial passthrough program
    this.buildProgram(PASSTHROUGH_FRAGMENT);
  }

  private buildProgram(fragmentSource: string): void {
    const { gl } = this;

    // Clean up old fragment shader and program
    if (this.fragmentShader) {
      gl.deleteShader(this.fragmentShader);
    }
    if (this.program) {
      gl.deleteProgram(this.program);
    }

    this.fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    this.program = createProgram(gl, this.vertexShader, this.fragmentShader);
  }

  static create(sourceCanvas: HTMLCanvasElement): ShaderPipeline | null {
    const glCanvas = document.createElement('canvas');
    glCanvas.width = sourceCanvas.width;
    glCanvas.height = sourceCanvas.height;
    glCanvas.style.position = 'absolute';
    glCanvas.style.top = '0';
    glCanvas.style.left = '0';
    glCanvas.style.width = '100%';
    glCanvas.style.height = '100%';
    // Let clicks pass through to the source canvas underneath (preserves event handlers)
    glCanvas.style.pointerEvents = 'none';

    const gl = glCanvas.getContext('webgl2');
    if (!gl) return null;

    // Insert WebGL canvas on top of the source canvas
    sourceCanvas.parentNode?.insertBefore(glCanvas, sourceCanvas.nextSibling);

    return new ShaderPipeline(gl, glCanvas, sourceCanvas);
  }

  addEffect(effect: ShaderEffect): void {
    this.effect = effect;
    effect.init(this.gl);
    this.buildProgram(effect.getFragmentSource());
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.glCanvas.style.display = enabled ? '' : 'none';
  }

  handleResize(): void {
    this.glCanvas.width = this.sourceCanvas.width;
    this.glCanvas.height = this.sourceCanvas.height;
    this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
  }

  render(time: number): void {
    if (!this._enabled || !this.program) return;

    const { gl } = this;
    const w = this.sourceCanvas.width;
    const h = this.sourceCanvas.height;

    // Sync size if needed
    if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
      this.handleResize();
    }

    // Upload the 2D canvas as a texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas);

    // Draw fullscreen triangle
    gl.useProgram(this.program);

    // Set source texture uniform
    const sourceLoc = gl.getUniformLocation(this.program, 'uSource');
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(sourceLoc, 0);

    // Set effect-specific uniforms
    if (this.effect) {
      this.effect.setUniforms(gl, this.program, time, [w, h]);
    }

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const { gl } = this;

    if (this.effect) {
      this.effect.dispose(gl);
      this.effect = null;
    }

    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.fragmentShader) {
      gl.deleteShader(this.fragmentShader);
      this.fragmentShader = null;
    }
    gl.deleteShader(this.vertexShader);
    gl.deleteTexture(this.texture);
    gl.deleteVertexArray(this.vao);

    // Remove GL canvas overlay
    this.glCanvas.remove();
  }
}
