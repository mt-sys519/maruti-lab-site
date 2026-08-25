import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { blankProblemSignature, isBlankProblemValid, makeBlankProblem } from "../app/bit/blankProblems.ts";
import { createUniqueQuestionSession } from "../app/bit/shared/questionSession.ts";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the Maruti Lab works page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Maruti Lab/);
  assert.match(html, /YURAMEKI/);
  assert.match(html, /PromptTerm/);
  assert.match(html, /class="navIcon"[^>]*>🎮/);
  assert.match(html, /class="navIcon"[^>]*>☕/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("renders the PromptTerm CLOCK download page", async () => {
  const response = await render("/clock");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /PromptTerm CLOCK/);
  assert.match(html, /PromptTerm_CLOCK_1\.0\.0_setup\.exe/);
  assert.match(html, /E8DF275BE2505690474CF663FC1E876F0B9600691DD1F8BF83D599E9219EC34E/);
});

test("renders the MarutiBit ANGLE game page", async () => {
  const response = await render("/bit");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /MarutiBit/);
  assert.doesNotMatch(html, /maruti-lab-og\.jpg/);
  assert.match(html, /ANGLE/);
  assert.match(html, /bitAngleLogo/);
  assert.doesNotMatch(html, /bitTriMark/);
  assert.doesNotMatch(html, /TRIANGLE/);
  assert.match(html, /初級/);
  assert.match(html, /中級/);
  assert.match(html, /上級/);
  assert.match(html, /START/);
  assert.match(html, /href="https:\/\/marutilab\.com\/"[^>]*>Maruti Labへ戻る/);
  assert.match(html, /三角形の「？」を求める/);
  assert.match(html, /SOUND/);
  assert.match(html, /OFF/);
});

test("renders the MarutiBit BLANK game page", async () => {
  const response = await render("/bit/blank");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /BLANK/);
  assert.match(html, /四則演算の穴埋めパズル/);
  assert.match(html, /GAME 002/);
  assert.match(html.replaceAll("<!-- -->", ""), /5 QUESTIONS/);
  assert.match(html, /bitBlankLogo/);
  assert.match(html, /<a href="\/bit"><small>001<\/small>ANGLE<\/a>/);
});

test("builds a score card and keeps the complete score and URL in the share payload", async () => {
  const source = await readFile(new URL("../app/bit/AngleGame.tsx", import.meta.url), "utf8");
  const blankSource = await readFile(new URL("../app/bit/BlankGame.tsx", import.meta.url), "utf8");
  const cardSource = await readFile(new URL("../app/bit/shared/createResultCard.ts", import.meta.url), "utf8");
  assert.match(source, /createResultCard/);
  assert.match(source, /const shareText = `\$\{text\}\\n\$\{url\}`/);
  assert.match(source, /三角形の角度を求める\$\{TOTAL_QUESTIONS\}問チャレンジ/);
  assert.match(cardSource, /gameDescription/);
  assert.match(cardSource, /data\.questions/);
  assert.match(source, /files: \[shareCard\], title, text: shareText/);
  assert.match(source, /\{ title, text: shareText \}/);
  assert.match(source, /data-card-ready=/);
  assert.match(blankSource, /四則演算の空欄を逆算する\$\{TOTAL_QUESTIONS\}問チャレンジ/);
  assert.match(blankSource, /https:\/\/marutilab\.com\/bit\/blank/);
  assert.match(cardSource, /CARD_WIDTH = 1200/);
  assert.match(cardSource, /CARD_HEIGHT = 630/);
  assert.match(cardSource, /new File\(\[blob\]/);
});

test("pauses active games on page visibility changes and requires manual resume", async () => {
  const source = await readFile(new URL("../app/bit/shared/useVisibilityPause.ts", import.meta.url), "utf8");
  assert.match(source, /document\.hidden/);
  assert.match(source, /addEventListener\("visibilitychange"/);
  assert.match(source, /const resume = useCallback/);
  assert.doesNotMatch(source, /visibilityState === "visible"[^]*setPaused\(false\)/);
});

test("builds unique five-question sessions and avoids recent history", () => {
  const values = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const first = createUniqueQuestionSession({
    count: 5,
    recentSignatures: [],
    tutorial: { id: "TUTORIAL" },
    create: (_index, attempt) => ({ id: values[attempt % values.length] }),
    signature: (question) => question.id,
  });
  assert.deepEqual(first.signatures, ["TUTORIAL", "A", "B", "C", "D"]);
  assert.equal(new Set(first.signatures).size, 5);

  const next = createUniqueQuestionSession({
    count: 5,
    recentSignatures: ["A", "B", "C", "D", "E"],
    tutorial: { id: "TUTORIAL" },
    create: (_index, attempt) => ({ id: values[attempt % values.length] }),
    signature: (question) => question.id,
  });
  assert.deepEqual(next.signatures, ["F", "G", "H", "I", "J"]);
  assert.doesNotMatch(next.signatures.join(""), /TUTORIAL/);
});

test("validates thousands of BLANK equations across all difficulties", () => {
  for (const difficulty of ["beginner", "intermediate", "advanced"]) {
    const signatures = new Set();
    for (let index = 0; index < 2000; index += 1) {
      const problem = makeBlankProblem(difficulty, index % 5);
      assert.equal(isBlankProblemValid(problem), true);
      assert.equal(Number.isInteger(problem.answer), true);
      assert.ok(problem.answer > 0);
      signatures.add(blankProblemSignature(problem));
    }
    assert.ok(signatures.size > 20, `${difficulty} should generate varied questions`);
  }
});
