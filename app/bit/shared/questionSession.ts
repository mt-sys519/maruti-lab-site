export type UniqueQuestionSessionOptions<T> = {
  count: number;
  recentSignatures: string[];
  tutorial?: T;
  create: (questionIndex: number, attempt: number) => T;
  signature: (question: T) => string;
};

export type UniqueQuestionSession<T> = {
  questions: T[];
  signatures: string[];
};

const MAX_ATTEMPTS_PER_PASS = 1200;

/** Builds one session with no internal duplicates and avoids recent history when possible. */
export function createUniqueQuestionSession<T>(options: UniqueQuestionSessionOptions<T>): UniqueQuestionSession<T> {
  const questions: T[] = [];
  const signatures: string[] = [];
  const used = new Set<string>();
  const recent = new Set(options.recentSignatures);

  const add = (question: T, avoidRecent: boolean) => {
    const key = options.signature(question);
    if (used.has(key) || (avoidRecent && recent.has(key))) return false;
    questions.push(question);
    signatures.push(key);
    used.add(key);
    return true;
  };

  if (options.tutorial && options.recentSignatures.length === 0) add(options.tutorial, false);

  for (const avoidRecent of [true, false]) {
    let attempts = 0;
    while (questions.length < options.count && attempts < MAX_ATTEMPTS_PER_PASS) {
      add(options.create(questions.length, attempts), avoidRecent);
      attempts += 1;
    }
    if (questions.length === options.count) break;
  }

  if (questions.length !== options.count) throw new Error("Could not build a unique question session");
  return { questions, signatures };
}

export function loadRecentQuestionSignatures(storageKey: string) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function rememberQuestionSignatures(storageKey: string, current: string[], previous: string[], limit = 30) {
  const merged = Array.from(new Set([...current, ...previous])).slice(0, limit);
  try { localStorage.setItem(storageKey, JSON.stringify(merged)); } catch { /* Local history is optional. */ }
  return merged;
}
