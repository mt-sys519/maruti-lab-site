// WebGL2 engine: photo -> (exposure, WB, vignette in linear light) -> 3D LUT
// (tetrahedral, exact texelFetch) -> intensity blend -> grain.
// Nothing else touches the tones: no curves, no black lift, no saturation tricks.

const VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_img;
uniform sampler3D u_lut;
uniform float u_lutSize;     // 0 = no LUT loaded
uniform vec3 u_domMin;
uniform vec3 u_domMax;

uniform vec2 u_imgSize;      // full image size in pixels
uniform int u_exact;         // 1 = export pass: one fragment per image pixel
uniform vec2 u_tileOffset;   // export tile origin in image pixels (top-left based)
uniform vec2 u_tileSize;

uniform vec3 u_mapX;         // screen pass: the canvas (x right, y down, 0..1) to the photo's uv,
uniform vec3 u_mapY;         // so the canvas can show a turned crop of the photo (identity: all of it)

uniform float u_splitX;      // < 0 disables split; left of it (on the canvas) shows the original
uniform int u_bypass;        // 1 = show original everywhere

uniform float u_intensity;   // 0..1
uniform float u_exposure;    // EV
uniform vec3 u_wbGain;       // linear gains, max channel = 1
uniform float u_grain;       // 0..1
uniform float u_grainSize;   // grain cell in image pixels
uniform float u_vignette;    // 0..1
uniform float u_light;       // < 0 off; 0..1 the light box behind a slide or film frame (光の強さ)
uniform float u_mtf;         // 0 off; else image px per mm of film: the picture as slide film resolves it

vec3 toLin(vec3 s) {
  return mix(pow((s + 0.055) / 1.055, vec3(2.4)), s / 12.92, vec3(lessThanEqual(s, vec3(0.04045))));
}
vec3 toSrgb(vec3 l) {
  l = clamp(l, 0.0, 1.0);
  return mix(1.055 * pow(l, vec3(1.0 / 2.4)) - 0.055, l * 12.92, vec3(lessThanEqual(l, vec3(0.0031308))));
}

vec3 T(ivec3 i) { return texelFetch(u_lut, i, 0).rgb; }

// Tetrahedral interpolation, the same scheme Resolve / OCIO use for 3D LUTs.
vec3 applyLut(vec3 c) {
  float n1 = u_lutSize - 1.0;
  vec3 p = clamp((c - u_domMin) / (u_domMax - u_domMin), 0.0, 1.0) * n1;
  vec3 b = min(floor(p), vec3(n1 - 1.0));
  vec3 f = p - b;
  ivec3 i0 = ivec3(b);
  vec3 c000 = T(i0);
  vec3 c111 = T(i0 + ivec3(1, 1, 1));
  if (f.r > f.g) {
    if (f.g > f.b) {
      vec3 c100 = T(i0 + ivec3(1, 0, 0)), c110 = T(i0 + ivec3(1, 1, 0));
      return c000 + f.r * (c100 - c000) + f.g * (c110 - c100) + f.b * (c111 - c110);
    } else if (f.r > f.b) {
      vec3 c100 = T(i0 + ivec3(1, 0, 0)), c101 = T(i0 + ivec3(1, 0, 1));
      return c000 + f.r * (c100 - c000) + f.b * (c101 - c100) + f.g * (c111 - c101);
    } else {
      vec3 c001 = T(i0 + ivec3(0, 0, 1)), c101 = T(i0 + ivec3(1, 0, 1));
      return c000 + f.b * (c001 - c000) + f.r * (c101 - c001) + f.g * (c111 - c101);
    }
  } else {
    if (f.b > f.g) {
      vec3 c001 = T(i0 + ivec3(0, 0, 1)), c011 = T(i0 + ivec3(0, 1, 1));
      return c000 + f.b * (c001 - c000) + f.g * (c011 - c001) + f.r * (c111 - c011);
    } else if (f.b > f.r) {
      vec3 c010 = T(i0 + ivec3(0, 1, 0)), c011 = T(i0 + ivec3(0, 1, 1));
      return c000 + f.g * (c010 - c000) + f.b * (c011 - c010) + f.r * (c111 - c011);
    } else {
      vec3 c010 = T(i0 + ivec3(0, 1, 0)), c110 = T(i0 + ivec3(1, 1, 0));
      return c000 + f.g * (c010 - c000) + f.r * (c110 - c010) + f.b * (c111 - c110);
    }
  }
}

// Exposure that keeps 0 at 0 and 1 at 1: y = gx / (1 + (g - 1)x).
// Slope g at the bottom (a true EV change in the shadows and mids), a smooth
// shoulder at the top. Applied to the max channel so hue is kept.
vec3 expose(vec3 lin, float ev) {
  if (abs(ev) < 1e-4) return lin;
  float g = exp2(ev);
  float m = max(max(lin.r, lin.g), lin.b);
  if (m <= 0.0) return lin;
  float y = g * m / (1.0 + (g - 1.0) * m);
  return lin * (y / m);
}

// The picture as a transparency on a light box, photographed: the finished colour is the film's
// transmittance, the light box multiplies it (exposure), stray light adds a floor (flare), and the
// camera's highlights roll off into white, each channel on its own so bright colours pale out.
// Measured on real photos (prototypes/color-lab/README.md): darks sit at ~10% of the box's white at
// the default, and nothing goes black. strength 0..1; 0.6 is the default and keeps mid-tones as they are.
vec3 lightBox(vec3 col, float s) {
  vec3 t = toLin(col);
  float e = s <= 0.6 ? mix(0.55, 1.0, s / 0.6) : mix(1.0, 4.0, (s - 0.6) / 0.4);   // x0.55 .. x1 .. x4 (+2 EV)
  float f = s <= 0.6 ? mix(0.003, 0.010, s / 0.6) : mix(0.010, 0.06, (s - 0.6) / 0.4); // flare, linear
  vec3 v = t * e + f;
  float k = 0.62; // shoulder: straight below, rolling into 1.0 above
  vec3 over = max(v - k, 0.0);
  v = min(v, vec3(k)) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
  vec3 o = toSrgb(v);
  float L = dot(o, vec3(0.2126, 0.7152, 0.0722));
  return L + (o - L) * 1.08;
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// The sharpness of slide film, from FUJICHROME PROVIA 100F's data sheet MTF (read from its chart, the
// trial in filmea-blender/mtf.py): about 114% from 1 to 10 cycles/mm (development's adjacency effect,
// the film's own crispness in outlines and textures), 94% at 20, 73% at 30, 51% at 40, 35% at 50, 26% at
// 60, so the finest detail falls away softly instead of staying crisp to the last pixel. Two parts, in
// linear light: a 0.0049 mm Gaussian for the fall (fits 20–60 cycles/mm), and 14% of the difference from a
// 0.34 mm blur for the rise. On screen the canvas is already smaller than the photo, so only the rise is
// added there; the saved file gets both. u_mtf: image pixels per millimetre of the film frame.
vec3 filmMtf(vec3 src, vec2 uv) {
  vec2 texel = 1.0 / u_imgSize;
  vec3 fine = toLin(src);
  float sr = 0.0049 * u_mtf;
  if (u_exact == 1 && sr > 0.1) {
    // separable 5 taps: the Gaussian itself when it spans a pixel or more; below that a 3-tap kernel
    // whose response matches the Gaussian's at a quarter cycle per pixel (sampling it would lose it)
    float k[5];
    if (sr < 0.6) {
      float a = 0.5 * (1.0 - exp(-19.739 * sr * sr / 16.0));
      k[0] = 0.0; k[1] = a; k[2] = 1.0 - 2.0 * a; k[3] = a; k[4] = 0.0;
    } else {
      float s = 0.0;
      for (int i = 0; i < 5; i++) { k[i] = exp(-float((i - 2) * (i - 2)) / (2.0 * sr * sr)); s += k[i]; }
      for (int i = 0; i < 5; i++) k[i] /= s;
    }
    vec3 acc = vec3(0.0);
    for (int j = 0; j < 5; j++) {
      for (int i = 0; i < 5; i++) {
        float w = k[i] * k[j];
        if (w > 0.0) acc += w * toLin(texture(u_img, uv + vec2(float(i - 2), float(j - 2)) * texel).rgb);
      }
    }
    fine = acc;
  }
  float sl = 0.34 * u_mtf;              // the wide blur, in image pixels
  float d = sl / 1.2;                   // tap spacing of a 5x5 Gaussian
  float lod = max(0.0, log2(d * 0.5));  // read from the mip level whose texels are about half a step
  vec3 wide = vec3(0.0); float ws = 0.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      float w = exp(-0.347 * float(i * i + j * j));
      wide += w * toLin(textureLod(u_img, uv + vec2(float(i), float(j)) * d * texel, lod).rgb);
      ws += w;
    }
  }
  wide /= ws;
  return toSrgb(max(fine + 0.14 * (fine - wide), 0.0));
}

void main() {
  vec2 px;   // image pixel coordinate, origin top-left
  vec3 src;
  if (u_exact == 1) {
    vec2 frag = vec2(gl_FragCoord.x, u_tileSize.y - gl_FragCoord.y);
    px = u_tileOffset + floor(frag);
    src = texelFetch(u_img, ivec2(px), 0).rgb;
    px += 0.5;
  } else {
    vec3 c = vec3(v_uv.x, 1.0 - v_uv.y, 1.0);
    vec2 uv = vec2(dot(u_mapX, c), dot(u_mapY, c));
    px = uv * u_imgSize;
    src = texture(u_img, uv).rgb;
  }
  vec2 uvImg = px / u_imgSize;

  if (u_bypass == 1 || (u_splitX >= 0.0 && v_uv.x < u_splitX)) {
    outColor = vec4(src, 1.0);
    return;
  }

  if (u_mtf > 0.0) src = filmMtf(src, uvImg);

  // Pre-LUT adjustments, in linear light. Skipped entirely at their defaults so the
  // LUT sees the photo's exact 8-bit values (no sRGB round-trip rounding).
  vec3 prepared = src;
  if (abs(u_exposure) > 1e-4 || u_vignette > 0.0 || u_wbGain != vec3(1.0)) {
    vec3 lin = toLin(src);
    lin *= u_wbGain;
    lin = expose(lin, u_exposure);
    if (u_vignette > 0.0) {
      vec2 d = (uvImg - 0.5) * 2.0;
      float aspect = u_imgSize.x / u_imgSize.y;
      d.x *= aspect;
      float r2 = dot(d, d) / (1.0 + aspect * aspect); // 1 at the corners
      lin *= 1.0 / pow(1.0 + u_vignette * r2, 2.0);   // cos^4-like falloff, corners -2 EV at 100%
    }
    prepared = toSrgb(lin);
  }

  vec3 graded = u_lutSize > 1.5 ? applyLut(prepared) : prepared;
  vec3 col = mix(prepared, graded, u_intensity);

  if (u_grain > 0.0) {
    vec2 q = px / u_grainSize;
    float n = (vnoise(q) + vnoise(q * 1.93 + 17.0) + vnoise(q * 3.7 + 41.0)) / 3.0 - 0.5;
    float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float w = 4.0 * L * (1.0 - L); // 0 at pure black and pure white
    col += n * u_grain * 0.22 * w;
  }
  if (u_light >= 0.0) col = lightBox(col, u_light);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    this.lut = null;
    this.imgW = 0; this.imgH = 0;
    this.params = { intensity: 1, exposure: 0, wb: 0, grain: 0, vignette: 0, light: -1, mtf: 0 };
    // map: [mapX, mapY] for the screen canvas (see u_mapX), null to show the whole photo
    this.view = { splitX: 0.5, bypass: false, map: null };
    this._init();
    // The GPU can drop the context (a photo too large for its memory, the app sent to the background).
    // Without preventDefault the browser never gives it back and nothing draws until the page is
    // reopened; with it, the context returns, everything is rebuilt here, and onRestored puts the photo
    // back (the engine keeps no copy of it).
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.onLost?.(); });
    canvas.addEventListener('webglcontextrestored', () => {
      this._init();
      if (this.lut) this.setLut(this.lut);
      this.onRestored?.();
    });
  }

  get lost() { return this.gl.isContextLost(); }

  // Everything that lives on the GPU; run again when a lost context comes back.
  _init() {
    const gl = this.gl;
    this.prog = this._program(VS, FS);
    this.loc = {};
    const n = gl.getProgramParameter(this.prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(this.prog, i).name;
      this.loc[name] = gl.getUniformLocation(this.prog, name);
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.imgTex = gl.createTexture();
    this.lutTex = gl.createTexture();
    this.thumbLutTex = null;
    this._smalls = null; this._small = null;
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  }

  _program(vs, fs) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  // pixels: an sRGB canvas / ImageData-backed source (already converted to sRGB by the browser)
  setImage(source, w, h) {
    const gl = this.gl;
    if (w > this.maxTex || h > this.maxTex) throw new Error(`image ${w}x${h} exceeds GPU limit ${this.maxTex}px`);
    this.imgW = w; this.imgH = h;
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // lut: { size, data(Float32 RGB), domainMin, domainMax } or null for none
  setLut(lut) {
    const gl = this.gl;
    this.lut = lut;
    if (!lut) return;
    const N = lut.size;
    const rgba = new Float32Array(N * N * N * 4);
    for (let i = 0, j = 0; i < N * N * N; i++, j += 3) {
      rgba[i * 4] = lut.data[j]; rgba[i * 4 + 1] = lut.data[j + 1]; rgba[i * 4 + 2] = lut.data[j + 2]; rgba[i * 4 + 3] = 1;
    }
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA32F, N, N, N, 0, gl.RGBA, gl.FLOAT, rgba);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, p, gl.NEAREST);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);
  }

  _wbGain(t) {
    // t in -1..1, warm positive. Linear-light gains, normalized so the largest is 1:
    // nothing clips, white takes on the new tint as it would with a camera WB shift.
    const r = 1 + 0.28 * t, b = 1 - 0.28 * t, g = 1;
    const m = Math.max(r, g, b);
    return [r / m, g / m, b / m];
  }

  _uniforms({ exact = false, tileOffset = [0, 0], tileSize = [0, 0], forceFull = false } = {}) {
    const gl = this.gl, L = this.loc, p = this.params;
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.imgTex); gl.uniform1i(L.u_img, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.lutTex); gl.uniform1i(L.u_lut, 1);
    gl.uniform1f(L.u_lutSize, this.lut ? this.lut.size : 0);
    gl.uniform3fv(L.u_domMin, this.lut ? this.lut.domainMin : [0, 0, 0]);
    gl.uniform3fv(L.u_domMax, this.lut ? this.lut.domainMax : [1, 1, 1]);
    gl.uniform2f(L.u_imgSize, this.imgW, this.imgH);
    gl.uniform1i(L.u_exact, exact ? 1 : 0);
    gl.uniform2f(L.u_tileOffset, tileOffset[0], tileOffset[1]);
    gl.uniform2f(L.u_tileSize, tileSize[0], tileSize[1]);
    const map = !exact && !forceFull && this.view.map || [[1, 0, 0], [0, 1, 0]];
    gl.uniform3fv(L.u_mapX, map[0]);
    gl.uniform3fv(L.u_mapY, map[1]);
    gl.uniform1f(L.u_splitX, forceFull ? -1 : this.view.splitX);
    gl.uniform1i(L.u_bypass, !forceFull && this.view.bypass ? 1 : 0);
    gl.uniform1f(L.u_intensity, p.intensity);
    gl.uniform1f(L.u_exposure, p.exposure);
    gl.uniform3fv(L.u_wbGain, this._wbGain(p.wb));
    gl.uniform1f(L.u_grain, p.grain);
    gl.uniform1f(L.u_grainSize, Math.max(1, Math.max(this.imgW, this.imgH) / 2600, this._grainCellMin || 0));
    gl.uniform1f(L.u_vignette, p.vignette);
    gl.uniform1f(L.u_light, p.light ?? -1);
    gl.uniform1f(L.u_mtf, p.mtf || 0);
  }

  render() {
    const gl = this.gl;
    if (!this.imgW) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this._uniforms();
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // Small processed copy for the histogram (always the full, non-split result).
  readSmall(w, h) {
    const gl = this.gl;
    this._smalls ??= new Map();
    const key = `${w}x${h}`;
    if (!this._smalls.has(key)) {
      if (this._smalls.size > 6) {
        for (const s of this._smalls.values()) { gl.deleteFramebuffer(s.fbo); gl.deleteTexture(s.tex); }
        this._smalls.clear();
      }
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      this._smalls.set(key, { w, h, tex, fbo, buf: new Uint8Array(w * h * 4) });
    }
    this._small = this._smalls.get(key);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._small.fbo);
    gl.viewport(0, 0, w, h);
    const g = this.params.grain;
    this.params.grain = 0;
    this._uniforms({ forceFull: true });
    this.params.grain = g;
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, this._small.buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this._small.buf;
  }

  // Small render of the current photo through another LUT, for preset thumbnails.
  // Uses its own LUT texture so the active look is untouched. Rows come back top row first.
  renderThumb(lut, w, h) {
    const gl = this.gl;
    if (!this.thumbLutTex) this.thumbLutTex = gl.createTexture();
    const keep = { lut: this.lut, tex: this.lutTex, params: { ...this.params } };
    this.lutTex = this.thumbLutTex;
    this.setLut(lut);
    Object.assign(this.params, { intensity: 1, grain: 0, exposure: 0, wb: 0, vignette: 0, light: -1, mtf: 0 });
    const px = this.readSmall(w, h);
    this.lut = keep.lut; this.lutTex = keep.tex; this.params = keep.params;
    const out = new Uint8ClampedArray(w * h * 4);
    for (let r = 0; r < h; r++) out.set(px.subarray((h - 1 - r) * w * 4, (h - r) * w * 4), r * w * 4);
    return out;
  }

  // Full-resolution render, tiled, returned as an ImageData-sized RGBA8 array (top row first).
  // outLong: the long side the result will be shrunk to, if any. Grain cells are kept at least one
  // output pixel wide so shrinking does not average the grain away.
  renderFull(outLong = 0) {
    // a lost context reads every size as 0, and the tile loop below would never end
    if (this.lost) throw new Error('描画を立て直しています。少し待ってからもう一度保存してください');
    this._grainCellMin = outLong ? Math.max(this.imgW, this.imgH) / outLong : 0;
    try { return this._renderFull(); } finally { this._grainCellMin = 0; }
  }

  _renderFull() {
    const gl = this.gl;
    const W = this.imgW, H = this.imgH;
    const tile = Math.min(2048, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    const out = new Uint8ClampedArray(W * H * 4);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, tile, tile);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const buf = new Uint8Array(tile * tile * 4);
    for (let ty = 0; ty < H; ty += tile) {
      for (let tx = 0; tx < W; tx += tile) {
        const tw = Math.min(tile, W - tx), th = Math.min(tile, H - ty);
        gl.viewport(0, 0, tw, th);
        this._uniforms({ exact: true, tileOffset: [tx, ty], tileSize: [tw, th], forceFull: true });
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        // readPixels rows are bottom-up; fragment row r (from bottom) is image row ty + th - 1 - r
        for (let r = 0; r < th; r++) {
          const srcRow = r * tw * 4;
          const dstRow = ((ty + th - 1 - r) * W + tx) * 4;
          out.set(buf.subarray(srcRow, srcRow + tw * 4), dstRow);
        }
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
    return out;
  }
}
