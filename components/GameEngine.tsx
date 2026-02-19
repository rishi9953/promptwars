
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  GameState, Player, Enemy, Platform, Entity, Particle, Vector2, DirectorConfig, PowerUp, PowerUpType
} from '../types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, GRAVITY, JUMP_FORCE, WALK_SPEED,
  SNOWBALL_SPEED, FRICTION, COLORS, FAST_WALK_SPEED, FAST_SNOWBALL_SPEED, LEVEL_LAYOUTS, BOSS_STATS
} from '../constants';
import { getDirectorUpdate } from '../services/geminiService';
import { audioSystem } from '../services/audioService';
import { multiplayerManager } from '../services/multiplayerService';

interface GameEngineProps {
  onGameOver: (reason: string, score: number) => void;
  onScoreChange: (score: number) => void;
  directorConfig: DirectorConfig;
  isMultiplayer?: boolean;
  isPaused?: boolean;
}

const GameEngine: React.FC<GameEngineProps> = ({ onGameOver, onScoreChange, directorConfig, isMultiplayer, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [audioStarted, setAudioStarted] = useState(false);

  const playerRef = useRef<Player>({
    id: 'p1',
    pos: { x: 100, y: 550 },
    vel: { x: 0, y: 0 },
    width: 40,
    height: 58,
    type: 'player',
    isJumping: false,
    facing: 1,
    health: 100,
    lives: 3,
    snowballs: 10,
    abilities: { fastRun: false, fastSnow: false, wideSnow: false }
  });

  const player2Ref = useRef<Player>({
    id: 'p2',
    pos: { x: 700, y: 550 },
    vel: { x: 0, y: 0 },
    width: 40,
    height: 58,
    type: 'player',
    isJumping: false,
    facing: -1,
    health: 100,
    lives: 3,
    snowballs: 10,
    abilities: { fastRun: false, fastSnow: false, wideSnow: false }
  });

  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const platformsRef = useRef<Platform[]>(LEVEL_LAYOUTS[0].platforms);

  const keys = useRef<Record<string, boolean>>({});

  // Initialize Audio on Interaction
  useEffect(() => {
    const startAudio = async () => {
      if (!audioStarted) {
        await audioSystem.init();
        setAudioStarted(true);
      }
    };
    window.addEventListener('keydown', startAudio);
    window.addEventListener('click', startAudio);
    return () => {
      window.removeEventListener('keydown', startAudio);
      window.removeEventListener('click', startAudio);
    };
  }, [audioStarted]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Enter', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    spawnEnemies(1);

    // Multiplayer Sync
    if (isMultiplayer) {
      multiplayerManager.onMessage((msg) => {
        if (msg.type === 'STATE_SYNC') {
          const remotePlayer = msg.payload.player;
          player2Ref.current.pos = remotePlayer.pos;
          player2Ref.current.vel = remotePlayer.vel;
          player2Ref.current.facing = remotePlayer.facing;
          player2Ref.current.lives = remotePlayer.lives;
          player2Ref.current.abilities = remotePlayer.abilities;

          // If host, we also sync enemies (simple version)
          if (!multiplayerManager.getIsHost() && msg.payload.enemies) {
            enemiesRef.current = msg.payload.enemies;
            platformsRef.current = msg.payload.platforms;
          }
        }
        if (msg.type === 'ACTION') {
          if (msg.payload.action === 'SHOOT') {
            spawnSnowball(player2Ref.current, msg.payload.data?.vel);
          }
          if (msg.payload.action === 'NEXT_ROUND') {
            // Sync round transitions
          }
        }
      });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isMultiplayer]);

  useEffect(() => {
    const layoutIndex = Math.min(round - 1, LEVEL_LAYOUTS.length - 1);
    platformsRef.current = LEVEL_LAYOUTS[layoutIndex].platforms;
    spawnEnemies(round);
  }, [round]);

  const spawnEnemies = (roundNum: number) => {
    if (roundNum === 10) {
      // BOSS ROUND
      enemiesRef.current = [{
        id: 'boss-final',
        pos: { x: CANVAS_WIDTH / 2 - BOSS_STATS.WIDTH / 2, y: 100 },
        vel: { x: 0, y: 0 },
        width: BOSS_STATS.WIDTH,
        height: BOSS_STATS.HEIGHT,
        type: 'enemy',
        freezeLevel: 0,
        isFrozen: false,
        isRolling: false,
        hp: BOSS_STATS.HEALTH,
        variant: 'boss'
      }];
      createPopupText({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }, "FATAL_UNIT_APPROACHING", '#ef4444', 3.0);
      return;
    }

    const count = Math.min(3 + roundNum, 8);
    const newEnemies: Enemy[] = [];
    const SAFE_DISTANCE = 200;

    for (let i = 0; i < count; i++) {
      let spawnPos = { x: 0, y: 0 };
      let isSafe = false;
      let attempts = 0;

      while (!isSafe && attempts < 10) {
        spawnPos = {
          x: 100 + Math.random() * (CANVAS_WIDTH - 200),
          y: 50 + Math.random() * 400
        };

        const distP1 = Math.sqrt(Math.pow(spawnPos.x - playerRef.current.pos.x, 2) + Math.pow(spawnPos.y - playerRef.current.pos.y, 2));
        const distP2 = isMultiplayer ? Math.sqrt(Math.pow(spawnPos.x - player2Ref.current.pos.x, 2) + Math.pow(spawnPos.y - player2Ref.current.pos.y, 2)) : Infinity;

        if (distP1 > SAFE_DISTANCE && distP2 > SAFE_DISTANCE) {
          isSafe = true;
        }
        attempts++;
      }

      newEnemies.push({
        id: `e-${roundNum}-${i}`,
        pos: spawnPos,
        vel: { x: (Math.random() - 0.5) * 4, y: 0 },
        width: 44,
        height: 44,
        type: 'enemy',
        freezeLevel: 0,
        isFrozen: false,
        isRolling: false,
        hp: 100,
        variant: Math.random() > 0.5 ? 'red' : 'blue'
      });
    }
    enemiesRef.current = newEnemies;
  };



  const nextRound = useCallback(() => {
    if (round >= 10 && enemiesRef.current.length === 0) {
      onGameOver("All Systems Decoupled. Total Victory.", score);
      return;
    }
    const nextR = round + 1;
    setRound(nextR);

    const layoutIdx = (nextR - 1) % LEVEL_LAYOUTS.length;
    const layout = LEVEL_LAYOUTS[layoutIdx];
    platformsRef.current = layout.platforms.map(p => ({
      ...p,
      x: p.x + (Math.random() * 40 - 20),
      w: p.w + (Math.random() * 20 - 10)
    }));

    playerRef.current.pos = { x: 100, y: 550 };
    playerRef.current.vel = { x: 0, y: 0 };
    spawnEnemies(nextR);
    createPopupText({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }, `INITIATING ROUND ${nextR}`, '#22d3ee', 2.0);
  }, [round, score, onGameOver]);

  const createPopupText = (pos: Vector2, text: string, color: string, life: number = 1.0) => {
    particlesRef.current.push({
      pos: { ...pos },
      vel: { x: 0, y: -1.5 },
      life,
      size: 26,
      color,
      type: 'text',
      text
    });
  };

  const createBurst = (pos: Vector2, color: string, count: number = 10) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        pos: { ...pos },
        vel: { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 },
        life: 0.5 + Math.random() * 0.5,
        size: 4 + Math.random() * 4,
        color,
        type: 'particle'
      });
    }
  };

  const checkCollision = (a: any, b: any) => {
    return (
      a.pos.x < b.pos.x + b.width &&
      a.pos.x + a.width > b.pos.x &&
      a.pos.y < b.pos.y + b.height &&
      a.pos.y + a.height > b.pos.y
    );
  };

  const spawnParticle = (pos: Vector2, color: string, life: number = 0.5) => {
    particlesRef.current.push({
      pos: { ...pos },
      vel: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
      life,
      size: 3 + Math.random() * 5,
      color,
      type: 'particle'
    });
  };

  const spawnSnowball = (p: Player, remoteVel?: Vector2) => {
    const maxProj = p.abilities.fastSnow ? 15 : 8;
    if (projectilesRef.current.filter(pr => pr.id.startsWith(p.id)).length < maxProj) {
      audioSystem.playShoot();
      const speed = p.abilities.fastSnow ? FAST_SNOWBALL_SPEED : SNOWBALL_SPEED;
      const size = p.abilities.wideSnow ? 36 : 18;

      let targetVel: Vector2;
      if (remoteVel) {
        targetVel = remoteVel;
      } else {
        let aimX = 0; let aimY = 0;
        if (p.id === 'p1') {
          if (keys.current['KeyA']) aimX = -1;
          if (keys.current['KeyD']) aimX = 1;
          if (keys.current['KeyW']) aimY = -1;
          if (keys.current['KeyS']) aimY = 1;
        }
        if (aimX === 0 && aimY === 0) aimX = p.facing;
        const mag = Math.sqrt(aimX * aimX + aimY * aimY) || 1;
        targetVel = { x: (aimX / mag) * speed, y: (aimY / mag) * speed };
      }

      projectilesRef.current.push({
        id: `${p.id}-${Math.random()}`,
        pos: { x: p.pos.x + p.width / 2 - size / 2, y: p.pos.y + p.height / 2 - size / 2 },
        vel: targetVel,
        width: size,
        height: size,
        type: 'projectile'
      });

      if (isMultiplayer && p.id === 'p1' && !remoteVel) {
        multiplayerManager.send({ type: 'ACTION', payload: { action: 'SHOOT', data: { vel: targetVel } } });
      }
    }
  };

  const update = useCallback(() => {
    if (isPaused) return;
    const player = playerRef.current;
    const player2 = player2Ref.current;
    const p = platformsRef.current;

    // Send State Sync (if host handles more, otherwise just sync own pos)
    if (isMultiplayer && multiplayerManager.isConnected()) {
      const syncData: any = { player: player };
      if (multiplayerManager.getIsHost()) {
        syncData.enemies = enemiesRef.current;
        syncData.platforms = platformsRef.current;
      }
      multiplayerManager.send({ type: 'STATE_SYNC', payload: syncData });
    }

    // Player 1 Movement
    const currentWalkSpeed = player.abilities.fastRun ? FAST_WALK_SPEED : WALK_SPEED;
    if (keys.current['KeyA']) {
      player.vel.x = -currentWalkSpeed;
      player.facing = -1;
    } else if (keys.current['KeyD']) {
      player.vel.x = currentWalkSpeed;
      player.facing = 1;
    } else {
      player.vel.x *= FRICTION;
    }

    // Jump
    if (keys.current['KeyW'] && !player.isJumping) {
      player.vel.y = JUMP_FORCE;
      player.isJumping = true;
      audioSystem.playJump();
    }

    // Firing
    if (keys.current['Enter']) {
      spawnSnowball(player);
      keys.current['Enter'] = false;
    }

    // Physics
    [player, player2].forEach(plr => {
      if (plr.health <= 0) return; // Dead players don't move
      plr.pos.x += plr.vel.x;
      plr.pos.y += plr.vel.y;
      plr.vel.y += GRAVITY;

      // Platform Collisions
      plr.isJumping = true;
      for (const plat of p) {
        if (checkCollision(plr, { pos: { x: plat.x, y: plat.y }, width: plat.w, height: plat.h })) {
          if (plr.vel.y > 0 && plr.pos.y + plr.height - plr.vel.y <= plat.y + 15) {
            plr.pos.y = plat.y - plr.height;
            plr.vel.y = 0;
            plr.isJumping = false;
          }
        }
      }
      if (plr.pos.x < 0) plr.pos.x = 0;
      if (plr.pos.x + plr.width > CANVAS_WIDTH) plr.pos.x = CANVAS_WIDTH - plr.width;
    });

    // Projectiles Logic
    projectilesRef.current = projectilesRef.current.filter(proj => {
      proj.pos.x += proj.vel.x;
      proj.pos.y += proj.vel.y;

      // Trail FX
      if (Math.random() > 0.5) {
        particlesRef.current.push({
          pos: { x: proj.pos.x + proj.width / 2, y: proj.pos.y + proj.height / 2 },
          vel: { x: (Math.random() - 0.5), y: (Math.random() - 0.5) },
          life: 0.2, size: 4, color: '#fff', type: 'particle'
        });
      }

      let hit = false;
      enemiesRef.current.forEach(enemy => {
        if (!enemy.isFrozen && checkCollision(proj, enemy)) {
          if (enemy.variant === 'boss') {
            enemy.hp -= 20;
            enemy.freezeLevel += player.abilities.wideSnow ? 10 : 4;
            createBurst(enemy.pos, '#ef4444', 3);
            if (enemy.freezeLevel >= 100) {
              enemy.isFrozen = true;
              enemy.freezeTimer = 400; // ~7 seconds
              audioSystem.playFreeze();
            }
          } else {
            enemy.freezeLevel += player.abilities.wideSnow ? 50 : 35;
            if (enemy.freezeLevel >= 100) {
              enemy.isFrozen = true;
              enemy.freezeTimer = 300; // Normal enemies thaw faster
              audioSystem.playFreeze();
            }
          }
          hit = true;
          createBurst(enemy.pos, COLORS.ICE, 5);
        } else if (enemy.isFrozen && checkCollision(proj, enemy)) {
          hit = true;
        }
      });
      // Hit Platforms
      p.forEach(plat => {
        if (!hit && checkCollision(proj, { pos: { x: plat.x, y: plat.y }, width: plat.w, height: plat.h })) {
          hit = true;
          createBurst(proj.pos, '#fff', 3);
        }
      });

      return !hit && proj.pos.x > -100 && proj.pos.x < CANVAS_WIDTH + 100 && proj.pos.y > -100 && proj.pos.y < CANVAS_HEIGHT + 100;
    });

    // Powerups
    powerUpsRef.current = powerUpsRef.current.filter(pu => {
      pu.vel.y += 0.2;
      pu.pos.y += pu.vel.y;
      p.forEach(plat => {
        if (checkCollision(pu, { pos: { x: plat.x, y: plat.y }, width: plat.w, height: plat.h })) {
          if (pu.vel.y > 0) { pu.pos.y = plat.y - pu.height; pu.vel.y = 0; }
        }
      });
      if (checkCollision(player, pu)) {
        audioSystem.playPowerUp();
        if (pu.powerType === 'FAST_RUN') { player.abilities.fastRun = true; createPopupText(pu.pos, "SPEED BOOST", COLORS.POWERUP_RUN); }
        if (pu.powerType === 'FAST_SNOW') { player.abilities.fastSnow = true; createPopupText(pu.pos, "RAPID FIRE", COLORS.POWERUP_SNOW); }
        if (pu.powerType === 'WIDE_SNOW') { player.abilities.wideSnow = true; createPopupText(pu.pos, "HEAVY IMPACT", COLORS.POWERUP_WIDE); }
        setScore(s => s + 500);
        return false;
      }
      return true;
    });

    // Enemy AI & Contact Death
    enemiesRef.current = enemiesRef.current.filter(enemy => {
      if (!enemy.isFrozen) {
        // Find nearest active player
        const activePlayers = (isMultiplayer ? [player, player2] : [player]).filter(p => p.lives > 0);
        let targetX = player.pos.x;
        let targetY = player.pos.y;
        if (activePlayers.length > 0) {
          const nearest = activePlayers.reduce((prev, curr) =>
            Math.abs(curr.pos.x - enemy.pos.x) < Math.abs(prev.pos.x - enemy.pos.x) ? curr : prev
          );
          targetX = nearest.pos.x;
          targetY = nearest.pos.y;
        }

        // Vertical Hunt (Drop Down)
        if (targetY > enemy.pos.y + 60) {
          enemy.isDropping = true;
        } else if (enemy.pos.y > targetY - 10) {
          enemy.isDropping = false;
        }

        const dx = targetX - enemy.pos.x;
        const dir = dx > 0 ? 1 : -1;

        if (enemy.variant === 'boss') {
          // Boss AI: Jump and Charge
          if (Math.random() < 0.015 && enemy.vel.y === 0) enemy.vel.y = -18;
          const bossSpeed = 3.5;
          enemy.vel.x = dir * bossSpeed;

          // Boss Shooting
          if (Math.random() < 0.03) {
            projectilesRef.current.push({
              id: `boss-proj-${Date.now()}`,
              pos: { x: enemy.pos.x + enemy.width / 2, y: enemy.pos.y + enemy.height / 2 },
              vel: { x: dir * 6, y: (Math.random() - 0.5) * 4 },
              width: 30, height: 30, type: 'projectile'
            });
          }
        } else {
          const speed = (1.5 + round * 0.3) * directorConfig.difficulty;
          enemy.vel.x = dir * speed;
        }

        enemy.pos.x += enemy.vel.x;

        if (Math.random() < 0.02 && !enemy.isDropping && enemy.variant !== 'boss') enemy.vel.y = -8 - round * 0.2;
        enemy.vel.y += GRAVITY;
        enemy.pos.y += enemy.vel.y;

        p.forEach(plat => {
          if (!enemy.isDropping && checkCollision(enemy, { pos: { x: plat.x, y: plat.y }, width: plat.w, height: plat.h })) {
            if (enemy.vel.y > 0 && enemy.pos.y + enemy.height - enemy.vel.y <= plat.y + 20) {
              enemy.pos.y = plat.y - enemy.height;
              enemy.vel.y = 0;
            }
          }
        });

        // CONTACT DEATH
        (isMultiplayer ? [player, player2] : [player]).forEach(pTarget => {
          if (pTarget.lives > 0 && checkCollision(pTarget, enemy)) {
            pTarget.lives--;
            audioSystem.playGameOver();
            createBurst(pTarget.pos, '#ef4444', 30);

            if (pTarget.lives > 0) {
              // Respawn
              pTarget.pos = { x: pTarget.id === 'p1' ? 100 : 700, y: 550 };
              pTarget.vel = { x: 0, y: 0 };
              createPopupText(pTarget.pos, "RESPAWNING...", '#facc15');
            } else {
              // Out of lives
              pTarget.health = 0;
              pTarget.pos = { x: -1000, y: -1000 };

              if (player.lives <= 0 && (!isMultiplayer || player2.lives <= 0)) {
                onGameOver("All units terminated. Signal Lost.", score);
              }
            }
          }
        });
      } else if (enemy.isRolling) {
        enemy.pos.x += enemy.vel.x;
        enemy.pos.y += enemy.vel.y;
        enemy.vel.y += GRAVITY;
        p.forEach(plat => {
          if (checkCollision(enemy, { pos: { x: plat.x, y: plat.y }, width: plat.w, height: plat.h })) {
            if (enemy.vel.y > 0) { enemy.pos.y = plat.y - enemy.height; enemy.vel.y = 0; }
          }
        });
        if (enemy.pos.x < 0 || enemy.pos.x > CANVAS_WIDTH - enemy.width) {
          createBurst(enemy.pos, COLORS.ICE, 25);
          audioSystem.playImpact();
          return false; // Shatter on wall hit
        }

        enemiesRef.current.forEach(other => {
          if (other.id !== enemy.id && !other.isRolling && checkCollision(enemy, other)) {
            other.isFrozen = true; other.isRolling = true;
            other.vel.x = enemy.vel.x * 0.95; other.vel.y = -6;
            createBurst(other.pos, COLORS.ICE, 15);
            audioSystem.playImpact();
            setScore(s => s + 750);
          }
        });

        if (Math.abs(enemy.vel.x) < 0.8) { // Increased threshold and removed height check
          if (Math.random() < 0.7) {
            const types: PowerUpType[] = ['FAST_RUN', 'FAST_SNOW', 'WIDE_SNOW'];
            powerUpsRef.current.push({
              id: Math.random().toString(), pos: { ...enemy.pos }, vel: { x: 0, y: -7 }, width: 32, height: 32, type: 'powerup', powerType: types[Math.floor(Math.random() * 3)], life: 12
            });
          }
          createBurst(enemy.pos, COLORS.ICE, 20); // Add visual shatter
          audioSystem.playImpact();
          return false;
        }
      } else {
        // Player kicks the frozen ball
        if (checkCollision(player, enemy)) {
          enemy.isRolling = true; enemy.vel.x = player.facing * 18; enemy.vel.y = -6;
          audioSystem.playImpact();
        } else {
          // Thaw Logic
          if (enemy.freezeTimer !== undefined) {
            enemy.freezeTimer--;
            if (enemy.freezeTimer <= 0) {
              enemy.isFrozen = false;
              enemy.freezeLevel = 0;
            }
          }
        }
      }
      return true;
    });

    if (enemiesRef.current.length === 0) nextRound();

    // FX
    particlesRef.current = particlesRef.current.filter(p => {
      p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.life -= 0.016; return p.life > 0;
    });

  }, [directorConfig, onGameOver, score, round, nextRound]);

  // --- RENDERING SYSTEM ---
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    // 1. DYNAMIC BACKGROUND
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0f172a'); // Slate 900
    gradient.addColorStop(1, '#1e293b'); // Slate 800
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Distant Mountains Procedural
    ctx.fillStyle = '#334155'; // Slate 700
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT);
    ctx.lineTo(200, 300); ctx.lineTo(400, 500); ctx.lineTo(700, 250); ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fill();

    // Fog Layer
    ctx.save();
    ctx.globalAlpha = directorConfig.fogDensity * 0.5;
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();


    // 2. PLATFORMS (Ice & Snow)
    platformsRef.current.forEach(p => {
      // Main Ice block
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      grad.addColorStop(0, 'rgba(200, 230, 255, 0.9)');
      grad.addColorStop(0.5, 'rgba(100, 180, 220, 0.8)');
      grad.addColorStop(1, 'rgba(50, 100, 150, 0.8)');
      ctx.fillStyle = grad;
      ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(100,200,255,0.4)';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.shadowBlur = 0;

      // Snow Cap
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(p.x - 2, p.y - 4, p.w + 4, 8, 4);
      ctx.fill();

      // Ice cracks details
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + 10, p.y + 5); ctx.lineTo(p.x + 20, p.y + 15);
      ctx.moveTo(p.x + p.w - 15, p.y + 10); ctx.lineTo(p.x + p.w - 25, p.y + 20);
      ctx.stroke();
    });


    // 3. PLAYERS
    const drawP = (p: Player, color: string) => {
      if (p.lives <= 0) return;
      ctx.save();
      ctx.translate(p.pos.x + p.width / 2, p.pos.y + p.height / 2);
      ctx.scale(p.facing, 1);
      // Scarf
      ctx.beginPath(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.moveTo(-5, -15);
      ctx.quadraticCurveTo(-20 - Math.abs(p.vel.x) * 2, -15 + p.vel.y, -30 - Math.abs(p.vel.x) * 4, -10);
      ctx.stroke();
      // Body
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(-14, -10, 28, 34, 8); ctx.fill();
      // Head
      ctx.fillStyle = '#fce7f3'; ctx.beginPath(); ctx.arc(0, -20, 14, 0, Math.PI * 2); ctx.fill();
      // Hat
      ctx.fillStyle = '#1e3a8a'; ctx.beginPath(); ctx.arc(0, -22, 15, Math.PI, 0); ctx.fill();
      // Goggles
      ctx.fillStyle = '#000'; ctx.fillRect(2, -26, 12, 6);
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(3, -25, 5, 4); ctx.fillRect(9, -25, 4, 4);
      // Boots
      ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.ellipse(-8, 24, 6, 4, 0, 0, Math.PI * 2); ctx.ellipse(8, 24, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    drawP(playerRef.current, '#3b82f6');
    if (isMultiplayer) drawP(player2Ref.current, '#10b981');

    // HUD
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.roundRect(20, 20, 180, 50, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 14px Inter';
    ctx.fillText(`P1 ${'❤️'.repeat(playerRef.current.lives)}`, 40, 42);
    ctx.font = '500 10px monospace';
    ctx.fillText(`SCORE: ${score.toLocaleString()}`, 40, 58);

    if (isMultiplayer) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.roundRect(CANVAS_WIDTH - 200, 20, 180, 50, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 14px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(`${'❤️'.repeat(player2Ref.current.lives)} P2`, CANVAS_WIDTH - 40, 42);
      ctx.textAlign = 'left';
    }


    // 4. ENEMIES (Monsters)
    enemiesRef.current.forEach(e => {
      ctx.save();
      ctx.translate(e.pos.x + e.width / 2, e.pos.y + e.height / 2);

      if (e.isFrozen) {
        // Ice Block
        ctx.fillStyle = 'rgba(200, 240, 255, 0.8)';
        ctx.shadowBlur = 15; ctx.shadowColor = '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        if (e.isRolling) {
          // Rolling Sphere
          ctx.rotate(Date.now() / 100);
          ctx.arc(0, 0, e.width / 2 + 4, 0, Math.PI * 2);
        } else {
          // Static Block
          ctx.roundRect(-e.width / 2 - 2, -e.height / 2 - 2, e.width + 4, e.height + 4, 8);
        }
        ctx.fill();
        ctx.stroke();

        // Trapped Monster Silhouette inside
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();

      } else {
        // Monster & Boss
        const isBoss = e.variant === 'boss';
        const isRed = e.variant === 'red' || isBoss;
        const color = isBoss ? '#7f1d1d' : (isRed ? '#dc2626' : '#2563eb');

        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        if (isBoss) {
          ctx.roundRect(-e.width / 2, -e.height / 2, e.width, e.height, 20);
          ctx.fill();
          // Boss Crown
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.moveTo(-30, -e.height / 2);
          ctx.lineTo(-20, -e.height / 2 - 30);
          ctx.lineTo(0, -e.height / 2 - 10);
          ctx.lineTo(20, -e.height / 2 - 30);
          ctx.lineTo(30, -e.height / 2);
          ctx.fill();

          // Boss Health Bar UI
          ctx.fillStyle = '#450a0a';
          ctx.fillRect(-60, -e.height / 2 - 50, 120, 10);
          const hpWidth = Math.max(0, (e.hp / BOSS_STATS.HEALTH) * 120);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(-60, -e.height / 2 - 50, hpWidth, 10);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.strokeRect(-60, -e.height / 2 - 50, 120, 10);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px Inter';
          ctx.textAlign = 'center';
          ctx.fillText("BOSS UNIT", 0, -e.height / 2 - 55);
        } else {
          ctx.moveTo(-15, 20);
          ctx.lineTo(-20, -10);
          ctx.lineTo(-5, -25);
          ctx.lineTo(5, -25);
          ctx.lineTo(20, -10);
          ctx.lineTo(15, 20);
          ctx.fill();
        }

        // Eyes (Glowing)
        ctx.shadowBlur = 10; ctx.shadowColor = '#facc15';
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        const eyeOff = isBoss ? 30 : 8;
        const eyeSize = isBoss ? 8 : 4;
        ctx.arc(-eyeOff, -10, eyeSize, 0, Math.PI * 2);
        ctx.arc(eyeOff, -10, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Mouth
        ctx.fillStyle = '#000';
        ctx.beginPath();
        if (isBoss) {
          ctx.roundRect(-40, 20, 80, 20, 10);
        } else {
          ctx.moveTo(-10, 10); ctx.lineTo(0, 15); ctx.lineTo(10, 10);
        }
        ctx.fill();
      }
      ctx.restore();
    });


    // 5. PROJECTILES & PARTICLES
    projectilesRef.current.forEach(p => {
      ctx.save();
      ctx.shadowBlur = 15; ctx.shadowColor = '#fff';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.pos.x + p.width / 2, p.pos.y + p.height / 2, p.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    particlesRef.current.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life);
      if (p.type === 'text' && p.text) {
        ctx.fillStyle = p.color;
        ctx.font = 'bold 30px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.pos.x, p.pos.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.globalAlpha = 1.0;

    // Vignette
    const vig = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH / 3, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (isPaused) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.font = '900 72px Inter';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(255,255,255,0.5)';
      ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }

  }, [directorConfig, isPaused, isMultiplayer, score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const render = () => { update(); draw(ctx); animId = requestAnimationFrame(render); };
    render();
    return () => cancelAnimationFrame(animId);
  }, [update, draw]);

  return (
    <div className="relative border-4 border-slate-900 rounded-[3rem] overflow-hidden bg-black shadow-2xl">
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-auto" />
      <div className="absolute top-10 left-10 flex flex-col gap-4 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10">
          <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.4em] mb-1">Combat Round</div>
          <div className="text-5xl text-white font-black">{round}</div>
        </div>
        <div className="bg-black/40 backdrop-blur-lg px-4 py-2 rounded-xl text-xs text-white/50 font-mono">
          SYNC_SCORE: {score.toLocaleString()}
        </div>
        {!audioStarted && (
          <div className="bg-red-500/80 backdrop-blur-lg px-4 py-2 rounded-xl text-xs text-white font-bold animate-pulse">
            PRESS ANY KEY TO ENGAGE AUDIO
          </div>
        )}
      </div>
      <div className="absolute top-10 right-10 text-right pointer-events-none">
        <div className="text-cyan-500 text-[10px] font-bold uppercase tracking-widest mb-1">Neural Feed</div>
        <div className="text-white text-xl font-light italic max-w-sm text-shadow-lg">{directorConfig.message}</div>
      </div>
    </div>
  );
};

export default GameEngine;
