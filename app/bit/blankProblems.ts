export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Problem = {
  tokens: string[];
  answer: number;
  spoken: string;
  explanation: string[];
};

export const tutorials: Record<Difficulty, Problem> = {
  beginner: { tokens: ["7", "＋", "?", "＝", "10"], answer: 3, spoken: "7足す空欄は10", explanation: ["10から7を引く", "? = 10 − 7", "? = 3"] },
  intermediate: { tokens: ["?", "×", "6", "−", "4", "＝", "32"], answer: 6, spoken: "空欄かける6ひく4は32", explanation: ["32に4を足す", "? × 6 = 36", "? = 36 ÷ 6 = 6"] },
  advanced: { tokens: ["48", "÷", "(", "?", "＋", "2", ")", "＝", "8"], answer: 4, spoken: "48割る、空欄足す2、は8", explanation: ["括弧全体は 48 ÷ 8 = 6", "? ＋ 2 = 6", "? = 4"] },
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function evaluate(tokens: string[], blank: number) {
  const normalized = tokens.map((token) => token === "?" ? String(blank) : token === "＋" ? "+" : token === "−" ? "-" : token === "×" ? "*" : token === "÷" ? "/" : token);
  let index = 0;
  const factor = (): number => {
    const token = normalized[index++];
    if (token === "(") {
      const value = expression();
      if (normalized[index++] !== ")") throw new Error("Unclosed parenthesis");
      return value;
    }
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Invalid number");
    return value;
  };
  const term = (): number => {
    let value = factor();
    while (normalized[index] === "*" || normalized[index] === "/") {
      const operator = normalized[index++];
      const right = factor();
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };
  const expression = (): number => {
    let value = term();
    while (normalized[index] === "+" || normalized[index] === "-") {
      const operator = normalized[index++];
      const right = term();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const value = expression();
  if (index !== normalized.length) throw new Error("Unexpected token");
  return value;
}

export function isBlankProblemValid(problem: Problem) {
  const equals = problem.tokens.indexOf("＝");
  if (equals < 1 || equals === problem.tokens.length - 1) return false;
  const left = evaluate(problem.tokens.slice(0, equals), problem.answer);
  const right = evaluate(problem.tokens.slice(equals + 1), problem.answer);
  return Number.isInteger(problem.answer) && problem.answer > 0 && Number.isFinite(left) && Math.abs(left - right) < 1e-9;
}

function checked(problem: Problem) {
  if (!isBlankProblemValid(problem)) throw new Error("Invalid BLANK problem");
  return problem;
}

function makeBeginner(questionIndex: number): Problem {
  const kind = questionIndex % 4 + 1;
  if (kind === 1) {
    const left = randomInt(4, 18);
    const answer = randomInt(2, 15);
    return { tokens: [String(left), "＋", "?", "＝", String(left + answer)], answer, spoken: `${left}足す空欄は${left + answer}`, explanation: [`${left + answer}から${left}を引く`, `? = ${left + answer} − ${left}`, `? = ${answer}`] };
  }
  if (kind === 2) {
    const answer = randomInt(6, 24);
    const right = randomInt(2, Math.min(12, answer - 1));
    return { tokens: ["?", "−", String(right), "＝", String(answer - right)], answer, spoken: `空欄ひく${right}は${answer - right}`, explanation: [`${answer - right}に${right}を足す`, `? = ${answer - right} ＋ ${right}`, `? = ${answer}`] };
  }
  if (kind === 3) {
    const left = randomInt(2, 9);
    const answer = randomInt(2, 9);
    return { tokens: [String(left), "×", "?", "＝", String(left * answer)], answer, spoken: `${left}かける空欄は${left * answer}`, explanation: [`${left * answer}を${left}で割る`, `? = ${left * answer} ÷ ${left}`, `? = ${answer}`] };
  }
  const answer = randomInt(2, 9);
  const right = randomInt(2, 9);
  return { tokens: [String(answer * right), "÷", "?", "＝", String(right)], answer, spoken: `${answer * right}割る空欄は${right}`, explanation: [`${answer * right}を${right}で割る`, `? = ${answer * right} ÷ ${right}`, `? = ${answer}`] };
}

function makeIntermediate(questionIndex: number): Problem {
  const answer = randomInt(3, 12);
  const kind = questionIndex % 4 + 1;
  if (kind === 1) {
    const multiplier = randomInt(2, 6);
    const left = randomInt(5, 20);
    const result = left + answer * multiplier;
    return { tokens: [String(left), "＋", "?", "×", String(multiplier), "＝", String(result)], answer, spoken: `${left}足す空欄かける${multiplier}は${result}`, explanation: ["掛け算をひとまとまりとして逆算する", `? × ${multiplier} = ${result} − ${left} = ${answer * multiplier}`, `? = ${answer}`] };
  }
  if (kind === 2) {
    const quotient = randomInt(3, 10);
    const add = randomInt(2, 9);
    const numerator = answer * quotient;
    return { tokens: [String(numerator), "÷", "?", "＋", String(add), "＝", String(quotient + add)], answer, spoken: `${numerator}割る空欄足す${add}は${quotient + add}`, explanation: [`${quotient + add}から${add}を引く`, `${numerator} ÷ ? = ${quotient}`, `? = ${numerator} ÷ ${quotient} = ${answer}`] };
  }
  if (kind === 3) {
    const multiplier = randomInt(2, 6);
    const subtract = randomInt(3, 12);
    const result = answer * multiplier - subtract;
    return { tokens: ["?", "×", String(multiplier), "−", String(subtract), "＝", String(result)], answer, spoken: `空欄かける${multiplier}ひく${subtract}は${result}`, explanation: [`${result}に${subtract}を足す`, `? × ${multiplier} = ${answer * multiplier}`, `? = ${answer}`] };
  }
  const multiplier = randomInt(2, 6);
  const result = answer * multiplier;
  const right = randomInt(4, 18);
  return { tokens: [String(result + right), "−", "?", "×", String(multiplier), "＝", String(right)], answer, spoken: `${result + right}ひく空欄かける${multiplier}は${right}`, explanation: [`${result + right} − ${right} = ${result}`, `? × ${multiplier} = ${result}`, `? = ${answer}`] };
}

function makeAdvanced(questionIndex: number): Problem {
  const answer = randomInt(3, 12);
  const kind = questionIndex % 4 + 1;
  if (kind === 1) {
    const add = randomInt(2, 7);
    const multiplier = randomInt(2, 5);
    const subtract = randomInt(3, 12);
    const result = (answer + add) * multiplier - subtract;
    return { tokens: ["(", "?", "＋", String(add), ")", "×", String(multiplier), "−", String(subtract), "＝", String(result)], answer, spoken: `空欄足す${add}の括弧、かける${multiplier}ひく${subtract}は${result}`, explanation: [`${result}に${subtract}を足し、${multiplier}で割る`, `? ＋ ${add} = ${(result + subtract) / multiplier}`, `? = ${answer}`] };
  }
  if (kind === 2) {
    const subtract = randomInt(1, Math.min(4, answer - 1));
    const quotient = randomInt(3, 8);
    const add = randomInt(2, 8);
    const numerator = (answer - subtract) * quotient;
    return { tokens: [String(numerator), "÷", "(", "?", "−", String(subtract), ")", "＋", String(add), "＝", String(quotient + add)], answer, spoken: `${numerator}割る、空欄ひく${subtract}の括弧、足す${add}は${quotient + add}`, explanation: [`${quotient + add}から${add}を引くと${quotient}`, `? − ${subtract} = ${numerator} ÷ ${quotient} = ${answer - subtract}`, `? = ${answer}`] };
  }
  if (kind === 3) {
    const multiplier = randomInt(2, 5);
    const add = randomInt(2, 10);
    const divisor = randomInt(2, 5);
    const inside = answer * multiplier + add;
    const adjustedAdd = add + ((divisor - (inside % divisor)) % divisor);
    const result = (answer * multiplier + adjustedAdd) / divisor;
    return { tokens: ["(", "?", "×", String(multiplier), "＋", String(adjustedAdd), ")", "÷", String(divisor), "＝", String(result)], answer, spoken: `空欄かける${multiplier}足す${adjustedAdd}の括弧、割る${divisor}は${result}`, explanation: [`括弧全体は ${result} × ${divisor} = ${result * divisor}`, `? × ${multiplier} = ${result * divisor} − ${adjustedAdd} = ${answer * multiplier}`, `? = ${answer}`] };
  }
  const add = randomInt(2, 7);
  const multiplier = randomInt(2, 5);
  const base = (answer + add) * multiplier + randomInt(10, 30);
  const result = base - (answer + add) * multiplier;
  return { tokens: [String(base), "−", "(", "?", "＋", String(add), ")", "×", String(multiplier), "＝", String(result)], answer, spoken: `${base}ひく、空欄足す${add}の括弧、かける${multiplier}は${result}`, explanation: [`括弧を掛けた値は ${base} − ${result} = ${base - result}`, `? ＋ ${add} = ${base - result} ÷ ${multiplier} = ${answer + add}`, `? = ${answer}`] };
}

export function makeBlankProblem(difficulty: Difficulty, questionIndex: number) {
  const problem = difficulty === "beginner" ? makeBeginner(questionIndex) : difficulty === "intermediate" ? makeIntermediate(questionIndex) : makeAdvanced(questionIndex);
  return checked(problem);
}

export function blankProblemSignature(problem: Problem) {
  return problem.tokens.join("");
}
