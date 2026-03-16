/** Minimum zoom level (zoomed out) */
export const ZOOM_MIN = 0.5;
/** Maximum zoom level (zoomed in) */
export const ZOOM_MAX = 2.0;
/** Default zoom level */
export const ZOOM_DEFAULT = 1.0;
/** Lerp speed — how fast current zoom approaches target (per second) */
export const ZOOM_LERP_SPEED = 4.0;
/** Mouse wheel sensitivity — deltaY multiplier */
export const ZOOM_WHEEL_SENSITIVITY = 0.001;
/** Keyboard zoom step per keypress */
export const ZOOM_KEY_STEP = 0.1;

export interface ZoomState {
  target: number;
  current: number;
}

/** Create a fresh zoom state at default level */
export function createZoomState(): ZoomState {
  return { target: ZOOM_DEFAULT, current: ZOOM_DEFAULT };
}

/** Clamp a zoom value to the allowed range */
export function clampZoom(value: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
}

/** Adjust target zoom by a delta (e.g., from mouse wheel), clamping to range */
export function adjustZoom(state: ZoomState, delta: number): void {
  state.target = clampZoom(state.target + delta);
}

/** Lerp current zoom toward target. Call once per frame with dt in seconds. */
export function updateZoom(state: ZoomState, dt: number): void {
  const diff = state.target - state.current;
  if (Math.abs(diff) < 0.001) {
    state.current = state.target;
    return;
  }
  state.current += diff * Math.min(1, ZOOM_LERP_SPEED * dt);
}

/** Reset zoom to default */
export function resetZoom(state: ZoomState): void {
  state.target = ZOOM_DEFAULT;
  state.current = ZOOM_DEFAULT;
}
