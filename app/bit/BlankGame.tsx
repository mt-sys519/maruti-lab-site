"use client";

import { useEffect, useRef, useState } from "react";
import { createResultCard } from "./shared/createResultCard";
import { GamePauseOverlay } from "./shared/GamePauseOverlay";
import { createUniqueQuestionSession, loadRecentQuestionSignatures, rememberQuestionSignatures } from "./shared/questionSession";
import { useVisibilityPause } from "./shared/useVisibilityPause";
import { useMathSeriesAudio } from "./useMathSeriesAudio";
import { blankProblemSignature, makeBlankProblem, tutorials, type Difficulty, type Problem } from "./blankProblems";

type Phase = "select" | "playing" | "answered" | "complete";

const TOTAL_QUESTIONS = 5;
const levelNames: Record<Difficulty, string> = { beginner: "初級", intermediate: "中級", advanced: "上級" };
const levelNotes: Record<Difficulty, string> = { beginner: "1段階 / 四則演算", intermediate: "2段階 / 計算順序", advanced: "3段階 / 括弧あり" };
const emptyBest: Record<Difficulty, number> = { beginner: 0, intermediate: 0, advanced: 0 };
const initialProblem = tutorials.beginner;

function Expression({ problem }: { problem: Problem }) {
  return (
    <div className="bitBlankExpression" role="img" aria-label={problem.spoken}>
      {problem.tokens.map((token, index) => token === "?"
        ? <em key={`${token}-${index}`}>?</em>
        : <span className={token === "(" || token === ")" ? "isParen" : ""} key={`${token}-${index}`}>{token}</span>)}
    </div>
  );
}

export function BlankGame() {
  const gameShellRef = useRef<HTMLElement>(null);
  const answerPadRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<Problem[]>([initialProblem]);
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [phase, setPhase] = useState<Phase>("select");
  const [problem, setProblem] = useState<Problem>(initialProblem);
  const [question, setQuestion] = useState(0);
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState(0);
  const [score, setScore] = useState(0);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [lastError, setLastError] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [best, setBest] = useState<Record<Difficulty, number>>(emptyBest);
  const [shareStatus, setShareStatus] = useState("");
  const [shareCard, setShareCard] = useState<File | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const { paused: pagePaused, resume: resumePage } = useVisibilityPause(phase !== "select");
  const { enabled: soundEnabled, toggle: toggleSound, playAnswer, playTap, resume: resumeAudio } = useMathSeriesAudio(phase === "complete" ? "result" : "thinking", pagePaused);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("marutibit:blank:best") || "null");
        if (saved) setBest({ ...emptyBest, ...saved });
      } catch { /* Local records are optional. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "playing" || pagePaused) return;
    const update = () => setElapsed(Date.now() - startedAt);
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [pagePaused, phase, startedAt]);

  useEffect(() => {
    if (phase !== "playing") return;
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const shell = gameShellRef.current;
      const answerPad = answerPadRef.current;
      if (!shell || !answerPad) return;
      const shellTop = window.scrollY + shell.getBoundingClientRect().top - 12;
      const answerBottom = window.scrollY + answerPad.getBoundingClientRect().bottom + 12;
      window.scrollTo({ top: Math.max(shellTop, answerBottom - window.innerHeight), behavior: reducedMotion ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase, question]);

  useEffect(() => {
    if (phase !== "complete") return;
    const duration = 900;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setAnimatedScore(Math.round(score * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, score]);

  useEffect(() => {
    if (phase !== "complete") return;
    let cancelled = false;
    void createResultCard({
      series: "MarutiBit", gameNumber: "GAME 002", gameTitle: "BLANK",
      gameDescription: "四則演算の空欄を逆算するゲーム", questions: TOTAL_QUESTIONS,
      level: levelNames[difficulty], score, correct: `${correct} / ${TOTAL_QUESTIONS}`,
      time: `${(totalTime / 1000).toFixed(1)}s`, url: "https://marutilab.com/bit/blank",
    }).then((file) => { if (!cancelled) setShareCard(file); });
    return () => { cancelled = true; };
  }, [correct, difficulty, phase, score, totalTime]);

  const begin = (level = difficulty) => {
    const historyKey = `marutibit:blank:recent:${level}`;
    const recent = loadRecentQuestionSignatures(historyKey);
    const session = createUniqueQuestionSession({
      count: TOTAL_QUESTIONS,
      recentSignatures: recent,
      tutorial: tutorials[level],
      create: (index) => makeBlankProblem(level, index),
      signature: blankProblemSignature,
    });
    sessionRef.current = session.questions;
    rememberQuestionSignatures(historyKey, session.signatures, recent);
    setDifficulty(level); setProblem(session.questions[0]); setQuestion(0); setAnswer("");
    setCorrect(0); setScore(0); setLastCorrect(false); setLastError(0); setElapsed(0);
    setTotalTime(0); setShareStatus(""); setShareCard(null); setAnimatedScore(0);
    setStartedAt(Date.now()); setPhase("playing"); playTap("action");
  };

  const quit = () => { playTap("action"); setAnswer(""); setPhase("select"); };

  const submit = () => {
    if (!answer || phase !== "playing") return;
    const value = Number(answer);
    const isCorrect = value === problem.answer;
    const error = Math.abs(value - problem.answer);
    const answerElapsed = Date.now() - startedAt;
    const speedBonus = isCorrect ? Math.max(0, 500 - Math.floor(answerElapsed / 1000) * 20) : 0;
    setElapsed(answerElapsed); setTotalTime((current) => current + answerElapsed);
    playAnswer(isCorrect); setLastCorrect(isCorrect); setLastError(error);
    setCorrect((current) => current + (isCorrect ? 1 : 0));
    setScore((current) => current + (isCorrect ? 1000 + speedBonus : 0));
    setPhase("answered");
  };

  const next = () => {
    playTap("action");
    if (question === TOTAL_QUESTIONS - 1) {
      const updated = { ...best, [difficulty]: Math.max(best[difficulty], score) };
      setBest(updated);
      try { localStorage.setItem("marutibit:blank:best", JSON.stringify(updated)); } catch { /* Local storage is optional. */ }
      setPhase("complete");
      return;
    }
    setQuestion((current) => current + 1); setProblem(sessionRef.current[question + 1]);
    setAnswer(""); setElapsed(0); setStartedAt(Date.now()); setPhase("playing");
  };

  const addDigit = (digit: string) => {
    if (phase !== "playing") return;
    setAnswer((current) => `${current}${digit}`.replace(/^0+(?=\d)/, "").slice(0, 3));
    playTap("key");
  };
  const removeDigit = () => { if (phase === "playing") { setAnswer((current) => current.slice(0, -1)); playTap("key"); } };

  const share = async () => {
    playTap("action");
    const title = "MarutiBit「BLANK」";
    const text = `${title}\n四則演算の空欄を逆算する${TOTAL_QUESTIONS}問チャレンジ｜${levelNames[difficulty]}\nSCORE ${score} / ${correct} CORRECT / TIME ${(totalTime / 1000).toFixed(1)}s`;
    const url = "https://marutilab.com/bit/blank";
    const shareText = `${text}\n${url}`;
    try {
      if (navigator.share) {
        let canShareCard = false;
        if (shareCard && typeof navigator.canShare === "function") {
          try { canShareCard = navigator.canShare({ files: [shareCard] }); } catch { /* Fall back to text sharing. */ }
        }
        await navigator.share(canShareCard ? { files: [shareCard], title, text: shareText } : { title, text: shareText });
        setShareStatus(canShareCard ? "結果カードを共有しました" : "結果を共有しました");
      } else {
        await navigator.clipboard.writeText(shareText);
        setShareStatus("結果をコピーしました");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setShareStatus("共有できませんでした");
    }
  };

  const resumeFromPause = async () => {
    const pausedFor = resumePage();
    if (!pausedFor) return;
    if (phase === "playing") setStartedAt((current) => current + pausedFor);
    await resumeAudio(); playTap("action");
  };

  const soundButton = (
    <button className={`bitSound ${soundEnabled ? "isOn" : ""}`} type="button" aria-pressed={soundEnabled} onClick={() => { void toggleSound(); }}>
      <span className="bitSoundBars" aria-hidden="true"><i /><i /><i /></span>SOUND <strong>{soundEnabled ? "ON" : "OFF"}</strong>
    </button>
  );
  const pauseOverlay = <GamePauseOverlay active={pagePaused} onResume={() => { void resumeFromPause(); }} />;
  const resultTier = correct === TOTAL_QUESTIONS ? "excellent" : correct >= 3 ? "good" : "retry";
  const resultTitle = resultTier === "excellent" ? "EXCELLENT" : resultTier === "good" ? "GOOD RUN" : "NEXT TRY";

  if (phase === "select") {
    return (
      <section className="bitGameShell" aria-label="BLANKゲーム">
        {pauseOverlay}{soundButton}
        <div className="bitSelectHead"><span>SELECT LEVEL</span><strong>{TOTAL_QUESTIONS} QUESTIONS</strong></div>
        <div className="bitGameSummary">
          <div className="bitExampleEquation" aria-label="12足す空欄は20"><span>12</span><b>＋</b><em>?</em><b>＝</b><span>20</span></div>
          <div><strong>式の「？」を逆算する。</strong><p>一段階の四則演算から、計算順序と括弧を使う問題へ進む全5問の計算パズルです。</p></div>
        </div>
        <div className="bitModeSelect" aria-label="難易度を選択">
          {(Object.keys(levelNames) as Difficulty[]).map((level) => (
            <button key={level} type="button" className={difficulty === level ? "isActive" : ""} onClick={() => { playTap("key"); setDifficulty(level); }}>
              {levelNames[level]}<small>{levelNotes[level]}</small>
            </button>
          ))}
        </div>
        <button className="bitStart" type="button" onClick={() => begin()}>START</button>
        <p className="bitRule">空欄は1つ。答えはすべて正の整数です。正解と回答速度でスコアが決まります。</p>
      </section>
    );
  }

  if (phase === "complete") {
    return (
      <section className="bitGameShell bitResult" aria-labelledby="blank-result-title">
        {pauseOverlay}{soundButton}
        <div className={`bitCelebration is-${resultTier}`} aria-hidden="true"><i className="bitResultBurst" /><div className="bitCelebrationMark">{resultTitle}</div><div className="bitParticles">{Array.from({ length: 20 }, (_, index) => <i key={index} />)}</div></div>
        <p className="bitResultOverline">RESULT / {levelNames[difficulty]}</p>
        <h2 id="blank-result-title">{animatedScore.toLocaleString()}</h2><p className="bitScoreLabel">SCORE</p>
        <div className="bitResultStats"><div><span>CORRECT</span><strong>{correct} / {TOTAL_QUESTIONS}</strong></div><div><span>TIME</span><strong>{(totalTime / 1000).toFixed(1)}s</strong></div><div><span>BEST</span><strong>{Math.max(best[difficulty], score).toLocaleString()}</strong></div></div>
        <button className="bitRetry" type="button" onClick={() => begin(difficulty)}>もう一度</button>
        <button className="bitShare" type="button" data-card-ready={shareCard ? "true" : "false"} onClick={share}>結果カードをシェア</button>
        <button className="bitChange" type="button" onClick={() => setPhase("select")}>難易度を変える</button>
        <p className="bitShareStatus" aria-live="polite">{shareStatus}</p>
      </section>
    );
  }

  return (
    <section ref={gameShellRef} className="bitGameShell" aria-label="BLANKゲーム">
      {pauseOverlay}
      <div className="bitGameControls">{soundButton}<button className="bitQuit" type="button" onClick={quit}>ゲームをやめる</button></div>
      <div className="bitGameTop"><div><span>LEVEL</span><strong>{levelNames[difficulty]}</strong></div><div><span>QUESTION</span><strong>{String(question + 1).padStart(2, "0")} / 05</strong></div><div><span>SCORE</span><strong>{score.toLocaleString()}</strong></div></div>
      <div className="bitBlankBoard"><Expression problem={problem} /></div>
      {phase === "answered" ? (
        <div className={`bitAnswerResult ${lastCorrect ? "isCorrect" : "isWrong"}`} aria-live="polite">
          <div className="bitVerdict"><b className="bitJudgeMark" aria-hidden="true">{lastCorrect ? "○" : "×"}</b><span>{lastCorrect ? "CORRECT" : "NOT QUITE"}</span><strong>{problem.answer}</strong>{!lastCorrect ? <small>差 {lastError}</small> : null}</div>
          <ol>{problem.explanation.map((step) => <li key={step}>{step}</li>)}</ol>
          <button type="button" onClick={next}>{question === TOTAL_QUESTIONS - 1 ? "結果を見る" : "次の問題"}</button>
        </div>
      ) : (
        <div ref={answerPadRef} className="bitAnswerPad">
          <div className="bitInputRow"><label htmlFor="blank-answer">ANSWER</label><div><input id="blank-answer" value={answer} onChange={(event) => setAnswer(event.target.value.replace(/\D/g, "").slice(0, 3))} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-label="空欄に入る数字" /></div><time>{(elapsed / 1000).toFixed(1)}s</time></div>
          <div className="bitKeypad" aria-label="数字入力">{[1,2,3,4,5,6,7,8,9].map((digit) => <button key={digit} type="button" onClick={() => addDigit(String(digit))}>{digit}</button>)}<button type="button" aria-label="一文字削除" onClick={removeDigit}>⌫</button><button type="button" onClick={() => addDigit("0")}>0</button><button className="bitSubmit" type="button" onClick={submit} disabled={!answer}>決定</button></div>
        </div>
      )}
    </section>
  );
}
