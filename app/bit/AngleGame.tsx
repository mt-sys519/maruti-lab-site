"use client";

import { useEffect, useRef, useState } from "react";
import { useMathSeriesAudio } from "./useMathSeriesAudio";

type Difficulty = "beginner" | "intermediate" | "advanced";
type Phase = "select" | "playing" | "answered" | "complete";

type Problem = {
  difficulty: Difficulty;
  left: number;
  right: number;
  apex: number[];
  answer: number;
  explanation: string[];
};

const TOTAL_QUESTIONS = 5;
const levelNames: Record<Difficulty, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
};
const levelNotes: Record<Difficulty, string> = {
  beginner: "三角形 1つ",
  intermediate: "三角形 2つ",
  advanced: "三角形 3つ",
};
const emptyBest: Record<Difficulty, number> = { beginner: 0, intermediate: 0, advanced: 0 };
const initialProblem: Problem = {
  difficulty: "beginner",
  left: 60,
  right: 50,
  apex: [70],
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
  const apexTotal = problem.apex.reduce((total, angle) => total + angle, 0);
  const expectedParts = problem.difficulty === "beginner" ? 1 : problem.difficulty === "intermediate" ? 2 : 3;
  if (
    problem.left + problem.right + apexTotal !== 180
    || problem.apex.at(-1) !== problem.answer
    || problem.apex.length !== expectedParts
  ) {
    throw new Error("Invalid ANGLE problem geometry");
  }
  return problem;
}

function makeProblem(difficulty: Difficulty, questionIndex: number): Problem {
  if (questionIndex === 0) {
    if (difficulty === "intermediate") {
      return checkedProblem({ difficulty, left: 40, right: 50, apex: [30, 60], answer: 60, explanation: ["左の三角形から、底辺の角は 110°", "一直線の隣り合う角は 70°", "x = 180° − 70° − 50° = 60°"] });
    }
    if (difficulty === "advanced") {
      return checkedProblem({ difficulty, left: 30, right: 40, apex: [20, 30, 60], answer: 60, explanation: ["左の三角形から、1つ目の底辺角は 130°", "一直線と中央の三角形から、次の底辺角は 100°", "最後の三角形から x = 180° − 80° − 40° = 60°"] });
    }
    return checkedProblem({ difficulty, left: 60, right: 50, apex: [70], answer: 70, explanation: ["三角形の内角の和は180°", "x = 180° − 60° − 50°", "x = 70°"] });
  }

  const step = questionIndex === 1 ? 10 : questionIndex === 2 ? 5 : 1;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (difficulty === "beginner") {
      const left = randomStep(30, 75, step);
      const right = randomStep(30, 75, step);
      const answer = 180 - left - right;
      if (answer >= 28 && answer <= 110) {
        return checkedProblem({
          difficulty,
          left,
          right,
          apex: [answer],
          answer,
          explanation: [`三角形の内角の和は180°`, `x = 180° − ${left}° − ${right}°`, `x = ${answer}°`],
        });
      }
    }

    if (difficulty === "intermediate") {
      const left = randomStep(25, 60, step);
      const right = randomStep(25, 60, step);
      const known = randomStep(20, 50, step);
      const answer = 180 - left - right - known;
      if (answer >= 16 && answer <= 72) {
        return checkedProblem({
          difficulty,
          left,
          right,
          apex: [known, answer],
          answer,
          explanation: [
            `左の三角形から、底辺の角は 180° − ${left}° − ${known}°`,
            `一直線の隣り合う角から、右側の角は ${left + known}°`,
            `x = 180° − ${left + known}° − ${right}° = ${answer}°`,
          ],
        });
      }
    }

    if (difficulty === "advanced") {
      const left = randomStep(20, 45, step);
      const right = randomStep(20, 45, step);
      const first = randomStep(15, 35, step);
      const second = randomStep(15, 35, step);
      const answer = 180 - left - right - first - second;
      if (answer >= 12 && answer <= 52) {
        return checkedProblem({
          difficulty,
          left,
          right,
          apex: [first, second, answer],
          answer,
          explanation: [
            `左から1つ目の底辺角を ${180 - left - first}° と求める`,
            `一直線と中央の三角形を使い、次の底辺角を ${180 - left - first - second}° と求める`,
            `最後の三角形から x = ${answer}°`,
          ],
        });
      }
    }
  }

  if (difficulty === "intermediate") {
    return checkedProblem({ difficulty, left: 40, right: 50, apex: [30, 60], answer: 60, explanation: ["左の三角形から底辺角を求める", "一直線の隣り合う角を求める", "最後の三角形から x = 60°"] });
  }
  if (difficulty === "advanced") {
    return checkedProblem({ difficulty, left: 40, right: 40, apex: [30, 30, 40], answer: 40, explanation: ["左から1つ目の底辺角を求める", "中央の三角形から次の底辺角を求める", "最後の三角形から x = 40°"] });
  }
  return checkedProblem({ difficulty, left: 60, right: 50, apex: [70], answer: 70, explanation: ["三角形の内角の和は180°", "x = 180° − 60° − 50°", "x = 70°"] });
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

      const tanLeft = Math.tan((problem.left * Math.PI) / 180);
      const tanRight = Math.tan((problem.right * Math.PI) / 180);
      const height = (tanLeft * tanRight) / (tanLeft + tanRight);
      const apexX = height / tanLeft;
      const rawA = { x: 0, y: 0 };
      const rawB = { x: 1, y: 0 };
      const rawC = { x: apexX, y: -height };
      const padX = Math.max(28, rect.width * 0.08);
      const padY = Math.max(42, rect.height * 0.12);
      const scale = Math.min((rect.width - padX * 2), (rect.height - padY * 2) / height);
      const offsetX = (rect.width - scale) / 2;
      const baseY = rect.height - padY;
      const map = (p: { x: number; y: number }) => ({ x: offsetX + p.x * scale, y: baseY + p.y * scale });
      const A = map(rawA);
      const B = map(rawB);
      const C = map(rawC);

      const thetaA = Math.atan2(rawA.y - rawC.y, rawA.x - rawC.x);
      const cumulative: number[] = [];
      let sum = 0;
      for (const value of problem.apex.slice(0, -1)) {
        sum += value;
        cumulative.push(sum);
      }
      const innerRaw = cumulative.map((degrees) => {
        const theta = thetaA - (degrees * Math.PI) / 180;
        const t = -rawC.y / Math.sin(theta);
        return { x: rawC.x + Math.cos(theta) * t, y: 0 };
      });
      const basePoints = [rawA, ...innerRaw, rawB].map(map);

      ctx.strokeStyle = "#183d55";
      ctx.lineWidth = Math.max(1.6, rect.width / 420);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(C.x, C.y);
      ctx.moveTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      for (const point of basePoints.slice(1, -1)) {
        ctx.moveTo(C.x, C.y);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();

      const shortArc = (vertex: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, radius: number, color: string) => {
        const start = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
        const end = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
        let delta = end - start;
        while (delta <= -Math.PI) delta += Math.PI * 2;
        while (delta > Math.PI) delta -= Math.PI * 2;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
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

      const labelFontSize = Math.max(13, Math.min(18, rect.width / 28));
      const drawTag = (text: string, x: number, y: number) => {
        ctx.save();
        ctx.font = `600 ${labelFontSize}px "Yu Gothic UI", sans-serif`;
        const width = ctx.measureText(text).width + 14;
        const height = labelFontSize + 10;
        roundedRect(x - width / 2, y - height / 2, width, height, 4);
        ctx.fillStyle = "rgba(241, 238, 229, .96)";
        ctx.fill();
        ctx.strokeStyle = "rgba(24, 61, 85, .22)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#183d55";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y + 1);
        ctx.restore();
      };

      const leftMiddle = shortArc(A, B, C, 27, "#183d55");
      drawTag(`${problem.left}°`, A.x + Math.cos(leftMiddle) * 56, A.y + Math.sin(leftMiddle) * 56);
      const rightMiddle = shortArc(B, A, C, 27, "#183d55");
      drawTag(`${problem.right}°`, B.x + Math.cos(rightMiddle) * 56, B.y + Math.sin(rightMiddle) * 56);

      const rayPoints = [A, ...basePoints.slice(1, -1), B];
      problem.apex.forEach((value, index) => {
        const p1 = rayPoints[index];
        const p2 = rayPoints[index + 1];
        const unknown = index === problem.apex.length - 1;
        const middle = shortArc(C, p1, p2, 25 + index * 2, unknown ? "#a94235" : "#183d55");
        const radius = Math.max(54, Math.min(68, rect.width / 7.4)) + index * 38;
        const x = C.x + Math.cos(middle) * radius;
        const y = C.y + Math.sin(middle) * radius;
        if (unknown) {
          ctx.fillStyle = "rgba(241, 238, 229, .98)";
          ctx.beginPath();
          ctx.arc(x, y, 23, 0, Math.PI * 2);
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
        } else {
          drawTag(`${value}°`, x, y);
        }
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [problem]);

  const knownApex = problem.apex.slice(0, -1).map((angle) => `${angle}°`).join("、");
  const description = `底辺左が${problem.left}度、底辺右が${problem.right}度${knownApex ? `、頂点の既知角が${knownApex}` : ""}の図形。赤い疑問符の角度を求めます。`;
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
  const [best, setBest] = useState<Record<Difficulty, number>>(emptyBest);
  const [shareStatus, setShareStatus] = useState("");
  const { enabled: soundEnabled, toggle: toggleSound, playAnswer } = useMathSeriesAudio(phase === "complete" ? "result" : "thinking");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("marutibit:angle:best") || "null");
        if (saved) setBest({ ...emptyBest, ...saved });
      } catch { /* Ignore invalid local records. */ }
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
    setShareStatus("");
    setStartedAt(Date.now());
    setPhase("playing");
  };

  const submit = () => {
    if (!answer || phase !== "playing") return;
    const value = Number(answer);
    const isCorrect = value === problem.answer;
    const error = Math.abs(value - problem.answer);
    const speedBonus = isCorrect ? Math.max(0, 500 - Math.floor(elapsed / 1000) * 20) : 0;
    playAnswer(isCorrect);
    setLastCorrect(isCorrect);
    setLastError(error);
    setCorrect((current) => current + (isCorrect ? 1 : 0));
    setScore((current) => current + (isCorrect ? 1000 + speedBonus : 0));
    setPhase("answered");
  };

  const next = () => {
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
    setAnswer((current) => `${current}${digit}`.replace(/^0+(?=\d)/, "").slice(0, 3));
  };

  const share = async () => {
    const text = `MarutiBit「ANGLE」${levelNames[difficulty]}\nSCORE ${score} / ${correct} CORRECT`;
    const url = "https://marutilab.com/bit";
    try {
      if (navigator.share) {
        await navigator.share({ title: "MarutiBit — ANGLE", text, url });
        setShareStatus("共有しました");
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareStatus("結果をコピーしました");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setShareStatus("共有できませんでした");
    }
  };

  const soundButton = (
    <button className={`bitSound ${soundEnabled ? "isOn" : ""}`} type="button" aria-pressed={soundEnabled} onClick={() => { void toggleSound(); }}>
      <span className="bitSoundBars" aria-hidden="true"><i /><i /><i /></span>
      BGM <strong>{soundEnabled ? "ON" : "OFF"}</strong>
    </button>
  );

  if (phase === "select") {
    return (
      <section className="bitGameShell" aria-label="ANGLEゲーム">
        {soundButton}
        <div className="bitSelectHead"><span>SELECT LEVEL</span><strong>3 LEVELS</strong></div>
        <div className="bitBoard bitBoardPreview"><AngleDiagram problem={problem} /></div>
        <div className="bitModeSelect" aria-label="難易度を選択">
          {(Object.keys(levelNames) as Difficulty[]).map((level) => (
            <button key={level} type="button" className={difficulty === level ? "isActive" : ""} onClick={() => { setDifficulty(level); setProblem(makeProblem(level, 0)); }}>
              {levelNames[level]}<small>{levelNotes[level]}</small>
            </button>
          ))}
        </div>
        <button className="bitStart" type="button" onClick={() => begin()}>START</button>
        <p className="bitRule">全5問。図に示された角度だけを使い、赤い「？」を求めます。正解と回答速度でスコアが決まります。</p>
      </section>
    );
  }

  if (phase === "complete") {
    return (
      <section className="bitGameShell bitResult" aria-labelledby="bit-result-title">
        {soundButton}
        <p className="bitResultOverline">RESULT / {levelNames[difficulty]}</p>
        <h2 id="bit-result-title">{score.toLocaleString()}</h2>
        <p className="bitScoreLabel">SCORE</p>
        <div className="bitResultStats">
          <div><span>CORRECT</span><strong>{correct} / {TOTAL_QUESTIONS}</strong></div>
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
      {soundButton}
      <div className="bitGameTop">
        <div><span>LEVEL</span><strong>{levelNames[difficulty]}</strong></div>
        <div><span>QUESTION</span><strong>{String(question + 1).padStart(2, "0")} / 05</strong></div>
        <div><span>SCORE</span><strong>{score.toLocaleString()}</strong></div>
      </div>
      <div className="bitBoard"><AngleDiagram problem={problem} /></div>

      {phase === "answered" ? (
        <div className={`bitAnswerResult ${lastCorrect ? "isCorrect" : "isWrong"}`} aria-live="polite">
          <div className="bitVerdict"><span>{lastCorrect ? "CORRECT" : "NOT QUITE"}</span><strong>{problem.answer}°</strong>{!lastCorrect ? <small>誤差 {lastError}°</small> : null}</div>
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
            <button type="button" aria-label="一文字削除" onClick={() => setAnswer((current) => current.slice(0, -1))}>⌫</button>
            <button type="button" onClick={() => addDigit("0")}>0</button>
            <button className="bitSubmit" type="button" onClick={submit} disabled={!answer}>決定</button>
          </div>
        </div>
      )}
    </section>
  );
}
