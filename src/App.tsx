/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, CheckCircle2, XCircle, Trophy, Info, Heart } from 'lucide-react';

type GamePhase = 'START' | 'MEMORIZE' | 'SELECT' | 'RESULT' | 'GAME_OVER';
type GameMode = 'NORMAL' | 'INFINITY';

interface Color {
  hex: string;
  r: number;
  g: number;
  b: number;
  oklab: { L: string; a: string; b: string };
  family?: string;
}

const rgbToOklab = (r: number, g: number, b: number) => {
  let lr = r / 255;
  let lg = g / 255;
  let lb = b / 255;

  lr = lr > 0.04045 ? Math.pow((lr + 0.055) / 1.055, 2.4) : lr / 12.92;
  lg = lg > 0.04045 ? Math.pow((lg + 0.055) / 1.055, 2.4) : lg / 12.92;
  lb = lb > 0.04045 ? Math.pow((lb + 0.055) / 1.055, 2.4) : lb / 12.92;

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720401 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  return { 
    L: L.toFixed(3), 
    a: a.toFixed(3), 
    b: b_.toFixed(3) 
  };
};

const hexToRgb = (hex: string): Color => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { hex, r, g, b, oklab: rgbToOklab(r, g, b) };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const COLOR_FAMILIES = [
  { name: 'Red', range: { r: [180, 255], g: [0, 80], b: [0, 80] } },
  { name: 'Green', range: { r: [0, 80], g: [180, 255], b: [0, 80] } },
  { name: 'Blue', range: { r: [0, 80], g: [0, 80], b: [180, 255] } },
  { name: 'Yellow', range: { r: [180, 255], g: [180, 255], b: [0, 80] } },
  { name: 'Cyan', range: { r: [0, 80], g: [180, 255], b: [180, 255] } },
  { name: 'Magenta', range: { r: [180, 255], g: [0, 80], b: [180, 255] } },
  { name: 'Orange', range: { r: [200, 255], g: [100, 160], b: [0, 40] } },
  { name: 'Purple', range: { r: [100, 160], g: [0, 80], b: [180, 255] } },
  { name: 'Pink', range: { r: [200, 255], g: [100, 160], b: [150, 200] } },
  { name: 'Teal', range: { r: [0, 80], g: [100, 160], b: [100, 160] } },
];

const generateColorForLevel = (level: number, recentFamilies: string[]): Color => {
  // Filter out families that have been used recently
  const availableFamilies = COLOR_FAMILIES.filter(f => !recentFamilies.includes(f.name));
  
  // Fallback to all families if somehow we filtered everything (shouldn't happen with 10 families and 4 history)
  const pool = availableFamilies.length > 0 ? availableFamilies : COLOR_FAMILIES;
  
  const family = pool[Math.floor(Math.random() * pool.length)];
  const { r: rRange, g: gRange, b: bRange } = family.range;
  
  const r = Math.floor(Math.random() * (rRange[1] - rRange[0] + 1)) + rRange[0];
  const g = Math.floor(Math.random() * (gRange[1] - gRange[0] + 1)) + gRange[0];
  const b = Math.floor(Math.random() * (bRange[1] - bRange[0] + 1)) + bRange[0];
  
  return { hex: rgbToHex(r, g, b), r, g, b, oklab: rgbToOklab(r, g, b), family: family.name };
};

const generateRandomColor = (): Color => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return { hex: rgbToHex(r, g, b), r, g, b, oklab: rgbToOklab(r, g, b) };
};

const generateSimilarColor = (base: Color, distance: number): Color => {
  // To ensure the Euclidean distance is exactly 'distance', we pick a random point on a sphere.
  // We try a few times if the point falls outside the RGB cube [0, 255].
  let r = base.r, g = base.g, b = base.b;
  let attempts = 0;
  
  while (attempts < 20) {
    // Random point on sphere using spherical coordinates
    const phi = Math.random() * 2 * Math.PI;
    const cosTheta = Math.random() * 2 - 1;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    
    const dr = sinTheta * Math.cos(phi) * distance;
    const dg = sinTheta * Math.sin(phi) * distance;
    const db = cosTheta * distance;
    
    const tr = base.r + dr;
    const tg = base.g + dg;
    const tb = base.b + db;
    
    // Check if within bounds
    if (tr >= 0 && tr <= 255 && tg >= 0 && tg <= 255 && tb >= 0 && tb <= 255) {
      r = tr;
      g = tg;
      b = tb;
      break;
    }
    attempts++;
  }
  
  // Fallback: if we couldn't find a point on the sphere within bounds,
  // we pick a direction towards the center of the cube to guarantee a valid color.
  if (attempts === 20) {
    const dr_center = 127.5 - base.r;
    const dg_center = 127.5 - base.g;
    const db_center = 127.5 - base.b;
    const mag = Math.sqrt(dr_center * dr_center + dg_center * dg_center + db_center * db_center);
    
    // If target is exactly at center, any direction works
    const scale = mag > 0 ? distance / mag : 0;
    r = Math.max(0, Math.min(255, base.r + dr_center * scale));
    g = Math.max(0, Math.min(255, base.g + dg_center * scale));
    b = Math.max(0, Math.min(255, base.b + db_center * scale));
  }

  return { hex: rgbToHex(r, g, b), r, g, b, oklab: rgbToOklab(r, g, b) };
};

const calculateAccuracy = (c1: Color, c2: Color): number => {
  const distance = Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
  // Max distance is sqrt(255^2 * 3) approx 441
  const maxDistance = 441.67;
  const accuracy = Math.max(0, 100 - (distance / maxDistance) * 100);
  return parseFloat(accuracy.toFixed(1));
};

const getColorAnalysis = (history: {target: Color, selected: Color}[]) => {
  if (history.length === 0) return null;

  let lightnessDiff = 0;
  const hueCounts: Record<string, number> = {};

  history.forEach(({ target, selected }) => {
    lightnessDiff += (parseFloat(selected.oklab.L) - parseFloat(target.oklab.L));
    
    const r = target.r, g = target.g, b = target.b;
    let hue = "Neutral";
    if (r > g + 40 && r > b + 40) hue = "Red";
    else if (g > r + 40 && g > b + 40) hue = "Green";
    else if (b > r + 40 && b > g + 40) hue = "Blue";
    else if (r > b + 40 && g > b + 40) hue = "Yellow";
    else if (r > g + 40 && b > g + 40) hue = "Purple";
    else if (g > r + 40 && b > r + 40) hue = "Cyan";
    
    hueCounts[hue] = (hueCounts[hue] || 0) + 1;
  });

  const avgLightnessDiff = lightnessDiff / history.length;
  const topHueEntry = Object.entries(hueCounts).sort((a, b) => b[1] - a[1])[0];
  const topHue = topHueEntry ? topHueEntry[0] : "varied";

  let lightnessText = "";
  if (Math.abs(avgLightnessDiff) > 0.03) {
    lightnessText = `You tend to pick colors that are ${avgLightnessDiff > 0 ? 'lighter' : 'darker'} than the target. `;
  }

  return {
    summary: `${lightnessText}You struggle most with ${topHue.toLowerCase()} tones.`,
    topHue
  };
};

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('START');
  const [mode, setMode] = useState<GameMode>('NORMAL');
  const [targetColor, setTargetColor] = useState<Color>(generateRandomColor());
  const [options, setOptions] = useState<Color[]>([]);
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [difficulty, setDifficulty] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [lastPoints, setLastPoints] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{score: number, date: string}[]>([]);
  const [incorrectHistory, setIncorrectHistory] = useState<{level: number, target: Color, selected: Color, options: Color[]}[]>([]);
  const [recentFamilies, setRecentFamilies] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('chroma_leaderboard');
    if (saved) {
      const parsed = JSON.parse(saved);
      setLeaderboard(parsed);
      if (parsed.length > 0) setHighScore(parsed[0].score);
    }
  }, []);

  const saveToLeaderboard = useCallback((finalScore: number) => {
    const newEntry = { score: finalScore, date: new Date().toLocaleDateString() };
    const updated = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    setLeaderboard(updated);
    localStorage.setItem('chroma_leaderboard', JSON.stringify(updated));
    if (updated.length > 0) setHighScore(updated[0].score);
  }, [leaderboard]);

  const startNewRound = useCallback((level: number, currentHistory: string[]) => {
    const newTarget = generateColorForLevel(level, currentHistory);
    setTargetColor(newTarget);
    setRecentFamilies(prev => {
      const updated = [newTarget.family!, ...prev].slice(0, 4);
      return updated;
    });
    setPhase('MEMORIZE');
    setSelectedColor(null);
  }, []);

  const generateOptions = useCallback(() => {
    // Difficulty formula: 120 - (difficulty - 1) * 10
    // After level 10, fix the color range to 20
    const distance = difficulty > 10 ? 20 : 120 - (difficulty - 1) * 10;

    const others = [
      generateSimilarColor(targetColor, distance),
      generateSimilarColor(targetColor, distance),
      generateSimilarColor(targetColor, distance),
    ];
    const allOptions = [targetColor, ...others].sort(() => Math.random() - 0.5);
    setOptions(allOptions);
    setPhase('SELECT');
  }, [targetColor, difficulty]);

  const handleSelect = (color: Color) => {
    setSelectedColor(color);
    const isCorrect = color.hex === targetColor.hex;
    const accuracy = calculateAccuracy(targetColor, color);
    
    // Enhanced scoring: Base points scaled by accuracy, with a massive bonus for 100%
    let points = Math.floor(accuracy * 2); // Up to 200 points for being close
    if (isCorrect) {
      points += 800; // Bonus for exact match (Total 1000 base)
    }
    
    const finalPoints = points * (streak + 1);
    setScore(s => s + finalPoints);
    setLastPoints(finalPoints);

    if (isCorrect) {
      setStreak(s => s + 1);
      setDifficulty(d => d + 1);
    } else {
      setStreak(0);
      setIncorrectHistory(prev => [...prev, { level: difficulty, target: targetColor, selected: color, options: [...options] }]);
      
      if (mode === 'NORMAL') {
        setLives(l => {
          const newLives = l - 1;
          if (newLives <= 0) {
            saveToLeaderboard(score + finalPoints);
          }
          return newLives;
        });
      }
    }
    
    setPhase('RESULT');
  };

  useEffect(() => {
    // Score tracking is now handled by saveToLeaderboard
  }, [score, highScore]);

  const resetGame = () => {
    setScore(0);
    setStreak(0);
    setLives(3);
    setDifficulty(1);
    setIncorrectHistory([]);
    setRecentFamilies([]);
    setPhase('START');
  };

  const startGame = (selectedMode: GameMode) => {
    setMode(selectedMode);
    setScore(0);
    setStreak(0);
    setLives(3);
    setDifficulty(1);
    setIncorrectHistory([]);
    setRecentFamilies([]);
    startNewRound(1, []);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Hue Mind</h1>
          <div className="flex justify-center gap-4 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-amber-500" />
              Score: {score}
            </span>
            <div className="flex gap-1">
              {mode === 'NORMAL' ? (
                [...Array(3)].map((_, i) => (
                  <Heart 
                    key={i} 
                    className={`w-4 h-4 ${i < lives ? 'text-rose-500 fill-rose-500' : 'text-slate-300'}`} 
                  />
                ))
              ) : (
                <span className="text-rose-500 font-black text-lg leading-none">∞</span>
              )}
            </div>
            {streak > 0 && (
              <span className="flex items-center gap-1 text-orange-500 font-bold animate-pulse">
                {streak}x Streak
              </span>
            )}
            <span className="flex items-center gap-1">
              High Score: {highScore}
            </span>
            <span className="flex items-center gap-1">
              Level: {difficulty}
            </span>
          </div>
        </div>

        <main className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 min-h-[450px] flex flex-col items-center justify-center relative overflow-hidden">
          <AnimatePresence mode="wait">
            {phase === 'START' && (
              <motion.div
                key="start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center space-y-6"
              >
                <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-200 flex items-center justify-center">
                  <RefreshCw className="w-10 h-10 text-white animate-spin-slow" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">Ready to test your eyes?</h2>
                  <p className="text-slate-500 text-sm">Memorize the color code, then find it among similar shades.</p>
                </div>
                <div className="grid gap-3">
                  <button
                    onClick={() => startGame('NORMAL')}
                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 active:scale-[0.98]"
                  >
                    Normal Mode
                  </button>
                  <button
                    onClick={() => startGame('INFINITY')}
                    className="w-full py-4 bg-white text-slate-900 border-2 border-slate-900 rounded-xl font-semibold hover:bg-slate-50 transition-colors active:scale-[0.98]"
                  >
                    Infinity Mode
                  </button>
                </div>
              </motion.div>
            )}

            {phase === 'MEMORIZE' && (
              <motion.div
                key="memorize"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="text-center space-y-8 w-full"
              >
                <div className="space-y-4">
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Memorize this color</p>
                  <div 
                    className="w-full aspect-square max-w-[200px] mx-auto rounded-3xl shadow-inner border-4 border-white"
                    style={{ backgroundColor: targetColor.hex }}
                  />
                  <div className="font-mono text-xl font-bold text-slate-800 tracking-tight space-y-1">
                    <div className="text-xs text-slate-400 uppercase">OKLab</div>
                    <div>L: {targetColor.oklab.L}</div>
                    <div>a: {targetColor.oklab.a}</div>
                    <div>b: {targetColor.oklab.b}</div>
                  </div>
                </div>
                <button
                  onClick={generateOptions}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 active:scale-[0.98]"
                >
                  I'm Ready
                </button>
              </motion.div>
            )}

            {phase === 'SELECT' && (
              <motion.div
                key="select"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full space-y-6"
              >
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold">Pick the original color</h2>
                  <p className="text-slate-400 text-sm">Which one matches the target OKLab?</p>
                </div>
                <div className="grid grid-cols-2 gap-0 rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                  {options.map((color, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelect(color)}
                      className="aspect-square transition-colors relative group"
                      style={{ backgroundColor: color.hex }}
                    >
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {phase === 'RESULT' && selectedColor && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full space-y-6 text-center"
              >
                <div className="flex justify-center gap-8 items-center">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">Target</p>
                    <div className="w-20 h-20 rounded-xl border-2 border-slate-100" style={{ backgroundColor: targetColor.hex }} />
                    <div className="font-mono text-[8px] leading-tight">
                      L:{targetColor.oklab.L}<br/>a:{targetColor.oklab.a}<br/>b:{targetColor.oklab.b}
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    {selectedColor.hex === targetColor.hex ? (
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    ) : (
                      <XCircle className="w-10 h-10 text-rose-500" />
                    )}
                    <div className="mt-2 text-2xl font-black text-slate-900">
                      {calculateAccuracy(targetColor, selectedColor)}%
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Accuracy</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">Selected</p>
                    <div className="w-20 h-20 rounded-xl border-2 border-slate-100" style={{ backgroundColor: selectedColor.hex }} />
                    <div className="font-mono text-[8px] leading-tight">
                      L:{selectedColor.oklab.L}<br/>a:{selectedColor.oklab.a}<br/>b:{selectedColor.oklab.b}
                    </div>
                  </div>
                </div>

                {selectedColor.hex !== targetColor.hex && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">The Options Provided Were:</p>
                    <div className="grid grid-cols-2 gap-0 rounded-xl overflow-hidden border border-slate-100 max-w-[160px] mx-auto">
                      {options.map((color, idx) => (
                        <div 
                          key={idx}
                          className="aspect-square relative transition-all"
                          style={{ backgroundColor: color.hex }}
                        >
                          {color.hex === targetColor.hex && (
                            <div className="absolute top-1 left-1 bg-emerald-500 rounded-full p-0.5 border border-white shadow-sm z-10">
                              <CheckCircle2 className="w-2 h-2 text-white" />
                            </div>
                          )}
                          {color.hex === selectedColor.hex && color.hex !== targetColor.hex && (
                            <div className="absolute top-1 left-1 bg-rose-500 rounded-full p-0.5 border border-white shadow-sm z-10">
                              <XCircle className="w-2 h-2 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {selectedColor.hex === targetColor.hex ? (
                    <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium">
                      <div className="text-xl font-black mb-1">+{lastPoints} Points</div>
                      <p>Perfect Match! {streak > 1 ? `You're on a ${streak} round streak!` : 'The next round will be harder.'}</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm font-medium">
                      <div className="text-xl font-black mb-1">Missed!</div>
                      <p>
                        {mode === 'INFINITY' 
                          ? 'Streak reset. Try again to improve your accuracy!'
                          : lives > 0 
                            ? `Streak reset. You have ${lives} ${lives === 1 ? 'life' : 'lives'} left!` 
                            : 'That was your last life!'}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={lives > 0 || mode === 'INFINITY' ? () => startNewRound(difficulty, recentFamilies) : () => setPhase('GAME_OVER')}
                      className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 active:scale-[0.98]"
                    >
                      {lives > 0 || mode === 'INFINITY' ? 'Continue' : 'See Result'}
                    </button>
                    {(lives > 0 || mode === 'INFINITY') && (
                      <button
                        onClick={mode === 'INFINITY' ? () => { saveToLeaderboard(score); setPhase('GAME_OVER'); } : resetGame}
                        className="p-4 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                        title={mode === 'INFINITY' ? "End Game" : "Reset Game"}
                      >
                        {mode === 'INFINITY' ? <XCircle className="w-6 h-6" /> : <RefreshCw className="w-6 h-6" />}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {phase === 'GAME_OVER' && selectedColor && (
              <motion.div
                key="gameover"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 w-full"
              >
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-rose-500" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900">Game Over</h2>
                    <p className="text-slate-500">You've run out of lives!</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 space-y-6">
                  <div className="flex justify-center gap-6 items-center border-b border-slate-200 pb-6 mb-2">
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold uppercase tracking-tighter text-slate-400">Target</p>
                      <div className="w-14 h-14 rounded-xl border-2 border-white shadow-sm" style={{ backgroundColor: targetColor.hex }} />
                      <div className="font-mono text-[6px] leading-tight text-slate-500">
                        L:{targetColor.oklab.L}<br/>a:{targetColor.oklab.a}<br/>b:{targetColor.oklab.b}
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border-2 border-rose-100 mb-1">
                        <XCircle className="w-6 h-6 text-rose-500" />
                      </div>
                      <div className="text-xl font-black text-slate-900">
                        {calculateAccuracy(targetColor, selectedColor)}%
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Accuracy</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold uppercase tracking-tighter text-slate-400">Selected</p>
                      <div className="w-14 h-14 rounded-xl border-2 border-white shadow-sm" style={{ backgroundColor: selectedColor.hex }} />
                      <div className="font-mono text-[6px] leading-tight text-slate-500">
                        L:{selectedColor.oklab.L}<br/>a:{selectedColor.oklab.a}<br/>b:{selectedColor.oklab.b}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Final Score</span>
                    <span className="text-2xl font-black text-slate-900">{score}</span>
                  </div>
                </div>

                {incorrectHistory.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left space-y-2">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Info className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Color Perception Insight</span>
                    </div>
                    <p className="text-sm text-amber-900 font-medium leading-relaxed">
                      {getColorAnalysis(incorrectHistory)?.summary}
                    </p>
                  </div>
                )}

                {incorrectHistory.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mistakes This Run</p>
                    <div className="grid grid-cols-2 gap-6">
                      {incorrectHistory.map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="grid grid-cols-2 gap-0 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                            {item.options.map((opt, optIdx) => (
                              <div 
                                key={optIdx}
                                className="aspect-square relative"
                                style={{ backgroundColor: opt.hex }}
                              >
                                {opt.hex === item.target.hex && (
                                  <div className="absolute top-0.5 left-0.5 bg-emerald-500 rounded-full p-0.5 border border-white shadow-sm z-10">
                                    <CheckCircle2 className="w-1.5 h-1.5 text-white" />
                                  </div>
                                )}
                                {opt.hex === item.selected.hex && opt.hex !== item.target.hex && (
                                  <div className="absolute top-0.5 left-0.5 bg-rose-500 rounded-full p-0.5 border border-white shadow-sm z-10">
                                    <XCircle className="w-1.5 h-1.5 text-white" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Level {item.level}</span>
                            <span className="text-[8px] font-bold text-slate-400">{calculateAccuracy(item.target, item.selected)}% Acc</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {leaderboard.length > 0 && (
                  <div className="bg-slate-50 rounded-2xl p-6 pt-4 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Your Top Scores</p>
                    <div className="space-y-2">
                      {leaderboard.map((entry, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-400">#{i + 1}</span>
                          <span className="font-bold text-slate-700">{entry.score}</span>
                          <span className="text-slate-400 text-[10px]">{entry.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={resetGame}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 active:scale-[0.98]"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Instructions */}
        <div className="bg-slate-100/50 p-4 rounded-2xl flex gap-3 items-start">
          <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            Memorize the color. In the selection phase, you'll see four similar colors. 
            Pick the exact one to increase your score and level up. As you level up, the colors become more similar!
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
