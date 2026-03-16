import { Defense, createTurret, createRepairStation } from '../entities/Entity';

export const TURRET_COST = 100;
export const REPAIR_STATION_COST = 75;
const MIN_DEFENSE_SPACING = 30;
const MAX_POSITION_ATTEMPTS = 20;

export type PlacementResult =
  | { success: true; defense: Defense; cost: number }
  | { success: false; reason: string };

/**
 * Check if a position is valid for placing a defense:
 * - Must be within baseRadius of base center (0,0)
 * - Must be at least MIN_DEFENSE_SPACING from all existing defenses
 */
export function isValidDefensePosition(
  x: number,
  y: number,
  baseRadius: number,
  defenses: Defense[],
): boolean {
  // Must be within base radius
  if (x * x + y * y > baseRadius * baseRadius) return false;

  // Must be at least 30px from any existing defense
  for (let i = 0; i < defenses.length; i++) {
    const d = defenses[i];
    const dx = x - d.x;
    const dy = y - d.y;
    if (dx * dx + dy * dy < MIN_DEFENSE_SPACING * MIN_DEFENSE_SPACING) return false;
  }

  return true;
}

/**
 * Find a random valid position within the base radius.
 * Tries up to MAX_POSITION_ATTEMPTS times with random angle + distance.
 * Returns null if no valid position found.
 */
export function findValidPosition(
  baseRadius: number,
  defenses: Defense[],
): { x: number; y: number } | null {
  for (let i = 0; i < MAX_POSITION_ATTEMPTS; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Use sqrt for uniform distribution within circle
    const dist = Math.sqrt(Math.random()) * (baseRadius - 10);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    if (isValidDefensePosition(x, y, baseRadius, defenses)) {
      return { x, y };
    }
  }
  return null;
}

/**
 * Attempt to place a defense (turret or repair station).
 * Returns the result with the created defense or failure reason.
 */
export function tryPlaceDefense(
  type: 'turret' | 'repair_station',
  playerEnergy: number,
  defenses: Defense[],
  maxDefenses: number,
  baseRadius: number,
  playerX: number,
  playerY: number,
): PlacementResult {
  // Check if player is within base radius
  if (playerX * playerX + playerY * playerY > baseRadius * baseRadius) {
    return { success: false, reason: 'Too far from base' };
  }

  // Check max defenses
  if (defenses.length >= maxDefenses) {
    return { success: false, reason: 'Max defenses reached' };
  }

  // Check energy
  const cost = type === 'turret' ? TURRET_COST : REPAIR_STATION_COST;
  if (playerEnergy < cost) {
    return { success: false, reason: 'Not enough energy' };
  }

  // Find valid position
  const pos = findValidPosition(baseRadius, defenses);
  if (!pos) {
    return { success: false, reason: 'No valid position found' };
  }

  // Create the defense
  const defense = type === 'turret'
    ? createTurret(pos.x, pos.y)
    : createRepairStation(pos.x, pos.y);

  return { success: true, defense, cost };
}
