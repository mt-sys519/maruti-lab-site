"use client";

import { useEffect, useRef, useState } from "react";

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
  left: 48,
  right: 47,
  apex: [85],
  answer: 85,
  explanation: ["三角形の内角の和は180°", "x = 180° − 48° − 47°", "x = 85°"],
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeProblem(difficulty: Difficulty): Problem {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (difficulty === "beginner") {
      const left = randomInt(28, 76);
      const right = randomInt(28, 76);
      const answer = 180 - left - right;
      if (answer >= 28 && answer <= 110) {
        return {
          difficulty,
          left,
          right,
          apex: [answer],
          answer,
          explanation: [`三角形の内角の和は180°`, `x = 180° − ${left}° − ${right}°`, `x = ${answer}°`],
        };
      }
    }

    if (difficulty === "intermediate") {
      const left = randomInt(22, 62);
      const right = randomInt(22, 62);
      const known = randomInt(18, 54);
      const answer = 180 - left - right - known;
      if (answer >= 16 && answer <= 72) {
        return {
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
        };
      }
    }

    if (difficulty === "advanced") {
      const left = randomInt(18, 48);
      const right = randomInt(18, 48);
      const first = randomInt(14, 34);
      const second = randomInt(14, 34);
      const answer = 180 - left - right - first - second;
      if (answer >= 12 && answer <= 52) {
        return {
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
        };
      }
    }
  }

  if (difficulty === "intermediate") {
    return { difficulty, left: 40, right: 50, apex: [30, 60], answer: 60, explanation: ["左の三角形から底辺角を求める", "一直線の隣り合う角を求める", "最後の三角形から x = 60°"] };
  }
  if (difficulty === "advanced") {
    return { difficulty, left: 40, right: 40, apex: [30, 30, 40], answer: 40, explanation: ["左から1つ目の底辺角を求める", "中央の三角形から次の底辺角を求める", "最後の三角形から x = 40°"] };
  }
  return { difficulty, left: 60, right: 50, apex: [70], answer: 70, explanation: ["三角形の内角の和は180°", "x = 180° − 60° − 50°", "x = 70°"] };
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

      ctx.fillStyle = "#183d55";
      ctx.font = `600 ${Math.max(13, Math.min(19, rect.width / 28))}px "Yu Gothic UI", sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(`${problem.left}°`, A.x + 16, A.y - 15);
      ctx.textAlign = "right";
      ctx.fillText(`${problem.right}°`, B.x - 16, B.y - 15);

      const rayPoints = [A, ...basePoints.slice(1, -1), B];
      problem.apex.forEach((value, index) => {
        const p1 = rayPoints[index];
        const p2 = rayPoints[index + 1];
        const angle1 = Math.atan2(p1.y - C.y, p1.x - C.x);
        const angle2 = Math.atan2(p2.y - C.y, p2.x - C.x);
        const middle = (angle1 + angle2) / 2;
        const radius = Math.max(40, Math.min(58, rect.width / 8.5));
        const x = C.x + Math.cos(middle) * radius;
        const y = C.y + Math.sin(middle) * radius;
        const unknown = index === problem.apex.length - 1;
        if (unknown) {
          ctx.fillStyle = "#a94235";
          ctx.beginPath();
          ctx.arc(x, y, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "700 18px \"Yu Gothic UI\", sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", x, y + 1);
        } else {
          ctx.fillStyle = "#183d55";
          ctx.font = `600 ${Math.max(12, Math.min(17, rect.width / 31))}px "Yu Gothic UI", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${value}°`, x, y);
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
    setProblem(makeProblem(level));
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
    setProblem(makeProblem(difficulty));
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

  if (phase === "select") {
    return (
      <section className="bitGameShell" aria-label="ANGLEゲーム">
        <div className="bitSelectHead"><span>SELECT LEVEL</span><strong>3 LEVELS</strong></div>
        <div className="bitBoard bitBoardPreview"><AngleDiagram problem={problem} /></div>
        <div className="bitModeSelect" aria-label="難易度を選択">
          {(Object.keys(levelNames) as Difficulty[]).map((level) => (
            <button key={level} type="button" className={difficulty === level ? "isActive" : ""} onClick={() => { setDifficulty(level); setProblem(makeProblem(level)); }}>
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
