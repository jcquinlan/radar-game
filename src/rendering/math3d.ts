/**
 * Minimal 3D math utilities for the WebGL2 renderer.
 * All matrices are column-major Float32Array[16] (WebGL convention).
 * Vec3 is a plain [number, number, number] tuple.
 */

export type Vec3 = [number, number, number];

export const vec3 = {
  dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },

  cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  },

  normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len === 0) return [0, 0, 0];
    const inv = 1 / len;
    return [v[0] * inv, v[1] * inv, v[2] * inv];
  },

  subtract(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },

  add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  },

  scale(v: Vec3, s: number): Vec3 {
    return [v[0] * s, v[1] * s, v[2] * s];
  },
};

export const mat4 = {
  /** Returns a new 4x4 identity matrix (column-major) */
  identity(): Float32Array {
    const m = new Float32Array(16);
    m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
    return m;
  },

  /**
   * Multiply two 4x4 matrices: result = a * b (column-major)
   * This applies b first, then a (standard GL convention).
   */
  multiply(a: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        out[col * 4 + row] =
          a[row]      * b[col * 4]     +
          a[4 + row]  * b[col * 4 + 1] +
          a[8 + row]  * b[col * 4 + 2] +
          a[12 + row] * b[col * 4 + 3];
      }
    }
    return out;
  },

  /** Perspective projection matrix */
  perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
    const m = new Float32Array(16);
    const f = 1.0 / Math.tan(fovY / 2);
    const rangeInv = 1.0 / (near - far);

    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) * rangeInv;
    m[11] = -1;
    m[14] = 2 * far * near * rangeInv;
    return m;
  },

  /** Orthographic projection matrix */
  ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array {
    const m = new Float32Array(16);
    const rl = right - left;
    const tb = top - bottom;
    const fn = far - near;

    m[0] = 2 / rl;
    m[5] = 2 / tb;
    m[10] = -2 / fn;
    m[12] = -(right + left) / rl;
    m[13] = -(top + bottom) / tb;
    m[14] = -(far + near) / fn;
    m[15] = 1;
    return m;
  },

  /** LookAt view matrix (right-handed) */
  lookAt(eye: Vec3, target: Vec3, up: Vec3): Float32Array {
    const f = vec3.normalize(vec3.subtract(target, eye));
    const s = vec3.normalize(vec3.cross(f, up));
    const u = vec3.cross(s, f);

    const m = new Float32Array(16);
    m[0] = s[0];  m[1] = u[0];  m[2] = -f[0];
    m[4] = s[1];  m[5] = u[1];  m[6] = -f[1];
    m[8] = s[2];  m[9] = u[2];  m[10] = -f[2];
    m[12] = -vec3.dot(s, eye);
    m[13] = -vec3.dot(u, eye);
    m[14] = vec3.dot(f, eye);
    m[15] = 1;
    return m;
  },

  /** Apply translation to a matrix (post-multiply by translation) */
  translate(m: Float32Array, tx: number, ty: number, tz: number): Float32Array {
    const out = new Float32Array(m);
    out[12] = m[0] * tx + m[4] * ty + m[8] * tz + m[12];
    out[13] = m[1] * tx + m[5] * ty + m[9] * tz + m[13];
    out[14] = m[2] * tx + m[6] * ty + m[10] * tz + m[14];
    out[15] = m[3] * tx + m[7] * ty + m[11] * tz + m[15];
    return out;
  },

  /** Rotation around X axis */
  rotateX(m: Float32Array, angle: number): Float32Array {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const out = new Float32Array(m);
    // Columns 1 and 2 change
    for (let i = 0; i < 4; i++) {
      const a1 = m[4 + i];
      const a2 = m[8 + i];
      out[4 + i] = a1 * c + a2 * s;
      out[8 + i] = a2 * c - a1 * s;
    }
    return out;
  },

  /** Rotation around Y axis */
  rotateY(m: Float32Array, angle: number): Float32Array {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const out = new Float32Array(m);
    // Columns 0 and 2 change
    for (let i = 0; i < 4; i++) {
      const a0 = m[i];
      const a2 = m[8 + i];
      out[i] = a0 * c - a2 * s;
      out[8 + i] = a0 * s + a2 * c;
    }
    return out;
  },

  /** Rotation around Z axis */
  rotateZ(m: Float32Array, angle: number): Float32Array {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const out = new Float32Array(m);
    // Columns 0 and 1 change
    for (let i = 0; i < 4; i++) {
      const a0 = m[i];
      const a1 = m[4 + i];
      out[i] = a0 * c + a1 * s;
      out[4 + i] = a1 * c - a0 * s;
    }
    return out;
  },

  /** Apply uniform or non-uniform scale to a matrix */
  scale(m: Float32Array, sx: number, sy: number, sz: number): Float32Array {
    const out = new Float32Array(m);
    for (let i = 0; i < 4; i++) {
      out[i] *= sx;
      out[4 + i] *= sy;
      out[8 + i] *= sz;
    }
    return out;
  },
};
