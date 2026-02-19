
import React, { useState, useEffect, useCallback } from 'react';
import GameEngine from './components/GameEngine';
import { GameState, DirectorConfig } from './types';
import { getDirectorUpdate, getCoachFeedback } from './services/geminiService';
import { multiplayerManager } from './services/multiplayerService';
import { audioSystem } from './services/audioService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [coachMessage, setCoachMessage] = useState<string>('');
  const [directorConfig, setDirectorConfig] = useState<DirectorConfig>({
    lightingIntensity: 0.5,
    fogDensity: 0.2,
    snowRate: 2,
    difficulty: 1.0,
    message: "Stabilizing rendering pipeline..."
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    const interval = setInterval(async () => {
      const config = await getDirectorUpdate(score, 3, 0);
      setDirectorConfig(config);
    }, 12000);
    return () => clearInterval(interval);
  }, [gameState, score]);

  const handleGameOver = useCallback(async (reason: string, finalScore: number) => {
    setGameState(GameState.GAMEOVER);
    setScore(finalScore);
    setIsAiLoading(true);
    const feedback = await getCoachFeedback(reason, finalScore);
    setCoachMessage(feedback);
    setIsAiLoading(false);
  }, []);

  const startGame = () => {
    setScore(0);
    setGameState(GameState.PLAYING);
    setCoachMessage('');
  };

  const startSinglePlayer = () => {
    setIsMultiplayer(false);
    startGame();
  };

  const startMultiplayer = () => {
    setIsMultiplayer(true);
    startGame();
  };

  const toggleMute = () => {
    const newMuted = audioSystem.toggleMute();
    setIsMuted(newMuted);
  };

  const restartCurrentGame = () => {
    setIsSettingsOpen(false);
    startGame();
  };

  const goToMainMenu = () => {
    setIsSettingsOpen(false);
    setGameState(GameState.MENU);
    audioSystem.stopBGM();
  };

  const hostGame = async () => {
    setIsConnecting(true);
    try {
      const id = await multiplayerManager.init();
      setPeerId(id);
      setIsMultiplayer(true);
    } catch (err) {
      console.error("Failed to host:", err);
    }
    setIsConnecting(false);
  };

  const joinGame = async () => {
    if (!roomCode) return;
    setIsConnecting(true);
    try {
      await multiplayerManager.init();
      await multiplayerManager.join(roomCode);
      setIsMultiplayer(true);
      startGame();
    } catch (err) {
      console.error("Failed to join:", err);
      alert("Could not connect to room. Check the code.");
    }
    setIsConnecting(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 selection:bg-cyan-500 selection:text-black">
      <div className="max-w-5xl w-full flex flex-col gap-6 items-center">

        {gameState === GameState.MENU && (
          <div className="flex flex-col items-center justify-center py-16 px-8 bg-slate-900/30 backdrop-blur-3xl border border-white/5 rounded-[3rem] shadow-2xl text-center relative overflow-hidden min-w-[500px]">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>

            <div className="relative mb-8 group">
              <div className="absolute inset-x-0 bottom-0 top-1/2 bg-white/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-colors"></div>
              <img src="/snow.png" alt="Snow Bros" className="w-80 h-auto relative z-10 drop-shadow-[0_10px_60px_rgba(255,255,255,0.3)] animate-[float_6s_ease-in-out_infinite]" />
            </div>
            <p className="text-cyan-400 uppercase tracking-[0.5em] font-black text-[10px] mb-8 animate-pulse">Advanced Combat Rebirth</p>

            <div className="flex flex-col gap-4 w-full max-w-sm mb-12">
              <button
                onClick={startGame}
                className="w-full py-4 bg-white text-slate-950 font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.2)]"
              >
                SINGLE PLAYER
              </button>

              {!peerId && !isConnecting && (
                <button
                  onClick={hostGame}
                  className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl border border-white/10 hover:bg-slate-700 transition-all"
                >
                  HOST CO-OP
                </button>
              )}

              {peerId && (
                <div className="p-4 bg-slate-800/50 rounded-2xl border border-cyan-500/30 animate-in fade-in slide-in-from-top-4">
                  <p className="text-xs text-slate-400 mb-1 font-bold uppercase">Room Code</p>
                  <p className="text-2xl font-mono font-black text-cyan-400 selection:bg-cyan-500/30 tracking-widest">{peerId}</p>
                  <p className="text-[10px] text-slate-500 mt-2 italic">Share this code with Player 2</p>
                  <button onClick={startGame} className="mt-4 w-full py-2 bg-cyan-600 text-white font-black rounded-lg hover:bg-cyan-500 transition-colors">LAUNCH SESSION</button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ENTER ROOM CODE..."
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-black/50 border border-white/10 rounded-2xl px-4 text-white font-mono placeholder:text-slate-700 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <button
                  onClick={joinGame}
                  disabled={isConnecting}
                  className="px-6 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 disabled:opacity-50 transition-all"
                >
                  JOIN
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
              <div className="flex flex-col items-center gap-1">
                <div className="flex gap-1">
                  {['W', 'A', 'S', 'D'].map(k => <kbd key={k} className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded text-white text-[10px] font-bold">{k}</kbd>)}
                </div>
                <span className="text-[8px] text-slate-500 font-bold">P1 CONTROLS</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex gap-1">
                  <kbd className="px-3 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded text-white text-[10px] font-bold">ENTER</kbd>
                </div>
                <span className="text-[8px] text-slate-500 font-bold">SHOOT</span>
              </div>
            </div>
          </div>
        )}

        {gameState === GameState.PLAYING && (
          <>
            <GameEngine
              onGameOver={handleGameOver}
              onScoreChange={setScore}
              directorConfig={directorConfig}
              isMultiplayer={isMultiplayer}
              isPaused={isSettingsOpen}
            />
            {/* Settings Trigger */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="fixed top-4 right-4 z-[90] p-3 bg-black/50 backdrop-blur-md rounded-full border border-white/20 text-white hover:bg-slate-800 transition-all hover:rotate-90 duration-500 shadow-lg"
              title="Settings"
            >
              ⚙️
            </button>
          </>
        )}

        {/* SETTINGS OVERLAY */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-slate-900 border-2 border-white/10 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white transition-colors text-2xl">✕</button>
              </div>

              <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">System Settings</h3>
              <p className="text-slate-500 text-xs font-mono mb-8 uppercase tracking-widest">Configuration // Session_01</p>

              <div className="space-y-4">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full py-5 bg-cyan-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-cyan-500 transition-all shadow-[0_4px_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-3"
                >
                  RESUME GAME
                </button>

                <button
                  onClick={toggleMute}
                  className={`w-full py-5 rounded-2xl border-2 transition-all flex items-center justify-between px-8 font-black uppercase tracking-widest ${isMuted ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-cyan-500 text-cyan-500 bg-cyan-500/10'}`}
                >
                  <span>{isMuted ? 'Sound Restricted' : 'Audio Active'}</span>
                  <span>{isMuted ? '🔇' : '🔊'}</span>
                </button>

                <button
                  onClick={restartCurrentGame}
                  className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_4px_20px_rgba(255,255,255,0.2)]"
                >
                  RE_INITIALIZE SESSION
                </button>

                <button
                  onClick={goToMainMenu}
                  className="w-full py-5 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest border border-white/5 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center gap-3"
                >
                  <span>🏠</span>
                  <span>MAIN MENU</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === GameState.GAMEOVER && (
          <div className="flex flex-col items-center justify-center p-8 bg-black/90 backdrop-blur-3xl border-4 border-red-600 rounded-[3rem] text-center relative overflow-hidden animate-in fade-in zoom-in duration-500 max-w-2xl w-full">

            {/* Background Glitch Effects */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
            <div className="absolute inset-x-0 top-0 h-1 bg-red-500/50 animate-[scan_2s_linear_infinite]"></div>

            <div className="relative z-10 w-24 h-24 mb-8">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
              <div className="w-full h-full bg-slate-900 border-2 border-red-500 rounded-full flex items-center justify-center text-red-500 text-5xl">
                ☠️
              </div>
            </div>

            <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-900 mb-2 uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              YOU LOST
            </h2>
            <div className="text-red-400 font-mono text-xs tracking-[0.5em] mb-10 animate-pulse">GAME OVER</div>

            <div className="flex gap-4 mb-12">
              <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-2xl w-40">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Score</div>
                <div className="text-2xl text-white font-black">{score.toLocaleString()}</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-2xl w-40">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Status</div>
                <div className="text-2xl text-red-500 font-black">MIA</div>
              </div>
            </div>

            <div className="w-full bg-red-950/30 p-8 rounded-3xl border border-red-500/20 mb-12 shadow-inner relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div>
              <div className="text-[10px] text-red-400/70 font-bold uppercase tracking-[0.3em] mb-4 text-left">Black Box Retrieval</div>
              {isAiLoading ? (
                <div className="flex items-center gap-3 text-red-500 animate-pulse font-mono uppercase text-sm tracking-widest">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Decryption in progress...
                </div>
              ) : (
                <p className="text-lg text-red-100 font-light italic leading-relaxed text-left border-l-2 border-red-500 pl-4 py-2 bg-gradient-to-r from-red-900/20 to-transparent">
                  "{coachMessage}"
                </p>
              )}
            </div>

            <div className="flex flex-col gap-4 w-full">
              <div className="flex gap-4">
                <button
                  onClick={startSinglePlayer}
                  className="flex-1 group relative px-8 py-5 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-cyan-500/50 overflow-hidden"
                >
                  <span className="relative z-10 group-hover:text-cyan-600 transition-colors">SINGLE CORE</span>
                  <div className="absolute inset-0 bg-cyan-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>

                <button
                  onClick={startMultiplayer}
                  className="flex-1 group relative px-8 py-5 bg-slate-900 border-2 border-white/20 text-white font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:border-red-500/50 overflow-hidden"
                >
                  <span className="relative z-10 group-hover:text-white transition-colors">CO-OP LINK</span>
                  <div className="absolute inset-0 bg-red-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
              </div>

              <button
                onClick={goToMainMenu}
                className="w-full py-4 bg-slate-900/50 text-slate-500 font-bold uppercase tracking-[0.3em] rounded-xl border border-white/5 hover:bg-slate-800 hover:text-white transition-all text-xs flex items-center justify-center gap-2"
              >
                <span>🏠</span>
                <span>MAIN MENU</span>
              </button>
            </div>
          </div>
        )}

        <div className="w-full flex justify-between items-center text-[10px] text-slate-700 font-mono uppercase tracking-widest px-8">
          <div>RTX_OFFLINE // HOLOGRAPHIC_UI_ENABLED</div>
          <div>GEMINI_CORE_V4.1 // 10_STAGE_CAMPAIGN</div>
        </div>
      </div>
    </div>
  );
};

export default App;
