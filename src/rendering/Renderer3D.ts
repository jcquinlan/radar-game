import { compileShader, createProgram } from './ShaderEffect';
import { mat4, vec3, Vec3 } from './math3d';

// ─── Shader sources ──────────────────────────────────────────────────────

const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;

out vec3 vColor;
out vec3 vNormal;
out vec3 vWorldPos;

void main() {
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal = mat3(uModel) * aNormal;
  vColor = aColor;
  gl_Position = uProjection * uView * worldPos;
}
`;

const FRAGMENT_SOURCE = `#version 300 es
precision mediump float;

in vec3 vColor;
in vec3 vNormal;
in vec3 vWorldPos;

uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform vec3 uTintColor;
uniform float uDamageFlash;

out vec4 fragColor;

void main() {
  vec3 normal = normalize(vNormal);
  float diffuse = max(dot(normal, uLightDir), 0.0);
  vec3 lit = vColor * uTintColor * (uAmbient + vec3(diffuse));
  // Damage flash: mix toward white
  vec3 finalColor = mix(lit, vec3(1.0), uDamageFlash);
  fragColor = vec4(finalColor, 1.0);
}
`;

// ─── Types ───────────────────────────────────────────────────────────────

/** Raw mesh data to be uploaded to the GPU */
export interface Mesh {
  positions: Float32Array;  // xyz, 3 floats per vertex
  normals: Float32Array;    // xyz, 3 floats per vertex
  colors: Float32Array;     // rgb, 3 floats per vertex (0-1)
  indices: Uint16Array;     // triangle indices
}

/** GPU handle returned by uploadMesh, passed to drawMesh */
export interface MeshHandle {
  vao: WebGLVertexArrayObject;
  indexCount: number;
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
}

// ─── Hex color parsing ──────────────────────────────────────────────────

/** Parse a hex color string (#rgb, #rrggbb) into [r, g, b] floats 0-1 */
function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  let r: number, g: number, b: number;
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16) / 255;
    g = parseInt(h[1] + h[1], 16) / 255;
    b = parseInt(h[2] + h[2], 16) / 255;
  } else {
    r = parseInt(h.substring(0, 2), 16) / 255;
    g = parseInt(h.substring(2, 4), 16) / 255;
    b = parseInt(h.substring(4, 6), 16) / 255;
  }
  return [r, g, b];
}

// ─── Camera height and tilt ──────────────────────────────────────────────

/** Camera height above the ground plane */
const CAMERA_HEIGHT = 500;
/** Camera tilt angle in radians (~65 degrees from horizontal) */
const CAMERA_TILT = 65 * Math.PI / 180;
/** Half-width of the orthographic view at zoom=1 */
const ORTHO_HALF_SIZE = 400;

// ─── Light direction (above-right, normalized) ──────────────────────────

const LIGHT_DIR: Vec3 = vec3.normalize([0.4, 1.0, 0.3]);
const AMBIENT: Vec3 = [0.3, 0.3, 0.3];

// ─── Renderer class ─────────────────────────────────────────────────────

export class Renderer3D {
  private gl: WebGL2RenderingContext;
  private canvas3d: HTMLCanvasElement;
  private program: WebGLProgram;

  // Uniform locations (cached)
  private uProjection: WebGLUniformLocation | null;
  private uView: WebGLUniformLocation | null;
  private uModel: WebGLUniformLocation | null;
  private uLightDir: WebGLUniformLocation | null;
  private uAmbient: WebGLUniformLocation | null;
  private uTintColor: WebGLUniformLocation | null;
  private uDamageFlash: WebGLUniformLocation | null;

  // Clear color (defaults to transparent black)
  private clearR = 0;
  private clearG = 0;
  private clearB = 0;
  private clearA = 1;

  // Pre-allocated arrays for tint uniforms (avoid per-frame allocation)
  private tintArray = new Float32Array([1, 1, 1]);
  private defaultTint = new Float32Array([1, 1, 1]);

  // Current camera matrices (reused each frame)
  private projectionMatrix: Float32Array = mat4.identity();
  private viewMatrix: Float32Array = mat4.identity();

  private constructor(gl: WebGL2RenderingContext, canvas3d: HTMLCanvasElement, program: WebGLProgram) {
    this.gl = gl;
    this.canvas3d = canvas3d;
    this.program = program;

    gl.useProgram(program);
    this.uProjection = gl.getUniformLocation(program, 'uProjection');
    this.uView = gl.getUniformLocation(program, 'uView');
    this.uModel = gl.getUniformLocation(program, 'uModel');
    this.uLightDir = gl.getUniformLocation(program, 'uLightDir');
    this.uAmbient = gl.getUniformLocation(program, 'uAmbient');
    this.uTintColor = gl.getUniformLocation(program, 'uTintColor');
    this.uDamageFlash = gl.getUniformLocation(program, 'uDamageFlash');

    // Set static uniforms
    gl.uniform3fv(this.uLightDir, LIGHT_DIR);
    gl.uniform3fv(this.uAmbient, AMBIENT);

    // Set default tint (white = no tint) and no flash
    gl.uniform3fv(this.uTintColor, this.defaultTint);
    gl.uniform1f(this.uDamageFlash, 0);

    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Enable back-face culling
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  /**
   * Create a 3D renderer with a WebGL2 canvas behind the given 2D canvas.
   * Returns null if WebGL2 is not available or creation fails.
   */
  static create(sourceCanvas: HTMLCanvasElement): Renderer3D | null {
    const canvas3d = document.createElement('canvas');
    canvas3d.width = sourceCanvas.width;
    canvas3d.height = sourceCanvas.height;
    canvas3d.style.position = 'absolute';
    canvas3d.style.top = '0';
    canvas3d.style.left = '0';
    canvas3d.style.width = '100%';
    canvas3d.style.height = '100%';
    canvas3d.style.pointerEvents = 'none';
    canvas3d.style.zIndex = '0';

    const gl = canvas3d.getContext('webgl2');
    if (!gl) return null;

    if (!sourceCanvas.parentNode) return null;

    // Insert BEFORE the 2D canvas so it renders behind
    sourceCanvas.parentNode.insertBefore(canvas3d, sourceCanvas);

    // Make the 2D canvas transparent so 3D content shows through
    // (The 2D canvas draws on top with its own opaque backgrounds for now,
    //  but this enables the layering once the 2D canvas goes transparent)
    sourceCanvas.style.position = 'absolute';
    sourceCanvas.style.top = '0';
    sourceCanvas.style.left = '0';

    try {
      const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
      const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
      const program = createProgram(gl, vertexShader, fragmentShader);
      return new Renderer3D(gl, canvas3d, program);
    } catch {
      canvas3d.remove();
      return null;
    }
  }

  /** Upload mesh data to the GPU. Returns a handle for drawing. */
  uploadMesh(mesh: Mesh): MeshHandle {
    const { gl } = this;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    gl.bindVertexArray(vao);

    // Position buffer — location 0
    const positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    // Normal buffer — location 1
    const normalBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    // Color buffer — location 2
    const colorBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

    // Index buffer
    const indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return {
      vao,
      indexCount: mesh.indices.length,
      positionBuffer,
      normalBuffer,
      colorBuffer,
      indexBuffer,
    };
  }

  /** Delete GPU resources for a mesh handle */
  deleteMesh(handle: MeshHandle): void {
    const { gl } = this;
    gl.deleteVertexArray(handle.vao);
    gl.deleteBuffer(handle.positionBuffer);
    gl.deleteBuffer(handle.normalBuffer);
    gl.deleteBuffer(handle.colorBuffer);
    gl.deleteBuffer(handle.indexBuffer);
  }

  /**
   * Begin a frame: clear the 3D canvas and set up camera matrices.
   * @param playerX World X position of the player
   * @param playerY World Y position of the player (maps to Z in 3D)
   * @param heading Player heading in radians
   * @param zoom Current zoom level (1.0 = default)
   */
  beginFrame(playerX: number, playerY: number, heading: number, zoom: number): void {
    const { gl, canvas3d } = this;

    // Sync canvas size with window
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas3d.width !== w || canvas3d.height !== h) {
      canvas3d.width = w;
      canvas3d.height = h;
      gl.viewport(0, 0, w, h);
    }

    // Clear with the configured background color
    gl.clearColor(this.clearR, this.clearG, this.clearB, this.clearA);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);

    // Orthographic projection — scaled by zoom
    const aspect = w / h;
    const halfW = ORTHO_HALF_SIZE / zoom;
    const halfH = halfW / aspect;
    this.projectionMatrix = mat4.ortho(-halfW, halfW, -halfH, halfH, 1, 2000);
    gl.uniformMatrix4fv(this.uProjection, false, this.projectionMatrix);

    // Camera: positioned above the player, tilted to look at the player
    // In 3D space: X = world X, Y = up, Z = world Y (2D Y maps to 3D Z)
    const camRotation = -heading - Math.PI / 2;

    // Camera is behind-and-above the player, looking down at the player
    const camDist = CAMERA_HEIGHT / Math.tan(CAMERA_TILT);
    const camOffsetX = -Math.sin(camRotation) * camDist;
    const camOffsetZ = -Math.cos(camRotation) * camDist;

    const eye: Vec3 = [
      playerX + camOffsetX,
      CAMERA_HEIGHT,
      playerY + camOffsetZ,
    ];
    const target: Vec3 = [playerX, 0, playerY];

    // Up vector: rotated to match the camera's heading
    // For a tilted top-down view, up should be the camera's "forward" projected on the horizontal plane
    const upX = Math.sin(camRotation);
    const upZ = Math.cos(camRotation);
    const up: Vec3 = [upX, 0, upZ];

    this.viewMatrix = mat4.lookAt(eye, target, up);
    gl.uniformMatrix4fv(this.uView, false, this.viewMatrix);
  }

  /**
   * Draw a mesh at a given world position with optional rotation and scale.
   * @param handle Mesh handle from uploadMesh
   * @param worldX World X position (same coordinate system as player.x)
   * @param worldY World Y position (same coordinate system as player.y, maps to 3D Z)
   * @param rotationY Rotation around the Y (up) axis in radians
   * @param scaleVal Uniform scale factor
   */
  drawMesh(handle: MeshHandle, worldX: number, worldY: number, rotationY = 0, scaleVal = 1): void {
    const { gl } = this;

    // Build model matrix: translate to world position, then rotate, then scale
    // World Y maps to 3D Z coordinate
    let model = mat4.translate(mat4.identity(), worldX, 0, worldY);
    if (rotationY !== 0) {
      model = mat4.rotateY(model, rotationY);
    }
    if (scaleVal !== 1) {
      model = mat4.scale(model, scaleVal, scaleVal, scaleVal);
    }

    gl.uniformMatrix4fv(this.uModel, false, model);
    gl.bindVertexArray(handle.vao);
    gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * Draw a mesh with tint color and damage flash.
   * @param handle Mesh handle from uploadMesh
   * @param worldX World X position
   * @param worldY World Y position (maps to 3D Z)
   * @param rotationY Rotation around the Y (up) axis in radians
   * @param scaleVal Uniform scale factor
   * @param tintR Tint color red component (0-1, default 1)
   * @param tintG Tint color green component (0-1, default 1)
   * @param tintB Tint color blue component (0-1, default 1)
   * @param flash Damage flash intensity (0 = none, 1 = full white)
   */
  drawMeshTinted(
    handle: MeshHandle,
    worldX: number,
    worldY: number,
    rotationY: number,
    scaleVal: number,
    tintR: number,
    tintG: number,
    tintB: number,
    flash: number,
  ): void {
    const { gl } = this;
    this.tintArray[0] = tintR;
    this.tintArray[1] = tintG;
    this.tintArray[2] = tintB;
    gl.uniform3fv(this.uTintColor, this.tintArray);
    gl.uniform1f(this.uDamageFlash, flash);
    this.drawMesh(handle, worldX, worldY, rotationY, scaleVal);
    // Reset to defaults so subsequent drawMesh calls are unaffected
    gl.uniform3fv(this.uTintColor, this.defaultTint);
    gl.uniform1f(this.uDamageFlash, 0);
  }

  /** End the frame. Currently a no-op but reserved for future use. */
  endFrame(): void {
    // Reserved for future batch finalization, post-processing, etc.
  }

  /** Handle window resize */
  handleResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas3d.width = w;
    this.canvas3d.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  /**
   * Set the clear color from a CSS hex color string (e.g. '#0a0a0a').
   * Called each frame or when the theme changes so the 3D background
   * matches the game's theme.
   */
  setClearColor(hex: string): void {
    const [r, g, b] = parseHexColor(hex);
    this.clearR = r;
    this.clearG = g;
    this.clearB = b;
    this.clearA = 1;
  }

  /** Get the underlying 3D canvas element (for compositing into the 2D canvas) */
  getCanvas(): HTMLCanvasElement {
    return this.canvas3d;
  }

  /** Clean up all GPU resources */
  dispose(): void {
    const { gl } = this;
    gl.deleteProgram(this.program);
    this.canvas3d.remove();
  }
}

// ─── Test mesh: colored cube ─────────────────────────────────────────────

/** Create a colored cube mesh centered at origin with given half-size */
export function createTestCube(halfSize = 15): Mesh {
  const s = halfSize;

  // 6 faces, 4 vertices each = 24 vertices
  // Each face has a unique normal and color
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const faces: {
    verts: [number, number, number][];
    normal: [number, number, number];
    color: [number, number, number];
  }[] = [
    // Front face (+Z)
    { verts: [[-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]], normal: [0, 0, 1], color: [0.2, 0.8, 0.2] },
    // Back face (-Z)
    { verts: [[s, -s, -s], [-s, -s, -s], [-s, s, -s], [s, s, -s]], normal: [0, 0, -1], color: [0.8, 0.2, 0.2] },
    // Top face (+Y)
    { verts: [[-s, s, s], [s, s, s], [s, s, -s], [-s, s, -s]], normal: [0, 1, 0], color: [0.2, 0.6, 0.9] },
    // Bottom face (-Y)
    { verts: [[-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s]], normal: [0, -1, 0], color: [0.9, 0.6, 0.2] },
    // Right face (+X)
    { verts: [[s, -s, s], [s, -s, -s], [s, s, -s], [s, s, s]], normal: [1, 0, 0], color: [0.8, 0.8, 0.2] },
    // Left face (-X)
    { verts: [[-s, -s, -s], [-s, -s, s], [-s, s, s], [-s, s, -s]], normal: [-1, 0, 0], color: [0.6, 0.2, 0.8] },
  ];

  for (const face of faces) {
    const baseIndex = positions.length / 3;
    for (const v of face.verts) {
      positions.push(v[0], v[1], v[2]);
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
      colors.push(face.color[0], face.color[1], face.color[2]);
    }
    // Two triangles per face
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
    indices.push(baseIndex, baseIndex + 2, baseIndex + 3);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint16Array(indices),
  };
}
