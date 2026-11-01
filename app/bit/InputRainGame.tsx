"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createResultCard } from "./shared/createResultCard";
import { GamePauseOverlay } from "./shared/GamePauseOverlay";
import { ShareButton } from "./shared/ShareButton";
import { useVisibilityPause } from "./shared/useVisibilityPause";
import { XShareButton } from "./shared/XShareButton";
import { inputRainGenreOrder, inputRainGenres, inputRainPrompts, type InputRainDifficulty, type InputRainGenre, type InputRainPrompt } from "./inputRainPrompts";
import { useInputRainAudio } from "./useInputRainAudio";
import { PARTICLE_GLYPHS, setParticleGlyphs, spawnDissolve, spawnMaterialize } from "./inputRainParticles";
import { InputRainSky } from "./inputRainSky";
import { InputRainFlickPad } from "./InputRainFlickPad";
import { isReachableTowards, nextMutation } from "./inputRainFlickMap";
import { SoundMark } from "./shared/SoundMark";

type Phase = "select" | "countdown" | "playing" | "complete";
type InputMode = "keyboard" | "flick";
type PromptFeedback = "idle" | "accepted" | "error" | "timeout";
type Token = { kana: string; opts: string[] };
type TrailEntry = { text: string; note?: string; term?: string; typed: boolean };
type RunResult = {
  accepted: number;
  score: number;
  speed: number;
  accuracy: number;
  maxCombo: number;
  rank: string;
  inputMode: InputMode;
};

const INPUT_MODE_STORAGE_KEY = "marutibit:input-rain:input-mode";
const GENRE_STORAGE_KEY = "marutibit:input-rain:genre";
const inputModeLabels: Record<InputMode, string> = { keyboard: "ローマ字入力", flick: "フリック入力" };

const levels: Record<InputRainDifficulty, {
  label: string;
  seconds: number;
  fallBase: number;
  fallPerChar: number;
  scoreFactor: number;
}> = {
  beginner: { label: "初級", seconds: 20, fallBase: 4600, fallPerChar: 250, scoreFactor: 3 },
  intermediate: { label: "中級", seconds: 40, fallBase: 6000, fallPerChar: 210, scoreFactor: 1.6 },
  advanced: { label: "上級", seconds: 60, fallBase: 9000, fallPerChar: 170, scoreFactor: 1 },
  pro: { label: "PRO", seconds: 180, fallBase: 15500, fallPerChar: 150, scoreFactor: 1 / 3 },
};

const romaji: Record<string, string[]> = {
  あ: ["a"], い: ["i", "yi"], う: ["u", "wu"], え: ["e"], お: ["o"],
  か: ["ka", "ca"], き: ["ki"], く: ["ku", "cu", "qu"], け: ["ke"], こ: ["ko", "co"],
  さ: ["sa"], し: ["shi", "si", "ci"], す: ["su"], せ: ["se", "ce"], そ: ["so"],
  た: ["ta"], ち: ["chi", "ti"], つ: ["tsu", "tu"], て: ["te"], と: ["to"],
  な: ["na"], に: ["ni"], ぬ: ["nu"], ね: ["ne"], の: ["no"],
  は: ["ha"], ひ: ["hi"], ふ: ["fu", "hu"], へ: ["he"], ほ: ["ho"],
  ま: ["ma"], み: ["mi"], む: ["mu"], め: ["me"], も: ["mo"],
  や: ["ya"], ゆ: ["yu"], よ: ["yo"],
  ら: ["ra"], り: ["ri"], る: ["ru"], れ: ["re"], ろ: ["ro"],
  わ: ["wa"], を: ["wo"], ん: ["n", "nn", "n'"],
  が: ["ga"], ぎ: ["gi"], ぐ: ["gu"], げ: ["ge"], ご: ["go"],
  ざ: ["za"], じ: ["ji", "zi"], ず: ["zu"], ぜ: ["ze"], ぞ: ["zo"],
  だ: ["da"], ぢ: ["di", "ji"], づ: ["du", "zu"], で: ["de"], ど: ["do"],
  ば: ["ba"], び: ["bi"], ぶ: ["bu"], べ: ["be"], ぼ: ["bo"],
  ぱ: ["pa"], ぴ: ["pi"], ぷ: ["pu"], ぺ: ["pe"], ぽ: ["po"],
  ぁ: ["xa", "la"], ぃ: ["xi", "li"], ぅ: ["xu", "lu"], ぇ: ["xe", "le"], ぉ: ["xo", "lo"],
  ゃ: ["xya", "lya"], ゅ: ["xyu", "lyu"], ょ: ["xyo", "lyo"], っ: ["xtu", "ltu", "ltsu"],
  ー: ["-"], "、": [","], "。": ["."],
};

const digraphs: Record<string, string[]> = {
  きゃ: ["kya"], きゅ: ["kyu"], きょ: ["kyo"], しゃ: ["sha", "sya"], しゅ: ["shu", "syu"], しょ: ["sho", "syo"],
  ちゃ: ["cha", "tya"], ちゅ: ["chu", "tyu"], ちょ: ["cho", "tyo"], にゃ: ["nya"], にゅ: ["nyu"], にょ: ["nyo"],
  ひゃ: ["hya"], ひゅ: ["hyu"], ひょ: ["hyo"], みゃ: ["mya"], みゅ: ["myu"], みょ: ["myo"],
  りゃ: ["rya"], りゅ: ["ryu"], りょ: ["ryo"], ぎゃ: ["gya"], ぎゅ: ["gyu"], ぎょ: ["gyo"],
  じゃ: ["ja", "jya", "zya"], じゅ: ["ju", "jyu", "zyu"], じょ: ["jo", "jyo", "zyo"],
  びゃ: ["bya"], びゅ: ["byu"], びょ: ["byo"], ぴゃ: ["pya"], ぴゅ: ["pyu"], ぴょ: ["pyo"],
  ふぁ: ["fa", "fwa"], ふぃ: ["fi", "fwi"], ふぇ: ["fe", "fwe"], ふぉ: ["fo", "fwo"],
  てぃ: ["thi", "ti"], でぃ: ["dhi", "di"], うぃ: ["wi"], うぇ: ["we"], うぉ: ["who", "wo"],
  しぇ: ["she", "sye"], ちぇ: ["che", "tye"], じぇ: ["je", "jye", "zye"],
};

function hiragana(value: string) {
  return value.replace(/[ァ-ヶ]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

function normalizeKana(value: string) {
  return hiragana(value).replace(/\s+/g, "").replace(/，/g, "、").replace(/．/g, "。");
}

function tokenize(reading: string) {
  const characters = [...hiragana(reading)];
  const tokens: Token[] = [];
  for (let index = 0; index < characters.length; index += 1) {
    const pair = characters[index] + (characters[index + 1] || "");
    if (digraphs[pair]) {
      tokens.push({ kana: pair, opts: digraphs[pair] });
      index += 1;
      continue;
    }
    if (characters[index] === "っ") {
      const nextPair = characters[index + 1] + (characters[index + 2] || "");
      const nextOptions = digraphs[nextPair] || romaji[characters[index + 1]] || [];
      const doubled = [...new Set(nextOptions.map((option) => option[0]).filter((character) => /[bcdfghjklmpqrstvwxyz]/.test(character)))];
      tokens.push({ kana: "っ", opts: [...doubled, "xtu", "ltu", "ltsu"] });
      continue;
    }
    tokens.push({ kana: characters[index], opts: romaji[characters[index]] || [characters[index]] });
  }
  return tokens;
}

function romanStatus(tokens: Token[], typed: string) {
  const memo = new Map<string, { valid: boolean; complete: boolean; tokensDone: number }>();
  const walk = (tokenIndex: number, characterIndex: number): { valid: boolean; complete: boolean; tokensDone: number } => {
    const key = `${tokenIndex}|${characterIndex}`;
    const cached = memo.get(key);
    if (cached) return cached;
    if (characterIndex === typed.length) {
      const result = { valid: true, complete: tokenIndex === tokens.length, tokensDone: tokenIndex };
      memo.set(key, result);
      return result;
    }
    if (tokenIndex >= tokens.length) return { valid: false, complete: false, tokensDone: tokenIndex };
    for (const option of tokens[tokenIndex].opts) {
      const remaining = typed.slice(characterIndex);
      if (remaining.startsWith(option)) {
        const result = walk(tokenIndex + 1, characterIndex + option.length);
        if (result.valid) return result;
      } else if (option.startsWith(remaining)) {
        return { valid: true, complete: false, tokensDone: tokenIndex };
      }
    }
    return { valid: false, complete: false, tokensDone: tokenIndex };
  };
  return walk(0, 0);
}

function preferredRoman(tokens: Token[], typedPrefix = "") {
  const fallback = (start: number) => tokens.slice(start).map((token) => token.opts[0]).join("");
  const walk = (tokenIndex: number, characterIndex: number): string | null => {
    if (characterIndex === typedPrefix.length) return fallback(tokenIndex);
    if (tokenIndex >= tokens.length) return null;
    const remaining = typedPrefix.slice(characterIndex);
    for (const option of tokens[tokenIndex].opts) {
      if (remaining.startsWith(option)) {
        const tail = walk(tokenIndex + 1, characterIndex + option.length);
        if (tail !== null) return option + tail;
      } else if (option.startsWith(remaining)) {
        return option + fallback(tokenIndex + 1);
      }
    }
    return null;
  };
  return walk(0, 0) || fallback(0);
}

function cleanCharacterCount(value: string) {
  return [...value].filter((character) => !/[、。,．.\s]/.test(character)).length;
}

function shuffle(length: number) {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[other]] = [indexes[other], indexes[index]];
  }
  return indexes;
}

function computeRank(score: number, accuracy: number, misses: number) {
  if (score >= 18000 && accuracy >= 99.5 && misses <= 2) return "SSS";
  if (score >= 13000 && accuracy >= 98.5) return "SS";
  if (score >= 9000 && accuracy >= 97) return "S";
  if (score >= 6500 && accuracy >= 92) return "A";
  if (score >= 4200 && accuracy >= 85) return "B";
  if (score >= 2300 && accuracy >= 74) return "C";
  return "D";
}

const emptyResult: RunResult = { accepted: 0, score: 0, speed: 0, accuracy: 0, maxCombo: 0, rank: "D", inputMode: "keyboard" };
const emptyStats = { accepted: 0, score: 0, misses: 0, correctChars: 0, combo: 0, maxCombo: 0 };

export function InputRainGame() {
  const gameShellRef = useRef<HTMLElement>(null);
  const particleLayerRef = useRef<HTMLDivElement>(null);
  const promptGlyphsRef = useRef<HTMLDivElement>(null);
  const completionTimerRef = useRef<number | null>(null);
  const gameEndRef = useRef(0);
  const pauseStartedRef = useRef(0);
  const fallDeadlineRef = useRef(0);
  const fallPauseStartedRef = useRef(0);
  const phaseRef = useRef<Phase>("select");
  const promptBagRef = useRef<number[]>([]);
  const statsRef = useRef({ ...emptyStats });
  const skyRef = useRef<InputRainSky | null>(null);
  const genreRef = useRef<InputRainGenre>("daily");
  const feedbackRef = useRef<PromptFeedback>("idle");
  const fallDurationRef = useRef(0);
  const trailRef = useRef<TrailEntry[]>([]);

  const [genre, setGenre] = useState<InputRainGenre>("daily");
  const [difficulty, setDifficulty] = useState<InputRainDifficulty>("beginner");
  const [phase, setPhase] = useState<Phase>("select");
  const [inputMode, setInputMode] = useState<InputMode>("keyboard");
  const [current, setCurrent] = useState<InputRainPrompt | null>(null);
  const [promptId, setPromptId] = useState(0);
  const [typed, setTyped] = useState("");
  const [mobileTyped, setMobileTyped] = useState("");
  const [feedback, setFeedback] = useState<PromptFeedback>("idle");
  const [remaining, setRemaining] = useState(levels.beginner.seconds);
  const [countdown, setCountdown] = useState(3);
  const [manualPaused, setManualPaused] = useState(false);
  const [displayStats, setDisplayStats] = useState({ ...emptyStats });
  const [result, setResult] = useState<RunResult>(emptyResult);
  const [shareCard, setShareCard] = useState<File | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [lastMeaning, setLastMeaning] = useState<{ term: string; note: string } | null>(null);
  const { paused: pagePaused, resume: resumePage } = useVisibilityPause(phase === "playing" || phase === "countdown");
  const paused = manualPaused || pagePaused;
  const {
    enabled: soundEnabled,
    toggle: toggleSound,
    prime: primeSound,
    playTypeKey,
    playTypeFlick,
    playBackspace,
    playAccept,
    playMiss,
    playTimeout,
    playCountdownTick,
    playGo,
    resetPhrase,
    setRainStrength,
    startBgm,
    startResultBgm,
    stopAllLoops,
  } = useInputRainAudio(paused || phase === "select", genre);

  const genreInfo = inputRainGenres[genre];
  const level = levels[difficulty];
  const tokens = useMemo(() => current ? tokenize(current.reading) : [], [current]);
  const romanGuide = useMemo(() => preferredRoman(tokens, typed), [tokens, typed]);
  const guide = inputMode === "keyboard" ? romanGuide : current?.reading || "";
  const guideProgress = inputMode === "keyboard" ? Math.min(guide.length, typed.length) : Math.min(guide.length, mobileTyped.length);
  const fallDuration = current ? Math.min(15000, level.fallBase + cleanCharacterCount(current.reading) * level.fallPerChar) : level.fallBase;

  useEffect(() => {
    fallDurationRef.current = fallDuration;
  }, [fallDuration]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedGenre = localStorage.getItem(GENRE_STORAGE_KEY);
        if (savedGenre && savedGenre in inputRainGenres) setGenre(savedGenre as InputRainGenre);
      } catch { /* Start on the everyday genre. */ }
      try {
        const saved = localStorage.getItem(INPUT_MODE_STORAGE_KEY);
        if (saved === "keyboard" || saved === "flick") {
          setInputMode(saved);
          return;
        }
      } catch { /* Fall back to device detection. */ }
      const coarse = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
      setInputMode(coarse ? "flick" : "keyboard");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const chooseInputMode = useCallback((mode: InputMode) => {
    setInputMode(mode);
    try { localStorage.setItem(INPUT_MODE_STORAGE_KEY, mode); } catch { /* Optional. */ }
  }, []);

  const chooseGenre = useCallback((next: InputRainGenre) => {
    setGenre(next);
    try { localStorage.setItem(GENRE_STORAGE_KEY, next); } catch { /* Optional. */ }
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    genreRef.current = genre;
    gameShellRef.current?.closest(".inputRainPage")?.setAttribute("data-ir-genre", genre);
    setParticleGlyphs(PARTICLE_GLYPHS[genre]);
    skyRef.current?.setGenre(genre);
  }, [genre]);

  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  // Where the prompt is in its fall, for the warning ripples gathering under it. Read from
  // refs every frame by the sky, so it needs no re-render to stay current.
  const dangerSource = useCallback(() => {
    if (phaseRef.current !== "playing" || feedbackRef.current === "accepted" || feedbackRef.current === "timeout") return null;
    const deadline = fallDeadlineRef.current;
    const duration = fallDurationRef.current;
    const canvas = skyRef.current ? particleLayerRef.current : null;
    const glyphs = promptGlyphsRef.current;
    if (!deadline || !duration || !canvas || !glyphs) return null;
    const now = fallPauseStartedRef.current || performance.now();
    const progress = Math.max(0, Math.min(1, 1 - (deadline - now) / duration));
    const laneRect = canvas.getBoundingClientRect();
    const glyphRect = glyphs.getBoundingClientRect();
    return { x: glyphRect.left + glyphRect.width / 2 - laneRect.left, progress };
  }, []);

  // A callback ref: the select preview, the countdown and the lane each mount their own
  // canvas, and whichever is on screen gets the one running sky.
  const attachSky = useCallback((canvas: HTMLCanvasElement | null) => {
    skyRef.current?.destroy();
    skyRef.current = null;
    if (!canvas) return;
    const sky = new InputRainSky(canvas, genreRef.current);
    sky.setIdle(phaseRef.current === "select" ? 0.42 : phaseRef.current === "complete" ? 0.12 : 0.16);
    sky.setDangerSource(dangerSource);
    sky.start();
    skyRef.current = sky;
  }, [dangerSource]);

  useEffect(() => {
    skyRef.current?.setInputScale(inputMode === "flick" ? 1.9 : 3.4);
  }, [inputMode, phase]);

  useEffect(() => {
    skyRef.current?.setPaused(paused);
  }, [paused, phase]);

  useEffect(() => () => skyRef.current?.destroy(), []);

  // The rain hiss under the music follows the same strength as the rain on screen.
  useEffect(() => {
    if (phase !== "playing" || paused) return;
    const timer = window.setInterval(() => {
      const sky = skyRef.current;
      if (sky) setRainStrength(sky.strength());
    }, 200);
    return () => window.clearInterval(timer);
  }, [paused, phase, setRainStrength]);

  useEffect(() => () => {
    if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
  }, []);

  // v2: one shuffled bag per genre and difficulty, so every list is played through before repeating.
  const bagKey = `marutibit:input-rain:v2:${genre}:${difficulty}`;

  const storeBag = useCallback((next: number[]) => {
    try { localStorage.setItem(bagKey, JSON.stringify(next)); } catch { /* Optional. */ }
  }, [bagKey]);

  const loadBag = useCallback(() => {
    const pool = inputRainPrompts[genre][difficulty];
    try {
      const saved = JSON.parse(localStorage.getItem(bagKey) || "null");
      if (Array.isArray(saved) && saved.length && saved.every((value) => Number.isInteger(value) && value >= 0 && value < pool.length) && new Set(saved).size === saved.length) return saved as number[];
    } catch { /* Build a fresh bag. */ }
    return shuffle(pool.length);
  }, [bagKey, difficulty, genre]);

  const pickPrompt = useCallback(() => {
    const pool = inputRainPrompts[genre][difficulty];
    if (!promptBagRef.current.length) promptBagRef.current = loadBag();
    if (!promptBagRef.current.length) promptBagRef.current = shuffle(pool.length);
    const index = promptBagRef.current.pop() ?? 0;
    storeBag(promptBagRef.current);
    return pool[index];
  }, [difficulty, genre, loadBag, storeBag]);

  const nextPrompt = useCallback(() => {
    setCurrent(pickPrompt());
    setPromptId((value) => value + 1);
    setTyped("");
    setMobileTyped("");
    setFeedback("idle");
    resetPhrase();
    fallDeadlineRef.current = 0;
    fallPauseStartedRef.current = 0;
  }, [pickPrompt, resetPhrase]);

  const recordTrail = useCallback((prompt: InputRainPrompt, typedOut: boolean) => {
    trailRef.current = [...trailRef.current, { text: prompt.text, note: prompt.note, term: prompt.term, typed: typedOut }];
  }, []);

  const finishRun = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    phaseRef.current = "complete";
    setPhase("complete");
    setManualPaused(false);
    const stats = statsRef.current;
    const speed = Math.round(stats.correctChars / (level.seconds / 60));
    const accuracy = stats.correctChars + stats.misses ? stats.correctChars / (stats.correctChars + stats.misses) * 100 : 0;
    const rank = computeRank(stats.score, accuracy, stats.misses);
    startResultBgm(["SSS", "SS", "S", "A"].includes(rank) ? "excellent" : rank === "B" || rank === "C" ? "good" : "retry");
    const finalResult = { accepted: stats.accepted, score: stats.score, speed, accuracy, maxCombo: stats.maxCombo, rank, inputMode };
    setResult(finalResult);
    setTrail(trailRef.current);
    setShareCard(null);
    setShareStatus("");
  }, [inputMode, level.seconds, startResultBgm]);

  // The result screen isn't covered by useVisibilityPause (there's no timer or pause
  // overlay to show there), so backgrounding/locking the phone during it previously left
  // the result BGM playing indefinitely. Just stop it outright - there's nothing to
  // resume back into on this screen.
  useEffect(() => {
    if (phase !== "complete") return;
    const onHidden = () => { if (document.hidden) stopAllLoops(); };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
    };
  }, [phase, stopAllLoops]);

  // Kept separate from the timer-advance effect below so it fires exactly once per
  // displayed countdown number, not whenever an unrelated dependency changes.
  useEffect(() => {
    if (phase !== "countdown") return;
    playCountdownTick(countdown);
  }, [phase, countdown, playCountdownTick]);

  useEffect(() => {
    if (phase !== "countdown" || paused) return;
    if (countdown > 1) {
      const timer = window.setTimeout(() => setCountdown((value) => value - 1), 650);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      phaseRef.current = "playing";
      setPhase("playing");
      gameEndRef.current = performance.now() + level.seconds * 1000;
      playGo();
      startBgm();
      nextPrompt();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [countdown, level.seconds, nextPrompt, paused, phase, playGo, startBgm]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (paused) {
      if (!pauseStartedRef.current) pauseStartedRef.current = performance.now();
      return;
    }
    if (pauseStartedRef.current) {
      gameEndRef.current += performance.now() - pauseStartedRef.current;
      pauseStartedRef.current = 0;
    }
    let frame = 0;
    const tick = (now: number) => {
      const left = Math.max(0, gameEndRef.current - now);
      setRemaining(left / 1000);
      if (left <= 0) {
        finishRun();
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [finishRun, paused, phase]);

  useEffect(() => {
    if (phase !== "complete") return;
    const url = "https://marutilab.com/bit/input-rain";
    void createResultCard({
      series: "MarutiBit",
      gameNumber: "GAME 004",
      gameTitle: "INPUT RAIN",
      gameDescription: "落ちてくる言葉を打ち込む",
      questions: result.accepted,
      countLabel: "INPUTS",
      level: `${genreInfo.label} ${level.label}`,
      score: result.score,
      correct: `${result.accepted} INPUTS`,
      time: `${level.seconds} SEC`,
      url,
    }).then((file) => setShareCard(file));
  }, [genreInfo.label, level.label, level.seconds, phase, result]);

  // Skips the scroll entirely when the shell already fits on screen (common on a wide
  // desktop viewport) - forcing a scroll there ate up what little scroll range the page
  // had, so a player who then tried to nudge the view back up manually had nowhere to go.
  const scrollShellIntoView = useCallback((block: ScrollLogicalPosition) => {
    window.requestAnimationFrame(() => {
      const el = gameShellRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
      el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block });
    });
  }, []);

  const startRun = useCallback(() => {
    if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
    statsRef.current = { ...emptyStats };
    setDisplayStats({ ...statsRef.current });
    setResult(emptyResult);
    setCurrent(null);
    setRemaining(level.seconds);
    setCountdown(3);
    setFeedback("idle");
    setManualPaused(false);
    trailRef.current = [];
    setTrail([]);
    setLastMeaning(null);
    promptBagRef.current = loadBag();
    phaseRef.current = "countdown";
    setPhase("countdown");
    resumePage();
    stopAllLoops();
    primeSound();
    scrollShellIntoView("start");
  }, [level.seconds, loadBag, primeSound, resumePage, scrollShellIntoView, stopAllLoops]);

  // The flick pad only mounts once "playing" starts (the countdown screen doesn't show
  // it), so the shell is still its short, pad-less height when startRun's own scroll
  // fires - correcting to "end" there landed on the countdown UI's shape and barely
  // moved. Re-settling here, once the pad has actually mounted and the shell is at its
  // full (usually taller-than-viewport) height, is what actually keeps the pad on-screen.
  useEffect(() => {
    if (phase !== "playing" || inputMode !== "flick") return;
    scrollShellIntoView("end");
  }, [phase, inputMode, scrollShellIntoView]);

  const registerInputError = useCallback(() => {
    if (feedback === "error") return;
    statsRef.current.misses += 1;
    statsRef.current.combo = 0;
    setDisplayStats({ ...statsRef.current });
    setFeedback("error");
    playMiss();
    skyRef.current?.damp();
    window.setTimeout(() => setFeedback((value) => value === "error" ? "idle" : value), 180);
  }, [feedback, playMiss]);

  const completePrompt = useCallback(() => {
    // Only block while the prompt is actually transitioning away (just accepted, or just
    // timed out) - the brief "error" shake after a miss doesn't replace the prompt, so it
    // shouldn't stop a correct keystroke typed a moment later from completing it.
    if (!current || feedback === "accepted" || feedback === "timeout" || phaseRef.current !== "playing") return;
    const count = cleanCharacterCount(current.reading);
    const nextCombo = statsRef.current.combo + count;
    const multiplier = 1 + Math.min(0.5, Math.floor(nextCombo / 10) * 0.05);
    statsRef.current.accepted += 1;
    statsRef.current.correctChars += count;
    statsRef.current.combo = nextCombo;
    statsRef.current.maxCombo = Math.max(statsRef.current.maxCombo, nextCombo);
    statsRef.current.score += Math.round(count * 100 * level.scoreFactor * multiplier);
    setDisplayStats({ ...statsRef.current });
    spawnDissolve(particleLayerRef.current, promptGlyphsRef.current?.querySelectorAll(".inputRainGlyph") ?? [], "accept");
    const layer = particleLayerRef.current?.getBoundingClientRect();
    const glyphs = promptGlyphsRef.current?.getBoundingClientRect();
    if (layer && glyphs) skyRef.current?.splash(glyphs.left + glyphs.width / 2 - layer.left, glyphs.top + glyphs.height / 2 - layer.top);
    recordTrail(current, true);
    if (current.note) setLastMeaning({ term: current.term || current.text, note: current.note });
    setFeedback("accepted");
    playAccept();
    completionTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "playing") nextPrompt();
    }, 190);
  }, [current, feedback, level.scoreFactor, nextPrompt, playAccept, recordTrail]);

  const handleTimeout = useCallback(() => {
    if (phaseRef.current !== "playing" || paused || feedback === "accepted" || feedback === "timeout") return;
    statsRef.current.misses += 1;
    statsRef.current.combo = 0;
    setDisplayStats({ ...statsRef.current });
    spawnDissolve(particleLayerRef.current, promptGlyphsRef.current?.querySelectorAll(".inputRainGlyph") ?? [], "miss");
    if (current) {
      recordTrail(current, false);
      if (current.note) setLastMeaning({ term: current.term || current.text, note: current.note });
    }
    setFeedback("timeout");
    playTimeout();
    skyRef.current?.damp();
    completionTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "playing") nextPrompt();
    }, 360);
  }, [current, feedback, nextPrompt, paused, playTimeout, recordTrail]);

  // Backstop for the fall timeout: some mobile browsers don't reliably fire
  // animationend on a CSS animation that was paused (backgrounded) mid-flight, which
  // left the prompt stuck on screen with no way to advance. This setTimeout mirrors
  // --fall-duration and pause-compensates the same way the main game timer does, so it
  // fires the timeout even if the CSS animation's own end event never arrives.
  useEffect(() => {
    if (phase !== "playing" || !current) return;
    if (fallDeadlineRef.current === 0) fallDeadlineRef.current = performance.now() + fallDuration;
    if (paused) {
      if (!fallPauseStartedRef.current) fallPauseStartedRef.current = performance.now();
      return;
    }
    if (fallPauseStartedRef.current) {
      fallDeadlineRef.current += performance.now() - fallPauseStartedRef.current;
      fallPauseStartedRef.current = 0;
    }
    const remaining = Math.max(0, fallDeadlineRef.current - performance.now());
    const timer = window.setTimeout(handleTimeout, remaining);
    return () => window.clearTimeout(timer);
  }, [promptId, phase, paused, current, fallDuration, handleTimeout]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Same reasoning as completePrompt: don't let the brief post-miss "error" shake
      // swallow the very next (correct) keystroke - only an actual prompt transition
      // (accepted/timeout) should pause input.
      if (phaseRef.current !== "playing" || inputMode !== "keyboard" || paused || feedback === "accepted" || feedback === "timeout") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setManualPaused(true);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        if (typed) playBackspace();
        setTyped((value) => value.slice(0, -1));
        return;
      }
      if (event.key.length !== 1) return;
      // With the IME set to fullwidth-alphanumeric, physical keys report their fullwidth
      // form here (e.g. "Ａ" instead of "a") even with no composition popup active - NFKC
      // folds that back to ASCII before the romaji matcher below ever sees it.
      const character = event.key.normalize("NFKC").toLowerCase();
      if (!/[a-z,.'-]/.test(character)) return;
      event.preventDefault();
      const candidate = typed + character;
      const status = romanStatus(tokens, candidate);
      if (!status.valid) {
        registerInputError();
        return;
      }
      if (feedback === "error") setFeedback("idle");
      setTyped(candidate);
      playTypeKey();
      skyRef.current?.pulse();
      if (status.complete) completePrompt();
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [completePrompt, feedback, inputMode, paused, playBackspace, playTypeKey, registerInputError, tokens, typed]);

  // Space starts the run from the select screen, mirroring the START button.
  useEffect(() => {
    const onSpaceStart = (event: KeyboardEvent) => {
      if (phaseRef.current !== "select" || event.repeat) return;
      if (event.code !== "Space" && event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "BUTTON" || target.isContentEditable)) return;
      event.preventDefault();
      startRun();
    };
    window.addEventListener("keydown", onSpaceStart);
    return () => window.removeEventListener("keydown", onSpaceStart);
  }, [startRun]);

  const appendFlickChar = useCallback((char: string) => {
    if (!current || phaseRef.current !== "playing" || inputMode !== "flick" || paused || feedback === "accepted" || feedback === "timeout") return;
    const target = normalizeKana(current.reading);
    // Without a delete key, a base form left un-mutated stops being reachable the moment
    // another character is typed after it (mutate only ever touches the last character),
    // which would otherwise let a run advance past a wrong dakuten/small-kana without ever
    // completing it. So a still-pending mutation blocks any new character - matching a
    // real phone's flick input, where the modifier key only ever applies to what you just
    // committed, not something further back.
    if (mobileTyped && mobileTyped.slice(-1) !== target[mobileTyped.length - 1]) {
      registerInputError();
      return;
    }
    // Allow any base form on the same dakuten/handakuten/small-kana cycle as the
    // expected character — e.g. base "そ" is a valid step toward target "ぞ", since the
    // mutate key still needs to be pressed to get there.
    const expected = target[mobileTyped.length];
    if (!isReachableTowards(char, expected)) {
      registerInputError();
      return;
    }
    const value = mobileTyped + char;
    if (feedback === "error") setFeedback("idle");
    playTypeFlick();
    skyRef.current?.pulse();
    setMobileTyped(value);
    if (value === target) completePrompt();
  }, [completePrompt, current, feedback, inputMode, mobileTyped, paused, playTypeFlick, registerInputError]);

  const mutateFlickChar = useCallback(() => {
    if (!current || phaseRef.current !== "playing" || inputMode !== "flick" || paused || feedback === "accepted" || feedback === "timeout" || !mobileTyped) return;
    const lastChar = mobileTyped.slice(-1);
    const target = normalizeKana(current.reading);
    const expected = target[mobileTyped.length - 1];
    // If the last character is already the exact target (e.g. "す" when "す" is correct),
    // mutating it can only move it away from the right answer (e.g. into "ず") - reject
    // that outright instead of accepting it as just another reachable cycle member.
    if (lastChar === expected) {
      registerInputError();
      return;
    }
    const mutated = nextMutation(lastChar);
    if (mutated === lastChar) return;
    if (!isReachableTowards(mutated, expected)) {
      registerInputError();
      return;
    }
    const candidate = mobileTyped.slice(0, -1) + mutated;
    if (feedback === "error") setFeedback("idle");
    playTypeFlick();
    skyRef.current?.pulse(0.5);
    setMobileTyped(candidate);
    if (candidate === target) completePrompt();
  }, [completePrompt, current, feedback, inputMode, mobileTyped, paused, playTypeFlick, registerInputError]);

  const resumeGame = useCallback(() => {
    resumePage();
    setManualPaused(false);
  }, [resumePage]);

  const quitRun = useCallback(() => {
    if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
    phaseRef.current = "select";
    setPhase("select");
    setManualPaused(false);
    setCurrent(null);
    setFeedback("idle");
    stopAllLoops();
  }, [stopAllLoops]);

  const shareResult = useCallback(async () => {
    const url = "https://marutilab.com/bit/input-rain";
    const title = "MarutiBit — INPUT RAIN";
    const text = `落ちてくる言葉を、落ちきる前に打ち込むタイピングゲーム「INPUT RAIN」。\n${genreInfo.label}・${level.label} / ${result.accepted} INPUTS / SCORE ${result.score.toLocaleString()} / RANK ${result.rank}`;
    const shareText = `${text}\n${url}`;
    try {
      if (shareCard && navigator.canShare?.({ files: [shareCard] })) {
        await navigator.share({ files: [shareCard], title, text: shareText });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title, text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setShareStatus("結果をコピーしました");
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setShareStatus("共有できませんでした");
    }
  }, [genreInfo.label, level.label, result, shareCard]);

  // Drops a few noise particles into the freshly-rendered prompt glyphs, echoing the fall.
  // A short timeout (rather than requestAnimationFrame) waits for layout without depending
  // on the tab actually compositing a frame.
  useEffect(() => {
    if (!current || phase !== "playing") return;
    const timer = window.setTimeout(() => {
      spawnMaterialize(particleLayerRef.current, promptGlyphsRef.current?.querySelectorAll(".inputRainGlyph") ?? []);
    }, 16);
    return () => window.clearTimeout(timer);
  }, [promptId, current, phase]);

  const glyphs = current ? [...current.text] : [];
  const isTopRank = result.rank === "SSS" || result.rank === "SS" || result.rank === "S" || result.rank === "A";
  const resultMood = isTopRank ? "is-excellent" : result.rank === "B" || result.rank === "C" ? "is-good" : "is-retry";
  const isTerminal = genre === "terminal";
  const entryMark = isTerminal ? "PT>" : "▸";
  const typedCount = trail.filter((entry) => entry.typed).length;

  return (
    <section ref={gameShellRef} className={`bitGameShell inputRainGameShell inputRainSkin is-${genre}`} data-card-ready={shareCard ? "true" : "false"}>
      <div className="bitGameControls">
        <button type="button" className={`bitSound${soundEnabled ? " isOn" : ""}`} onClick={() => void toggleSound()} aria-pressed={soundEnabled}>
          <SoundMark />SOUND <strong>{soundEnabled ? "ON" : "OFF"}</strong>
        </button>
        {phase === "playing" && <button type="button" className="bitQuit" onClick={() => setManualPaused(true)}>一時停止 / やめる</button>}
      </div>

      {phase === "select" && (
        <>
          <div className="bitSelectHead"><span>SELECT GENRE</span><strong>{inputRainGenreOrder.length} GENRES</strong></div>
          <div className={`inputRainTerminal inputRainTerminalPreview is-${genre}`} aria-label="ゲーム説明">
            <div className="inputRainChrome"><b>{genreInfo.badge}</b><span>{genreInfo.chrome}</span><small>STANDBY</small></div>
            <div className="inputRainReady">
              <canvas ref={attachSky} className="inputRainSky" aria-hidden="true" />
              {isTerminal ? (
                <>
                  <span className="inputRainPromptMark" aria-hidden="true"><i /><i /><i /></span>
                  <p>PT&gt; INPUT CHANNEL ARMED<span className="inputRainCursor">▋</span></p>
                </>
              ) : (
                <>
                  <span className="inputRainSampleReading">{genreInfo.sampleReading}</span>
                  <p className="inputRainSample">{genreInfo.sample}</p>
                </>
              )}
              <small>表示された日本語を、文字が落ちきる前に入力。速く打つほど雨が強くなります。</small>
            </div>
            <div className="inputRainStatus"><span>GENRE / {genreInfo.label}</span><span>{genreInfo.scene}</span><span>READY</span></div>
          </div>
          <div className="bitModeSelect inputRainGenreSelect">
            {inputRainGenreOrder.map((key) => (
              <button key={key} type="button" className={`is-${key}${genre === key ? " isActive" : ""}`} onClick={() => chooseGenre(key)}>
                {inputRainGenres[key].label}<small>{inputRainGenres[key].scene}</small>
              </button>
            ))}
          </div>
          <div className="bitModeSelect inputRainInputToggle">
            <button type="button" className={inputMode === "keyboard" ? "isActive" : undefined} onClick={() => chooseInputMode("keyboard")}>
              キーボード<small>ローマ字入力</small>
            </button>
            <button type="button" className={inputMode === "flick" ? "isActive" : undefined} onClick={() => chooseInputMode("flick")}>
              フリック<small>スマホのかな入力</small>
            </button>
          </div>
          <div className="bitModeSelect inputRainDifficultySelect">
            {(Object.keys(levels) as InputRainDifficulty[]).map((key) => (
              <button key={key} type="button" className={difficulty === key ? "isActive" : undefined} onClick={() => setDifficulty(key)}>
                {levels[key].label}<small>{levels[key].seconds} SEC / {genreInfo.notes[key]}</small>
              </button>
            ))}
          </div>
          <button type="button" className="bitStart" onClick={startRun}>START<small className="inputRainSpaceHint">SPACE TO START</small></button>
          <p className="bitRule">ジャンルと入力方式はこの端末に記憶され、次回も同じ設定で始まります。物理キーボードを接続した場合は「キーボード」を選んでください。</p>
          <div className="bitPakuShareRow">
            <ShareButton title="MarutiBit「INPUT RAIN」" text="落ちてくる言葉を、落ちきる前に打ち込むタイピング／フリック入力ゲーム。日常・四字熟語・ビジネス・端末の4ジャンル" url="https://marutilab.com/bit/input-rain" />
            <XShareButton variant="compact" text={"MarutiBit「INPUT RAIN」\n落ちてくる言葉を、落ちきる前に打ち込むタイピング／フリック入力ゲーム。日常・四字熟語・ビジネス・端末の4ジャンル"} url="https://marutilab.com/bit/input-rain" />
          </div>
        </>
      )}

      {(phase === "countdown" || phase === "playing") && (
        <div className={`inputRainTerminal is-${genre}${paused ? " isPaused" : ""}${feedback === "error" ? " isError" : ""}${difficulty === "pro" ? " isPro" : ""}`}>
          <div className="inputRainChrome"><b>{genreInfo.badge}</b><span>{genreInfo.chrome}</span><small>{phase === "countdown" ? "SYNC" : level.label}</small></div>
          <div className="inputRainHud">
            <span>TIME <strong>{remaining.toFixed(1).padStart(4, "0")}</strong></span>
            <span>SCORE <strong>{String(displayStats.score).padStart(5, "0")}</strong></span>
            <span>CHAIN <strong>{displayStats.combo}</strong></span>
            <span>MISS <strong>{displayStats.misses}</strong></span>
          </div>
          {phase === "countdown" ? (
            <div className="inputRainCountdown">
              <canvas ref={attachSky} className="inputRainSky" aria-hidden="true" />
              <span>{countdown}</span><small>{isTerminal ? "INPUT CHANNEL SYNC" : `${genreInfo.label} / ${level.label}`}</small>
            </div>
          ) : (
            <>
              <div className="inputRainLane">
                <canvas ref={attachSky} className="inputRainSky" aria-hidden="true" />
                <div key={promptId} className={`inputRainDrop is-${feedback}`} style={{ "--fall-duration": `${fallDuration}ms` } as React.CSSProperties} onAnimationEnd={(event) => { if (event.target === event.currentTarget && event.animationName === "inputRainFall") handleTimeout(); }}>
                  {inputMode === "keyboard" && <div className="inputRainFurigana">{current?.reading}</div>}
                  <div ref={promptGlyphsRef} className="inputRainPrompt" aria-live="polite">
                    {glyphs.map((glyph, index) => <span key={`${promptId}-${index}`} className="inputRainGlyph" data-glyph={glyph} style={{ "--glyph-index": index } as React.CSSProperties}>{glyph}</span>)}
                  </div>
                  <div className={`inputRainGuide${inputMode === "keyboard" ? " isRomaji" : ""}`}><small>{inputMode === "keyboard" ? "ROMAJI" : "KANA"}</small><span className="isDone">{guide.slice(0, guideProgress)}</span><span>{guide.slice(guideProgress)}</span><i>▋</i></div>
                </div>
                <div ref={particleLayerRef} className="inputRainParticleLayer" aria-hidden="true" />
              </div>
              <div className="inputRainEntry">
                <span>{entryMark}</span>
                <p>{inputMode === "keyboard" ? typed : mobileTyped}<i>▋</i></p>
                <small>{inputMode === "keyboard" ? "KEYBOARD" : "FLICK / KANA"}</small>
              </div>
              {genre === "yoji" ? (
                <div className="inputRainMeaning" aria-live="polite">
                  {lastMeaning ? <><b>{lastMeaning.term}</b><span>{lastMeaning.note}</span></> : <span className="isHint">打ち終えた熟語の意味が、ここに出ます。</span>}
                </div>
              ) : (
                <div className="inputRainStatus"><span>INPUT / {inputMode === "keyboard" ? "ROMAJI" : "KANA"}</span><span>{genreInfo.label} / {level.label}</span><span>{isTerminal ? (feedback === "accepted" ? "ACCEPTED" : feedback === "error" ? "REJECTED" : feedback === "timeout" ? "LOST" : "READY") : (feedback === "accepted" ? "OK" : feedback === "error" ? "MISS" : feedback === "timeout" ? "落ちた" : "入力中")}</span></div>
              )}
              {inputMode === "flick" && (
                <InputRainFlickPad
                  onCommit={appendFlickChar}
                  onMutate={mutateFlickChar}
                  disabled={paused || feedback !== "idle" || phase !== "playing"}
                />
              )}
            </>
          )}
          <GamePauseOverlay active={paused} onResume={resumeGame} onRestart={startRun} onQuit={quitRun} className={`inputRainSkin is-${genre}`} />
        </div>
      )}

      {phase === "complete" && (
        <div className="bitResult inputRainResult">
          <canvas ref={attachSky} className="inputRainSky" aria-hidden="true" />
          <div className={`bitCelebration ${resultMood}`}>
            <div className="bitResultBurst" />
            <div className="bitParticles" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <i key={index} />)}</div>
            <span className="bitCelebrationMark">{result.rank === "SSS" ? "LEGENDARY CLEAR" : isTopRank ? (isTerminal ? "CHANNEL CLEARED" : "CLEAN RUN") : result.rank === "D" ? "RETRY ADVISED" : "RUN COMPLETE"}</span>
          </div>
          <p className="bitResultOverline">INPUT RAIN / {genreInfo.label} / {level.label} / {inputModeLabels[result.inputMode]}</p>
          <div className={`inputRainRankMark ${resultMood}${result.rank === "SSS" ? " is-legendary" : ""}`}>{result.rank}</div>
          <p className="inputRainRankCaption">RANK</p>
          <h2 className="inputRainScoreValue">{result.score.toLocaleString()}</h2>
          <p className="bitScoreLabel">SCORE</p>
          <div className="bitResultStats inputRainResultStats">
            <div><span>INPUTS</span><strong>{result.accepted}</strong></div>
            <div><span>SPEED</span><strong>{result.speed} 字/分</strong></div>
            <div><span>ACCURACY</span><strong>{result.accuracy.toFixed(1)}%</strong></div>
            <div><span>MAX CHAIN</span><strong>{result.maxCombo}</strong></div>
          </div>
          <button type="button" className="bitRetry" onClick={startRun}>同じ設定でもう一度</button>
          <button type="button" className="bitShare" onClick={() => void shareResult()}>結果をシェア</button>
          <XShareButton text={`MarutiBit「INPUT RAIN」\n${genreInfo.label}・${level.label} / SCORE ${result.score.toLocaleString()} / RANK ${result.rank} / ${result.accepted} INPUTS / ACCURACY ${result.accuracy.toFixed(1)}%`} url="https://marutilab.com/bit/input-rain" />
          <button type="button" className="bitChange" onClick={quitRun}>ジャンル・難易度を変える</button>
          <p className="bitShareStatus" aria-live="polite">{shareStatus}</p>
          {trail.length > 0 && (
            <section className={`inputRainTrail is-${genre}`} aria-label="今回の言葉">
              <header><span>今回の言葉</span><small>{typedCount} / {trail.length}</small></header>
              <ol>
                {trail.map((entry, index) => (
                  <li key={index} className={entry.typed ? "isTyped" : "isLost"}>
                    <strong>{entry.text}</strong>
                    {entry.note && <small>{entry.term && entry.term !== entry.text ? `${entry.term}：` : ""}{entry.note}</small>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
