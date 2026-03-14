export interface ShaderEffect {
  readonly name: string;
  init(gl: WebGL2RenderingContext): void;
  setUniforms(gl: WebGL2RenderingContext, program: WebGLProgram, time: number, resolution: [number, number]): void;
  getFragmentSource(): string;
  dispose(gl: WebGL2RenderingContext): void;
}

export function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create shader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Unknown error';
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

export function createProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create program');
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'Unknown error';
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}
