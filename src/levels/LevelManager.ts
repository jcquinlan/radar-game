import { LevelConfig } from './LevelConfig';
import { LEVELS } from './levels';

export class LevelManager {
  private currentIndex = -1; // -1 = main menu

  getLevels(): LevelConfig[] {
    return LEVELS;
  }

  getCurrentLevel(): LevelConfig | null {
    if (this.currentIndex < 0 || this.currentIndex >= LEVELS.length) {
      return null;
    }
    return LEVELS[this.currentIndex];
  }

  selectLevel(index: number): LevelConfig | null {
    if (index < 0 || index >= LEVELS.length) return null;
    this.currentIndex = index;
    return LEVELS[this.currentIndex];
  }

  /** Advance to next level. Returns null if no more levels (back to menu). */
  advance(): LevelConfig | null {
    if (this.currentIndex < 0) return null;
    this.currentIndex++;
    if (this.currentIndex >= LEVELS.length) {
      this.currentIndex = -1;
      return null;
    }
    return LEVELS[this.currentIndex];
  }

  isOnMenu(): boolean {
    return this.currentIndex < 0;
  }

  returnToMenu(): void {
    this.currentIndex = -1;
  }

  hasNextLevel(): boolean {
    return this.currentIndex >= 0 && this.currentIndex < LEVELS.length - 1;
  }
}
