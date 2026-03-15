import type { AbilityOverrides } from './AbilitySystem';

const COMBO_WINDOW = 3; // seconds

/**
 * Detects ability combos based on the last ability used and the current ability being activated.
 * Returns overrides to apply if a combo is detected, or undefined if no combo.
 *
 * Three combos (order matters):
 * - Blast then Drone: drone deals 2x damage
 * - HoT then Dash: dash goes 50% further
 * - Dash then Blast: blast radius 300px (up from 200px)
 */
export function detectCombo(
  lastAbilityUsed: string | null,
  lastAbilityTime: number,
  currentAbilityId: string,
  currentTime: number,
): AbilityOverrides | undefined {
  // No combo if no previous ability, same ability used twice, or outside time window
  if (lastAbilityUsed === null) return undefined;
  if (lastAbilityUsed === currentAbilityId) return undefined;
  if (currentTime - lastAbilityTime > COMBO_WINDOW) return undefined;

  // Blast then Drone: drone deals 2x damage
  if (lastAbilityUsed === 'damage_blast' && currentAbilityId === 'helper_drone') {
    return { droneDamageMultiplier: 2 };
  }

  // HoT then Dash: dash goes 50% further
  if (lastAbilityUsed === 'heal_over_time' && currentAbilityId === 'dash') {
    return { dashSpeedMultiplier: 1.5 };
  }

  // Dash then Blast: blast radius increased 50%
  if (lastAbilityUsed === 'dash' && currentAbilityId === 'damage_blast') {
    return { blastRadius: 300 };
  }

  return undefined;
}
