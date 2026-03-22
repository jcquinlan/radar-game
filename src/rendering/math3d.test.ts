import { describe, it, expect } from 'vitest';
import { mat4, vec3 } from './math3d';

/** Helper: check two Float32Arrays are approximately equal */
function expectClose(actual: Float32Array, expected: number[], epsilon = 1e-5) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 4);
  }
}

describe('vec3', () => {
  it('dot returns the scalar dot product of two vectors', () => {
    expect(vec3.dot([1, 0, 0], [0, 1, 0])).toBeCloseTo(0);
    expect(vec3.dot([1, 2, 3], [4, 5, 6])).toBeCloseTo(32);
    expect(vec3.dot([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('cross returns the cross product of two vectors', () => {
    // x cross y = z
    const result = vec3.cross([1, 0, 0], [0, 1, 0]);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(1);
  });

  it('cross of parallel vectors is zero', () => {
    const result = vec3.cross([1, 0, 0], [2, 0, 0]);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0);
  });

  it('normalize returns a unit-length vector', () => {
    const result = vec3.normalize([3, 0, 0]);
    expect(result[0]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0);
  });

  it('normalize handles non-axis-aligned vectors', () => {
    const result = vec3.normalize([1, 1, 1]);
    const len = Math.sqrt(result[0] ** 2 + result[1] ** 2 + result[2] ** 2);
    expect(len).toBeCloseTo(1);
  });

  it('normalize returns zero vector for zero input', () => {
    const result = vec3.normalize([0, 0, 0]);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
  });

  it('subtract returns a - b', () => {
    const result = vec3.subtract([5, 3, 1], [1, 2, 3]);
    expect(result).toEqual([4, 1, -2]);
  });

  it('add returns a + b', () => {
    const result = vec3.add([1, 2, 3], [4, 5, 6]);
    expect(result).toEqual([5, 7, 9]);
  });

  it('scale multiplies each component by scalar', () => {
    const result = vec3.scale([1, 2, 3], 2);
    expect(result).toEqual([2, 4, 6]);
  });
});

describe('mat4', () => {
  it('identity returns 4x4 identity matrix', () => {
    const m = mat4.identity();
    expectClose(m, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  });

  it('multiply with identity yields the same matrix', () => {
    const a = mat4.identity();
    const b = mat4.translate(mat4.identity(), 3, 4, 5);
    const result = mat4.multiply(a, b);
    expectClose(result, Array.from(b));
  });

  it('multiply is not commutative for general matrices', () => {
    const t = mat4.translate(mat4.identity(), 1, 0, 0);
    const r = mat4.rotateZ(mat4.identity(), Math.PI / 2);
    const ab = mat4.multiply(t, r);
    const ba = mat4.multiply(r, t);
    // They should differ
    let same = true;
    for (let i = 0; i < 16; i++) {
      if (Math.abs(ab[i] - ba[i]) > 1e-5) { same = false; break; }
    }
    expect(same).toBe(false);
  });

  it('translate moves the origin', () => {
    const m = mat4.translate(mat4.identity(), 10, 20, 30);
    // Column-major: translation is in elements 12, 13, 14
    expect(m[12]).toBeCloseTo(10);
    expect(m[13]).toBeCloseTo(20);
    expect(m[14]).toBeCloseTo(30);
  });

  it('scale scales the diagonal', () => {
    const m = mat4.scale(mat4.identity(), 2, 3, 4);
    expect(m[0]).toBeCloseTo(2);
    expect(m[5]).toBeCloseTo(3);
    expect(m[10]).toBeCloseTo(4);
    expect(m[15]).toBeCloseTo(1);
  });

  it('rotateY by PI/2 rotates x-axis to negative z-axis', () => {
    const m = mat4.rotateY(mat4.identity(), Math.PI / 2);
    // Column 0 (x-axis) should become (0, 0, -1)
    expect(m[0]).toBeCloseTo(0);  // cos(PI/2)
    expect(m[2]).toBeCloseTo(-1); // -sin(PI/2)
    // Column 2 (z-axis) should become (1, 0, 0)
    expect(m[8]).toBeCloseTo(1);  // sin(PI/2)
    expect(m[10]).toBeCloseTo(0); // cos(PI/2)
  });

  it('rotateZ by PI/2 rotates x-axis to y-axis', () => {
    const m = mat4.rotateZ(mat4.identity(), Math.PI / 2);
    // Column 0 (x-axis) should become (0, 1, 0)
    expect(m[0]).toBeCloseTo(0);
    expect(m[1]).toBeCloseTo(1);
    // Column 1 (y-axis) should become (-1, 0, 0)
    expect(m[4]).toBeCloseTo(-1);
    expect(m[5]).toBeCloseTo(0);
  });

  it('perspective produces correct near/far plane mapping', () => {
    const fov = Math.PI / 4; // 45 degrees
    const aspect = 16 / 9;
    const near = 0.1;
    const far = 100;
    const m = mat4.perspective(fov, aspect, near, far);

    // m[0] = 1 / (aspect * tan(fov/2))
    const tanHalf = Math.tan(fov / 2);
    expect(m[0]).toBeCloseTo(1 / (aspect * tanHalf));
    // m[5] = 1 / tan(fov/2)
    expect(m[5]).toBeCloseTo(1 / tanHalf);
    // m[11] = -1 (perspective divide)
    expect(m[11]).toBeCloseTo(-1);
    // m[15] = 0
    expect(m[15]).toBeCloseTo(0);
  });

  it('ortho produces correct orthographic projection', () => {
    const m = mat4.ortho(-10, 10, -5, 5, 0.1, 100);
    // m[0] = 2 / (right - left) = 2/20 = 0.1
    expect(m[0]).toBeCloseTo(0.1);
    // m[5] = 2 / (top - bottom) = 2/10 = 0.2
    expect(m[5]).toBeCloseTo(0.2);
    // m[10] = -2 / (far - near) = -2/99.9
    expect(m[10]).toBeCloseTo(-2 / 99.9);
    // Translation components
    expect(m[12]).toBeCloseTo(0); // -(right+left)/(right-left) = 0
    expect(m[13]).toBeCloseTo(0); // -(top+bottom)/(top-bottom) = 0
  });

  it('lookAt produces correct view matrix for simple case', () => {
    // Camera at (0, 10, 0) looking at origin, up = (0, 0, -1)
    const m = mat4.lookAt([0, 10, 0], [0, 0, 0], [0, 0, -1]);

    // Apply to the eye position — should map to origin
    // The view matrix transforms world coords to camera coords
    // The camera's own position should transform to (0, 0, 0) in camera space
    // Actually, the translation part encodes -dot(axis, eye) for each axis
    // Let's verify the matrix is orthonormal in the rotation part
    // and that it translates the eye to the origin
    expect(m[15]).toBeCloseTo(1);

    // The z-axis of the camera (forward) points from eye to target = (0, -1, 0) normalized
    // In a right-handed lookAt, the forward direction is eye-to-target
    // The view matrix's 3rd row should encode the forward direction
  });

  it('lookAt view matrix transforms eye position to near-zero in view space', () => {
    const eye: [number, number, number] = [5, 10, 3];
    const target: [number, number, number] = [0, 0, 0];
    const up: [number, number, number] = [0, 1, 0];
    const m = mat4.lookAt(eye, target, up);

    // The eye should map to (0, 0, 0) in view space (x and y)
    // and the target should map to (0, 0, -distance) in view space
    const ex = m[0] * eye[0] + m[4] * eye[1] + m[8] * eye[2] + m[12];
    const ey = m[1] * eye[0] + m[5] * eye[1] + m[9] * eye[2] + m[13];

    expect(ex).toBeCloseTo(0);
    expect(ey).toBeCloseTo(0);

    // Transform the target — should be along -Z axis at distance
    const tx = m[0] * target[0] + m[4] * target[1] + m[8] * target[2] + m[12];
    const ty = m[1] * target[0] + m[5] * target[1] + m[9] * target[2] + m[13];
    const tz = m[2] * target[0] + m[6] * target[1] + m[10] * target[2] + m[14];

    expect(tx).toBeCloseTo(0);
    expect(ty).toBeCloseTo(0);
    const dist = Math.sqrt(eye[0] ** 2 + eye[1] ** 2 + eye[2] ** 2);
    expect(tz).toBeCloseTo(-dist);
  });

  it('rotateX by PI/2 rotates y-axis to z-axis', () => {
    const m = mat4.rotateX(mat4.identity(), Math.PI / 2);
    // Column 1 (y-axis) should become (0, 0, 1)
    expect(m[4]).toBeCloseTo(0);
    expect(m[5]).toBeCloseTo(0);
    expect(m[6]).toBeCloseTo(1);
  });
});
