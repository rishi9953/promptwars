
export const GRAVITY = 0.5;
export const JUMP_FORCE = -15; // Increased from -12 to allow reaching platforms
export const WALK_SPEED = 4;
export const FAST_WALK_SPEED = 7;
export const SNOWBALL_SPEED = 8;
export const FAST_SNOWBALL_SPEED = 14;
export const FRICTION = 0.85;

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const COLORS = {
  ICE: '#a5f3fc',
  SNOW: '#f8fafc',
  DEEP_BLUE: '#0f172a',
  GLOW: '#22d3ee',
  SHADOW: 'rgba(0, 0, 0, 0.5)',
  BLOOM: 'rgba(255, 255, 255, 0.2)',
  POWERUP_RUN: '#fbbf24',
  POWERUP_SNOW: '#ef4444',
  POWERUP_WIDE: '#a855f7'
};

export const LEVEL_LAYOUTS = [
  { // Round 1
    platforms: [
      { x: 0, y: 650, w: 1280, h: 70 },
      { x: 200, y: 500, w: 300, h: 20 },
      { x: 700, y: 500, w: 300, h: 20 },
      { x: 450, y: 350, w: 350, h: 20 },
      { x: 100, y: 200, w: 250, h: 20 },
      { x: 900, y: 200, w: 250, h: 20 }
    ]
  },
  { // Round 2
    platforms: [
      { x: 0, y: 650, w: 1280, h: 70 },
      { x: 100, y: 450, w: 400, h: 20 },
      { x: 700, y: 450, w: 400, h: 20 },
      { x: 400, y: 250, w: 480, h: 20 },
      { x: 200, y: 100, w: 150, h: 20 },
      { x: 900, y: 100, w: 150, h: 20 }
    ]
  },
  { // Round 3
    platforms: [
      { x: 0, y: 650, w: 1280, h: 70 },
      { x: 50, y: 500, w: 200, h: 20 },
      { x: 300, y: 400, w: 200, h: 20 },
      { x: 550, y: 300, w: 200, h: 20 },
      { x: 800, y: 400, w: 200, h: 20 },
      { x: 1050, y: 500, w: 200, h: 20 }
    ]
  },
  { // Round 4
    platforms: [
      { x: 0, y: 650, w: 1280, h: 70 },
      { x: 200, y: 550, w: 200, h: 20 },
      { x: 880, y: 550, w: 200, h: 20 },
      { x: 440, y: 450, w: 400, h: 20 },
      { x: 100, y: 350, w: 300, h: 20 },
      { x: 880, y: 350, w: 300, h: 20 },
      { x: 440, y: 200, w: 400, h: 20 }
    ]
  },
  { // Round 5
    platforms: [
      { x: 0, y: 650, w: 1280, h: 70 },
      { x: 540, y: 500, w: 200, h: 20 },
      { x: 300, y: 350, w: 680, h: 20 },
      { x: 50, y: 200, w: 400, h: 20 },
      { x: 830, y: 200, w: 400, h: 20 }
    ]
  },
  { // Round 10 - BOSS ARENA
    platforms: [
      { x: 0, y: 650, w: 1280, h: 70 }, // Floor
      { x: 100, y: 450, w: 300, h: 30 }, // Left side
      { x: 880, y: 450, w: 300, h: 30 }, // Right side
      { x: 490, y: 250, w: 300, h: 30 }, // Center High
    ]
  }
];

export const BOSS_STATS = {
  HEALTH: 3000,
  WIDTH: 140,
  HEIGHT: 180,
  COLOR: '#ff4444'
};
