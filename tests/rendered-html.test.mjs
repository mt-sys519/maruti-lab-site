import assert from "node:assert/strict";
import test from "node:test";

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
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("renders the PromptTerm CLOCK download page", async () => {
  const response = await render("/clock");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /PromptTerm CLOCK/);
  assert.match(html, /PromptTerm_CLOCK_1\.0\.0_setup\.exe/);
  assert.match(html, /28D02F8B39B84AF300388E425F74CAB001BDFEC1DC4271114120D7089C55D927/);
});
