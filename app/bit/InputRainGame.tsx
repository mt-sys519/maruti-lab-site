"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createResultCard } from "./shared/createResultCard";
import { GamePauseOverlay } from "./shared/GamePauseOverlay";
import { useVisibilityPause } from "./shared/useVisibilityPause";
import { inputRainPrompts, type InputRainDifficulty, type InputRainPrompt } from "./inputRainPrompts";
import { useInputRainAudio } from "./useInputRainAudio";
import { spawnDissolve, spawnMaterialize } from "./inputRainParticles";
import { InputRainFlickPad } from "./InputRainFlickPad";
import { isReachableTowards, nextMutation } from "./inputRainFlickMap";

type Phase = "select" | "countdown" | "playing" | "complete";
type InputMode = "keyboard" | "flick";
type PromptFeedback = "idle" | "accepted" | "error" | "timeout";
type Token = { kana: string; opts: string[] };
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
const inputModeLabels: Record<InputMode, string> = { keyboard: "ローマ字入力", flick: "フリック入力" };

const levels: Record<InputRainDifficulty, {
  label: string;
  note: string;
  seconds: number;
  fallBase: number;
  fallPerChar: number;
  scoreFactor: number;
}> = {
  beginner: { label: "初級", note: "短い端末語", seconds: 20, fallBase: 4600, fallPerChar: 250, scoreFactor: 3 },
  intermediate: { label: "中級", note: "短い操作文", seconds: 40, fallBase: 6000, fallPerChar: 210, scoreFactor: 1.6 },
  advanced: { label: "上級", note: "端末ログ", seconds: 60, fallBase: 9000, fallPerChar: 170, scoreFactor: 1 },
  pro: { label: "PRO", note: "長文ログ", seconds: 180, fallBase: 15500, fallPerChar: 150, scoreFactor: 1 / 3 },
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
  const { paused: pagePaused, resume: resumePage } = useVisibilityPause(phase === "playing" || phase === "countdown");
  const paused = manualPaused || pagePaused;
  const {
    enabled: soundEnabled,
    toggle: toggleSound,
    playTypeKey,
    playTypeFlick,
    playBackspace,
    playAccept,
    playMiss,
    playCountdownTick,
    playGo,
    startBgm,
    startResultBgm,
    stopAllLoops,
  } = useInputRainAudio(paused || phase === "select");

  const level = levels[difficulty];
  const tokens = useMemo(() => current ? tokenize(current.reading) : [], [current]);
  const romanGuide = useMemo(() => preferredRoman(tokens, typed), [tokens, typed]);
  const guide = inputMode === "keyboard" ? romanGuide : current?.reading || "";
  const guideProgress = inputMode === "keyboard" ? Math.min(guide.length, typed.length) : Math.min(guide.length, mobileTyped.length);
  const fallDuration = current ? Math.min(15000, level.fallBase + cleanCharacterCount(current.reading) * level.fallPerChar) : level.fallBase;

  useEffect(() => {
    const timer = window.setTimeout(() => {
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

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => () => {
    if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
  }, []);

  const storeBag = useCallback((next: number[]) => {
    try { localStorage.setItem(`marutibit:input-rain:v1:${difficulty}`, JSON.stringify(next)); } catch { /* Optional. */ }
  }, [difficulty]);

  const loadBag = useCallback(() => {
    const pool = inputRainPrompts[difficulty];
    try {
      const saved = JSON.parse(localStorage.getItem(`marutibit:input-rain:v1:${difficulty}`) || "null");
      if (Array.isArray(saved) && saved.every((value) => Number.isInteger(value) && value >= 0 && value < pool.length) && new Set(saved).size === saved.length) return saved as number[];
    } catch { /* Build a fresh bag. */ }
    return shuffle(pool.length);
  }, [difficulty]);

  const pickPrompt = useCallback(() => {
    const pool = inputRainPrompts[difficulty];
    if (!promptBagRef.current.length) promptBagRef.current = loadBag();
    if (!promptBagRef.current.length) promptBagRef.current = shuffle(pool.length);
    const index = promptBagRef.current.pop() ?? 0;
    storeBag(promptBagRef.current);
    return pool[index];
  }, [difficulty, loadBag, storeBag]);

  const nextPrompt = useCallback(() => {
    setCurrent(pickPrompt());
    setPromptId((value) => value + 1);
    setTyped("");
    setMobileTyped("");
    setFeedback("idle");
    fallDeadlineRef.current = 0;
    fallPauseStartedRef.current = 0;
  }, [pickPrompt]);

  const finishRun = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    phaseRef.current = "complete";
    setPhase("complete");
    setManualPaused(false);
    startResultBgm();
    const stats = statsRef.current;
    const speed = Math.round(stats.correctChars / (level.seconds / 60));
    const accuracy = stats.correctChars + stats.misses ? stats.correctChars / (stats.correctChars + stats.misses) * 100 : 0;
    const finalResult = { accepted: stats.accepted, score: stats.score, speed, accuracy, maxCombo: stats.maxCombo, rank: computeRank(stats.score, accuracy, stats.misses), inputMode };
    setResult(finalResult);
    setShareCard(null);
    setShareStatus("");
  }, [inputMode, level.seconds, startResultBgm]);

  // Kept separate from the timer-advance effect below so it fires exactly once per
  // displayed countdown number, not whenever an unrelated dependency changes.
  useEffect(() => {
    if (phase !== "countdown") return;
    playCountdownTick();
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
      gameDescription: "落下する端末入力を処理",
      questions: result.accepted,
      countLabel: "INPUTS",
      level: level.label,
      score: result.score,
      correct: `${result.accepted} INPUTS`,
      time: `${level.seconds} SEC`,
      url,
    }).then((file) => setShareCard(file));
  }, [level.label, level.seconds, phase, result]);

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
    promptBagRef.current = loadBag();
    phaseRef.current = "countdown";
    setPhase("countdown");
    resumePage();
    stopAllLoops();
    window.requestAnimationFrame(() => gameShellRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  }, [level.seconds, loadBag, resumePage, stopAllLoops]);

  const registerInputError = useCallback(() => {
    if (feedback === "error") return;
    statsRef.current.misses += 1;
    statsRef.current.combo = 0;
    setDisplayStats({ ...statsRef.current });
    setFeedback("error");
    playMiss();
    window.setTimeout(() => setFeedback((value) => value === "error" ? "idle" : value), 180);
  }, [feedback, playMiss]);

  const completePrompt = useCallback(() => {
    if (!current || feedback !== "idle" || phaseRef.current !== "playing") return;
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
    setFeedback("accepted");
    playAccept();
    completionTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "playing") nextPrompt();
    }, 190);
  }, [current, feedback, level.scoreFactor, nextPrompt, playAccept]);

  const handleTimeout = useCallback(() => {
    if (phaseRef.current !== "playing" || paused || feedback !== "idle") return;
    statsRef.current.misses += 1;
    statsRef.current.combo = 0;
    setDisplayStats({ ...statsRef.current });
    spawnDissolve(particleLayerRef.current, promptGlyphsRef.current?.querySelectorAll(".inputRainGlyph") ?? [], "miss");
    setFeedback("timeout");
    playMiss();
    completionTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "playing") nextPrompt();
    }, 360);
  }, [feedback, nextPrompt, paused, playMiss]);

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
      if (phaseRef.current !== "playing" || inputMode !== "keyboard" || paused || feedback !== "idle") return;
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
      const character = event.key.toLowerCase();
      if (!/[a-z,.'-]/.test(character)) return;
      event.preventDefault();
      const candidate = typed + character;
      const status = romanStatus(tokens, candidate);
      if (!status.valid) {
        registerInputError();
        return;
      }
      setTyped(candidate);
      playTypeKey();
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
    if (!current || phaseRef.current !== "playing" || inputMode !== "flick" || paused || feedback !== "idle") return;
    const target = normalizeKana(current.reading);
    // Allow any base form on the same dakuten/handakuten/small-kana cycle as the
    // expected character — e.g. base "そ" is a valid step toward target "ぞ", since the
    // mutate key still needs to be pressed to get there.
    const expected = target[mobileTyped.length];
    if (!isReachableTowards(char, expected)) {
      registerInputError();
      return;
    }
    const value = mobileTyped + char;
    playTypeFlick();
    setMobileTyped(value);
    if (value === target) completePrompt();
  }, [completePrompt, current, feedback, inputMode, mobileTyped, paused, playTypeFlick, registerInputError]);

  const deleteFlickChar = useCallback(() => {
    if (phaseRef.current !== "playing" || inputMode !== "flick" || paused || feedback !== "idle") return;
    if (!mobileTyped) return;
    playBackspace();
    setMobileTyped((value) => value.slice(0, -1));
  }, [inputMode, mobileTyped, paused, feedback, playBackspace]);

  const mutateFlickChar = useCallback(() => {
    if (!current || phaseRef.current !== "playing" || inputMode !== "flick" || paused || feedback !== "idle" || !mobileTyped) return;
    const lastChar = mobileTyped.slice(-1);
    const mutated = nextMutation(lastChar);
    if (mutated === lastChar) return;
    const target = normalizeKana(current.reading);
    const expected = target[mobileTyped.length - 1];
    if (!isReachableTowards(mutated, expected)) {
      registerInputError();
      return;
    }
    const candidate = mobileTyped.slice(0, -1) + mutated;
    playTypeFlick();
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
    const text = `PromptTermの端末入力を、文字が落ちきる前に打ち込むタイピングゲーム「INPUT RAIN」。\n${level.label} / ${result.accepted} INPUTS / SCORE ${result.score.toLocaleString()} / RANK ${result.rank}`;
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
  }, [level.label, result, shareCard]);

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

  return (
    <section ref={gameShellRef} className="bitGameShell inputRainGameShell" data-card-ready={shareCard ? "true" : "false"}>
      <div className="bitGameControls">
        <button type="button" className={`bitSound${soundEnabled ? " isOn" : ""}`} onClick={() => void toggleSound()} aria-pressed={soundEnabled}>
          <span className="bitSoundBars" aria-hidden="true"><i /><i /><i /></span>SOUND <strong>{soundEnabled ? "ON" : "OFF"}</strong>
        </button>
        {phase === "playing" && <button type="button" className="bitQuit" onClick={() => setManualPaused(true)}>一時停止 / やめる</button>}
      </div>

      {phase === "select" && (
        <>
          <div className="bitSelectHead"><span>SELECT LEVEL</span><strong>{Object.keys(levels).length} MODES</strong></div>
          <div className="inputRainTerminal inputRainTerminalPreview" aria-label="ゲーム説明">
            <div className="inputRainChrome"><b>Pt</b><span>PROMPTTERM / INPUT CHANNEL</span><small>STANDBY</small></div>
            <div className="inputRainReady">
              <span className="inputRainPromptMark" aria-hidden="true"><i /><i /><i /></span>
              <p>PT&gt; INPUT CHANNEL ARMED<span className="inputRainCursor">▋</span></p>
              <small>表示された日本語を、文字が落ちきる前に入力。</small>
            </div>
            <div className="inputRainStatus"><span>MODE / AUTO</span><span>RAIN / GLYPH ONLY</span><span>READY</span></div>
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
                {levels[key].label}<small>{levels[key].seconds} SEC / {levels[key].note}</small>
              </button>
            ))}
          </div>
          <button type="button" className="bitStart" onClick={startRun}>START<small className="inputRainSpaceHint">SPACE TO START</small></button>
          <p className="bitRule">入力方式はこの端末に記憶され、次回も同じ設定で始まります。物理キーボードを接続した場合は「キーボード」を選んでください。</p>
        </>
      )}

      {(phase === "countdown" || phase === "playing") && (
        <div className={`inputRainTerminal${paused ? " isPaused" : ""}${feedback === "error" ? " isError" : ""}${difficulty === "pro" ? " isPro" : ""}`}>
          <div className="inputRainChrome"><b>Pt</b><span>PROMPTTERM / INPUT RAIN</span><small>{phase === "countdown" ? "SYNC" : level.label}</small></div>
          <div className="inputRainHud">
            <span>TIME <strong>{remaining.toFixed(1).padStart(4, "0")}</strong></span>
            <span>SCORE <strong>{String(displayStats.score).padStart(5, "0")}</strong></span>
            <span>CHAIN <strong>{displayStats.combo}</strong></span>
            <span>MISS <strong>{displayStats.misses}</strong></span>
          </div>
          {phase === "countdown" ? (
            <div className="inputRainCountdown"><span>{countdown}</span><small>INPUT CHANNEL SYNC</small></div>
          ) : (
            <>
              <div className="inputRainLane">
                <div key={promptId} className={`inputRainDrop is-${feedback}`} style={{ "--fall-duration": `${fallDuration}ms` } as React.CSSProperties} onAnimationEnd={(event) => { if (event.target === event.currentTarget && event.animationName === "inputRainFall") handleTimeout(); }}>
                  <div ref={promptGlyphsRef} className="inputRainPrompt" aria-live="polite">
                    {glyphs.map((glyph, index) => <span key={`${promptId}-${index}`} className="inputRainGlyph" data-glyph={glyph} style={{ "--glyph-index": index } as React.CSSProperties}>{glyph}</span>)}
                  </div>
                  <div className="inputRainGuide"><small>{inputMode === "keyboard" ? "ROMAJI" : "KANA"}</small><span className="isDone">{guide.slice(0, guideProgress)}</span><span>{guide.slice(guideProgress)}</span><i>▋</i></div>
                </div>
                <div ref={particleLayerRef} className="inputRainParticleLayer" aria-hidden="true" />
              </div>
              <div className="inputRainEntry">
                <span>PT&gt;</span>
                <p>{inputMode === "keyboard" ? typed : mobileTyped}<i>▋</i></p>
                <small>{inputMode === "keyboard" ? "KEYBOARD" : "FLICK / KANA"}</small>
              </div>
              <div className="inputRainStatus"><span>INPUT / {inputMode === "keyboard" ? "ROMAJI" : "KANA"}</span><span>ACCEPT / LIVE</span><span>{feedback === "accepted" ? "ACCEPTED" : feedback === "error" ? "REJECTED" : feedback === "timeout" ? "LOST" : "READY"}</span></div>
              {inputMode === "flick" && (
                <InputRainFlickPad
                  onCommit={appendFlickChar}
                  onDelete={deleteFlickChar}
                  onMutate={mutateFlickChar}
                  disabled={paused || feedback !== "idle" || phase !== "playing"}
                />
              )}
            </>
          )}
          <GamePauseOverlay active={paused} onResume={resumeGame} onRestart={startRun} onQuit={quitRun} />
        </div>
      )}

      {phase === "complete" && (
        <div className="bitResult inputRainResult">
          <div className={`bitCelebration ${resultMood}`}>
            <div className="bitResultBurst" />
            <div className="bitParticles" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <i key={index} />)}</div>
            <span className="bitCelebrationMark">{result.rank === "SSS" ? "LEGENDARY CLEAR" : isTopRank ? "CHANNEL CLEARED" : result.rank === "D" ? "RETRY ADVISED" : "RUN COMPLETE"}</span>
          </div>
          <p className="bitResultOverline">INPUT RAIN / {level.label} / {inputModeLabels[result.inputMode]}</p>
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
          <button type="button" className="bitRetry" onClick={startRun}>同じ難易度でもう一度</button>
          <button type="button" className="bitShare" onClick={() => void shareResult()}>結果をシェア</button>
          <button type="button" className="bitChange" onClick={quitRun}>難易度を変える</button>
          <p className="bitShareStatus" aria-live="polite">{shareStatus}</p>
        </div>
      )}
    </section>
  );
}
