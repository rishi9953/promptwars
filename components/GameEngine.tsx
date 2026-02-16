
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  GameState, Player, Enemy, Platform, Entity, Particle, Vector2, DirectorConfig, PowerUp, PowerUpType 
} from '../types';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, GRAVITY, JUMP_FORCE, WALK_SPEED, 
  SNOWBALL_SPEED, FRICTION, COLORS, FAST_WALK_SPEED, FAST_SNOWBALL_SPEED, LEVEL_LAYOUTS 
} from '../constants';

interface GameEngineProps {
  onGameOver: (reason: string, score: number) => void;
  onScoreChange: (score: number) => void;
  directorConfig: DirectorConfig;
}

const GameEngine: React.FC<GameEngineProps> = ({ onGameOver, onScoreChange, directorConfig }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  
  const playerRef = useRef<Player>({
    id: 'p1',
    pos: { x: 100, y: 550 },
    vel: { x: 0, y: 0 },
    width: 36,
    height: 54,
    type: 'player',
    isJumping: false,
    facing: 1,
    health: 100,
    snowballs: 10,
    abilities: { fastRun: false, fastSnow: false, wideSnow: false }
  });

  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const platformsRef = useRef<Platform[]>(LEVEL_LAYOUTS[0].platforms);
  
  const keys = useRef<Record<string, boolean>>({});

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
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const spawnEnemies = (roundNum: number) => {
    const count = Math.min(3 + roundNum, 8);
    const newEnemies: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      newEnemies.push({
        id: `e-${roundNum}-${i}`,
        pos: { x: 200 + Math.random() * (CANVAS_WIDTH - 400), y: 50 + Math.random() * 300 },
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
    if (round >= 10) {
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

  const checkCollision = (a: any, b: any) => {
    return (
      a.pos.x < b.pos.x + b.width &&
      a.pos.x + a.width > b.pos.x &&
      a.pos.y < b.pos.y + b.height &&
      a.pos.y + a.height > b.pos.y
    );
  };

  const update = useCallback(() => {
    const player = playerRef.current;
    const p = platformsRef.current;

    // Player Movement (A and D keys)
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

    // Jump (W key)
    if (keys.current['KeyW'] && !player.isJumping) {
      player.vel.y = JUMP_FORCE;
      player.isJumping = true;
    }
    player.vel.y += GRAVITY;

    // Snowball Firing (Enter key) - FIXED: Instant, per-press firing
    if (keys.current['Enter']) {
      const maxProj = player.abilities.fastSnow ? 15 : 8;
      if (projectilesRef.current.length < maxProj) {
        const speed = player.abilities.fastSnow ? FAST_SNOWBALL_SPEED : SNOWBALL_SPEED;
        const size = player.abilities.wideSnow ? 36 : 18;
        
        // DETERMINE DIRECTION BASED ON HELD KEYS
        let aimX = 0;
        let aimY = 0;
        if (keys.current['KeyA']) aimX = -1;
        if (keys.current['KeyD']) aimX = 1;
        if (keys.current['KeyW']) aimY = -1;
        if (keys.current['KeyS']) aimY = 1;

        // If no keys held, fire in horizontal facing direction
        if (aimX === 0 && aimY === 0) {
          aimX = player.facing;
        }

        const mag = Math.sqrt(aimX * aimX + aimY * aimY);
        const targetVel = { 
          x: (aimX / mag) * speed, 
          y: (aimY / mag) * speed 
        };

        projectilesRef.current.push({
          id: Math.random().toString(),
          pos: { 
            x: player.pos.x + player.width / 2 - size / 2 + (aimX * 20), 
            y: player.pos.y + player.height / 2 - size / 2 + (aimY * 20) 
          },
          vel: targetVel,
          width: size,
          height: size,
          type: 'projectile'
        });
      }
      // Force user to release and press Enter again for next snowball (each time when I press enter)
      // If we want auto-fire on hold with NO delay, we'd just leave it true, but "each time I press" implies semi-auto.
      keys.current['Enter'] = false; 
    }

    player.pos.x += player.vel.x;
    player.pos.y += player.vel.y;

    // Platform Collisions (Allow jumping up through them, land on top)
    player.isJumping = true;
    for (const plat of p) {
      if (checkCollision(player, { pos: { x: plat.x, y: plat.y }, width: plat.w, height: plat.h })) {
        if (player.vel.y > 0 && player.pos.y + player.height - player.vel.y <= plat.y + 15) {
          player.pos.y = plat.y - player.height;
          player.vel.y = 0;
          player.isJumping = false;
        }
      }
    }

    if (player.pos.x < 0) player.pos.x = 0;
    if (player.pos.x + player.width > CANVAS_WIDTH) player.pos.x = CANVAS_WIDTH - player.width;

    // Projectiles Logic (Destroy after hitting ANY obstacle or enemy ball)
    projectilesRef.current = projectilesRef.current.filter(proj => {
      proj.pos.x += proj.vel.x;
      proj.pos.y += proj.vel.y;
      
      let hit = false;
      // Hit Enemies
      enemiesRef.current.forEach(enemy => {
        if (!enemy.isFrozen && checkCollision(proj, enemy)) {
          enemy.freezeLevel += player.abilities.wideSnow ? 50 : 35;
          if (enemy.freezeLevel >= 100) enemy.isFrozen = true;
          hit = true;
        } else if (enemy.isFrozen && checkCollision(proj, enemy)) {
          hit = true;
        }
      });
      // Hit Platforms
      p.forEach(plat => {
        if (!hit && checkCollision(proj, { pos: { x: plat.x, y: plat.y }, width: plat.w, height: plat.h })) {
          hit = true;
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
        const dx = player.pos.x - enemy.pos.x;
        const dir = dx > 0 ? 1 : -1;
        const speed = (1.5 + round * 0.3) * directorConfig.difficulty;
        enemy.vel.x = dir * speed;
        enemy.pos.x += enemy.vel.x;
        
        if (Math.random() < 0.02) enemy.vel.y = -8 - round * 0.2;
        enemy.vel.y += GRAVITY;
        enemy.pos.y += enemy.vel.y;

        p.forEach(plat => {
          if (checkCollision(enemy, { pos: { x: plat.x, y: plat.y }, width: plat.w, height: plat.h })) {
            if (enemy.vel.y > 0) { enemy.pos.y = plat.y - enemy.height; enemy.vel.y = 0; }
          }
        });

        // CONTACT DEATH
        if (checkCollision(player, enemy)) {
          onGameOver("Hull Integrity compromised by hostiles.", score);
        }
      } else if (enemy.isRolling) {
        enemy.pos.x += enemy.vel.x;
        enemy.pos.y += enemy.vel.y;
        enemy.vel.y += GRAVITY;
        p.forEach(plat => {
            if (checkCollision(enemy, { pos: { x: plat.x, y: plat.y }, width: plat.w, height: plat.h })) {
                if (enemy.vel.y > 0) { enemy.pos.y = plat.y - enemy.height; enemy.vel.y = 0; }
            }
        });
        if (enemy.pos.x < 0 || enemy.pos.x > CANVAS_WIDTH - enemy.width) enemy.vel.x *= -0.9;
        
        enemiesRef.current.forEach(other => {
            if (other.id !== enemy.id && !other.isRolling && checkCollision(enemy, other)) {
                other.isFrozen = true; other.isRolling = true; 
                other.vel.x = enemy.vel.x * 0.95; other.vel.y = -6;
                setScore(s => s + 750);
            }
        });

        if (Math.abs(enemy.vel.x) < 0.5 && enemy.pos.y > 600) {
            if (Math.random() < 0.7) {
                const types: PowerUpType[] = ['FAST_RUN', 'FAST_SNOW', 'WIDE_SNOW'];
                powerUpsRef.current.push({
                    id: Math.random().toString(), pos: { ...enemy.pos }, vel: { x: 0, y: -7 }, width: 32, height: 32, type: 'powerup', powerType: types[Math.floor(Math.random()*3)], life: 12
                });
            }
            return false;
        }
      } else {
        // Player kicks the frozen ball
        if (checkCollision(player, enemy)) { 
            enemy.isRolling = true; enemy.vel.x = player.facing * 18; enemy.vel.y = -6; 
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

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = COLORS.DEEP_BLUE;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background Layers
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT);
    ctx.lineTo(300, 480);
    ctx.lineTo(650, 600);
    ctx.lineTo(1000, 420);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fill();

    // Platforms
    platformsRef.current.forEach(p => {
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      grad.addColorStop(0, COLORS.ICE);
      grad.addColorStop(1, '#475569');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(p.x, p.y, p.w, 4);
    });

    // Player
    const player = playerRef.current;
    ctx.save();
    ctx.shadowBlur = 15; ctx.shadowColor = COLORS.GLOW;
    ctx.fillStyle = COLORS.GLOW;
    ctx.beginPath(); ctx.roundRect(player.pos.x, player.pos.y, player.width, player.height, 12); ctx.fill();
    ctx.fillStyle = '#0f172a';
    const ex = player.facing > 0 ? player.pos.x + 24 : player.pos.x + 4;
    ctx.fillRect(ex, player.pos.y + 14, 6, 8); ctx.fillRect(ex + 10, player.pos.y + 14, 6, 8);
    ctx.restore();

    // Enemies
    enemiesRef.current.forEach(e => {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = e.isFrozen ? COLORS.ICE : (e.variant === 'red' ? '#ef4444' : '#3b82f6');
        ctx.fillStyle = e.isFrozen ? COLORS.ICE : (e.variant === 'red' ? '#ef4444' : '#3b82f6');
        ctx.beginPath(); 
        if (e.isRolling) ctx.arc(e.pos.x + e.width/2, e.pos.y + e.height/2, e.width/2, 0, Math.PI*2);
        else ctx.roundRect(e.pos.x, e.pos.y, e.width, e.height, 10);
        ctx.fill();
        ctx.restore();
    });

    // Projectiles
    projectilesRef.current.forEach(p => {
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = '#fff';
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.pos.x + p.width/2, p.pos.y + p.height/2, p.width/2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    });

    // Particles/FX
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life);
      if (p.type === 'text' && p.text) {
        ctx.fillStyle = p.color;
        ctx.font = 'bold 30px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.pos.x, p.pos.y);
      } else {
        ctx.fillStyle = p.color; ctx.fillRect(p.pos.x, p.pos.y, p.size, p.size);
      }
    });
    ctx.globalAlpha = 1.0;

    // Atmospheric Effects
    ctx.fillStyle = `rgba(255, 255, 255, ${directorConfig.fogDensity * 0.1})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const vig = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 0, CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH);
    vig.addColorStop(0.5, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  }, [directorConfig]);

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
      </div>
      <div className="absolute top-10 right-10 text-right pointer-events-none">
         <div className="text-cyan-500 text-[10px] font-bold uppercase tracking-widest mb-1">Neural Feed</div>
         <div className="text-white text-xl font-light italic max-w-sm">{directorConfig.message}</div>
      </div>
    </div>
  );
};

export default GameEngine;
