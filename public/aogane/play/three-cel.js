// AOGANE's WebGL renderer (three.js, vendored in vendor/three.min.js). main.js records the frame under
// the HMD (sky, ground, world, hostiles, debris, shots and blasts) and the gun arm, and hands them to draw();
// the result is a canvas main.js composites where its Canvas renderer would have drawn. Without WebGL 2, on
// a lost context or with ?canvas in the URL, window.HF_THREE stays inactive and main.js draws with Canvas.
// Same palette and light rule as the Canvas renderer (lit / shade per material, KEY_LIGHT, facing term),
// but per pixel with a real depth buffer, plus what Canvas could not do well: ink outlines and creases
// from a normal + depth pass, a toon specular band on metal, a cool rim, screentone dots in the shade.
// ?dev adds a label and T to switch WebGL / Canvas in game for comparison.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

const canvas = document.createElement('canvas');
let renderer = null;
const query = new URLSearchParams(location.search);
if (!query.has('canvas')) try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = false;
} catch (e) { console.warn('AOGANE three: WebGL unavailable', e); }

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
let rtColor = null, rtND = null, sizeKey = '';

// ---- materials -------------------------------------------------------------------------------
const toonVert = /* glsl */`
  attribute vec3 normal;
  varying vec3 vN; varying vec3 vW;
  void main(){ vN = normal; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const toonFrag = /* glsl */`
  precision highp float;
  uniform vec3 lit, shade, light, camPos, glowCol, hitPos;
  uniform float metal, glow, tone, hot, hitT, glowK, ghostA, revealY;
  varying vec3 vN; varying vec3 vW;
  void main(){
    if (vW.y > revealY) discard;
    if (glow > 0.0) { gl_FragColor = vec4(glowCol, clamp(0.12 + 0.6 * glowK, 0.0, 1.0) * ghostA); return; }
    vec3 n = normalize(vN), V = normalize(camPos - vW);
    float lam = max(0.0, dot(n, light)), facing = max(0.0, dot(n, V));
    float k = smoothstep(0.47, 0.53, lam + 0.25 * facing);
    vec3 c = mix(shade, lit, k);
    if (tone > 0.0) {
      vec2 q = mod(gl_FragCoord.xy, 4.0);
      float d = min(length(q - vec2(1.0)), length(q - vec2(3.0)));
      c *= 1.0 - 0.3 * (1.0 - smoothstep(0.6, 1.1, d)) * (1.0 - k);
    }
    if (metal > 0.0) {
      vec3 h = normalize(light + V);
      c += smoothstep(0.55, 0.62, pow(max(0.0, dot(n, h)), 28.0)) * 0.38 * metal;
    }
    c += pow(1.0 - facing, 3.0) * 0.10 * vec3(0.55, 0.72, 1.0);
    vec3 flashCol = vec3(1.0, 0.94, 0.84);
    c = mix(c, flashCol, hot);
    if (hitT > 0.0) c = mix(c, flashCol, hitT * (1.0 - smoothstep(0.6, 1.3, distance(vW, hitPos))));
    gl_FragColor = vec4(c, ghostA);
  }`;
// Normal + depth and a per-part id (MRT): the Canvas renderer outlines every part on its own, so the
// composite inks part boundaries too, not only folds and depth jumps.
const ndMat = new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3,
  vertexShader: /* glsl */`
    precision highp float;
    in vec3 position; in vec3 normal;
    uniform mat4 projectionMatrix, viewMatrix;
    out vec3 vN; out float vD;
    void main(){ vec4 p = viewMatrix * vec4(position, 1.0); vN = (viewMatrix * vec4(normal, 0.0)).xyz; vD = -p.z; gl_Position = projectionMatrix * p; }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform float partId, fade, hostile;
    in vec3 vN; in float vD;
    layout(location = 0) out vec4 oN; layout(location = 1) out vec4 oId;
    void main(){ oN = vec4(normalize(vN) * 0.5 + 0.5, vD / 20.0); oId = vec4(partId, fade, hostile, 1.0); }`,
  uniforms: { partId: { value: 0 }, fade: { value: 1 }, hostile: { value: 0 } },
});
// World solids in the normal + depth pass: depth only, placed by their model matrix (ndMat writes
// world-space hostile vertices and has none, which left every building at the origin, so hostile ink
// showed through walls). They hide what stands behind them and add no ink of their own, as before.
const ndDepthMat = new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3, colorWrite: false,
  vertexShader: /* glsl */`
    precision highp float;
    in vec3 position;
    uniform mat4 projectionMatrix, viewMatrix, modelMatrix;
    void main(){ gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    precision highp float;
    layout(location = 0) out vec4 oN; layout(location = 1) out vec4 oId;
    void main(){ oN = vec4(0.0); oId = vec4(0.0); }`,
});
const mats = new Map();
const rgb = a => new THREE.Vector3(a[0] / 255, a[1] / 255, a[2] / 255);
const hex = h => { const n = parseInt(h.slice(1), 16); return new THREE.Vector3((n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
function material(style, mat, ghost = false) {
  let byMat = mats.get(style); if (!byMat) mats.set(style, byMat = new Map());
  const mk = ghost ? mat + '|ghost' : mat;
  let m = byMat.get(mk); if (m) return m;
  const T = style.toon || {}, pair = T[mat] || T.armor || [[200, 200, 200], [90, 90, 90]];
  m = new THREE.RawShaderMaterial({
    vertexShader: 'precision highp float;\nattribute vec3 position;\nuniform mat4 projectionMatrix, viewMatrix;\n' + toonVert,
    fragmentShader: toonFrag,
    uniforms: {
      lit: { value: rgb(pair[0]) }, shade: { value: rgb(pair[1]) }, light: { value: new THREE.Vector3(0, 1, 0) }, camPos: { value: new THREE.Vector3() },
      glowCol: { value: hex(style.glow || '#6fa8ff').lerp(new THREE.Vector3(1, 1, 1), 0.25) },
      metal: { value: mat === 'metal' ? 1 : mat === 'accent' ? 0.5 : 0 }, glow: { value: mat === 'glow' ? 1 : 0 }, tone: { value: T.tone ? 1 : 0 },
      hot: { value: 0 }, hitT: { value: 0 }, hitPos: { value: new THREE.Vector3() }, glowK: { value: 1 }, ghostA: { value: 1 }, revealY: { value: 1e6 },
    },
  });
  if (mat === 'glow') { m.transparent = true; m.blending = THREE.AdditiveBlending; m.depthWrite = false; m.userData.glow = true; }
  // dormant hostiles are ghosts (alpha 0.22 on Canvas): blended, no depth write, no outline pass
  if (ghost && mat !== 'glow') { m.transparent = true; m.depthWrite = false; m.userData.glow = true; }
  byMat.set(mk, m); return m;
}

// ---- meshes: one per part, positions written in world space every frame -------------------------
const meshes = new Map();
function trisOf(P) { const t = []; for (const F of P.faces) for (let j = 1; j < F.idx.length - 1; j++) t.push([F, F.idx[0], F.idx[j], F.idx[j + 1]]); return t; }
let frameNo = 0;
function setPerMesh(renderer_, scene_, camera_, geometry, material) {
  const u = material.uniforms, d = this.userData; if (!u) return;
  if (u.partId) { u.partId.value = d.partId || 0; u.fade.value = d.fade ?? 1; u.hostile.value = d.world ? 0 : 1; material.uniformsNeedUpdate = true; return; }
  if (u.wFade) { u.wFade.value = d.fade ?? 1; u.box.value = d.box || 0; u.seed.value = d.seed || 0; u.y0.value = d.y0 || 0; u.hgt.value = d.hgt || 1; u.ext.value.set(d.cx || 0, d.cz || 0, d.w || 1, d.d || 1); const wf = d.win || [0, 0, 0, 0]; u.win.value.set(wf[0], wf[1], wf[2], wf[3]); material.uniformsNeedUpdate = true; return; }
  if (!u.hot) return;
  u.hot.value = d.hot || 0; u.hitT.value = d.hitT || 0; u.glowK.value = d.glowK ?? 1; u.ghostA.value = d.ghost || 1; u.revealY.value = d.revealY ?? 1e6; if (d.hitPos) u.hitPos.value.set(d.hitPos[0], d.hitPos[1], d.hitPos[2]);
  material.uniformsNeedUpdate = true;
}
const hashKey = k => { const s = typeof k === 'string' ? k : (k.__hid ??= Math.random().toString(36).slice(2)); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 4093 + 1) / 4096; };
const lineMat = new THREE.LineBasicMaterial({ color: 0x06070a, transparent: true, opacity: 0.5, depthWrite: false });
function meshFor(I) {
  const key = I.key || I.P.dyn || I.P; let m = meshes.get(key);
  if (!m) {
    const tris = trisOf(I.P), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.length * 9), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(tris.length * 9), 3));
    const mesh = new THREE.Mesh(geo); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.onBeforeRender = setPerMesh; mesh.userData.partId = hashKey(key); scene.add(mesh);
    // panel lines across quads, as the Canvas renderer draws them (pts0->pts3 / pts1->pts2 at fractions)
    const panels = []; for (const F of I.P.faces) if (F.lines && F.idx.length === 4) for (let j = 1; j <= F.lines; j++) panels.push([F, j / (F.lines + 1)]);
    let lines = null; if (panels.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(panels.length * 6), 3)); lines = new THREE.LineSegments(lg, lineMat); lines.frustumCulled = false; lines.matrixAutoUpdate = false; scene.add(lines); }
    m = { mesh, geo, tris, key, panels, lines }; meshes.set(key, m);
  }
  if (I.P.dyn) m.tris = trisOf(I.P);
  m.used = frameNo; return m;
}
function writeMesh(m, I) {
  const pos = m.geo.attributes.position.array, nor = m.geo.attributes.normal.array, R = I.R, wv = I.wv;
  // main.js bone frames can be mirrored (the chassis root maps local +z to world forward with det -1):
  // normals still transform by R, but the triangle winding flips, so swap it back for front-face culling.
  const det = R[0] * (R[4] * R[8] - R[5] * R[7]) - R[1] * (R[3] * R[8] - R[5] * R[6]) + R[2] * (R[3] * R[7] - R[4] * R[6]);
  let o = 0;
  for (const [F, a, b, c] of m.tris) {
    const n = F.n, nx = R[0] * n[0] + R[1] * n[1] + R[2] * n[2], ny = R[3] * n[0] + R[4] * n[1] + R[5] * n[2], nz = R[6] * n[0] + R[7] * n[1] + R[8] * n[2];
    for (const i of det < 0 ? [a, c, b] : [a, b, c]) { const v = wv[i]; pos[o] = v[0]; pos[o + 1] = v[1]; pos[o + 2] = v[2]; nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz; o += 3; }
  }
  m.geo.attributes.position.needsUpdate = true; m.geo.attributes.normal.needsUpdate = true;
  if (m.lines) {
    const lp = m.lines.geometry.attributes.position.array; let k = 0;
    for (const [F, t] of m.panels) { const q = F.idx.map(i => wv[i]), n = F.n, off = [R[0] * n[0] + R[1] * n[1] + R[2] * n[2], R[3] * n[0] + R[4] * n[1] + R[5] * n[2], R[6] * n[0] + R[7] * n[1] + R[8] * n[2]];
      // one segment: from the point t of the way along edge 0->3 to the point t along edge 1->2,
      // lifted a few mm off the face so it never z-fights with it
      for (const [A, B] of [[q[0], q[3]], [q[1], q[2]]]) { for (let c = 0; c < 3; c++) lp[k + c] = A[c] + (B[c] - A[c]) * t + off[c] * 0.006; k += 3; }
    }
    m.lines.geometry.attributes.position.needsUpdate = true;
  }
}

// ---- occluders: building envelopes written to depth only, so they hide what stands behind them ----
const occMat = new THREE.MeshBasicMaterial({ colorWrite: false });
const occBox = new THREE.BoxGeometry(1, 1, 1);
const occluders = [];
function syncOccluders(list) {
  while (occluders.length < list.length) { const m = new THREE.Mesh(occBox, occMat); m.frustumCulled = false; m.userData.occluder = true; scene.add(m); occluders.push(m); }
  occluders.forEach((m, i) => { const b = list[i]; m.visible = !!b; if (b) { m.position.set(b.x, b.h / 2, b.z); m.scale.set(b.w, b.h, b.d); m.updateMatrix(); m.updateMatrixWorld(true); } });
}


// ---- world: recorded boxes / cylinders / lines from main.js --------------------------------------
// Solids use the Canvas world cel rule (top / lit / shade tones, gold under SYNC) and draw the facade
// illustration per pixel: panel seams every 3.2 m x 6 m, window rows (some lit) on tall faces, a yellow /
// ink hazard skirt at ground level. Lines are fat lines added on top of the solids, depth-tested.
const worldMat = new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3,
  vertexShader: /* glsl */`
    precision highp float;
    in vec3 position; in vec3 normal;
    uniform mat4 projectionMatrix, viewMatrix, modelMatrix;
    out vec3 vN; out vec3 vW;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal); /* non-uniform scale: normals need the inverse transpose */ gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform vec3 light, camPos, celTop, celLit, celShade, haze; uniform float sync, wFade, box, seed, y0, hgt; uniform vec4 ext, win;
    in vec3 vN; in vec3 vW; out vec4 o;
    float hsh(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
    vec3 cel(vec3 c){ float L = (c.r + c.g + c.b) / 3.0; return mix(c, vec3(L * 2.1 + 10.0 / 255.0, L * 1.45 + 4.0 / 255.0, L * 0.45), sync); }
    float lineAt(float x, float step_, float maxX){ if (x < step_ * 0.5 || x > maxX - step_ * 0.25) return 0.0; float d = abs(fract(x / step_ + 0.5) - 0.5) * step_; return 1.0 - smoothstep(fwidth(x) * 0.5, fwidth(x) * 1.4, d); }
    void main(){
      vec3 n = normalize(vN), V = normalize(camPos - vW);
      vec3 c = n.y > 0.5 ? celTop : (dot(n.xz, light.xz) > 0.0 && n.y > -0.5 ? celLit : celShade);
      c = cel(c);
      if (box > 0.5 && abs(n.y) < 0.5 && hgt > 1.5 && ext.z * ext.w > 6.0) {
        float xa = ext.x - ext.z * 0.5, xb = ext.x + ext.z * 0.5, za = ext.y - ext.w * 0.5, zb = ext.y + ext.w * 0.5, u, Wm, fi;
        if (n.z < -0.5) { u = vW.x - xa; Wm = ext.z; fi = 0.0; } else if (n.x > 0.5) { u = vW.z - za; Wm = ext.w; fi = 1.0; } else if (n.z > 0.5) { u = xb - vW.x; Wm = ext.z; fi = 2.0; } else { u = zb - vW.z; Wm = ext.w; fi = 3.0; }
        float v = vW.y - y0;
        // like the Canvas renderer: facade detail only on faces that are large on screen (> ~70 px)
        if (Wm >= 1.5 && Wm / max(fwidth(u), 1e-4) > 70.0 && hgt / max(fwidth(v), 1e-4) > 70.0) {
          float seam = max(lineAt(v, 3.2, hgt), lineAt(u, 6.0, Wm));
          c = mix(c, vec3(0.004, 0.016, 0.016), seam * 0.7);
          if (hgt > 5.0 && win[int(fi)] > 0.5) {
            float r = floor((v - 1.6) / 3.2 + 0.5), vc = 1.6 + r * 3.2, cols = max(0.0, floor((Wm - 1.0 - 1.4) / 2.4) + 1.0), cc = floor((u - 1.4) / 2.4 + 0.5), uc = 1.4 + cc * 2.4, idx = r * cols + cc;
            if (r >= 0.0 && vc < hgt - 1.0 && cc >= 0.0 && uc < Wm - 1.0 && idx < 48.0 && abs(u - uc) < 0.45 && abs(v - vc) < 0.5) {
              bool lit = fract(sin(dot(vec2(idx + fi * 13.0, mod(seed, 97.0)), vec2(12.9898, 78.233))) * 43758.5453) > 0.62;
              c = lit ? mix(c, vec3(150.0, 240.0, 226.0) / 255.0, 0.55 * 0.8) : mix(c, vec3(2.0, 8.0, 10.0) / 255.0, 0.85 * 0.8);
            }
          }
          if (y0 < 0.1 && hgt > 2.0) {
            float hb = min(hgt, 0.9), nS = max(2.0, floor(Wm / 1.1 + 0.5)), k = floor(u / (Wm / nS));
            if (v < hb && mod(k, 2.0) < 0.5) c = mix(c, vec3(217.0, 180.0, 67.0) / 255.0, 0.85);
            c = mix(c, vec3(0.004, 0.016, 0.016), (1.0 - smoothstep(0.0, fwidth(v) * 1.2, abs(v - hb))) * 0.9);
          }
        }
      }
      // distance fades a solid into the horizon haze but never makes it see-through: what it hides
      // must look like it is in the way
      o = vec4(mix(haze, c, wFade), 1.0);
    }`,
  uniforms: { celTop: { value: new THREE.Vector3() }, celLit: { value: new THREE.Vector3() }, celShade: { value: new THREE.Vector3() }, light: { value: new THREE.Vector3(0, 1, 0) }, camPos: { value: new THREE.Vector3() }, sync: { value: 0 }, wFade: { value: 1 }, haze: { value: new THREE.Vector3() }, box: { value: 1 }, seed: { value: 0 }, y0: { value: 0 }, hgt: { value: 1 }, ext: { value: new THREE.Vector4() }, win: { value: new THREE.Vector4() } },
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
  // solids are opaque (alpha 1); the premultiplied blend is kept so nothing else changes
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
});
const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const cylGeos = new Map();
const cylGeo = ratio => { const k = Math.round(ratio * 50) / 50; let g = cylGeos.get(k); if (!g) { g = new THREE.CylinderGeometry(k, 1, 1, 24, 1, false).translate(0, 0.5, 0); g = g.toNonIndexed(); g.computeVertexNormals(); cylGeos.set(k, g); } return g; };
const boxPool = [], cylPool = [];
function poolMesh(pool, i, geo) {
  let m = pool[i];
  if (!m) { m = new THREE.Mesh(geo, worldMat); m.frustumCulled = false; m.onBeforeRender = setPerMesh; m.userData.world = true; m.renderOrder = -1; /* before hostiles, whose parts all sit at the origin: in the normal + depth pass the world is depth only and must be there first to hide them */ m.userData.partId = ((pool === boxPool ? 1 : 2) * 1009 + i * 37) % 4093 / 4096 + 1 / 8192; scene.add(m); pool[i] = m; }
  if (m.geometry !== geo) m.geometry = geo;
  return m;
}
const dotMat = new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    precision highp float;
    in vec3 position; in vec4 color; in vec3 size;
    uniform mat4 projectionMatrix, viewMatrix; uniform float focal, dpr;
    out vec4 vC;
    void main(){ vec4 p = viewMatrix * vec4(position, 1.0); vC = color; gl_Position = projectionMatrix * p;
      gl_PointSize = 2.0 * clamp(size.x * focal / max(0.1, -p.z), size.y, size.z) * dpr + 1.0; }`,
  fragmentShader: /* glsl */`
    precision highp float;
    in vec4 vC; out vec4 o;
    void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float k = 1.0 - smoothstep(0.55, 1.0, r); o = vec4(vC.rgb * vC.a * k, vC.a * k); }`,
  uniforms: { focal: { value: 800 }, dpr: { value: 1 } },
});
const dotGeo = new THREE.BufferGeometry();
const dots = new THREE.Points(dotGeo, dotMat); dots.frustumCulled = false; dots.userData.line = true; scene.add(dots);
function syncWorld(W, o) {
  let bi = 0, ci = 0;
  if (W) {
    for (const b of W.boxes) {
      const m = poolMesh(boxPool, bi++, boxGeo); m.position.set(b.cx, b.y0, b.cz); m.scale.set(b.w, Math.max(0.01, b.y1 - b.y0), b.d); m.updateMatrix(); m.updateMatrixWorld(true);
      // which faces carry windows: the same hash as the Canvas renderer, on the CPU (GPU sin drifts on big arguments)
      const seed = Math.floor(b.cx * 7.13 + b.cz * 3.71 + b.y0 * 11), hs = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
      Object.assign(m.userData, { box: 1, fade: b.alpha ?? 1, seed, win: [0, 1, 2, 3].map(i => !b.plain && hs(seed + i) > 0.4 ? 1 : 0), y0: b.y0, hgt: b.y1 - b.y0, cx: b.cx, cz: b.cz, w: b.w, d: b.d }); m.visible = true;
      // roof rail on camera-facing faces that are large on screen, when looking up at the roof
      const hgt = b.y1 - b.y0;
      if (hgt > 4 && o.camY < b.y1 && b.w * b.d > 6 && !b.plain) { const xa = b.cx - b.w / 2, xb = b.cx + b.w / 2, za = b.cz - b.d / 2, zb = b.cz + b.d / 2,
          faces = [[[xa, za], [xb, za], o.pz < za], [[xb, za], [xb, zb], o.px > xb], [[xb, zb], [xa, zb], o.pz > zb], [[xa, zb], [xa, za], o.px < xa]], ink = [1, 4, 4], a = 0.8 * (b.alpha ?? 1);
        for (const [A, B, vis] of faces) { if (!vis) continue; const Wm = Math.hypot(B[0] - A[0], B[1] - A[1]), dist = Math.max(1, Math.hypot((A[0] + B[0]) / 2 - o.px, (A[1] + B[1]) / 2 - o.pz)); if (Wm < 1.5 || Wm * o.focal / dist < 70) continue;
          for (const dy of [1.1, 0.55]) W.lines.push(A[0], b.y1 + dy, A[1], B[0], b.y1 + dy, B[1], ...ink, a, 1.2, 1);
          for (let q = 0; q <= Math.ceil(Wm / 2); q++) { const u = Math.min(1, q * 2 / Wm), x = A[0] + (B[0] - A[0]) * u, z = A[1] + (B[1] - A[1]) * u; W.lines.push(x, b.y1, z, x, b.y1 + 1.1, z, ...ink, a, 1.2, 1); } } }
      // the Canvas accent edges: the 12 box edges in the box's edge colour
      if (b.edgeAlpha > 0) { const xa = b.cx - b.w / 2, xb = b.cx + b.w / 2, za = b.cz - b.d / 2, zb = b.cz + b.d / 2, P = [[xa, za], [xb, za], [xb, zb], [xa, zb]], a = Math.min(1, b.edgeAlpha);
        for (let k = 0; k < 4; k++) { const A = P[k], B = P[(k + 1) % 4]; for (const y of [b.y0, b.y1]) W.lines.push(A[0], y, A[1], B[0], y, B[1], b.edge[0], b.edge[1], b.edge[2], a, 0.72, 0); W.lines.push(A[0], b.y0, A[1], A[0], b.y1, A[1], b.edge[0], b.edge[1], b.edge[2], a, 0.72, 0); } }
    }
    for (const c of W.cyls) {
      const m = poolMesh(cylPool, ci++, cylGeo(c.r1 / Math.max(0.01, c.r0))); m.position.set(c.cx, c.y0, c.cz); m.scale.set(c.r0, Math.max(0.01, c.y1 - c.y0), c.r0); m.updateMatrix(); m.updateMatrixWorld(true);
      Object.assign(m.userData, { box: 0, fade: c.alpha ?? 1 }); m.visible = true;
    }
  }
  for (let i = bi; i < boxPool.length; i++) boxPool[i].visible = false;
  for (let i = ci; i < cylPool.length; i++) cylPool[i].visible = false;
  dots.visible = false;
  if (!W) return;
  if (W.dots.length) {
    const D = W.dots, n = D.length / 10, pos = new Float32Array(n * 3), col = new Float32Array(n * 4), sz = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const j = i * 10; pos.set([D[j], D[j + 1], D[j + 2]], i * 3); col.set([D[j + 3] / 255, D[j + 4] / 255, D[j + 5] / 255, D[j + 6]], i * 4); sz.set([D[j + 7], D[j + 8], D[j + 9]], i * 3); }
    dotGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dotGeo.setAttribute('color', new THREE.BufferAttribute(col, 4)); dotGeo.setAttribute('size', new THREE.BufferAttribute(sz, 3));
    dotMat.uniforms.focal.value = o.focal; dotMat.uniforms.dpr.value = o.DPR; dots.visible = true;
  }
  // world lines join the stroke batches: light lines add, ink lines (dark decks, roof rails: ink 1) are laid
  // over at .9, ground-style lines (ink 2) over at their own alpha
  const F = W.lines;
  for (let i = 0; i < F.length; i += 12) {
    const ink = F[i + 11], a = ink === 1 ? 0.9 : F[i + 9];
    (ink ? W.segsN : W.segsA).push(F[i], F[i + 1], F[i + 2], 1, F[i + 3], F[i + 4], F[i + 5], 1, F[i + 6], F[i + 7], F[i + 8], a, F[i + 10], 0, 0, 0);
  }
}

// ---- strokes: instanced segments and discs, the Canvas line / arc drawing on the GPU ---------------
// A segment is two points, either projected screen points with their depth (mode 0, the overlay effects
// main.js already projects) or world points (mode 1, clipped at the near plane here). The quad is laid
// out in screen space around the two ends and the fragment measures its distance to the segment, so
// width, round caps, dashes and a soft shadow-blur halo come out as on Canvas, at any depth.
const fxU = { scr: { value: new THREE.Vector2(1, 1) }, dpr: { value: 1 }, nearZ: { value: 0.1 }, zA: { value: 1 }, zB: { value: 0 } };
const clipGLSL = /* glsl */`
  uniform mat4 projectionMatrix, viewMatrix; uniform vec2 scr; uniform float dpr, nearZ, zA, zB;
  vec4 clipScreen(vec3 p){ vec2 n = vec2(p.x / scr.x * 2.0 - 1.0, 1.0 - p.y / scr.y * 2.0); return vec4(n * p.z, zA * p.z + zB, p.z); }
  vec2 devPx(vec4 c){ return (c.xy / c.w * 0.5 + 0.5) * scr * dpr; }
  vec4 atPx(vec2 s, vec4 c){ return vec4((s / (scr * dpr) * 2.0 - 1.0) * c.w, c.z, c.w); }`;
const segVert = /* glsl */`
  precision highp float;
  in vec2 position; in vec4 iA, iB, iCol, iW;
  ${clipGLSL}
  flat out vec2 dA, dB; flat out vec4 vCol, vW;
  void main(){
    vec4 cA, cB;
    if (iA.w > 0.5) {
      vec4 vA = viewMatrix * vec4(iA.xyz, 1.0), vB = viewMatrix * vec4(iB.xyz, 1.0);
      if (vA.z > -nearZ && vB.z > -nearZ) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      if (vA.z > -nearZ) vA = mix(vA, vB, (vA.z + nearZ) / (vA.z - vB.z));
      else if (vB.z > -nearZ) vB = mix(vB, vA, (vB.z + nearZ) / (vB.z - vA.z));
      cA = projectionMatrix * vA; cB = projectionMatrix * vB;
    } else { cA = clipScreen(iA.xyz); cB = clipScreen(iB.xyz); }
    vec2 sA = devPx(cA), sB = devPx(cB), d = sB - sA; float L = length(d);
    vec2 u = L > 1e-4 ? d / L : vec2(1.0, 0.0), nn = vec2(-u.y, u.x);
    float hw = iW.x * dpr * 0.5 + 1.0 + iW.w * dpr * 1.5;
    bool atA = position.x < 0.0;
    gl_Position = atPx((atA ? sA - u * hw : sB + u * hw) + nn * position.y * hw, atA ? cA : cB);
    dA = sA; dB = sB; vCol = vec4(iCol.rgb / 255.0, iCol.a); vW = iW * dpr;
  }`;
const segFrag = /* glsl */`
  precision highp float;
  flat in vec2 dA, dB; flat in vec4 vCol, vW; out vec4 o;
  void main(){
    vec2 p = gl_FragCoord.xy, d = dB - dA; float L2 = dot(d, d), t = L2 > 1e-6 ? clamp(dot(p - dA, d) / L2, 0.0, 1.0) : 0.0;
    if (vW.y > 0.0 && L2 > 1e-6) { float along = dot(p - dA, d) * inversesqrt(L2); if (mod(along, vW.y + vW.z) > vW.y) discard; }
    float dist = length(p - (dA + d * t)), hw = vW.x * 0.5, a = clamp(hw + 0.5 - dist, 0.0, 1.0);
    if (vW.w > 0.0) { float s = max(vW.w * 0.5, 0.5), g = exp(-pow(max(0.0, dist - hw), 2.0) / (2.0 * s * s)) * 0.6; a = a + (1.0 - a) * g; }
    a *= vCol.a; if (a < 0.002) discard;
    o = vec4(vCol.rgb * a, a);
  }`;
const discVert = /* glsl */`
  precision highp float;
  in vec2 position; in vec4 iC, iR, iCol;
  ${clipGLSL}
  flat out vec2 cen; flat out vec4 vR, vCol;
  void main(){
    vec4 c = iC.w > 0.5 ? projectionMatrix * viewMatrix * vec4(iC.xyz, 1.0) : clipScreen(iC.xyz);
    vec2 s = devPx(c); float R = (iR.x + iR.y * 0.5) * dpr + 1.5, asp = max(iR.z, 0.02);
    gl_Position = atPx(s + position * vec2(R, R * asp + 1.5), c);
    cen = s; vR = vec4(iR.x * dpr, iR.y * dpr, asp, iR.w); vCol = vec4(iCol.rgb / 255.0, iCol.a);
  }`;
const discFrag = /* glsl */`
  precision highp float;
  flat in vec2 cen; flat in vec4 vR, vCol; out vec4 o;
  void main(){
    vec2 q = gl_FragCoord.xy - cen; q.y /= vR.z; float r = length(q), a;
    if (vR.w > 0.5) { float t = r / max(vR.x, 1e-3); a = t >= 1.0 ? 0.0 : t < 0.28 ? mix(1.0, 0.355, t / 0.28) : mix(0.355, 0.0, (t - 0.28) / 0.72); } // canvas radial light: .62 / .22 / 0
    else if (vR.y > 0.0) a = clamp(vR.y * 0.5 + 0.5 - abs(r - vR.x), 0.0, 1.0);
    else a = clamp(vR.x + 0.5 - r, 0.0, 1.0);
    a *= vCol.a; if (a < 0.002) discard;
    o = vec4(vCol.rgb * a, a);
  }`;
function strokeMat(vert, frag, add, depthTest = true) {
  return new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vert, fragmentShader: frag, uniforms: fxU, transparent: true, depthWrite: false, depthTest,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: add ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: add ? THREE.ZeroFactor : THREE.OneFactor, blendDstAlpha: add ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor });
}
// strokes and ground quads are rewritten every frame and never culled: a fixed sphere keeps three from
// measuring the 2D corner attribute (NaN) when it sorts the transparent list
const ALL = new THREE.Sphere(new THREE.Vector3(), Infinity);
const CORNERS = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
// one instanced mesh per kind and blend; the instance buffer only grows
function strokeBatch(vert, frag, add, stride, layout, order, depthTest = true) {
  const geo = new THREE.InstancedBufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(CORNERS, 2)); geo.instanceCount = 0; geo.boundingSphere = ALL;
  const mesh = new THREE.Mesh(geo, strokeMat(vert, frag, add, depthTest)); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.userData.line = true; mesh.visible = false; scene.add(mesh);
  let cap = 0, buf = null;
  return arr => {
    const n = arr ? arr.length / stride : 0; mesh.visible = n > 0; if (!n) return;
    if (n > cap) { cap = Math.max(256, Math.ceil(n * 1.5)); geo.dispose(); buf = new THREE.InstancedInterleavedBuffer(new Float32Array(cap * stride), stride); buf.setUsage(THREE.DynamicDrawUsage);
      for (const [name, off] of layout) geo.setAttribute(name, new THREE.InterleavedBufferAttribute(buf, 4, off)); }
    buf.array.set(arr); buf.clearUpdateRanges(); buf.addUpdateRange(0, n * stride); buf.needsUpdate = true; geo.instanceCount = n;
  };
}
const SEG = [['iA', 0], ['iB', 4], ['iCol', 8], ['iW', 12]], DISC = [['iC', 0], ['iR', 4], ['iCol', 8]];
const fx = {
  ground1: strokeBatch(segVert, segFrag, false, 16, SEG, -5), ground2: strokeBatch(segVert, segFrag, false, 16, SEG, -3),
  discsN: strokeBatch(discVert, discFrag, false, 12, DISC, -2), segsN: strokeBatch(segVert, segFrag, false, 16, SEG, 1),
  segsA: strokeBatch(segVert, segFrag, true, 16, SEG, 2), discsA: strokeBatch(discVert, discFrag, true, 12, DISC, 3),
  // blast light: a soft screen glow as on Canvas, not cut by the walls in front of it (a billboard at one
  // depth would be cut into blocks by every facade edge)
  glows: strokeBatch(discVert, discFrag, true, 12, DISC, 4, false),
};
// flat ground quads (slabs, hatches, deck tiles) with vertex colour, in the order they were recorded
const quadMat = new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3,
  vertexShader: 'precision highp float;\nin vec3 position; in vec4 color; uniform mat4 projectionMatrix, viewMatrix; out vec4 vC;\nvoid main(){ vC = vec4(color.rgb / 255.0, color.a); gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'precision highp float;\nin vec4 vC; out vec4 o;\nvoid main(){ o = vec4(vC.rgb * vC.a, vC.a); }',
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
});
function quadBatch(order) {
  const geo = new THREE.BufferGeometry(), mesh = new THREE.Mesh(geo, quadMat); geo.boundingSphere = ALL; mesh.frustumCulled = false; mesh.renderOrder = order; mesh.userData.line = true; mesh.visible = false; scene.add(mesh);
  let cap = 0, pos = null, col = null;
  return Q => {
    const n = Q ? Q.length / 16 : 0; mesh.visible = n > 0; if (!n) return;
    if (n > cap) { cap = Math.max(128, Math.ceil(n * 1.5)); geo.dispose(); pos = new THREE.BufferAttribute(new Float32Array(cap * 18), 3); col = new THREE.BufferAttribute(new Float32Array(cap * 24), 4); pos.setUsage(THREE.DynamicDrawUsage); col.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('position', pos); geo.setAttribute('color', col); }
    const P = pos.array, C = col.array;
    for (let i = 0; i < n; i++) { const j = i * 16; let k = 0; for (const v of [0, 1, 2, 0, 2, 3]) { const p = i * 18 + k * 3, c = i * 24 + k * 4; P[p] = Q[j + v * 3]; P[p + 1] = Q[j + v * 3 + 1]; P[p + 2] = Q[j + v * 3 + 2]; C[c] = Q[j + 12]; C[c + 1] = Q[j + 13]; C[c + 2] = Q[j + 14]; C[c + 3] = Q[j + 15]; k++; } }
    pos.needsUpdate = true; col.needsUpdate = true; geo.setDrawRange(0, n * 6);
  };
}
const groundQ1 = quadBatch(-6), groundQ2 = quadBatch(-4);
function syncStrokes(W) {
  groundQ1(W && W.groundQ1); groundQ2(W && W.groundQ2);
  for (const k in fx) fx[k](W && W[k]);
}

// ---- sky and the ground's base tone: drawSky / drawGround's first fill as a full-screen pass ----------
const skyMat = new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
  vertexShader: 'precision highp float;\nin vec3 position;\nvoid main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`
    precision highp float;
    uniform vec2 scr, ppos; uniform float dpr, hy, gy0, gy1, ga, moon, yaw, foc, camY; uniform vec3 gc, c0, c1, c2, c3, gnd; out vec4 o;
    // SECTOR 01, the Moon: a black sky with stars, Earth hung low ahead, and regolith with craters out past the
    // facility strip. Directions follow main.js project(): yaw-only camera, pitch as a lens shift (hy), so a pixel's
    // azimuth is yaw + atan(dx / foc) and the tangent of its elevation is (hy - y) cos(rel) / foc.
    const float PI2 = 6.2831853, EAZ = 0.08, EEL = 0.25, ER = 0.05;
    float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fb3(vec3 p){ float a = 0.5, r = 0.0; for (int i = 0; i < 5; i++) { r += a * n3(p); p = p * 2.03 + 11.7; a *= 0.5; } return r; }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
    // one crater per cell at most; the wall that faces Earth (earthshine) is the lit one
    float crater(vec2 w, float cell, float odds, vec2 L){
      vec2 id = floor(w / cell), f = w / cell - id; float h = h21(id + cell);
      if (h > odds) return 0.0;
      float r = 0.18 + 0.27 * h21(id + 3.1); vec2 c = vec2(0.5) + (vec2(h21(id + 7.7), h21(id + 1.3)) - 0.5) * (0.98 - 2.0 * r);
      vec2 v = f - c; float d = length(v) / r; if (d > 1.35) return 0.0;
      float bowl = d < 1.0 ? (-0.55 * dot(normalize(v + 1e-4), L) * d - 0.18 * (1.0 - d * d)) : 0.0;
      return bowl + 0.22 * exp(-pow((d - 1.02) * 7.0, 2.0)) * (0.6 + 0.4 * dot(normalize(v + 1e-4), L));
    }
    vec3 regolith(float dx, float dy){
      float cz = camY * foc / max(dy, 0.35), cx = dx * cz / foc, sn = sin(yaw), cs = cos(yaw);
      vec2 w = ppos + vec2(cx * cs + cz * sn, cx * sn - cz * cs);
      if (abs(w.x) < 38.5 && abs(w.y) < 151.0) return gnd;
      vec2 L = vec2(sin(EAZ), -cos(EAZ));
      float k = clamp(1.0 - cz / 260.0, 0.0, 1.0), kf = clamp(1.0 - cz / 70.0, 0.0, 1.0);
      float g = 0.82 + 0.3 * (n2(w * 0.045) - 0.5) + 0.22 * kf * (n2(w * 0.9) - 0.5);
      g += k * (crater(w, 26.0, 0.55, L) + 0.8 * crater(w + 13.0, 9.0, 0.45, L)) + kf * 0.7 * crater(w + 5.0, 3.2, 0.4, L);
      return vec3(52.0, 55.0, 63.0) / 255.0 * max(g, 0.25);
    }
    vec3 moonSky(float dx, float y){
      float rel = atan(dx, foc), A = mod(yaw + rel, PI2), el = atan((hy - y) * cos(rel) / foc);
      vec3 c = mix(vec3(1.0, 1.5, 3.0), vec3(3.0, 4.0, 7.0), clamp(1.0 - el / 0.5, 0.0, 1.0)) / 255.0;
      // stars on a fixed azimuth / elevation lattice, so they hold still in the sky while the head turns
      const float CS = PI2 / 900.0; vec2 sp = vec2(A, el) / CS, id = floor(sp); float h = h21(id + 0.5);
      if (h < 0.075) { vec2 at = 0.2 + 0.6 * vec2(h21(id + 2.2), h21(id + 9.4)); vec2 dv = (sp - id - at) * CS * foc; dv.x *= cos(el);
        float b = pow(h21(id + 4.4), 3.0), rad = 0.9 + 1.2 * b; c += mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.93, 0.82), h21(id + 6.6)) * (0.55 + 0.75 * b) * smoothstep(rad, 0.0, length(dv)); }
      // Earth: a gibbous disc lit from the right, oceans, land, cloud, a thin blue limb and a few city lights on the night side
      float da = mod(A - EAZ + PI2 * 0.5, PI2) - PI2 * 0.5; vec2 q = vec2(da * cos(el), el - EEL) / ER; float r = length(q);
      vec3 Ls = normalize(vec3(0.78, 0.22, 0.42));
      if (r < 1.0) {
        vec3 n = vec3(q, sqrt(1.0 - r * r)); float lam = dot(n, Ls), day = smoothstep(-0.06, 0.18, lam);
        float land = smoothstep(0.5, 0.56, fb3(n * 2.3 + 4.0)), cl = smoothstep(0.52, 0.74, fb3(n * 4.2 + vec3(9.0, 2.0, 5.0)));
        vec3 surf = mix(vec3(0.04, 0.13, 0.36), mix(vec3(0.20, 0.30, 0.13), vec3(0.50, 0.42, 0.28), n3(n * 6.0)), land);
        surf = mix(surf, vec3(0.93, 0.95, 0.98), cl * 0.9);
        vec3 e = surf * (0.03 + 1.15 * max(lam, 0.0)) * day + vec3(0.35, 0.6, 1.0) * pow(1.0 - n.z, 2.5) * 0.9 * day;
        e += vec3(1.0, 0.62, 0.25) * land * (1.0 - day) * (1.0 - cl) * step(0.82, n3(n * 40.0)) * 0.35;
        c = mix(c, e, smoothstep(1.0, 1.0 - 1.8 / (ER * foc), r));
      } else {
        float side = clamp(dot(q / r, Ls.xy / length(Ls.xy)) * 0.6 + 0.4, 0.0, 1.0);
        c += vec3(0.3, 0.52, 1.0) * 0.22 * side * exp(-(r - 1.0) * 22.0);
      }
      return c;
    }
    void main(){
      float y = scr.y - gl_FragCoord.y / dpr;
      if (moon > 0.5) { float dx = gl_FragCoord.x / dpr - scr.x * 0.5; o = vec4(y >= hy ? regolith(dx, y - hy) : moonSky(dx, y), 1.0); return; }
      if (y >= hy) { o = vec4(gnd, 1.0); return; }
      float t = clamp(y / scr.y, 0.0, 1.0);
      vec3 c = t < 0.42 ? mix(c0, c1, t / 0.42) : t < 0.70 ? mix(c1, c2, (t - 0.42) / 0.28) : mix(c2, c3, (t - 0.70) / 0.30);
      if (y > hy - scr.y * 0.12) {
        float u = clamp((y - gy0) / max(gy1 - gy0, 1.0), 0.0, 1.0);
        vec4 g = u < 0.58 ? mix(vec4(vec3(29.0, 112.0, 91.0) / 255.0, 0.0), vec4(gc, ga), u / 0.58) : mix(vec4(gc, ga), vec4(vec3(21.0, 79.0, 66.0) / 255.0, 0.0), (u - 0.58) / 0.42);
        c = mix(c, g.rgb, g.a);
      }
      float d = hy - y;
      c = mix(c, vec3(99.0, 255.0, 211.0) / 255.0, 0.065 * clamp(1.0 - d, 0.0, 1.0));
      c += vec3(85.0, 255.0, 208.0) / 255.0 * 0.03 * exp(-d * d / 12.5);
      o = vec4(c, 1.0);
    }`,
  uniforms: { scr: fxU.scr, dpr: fxU.dpr, hy: { value: 0 }, gy0: { value: 0 }, gy1: { value: 1 }, ga: { value: 0 }, gc: { value: new THREE.Vector3() }, c0: { value: new THREE.Vector3() }, c1: { value: new THREE.Vector3() }, c2: { value: new THREE.Vector3() }, c3: { value: new THREE.Vector3() }, gnd: { value: new THREE.Vector3() }, moon: { value: 0 }, yaw: { value: 0 }, foc: { value: 1 }, camY: { value: 3.25 }, ppos: { value: new THREE.Vector2() } },
});
const skyScene = new THREE.Scene(); skyScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat));

// ---- composite: base colour + ink silhouette (outside only, like the Canvas contour) + creases ----
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene();
const compMat = new THREE.RawShaderMaterial({
  vertexShader: /* glsl */`
    precision highp float; attribute vec3 position; varying vec2 vUv;
    void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tC, tN, tI, tA, tB; uniform vec2 px; uniform float r1, r2, thick0, byDepth, bloom; uniform vec3 ink;
    // outline half-width for a surface at depth d (metres): like the Canvas renderer, thick when near,
    // thin from ~60 m on (byDepth), or the fixed r1 for the cockpit layer
    float halfW(float d){ return byDepth > 0.5 ? thick0 * (0.55 + 1.6 * clamp((60.0 - d) / 48.0, 0.0, 1.0)) : r1; }
    varying vec2 vUv;
    vec3 glow(){ return bloom > 0.5 ? texture2D(tA, vUv).rgb * 0.8 + texture2D(tB, vUv).rgb * 0.7 : vec3(0.0); }
    void main(){
      vec4 c = texture2D(tC, vUv), n0 = texture2D(tN, vUv); vec2 idf = texture2D(tI, vUv).rg; float id0 = idf.r, fade0 = idf.g > 0.0 ? idf.g : 1.0;
      float cov = step(0.0001, n0.a), sil = 0.0, inner = 0.0, cre = 0.0;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5235988; vec2 d = vec2(cos(a), sin(a));
        for (int s = 1; s <= 3; s++) {
          vec4 n = texture2D(tN, vUv + d * r1 * float(s) / 3.0 * px);
          float cv = step(0.0001, n.a);
          if (cov < 0.5 && cv > 0.5 && r1 * float(s) / 3.0 <= halfW(n.a * 20.0) + 0.5) { vec2 nf = texture2D(tI, vUv + d * r1 * float(s) / 3.0 * px).rg; sil = max(sil, nf.g > 0.0 ? nf.g : 1.0); }
          else if (cv > 0.5 && n0.a - n.a > 0.004 && s == 1) inner = 1.0;
        }
        vec2 uv2 = vUv + d * r2 * px; vec4 m = texture2D(tN, uv2);
        if (cov > 0.5 && m.a > 0.0) {
          cre = max(cre, smoothstep(0.22, 0.4, 1.0 - dot(n0.rgb * 2.0 - 1.0, m.rgb * 2.0 - 1.0)));
          if (abs(texture2D(tI, uv2).r - id0) > 0.0004 && m.a >= n0.a - 0.0005) cre = 1.0;
        }
      }
      if (cov > 0.5) { cre *= mix(1.0, 0.45, clamp((n0.a * 20.0 - 35.0) / 70.0, 0.0, 1.0)); float a0 = c.a > 0.001 ? c.a : 1.0; vec3 base = c.a > 0.001 ? c.rgb / c.a : c.rgb; gl_FragColor = vec4(mix(base, ink, max(inner, cre * 0.8)) * a0 + glow(), a0); return; }
      gl_FragColor = vec4(ink * sil + c.rgb * (1.0 - sil) + glow(), max(sil, min(1.0, c.a)));
    }`,
  uniforms: { bloom: { value: 0 }, tA: { value: null }, tB: { value: null }, thick0: { value: 1 }, byDepth: { value: 0 }, tC: { value: null }, tN: { value: null }, tI: { value: null }, px: { value: new THREE.Vector2() }, r1: { value: 3 }, r2: { value: 1.2 }, ink: { value: new THREE.Vector3(0.025, 0.03, 0.04) } },
  depthTest: false, depthWrite: false,
});
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat));

// ---- bloom: the Canvas applyBloom on the GPU. Bright pass (brightness 1.1, contrast 2.3) at quarter size,
// blurred 1.2 px, a second blur of 2.4 px at eighth size; the composite adds them at .8 / .7. Hostile and
// debris parts stay out of it as on Canvas (bloomMask), flagged in the id target's third channel; world
// solids are not, so lit windows and neon still bloom.
const blurFrag = (src) => /* glsl */`
  precision highp float;
  uniform sampler2D tC, tI; uniform vec2 px; uniform float sig, step_; varying vec2 vUv;
  vec3 tap(vec2 uv){ ${src} }
  void main(){
    vec3 s = vec3(0.0); float ws = 0.0;
    for (int y = -3; y <= 3; y++) for (int x = -3; x <= 3; x++) { vec2 o = vec2(float(x), float(y)) * step_; float w = exp(-dot(o, o) / (2.0 * sig * sig)); s += tap(vUv + o * px) * w; ws += w; }
    gl_FragColor = vec4(s / ws, 1.0);
  }`;
const quadVS = 'precision highp float; attribute vec3 position; varying vec2 vUv;\nvoid main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const brightMat = new THREE.RawShaderMaterial({ vertexShader: quadVS, depthTest: false, depthWrite: false, uniforms: { tC: { value: null }, tI: { value: null }, px: { value: new THREE.Vector2() }, sig: { value: 1.2 }, step_: { value: 0.5 } },
  fragmentShader: blurFrag(`vec4 c = texture2D(tC, uv); float hostile = step(0.5, texture2D(tI, uv).b);
    vec3 b = c.a > 0.001 ? c.rgb / c.a : c.rgb; return clamp((b * 1.1 - 0.5) * 2.3 + 0.5, 0.0, 1.0) * (1.0 - hostile);`) });
const blurMat = new THREE.RawShaderMaterial({ vertexShader: quadVS, depthTest: false, depthWrite: false, uniforms: { tC: { value: null }, tI: { value: null }, px: { value: new THREE.Vector2() }, sig: { value: 2.4 }, step_: { value: 1.0 } },
  fragmentShader: blurFrag('return texture2D(tC, uv).rgb;') });
const brightScene = new THREE.Scene(), blurScene = new THREE.Scene();
brightScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), brightMat)); blurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat));
let rtA = null, rtB = null;
function bloomPass(w, h) {
  const aw = Math.max(2, w >> 2), ah = Math.max(2, h >> 2), bw = Math.max(2, aw >> 1), bh = Math.max(2, ah >> 1);
  if (!rtA || rtA.width !== aw || rtA.height !== ah) { rtA?.dispose(); rtB?.dispose(); rtA = new THREE.WebGLRenderTarget(aw, ah); rtB = new THREE.WebGLRenderTarget(bw, bh); }
  // the bright pass samples the full-size frame at quarter-size steps (px = one full-size texel, taps .5 quarter texel apart)
  brightMat.uniforms.tC.value = rtColor.texture; brightMat.uniforms.tI.value = rtND.textures[1]; brightMat.uniforms.px.value.set(4 / w, 4 / h);
  renderer.setRenderTarget(rtA); renderer.render(brightScene, quadCam);
  blurMat.uniforms.tC.value = rtA.texture; blurMat.uniforms.px.value.set(1 / aw, 1 / ah);
  renderer.setRenderTarget(rtB); renderer.render(blurScene, quadCam);
  compMat.uniforms.tA.value = rtA.texture; compMat.uniforms.tB.value = rtB.texture;
}

function ensureTargets(w, h) {
  const key = w + 'x' + h; if (key === sizeKey) return; sizeKey = key;
  rtColor?.dispose(); rtND?.dispose();
  rtColor = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
  rtND = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, count: 2 });
  renderer.setSize(w, h, false);
}

// ---- the hook main.js calls --------------------------------------------------------------------
function draw(o) {
  if (!renderer) return false;
  const w = Math.max(1, Math.floor(o.W * o.DPR)), h = Math.max(1, Math.floor(o.H * o.DPR));
  ensureTargets(w, h);
  // camera = main.js project(): yaw-only rotation, pitch as a vertical lens shift, horizon at 0.49 H.
  camera.position.set(o.px, o.camY, o.pz); camera.rotation.set(0, -o.viewYaw, 0); camera.updateMatrixWorld(true);
  const near = Math.max(0.02, o.near * 0.9), far = 400, f = o.focal, e = camera.projectionMatrix.elements;
  e.fill(0); e[0] = 2 * f / o.W; e[5] = 2 * f / o.H; e[9] = (Math.tan(o.viewPitch) * f - 0.01 * o.H) * 2 / o.H;
  e[10] = -(far + near) / (far - near); e[11] = -1; e[14] = -2 * far * near / (far - near);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  frameNo++;
  for (const m of meshes.values()) { m.mesh.visible = false; if (m.lines) m.lines.visible = false; }
  syncOccluders(o.occluders || []);
  syncWorld(o.world, o);
  syncStrokes(o.world);
  fxU.scr.value.set(o.W, o.H); fxU.dpr.value = o.DPR; fxU.nearZ.value = near; fxU.zA.value = -e[10]; fxU.zB.value = e[14];
  const sky = o.world && o.world.sky;
  worldMat.uniforms.light.value.set(o.light[0], o.light[1], o.light[2]); worldMat.uniforms.camPos.value.copy(camera.position); worldMat.uniforms.sync.value = o.syncMix || 0;
  const L = new THREE.Vector3(o.light[0], o.light[1], o.light[2]);
  for (const I of o.insts) {
    if (I.hidden || !I.style) continue;
    const m = meshFor(I); writeMesh(m, I);
    const mat = material(I.style, I.P.mat, I.ghost > 0); mat.uniforms.light.value.copy(L); mat.uniforms.camPos.value.copy(camera.position);
    m.mesh.material = mat; m.mesh.visible = true; if (m.lines) m.lines.visible = true;
    const d = m.mesh.userData; d.hot = I.hot || 0; d.hitT = I.hitT || 0; d.glowK = I.glowK ?? 1; d.hitPos = I.hitPos || null; d.ghost = I.ghost || 0; d.revealY = I.revealY ?? 1e6;
  }
  // parts of broken hostiles leave the scene once unused for a while
  for (const [k, m] of meshes) if (typeof k === 'string' && k[0] === 'e' && frameNo - m.used > 120) { scene.remove(m.mesh); m.geo.dispose(); if (m.lines) { scene.remove(m.lines); m.lines.geometry.dispose(); } meshes.delete(k); }
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 0); renderer.clear();
  if (sky) { const u = skyMat.uniforms; u.hy.value = sky.hy; u.gy0.value = sky.glowY0; u.gy1.value = sky.glowY1; u.ga.value = sky.glowA; u.gc.value.set(sky.glowCol[0] / 255, sky.glowCol[1] / 255, sky.glowCol[2] / 255);
    const v3 = (t, c) => t.set(c[0] / 255, c[1] / 255, c[2] / 255); ['c0', 'c1', 'c2', 'c3'].forEach((k, i) => v3(u[k].value, sky.stops[i])); v3(u.gnd.value, sky.ground);
    u.moon.value = sky.moon || 0; u.yaw.value = sky.yaw || 0; u.foc.value = sky.foc || 1; u.camY.value = sky.camY || 3.25; u.ppos.value.set(sky.px || 0, sky.pz || 0);
    const w = worldMat.uniforms; v3(w.celTop.value, sky.cel[0]); v3(w.celLit.value, sky.cel[1]); v3(w.celShade.value, sky.cel[2]); v3(w.haze.value, sky.stops[3]);
    renderer.render(skyScene, quadCam); }
  renderer.render(scene, camera);
  // normal + depth pass: occluders stay depth-only so they hide hostiles without drawing outlines of their own
  const hidden = [], swapped = [];
  for (const ch of scene.children) {
    if (!ch.visible || ch.userData.occluder) continue;
    if (ch.userData.line || ch.isLineSegments || ch.isPoints || ch.material?.userData?.glow) { ch.visible = false; hidden.push(ch); continue; }
    if (ch.isMesh) { ch.userData.cm = ch.material; ch.material = ch.userData.world ? ndDepthMat : ndMat; swapped.push(ch); }
  }
  renderer.setRenderTarget(rtND); renderer.clear(); renderer.render(scene, camera);
  for (const ch of swapped) ch.material = ch.userData.cm;
  for (const h of hidden) h.visible = true;
  compMat.uniforms.tC.value = rtColor.texture; compMat.uniforms.tN.value = rtND.textures[0]; compMat.uniforms.tI.value = rtND.textures[1]; compMat.uniforms.px.value.set(1 / w, 1 / h);
  const enemiesLayer = o.layer === 'enemies';
  compMat.uniforms.thick0.value = o.DPR * o.H / 720; compMat.uniforms.byDepth.value = enemiesLayer ? 1 : 0;
  compMat.uniforms.r1.value = enemiesLayer ? o.DPR * o.H / 720 * 2.2 : o.inkW * o.DPR * 0.55; compMat.uniforms.r2.value = (enemiesLayer ? 1.1 : 1.3) * o.DPR;
  const bloom = enemiesLayer && o.bloom && !!sky; if (bloom) bloomPass(w, h); compMat.uniforms.bloom.value = bloom ? 1 : 0;
  renderer.setRenderTarget(null); renderer.clear(); renderer.render(quadScene, quadCam);
  return true;
}

const api = { canvas, active: !!renderer, enemies: true, world: true, draw };
// a lost context falls back to Canvas for the rest of the session (three.js restores, but our targets would not be)
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); api.active = false; renderer = null; console.warn('AOGANE three: context lost, drawing with Canvas'); });
if (query.has('dev')) {
  const label = document.createElement('div');
  Object.assign(label.style, { position: 'fixed', right: '12px', top: '10px', zIndex: 50, font: '11px Consolas, monospace', letterSpacing: '.12em', color: '#8fffe0', background: 'rgba(2,9,10,.6)', padding: '4px 8px', pointerEvents: 'none' });
  document.body.appendChild(label);
  const show = () => { label.textContent = 'RENDER: ' + (api.active ? 'THREE.JS (T)' : 'CANVAS (T)'); };
  addEventListener('keydown', e => { if (e.code === 'KeyT' && !e.repeat && renderer) { api.active = !api.active; show(); } });
  show();
}
window.HF_THREE = api;
