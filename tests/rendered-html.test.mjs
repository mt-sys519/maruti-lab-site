import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { blankProblemSignature, isBlankProblemValid, makeBlankProblem } from "../app/bit/blankProblems.ts";
import { isSequenceProblemValid, makeSequenceProblem, sequenceProblemSignature } from "../app/bit/sequenceProblems.ts";
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

test("renders the MarutiBit series index", async () => {
  const response = await render("/bit");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /MarutiBit/);
  assert.match(html, /ゲームを選ぶ/);
  assert.match(html, /href="\/" class="brand" aria-label="Maruti Lab トップ"/);
  assert.match(html, /class="brandMark"><img src="\/icon-512\.png"/);
  assert.doesNotMatch(html, /id="bit-hub-title"><span>Maruti<\/span>/);
  assert.match(html, /href="\/bit\/angle"/);
  assert.match(html, /href="\/bit\/blank"/);
  assert.match(html, /href="\/bit\/sequence"/);
  assert.match(html, /href="\/bit\/input-rain"/);
  assert.match(html, /\/og\/bit\/index\.png/);
});

test("renders the MarutiBit ANGLE game page", async () => {
  const response = await render("/bit/angle");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ANGLE/);
  assert.match(html, /bitAngleLogo/);
  assert.doesNotMatch(html, /bitTriMark/);
  assert.doesNotMatch(html, /TRIANGLE/);
  assert.match(html, /初級/);
  assert.match(html, /中級/);
  assert.match(html, /上級/);
  assert.match(html, /START/);
  assert.match(html, /href="\/"[^>]*>Maruti Lab/);
  assert.match(html, /href="\/bit"[^>]*aria-label="MarutiBit トップ"/);
  assert.match(html, /三角形の「？」を求める/);
  assert.match(html, /SOUND/);
  assert.match(html, /OFF/);
});

test("renders the MarutiBit BLANK game page", async () => {
  const response = await render("/bit/blank");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /BLANK/);
  assert.match(html, /空欄補完ゲーム/);
  assert.match(html, /GAME 002/);
  assert.match(html.replaceAll("<!-- -->", ""), /5 QUESTIONS/);
  assert.match(html, /bitBlankLogo/);
  assert.match(html, /<a href="\/bit\/angle"><small>001<\/small>ANGLE<\/a>/);
});

test("renders the MarutiBit SEQUENCE game page", async () => {
  const response = await render("/bit/sequence");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /SEQUENCE/);
  assert.match(html, /順番推理ゲーム/);
  assert.match(html, /GAME 003/);
  assert.match(html.replaceAll("<!-- -->", ""), /5 QUESTIONS/);
  assert.match(html, /bitSequenceLogo/);
  assert.match(html, /<a href="\/bit\/blank"><small>002<\/small>BLANK<\/a>/);
});

test("renders the MarutiBit INPUT RAIN typing game without Matrix-style background rain", async () => {
  const response = await render("/bit/input-rain");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /INPUT RAIN/);
  assert.match(html, /GAME 004/);
  assert.match(html, /PromptTermの端末入力を、文字が落ちきる前に打ち込む/);
  assert.match(html, /短い端末語/);
  assert.match(html, /入力方式はこの端末に記憶され/);
  assert.match(html, /フリック<small>スマホのかな入力<\/small>/);
  assert.doesNotMatch(html, /rain-col|buildRain|NODECACHEERRORRUN/);
});

test("keeps INPUT RAIN prompts authored and terminal-specific", async () => {
  const source = await readFile(new URL("../app/bit/inputRainPrompts.ts", import.meta.url), "utf8");
  const gameSource = await readFile(new URL("../app/bit/InputRainGame.tsx", import.meta.url), "utf8");
  assert.match(source, /\["起動", "きどう"\]/);
  assert.match(source, /\["受信信号を照合しています。"/);
  assert.doesNotMatch(source, /Aログ|ログA|Aキー|キーA/);
  assert.doesNotMatch(gameSource, /matrixGlyphs|NODECACHEERRORRUN|buildRain/);
  assert.match(gameSource, /inputRainGlyph/);
  assert.match(gameSource, /marutibit:input-rain:v1/);
  assert.match(gameSource, /PromptTermの端末入力を、文字が落ちきる前に打ち込むタイピングゲーム/);
});

test("builds a score card and keeps the complete score and URL in the share payload", async () => {
  const source = await readFile(new URL("../app/bit/AngleGame.tsx", import.meta.url), "utf8");
  const blankSource = await readFile(new URL("../app/bit/BlankGame.tsx", import.meta.url), "utf8");
  const sequenceSource = await readFile(new URL("../app/bit/SequenceGame.tsx", import.meta.url), "utf8");
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
  assert.match(sequenceSource, /数列の規則を見抜く\$\{TOTAL_QUESTIONS\}問チャレンジ/);
  assert.match(sequenceSource, /https:\/\/marutilab\.com\/bit\/sequence/);
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

test("validates thousands of SEQUENCE problems across all difficulties", () => {
  for (const difficulty of ["beginner", "intermediate", "advanced"]) {
    const signatures = new Set();
    for (let index = 0; index < 2000; index += 1) {
      const problem = makeSequenceProblem(difficulty, index % 5);
      assert.equal(isSequenceProblemValid(problem), true);
      assert.equal(Number.isInteger(problem.answer), true);
      assert.ok(problem.answer > 0 && problem.answer <= 999);
      signatures.add(sequenceProblemSignature(problem));
    }
    assert.ok(signatures.size > 20, `${difficulty} should generate varied questions`);
  }
});
