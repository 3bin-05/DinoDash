import React, { useEffect, useRef, useState } from "react";
import {
  DINO_STAND,
  DINO_RUN_1,
  DINO_RUN_2,
  DINO_DUCK_1,
  DINO_DUCK_2,
  DINO_DEAD,
  CACTUS_SMALL,
  CACTUS_LARGE,
  BIRD_UP,
  BIRD_DOWN,
  CLOUD,
  SUN,
  MOON,
  drawSpriteCached,
  clearSpriteCache,
  GIFT,
  OVERLAY_SUNGLASSES,
  OVERLAY_SCARF,
  OVERLAY_CROWN,
} from "../utils/sprites";
import { useAuth } from "../context/AuthContext";
import { db, getDateKey, getWeekKey } from "../utils/firebase";
import { doc, updateDoc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ProfileSettingsModal } from "./ProfileSettingsModal";
import { getDailyChallengeForDate } from "../utils/dailyChallenges";
import type { DailyChallengeDef } from "../utils/dailyChallenges";
// Game Constants
const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 300;
const GROUND_Y = 240;
const GRAVITY = 0.6;
const JUMP_FORCE = -10.5;
const DUCK_DROP_FORCE = 8; // Force to pull dino down fast if pressing down in mid-air
const INITIAL_SPEED = 6;
const MAX_SPEED = 14;
const SPEED_ACCEL = 0.001; // Speed increase per frame tick

type GameState = "START" | "PLAYING" | "GAMEOVER";

interface DinoState {
  y: number;
  vy: number;
  isJumping: boolean;
  isDucking: boolean;
  runFrame: number;
  animTick: number;
}

interface GhostFrame {
  y: number;
  d: boolean; // isDucking
  f: number;  // runFrame
  dead: boolean; // isDead
}

interface Obstacle {
  id: number;
  type: "CACTUS_SMALL" | "CACTUS_LARGE" | "BIRD";
  variant: number; // 1, 2, or 3 cacti
  x: number;
  y: number;
  width: number;
  height: number;
  birdFrame: number;
  birdTick: number;
}

interface CloudState {
  x: number;
  y: number;
  speed: number;
}

interface GroundParticle {
  x: number;
  y: number;
  width: number;
}

interface Star {
  x: number;
  y: number;
  type: number;
  twinkleSpeed: number;
  phase: number;
  brightness: number; // 0-1
}

interface ShootingStar {
  x: number;
  y: number;
  speedX: number;
  length: number;
  opacity: number;
}

interface Gift {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
}

interface AchievementToast {
  id: string;
  title: string;
  desc: string;
}

// Helper to interpolate between two hex colors
const COLOR_CACHE: { [hex: string]: { r: number; g: number; b: number } } = {
  "#ffffff": { r: 255, g: 255, b: 255 },
  "#202124": { r: 32, g: 33, b: 36 },
  "#000000": { r: 0, g: 0, b: 0 },
  "#3c4043": { r: 60, g: 64, b: 67 }
};

function getRGB(hex: string) {
  if (COLOR_CACHE[hex]) return COLOR_CACHE[hex];
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  const rgb = { r, g, b };
  COLOR_CACHE[hex] = rgb;
  return rgb;
}

function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = getRGB(color1);
  const c2 = getRGB(color2);

  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));

  return `rgb(${r},${g},${b})`;
}

const ALL_ACHIEVEMENTS = [
  { id: "first_jump", title: "FIRST JUMP", description: "Perform your first jump." },
  { id: "first_game", title: "FIRST GAME", description: "Complete your first game run." },
  { id: "score_500", title: "SCORE 500", description: "Reach a score of 500 points." },
  { id: "score_5000", title: "SCORE 5000", description: "Reach a score of 5,000 points." },
  { id: "score_10000", title: "SCORE 10000", description: "Reach a score of 10,000 points." },
  { id: "score_20000", title: "SCORE 20000", description: "Reach a score of 20,000 points." },
  { id: "games_100", title: "PLAY 100 GAMES", description: "Play 100 total games." },
  { id: "games_500", title: "PLAY 500 GAMES", description: "Play 500 total games." },
  { id: "daily_challenge", title: "DAILY RUN", description: "Score 1000 in a Daily Run." },
  { id: "collect_50_gifts", title: "COLLECT 50 GIFTS", description: "Collect 50 total gifts." }
];

export const DinoGame: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<"stats" | "edit" | "leaderboard" | "skins">("stats");
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>("");

  const openModalWithTab = (tab: "stats" | "edit" | "leaderboard" | "skins") => {
    setModalTab(tab);
    setShowProfileModal(true);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Error attempting to enable full-screen mode:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const hasTriggeredTransitionRef = useRef<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Game UI States (synchronized from refs to update React UI)
  const [gameState, setGameState] = useState<GameState>("START");
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem("dinodash_high_score");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isNightMode, setIsNightMode] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSfxMuted, setIsSfxMuted] = useState<boolean>(false);
  const [activeToasts, setActiveToasts] = useState<AchievementToast[]>([]);
  const [isGhostRunEnabled, setIsGhostRunEnabled] = useState<boolean>(() => {
    const userId = user?.uid || "";
    const saved = localStorage.getItem(`dinodash_ghost_run_enabled_${userId}`);
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(`dinodash_ghost_run_enabled_${user.uid}`, isGhostRunEnabled.toString());
    }
  }, [isGhostRunEnabled, user]);

  // Refs for high performance game loop (prevents React render lag)
  const gameStateRef = useRef<GameState>("START");

  // Anti-cheat obfuscated score state: score = obsVal ^ mask
  const scoreMaskRef = useRef<number>(Math.floor(Math.random() * 1000000) + 1);
  const scoreObsValRef = useRef<number>(0 ^ scoreMaskRef.current);
  const scrollDistanceRef = useRef<number>(0);

  const getScore = () => scoreObsValRef.current ^ scoreMaskRef.current;

  const setScoreValue = (val: number) => {
    const newMask = Math.floor(Math.random() * 1000000) + 1;
    scoreMaskRef.current = newMask;
    scoreObsValRef.current = val ^ newMask;
    scoreChecksumRef.current = (val ^ 0x5F3759DF) + 42;
    setScore(val);
  };

  const incrementScore = () => {
    setScoreValue(getScore() + 1);
  };

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  const resumeGame = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    lastFrameTimeRef.current = performance.now();
  };

  const highScoreRef = useRef<number>(highScore);
  const gameSpeedRef = useRef<number>(INITIAL_SPEED);
  const isNightModeRef = useRef<boolean>(false);
  const gameStartTimeRef = useRef<number>(0);
  const dailyChallengeProgressRef = useRef<number>(0);
  const dailyChallengeCompletedRef = useRef<boolean>(false);

  // Entity States
  const dinoRef = useRef<DinoState>({
    y: GROUND_Y - 42,
    vy: 0,
    isJumping: false,
    isDucking: false,
    runFrame: 0,
    animTick: 0,
  });

  const obstaclesRef = useRef<Obstacle[]>([]);
  const giftsRef = useRef<Gift[]>([]);
  const cloudsRef = useRef<CloudState[]>([]);
  const groundParticlesRef = useRef<GroundParticle[]>([]);
  const groundXRef = useRef<number>(0);

  const transitionRef = useRef({
    isTransitioning: false,
    startTime: 0,
    duration: 2000,
    fromTheme: "day" as "day" | "night",
    toTheme: "day" as "day" | "night",
  });

  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  // 5 parallax layer offsets (scroll distances)
  const layer1OffsetRef = useRef<number>(0); // very distant mountains ~0.05
  const layer2OffsetRef = useRef<number>(0); // large mountain silhouettes ~0.12
  const layer3OffsetRef = useRef<number>(0); // rolling desert dunes ~0.25
  const layer4OffsetRef = useRef<number>(0); // cactus silhouettes ~0.45
  const layer5OffsetRef = useRef<number>(0); // foreground terrain ~0.75

  const cactiSilhouettesRef = useRef<{ x: number; y: number; width: number; height: number }[]>([]);
  const atmosParticlesRef = useRef<{ x: number; y: number; size: number; speedX: number; speedY: number }[]>([]);
  const groundDecoRef = useRef<{ x: number; type: "rock" | "shrub" | "pebble" }[]>([]);

  const nextSpawnTickRef = useRef<number>(0);
  const nextGiftSpawnTickRef = useRef<number>(0);
  const sessionGiftsRef = useRef<number>(0);
  const currentTickRef = useRef<number>(0);
  const flashScoreTickRef = useRef<number>(0); // Ticks for flashing the score on 100 points
  const keyStateRef = useRef<{ [key: string]: boolean }>({});
  const animationFrameIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const accumTimeRef = useRef<number>(0);
  const TIMESTEP = 1000 / 60; // 60Hz physics step
  const scoreChecksumRef = useRef<number>(0);
  const lastObstacleTypeRef = useRef<{ type: string; variant: number; heightIndex: number }>({ type: "", variant: 0, heightIndex: 0 });
  const ghostRunRef = useRef<GhostFrame[]>([]);
  const currentRunHistoryRef = useRef<GhostFrame[]>([]);

  // Sound synthesis using Web Audio API (ensures retro sounds work without assets)
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playBeep = (freq: number, duration: number, type: OscillatorType = "square") => {
    if (isSfxMuted) return;
    try {
      initAudio();
      if (!audioCtxRef.current) return;

      // Resume if suspended (browser security policy)
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }

      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);

      gain.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtxRef.current.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);

      osc.start();
      osc.stop(audioCtxRef.current.currentTime + duration);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  };

  const playJumpSound = () => playBeep(330, 0.1, "sine");
  const playMilestoneSound = () => {
    // Chrome dino has a double beep on 100-point intervals: low beep then high beep
    playBeep(880, 0.1, "square");
    setTimeout(() => playBeep(1100, 0.15, "square"), 100);
  };
  const playCrashedSound = () => {
    // Low buzzer-like sound
    playBeep(120, 0.3, "sawtooth");
  };

  const playCollectGiftSound = () => {
    // High-pitched coin collection double-beep
    playBeep(987, 0.08, "sine");
    setTimeout(() => playBeep(1318, 0.15, "sine"), 80);
  };

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.code;
      keyStateRef.current[key] = true;

      // Prevent scrolling when pressing space or arrow keys
      if (["Space", "ArrowUp", "ArrowDown", "Escape"].includes(key)) {
        e.preventDefault();
      }

      if (gameStateRef.current === "START") {
        if (key === "Space" || key === "ArrowUp") {
          startGame();
        }
      } else if (gameStateRef.current === "PLAYING") {
        if (key === "Escape") {
          if (isPausedRef.current) {
            resumeGame();
          } else {
            isPausedRef.current = true;
            setIsPaused(true);
          }
        } else if (!isPausedRef.current) {
          if (key === "Space" || key === "ArrowUp") {
            triggerJump();
          }
          if (key === "ArrowDown") {
            triggerDuck(true);
          }
        }
      } else if (gameStateRef.current === "GAMEOVER") {
        if (key === "Space" || key === "ArrowUp") {
          startGame();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.code;
      keyStateRef.current[key] = false;

      if (gameStateRef.current === "PLAYING" && key === "ArrowDown") {
        triggerDuck(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Window Focus/Blur Handling (Anti-Cheat & UX pause)
  useEffect(() => {
    const handleBlur = () => {
      if (gameStateRef.current === "PLAYING" && !isPausedRef.current) {
        isPausedRef.current = true;
        setIsPaused(true);
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Set up background elements on mount
  useEffect(() => {
    // Detect user's system theme on first launch
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = systemDark ? "night" : "day";
    setIsNightMode(systemDark);
    isNightModeRef.current = systemDark;
    transitionRef.current.fromTheme = initialTheme;
    transitionRef.current.toTheme = initialTheme;

    // Generate initial clouds
    const initialClouds: CloudState[] = [];
    for (let i = 0; i < 4; i++) {
      initialClouds.push({
        x: VIRTUAL_WIDTH + i * 250 + Math.random() * 100,
        y: 20 + Math.random() * 90,
        speed: 0.5 + Math.random() * 0.5,
      });
    }
    cloudsRef.current = initialClouds;

    // Generate ground particles
    const initialGround: GroundParticle[] = [];
    for (let i = 0; i < 25; i++) {
      initialGround.push({
        x: Math.random() * VIRTUAL_WIDTH,
        y: GROUND_Y + 4 + Math.random() * 18,
        width: 1 + Math.random() * 4,
      });
    }
    groundParticlesRef.current = initialGround;

    // Generate stars for night sky - high density
    const initialStars: Star[] = [];
    for (let i = 0; i < 220; i++) {
      initialStars.push({
        x: Math.random() * VIRTUAL_WIDTH,
        y: 2 + Math.random() * (GROUND_Y - 60),
        type: Math.floor(Math.random() * 3) + 1,
        twinkleSpeed: 0.008 + Math.random() * 0.025,
        phase: Math.random() * Math.PI * 2,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
    starsRef.current = initialStars;

    // Generate background cactus silhouettes
    const initialSilhouettes = [];
    for (let i = 0; i < 6; i++) {
      initialSilhouettes.push({
        x: Math.random() * VIRTUAL_WIDTH + i * 160,
        y: GROUND_Y - 25 - Math.random() * 15,
        width: 15 + Math.random() * 10,
        height: 25 + Math.random() * 20,
      });
    }
    cactiSilhouettesRef.current = initialSilhouettes;

    // Generate atmospheric particles
    const initialParticles = [];
    for (let i = 0; i < 15; i++) {
      initialParticles.push({
        x: Math.random() * VIRTUAL_WIDTH,
        y: Math.random() * (GROUND_Y - 50),
        size: 1 + Math.random() * 2,
        speedX: 0.08 + Math.random() * 0.15,
        speedY: (Math.random() - 0.5) * 0.04,
      });
    }
    atmosParticlesRef.current = initialParticles;

    // Generate ground decos (rocks and shrubs)
    const initialDecos = [];
    for (let i = 0; i < 8; i++) {
      initialDecos.push({
        x: Math.random() * VIRTUAL_WIDTH + i * 120,
        type: (Math.random() > 0.5 ? "rock" : "shrub") as "rock" | "shrub" | "pebble",
      });
    }
    groundDecoRef.current = initialDecos;

    // Initial render
    draw();
  }, []);

  // Load score history from localStorage on mount
  useEffect(() => {
    const userId = user?.uid || "guest";
    const historyKey = `dinodash_score_history_${userId}`;
    const savedHistory = localStorage.getItem(historyKey);
    if (savedHistory) {
      try {
        setScoreHistory(JSON.parse(savedHistory));
      } catch (e) {
        setScoreHistory([10, 30, 20, 50, 45, 80, 70, 110]);
      }
    } else {
      setScoreHistory([10, 30, 20, 50, 45, 80, 70, 110]);
    }
  }, [user]);

  // Countdown timer for Daily Challenge
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextUtc = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
      ));
      const diffMs = nextUtc.getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft("00:00:00");
        return;
      }
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      const hStr = hours.toString().padStart(2, "0");
      const mStr = minutes.toString().padStart(2, "0");
      const sStr = seconds.toString().padStart(2, "0");
      setTimeLeft(`${hStr}:${mStr}:${sStr}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Synchronize/initialize daily challenge status for today on launch
  useEffect(() => {
    if (!user || !profile) return;
    const today = getDateKey();
    const savedStatus = profile.dailyChallengeStatus;

    if (!savedStatus || savedStatus.date !== today) {
      const initDailyStatus = async () => {
        try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            dailyChallengeStatus: {
              date: today,
              progress: 0,
              completed: false
            }
          });
          await refreshProfile();
        } catch (e) {
          console.warn("Failed to initialize daily challenge status:", e);
        }
      };
      initDailyStatus();
    }
  }, [profile, user]);

  const showAchievementToast = (id: string, title: string, desc: string) => {
    const toastId = `${id}-${Date.now()}`;
    setActiveToasts((prev) => [...prev, { id: toastId, title, desc }]);
    setTimeout(() => {
      setActiveToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4000);
  };

  const unlockAchievement = async (id: string) => {
    if (!user || !profile) return;
    const currentAchievements = profile.achievements || [];
    if (currentAchievements.includes(id)) return;

    const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
    if (!ach) return;

    // Show toast in-game
    showAchievementToast(ach.id, ach.title, ach.description);

    try {
      const userRef = doc(db, "users", user.uid);
      const updatedAchievements = [...currentAchievements, id];

      // Auto-unlock skins when certain achievements are unlocked
      const newUnlockedSkins = new Set(profile.unlockedSkins || ["default"]);
      if (id === "score_500") newUnlockedSkins.add("sunglasses");
      if (id === "first_game") newUnlockedSkins.add("scarf");
      if (id === "score_5000") newUnlockedSkins.add("golden");
      if (id === "score_10000") newUnlockedSkins.add("cyber");
      if (id === "score_20000") newUnlockedSkins.add("galaxy");
      if (id === "collect_50_gifts") newUnlockedSkins.add("pixel_king");

      await updateDoc(userRef, {
        achievements: updatedAchievements,
        unlockedSkins: Array.from(newUnlockedSkins),
      });
      await refreshProfile();
    } catch (e) {
      console.warn("Failed to unlock achievement in Firestore:", e);
    }
  };

  const completeDailyChallenge = (challenge: DailyChallengeDef) => {
    if (!profile) return;
    const newCompletedCount = (profile.dailyChallengesCompletedCount || 0) + 1;

    // Play milestone sound
    playMilestoneSound();

    // Trigger achievement toast
    const currentAchievements = profile.achievements || [];
    if (!currentAchievements.includes("daily_challenge")) {
      showAchievementToast("daily_challenge", "DAILY RUN SUCCESS", `Daily run complete! Total: ${newCompletedCount}`);
    } else {
      showAchievementToast("daily_challenge", "CHALLENGE COMPLETED", `${challenge.title} complete! Total: ${newCompletedCount}`);
    }
  };

  const loadGhostRun = () => {
    if (!user) return;
    try {
      const savedRun = localStorage.getItem(`dinodash_ghost_run_${user.uid}`);
      if (savedRun) {
        ghostRunRef.current = JSON.parse(savedRun);
      } else {
        ghostRunRef.current = [];
      }
    } catch (e) {
      console.warn("Failed to load ghost run:", e);
      ghostRunRef.current = [];
    }
  };

  const startGame = () => {
    initAudio();
    gameStateRef.current = "PLAYING";
    setGameState("PLAYING");
    hasTriggeredTransitionRef.current = false;

    // Reset active recording history
    currentRunHistoryRef.current = [];
    // Load ghost run from localStorage
    loadGhostRun();

    // Reset dino physics
    dinoRef.current = {
      y: GROUND_Y - 42,
      vy: 0,
      isJumping: false,
      isDucking: false,
      runFrame: 0,
      animTick: 0,
    };

    // Reset game state
    setScoreValue(0);
    scrollDistanceRef.current = 0;
    isPausedRef.current = false;
    setIsPaused(false);
    clearSpriteCache();
    gameSpeedRef.current = INITIAL_SPEED;
    obstaclesRef.current = [];
    giftsRef.current = [];
    sessionGiftsRef.current = 0;
    gameStartTimeRef.current = performance.now();
    nextSpawnTickRef.current = currentTickRef.current + 60;
    nextGiftSpawnTickRef.current = currentTickRef.current + 150 + Math.random() * 200;
    lastObstacleTypeRef.current = { type: "", variant: 0, heightIndex: 0 };

    const today = getDateKey();
    if (profile?.dailyChallengeStatus?.date === today) {
      dailyChallengeProgressRef.current = profile.dailyChallengeStatus.progress || 0;
      dailyChallengeCompletedRef.current = profile.dailyChallengeStatus.completed || false;
    } else {
      dailyChallengeProgressRef.current = 0;
      dailyChallengeCompletedRef.current = false;
    }

    // Detect system theme on restart
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = systemDark ? "night" : "day";
    setIsNightMode(systemDark);
    isNightModeRef.current = systemDark;
    transitionRef.current = {
      isTransitioning: false,
      startTime: 0,
      duration: 2000,
      fromTheme: initialTheme,
      toTheme: initialTheme,
    };

    flashScoreTickRef.current = 0;

    playJumpSound();

    // Start/Restart loop
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    lastFrameTimeRef.current = 0;
    accumTimeRef.current = 0;
    animationFrameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const triggerJump = () => {
    const dino = dinoRef.current;
    if (!dino.isJumping) {
      dino.vy = JUMP_FORCE;
      dino.isJumping = true;
      dino.isDucking = false;
      playJumpSound();
      if (gameStateRef.current === "PLAYING") {
        unlockAchievement("first_jump");
      }
    }
  };

  const triggerDuck = (ducking: boolean) => {
    const dino = dinoRef.current;
    if (dino.isJumping) {
      // In mid-air, down arrow pulls the dino down fast
      if (ducking && dino.vy < DUCK_DROP_FORCE) {
        dino.vy = DUCK_DROP_FORCE;
      }
    } else {
      dino.isDucking = ducking;
    }
  };

  // Canvas Tap/Touch handling for mobile support
  const handleCanvasInteraction = () => {
    if (gameStateRef.current === "START") {
      startGame();
    } else if (gameStateRef.current === "PLAYING") {
      triggerJump();
    } else if (gameStateRef.current === "GAMEOVER") {
      startGame();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleCanvasInteraction();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // If user was ducking via touch controls, we can release it (we don't have separate touch ducking buttons here, standard touch is jump/restart)
    e.preventDefault();
  };

  const gameOver = () => {
    gameStateRef.current = "GAMEOVER";
    setGameState("GAMEOVER");
    playCrashedSound();

    // Push final frame representing crash
    const finalDino = dinoRef.current;
    currentRunHistoryRef.current.push({
      y: finalDino.y,
      d: finalDino.isDucking,
      f: finalDino.runFrame,
      dead: true
    });

    // Save High Score locally and Cloud Firestore (validated against cheats)
    const currentScore = getScore();
    const expectedChecksum = (currentScore ^ 0x5F3759DF) + 42;
    const isScoreValid = scoreChecksumRef.current === expectedChecksum;

    const elapsedSec = (performance.now() - gameStartTimeRef.current) / 1000;
    const maxPossibleScore = Math.ceil(elapsedSec * 80) + 20; // Allow max 80 pts/sec (up to 400 FPS)
    const isTimeValid = currentScore <= maxPossibleScore;

    if (!isScoreValid || !isTimeValid) {
      console.warn("Anti-Cheat validation failed. Score submission ignored.");
    } else {
      if (currentScore > highScoreRef.current) {
        highScoreRef.current = currentScore;
        setHighScore(currentScore);
        localStorage.setItem("dinodash_high_score", currentScore.toString());
      }

      // Save to score history
      const userId = user?.uid || "guest";
      const historyKey = `dinodash_score_history_${userId}`;
      const currentHistoryJson = localStorage.getItem(historyKey);
      let currentHistory: number[] = [];
      try {
        currentHistory = currentHistoryJson ? JSON.parse(currentHistoryJson) : [10, 30, 20, 50, 45, 80, 70, 110];
      } catch (e) {
        currentHistory = [10, 30, 20, 50, 45, 80, 70, 110];
      }
      currentHistory.push(currentScore);
      if (currentHistory.length > 8) {
        currentHistory.shift();
      }
      localStorage.setItem(historyKey, JSON.stringify(currentHistory));
      setScoreHistory(currentHistory);

      // Save best run history as ghost run if it's the new record
      if (user) {
        const savedGhostScore = localStorage.getItem(`dinodash_ghost_score_${user.uid}`);
        const ghostScore = savedGhostScore ? parseInt(savedGhostScore, 10) : 0;
        const savedGhostRun = localStorage.getItem(`dinodash_ghost_run_${user.uid}`);
        if (currentScore > ghostScore || !savedGhostRun) {
          localStorage.setItem(`dinodash_ghost_run_${user.uid}`, JSON.stringify(currentRunHistoryRef.current));
          localStorage.setItem(`dinodash_ghost_score_${user.uid}`, currentScore.toString());
        }
      }

      // Save High Score and Stats to Cloud Firestore
      const saveCloudStats = async () => {
        if (user && profile) {
          try {
            const userRef = doc(db, "users", user.uid);
            const newBest = Math.max(profile.bestScore || 0, currentScore);
            const newTotalGames = (profile.totalGames || 0) + 1;
            const newTotalDistance = (profile.totalDistance || 0) + currentScore;
            const newGiftsCollected = (profile.giftsCollected || 0) + sessionGiftsRef.current;

            // Process Daily Challenge updates on game over
            const today = getDateKey();
            const currentChallenge = getDailyChallengeForDate(today);
            const wasAlreadyCompleted = profile.dailyChallengeStatus?.date === today && profile.dailyChallengeStatus?.completed;

            let finalCompleted = dailyChallengeCompletedRef.current;
            let finalProgress = dailyChallengeProgressRef.current;
            let completedCount = profile.dailyChallengesCompletedCount || 0;

            if (!wasAlreadyCompleted) {
              if (currentChallenge.type === "games") {
                finalProgress += 1;
                if (finalProgress >= currentChallenge.target) {
                  finalCompleted = true;
                }
              }
              // If it became completed during this run:
              if (finalCompleted) {
                completedCount += 1;
                showAchievementToast("daily_challenge", "DAILY RUN SUCCESS", `Daily run complete! Total: ${completedCount}`);
                playMilestoneSound();
              }
            }

            // Unlock achievements
            const achievements = new Set(profile.achievements || []);
            achievements.add("first_game");
            if (newBest >= 500) achievements.add("score_500");
            if (newBest >= 5000) achievements.add("score_5000");
            if (newBest >= 10000) achievements.add("score_10000");
            if (newBest >= 20000) achievements.add("score_20000");
            if (newTotalGames >= 100) achievements.add("games_100");
            if (newTotalGames >= 500) achievements.add("games_500");
            if (newGiftsCollected >= 50) achievements.add("collect_50_gifts");
            if (finalCompleted) achievements.add("daily_challenge");

            // Sync unlocked skins based on achievements and daily challenge completions count
            const unlockedSkins = new Set(profile.unlockedSkins || ["default"]);
            if (achievements.has("score_500")) unlockedSkins.add("sunglasses");
            if (achievements.has("first_game")) unlockedSkins.add("scarf");
            if (achievements.has("score_5000")) unlockedSkins.add("golden");
            if (achievements.has("score_10000")) unlockedSkins.add("cyber");
            if (achievements.has("score_20000") || completedCount >= 3) unlockedSkins.add("galaxy");
            if (achievements.has("collect_50_gifts") || completedCount >= 5) unlockedSkins.add("pixel_king");

            // Save today and weekly high scores (collection-per-period optimization)
            const dateKey = getDateKey();
            const weekKey = getWeekKey();

            const todayCollName = `leaderboard_today_${dateKey}`;
            const weeklyCollName = `leaderboard_weekly_${weekKey}`;

            const todayDocRef = doc(db, todayCollName, user.uid);
            const weeklyDocRef = doc(db, weeklyCollName, user.uid);

            // Fetch leaderboard snapshots gracefully
            let todaySnap: any = null;
            let weeklySnap: any = null;
            try {
              const [tSnap, wSnap] = await Promise.all([
                getDoc(todayDocRef),
                getDoc(weeklyDocRef)
              ]);
              todaySnap = tSnap;
              weeklySnap = wSnap;
            } catch (readErr) {
              console.warn("Failed to retrieve leaderboard snapshots, skipping leaderboard updates:", readErr);
            }

            // 1. First, update main user profile in database to satisfy anti-cheat checks on bestScore
            try {
              await updateDoc(userRef, {
                bestScore: newBest,
                totalGames: newTotalGames,
                totalDistance: newTotalDistance,
                giftsCollected: newGiftsCollected,
                achievements: Array.from(achievements),
                unlockedSkins: Array.from(unlockedSkins),
                dailyChallengeStatus: {
                  date: today,
                  progress: finalProgress,
                  completed: finalCompleted
                },
                dailyChallengesCompletedCount: completedCount
              });
              console.log("User profile update successful!");
            } catch (profileErr) {
              console.error("User profile update failed:", profileErr);
              throw profileErr; // Profile update is critical, so we rethrow to catch block
            }

            // 2. Now update the leaderboard entries sequentially (gracefully catching any failures)
            if (todaySnap && weeklySnap) {
              try {
                const leaderboardPromises: Promise<any>[] = [];

                if (!todaySnap.exists() || currentScore > (todaySnap.data().score || 0)) {
                  leaderboardPromises.push(
                    setDoc(todayDocRef, {
                      uid: user.uid,
                      username: profile.username,
                      score: currentScore,
                      timestamp: serverTimestamp()
                    })
                  );
                }

                if (!weeklySnap.exists() || currentScore > (weeklySnap.data().score || 0)) {
                  leaderboardPromises.push(
                    setDoc(weeklyDocRef, {
                      uid: user.uid,
                      username: profile.username,
                      score: currentScore,
                      timestamp: serverTimestamp()
                    })
                  );
                }

                if (leaderboardPromises.length > 0) {
                  await Promise.all(leaderboardPromises);
                  console.log("Leaderboard updates successful!");
                }
              } catch (leaderboardErr) {
                console.warn("Leaderboard updates failed, skipping gracefully:", leaderboardErr);
              }
            }

            // 3. Refresh profile state
            await refreshProfile();
          } catch (e) {
            console.warn("Cloud stats save failed:", e);
          }
        }
      };
      saveCloudStats();
    }

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    // Force immediate draw to show crashed dino state
    draw();
  };

  // Update Game Physics & Objects
  const update = () => {
    currentTickRef.current++;

    // Real-time time daily challenge checks
    const today = getDateKey();
    const currentChallenge = getDailyChallengeForDate(today);
    if (currentChallenge.type === "time" && !dailyChallengeCompletedRef.current) {
      const survivalTime = Math.floor((performance.now() - gameStartTimeRef.current) / 1000);
      dailyChallengeProgressRef.current = Math.max(dailyChallengeProgressRef.current, survivalTime);
      if (dailyChallengeProgressRef.current >= currentChallenge.target) {
        dailyChallengeCompletedRef.current = true;
        completeDailyChallenge(currentChallenge);
      }
    }

    // Update theme transition state
    const trans = transitionRef.current;
    if (trans.isTransitioning) {
      const now = performance.now();
      if (now - trans.startTime >= trans.duration) {
        trans.isTransitioning = false;
        const finalTheme = trans.toTheme;
        setIsNightMode(finalTheme === "night");
        isNightModeRef.current = finalTheme === "night";
        clearSpriteCache();
      }
    }

    // Update star twinkling phase
    const stars = starsRef.current;
    for (let i = 0; i < stars.length; i++) {
      stars[i].phase += stars[i].twinkleSpeed;
    }

    // 1. Update Dino Physics
    const dino = dinoRef.current;

    // Apply keyboard overrides if held down
    if (keyStateRef.current["ArrowDown"]) {
      triggerDuck(true);
    } else if (gameStateRef.current === "PLAYING") {
      // release duck if key is no longer held
      if (dino.isDucking) {
        dino.isDucking = false;
      }
    }

    // Run animation frames
    if (!dino.isJumping) {
      dino.animTick++;
      if (dino.animTick >= 6) {
        dino.runFrame = dino.runFrame === 0 ? 1 : 0;
        dino.animTick = 0;
      }
    }

    // Apply gravity
    dino.vy += GRAVITY;
    dino.y += dino.vy;

    // Ground level check
    // Standing height: 21 rows * scale 2 = 42
    // Ducking height: 14 rows * scale 2 = 28
    const dinoHeight = dino.isDucking ? 28 : 42;
    const baseGroundY = GROUND_Y - dinoHeight;

    if (dino.y >= baseGroundY) {
      dino.y = baseGroundY;
      dino.vy = 0;
      dino.isJumping = false;
    }

    // 2. Progressive Speed Increase
    if (gameSpeedRef.current < MAX_SPEED) {
      gameSpeedRef.current += SPEED_ACCEL;
    }
    scrollDistanceRef.current += gameSpeedRef.current;

    // 3. Update Score
    // Score increases slower than ticks to match Chrome Dino timing
    if (currentTickRef.current % 5 === 0) {
      const lastScore = getScore();
      incrementScore();
      const currentScore = getScore();

      // Real-time achievement checks
      if (currentScore >= 500) {
        unlockAchievement("score_500");
      }
      if (currentScore >= 5000) {
        unlockAchievement("score_5000");
      }
      if (currentScore >= 10000) {
        unlockAchievement("score_10000");
      }
      if (currentScore >= 20000) {
        unlockAchievement("score_20000");
      }
      const today = getDateKey();
      const currentChallenge = getDailyChallengeForDate(today);
      if (currentChallenge.type === "score" && !dailyChallengeCompletedRef.current) {
        dailyChallengeProgressRef.current = Math.max(dailyChallengeProgressRef.current, currentScore);
        if (dailyChallengeProgressRef.current >= currentChallenge.target) {
          dailyChallengeCompletedRef.current = true;
          completeDailyChallenge(currentChallenge);
        }
      }

      // Play sound and flash score every 100 points
      if (currentScore > 0 && currentScore % 100 === 0) {
        playMilestoneSound();
        flashScoreTickRef.current = currentTickRef.current + 50; // Flash for 50 frames
      }

      // Day/Night transitions: every 2000 points
      const currentPeriod = Math.floor(currentScore / 2000);
      const lastPeriod = Math.floor(lastScore / 2000);
      if (currentPeriod > lastPeriod && currentScore > 0) {
        const fromTheme = isNightModeRef.current ? "night" : "day";
        const toTheme = fromTheme === "day" ? "night" : "day";

        transitionRef.current = {
          isTransitioning: true,
          startTime: performance.now(),
          duration: 2000,
          fromTheme,
          toTheme,
        };

        hasTriggeredTransitionRef.current = true;

        // Immediately toggle active theme state to trigger CSS transitions
        setIsNightMode(toTheme === "night");
        isNightModeRef.current = toTheme === "night";
      }
    }

    // 4. Update Obstacles
    const speed = gameSpeedRef.current;
    const obstacles = obstaclesRef.current;

    // Move obstacles left
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= speed;

      // Update Bird flight animation frames
      if (obs.type === "BIRD") {
        obs.birdTick++;
        if (obs.birdTick >= 12) {
          obs.birdFrame = obs.birdFrame === 0 ? 1 : 0;
          obs.birdTick = 0;
        }
      }

      // Check Collision
      if (checkCollision(dino, obs)) {
        gameOver();
        return;
      }

      // Remove offscreen obstacles
      if (obs.x + obs.width < 0) {
        obstacles.splice(i, 1);
      }
    }

    // Spawn Obstacles
    if (currentTickRef.current >= nextSpawnTickRef.current) {
      spawnObstacle();
    }

    // 4.5 Update Gifts
    const gifts = giftsRef.current;
    for (let i = gifts.length - 1; i >= 0; i--) {
      const gift = gifts[i];
      gift.x -= speed;

      // Check collision
      if (checkGiftCollision(dino, gift)) {
        sessionGiftsRef.current++;
        playCollectGiftSound();

        // Check real-time gift milestones
        const currentGifts = (profile?.giftsCollected || 0) + sessionGiftsRef.current;
        if (currentGifts >= 50) {
          unlockAchievement("collect_50_gifts");
        }

        gifts.splice(i, 1);
        continue;
      }

      // Remove offscreen
      if (gift.x + gift.width < 0) {
        gifts.splice(i, 1);
      }
    }

    // Spawn Gifts
    if (currentTickRef.current >= nextGiftSpawnTickRef.current) {
      spawnGift();
    }

    // 5. Update Background Clouds
    const clouds = cloudsRef.current;
    for (let i = 0; i < clouds.length; i++) {
      const cloud = clouds[i];
      cloud.x -= cloud.speed;
      if (cloud.x + 32 < 0) {
        cloud.x = VIRTUAL_WIDTH + Math.random() * 100;
        cloud.y = 20 + Math.random() * 90;
        cloud.speed = 0.3 + Math.random() * 0.5;
      }
    }

    // 5.5 Update Background Cactus Silhouettes (Parallax)
    const silSpeed = speed * 0.15;
    cactiSilhouettesRef.current.forEach((sil) => {
      sil.x -= silSpeed;
      if (sil.x + sil.width < -10) {
        sil.x = VIRTUAL_WIDTH + Math.random() * 120;
        sil.y = GROUND_Y - 25 - Math.random() * 15;
        sil.width = 15 + Math.random() * 10;
        sil.height = 25 + Math.random() * 20;
      }
    });

    // 5.55 Update Shooting Stars (rare, ~1 per minute at 60fps)

    if (Math.random() < 0.00035) {
      shootingStarsRef.current.push({
        x: Math.random() * VIRTUAL_WIDTH,
        y: 5 + Math.random() * 60,
        speedX: 3 + Math.random() * 2.5,
        length: 14 + Math.random() * 12,
        opacity: 1,
      });
    }
    shootingStarsRef.current.forEach((s) => {
      s.x -= s.speedX;
      s.y += s.speedX * 0.4;
      s.opacity -= 0.018;
    });
    shootingStarsRef.current = shootingStarsRef.current.filter(s => s.opacity > 0 && s.x + s.length > 0);

    // 5.6 Update Parallax layer offsets
    const spd = gameStateRef.current === "PLAYING" ? gameSpeedRef.current : 1.5;
    layer1OffsetRef.current += spd * 0.05;
    layer2OffsetRef.current += spd * 0.12;
    layer3OffsetRef.current += spd * 0.25;
    layer4OffsetRef.current += spd * 0.45;
    layer5OffsetRef.current += spd * 0.75;

    // 5.7 Update Atmospheric Particles
    atmosParticlesRef.current.forEach((part) => {
      part.x -= part.speedX + (gameStateRef.current === "PLAYING" ? speed * 0.04 : 0);
      part.y += part.speedY;
      if (part.x < -4) {
        part.x = VIRTUAL_WIDTH + 4;
        part.y = Math.random() * (GROUND_Y - 50);
      }
      if (part.y < 0 || part.y > GROUND_Y - 50) {
        part.speedY = -part.speedY;
      }
    });

    // 5.8 Update Ground Decos
    groundDecoRef.current.forEach((deco) => {
      deco.x -= speed;
      if (deco.x + 20 < 0) {
        deco.x = VIRTUAL_WIDTH + Math.random() * 100;
        deco.type = Math.random() > 0.5 ? "rock" : "shrub";
      }
    });

    // 6. Update Ground Scrolling Textures
    groundXRef.current -= speed;
    if (groundXRef.current <= -VIRTUAL_WIDTH) {
      groundXRef.current = 0;
    }

    const groundParticles = groundParticlesRef.current;
    for (let i = 0; i < groundParticles.length; i++) {
      const part = groundParticles[i];
      part.x -= speed;
      if (part.x + part.width < 0) {
        part.x = VIRTUAL_WIDTH + Math.random() * 50;
        part.y = GROUND_Y + 4 + Math.random() * 18;
      }
    }

    // Record the ghost frame
    if (gameStateRef.current === "PLAYING") {
      currentRunHistoryRef.current.push({
        y: dino.y,
        d: dino.isDucking,
        f: dino.runFrame,
        dead: false
      });
    }
  };

  // Precise sub-box overlap checker
  const intersects = (
    rect1: { left: number; right: number; top: number; bottom: number },
    rect2: { left: number; right: number; top: number; bottom: number }
  ): boolean => {
    return (
      rect1.left < rect2.right &&
      rect1.right > rect2.left &&
      rect1.top < rect2.bottom &&
      rect1.bottom > rect2.top
    );
  };

  // Smart avoidable spawning helper
  const spawnObstacle = () => {
    const types: Array<"CACTUS_SMALL" | "CACTUS_LARGE" | "BIRD"> = ["CACTUS_SMALL"];
    const currentScore = getScore();
    if (currentScore > 150) {
      types.push("CACTUS_LARGE");
    }
    if (currentScore > 400) {
      types.push("BIRD");
    }

    const chosenType = types[Math.floor(Math.random() * types.length)];
    let width = 0;
    let height = 0;
    let y = 0;
    let variant = 1;
    let heightIndex = 0; // 0=ground, 1=low bird, 2=middle bird, 3=high bird

    if (chosenType === "CACTUS_SMALL") {
      variant = Math.floor(Math.random() * 3) + 1;
      width = variant * 22;
      height = 30;
      y = GROUND_Y - height;
      heightIndex = 0;
    } else if (chosenType === "CACTUS_LARGE") {
      const rand = Math.random();
      variant = rand > 0.85 ? 3 : rand > 0.6 ? 2 : 1;
      width = variant * 35;
      height = 45;
      y = GROUND_Y - height;
      heightIndex = 0;
    } else {
      variant = 1;
      width = 36;
      height = 20;
      const heights = [
        GROUND_Y - 20, // Low
        GROUND_Y - 45, // Middle
        GROUND_Y - 70, // High
      ];
      const hIdx = Math.floor(Math.random() * heights.length);
      y = heights[hIdx];
      heightIndex = hIdx + 1;
    }

    obstaclesRef.current.push({
      id: Date.now() + Math.random(),
      type: chosenType,
      variant,
      x: VIRTUAL_WIDTH + 50,
      y,
      width,
      height,
      birdFrame: 0,
      birdTick: 0,
    });

    // Calculate base spacing gap
    const speed = gameSpeedRef.current;
    let baseGap = Math.max(180, speed * 25);
    const randomGap = 80 + Math.random() * 150;

    // Smart avoidability gap offsets
    const last = lastObstacleTypeRef.current;
    const currentRequiresJump = chosenType === "CACTUS_SMALL" || chosenType === "CACTUS_LARGE" || (chosenType === "BIRD" && heightIndex === 1);
    const lastRequiredJump = last.type === "CACTUS_SMALL" || last.type === "CACTUS_LARGE" || (last.type === "BIRD" && last.heightIndex === 1);

    if (lastRequiredJump && currentRequiresJump) {
      // Enforce safe landing & recovery spacing mathematically:
      // Jump takes 35 frames, we add 18 frames recovery window
      const safeSpacing = speed * 53;
      if (baseGap < safeSpacing) {
        baseGap = safeSpacing;
      }
    } else if (last.type === "BIRD" && last.heightIndex === 2 && currentRequiresJump) {
      // Last was a ducking-required middle bird, give time to rise and jump
      baseGap += speed * 12;
    } else if (last.type === "BIRD" && last.heightIndex === 1) {
      baseGap += 120; // Extra landing recovery for low birds
    } else if (last.type === "CACTUS_LARGE" && last.variant >= 2) {
      baseGap += 100; // Extra safety space after large cactus clumps
    }

    nextSpawnTickRef.current = currentTickRef.current + Math.floor((baseGap + randomGap) / speed);
    lastObstacleTypeRef.current = { type: chosenType, variant, heightIndex };
  };

  // Narrow phase precise collision detection (two-box dino and sub-box obstacles)
  const checkCollision = (dino: DinoState, obs: Obstacle): boolean => {
    const dinoX = 50;

    // 1. Broad Phase AABB check
    const broadDino = {
      left: dinoX + 4,
      right: dinoX + (dino.isDucking ? 62 : 50) - 4,
      top: dino.y + 2,
      bottom: dino.y + (dino.isDucking ? 28 : 42)
    };
    const broadObs = {
      left: obs.x,
      right: obs.x + obs.width,
      top: obs.y,
      bottom: obs.y + obs.height
    };
    if (!intersects(broadDino, broadObs)) return false;

    // 2. Narrow Phase Precise check
    const dinoSubBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    if (dino.isDucking) {
      dinoSubBoxes.push({
        left: dinoX + 8,
        right: dinoX + 58,
        top: dino.y + 8,
        bottom: dino.y + 28
      });
    } else {
      dinoSubBoxes.push({
        left: dinoX + 10,
        right: dinoX + 36,
        top: dino.y + 16,
        bottom: dino.y + 42
      });
      dinoSubBoxes.push({
        left: dinoX + 24,
        right: dinoX + 48,
        top: dino.y + 2,
        bottom: dino.y + 18
      });
    }

    const obsSubBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    if (obs.type === "CACTUS_SMALL") {
      for (let i = 0; i < obs.variant; i++) {
        obsSubBoxes.push({
          left: obs.x + i * 22 + 4,
          right: obs.x + i * 22 + 18,
          top: obs.y + 2,
          bottom: obs.y + obs.height
        });
      }
    } else if (obs.type === "CACTUS_LARGE") {
      for (let i = 0; i < obs.variant; i++) {
        obsSubBoxes.push({
          left: obs.x + i * 32 + 8,
          right: obs.x + i * 32 + 24,
          top: obs.y + 4,
          bottom: obs.y + obs.height
        });
      }
    } else if (obs.type === "BIRD") {
      obsSubBoxes.push({
        left: obs.x + 4,
        right: obs.x + 32,
        top: obs.y + 4,
        bottom: obs.y + 16
      });
      obsSubBoxes.push({
        left: obs.x + 12,
        right: obs.x + 24,
        top: obs.y,
        bottom: obs.y + 20
      });
    }

    for (const db of dinoSubBoxes) {
      for (const ob of obsSubBoxes) {
        if (intersects(db, ob)) return true;
      }
    }

    return false;
  };

  const spawnGift = () => {
    const heights = [
      GROUND_Y - 16,  // Ground level
      GROUND_Y - 45,  // Mid-air (needs jump)
      GROUND_Y - 75   // High (needs high jump)
    ];
    const y = heights[Math.floor(Math.random() * heights.length)];
    giftsRef.current.push({
      id: Date.now() + Math.random(),
      x: VIRTUAL_WIDTH + 50,
      y,
      width: 16,
      height: 16,
      collected: false
    });

    // Schedule next gift. Scale interval gap with speed.
    const speed = gameSpeedRef.current;
    const baseGap = 350 + Math.random() * 350;
    nextGiftSpawnTickRef.current = currentTickRef.current + Math.floor(baseGap / speed);
  };

  const checkGiftCollision = (dino: DinoState, gift: Gift): boolean => {
    const dinoX = 50;
    const dinoWidth = dino.isDucking ? 62 : 50;
    const dinoHeight = dino.isDucking ? 28 : 42;

    const dinoBox = {
      left: dinoX + 4,
      right: dinoX + dinoWidth - 4,
      top: dino.y + 4,
      bottom: dino.y + dinoHeight - 4,
    };

    const giftBox = {
      left: gift.x,
      right: gift.x + gift.width,
      top: gift.y,
      bottom: gift.y + gift.height,
    };

    return (
      dinoBox.left < giftBox.right &&
      dinoBox.right > giftBox.left &&
      dinoBox.top < giftBox.bottom &&
      dinoBox.bottom > giftBox.top
    );
  };

  // Render Scene to HTML5 Canvas
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Define theme colors and interpolation
    let spriteColor = "#000000";
    let cloudFillColor = "#ffffff";
    let cloudOutlineColor = "#000000";
    let sunOpacity = 0;
    let moonOpacity = 0;
    let starsOpacity = 0;
    let sunY = 35;
    let moonY = 35;

    const trans = transitionRef.current;
    if (trans.isTransitioning) {
      const now = performance.now();
      const elapsed = now - trans.startTime;
      let progress = elapsed / trans.duration;
      if (progress >= 1) progress = 1;

      const fromTheme = trans.fromTheme;
      const toTheme = trans.toTheme;

      const daySprite = "#000000";
      const nightSprite = "#ffffff";
      spriteColor = interpolateColor(
        fromTheme === "day" ? daySprite : nightSprite,
        toTheme === "day" ? daySprite : nightSprite,
        progress
      );

      const dayCloudFill = "#ffffff";
      const nightCloudFill = "#3c4043";
      cloudFillColor = interpolateColor(
        fromTheme === "day" ? dayCloudFill : nightCloudFill,
        toTheme === "day" ? dayCloudFill : nightCloudFill,
        progress
      );

      const dayCloudOutline = "#000000";
      const nightCloudOutline = "#ffffff";
      cloudOutlineColor = interpolateColor(
        fromTheme === "day" ? dayCloudOutline : nightCloudOutline,
        toTheme === "day" ? dayCloudOutline : nightCloudOutline,
        progress
      );

      if (fromTheme === "day" && toTheme === "night") {
        sunOpacity = 1 - progress;
        sunY = 35 + progress * 100;
        moonOpacity = progress;
        moonY = 135 - progress * 100;
        starsOpacity = progress;
      } else {
        moonOpacity = 1 - progress;
        moonY = 35 + progress * 100;
        sunOpacity = progress;
        sunY = 135 - progress * 100;
        starsOpacity = 1 - progress;
      }
    } else {
      const isNight = isNightModeRef.current;
      spriteColor = isNight ? "#ffffff" : "#000000";
      cloudFillColor = isNight ? "#3c4043" : "#ffffff";
      cloudOutlineColor = isNight ? "#ffffff" : "#000000";
      sunOpacity = isNight ? 0 : 1;
      moonOpacity = isNight ? 1 : 0;
      starsOpacity = isNight ? 1 : 0;
      sunY = 35;
      moonY = 35;
    }

    // Clear Canvas transparently to allow css day/night page background to show through
    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    const isNight = isNightModeRef.current;

    // Helper to get interpolated silhouette color at a given layer depth
    const getSilhouetteColor = (dayR: number, dayG: number, dayB: number, nightR: number, nightG: number, nightB: number): string => {
      if (trans.isTransitioning) {
        const now2 = performance.now();
        const elapsed2 = now2 - trans.startTime;
        let p2 = elapsed2 / trans.duration;
        if (p2 >= 1) p2 = 1;
        const fromIsDay = trans.fromTheme === "day";
        const r = Math.round((fromIsDay ? dayR : nightR) + p2 * ((trans.toTheme === "day" ? dayR : nightR) - (fromIsDay ? dayR : nightR)));
        const g = Math.round((fromIsDay ? dayG : nightG) + p2 * ((trans.toTheme === "day" ? dayG : nightG) - (fromIsDay ? dayG : nightG)));
        const b = Math.round((fromIsDay ? dayB : nightB) + p2 * ((trans.toTheme === "day" ? dayB : nightB) - (fromIsDay ? dayB : nightB)));
        return `rgb(${r},${g},${b})`;
      }
      return isNight ? `rgb(${nightR},${nightG},${nightB})` : `rgb(${dayR},${dayG},${dayB})`;
    };

    // ── 2. STARS ─────────────────────────────────────────────────────────────
    if (starsOpacity > 0) {
      const origAlpha = ctx.globalAlpha;
      starsRef.current.forEach((star) => {
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(star.phase));
        const sz = star.brightness < 0.5 ? 1 : 2;
        ctx.globalAlpha = starsOpacity * twinkle * star.brightness;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.floor(star.x), Math.floor(star.y), sz, sz);
      });

      // Pixel constellations (Orion-style, 3-star L-shapes)
      const constPairs: [number, number, number, number][] = [
        [60, 20, 95, 35], [95, 35, 80, 55],
        [200, 15, 230, 30], [230, 30, 215, 50],
        [480, 12, 510, 28], [510, 28, 495, 48],
        [650, 22, 685, 38], [685, 38, 670, 58],
      ];
      ctx.globalAlpha = starsOpacity * 0.18;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      constPairs.forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      // Shooting stars
      shootingStarsRef.current.forEach((s) => {
        ctx.globalAlpha = s.opacity * starsOpacity;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.length, s.y - s.length * 0.35);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, "rgba(255,255,200,1)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.length, s.y - s.length * 0.35);
        ctx.stroke();
      });

      ctx.globalAlpha = origAlpha;
    }

    // ── 3. SUN ────────────────────────────────────────────────────────────────
    if (sunOpacity > 0) {
      const originalAlpha = ctx.globalAlpha;
      ctx.globalAlpha = sunOpacity;
      drawSpriteCached(ctx, SUN, 620, sunY, 2.5, "#ffffff", spriteColor, null, 0, `sun_#ffffff_${spriteColor}`);
      ctx.globalAlpha = originalAlpha;
    }

    // ── 4. MOON + GLOW ───────────────────────────────────────────────────────
    if (moonOpacity > 0) {
      const origAlpha = ctx.globalAlpha;
      // Glow halo
      const moonGlow = ctx.createRadialGradient(627, moonY + 12, 4, 627, moonY + 12, 28);
      moonGlow.addColorStop(0, `rgba(240,232,140,${0.18 * moonOpacity})`);
      moonGlow.addColorStop(1, `rgba(240,232,140,0)`);
      ctx.fillStyle = moonGlow;
      ctx.fillRect(600, moonY - 18, 55, 60);
      // Moon sprite
      ctx.globalAlpha = moonOpacity;
      drawSpriteCached(ctx, MOON, 620, moonY, 2.5, spriteColor, null, null, 0, `moon_${spriteColor}`);
      ctx.globalAlpha = origAlpha;
    }

    // ── 5. CLOUDS ────────────────────────────────────────────────────────────
    const clouds = cloudsRef.current;
    clouds.forEach((cloud) => {
      drawSpriteCached(ctx, CLOUD, cloud.x, cloud.y, 2, cloudFillColor, cloudOutlineColor, null, 0, `cloud_${cloudFillColor}_${cloudOutlineColor}`);
    });

    // ── LAYER 1: Very distant mountains (lightest, slowest) ───────────────────
    {
      const l1Off = -(layer1OffsetRef.current % 380);
      const c = getSilhouetteColor(185, 205, 228, 28, 32, 48); // almost horizon color
      ctx.fillStyle = c;
      ctx.beginPath();
      const w1 = 380;
      for (let x = l1Off - w1; x < VIRTUAL_WIDTH + w1 * 2; x += w1) {
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x + 30, GROUND_Y - 22);
        ctx.lineTo(x + 70, GROUND_Y - 38);
        ctx.lineTo(x + 120, GROUND_Y - 55);
        ctx.lineTo(x + 170, GROUND_Y - 40);
        ctx.lineTo(x + 220, GROUND_Y - 62);
        ctx.lineTo(x + 270, GROUND_Y - 42);
        ctx.lineTo(x + 320, GROUND_Y - 28);
        ctx.lineTo(x + w1, GROUND_Y);
        ctx.closePath();
      }
      ctx.fill();
    }

    // ── LAYER 2: Large mountain silhouettes ───────────────────────────────────
    {
      const l2Off = -(layer2OffsetRef.current % 280);
      const c = getSilhouetteColor(155, 178, 208, 20, 24, 38);
      ctx.fillStyle = c;
      ctx.beginPath();
      const w2 = 280;
      for (let x = l2Off - w2; x < VIRTUAL_WIDTH + w2 * 2; x += w2) {
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x + 20, GROUND_Y - 30);
        ctx.lineTo(x + 55, GROUND_Y - 52);
        ctx.lineTo(x + 85, GROUND_Y - 75);
        ctx.lineTo(x + 120, GROUND_Y - 55);
        ctx.lineTo(x + 165, GROUND_Y - 82);
        ctx.lineTo(x + 200, GROUND_Y - 60);
        ctx.lineTo(x + 240, GROUND_Y - 38);
        ctx.lineTo(x + w2, GROUND_Y);
        ctx.closePath();
      }
      ctx.fill();
    }

    // ── LAYER 3: Rolling desert dunes ────────────────────────────────────────
    {
      const l3Off = -(layer3OffsetRef.current % 320);
      const c = getSilhouetteColor(120, 148, 180, 16, 19, 30);
      ctx.fillStyle = c;
      ctx.beginPath();
      const w3 = 320;
      for (let x = l3Off - w3; x < VIRTUAL_WIDTH + w3 * 2; x += w3) {
        ctx.moveTo(x, GROUND_Y);
        ctx.quadraticCurveTo(x + 60, GROUND_Y - 20, x + 120, GROUND_Y - 10);
        ctx.quadraticCurveTo(x + 200, GROUND_Y - 32, x + 260, GROUND_Y - 18);
        ctx.quadraticCurveTo(x + 300, GROUND_Y - 8, x + w3, GROUND_Y);
        ctx.closePath();
      }
      ctx.fill();
    }

    // ── LAYER 4: Cactus silhouettes ───────────────────────────────────────────
    {
      const silhouetteColor = getSilhouetteColor(88, 115, 150, 14, 17, 28);
      cactiSilhouettesRef.current.forEach((sil) => {
        ctx.fillStyle = silhouetteColor;
        // Main trunk
        ctx.fillRect(Math.floor(sil.x + sil.width * 0.4), Math.floor(sil.y), Math.floor(sil.width * 0.2), Math.floor(sil.height));
        // Left arm
        ctx.fillRect(Math.floor(sil.x + sil.width * 0.2), Math.floor(sil.y + sil.height * 0.35), Math.floor(sil.width * 0.2), Math.floor(sil.height * 0.12));
        ctx.fillRect(Math.floor(sil.x + sil.width * 0.2), Math.floor(sil.y + sil.height * 0.18), Math.floor(sil.width * 0.1), Math.floor(sil.height * 0.18));
        // Right arm
        ctx.fillRect(Math.floor(sil.x + sil.width * 0.6), Math.floor(sil.y + sil.height * 0.48), Math.floor(sil.width * 0.2), Math.floor(sil.height * 0.12));
        ctx.fillRect(Math.floor(sil.x + sil.width * 0.7), Math.floor(sil.y + sil.height * 0.26), Math.floor(sil.width * 0.1), Math.floor(sil.height * 0.24));
      });
    }

    // ── LAYER 5: Foreground terrain detail ───────────────────────────────────
    {
      const l5Off = -(layer5OffsetRef.current % 200);
      const c = getSilhouetteColor(60, 80, 105, 10, 12, 20);
      ctx.fillStyle = c;
      // Low bumpy foreground ridge
      const w5 = 200;
      ctx.beginPath();
      for (let x = l5Off - w5; x < VIRTUAL_WIDTH + w5 * 2; x += w5) {
        ctx.moveTo(x, GROUND_Y + 2);
        ctx.lineTo(x + 15, GROUND_Y - 4);
        ctx.lineTo(x + 35, GROUND_Y - 2);
        ctx.lineTo(x + 60, GROUND_Y - 6);
        ctx.lineTo(x + 80, GROUND_Y - 3);
        ctx.lineTo(x + 100, GROUND_Y - 7);
        ctx.lineTo(x + 130, GROUND_Y - 3);
        ctx.lineTo(x + 160, GROUND_Y - 5);
        ctx.lineTo(x + w5, GROUND_Y + 2);
        ctx.lineTo(x + w5, GROUND_Y + 20);
        ctx.lineTo(x, GROUND_Y + 20);
        ctx.closePath();
      }
      ctx.fill();
    }

    // ── HORIZON HAZE ─────────────────────────────────────────────────────────
    {
      const fogGradient = ctx.createLinearGradient(0, GROUND_Y - 55, 0, GROUND_Y + 5);
      if (isNight) {
        fogGradient.addColorStop(0, "rgba(10, 12, 18, 0)");
        fogGradient.addColorStop(0.6, "rgba(14, 17, 26, 0.25)");
        fogGradient.addColorStop(1, "rgba(18, 22, 35, 0.7)");
      } else {
        fogGradient.addColorStop(0, "rgba(195, 215, 240, 0)");
        fogGradient.addColorStop(0.5, "rgba(215, 228, 248, 0.3)");
        fogGradient.addColorStop(1, "rgba(230, 240, 255, 0.75)");
      }
      ctx.fillStyle = fogGradient;
      ctx.fillRect(0, GROUND_Y - 55, VIRTUAL_WIDTH, 65);
    }

    // ── ATMOSPHERIC PARTICLES ────────────────────────────────────────────────
    ctx.fillStyle = isNight ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.07)";
    atmosParticlesRef.current.forEach((part) => {
      ctx.fillRect(Math.floor(part.x), Math.floor(part.y), Math.floor(part.size), Math.floor(part.size));
    });

    // ── GROUND LINE ──────────────────────────────────────────────────────────
    ctx.strokeStyle = spriteColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(VIRTUAL_WIDTH, GROUND_Y);
    ctx.stroke();

    // 6.5 Draw Ground Decorations (rocks and shrubs)
    groundDecoRef.current.forEach((deco) => {
      ctx.fillStyle = spriteColor;
      if (deco.type === "rock") {
        ctx.beginPath();
        ctx.moveTo(deco.x, GROUND_Y);
        ctx.lineTo(deco.x + 4, GROUND_Y - 3);
        ctx.lineTo(deco.x + 9, GROUND_Y - 4);
        ctx.lineTo(deco.x + 14, GROUND_Y - 1);
        ctx.lineTo(deco.x + 16, GROUND_Y);
        ctx.closePath();
        ctx.fill();
      } else { // shrub
        ctx.fillRect(deco.x, GROUND_Y - 4, 3, 4);
        ctx.fillRect(deco.x + 2, GROUND_Y - 6, 2, 6);
        ctx.fillRect(deco.x + 4, GROUND_Y - 5, 2, 5);
        ctx.fillRect(deco.x + 6, GROUND_Y - 3, 2, 3);
      }
    });

    // Draw scrolling ground details (little bumps/lines)
    ctx.fillStyle = spriteColor;
    const groundParticles = groundParticlesRef.current;
    groundParticles.forEach((part) => {
      ctx.fillRect(part.x, part.y, part.width, 1);
    });

    // Draw decorative ground textures
    const groundScroll = groundXRef.current;
    ctx.fillRect(groundScroll + 100, GROUND_Y + 5, 10, 1);
    ctx.fillRect(groundScroll + 105, GROUND_Y + 7, 2, 1);
    ctx.fillRect(groundScroll + 300, GROUND_Y + 12, 15, 1);
    ctx.fillRect(groundScroll + 450, GROUND_Y + 4, 8, 1);
    ctx.fillRect(groundScroll + 650, GROUND_Y + 9, 12, 1);
    ctx.fillRect(groundScroll + 750, GROUND_Y + 6, 4, 1);

    ctx.fillRect(groundScroll + VIRTUAL_WIDTH + 100, GROUND_Y + 5, 10, 1);
    ctx.fillRect(groundScroll + VIRTUAL_WIDTH + 105, GROUND_Y + 7, 2, 1);
    ctx.fillRect(groundScroll + VIRTUAL_WIDTH + 300, GROUND_Y + 12, 15, 1);
    ctx.fillRect(groundScroll + VIRTUAL_WIDTH + 450, GROUND_Y + 4, 8, 1);
    ctx.fillRect(groundScroll + VIRTUAL_WIDTH + 650, GROUND_Y + 9, 12, 1);
    ctx.fillRect(groundScroll + VIRTUAL_WIDTH + 750, GROUND_Y + 6, 4, 1);

    // 7. Draw Obstacles
    const obstacles = obstaclesRef.current;
    obstacles.forEach((obs) => {
      if (obs.type === "CACTUS_SMALL") {
        for (let i = 0; i < obs.variant; i++) {
          drawSpriteCached(ctx, CACTUS_SMALL, obs.x + i * 22, obs.y, 2, spriteColor, null, null, 0, `cactus_small_${spriteColor}`);
        }
      } else if (obs.type === "CACTUS_LARGE") {
        for (let i = 0; i < obs.variant; i++) {
          drawSpriteCached(ctx, CACTUS_LARGE, obs.x + i * 32, obs.y, 2.5, spriteColor, null, null, 0, `cactus_large_${spriteColor}`);
        }
      } else if (obs.type === "BIRD") {
        const birdSprite = obs.birdFrame === 0 ? BIRD_UP : BIRD_DOWN;
        drawSpriteCached(ctx, birdSprite, obs.x, obs.y, 2, spriteColor, null, null, 0, `bird_${obs.birdFrame}_${spriteColor}`);
      }
    });

    // 7.5. Draw Gifts
    const gifts = giftsRef.current;
    gifts.forEach((gift) => {
      if (!gift.collected) {
        // Draw cute pixel gift box with outline
        drawSpriteCached(ctx, GIFT, gift.x, gift.y, 2, "#ff2d55", spriteColor, null, 0, `gift_#ff2d55_${spriteColor}`);
      }
    });

    // 8. Draw Dinosaur
    const dino = dinoRef.current;
    let activeDinoSprite = DINO_STAND;
    let dinoStateName = "stand";

    if (gameStateRef.current === "GAMEOVER") {
      activeDinoSprite = DINO_DEAD;
      dinoStateName = "dead";
    } else if (dino.isJumping) {
      activeDinoSprite = DINO_STAND;
      dinoStateName = "stand";
    } else if (dino.isDucking) {
      activeDinoSprite = dino.runFrame === 0 ? DINO_DUCK_1 : DINO_DUCK_2;
      dinoStateName = `duck_${dino.runFrame}`;
    } else {
      activeDinoSprite = dino.runFrame === 0 ? DINO_RUN_1 : DINO_RUN_2;
      dinoStateName = `run_${dino.runFrame}`;
    }

    const dinoScale = 2; // Fixed pixel multiplier
    const dinoX = 50;

    // Draw Ghost Dinosaur
    if (isGhostRunEnabled && (gameStateRef.current === "PLAYING" || gameStateRef.current === "GAMEOVER")) {
      const frameIndex = Math.max(0, currentRunHistoryRef.current.length - 1);
      if (ghostRunRef.current && frameIndex < ghostRunRef.current.length) {
        const ghostFrame = ghostRunRef.current[frameIndex];
        let activeGhostSprite = DINO_STAND;
        let ghostStateName = "stand";
        if (ghostFrame.dead) {
          activeGhostSprite = DINO_DEAD;
          ghostStateName = "dead";
        } else if (ghostFrame.d) {
          activeGhostSprite = ghostFrame.f === 0 ? DINO_DUCK_1 : DINO_DUCK_2;
          ghostStateName = `duck_${ghostFrame.f}`;
        } else if (ghostFrame.y < GROUND_Y - 42) {
          activeGhostSprite = DINO_STAND;
          ghostStateName = "stand";
        } else {
          activeGhostSprite = ghostFrame.f === 0 ? DINO_RUN_1 : DINO_RUN_2;
          ghostStateName = `run_${ghostFrame.f}`;
        }

        const originalAlpha = ctx.globalAlpha;
        ctx.globalAlpha = 0.35;
        const ghostColor = isNightModeRef.current ? "#90caf9" : "#4a90e2";
        drawSpriteCached(ctx, activeGhostSprite, dinoX, ghostFrame.y, dinoScale, ghostColor, null, null, 0, `ghost_${ghostStateName}_${ghostColor}`);
        ctx.globalAlpha = originalAlpha;
      }
    }

    const selectedSkin = profile?.selectedSkin || "default";
    let fillColor = spriteColor;
    let outlineColor: string | null = null;
    let shadowColor: string | null = null;
    let shadowBlur = 0;

    if (selectedSkin === "golden") {
      fillColor = "golden";
      outlineColor = isNight ? "#ffffff" : "#000000";
    } else if (selectedSkin === "cyber") {
      fillColor = "#39ff14";
      outlineColor = isNight ? "#ffffff" : "#000000";
      shadowColor = "#39ff14";
      shadowBlur = 10;
    } else if (selectedSkin === "galaxy") {
      fillColor = "galaxy";
      outlineColor = isNight ? "#ffffff" : "#000000";
    } else if (selectedSkin === "pixel_king") {
      fillColor = "pixel_king";
      outlineColor = isNight ? "#ffffff" : "#000000";
    }

    const dinoCacheKey = `dino_${dinoStateName}_${selectedSkin}_${fillColor}_${outlineColor}_${isNight ? "night" : "day"}`;
    drawSpriteCached(ctx, activeDinoSprite, dinoX, dino.y, dinoScale, fillColor, outlineColor, shadowColor, shadowBlur, dinoCacheKey);

    // Draw overlay accessories based on skin
    if (selectedSkin === "sunglasses") {
      drawSpriteCached(ctx, OVERLAY_SUNGLASSES, dinoX + 17 * dinoScale, dino.y + 2 * dinoScale, dinoScale, "#222222", null, null, 0, "overlay_sunglasses_#222222");
    } else if (selectedSkin === "scarf") {
      drawSpriteCached(ctx, OVERLAY_SCARF, dinoX + 16 * dinoScale, dino.y + 6 * dinoScale, dinoScale, "#ff3b30", null, null, 0, "overlay_scarf_#ff3b30");
    } else if (selectedSkin === "pixel_king") {
      drawSpriteCached(ctx, OVERLAY_CROWN, dinoX + 17 * dinoScale, dino.y - 2 * dinoScale, dinoScale, "#ffd700", null, null, 0, "overlay_crown_#ffd700");
    }
  };

  // Main Animation Request Frame loop
  // Fixed Timestep gameLoop for uniform speed across monitors
  const gameLoop = (timestamp: number) => {
    if (gameStateRef.current !== "PLAYING") return;

    if (isPausedRef.current) {
      lastFrameTimeRef.current = timestamp;
      animationFrameIdRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (!lastFrameTimeRef.current) {
      lastFrameTimeRef.current = timestamp;
    }
    let elapsed = timestamp - lastFrameTimeRef.current;
    lastFrameTimeRef.current = timestamp;

    if (elapsed > 100) elapsed = 100;

    accumTimeRef.current += elapsed;

    let updated = false;
    while (accumTimeRef.current >= TIMESTEP) {
      update();
      accumTimeRef.current -= TIMESTEP;
      updated = true;
    }

    if (updated) {
      draw();
    }

    animationFrameIdRef.current = requestAnimationFrame(gameLoop);
  };

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  // Format score to leading zeroes, e.g. 00123
  const formatScore = (num: number): string => {
    return num.toString().padStart(5, "0");
  };

  // Throttled logic to flash score display
  const shouldRenderScore = (): boolean => {
    if (flashScoreTickRef.current > currentTickRef.current) {
      // Toggle visibility every 5 ticks
      return Math.floor(currentTickRef.current / 5) % 2 === 0;
    }
    return true;
  };

  return (
    <div
      ref={containerRef}
      className={`game-wrapper ${isNightMode ? "night" : "day"}`}
    >
      {/* Top Navigation Bar */}
      <header className="top-navbar">
        <div className="top-navbar-left">
          <a href="#" className="top-navbar-logo" onClick={(e) => { e.preventDefault(); if (gameState === "START" || gameState === "GAMEOVER") startGame(); }}>
            {/* Pixel-art T-Rex dino logo */}
            <svg viewBox="0 0 16 16" width="28" height="28" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
              {/* Head */}
              <rect x="6" y="0" width="4" height="1" fill="currentColor"/>
              <rect x="5" y="1" width="5" height="1" fill="currentColor"/>
              <rect x="5" y="2" width="4" height="1" fill="currentColor"/>
              <rect x="9" y="2" width="1" height="1" fill="#f0fdf4"/>
              <rect x="5" y="3" width="4" height="1" fill="currentColor"/>
              <rect x="9" y="3" width="1" height="1" fill="#052e16"/>
              {/* Snout */}
              <rect x="8" y="4" width="2" height="1" fill="currentColor"/>
              <rect x="8" y="5" width="3" height="1" fill="currentColor"/>
              {/* Neck / upper body */}
              <rect x="5" y="4" width="3" height="1" fill="currentColor"/>
              <rect x="4" y="5" width="4" height="1" fill="currentColor"/>
              {/* Body */}
              <rect x="3" y="6" width="6" height="1" fill="currentColor"/>
              <rect x="2" y="7" width="7" height="1" fill="currentColor"/>
              <rect x="2" y="8" width="7" height="1" fill="currentColor"/>
              <rect x="3" y="9" width="5" height="1" fill="currentColor"/>
              {/* Arm */}
              <rect x="7" y="7" width="2" height="1" fill="#166534"/>
              {/* Tail */}
              <rect x="1" y="8" width="2" height="1" fill="currentColor"/>
              <rect x="0" y="9" width="2" height="1" fill="currentColor"/>
              {/* Hip */}
              <rect x="3" y="10" width="5" height="1" fill="currentColor"/>
              <rect x="3" y="11" width="4" height="1" fill="currentColor"/>
              {/* Left leg */}
              <rect x="3" y="12" width="2" height="2" fill="currentColor"/>
              <rect x="2" y="14" width="3" height="1" fill="currentColor"/>
              <rect x="2" y="15" width="2" height="1" fill="#166534"/>
              {/* Right leg */}
              <rect x="5" y="12" width="2" height="2" fill="currentColor"/>
              <rect x="5" y="14" width="3" height="1" fill="currentColor"/>
              <rect x="6" y="15" width="2" height="1" fill="#166534"/>
            </svg>
            DINODASH
          </a>
          <nav className="top-navbar-tabs">
            <button className={`nav-tab-btn ${gameState === "PLAYING" ? "active" : ""}`} onClick={() => { if (gameState !== "PLAYING") startGame(); }}>
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              PLAY
            </button>
            <button className="nav-tab-btn" onClick={() => openModalWithTab("leaderboard")}>
              <svg viewBox="0 0 24 24"><path d="M16 11V3H8v6H2v12h20V11h-6zM10 5h4v14h-4V5zM4 15h4v4H4v-4zm16 4h-4v-8h4v8z" /></svg>
              LEADERBOARD
            </button>
            <button className="nav-tab-btn" onClick={() => openModalWithTab("stats")}>
              <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
              PROFILE
            </button>
            <button className="nav-tab-btn" onClick={() => openModalWithTab("stats")}>
              <svg viewBox="0 0 24 24"><path d="M18 2H6v2H2v4c0 2.21 1.79 4 4 4h2c.8 1.74 2.5 3.03 4.5 3.32V18H10v2h4v-2h-2v-2.68c2-.29 3.7-1.58 4.5-3.32h2c2.21 0 4-1.79 4-4V4h-4V2zM6 10c-1.1 0-2-.9-2-2V6h2v4zm14-2c0 1.1-.9 2-2 2V6h2v2z" /></svg>
              ACHIEVEMENTS
            </button>
            <button className="nav-tab-btn" onClick={() => openModalWithTab("skins")}>
              <svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.9 2 1.99 2 2-.9 2-2-.9-2-2-2z" /></svg>
              SHOP
            </button>
          </nav>
        </div>
        <div className="top-navbar-right">
          <div className="user-avatar-block" onClick={() => openModalWithTab("edit")}>
            <div className="user-avatar-circle">
              <svg viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
              </svg>
            </div>
            <span className="user-username-label">@{profile?.username}</span>
            <span className="user-avatar-dropdown-arrow">▼</span>
          </div>
          <button className="top-nav-settings-btn" onClick={() => openModalWithTab("edit")} title="Settings">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Immersive Full-Width Game World */}
      <div className="hero-game-world">
        {/* Floating UI overlays mapped inside a capped 1400px content width */}
        <div className="hero-ui-overlay">

          {/* Left Panel: HUD Statistics */}
          <aside className="hud-stats-panel retro-panel">
            <div className="stat-row-premium">
              <div className="stat-row-label">
                <svg viewBox="0 0 24 24" fill="#ffd700">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                BEST SCORE
              </div>
              <div className="stat-row-value" style={{ color: "#ffd700" }}>{formatScore(profile?.bestScore || 0)}</div>
            </div>

            <div className="stat-row-premium">
              <div className="stat-row-label">
                <svg viewBox="0 0 24 24" fill="#ffffff">
                  <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm7 3c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-4-4c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                </svg>
                GAMES PLAYED
              </div>
              <div className="stat-row-value">{profile?.totalGames || 0}</div>
            </div>

            <div className="stat-row-premium">
              <div className="stat-row-label">
                <svg viewBox="0 0 24 24" fill="#ffffff">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h4v3h2V5h2v3h2V5h4v14z" />
                </svg>
                TOTAL DISTANCE
              </div>
              <div className="stat-row-value">
                {((profile?.totalDistance || 0) / 1000).toFixed(2)} KM
              </div>
            </div>
          </aside>

          {/* Center Brand Title Section Overlay */}
          <div className={`title-screen-hero ${gameState === "PLAYING" || gameState === "GAMEOVER" ? "playing" : ""}`}>
            <h1 className="mega-title">DINODASH</h1>
            <div className="scores-hud">
              {highScore > 0 && (
                <span className="high-score-label">
                  HI {formatScore(highScore)}
                </span>
              )}
              <span className={`current-score ${shouldRenderScore() ? "" : "invisible"}`}>
                {formatScore(score)}
              </span>
            </div>

            <button className="massive-start-btn" onClick={startGame}>
              {/* Play symbol */}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ display: 'inline-block' }}>
                <path d="M8 5v14l11-7z" />
              </svg>
              START GAME
            </button>

            <button type="button" className={`ghost-run-btn-center ${isGhostRunEnabled ? 'enabled' : ''}`} onClick={() => setIsGhostRunEnabled(!isGhostRunEnabled)}>
              GHOST RUN: {isGhostRunEnabled ? 'ON' : 'OFF'}
            </button>

            <div className="controls-guide" style={{ marginTop: '20px' }}>
              <div><kbd>SPACE</kbd> JUMP</div>
              <div><kbd>▼</kbd> DUCK</div>
            </div>
          </div>

          {/* Floating score overlay during active gameplay */}
          {gameState === "PLAYING" && (
            <div className="gameplay-score-hud">
              {highScore > 0 && (
                <span className="gameplay-hi-score">HI {formatScore(highScore)}</span>
              )}
              <span className={`gameplay-current-score ${shouldRenderScore() ? "" : "invisible"}`}>
                {formatScore(score)}
              </span>
            </div>
          )}

          {/* Right Panel: Daily Challenge floating Quest Tracker */}
          <aside className="quest-tracker-panel retro-panel">
            {(() => {
              const today = getDateKey();
              const challenge = getDailyChallengeForDate(today);
              const status = profile?.dailyChallengeStatus;
              
              // Use real-time progress if the game is active/game-over, otherwise profile progress
              const isCompleted = (status?.date === today && status?.completed) || dailyChallengeCompletedRef.current;
              
              let progress = (status?.date === today ? status?.progress : 0) || 0;
              if (gameState === "PLAYING" || gameState === "GAMEOVER") {
                progress = Math.max(progress, dailyChallengeProgressRef.current);
              }

              let progressStr = `${progress} / ${challenge.target}`;
              if (challenge.type === "time") {
                progressStr = `${progress}s / ${challenge.target}s`;
              } else if (challenge.type === "games") {
                progressStr = `${progress} / ${challenge.target} runs`;
              }
              const percent = Math.min(100, Math.floor((progress / challenge.target) * 100));

              return (
                <>
                  <h2 className="sidebar-title">
                    <svg viewBox="0 0 24 24" width="12" height="12">
                      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
                    </svg>
                    DAILY CHALLENGE
                  </h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="user-username-label" style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>{challenge.title}</span>
                      {isCompleted && (
                        <span className="card-title-badge" style={{ backgroundColor: '#34c759', color: '#fff', fontSize: '0.5rem' }}>
                          SOLVED
                        </span>
                      )}
                    </div>
                    <p className="daily-challenge-desc">{challenge.description}</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="daily-challenge-progress-bar-bg">
                      <div className="daily-challenge-progress-bar" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="daily-challenge-progress-text">
                      {progressStr} ({percent}%)
                    </div>
                  </div>

                  <div className="daily-timer-box">
                    <svg viewBox="0 0 24 24" width="12" height="12">
                      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                    </svg>
                    <span>ENDS IN: {timeLeft}</span>
                  </div>
                </>
              );
            })()}
          </aside>
        </div>

        {/* Full-width Canvas gameplay viewport container */}
        <div className="hero-canvas-container">
          <canvas
            ref={canvasRef}
            width={VIRTUAL_WIDTH}
            height={VIRTUAL_HEIGHT}
            onClick={handleCanvasInteraction}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="game-canvas-immersive"
          />

          {/* Mobile touch triggers overlay */}
          {gameState === "PLAYING" && (
            <div className="mobile-controls-overlay" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
              <button
                className="mobile-ctrl-btn"
                onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); triggerDuck(true); }}
                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); triggerDuck(false); }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); triggerDuck(true); }}
                onMouseUp={(e) => { e.preventDefault(); e.stopPropagation(); triggerDuck(false); }}
              >
                DUCK
              </button>
              <button
                className="mobile-ctrl-btn"
                onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); triggerJump(); }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); triggerJump(); }}
              >
                JUMP
              </button>
            </div>
          )}

          {/* Pause State overlay */}
          {isPaused && (
            <div className="overlay-screen gameover-screen" onClick={resumeGame} style={{ cursor: "pointer", pointerEvents: "auto" }}>
              <div className="game-over-title" style={{ color: "#ff9500" }}>PAUSED</div>
              <div className="primary-text animate-pulse">PRESS ESC OR CLICK TO RESUME</div>
            </div>
          )}

          {/* GameOver state overlay */}
          {gameState === "GAMEOVER" && (
            <div className="overlay-screen gameover-screen">
              <div className="game-over-title">GAME OVER</div>
              <div className="game-over-stats">
                <div className="stat-row">
                  <span>Score:</span>
                  <span className="stat-val">{score}</span>
                </div>
                <div className="stat-row">
                  <span>Best Run:</span>
                  <span className="stat-val" style={{ color: "#ffd700" }}>{highScore}</span>
                </div>
              </div>
              <button className="restart-btn" onClick={startGame}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="restart-icon">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-2.73" />
                </svg>
                PLAY AGAIN
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid wrapper for cards wrapped inside max-width container */}
      <div className="game-container">
        <section className="dashboard-layout">

          {/* Achievements badge dashboard */}
          <div className="dashboard-card retro-panel">
            <h3 className="dashboard-card-title">
              ACHIEVEMENTS
              <span className="card-title-badge">
                {profile?.achievements?.length || 0} / {ALL_ACHIEVEMENTS.length} UNLOCKED
              </span>
            </h3>

            <div className="mini-achievements-grid">
              {/* Custom SVG Badges (First Jump, Score 500, Daily Run, Locked) */}
              <div className={`mini-achievement-badge ${profile?.achievements?.includes("first_jump") ? "unlocked" : ""}`} title="Perform your first jump.">
                <svg viewBox="0 0 24 24">
                  <path d="M18 3h-6v2h-2v2H8v2H6v2H4v8h2v2h2v-2h2v2h2v-2h2v-2h2V9h2V7h2V3h-2z" />
                </svg>
                <span className="mini-achievement-name">FIRST JUMP</span>
              </div>

              <div className={`mini-achievement-badge ${profile?.achievements?.includes("score_500") ? "unlocked" : ""}`} title="Reach a score of 500 points in a single run.">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" />
                </svg>
                <span className="mini-achievement-name">SCORE 500</span>
              </div>

              <div className={`mini-achievement-badge ${profile?.achievements?.includes("daily_challenge") ? "unlocked" : ""}`} title="Score 1000 in a Daily Run.">
                <svg viewBox="0 0 24 24">
                  <path d="M18 2H6v2H2v4c0 2.21 1.79 4 4 4h2c.8 1.74 2.5 3.03 4.5 3.32V18H10v2h4v-2h-2v-2.68c2-.29 3.7-1.58 4.5-3.32h2c2.21 0 4-1.79 4-4V4h-4V2zM6 10c-1.1 0-2-.9-2-2V6h2v4zm14-2c0 1.1-.9 2-2 2V6h2v2z" />
                </svg>
                <span className="mini-achievement-name">SURVIVOR</span>
              </div>

              <div className="mini-achievement-badge" title="Locked Achievement">
                <svg viewBox="0 0 24 24">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
                </svg>
                <span className="mini-achievement-name">???</span>
              </div>
            </div>

            <button className="card-action-btn" onClick={() => openModalWithTab("stats")}>
              VIEW ALL
            </button>
          </div>

          {/* SVG Trends Line Graph */}
          <div className="dashboard-card retro-panel">
            <h3 className="dashboard-card-title">
              RECENT RUNS
              <span className="card-title-badge">TRENDS</span>
            </h3>

            <div className="runs-card-content">
              <div className="runs-graph-container-left">
                {(() => {
                  if (scoreHistory.length === 0) return <div className="leaderboard-empty">NO RUN RECORDS</div>;
                  const maxScore = Math.max(...scoreHistory, 10);
                  const minScore = Math.min(...scoreHistory, 0);
                  const range = maxScore - minScore || 1;

                  const points = scoreHistory.map((s, i) => {
                    const x = 15 + (i / (scoreHistory.length - 1 || 1)) * 150;
                    const y = 75 - ((s - minScore) / range) * 60;
                    return { x, y, score: s };
                  });

                  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const areaD = points.length > 0 ? `${pathD} L ${points[points.length - 1].x} 85 L ${points[0].x} 85 Z` : '';

                  return (
                    <svg viewBox="0 0 180 90" style={{ width: '100%', height: '100%' }}>
                      <defs>
                        <linearGradient id="graphGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="20" x2="180" y2="20" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1="0" y1="50" x2="180" y2="50" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1="0" y1="80" x2="180" y2="80" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3,3" />
                      {points.length > 1 && (
                        <>
                          <path d={areaD} fill="url(#graphGradient)" />
                          <path d={pathD} fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      )}
                      {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#101115" stroke="#ffffff" strokeWidth="1.5">
                          <title>{`Run ${i + 1}: ${p.score}`}</title>
                        </circle>
                      ))}
                    </svg>
                  );
                })()}
              </div>

              <div className="runs-graph-stats-right">
                <div className="runs-stat-box">
                  <span className="runs-stat-lbl">SCORE</span>
                  <span className="runs-stat-val">{scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : 0}</span>
                </div>
                <div className="runs-stat-box">
                  <span className="runs-stat-lbl">DISTANCE</span>
                  <span className="runs-stat-val">{scoreHistory.length > 0 ? (scoreHistory[scoreHistory.length - 1] * 1.7).toFixed(0) : 0} M</span>
                </div>
              </div>
            </div>

            <button className="card-action-btn" onClick={() => openModalWithTab("stats")}>
              VIEW HISTORY
            </button>
          </div>

          {/* Quick Launch Tools & Ghost Runs */}
          <div className="dashboard-card retro-panel">
            <h3 className="dashboard-card-title">
              TOOLS & MORE
              <span className="card-title-badge">LAUNCH</span>
            </h3>

            <div className="tools-buttons-grid">
              <button className="tool-grid-btn" onClick={() => openModalWithTab("skins")}>
                <svg viewBox="0 0 24 24">
                  <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.67C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h16v6z" />
                </svg>
                <span className="tool-grid-btn-label">DAILY GIFT</span>
              </button>
              <button className="tool-grid-btn" onClick={() => openModalWithTab("leaderboard")}>
                <svg viewBox="0 0 24 24">
                  <path d="M16 11V3H8v6H2v12h20V11h-6zm-6-6h4v14h-4V5zm-6 10h4v4H4v-4zm16 4h-4v-8h4v8z" />
                </svg>
                <span className="tool-grid-btn-label">LEADERBOARD</span>
              </button>
              <button className="tool-grid-btn" onClick={() => openModalWithTab("skins")}>
                <svg viewBox="0 0 24 24">
                  <path d="M18 3h-6v2h-2v2H8v2H6v2H4v8h2v2h2v-2h2v2h2v-2h2v-2h2V9h2V7h2V3h-2z" />
                </svg>
                <span className="tool-grid-btn-label">SKINS</span>
              </button>
              <button className="tool-grid-btn" onClick={() => openModalWithTab("edit")}>
                <svg viewBox="0 0 24 24">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
                <span className="tool-grid-btn-label">SETTINGS</span>
              </button>
            </div>
          </div>
        </section>

        {/* Active Toast notifications */}
        <div className="achievement-toast-container">
          {activeToasts.map((toast) => (
            <div key={toast.id} className="achievement-toast-card">
              <div className="toast-badge">
                <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }}>
                  <path d="M3 1h10v3c0 2-1 4-4 4v2h3v3h-2v2H6v-2H4v-3h3V8C4 8 3 6 3 4V1zm0 2H1v1c0 1 1 2 2 2v-3zm10 0v3c1 0 2-1 2-2V3h-2z" />
                </svg>
                UNLOCKED
              </div>
              <div className="toast-content">
                <div className="toast-title">{toast.title}</div>
                <div className="toast-desc">{toast.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Launcher Footer Bar */}
      <footer className="launcher-footer">
        <div className="footer-left">
          <button className="footer-btn" onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? (
              <>
                <svg viewBox="0 0 16 16"><path d="M1 5v6h3l4 4V1H4L1 5zm9 0l-1 1 2 2-2 2 1 1 2-2 2 2 1-1-2-2 2-2-1-1-2 2-1-1z" /></svg>
                SOUND: OFF
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16"><path d="M1 5v6h3l4 4V1H4L1 5zm8 3a3 3 0 0 0-2-3v6a3 3 0 0 0 2-3zm2 0a5 5 0 0 0-3-5v10a5 5 0 0 0 3-5z" /></svg>
                SOUND: ON
              </>
            )}
          </button>

          <button className="footer-btn" onClick={() => setIsSfxMuted(!isSfxMuted)}>
            {isSfxMuted ? (
              <>
                <svg viewBox="0 0 16 16"><path d="M1 5v6h3l4 4V1H4L1 5zm9 0l-1 1 2 2-2 2 1 1 2-2 2 2 1-1-2-2 2-2-1-1-2 2-1-1z" /></svg>
                SFX: OFF
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16"><path d="M1 5v6h3l4 4V1H4L1 5zm8 3a3 3 0 0 0-2-3v6a3 3 0 0 0 2-3zm2 0a5 5 0 0 0-3-5v10a5 5 0 0 0 3-5z" /></svg>
                SFX: ON
              </>
            )}
          </button>

          <span>|</span>

          <button className="footer-btn" onClick={toggleFullscreen}>
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
            FULLSCREEN
          </button>
        </div>

        <div className="footer-center">
          <span>&copy; 2026 DINODASH | MADE WITH &hearts; BY Ebin Reji</span>
        </div>

        <div className="footer-right">
          <a href="https://discord.gg" className="footer-social-link" target="_blank" rel="noreferrer" title="Discord">
            <svg viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" /></svg>
          </a>
          <a href="https://twitter.com" className="footer-social-link" target="_blank" rel="noreferrer" title="Twitter">
            <svg viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg>
          </a>
        </div>
      </footer>

      {showProfileModal && <ProfileSettingsModal onClose={() => setShowProfileModal(false)} initialTab={modalTab} />}
    </div>
  );
};
