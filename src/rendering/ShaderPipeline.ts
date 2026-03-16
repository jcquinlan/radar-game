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

interface EffectSlot {
  effect: ShaderEffect;
  program: WebGLProgram;
  fragmentShader: WebGLShader;
}

export class ShaderPipeline {
  private gl: WebGL2RenderingContext;
  private glCanvas: HTMLCanvasElement;
  private sourceCanvas: HTMLCanvasElement;
  private sourceTexture: WebGLTexture;
  private vao: WebGLVertexArrayObject;
  private vertexShader: WebGLShader;
  private passthroughProgram: WebGLProgram;
  private passthroughFragment: WebGLShader;
  private effects: EffectSlot[] = [];
  private _enabled = true;

  // Ping-pong framebuffers for multi-pass rendering
  private fbos: WebGLFramebuffer[] = [];
  private fboTextures: WebGLTexture[] = [];
  private fboWidth = 0;
  private fboHeight = 0;

  private constructor(gl: WebGL2RenderingContext, glCanvas: HTMLCanvasElement, sourceCanvas: HTMLCanvasElement) {
    this.gl = gl;
    this.glCanvas = glCanvas;
    this.sourceCanvas = sourceCanvas;

    // Create vertex shader (shared across all effects)
    this.vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);

    // Create texture for the 2D canvas source
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');
    this.sourceTexture = texture;
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create VAO (empty — vertex shader uses gl_VertexID)
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    this.vao = vao;

    // Build passthrough program
    this.passthroughFragment = compileShader(gl, gl.FRAGMENT_SHADER, PASSTHROUGH_FRAGMENT);
    this.passthroughProgram = createProgram(gl, this.vertexShader, this.passthroughFragment);
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
    if (!sourceCanvas.parentNode) return null;
    sourceCanvas.parentNode.insertBefore(glCanvas, sourceCanvas.nextSibling);

    return new ShaderPipeline(gl, glCanvas, sourceCanvas);
  }

  addEffect(effect: ShaderEffect): void {
    const { gl } = this;
    effect.init(gl);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, effect.getFragmentSource());
    const program = createProgram(gl, this.vertexShader, fragmentShader);
    this.effects.push({ effect, program, fragmentShader });

    // Ensure we have enough FBOs for multi-pass (need N-1 FBOs for N effects)
    this.ensureFBOs();
  }

  getEffect<T extends ShaderEffect>(name: string): T | null {
    const slot = this.effects.find(s => s.effect.name === name);
    return slot ? slot.effect as T : null;
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

  private ensureFBOs(): void {
    const { gl } = this;
    const needed = Math.max(0, this.effects.length - 1);
    const w = this.sourceCanvas.width;
    const h = this.sourceCanvas.height;

    // Rebuild if count changed or size changed
    if (this.fbos.length === needed && this.fboWidth === w && this.fboHeight === h) return;

    // Clean up old FBOs
    for (const fbo of this.fbos) gl.deleteFramebuffer(fbo);
    for (const tex of this.fboTextures) gl.deleteTexture(tex);
    this.fbos = [];
    this.fboTextures = [];

    for (let i = 0; i < needed; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

      this.fbos.push(fbo);
      this.fboTextures.push(tex);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fboWidth = w;
    this.fboHeight = h;
  }

  render(time: number): void {
    if (!this._enabled) return;

    const { gl } = this;
    const w = this.sourceCanvas.width;
    const h = this.sourceCanvas.height;

    // Sync size if needed
    if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
      this.handleResize();
      this.ensureFBOs();
    }

    // Upload the 2D canvas as a texture
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas);

    gl.bindVertexArray(this.vao);

    if (this.effects.length === 0) {
      // No effects — passthrough
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(this.passthroughProgram);
      const loc = gl.getUniformLocation(this.passthroughProgram, 'uSource');
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
      gl.uniform1i(loc, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }

    // Multi-pass: each effect reads from the previous output, writes to next FBO (or screen for last)
    let inputTexture = this.sourceTexture;

    for (let i = 0; i < this.effects.length; i++) {
      const slot = this.effects[i];
      const isLast = i === this.effects.length - 1;

      if (isLast) {
        // Render to screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        // Render to FBO
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[i]);
      }

      gl.viewport(0, 0, w, h);
      gl.useProgram(slot.program);

      // Bind input texture
      const sourceLoc = gl.getUniformLocation(slot.program, 'uSource');
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTexture);
      gl.uniform1i(sourceLoc, 0);

      // Set effect-specific uniforms
      slot.effect.setUniforms(gl, slot.program, time, [w, h]);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Next effect reads from this FBO's texture
      if (!isLast) {
        inputTexture = this.fboTextures[i];
      }
    }
  }

  dispose(): void {
    const { gl } = this;

    for (const slot of this.effects) {
      slot.effect.dispose(gl);
      gl.deleteProgram(slot.program);
      gl.deleteShader(slot.fragmentShader);
    }
    this.effects = [];

    gl.deleteProgram(this.passthroughProgram);
    gl.deleteShader(this.passthroughFragment);

    for (const fbo of this.fbos) gl.deleteFramebuffer(fbo);
    for (const tex of this.fboTextures) gl.deleteTexture(tex);
    this.fbos = [];
    this.fboTextures = [];

    gl.deleteShader(this.vertexShader);
    gl.deleteTexture(this.sourceTexture);
    gl.deleteVertexArray(this.vao);

    // Remove GL canvas overlay
    this.glCanvas.remove();
  }
}
