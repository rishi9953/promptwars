
import React, { useState, useEffect, useCallback } from 'react';
import GameEngine from './components/GameEngine';
import { GameState, DirectorConfig } from './types';
import { getDirectorUpdate, getCoachFeedback } from './services/geminiService';

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

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 selection:bg-cyan-500 selection:text-black">
      <div className="max-w-7xl w-full flex flex-col gap-6">

        {gameState === GameState.MENU && (
          <div className="flex flex-col items-center justify-center py-24 bg-slate-900/30 backdrop-blur-3xl border border-white/5 rounded-[3rem] shadow-2xl text-center relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>

            <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-t from-slate-400 via-white to-white tracking-tighter mb-4 drop-shadow-2xl">
              SNOW BROS
            </h1>
            <p className="text-cyan-400 uppercase tracking-[0.5em] font-black text-sm mb-16 animate-pulse">Advanced Combat Rebirth</p>

            <div className="flex flex-wrap justify-center gap-8 mb-16 px-12">
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  <kbd className="w-10 h-10 flex items-center justify-center bg-white/10 border border-white/20 rounded-lg text-white font-bold uppercase">A</kbd>
                  <kbd className="w-10 h-10 flex items-center justify-center bg-white/10 border border-white/20 rounded-lg text-white font-bold uppercase">S</kbd>
                  <kbd className="w-10 h-10 flex items-center justify-center bg-white/10 border border-white/20 rounded-lg text-white font-bold uppercase">D</kbd>
                </div>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Move / Aim</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <kbd className="w-10 h-10 flex items-center justify-center bg-white/10 border border-white/20 rounded-lg text-white font-bold uppercase">W</kbd>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Jump / Aim Up</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <kbd className="px-4 py-2 bg-cyan-500 border border-cyan-400 rounded-lg text-black font-bold uppercase">Enter</kbd>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Cast Snow</span>
              </div>
            </div>

            <button
              onClick={startGame}
              className="px-16 py-5 bg-white text-slate-950 font-black rounded-full hover:scale-110 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:shadow-cyan-500/40"
            >
              START PROTOCOL
            </button>
          </div>
        )}

        {gameState === GameState.PLAYING && (
          <GameEngine onGameOver={handleGameOver} onScoreChange={setScore} directorConfig={directorConfig} />
        )}

        {gameState === GameState.GAMEOVER && (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 backdrop-blur-xl border border-red-500/20 rounded-[3rem] text-center">
            <h2 className="text-6xl font-black text-white mb-4 uppercase tracking-tighter">Simulation Ended</h2>
            <div className="text-cyan-400 font-mono text-xl mb-12">DATA COLLECTED: {score.toLocaleString()}</div>

            <div className="max-w-lg w-full bg-black/60 p-8 rounded-3xl border border-white/5 mb-12 shadow-2xl">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mb-4">Neural Feedback</div>
              {isAiLoading ? (
                <div className="text-cyan-500 animate-pulse font-mono uppercase text-sm tracking-widest">Processing performance metrics...</div>
              ) : (
                <p className="text-xl text-white font-light italic leading-relaxed">"{coachMessage}"</p>
              )}
            </div>

            <button
              onClick={startGame}
              className="px-12 py-4 bg-red-600 text-white font-black rounded-full hover:bg-white hover:text-black transition-all shadow-xl"
            >
              RE-INITIATE SEQUENCE
            </button>
          </div>
        )}

        <div className="flex justify-between items-center text-[10px] text-slate-700 font-mono uppercase tracking-widest px-8">
          <div>RTX_OFFLINE // HOLOGRAPHIC_UI_ENABLED</div>
          <div>GEMINI_CORE_V4.1 // 10_STAGE_CAMPAIGN</div>
        </div>
      </div>
    </div>
  );
};

export default App;
