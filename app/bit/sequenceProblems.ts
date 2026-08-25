export type Difficulty = "beginner" | "intermediate" | "advanced";

type Operation = { kind: "add" | "multiply"; value: number };
type SequenceRule =
  | { kind: "constant"; start: number; step: number; length: number }
  | { kind: "alternating"; start: number; operations: [Operation, Operation]; length: number }
  | { kind: "growing"; start: number; firstStep: number; growth: number; length: number }
  | { kind: "interleaved"; starts: [number, number]; steps: [number, number]; length: number };

export type SequenceProblem = {
  source: number[];
  display: Array<number | null>;
  missingIndex: number;
  answer: number;
  spoken: string;
  explanation: string[];
  rule: SequenceRule;
};

const applyOperation = (value: number, operation: Operation) => operation.kind === "add" ? value + operation.value : value * operation.value;

function buildSequence(rule: SequenceRule) {
  if (rule.kind === "constant") {
    return Array.from({ length: rule.length }, (_, index) => rule.start + rule.step * index);
  }
  if (rule.kind === "alternating") {
    const values = [rule.start];
    for (let index = 1; index < rule.length; index += 1) values.push(applyOperation(values[index - 1], rule.operations[(index - 1) % 2]));
    return values;
  }
  if (rule.kind === "growing") {
    const values = [rule.start];
    for (let index = 1; index < rule.length; index += 1) values.push(values[index - 1] + rule.firstStep + rule.growth * (index - 1));
    return values;
  }
  return Array.from({ length: rule.length }, (_, index) => {
    const lane = index % 2;
    return rule.starts[lane] + rule.steps[lane] * Math.floor(index / 2);
  });
}

function makeProblem(rule: SequenceRule, missingIndex: number, explanation: string[]): SequenceProblem {
  const source = buildSequence(rule);
  const display: Array<number | null> = [...source];
  display[missingIndex] = null;
  const problem = {
    source,
    display,
    missingIndex,
    answer: source[missingIndex],
    spoken: source.map((value, index) => index === missingIndex ? "空欄" : String(value)).join("、"),
    explanation,
    rule,
  };
  if (!isSequenceProblemValid(problem)) throw new Error("Invalid SEQUENCE problem");
  return problem;
}

export const tutorials: Record<Difficulty, SequenceProblem> = {
  beginner: makeProblem(
    { kind: "constant", start: 2, step: 2, length: 6 },
    3,
    ["同じ数ずつ増える並び", "毎回 ＋2", "6 ＋ 2 = 8"],
  ),
  intermediate: makeProblem(
    { kind: "alternating", start: 3, operations: [{ kind: "multiply", value: 2 }, { kind: "add", value: 2 }], length: 6 },
    3,
    ["2つの規則が交互に続く", "×2、＋2、×2…", "8 × 2 = 16"],
  ),
  advanced: makeProblem(
    { kind: "growing", start: 2, firstStep: 3, growth: 2, length: 6 },
    3,
    ["増える幅にも規則がある", "＋3、＋5、＋7、＋9…", "10 ＋ 7 = 17"],
  ),
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function operationLabel(operation: Operation) {
  return `${operation.kind === "add" ? "＋" : "×"}${operation.value}`;
}

function makeBeginner(questionIndex: number) {
  const start = randomInt(1, 25);
  const step = randomInt(2, 12);
  const missingIndex = 2 + (questionIndex % 3);
  return makeProblem(
    { kind: "constant", start, step, length: 6 },
    missingIndex,
    ["同じ数ずつ増える並び", `毎回 ＋${step}`, `${start + step * (missingIndex - 1)} ＋ ${step} = ${start + step * missingIndex}`],
  );
}

function makeIntermediate(questionIndex: number) {
  const start = randomInt(2, 12);
  const firstAdd = randomInt(2, 9);
  let operations: [Operation, Operation];
  if (questionIndex % 3 === 0) operations = [{ kind: "add", value: firstAdd }, { kind: "add", value: firstAdd + randomInt(2, 7) }];
  else if (questionIndex % 3 === 1) operations = [{ kind: "multiply", value: 2 }, { kind: "add", value: firstAdd }];
  else operations = [{ kind: "add", value: firstAdd }, { kind: "multiply", value: 2 }];
  const missingIndex = 2 + (questionIndex % 3);
  const rule: SequenceRule = { kind: "alternating", start, operations, length: 6 };
  const source = buildSequence(rule);
  const usedOperation = operations[(missingIndex - 1) % 2];
  return makeProblem(rule, missingIndex, ["2つの規則が交互に続く", `${operationLabel(operations[0])}、${operationLabel(operations[1])} の繰り返し`, `${source[missingIndex - 1]} ${operationLabel(usedOperation)} = ${source[missingIndex]}`]);
}

function makeAdvanced(questionIndex: number) {
  if (questionIndex % 2 === 0) {
    const start = randomInt(1, 16);
    const firstStep = randomInt(2, 7);
    const growth = randomInt(1, 4);
    const missingIndex = 2 + (questionIndex % 3);
    const step = firstStep + growth * (missingIndex - 1);
    const rule: SequenceRule = { kind: "growing", start, firstStep, growth, length: 6 };
    const source = buildSequence(rule);
    return makeProblem(rule, missingIndex, ["増える幅にも規則がある", `差は ${firstStep} から毎回 ${growth} ずつ増える`, `${source[missingIndex - 1]} ＋ ${step} = ${source[missingIndex]}`]);
  }
  const starts: [number, number] = [randomInt(1, 14), randomInt(16, 34)];
  const steps: [number, number] = [randomInt(3, 9), randomInt(4, 11)];
  const missingIndex = 2 + (questionIndex % 4);
  const lane = missingIndex % 2;
  const rule: SequenceRule = { kind: "interleaved", starts, steps, length: 7 };
  const source = buildSequence(rule);
  return makeProblem(rule, missingIndex, ["奇数番目と偶数番目を分けて見る", `この列は2つ前から ＋${steps[lane]}`, `${source[missingIndex - 2]} ＋ ${steps[lane]} = ${source[missingIndex]}`]);
}

export function makeSequenceProblem(difficulty: Difficulty, questionIndex: number) {
  return difficulty === "beginner" ? makeBeginner(questionIndex) : difficulty === "intermediate" ? makeIntermediate(questionIndex) : makeAdvanced(questionIndex);
}

export function isSequenceProblemValid(problem: SequenceProblem) {
  const rebuilt = buildSequence(problem.rule);
  return problem.missingIndex > 0
    && problem.missingIndex < rebuilt.length - 1
    && rebuilt.length === problem.source.length
    && rebuilt.every((value, index) => value === problem.source[index] && Number.isInteger(value) && value > 0 && value <= 999)
    && problem.display.length === rebuilt.length
    && problem.display.filter((value) => value === null).length === 1
    && problem.display[problem.missingIndex] === null
    && problem.display.every((value, index) => index === problem.missingIndex || value === rebuilt[index])
    && problem.answer === rebuilt[problem.missingIndex];
}

export function sequenceProblemSignature(problem: SequenceProblem) {
  return problem.source.join(",");
}
