"use client";

import { useEffect, useRef, useState } from "react";
import { useMathSeriesAudio } from "./useMathSeriesAudio";

type Difficulty = "beginner" | "intermediate" | "advanced";
type Phase = "select" | "playing" | "answered" | "complete";
type Point = { x: number; y: number };

type SingleProblem = {
  difficulty: "beginner";
  layout: "single";
  left: number;
  right: number;
  answer: number;
  explanation: string[];
};

type ChainProblem = {
  difficulty: "intermediate" | "advanced";
  layout: "chain";
  a: number;
  c: number;
  d: number;
  b: number;
  e: number;
  h?: number;
  answer: number;
  explanation: string[];
};

type Problem = SingleProblem | ChainProblem;

const TOTAL_QUESTIONS = 5;
const levelNames: Record<Difficulty, string> = { beginner: "初級", intermediate: "中級", advanced: "上級" };
const levelNotes: Record<Difficulty, string> = { beginner: "1段階", intermediate: "2段階", advanced: "3段階" };
const emptyBest: Record<Difficulty, number> = { beginner: 0, intermediate: 0, advanced: 0 };

const initialProblem: SingleProblem = {
  difficulty: "beginner",
  layout: "single",
  left: 60,
  right: 50,
  answer: 70,
  explanation: ["三角形の内角の和は180°", "x = 180° − 60° − 50°", "x = 70°"],
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomStep(min: number, max: number, step: number) {
  return randomInt(Math.ceil(min / step), Math.floor(max / step)) * step;
}

function checkedProblem(problem: Problem): Problem {
  const valid = problem.layout === "single"
    ? problem.left + problem.right + problem.answer === 180
    : problem.a + problem.c + problem.d === 180
      && problem.d + problem.b + problem.e === 180
      && (problem.difficulty === "intermediate"
        ? problem.answer === problem.e
        : problem.h !== undefined && problem.e + problem.h + problem.answer === 180);
  if (!valid || problem.answer <= 0 || problem.answer >= 180) throw new Error("Invalid ANGLE problem geometry");
  return problem;
}

function makeProblem(difficulty: Difficulty, questionIndex: number): Problem {
  if (questionIndex === 0) {
    if (difficulty === "intermediate") {
      return checkedProblem({
        difficulty,
        layout: "chain",
        a: 50,
        c: 60,
        d: 70,
        b: 50,
        e: 60,
        answer: 60,
        explanation: [
          "左の三角形：D = 180° − 50° − 60° = 70°",
          "交差する2直線の対頂角は等しいので、右のDも70°",
          "右の三角形：x = 180° − 70° − 50° = 60°",
        ],
      });
    }
    if (difficulty === "advanced") {
      return checkedProblem({
        difficulty,
        layout: "chain",
        a: 50,
        c: 60,
        d: 70,
        b: 50,
        e: 60,
        h: 40,
        answer: 80,
        explanation: [
          "左の三角形からDを70°と求め、対頂角で中央へ移す",
          "中央の三角形：E = 180° − 70° − 50° = 60°",
          "Eの対頂角も60°。右の三角形：x = 180° − 60° − 40° = 80°",
        ],
      });
    }
    return initialProblem;
  }

  const step = questionIndex === 1 ? 10 : questionIndex === 2 ? 5 : 1;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (difficulty === "beginner") {
      const left = randomStep(30, 75, step);
      const right = randomStep(30, 75, step);
      const answer = 180 - left - right;
      if (answer >= 30 && answer <= 105) {
        return checkedProblem({ difficulty, layout: "single", left, right, answer, explanation: ["三角形の内角の和は180°", `x = 180° − ${left}° − ${right}°`, `x = ${answer}°`] });
      }
      continue;
    }

    const a = randomStep(35, 70, step);
    const c = randomStep(35, 70, step);
    const d = 180 - a - c;
    const b = randomStep(35, 70, step);
    const e = 180 - d - b;
    if (d < 35 || d > 100 || e < 30 || e > 100) continue;

    if (difficulty === "intermediate") {
      return checkedProblem({
        difficulty,
        layout: "chain",
        a, c, d, b, e, answer: e,
        explanation: [
          `左の三角形：D = 180° − ${a}° − ${c}° = ${d}°`,
          `対頂角は等しいので、右のDも${d}°`,
          `右の三角形：x = 180° − ${d}° − ${b}° = ${e}°`,
        ],
      });
    }

    const h = randomStep(30, 70, step);
    const answer = 180 - e - h;
    if (answer >= 25 && answer <= 105) {
      return checkedProblem({
        difficulty,
        layout: "chain",
        a, c, d, b, e, h, answer,
        explanation: [
          `左の三角形からDを${d}°と求め、対頂角で中央へ移す`,
          `中央の三角形：E = 180° − ${d}° − ${b}° = ${e}°`,
          `Eの対頂角も${e}°。右の三角形：x = 180° − ${e}° − ${h}° = ${answer}°`,
        ],
      });
    }
  }

  return makeProblem(difficulty, 0);
}

function AngleDiagram({ problem }: { problem: Problem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const rad = (degrees: number) => degrees * Math.PI / 180;
      const polar = (origin: Point, degrees: number, length: number): Point => ({ x: origin.x + Math.cos(rad(degrees)) * length, y: origin.y + Math.sin(rad(degrees)) * length });
      const segments: Array<[Point, Point]> = [];
      const labels: Array<{ vertex: Point; p1: Point; p2: Point; text?: string; unknown?: boolean; transfer?: boolean }> = [];
      let points: Point[] = [];

      if (problem.layout === "single") {
        const A = { x: 0, y: 0 };
        const B = { x: 1, y: 0 };
        const height = (Math.tan(rad(problem.left)) * Math.tan(rad(problem.right))) / (Math.tan(rad(problem.left)) + Math.tan(rad(problem.right)));
        const C = { x: height / Math.tan(rad(problem.left)), y: -height };
        points = [A, B, C];
        segments.push([A, B], [A, C], [B, C]);
        labels.push(
          { vertex: A, p1: B, p2: C, text: `${problem.left}°` },
          { vertex: B, p1: A, p2: C, text: `${problem.right}°` },
          { vertex: C, p1: A, p2: B, unknown: true },
        );
      } else {
        const D = { x: 0, y: 0 };
        const B = { x: 1, y: 0 };
        const A = { x: -0.88, y: 0 };
        const C = polar(D, 180 + problem.d, 0.88 * Math.sin(rad(problem.a)) / Math.sin(rad(problem.c)));
        const E = polar(D, problem.d, Math.sin(rad(problem.b)) / Math.sin(rad(problem.e)));
        points = [A, C, D, B, E];
        segments.push([A, C], [C, D], [D, A], [D, E], [E, B], [B, D]);
        labels.push(
          { vertex: A, p1: D, p2: C, text: `${problem.a}°` },
          { vertex: C, p1: A, p2: D, text: `${problem.c}°` },
          { vertex: D, p1: A, p2: C, transfer: true },
          { vertex: D, p1: B, p2: E, transfer: true },
          { vertex: B, p1: D, p2: E, text: `${problem.b}°` },
        );
        if (problem.difficulty === "intermediate") {
          labels.push({ vertex: E, p1: D, p2: B, unknown: true });
        } else {
          const h = problem.h ?? 40;
          const H = polar(E, problem.d, 0.9);
          const G = polar(E, 180 - problem.b, 0.9 * Math.sin(rad(h)) / Math.sin(rad(problem.answer)));
          points.push(H, G);
          segments.push([E, H], [H, G], [G, E]);
          labels.push(
            { vertex: E, p1: D, p2: B, transfer: true },
            { vertex: E, p1: H, p2: G, transfer: true },
            { vertex: H, p1: E, p2: G, text: `${h}°` },
            { vertex: G, p1: E, p2: H, unknown: true },
          );
        }
      }

      const minX = Math.min(...points.map((point) => point.x));
      const maxX = Math.max(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y));
      const maxY = Math.max(...points.map((point) => point.y));
      const rawWidth = Math.max(0.1, maxX - minX);
      const rawHeight = Math.max(0.1, maxY - minY);
      // Labels sit up to 55px beyond their vertices, so the annotation area
      // needs its own safety margin in addition to the geometry bounds.
      const padX = Math.max(82, rect.width * 0.14);
      const padY = Math.max(78, rect.height * 0.18);
      const scale = Math.min((rect.width - padX * 2) / rawWidth, (rect.height - padY * 2) / rawHeight);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const map = (point: Point): Point => ({ x: rect.width / 2 + (point.x - centerX) * scale, y: rect.height / 2 + (point.y - centerY) * scale });

      ctx.strokeStyle = "#183d55";
      ctx.lineWidth = Math.max(1.7, rect.width / 430);
      ctx.lineCap = "round";
      ctx.beginPath();
      segments.forEach(([from, to]) => {
        const a = map(from);
        const b = map(to);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      });
      ctx.stroke();

      const shortArc = (vertex: Point, p1: Point, p2: Point, radius: number, color: string) => {
        const start = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
        const end = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
        let delta = end - start;
        while (delta <= -Math.PI) delta += Math.PI * 2;
        while (delta > Math.PI) delta -= Math.PI * 2;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.arc(vertex.x, vertex.y, radius, start, start + delta, delta < 0);
        ctx.stroke();
        ctx.restore();
        return start + delta / 2;
      };

      const roundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      };

      const labelSize = Math.max(12, Math.min(17, rect.width / 31));
      const drawTag = (text: string, x: number, y: number) => {
        ctx.save();
        ctx.font = `600 ${labelSize}px "Yu Gothic UI", sans-serif`;
        const width = ctx.measureText(text).width + 14;
        const height = labelSize + 10;
        const safeX = Math.max(width / 2 + 4, Math.min(rect.width - width / 2 - 4, x));
        const safeY = Math.max(height / 2 + 4, Math.min(rect.height - height / 2 - 4, y));
        roundedRect(safeX - width / 2, safeY - height / 2, width, height, 4);
        ctx.fillStyle = "rgba(241,238,229,.97)";
        ctx.fill();
        ctx.strokeStyle = "rgba(24,61,85,.22)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#183d55";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, safeX, safeY + 1);
        ctx.restore();
      };

      labels.forEach((label) => {
        const vertex = map(label.vertex);
        const p1 = map(label.p1);
        const p2 = map(label.p2);
        if (label.transfer) {
          shortArc(vertex, p1, p2, 17, "rgba(24,61,85,.72)");
          shortArc(vertex, p1, p2, 22, "rgba(24,61,85,.72)");
          return;
        }
        const middle = shortArc(vertex, p1, p2, 24, label.unknown ? "#a94235" : "#183d55");
        const distance = label.unknown ? 55 : 52;
        // Known values stay beside the interior arc. The question marker sits
        // outside the vertex so it can never cover a value inside the figure.
        const direction = label.unknown ? -1 : 1;
        const rawX = vertex.x + Math.cos(middle) * distance * direction;
        const rawY = vertex.y + Math.sin(middle) * distance * direction;
        if (label.unknown) {
          const x = Math.max(26, Math.min(rect.width - 26, rawX));
          const y = Math.max(26, Math.min(rect.height - 26, rawY));
          ctx.fillStyle = "rgba(241,238,229,.98)";
          ctx.beginPath();
          ctx.arc(x, y, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#a94235";
          ctx.beginPath();
          ctx.arc(x, y, 17, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "700 18px \"Yu Gothic UI\", sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", x, y + 1);
        } else if (label.text) {
          drawTag(label.text, rawX, rawY);
        }
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [problem]);

  const description = problem.layout === "single"
    ? `三角形の底角が${problem.left}度と${problem.right}度。残りの角度を求めます。`
    : problem.difficulty === "intermediate"
      ? `対頂角でつながる2つの三角形。${problem.a}度、${problem.c}度、${problem.b}度から最後の角度を求めます。`
      : "2組の対頂角でつながる3つの三角形。左から順に角度を求めます。";
  return <canvas ref={canvasRef} className="angleCanvas" role="img" aria-label={description} />;
}

export function AngleGame() {
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
  const [animatedScore, setAnimatedScore] = useState(0);
  const { enabled: soundEnabled, toggle: toggleSound, playAnswer, playTap } = useMathSeriesAudio(phase === "complete" ? "result" : "thinking");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("marutibit:angle:best") || "null");
        if (saved) setBest({ ...emptyBest, ...saved });
      } catch { /* Local records are optional. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const update = () => setElapsed(Date.now() - startedAt);
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(() => {
    if (phase !== "complete") return;
    const duration = 900;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(score * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, score]);

  const begin = (level = difficulty) => {
    setDifficulty(level);
    setProblem(makeProblem(level, 0));
    setQuestion(0);
    setAnswer("");
    setCorrect(0);
    setScore(0);
    setLastCorrect(false);
    setLastError(0);
    setElapsed(0);
    setTotalTime(0);
    setShareStatus("");
    setAnimatedScore(0);
    setStartedAt(Date.now());
    setPhase("playing");
    playTap("action");
  };

  const quit = () => {
    playTap("action");
    setAnswer("");
    setPhase("select");
  };

  const submit = () => {
    if (!answer || phase !== "playing") return;
    const value = Number(answer);
    const isCorrect = value === problem.answer;
    const error = Math.abs(value - problem.answer);
    const answerElapsed = Date.now() - startedAt;
    const speedBonus = isCorrect ? Math.max(0, 500 - Math.floor(answerElapsed / 1000) * 20) : 0;
    setElapsed(answerElapsed);
    setTotalTime((current) => current + answerElapsed);
    playAnswer(isCorrect);
    setLastCorrect(isCorrect);
    setLastError(error);
    setCorrect((current) => current + (isCorrect ? 1 : 0));
    setScore((current) => current + (isCorrect ? 1000 + speedBonus : 0));
    setPhase("answered");
  };

  const next = () => {
    playTap("action");
    if (question === TOTAL_QUESTIONS - 1) {
      const nextBest = Math.max(best[difficulty], score);
      const updated = { ...best, [difficulty]: nextBest };
      setBest(updated);
      try { localStorage.setItem("marutibit:angle:best", JSON.stringify(updated)); } catch { /* Local storage is optional. */ }
      setPhase("complete");
      return;
    }
    setQuestion((current) => current + 1);
    setProblem(makeProblem(difficulty, question + 1));
    setAnswer("");
    setElapsed(0);
    setStartedAt(Date.now());
    setPhase("playing");
  };

  const addDigit = (digit: string) => {
    if (phase !== "playing") return;
    playTap("key");
    setAnswer((current) => `${current}${digit}`.replace(/^0+(?=\d)/, "").slice(0, 3));
  };

  const removeDigit = () => {
    if (phase !== "playing") return;
    playTap("key");
    setAnswer((current) => current.slice(0, -1));
  };

  const share = async () => {
    playTap("action");
    const text = `MarutiBit「TRIANGLE」${levelNames[difficulty]}\nSCORE ${score} / ${correct} CORRECT / TIME ${(totalTime / 1000).toFixed(1)}s`;
    const url = "https://marutilab.com/bit";
    const shareText = `${text}\n${url}`;
    try {
      if (navigator.share) {
        // Some share targets discard `text` when `url` is supplied separately.
        // A single text payload keeps the score and URL together everywhere.
        await navigator.share({ text: shareText });
        setShareStatus("共有しました");
      } else {
        await navigator.clipboard.writeText(shareText);
        setShareStatus("結果をコピーしました");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setShareStatus("共有できませんでした");
    }
  };

  const soundButton = (
    <button className={`bitSound ${soundEnabled ? "isOn" : ""}`} type="button" aria-pressed={soundEnabled} onClick={() => { void toggleSound(); }}>
      <span className="bitSoundBars" aria-hidden="true"><i /><i /><i /></span>
      SOUND <strong>{soundEnabled ? "ON" : "OFF"}</strong>
    </button>
  );
  const gameControls = <div className="bitGameControls">{soundButton}<button className="bitQuit" type="button" onClick={quit}>ゲームをやめる</button></div>;
  const resultTier = correct === TOTAL_QUESTIONS ? "excellent" : correct >= 3 ? "good" : "retry";
  const resultTitle = resultTier === "excellent" ? "EXCELLENT" : resultTier === "good" ? "GOOD RUN" : "NEXT TRY";

  if (phase === "select") {
    return (
      <section className="bitGameShell" aria-label="ANGLEゲーム">
        {soundButton}
        <div className="bitSelectHead"><span>SELECT LEVEL</span><strong>5 QUESTIONS</strong></div>
        <div className="bitGameSummary">
          <div className="bitExampleEquation" aria-label="60度 足す 50度 足す 未知の角度は 180度"><span>60°</span><b>＋</b><span>50°</span><b>＋</b><em>?</em><b>＝</b><span>180°</span></div>
          <div><strong>三角形の「？」を求める。</strong><p>示された角度を手がかりに、左から順に解いていく全5問の図形パズルです。</p></div>
        </div>
        <div className="bitModeSelect" aria-label="難易度を選択">
          {(Object.keys(levelNames) as Difficulty[]).map((level) => (
            <button key={level} type="button" className={difficulty === level ? "isActive" : ""} onClick={() => { playTap("key"); setDifficulty(level); }}>
              {levelNames[level]}<small>{levelNotes[level]} / 三角形 {level === "beginner" ? "1" : level === "intermediate" ? "2" : "3"}つ</small>
            </button>
          ))}
        </div>
        <button className="bitStart" type="button" onClick={() => begin()}>START</button>
        <p className="bitRule">初級は内角の和、中級・上級は対頂角を使います。正解と回答速度でスコアが決まります。</p>
      </section>
    );
  }

  if (phase === "complete") {
    return (
      <section className="bitGameShell bitResult" aria-labelledby="bit-result-title">
        {soundButton}
        <div className={`bitCelebration is-${resultTier}`} aria-hidden="true">
          <i className="bitResultBurst" />
          <div className="bitCelebrationMark">{resultTitle}</div>
          <div className="bitParticles">{Array.from({ length: 20 }, (_, index) => <i key={index} />)}</div>
        </div>
        <p className="bitResultOverline">RESULT / {levelNames[difficulty]}</p>
        <h2 id="bit-result-title">{animatedScore.toLocaleString()}</h2>
        <p className="bitScoreLabel">SCORE</p>
        <div className="bitResultStats">
          <div><span>CORRECT</span><strong>{correct} / {TOTAL_QUESTIONS}</strong></div>
          <div><span>TIME</span><strong>{(totalTime / 1000).toFixed(1)}s</strong></div>
          <div><span>BEST</span><strong>{Math.max(best[difficulty], score).toLocaleString()}</strong></div>
        </div>
        <button className="bitRetry" type="button" onClick={() => begin(difficulty)}>もう一度</button>
        <button className="bitShare" type="button" onClick={share}>結果をシェア</button>
        <button className="bitChange" type="button" onClick={() => setPhase("select")}>難易度を変える</button>
        <p className="bitShareStatus" aria-live="polite">{shareStatus}</p>
      </section>
    );
  }

  return (
    <section className="bitGameShell" aria-label="ANGLEゲーム">
      {gameControls}
      <div className="bitGameTop">
        <div><span>LEVEL</span><strong>{levelNames[difficulty]}</strong></div>
        <div><span>QUESTION</span><strong>{String(question + 1).padStart(2, "0")} / 05</strong></div>
        <div><span>SCORE</span><strong>{score.toLocaleString()}</strong></div>
      </div>
      <div className="bitBoard"><AngleDiagram problem={problem} /></div>

      {phase === "answered" ? (
        <div className={`bitAnswerResult ${lastCorrect ? "isCorrect" : "isWrong"}`} aria-live="polite">
          <div className="bitVerdict"><b className="bitJudgeMark" aria-hidden="true">{lastCorrect ? "○" : "×"}</b><span>{lastCorrect ? "CORRECT" : "NOT QUITE"}</span><strong>{problem.answer}°</strong>{!lastCorrect ? <small>誤差 {lastError}°</small> : null}</div>
          <ol>{problem.explanation.map((step) => <li key={step}>{step}</li>)}</ol>
          <button type="button" onClick={next}>{question === TOTAL_QUESTIONS - 1 ? "結果を見る" : "次の問題"}</button>
        </div>
      ) : (
        <div className="bitAnswerPad">
          <div className="bitInputRow">
            <label htmlFor="angle-answer">ANSWER</label>
            <div><input id="angle-answer" value={answer} onChange={(event) => setAnswer(event.target.value.replace(/\D/g, "").slice(0, 3))} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-label="角度の答え" /><span>°</span></div>
            <time>{(elapsed / 1000).toFixed(1)}s</time>
          </div>
          <div className="bitKeypad" aria-label="数字入力">
            {[1,2,3,4,5,6,7,8,9].map((digit) => <button key={digit} type="button" onClick={() => addDigit(String(digit))}>{digit}</button>)}
            <button type="button" aria-label="一文字削除" onClick={removeDigit}>⌫</button>
            <button type="button" onClick={() => addDigit("0")}>0</button>
            <button className="bitSubmit" type="button" onClick={submit} disabled={!answer}>決定</button>
          </div>
        </div>
      )}
    </section>
  );
}
