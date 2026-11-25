// LUT loaders. Every loader returns the same shape:
//   { size: N, data: Float32Array(N*N*N*3), domainMin: [r,g,b], domainMax: [r,g,b], title }
// Data order is red fastest, then green, then blue (the .cube order), so it can go
// straight into a WebGL 3D texture with width=red, height=green, depth=blue.

export function parseCube(text, fallbackTitle = '') {
  let size = 0;
  let title = fallbackTitle;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  let has1D = false;
  const values = [];
  const lines = text.split(/\r?\n/);
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const head = line.split(/\s+/)[0].toUpperCase();
    if (head === 'TITLE') { title = line.replace(/^TITLE\s+/i, '').replace(/^"|"$/g, ''); continue; }
    if (head === 'LUT_3D_SIZE') { size = parseInt(line.split(/\s+/)[1], 10); continue; }
    if (head === 'LUT_1D_SIZE') { has1D = true; continue; }
    if (head === 'DOMAIN_MIN') { domainMin = line.split(/\s+/).slice(1, 4).map(Number); continue; }
    if (head === 'DOMAIN_MAX') { domainMax = line.split(/\s+/).slice(1, 4).map(Number); continue; }
    if (head === 'LUT_3D_INPUT_RANGE') {
      const [a, b] = line.split(/\s+/).slice(1, 3).map(Number);
      domainMin = [a, a, a]; domainMax = [b, b, b];
      continue;
    }
    if (/^[A-Z_]+$/.test(head)) continue; // unknown keyword, ignore
    const p = line.split(/\s+/);
    values.push(+p[0], +p[1], +p[2]);
  }
  if (has1D && !size) throw new Error('1D LUT (.cube LUT_1D_SIZE) is not supported');
  if (!size) throw new Error('LUT_3D_SIZE not found');
  const need = size * size * size * 3;
  if (values.length < need) throw new Error(`cube has ${values.length / 3} entries, expected ${need / 3}`);
  return { size, data: new Float32Array(values.slice(0, need)), domainMin, domainMax, title };
}

// "LUT1" + uint32 LE size + RGB uint16 LE (red fastest), sRGB in / sRGB out.
export function parseLut16(buf, title = '') {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'LUT1') throw new Error('not a LUT1 file');
  const size = dv.getUint32(4, true);
  const n = size * size * size * 3;
  if (buf.byteLength < 8 + n * 2) throw new Error('lut16 file is truncated');
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = dv.getUint16(8 + i * 2, true) / 65535;
  return { size, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title };
}

// HaldCLUT: a square image of level L holds L^6 pixels; the cube edge is L^2.
// Pixel k (row-major) is the output for r = k % N, g = (k / N) % N, b = k / N^2.
export async function parseHald(buf, title = '') {
  const img = await decodePngExact(buf).catch(() => null) || await decodeViaCanvas(buf);
  const { width, height, rgb } = img; // rgb: Float32Array width*height*3 in 0..1
  if (width !== height) throw new Error('HaldCLUT must be square');
  const level = Math.round(Math.cbrt(width));
  if (level * level * level !== width) throw new Error(`${width}px is not a HaldCLUT size (level^3)`);
  const size = level * level;
  return { size, data: rgb, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title };
}

// Minimal PNG decoder (8/16-bit RGB or RGBA, non-interlaced) so HaldCLUTs are read
// bit-exact: no browser color management, no premultiplied alpha, 16-bit kept.
async function decodePngExact(buf) {
  const u8 = new Uint8Array(buf);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (u8[i] !== sig[i]) throw new Error('not png');
  const dv = new DataView(buf);
  let pos = 8, width = 0, height = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (pos < u8.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(u8[pos + 4], u8[pos + 5], u8[pos + 6], u8[pos + 7]);
    const body = u8.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = dv.getUint32(pos + 8); height = dv.getUint32(pos + 12);
      depth = u8[pos + 16]; ctype = u8[pos + 17]; interlace = u8[pos + 20];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (interlace || (ctype !== 2 && ctype !== 6) || (depth !== 8 && depth !== 16)) throw new Error('unsupported png layout');
  const joined = new Uint8Array(idat.reduce((s, a) => s + a.length, 0));
  let o = 0; for (const a of idat) { joined.set(a, o); o += a.length; }
  const stream = new Blob([joined]).stream().pipeThrough(new DecompressionStream('deflate'));
  const raw = new Uint8Array(await new Response(stream).arrayBuffer());
  const ch = ctype === 6 ? 4 : 3;
  const bpp = ch * (depth / 8);
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  const n = width * height;
  const rgb = new Float32Array(n * 3);
  if (depth === 8) {
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) rgb[i * 3 + k] = out[i * ch + k] / 255;
  } else {
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
      const j = (i * ch + k) * 2;
      rgb[i * 3 + k] = ((out[j] << 8) | out[j + 1]) / 65535;
    }
  }
  return { width, height, rgb };
}

async function decodeViaCanvas(buf) {
  const bmp = await createImageBitmap(new Blob([buf]), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(bmp, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const n = c.width * c.height;
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) rgb[i * 3 + k] = d[i * 4 + k] / 255;
  return { width: c.width, height: c.height, rgb };
}

// Pick a parser by file name / content.
export async function loadLutFromBuffer(buf, name) {
  const lower = name.toLowerCase();
  const base = name.replace(/\.[^.]+$/, '');
  if (lower.endsWith('.cube')) return parseCube(new TextDecoder().decode(buf), base);
  if (lower.endsWith('.lut16')) return parseLut16(buf, base);
  if (lower.endsWith('.png')) return parseHald(buf, base);
  const head = new Uint8Array(buf, 0, 4);
  if (head[0] === 137 && head[1] === 80) return parseHald(buf, base);
  if (String.fromCharCode(...head) === 'LUT1') return parseLut16(buf, base);
  return parseCube(new TextDecoder().decode(buf), base);
}

export async function loadLutFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return loadLutFromBuffer(await res.arrayBuffer(), url.split('/').pop());
}

export function isLutFileName(name) {
  return /\.(cube|lut16)$/i.test(name) || /hald|clut/i.test(name) && /\.png$/i.test(name);
}
