
export enum GameState {
  MENU,
  PLAYING,
  GAMEOVER,
  VICTORY
}

export interface Vector2 {
  x: number;
  y: number;
}

export type PowerUpType = 'FAST_SNOW' | 'FAST_RUN' | 'WIDE_SNOW';

export interface PowerUp extends Entity {
  powerType: PowerUpType;
  life: number;
}

export interface Entity {
  id: string;
  pos: Vector2;
  vel: Vector2;
  width: number;
  height: number;
  type: 'player' | 'enemy' | 'projectile' | 'particle' | 'powerup';
}

export interface Player extends Entity {
  isJumping: boolean;
  facing: number; // 1 or -1
  health: number;
  snowballs: number;
  abilities: {
    fastRun: boolean;
    fastSnow: boolean;
    wideSnow: boolean;
  };
}

export interface Enemy extends Entity {
  freezeLevel: number; // 0 to 100
  isFrozen: boolean;
  isRolling: boolean;
  hp: number;
  variant: 'red' | 'blue' | 'boss';
}

export interface Particle {
  pos: Vector2;
  vel: Vector2;
  life: number;
  size: number;
  color: string;
  type: 'snow' | 'shatter' | 'smoke' | 'energy' | 'text';
  text?: string;
}

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DirectorConfig {
  lightingIntensity: number;
  fogDensity: number;
  snowRate: number;
  difficulty: number;
  message: string;
}
