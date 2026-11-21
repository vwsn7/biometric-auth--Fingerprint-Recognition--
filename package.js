/* Fingerprint core: synthetic sample generator + classic minutiae pipeline + matcher.
   Pure typed arrays, no DOM. Works in browser (global FP) and Node (module.exports). */
(function (root) {
'use strict';
const PI = Math.PI;

/* ---------- utilities ---------- */
function rng(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * PI * r()); }
function wrapPi(a) { while (a > PI / 2) a -= PI; while (a <= -PI / 2) a += PI; return a; }   // -> (-pi/2, pi/2]
function angDiff(a, b) { return Math.abs(wrapPi(a - b)); }

/* ---------- synthetic fingers ---------- */
const PERIOD = 9;           // ridge period in px (about 500 dpi)
const IMG_W = 256, IMG_H = 300;

function makeFinger(seed, type) {
  const r = rng(seed * 7919 + 13);
  const F = { type, seed, V: [], wp: [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28] };
  if (type === 'whorl')      { F.cx = (r() - .5) * 16; F.cy = (r() - .5) * 20; F.asp = 1.25; }
  else if (type === 'loopL') { F.cx = (r() - .5) * 14; F.cy = -18 + (r() - .5) * 14; F.tilt = 0.28 + r() * .12; }
  else if (type === 'loopR') { F.cx = (r() - .5) * 14; F.cy = -18 + (r() - .5) * 14; F.tilt = -0.28 - r() * .12; }
  else                       { F.cx = (r() - .5) * 30; F.h = 46 + r() * 14; F.sig = 70 + r() * 20; F.slope = (r() - .5) * 0.12; }
  let tries = 0;
  while (F.V.length < 46 && tries++ < 8000) {
    const x = (r() * 2 - 1) * 140, y = (r() * 2 - 1) * 180;
    if ((x / 140) ** 2 + (y / 180) ** 2 > 1) continue;
    if (F.V.some(v => Math.hypot(v.x - x, v.y - y) < 27)) continue;
    F.V.push({ x, y, q: 0 });
  }
  if (F.V.length % 2) F.V.pop();
  // shuffle charge order so +/- are spatially mixed
  const order = F.V.map((_, i) => i).sort(() => r() - .5);
  order.forEach((idx, k) => { F.V[idx].q = k % 2 ? 1 : -1; });
  return F;
}

function basePhase(F, x, y) {
  const w = F.wp;
  x += 4.0 * Math.sin(y / 37 + w[0]) + 2.5 * Math.sin(x / 53 + w[1]);
  y += 4.0 * Math.sin(x / 41 + w[2]) + 2.5 * Math.sin(y / 59 + w[3]);
  let d;
  if (F.type === 'whorl') {
    d = Math.hypot(x - F.cx, (y - F.cy) * F.asp);
  } else if (F.type === 'loopL' || F.type === 'loopR') {
    // distance to a half-line starting at the core and heading down (tilted): nested U shapes
    const dx = Math.sin(F.tilt), dy = Math.cos(F.tilt);
    const px = x - F.cx, py = y - F.cy;
    const t = px * dx + py * dy;
    d = t <= 0 ? Math.hypot(px, py) : Math.abs(-px * dy + py * dx);
  } else {
    d = y - F.h * Math.exp(-((x - F.cx) ** 2) / (2 * F.sig * F.sig)) + F.slope * x;
  }
  return 2 * PI * d / PERIOD;
}

function renderImpression(F, seed, o) {
  o = o || {};
  const w = IMG_W, h = IMG_H, r = rng(seed * 104729 + 7);
  const rot = o.rot != null ? o.rot : (r() * 2 - 1) * 0.32;
  const tx = o.tx != null ? o.tx : (r() * 2 - 1) * 24;
  const ty = o.ty != null ? o.ty : (r() * 2 - 1) * 28;
  const c = Math.cos(rot), s = Math.sin(rot);
  const wob = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
  const contrast = 0.85 + r() * 0.25;
  const dry = [r() * 6.28, r() * 6.28];
  const ex = 116 + r() * 8, ey = 140 + r() * 8;
  const ox = (r() - .5) * 10, oy = (r() - .5) * 12;
  const sigma = o.noise != null ? o.noise : 13;
  const out = new Float32Array(w * h);
  const V = F.V, nv = V.length;
  for (let v = 0; v < h; v++) {
    for (let u = 0; u < w; u++) {
      const lx = u - w / 2, ly = v - h / 2;
      const en = ((lx - ox) / ex) ** 2 + ((ly - oy) / ey) ** 2;
      let val;
      if (en > 1.25) { val = 236 + gauss(r) * 3; }
      else {
        let x = c * lx - s * ly + tx, y = s * lx + c * ly + ty;
        x += 2.2 * Math.sin(v / 31 + wob[0]) + 1.6 * Math.sin(u / 43 + wob[1]);
        y += 2.2 * Math.sin(u / 29 + wob[2]) + 1.6 * Math.sin(v / 47 + wob[3]);
        let ph = basePhase(F, x, y);
        for (let k = 0; k < nv; k++) ph += V[k].q * Math.atan2(y - V[k].y, x - V[k].x);
        const ridge = Math.cos(ph);
        const dryness = 0.62 + 0.38 * Math.sin(u / 37 + dry[0]) * Math.sin(v / 33 + dry[1]);   // pressure / dryness
        val = 132 - 98 * contrast * dryness * ridge + gauss(r) * sigma;
        if (en > 0.8) val += (en - 0.8) / 0.45 * (236 - val);                              // soft fade at the edge
      }
      out[v * w + u] = val < 0 ? 0 : val > 255 ? 255 : val;
    }
  }
  return { w, h, data: blur3(out, w, h) };
}

function blur3(src, w, h) {
  const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    t[i] = (src[i - (x > 0 ? 1 : 0)] + 2 * src[i] + src[i + (x < w - 1 ? 1 : 0)]) / 4;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    o[i] = (t[i - (y > 0 ? w : 0)] + 2 * t[i] + t[i + (y < h - 1 ? w : 0)]) / 4;
  }
  return o;
}

function boxBlur(src, w, h, R) {            // separable box filter, edge-clamped
  const t = new Float32Array(w * h), o = new Float32Array(w * h), n = 2 * R + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let k = -R; k <= R; k++) acc += src[y * w + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) {
      t[y * w + x] = acc / n;
      acc += src[y * w + Math.min(w - 1, x + R + 1)] - src[y * w + Math.max(0, x - R)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -R; k <= R; k++) acc += t[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) {
      o[y * w + x] = acc / n;
      acc += t[Math.min(h - 1, y + R + 1) * w + x] - t[Math.max(0, y - R) * w + x];
    }
  }
  return o;
}

/* ---------- pipeline stage 1: segmentation + normalisation ---------- */
function segment(img) {
  const { w, h, data } = img, B = 10;
  const bw = Math.ceil(w / B), bh = Math.ceil(h / B);
  const sd = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let s = 0, s2 = 0, n = 0;
    for (let y = by * B; y < Math.min(h, by * B + B); y++) for (let x = bx * B; x < Math.min(w, bx * B + B); x++) {
      const v = data[y * w + x]; s += v; s2 += v * v; n++;
    }
    const m = s / n; sd[by * bw + bx] = Math.sqrt(Math.max(0, s2 / n - m * m));
  }
  const sorted = Array.from(sd).sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const thr = Math.max(6, 0.33 * p90);
  let bm = new Uint8Array(bw * bh);
  for (let i = 0; i < bm.length; i++) bm[i] = sd[i] > thr ? 1 : 0;
  // majority smoothing at block level (closes holes, drops specks)
  const bm2 = new Uint8Array(bm.length);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let c = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = bx + dx, y = by + dy; if (x < 0 || y < 0 || x >= bw || y >= bh) continue;
      c += bm[y * bw + x]; n++;
    }
    bm2[by * bw + bx] = c * 2 > n ? 1 : 0;
  }
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = bm2[((y / B) | 0) * bw + ((x / B) | 0)];
  // normalise inside the foreground: ridges become positive
  let s = 0, s2 = 0, n = 0;
  for (let i = 0; i < w * h; i++) if (mask[i]) { s += data[i]; s2 += data[i] * data[i]; n++; }
  const mean = s / Math.max(1, n), std = Math.sqrt(Math.max(1e-6, s2 / Math.max(1, n) - mean * mean));
  const norm = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) norm[i] = mask[i] ? (mean - data[i]) / std : 0;
  return { w, h, mask, norm };
}

/* ---------- stage 2: ridge orientation field ---------- */
function orientation(seg) {
  const { w, h, norm } = seg;
  const sm = boxBlur(norm, w, h, 1);
  const gxx = new Float32Array(w * h), gyy = new Float32Array(w * h), gxy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = (sm[i - w + 1] + 2 * sm[i + 1] + sm[i + w + 1]) - (sm[i - w - 1] + 2 * sm[i - 1] + sm[i + w - 1]);
    const gy = (sm[i + w - 1] + 2 * sm[i + w] + sm[i + w + 1]) - (sm[i - w - 1] + 2 * sm[i - w] + sm[i - w + 1]);
    gxx[i] = gx * gx; gyy[i] = gy * gy; gxy[i] = gx * gy;
  }
  const Sxx = boxBlur(gxx, w, h, 7), Syy = boxBlur(gyy, w, h, 7), Sxy = boxBlur(gxy, w, h, 7);
  const c2 = new Float32Array(w * h), s2 = new Float32Array(w * h), coh = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = Sxx[i] - Syy[i], b = 2 * Sxy[i], m = Math.sqrt(a * a + b * b);
    coh[i] = m / (Sxx[i] + Syy[i] + 1e-9);
    c2[i] = a; s2[i] = b;              // magnitude-weighted doubled-angle vector
  }
  const C = boxBlur(c2, w, h, 4), S = boxBlur(s2, w, h, 4);
  const theta = new Float32Array(w * h);                       // ridge direction in [0, pi)
  for (let i = 0; i < w * h; i++) {
    let t = 0.5 * Math.atan2(S[i], C[i]) + PI / 2;
    t = ((t % PI) + PI) % PI; theta[i] = t;
  }
  return { theta, coh };
}

/* ---------- stage 3: Gabor enhancement ---------- */
const gaborCache = {};
function gaborBank(period) {
  if (gaborCache[period]) return gaborCache[period];
  const NA = 16, R = Math.round(period * 1.0), n = 2 * R + 1, f = 1 / period;
  const sd = period * 0.5, sn = period * 0.38;
  const bank = [];
  for (let a = 0; a < NA; a++) {
    const th = a * PI / NA, dx = Math.cos(th), dy = Math.sin(th), nx = -dy, ny = dx;
    const k = new Float32Array(n * n); let sum = 0;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const pd = x * dx + y * dy, pn = x * nx + y * ny;
      const v = Math.exp(-(pd * pd / (2 * sd * sd) + pn * pn / (2 * sn * sn))) * Math.cos(2 * PI * f * pn);
      k[(y + R) * n + x + R] = v; sum += v;
    }
    const mean = sum / (n * n);
    for (let i = 0; i < k.length; i++) k[i] -= mean * Math.exp(0);   // zero DC
    bank.push(k);
  }
  return (gaborCache[period] = { bank, NA, R, n });
}
function gabor(seg, ori, period) {
  const { w, h, norm, mask } = seg, G = gaborBank(period || PERIOD), R = G.R;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!mask[i]) continue;
    let a = Math.round(ori.theta[i] / PI * G.NA) % G.NA; const k = G.bank[a];
    let acc = 0;
    for (let ky = -R; ky <= R; ky++) {
      const yy = y + ky; if (yy < 0 || yy >= h) continue;
      for (let kx = -R; kx <= R; kx++) {
        const xx = x + kx; if (xx < 0 || xx >= w) continue;
        acc += norm[yy * w + xx] * k[(ky + R) * G.n + kx + R];
      }
    }
    out[i] = acc;
  }
  return out;
}

/* ---------- stage 4: binarise + clean ---------- */
function removeSmall(bin, w, h, minSize, value) {      // remove connected blobs of `value` smaller than minSize
  const seen = new Uint8Array(w * h), stack = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || bin[s] !== value) continue;
    const comp = []; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop(); comp.push(p);
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx; if (!seen[q] && bin[q] === value) { seen[q] = 1; stack.push(q); }
      }
    }
    if (comp.length < minSize) for (const p of comp) bin[p] = 1 - value;
  }
}
function binarize(seg, enh) {
  const { w, h, mask } = seg, bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bin[i] = mask[i] && enh[i] > 0 ? 1 : 0;
  removeSmall(bin, w, h, 30, 1);
  // fill tiny valley holes only inside the mask
  const inv = new Uint8Array(bin);
  for (let i = 0; i < w * h; i++) if (!mask[i]) inv[i] = 1;   // outside mask counts as ridge so it is never "filled"
  removeSmall(inv, w, h, 30, 0);
  for (let i = 0; i < w * h; i++) if (mask[i]) bin[i] = inv[i];
  return bin;
}

/* ---------- stage 5: thinning (Zhang-Suen) ---------- */
function thin(bin, w, h) {
  const s = new Uint8Array(bin);
  let changed = true, guard = 0;
  const del = [];
  while (changed && guard++ < 60) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (!s[i]) continue;
        const p2 = s[i - w], p3 = s[i - w + 1], p4 = s[i + 1], p5 = s[i + w + 1], p6 = s[i + w], p7 = s[i + w - 1], p8 = s[i - 1], p9 = s[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (pass === 0) { if (p2 * p4 * p6 || p4 * p6 * p8) continue; }
        else { if (p2 * p4 * p8 || p2 * p6 * p8) continue; }
        del.push(i);
      }
      if (del.length) { changed = true; for (const i of del) s[i] = 0; }
    }
  }
  return s;
}

/* ---------- stage 6: minutiae (crossing number) ---------- */
const NB = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
function crossingNumber(sk, w, x, y) {
  let cn = 0;
  for (let k = 0; k < 8; k++) {
    const a = sk[(y + NB[k][1]) * w + x + NB[k][0]], b = sk[(y + NB[(k + 1) % 8][1]) * w + x + NB[(k + 1) % 8][0]];
    cn += Math.abs(a - b);
  }
  return cn / 2;
}
function pruneSpurs(sk, w, h, maxLen) {
  for (let round = 0; round < 2; round++) {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!sk[y * w + x] || crossingNumber(sk, w, x, y) !== 1) continue;
      const path = [[x, y]]; let px = -1, py = -1, cx = x, cy = y, hitJunction = false;
      for (let step = 0; step < maxLen; step++) {
        let nx = -1, ny = -1, cnt = 0;
        for (const [dx, dy] of NB) {
          const xx = cx + dx, yy = cy + dy; if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue;
          if (!sk[yy * w + xx] || (xx === px && yy === py)) continue;
          if (path.some(p => p[0] === xx && p[1] === yy)) continue;
          cnt++; nx = xx; ny = yy;
        }
        if (cnt === 0) break;
        if (cnt > 1 || crossingNumber(sk, w, nx, ny) >= 3) { hitJunction = true; break; }
        px = cx; py = cy; cx = nx; cy = ny; path.push([cx, cy]);
      }
      if (hitJunction && path.length < maxLen) for (const [xx, yy] of path) sk[yy * w + xx] = 0;
    }
  }
}
function erodeMask(mask, w, h, R) {
  const t = new Uint8Array(w * h), o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let ok = 1; for (let k = -R; k <= R && ok; k++) { const xx = x + k; if (xx < 0 || xx >= w || !mask[y * w + xx]) ok = 0; }
    t[y * w + x] = ok;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let ok = 1; for (let k = -R; k <= R && ok; k++) { const yy = y + k; if (yy < 0 || yy >= h || !t[yy * w + x]) ok = 0; }
    o[y * w + x] = ok;
  }
  return o;
}
function extract(seg, ori, skIn) {
  const { w, h } = seg, sk = new Uint8Array(skIn);
  pruneSpurs(sk, w, h, 9);
  removeSmall(sk, w, h, 14, 1);
  const valid = erodeMask(seg.mask, w, h, 13);
  let raw = [];
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    if (!sk[y * w + x] || !valid[y * w + x]) continue;
    const cn = crossingNumber(sk, w, x, y);
    if (cn === 1) raw.push({ x, y, type: 'end' });
    else if (cn === 3) raw.push({ x, y, type: 'bif' });
  }
  // merge neighbours (spurs, bridges, double detections)
  const keep = [];
  for (let i = 0; i < raw.length; i++) {
    let drop = false;
    for (let j = 0; j < raw.length && !drop; j++) {
      if (i === j) continue;
      const d = Math.hypot(raw[i].x - raw[j].x, raw[i].y - raw[j].y);
      if (d < 6.5 && (raw[i].type !== raw[j].type || j < i)) drop = true;
    }
    if (!drop) keep.push(raw[i]);
  }
  for (const m of keep) {
    if (m.type === 'end') {                       // trace 10 px inwards along the ridge
      let cx = m.x, cy = m.y, px = -1, py = -1, n = 0;
      for (; n < 10; n++) {
        let nx = -1, ny = -1;
        for (const [dx, dy] of NB) {
          const xx = cx + dx, yy = cy + dy;
          if (!sk[yy * w + xx] || (xx === px && yy === py) || (xx === m.x && yy === m.y)) continue;
          nx = xx; ny = yy; break;
        }
        if (nx < 0) break; px = cx; py = cy; cx = nx; cy = ny;
      }
      m.t = n >= 4 ? ((Math.atan2(m.y - cy, m.x - cx) % PI) + PI) % PI : ori.theta[m.y * w + m.x];
    } else m.t = ori.theta[m.y * w + m.x];
  }
  return { w, h, minutiae: keep, valid, skeleton: sk };
}

function runAll(img, period) {
  const seg = segment(img), ori = orientation(seg), enh = gabor(seg, ori, period);
  const bin = binarize(seg, enh), sk = thin(bin, seg.w, seg.h), tpl = extract(seg, ori, sk);
  return { seg, ori, enh, bin, sk, tpl };
}

/* ---------- matching: Hough alignment + pairing ---------- */
const DEF = { tolD: 10, tolA: 15 * PI / 180, maxRot: 45 * PI / 180, binR: 6 * PI / 180, binT: 9, floorN: 16 };
function xform(m, T, cx, cy) {
  const c = Math.cos(T.dth), s = Math.sin(T.dth), px = m.x - cx, py = m.y - cy;
  return { x: c * px - s * py + cx + T.tx, y: s * px + c * py + cy + T.ty, t: wrapPos(m.t + T.dth) };
}
function wrapPos(a) { return ((a % PI) + PI) % PI; }
function pairUp(a, b, T, cx, cy, o) {
  const cand = [];
  for (let i = 0; i < a.length; i++) {
    const p = xform(a[i], T, cx, cy);
    for (let j = 0; j < b.length; j++) {
      const d = Math.hypot(p.x - b[j].x, p.y - b[j].y);
      if (d < o.tolD && angDiff(p.t, b[j].t) < o.tolA) cand.push([d, i, j]);
    }
  }
  cand.sort((u, v) => u[0] - v[0]);
  const ua = new Uint8Array(a.length), ub = new Uint8Array(b.length), pairs = [];
  for (const [d, i, j] of cand) if (!ua[i] && !ub[j]) { ua[i] = ub[j] = 1; pairs.push({ i, j, d }); }
  return pairs;
}
function refine(a, b, T, pairs, cx, cy) {            // shift translation by the mean residual
  if (!pairs.length) return T;
  let sx = 0, sy = 0;
  for (const p of pairs) { const q = xform(a[p.i], T, cx, cy); sx += b[p.j].x - q.x; sy += b[p.j].y - q.y; }
  return { dth: T.dth, tx: T.tx + sx / pairs.length, ty: T.ty + sy / pairs.length };
}
function inverseHit(T, x, y, cx, cy, tpl) {                 // is point (x,y) of B inside A's valid area after undoing T?
  const c = Math.cos(-T.dth), s = Math.sin(-T.dth), px = x - T.tx - cx, py = y - T.ty - cy;
  const ax = Math.round(c * px - s * py + cx), ay = Math.round(s * px + c * py + cy);
  return ax >= 0 && ay >= 0 && ax < tpl.w && ay < tpl.h && tpl.valid[ay * tpl.w + ax] === 1;
}
function match(A, B, opt) {
  const o = Object.assign({}, DEF, opt), a = A.minutiae, b = B.minutiae;
  const cx = A.w / 2, cy = A.h / 2;
  const empty = { score: 0, pairs: [], T: { dth: 0, tx: 0, ty: 0 }, nOvA: 0, nOvB: 0, votes: 0, cx, cy };
  if (a.length < 4 || b.length < 4) return empty;
  const votes = new Map(), lst = [];
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const dth = wrapPi(b[j].t - a[i].t); if (Math.abs(dth) > o.maxRot) continue;
    const c = Math.cos(dth), s = Math.sin(dth), px = a[i].x - cx, py = a[i].y - cy;
    const tx = b[j].x - (c * px - s * py + cx), ty = b[j].y - (s * px + c * py + cy);
    const ia = Math.round(dth / o.binR), ix = Math.round(tx / o.binT), iy = Math.round(ty / o.binT);
    lst.push([ia, ix, iy, dth, tx, ty]);
    for (let da = -1; da <= 1; da++) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const key = ((ia + da + 30) * 400 + (ix + dx + 200)) * 400 + (iy + dy + 200);
      votes.set(key, (votes.get(key) || 0) + 1);
    }
  }
  if (!votes.size) return empty;
  const top = Array.from(votes.entries()).sort((u, v) => v[1] - u[1]);
  const picks = [];
  for (const [key, n] of top) {
    const iy = key % 400 - 200, ix = ((key / 400) | 0) % 400 - 200, ia = (((key / 400) | 0) / 400 | 0) - 30;
    if (picks.some(p => Math.abs(p.ia - ia) <= 1 && Math.abs(p.ix - ix) <= 1 && Math.abs(p.iy - iy) <= 1)) continue;
    picks.push({ ia, ix, iy, n }); if (picks.length >= 4) break;
  }
  let best = null;
  for (const p of picks) {
    let sd = 0, sx = 0, sy = 0, n = 0;
    for (const e of lst) if (Math.abs(e[0] - p.ia) <= 1 && Math.abs(e[1] - p.ix) <= 1 && Math.abs(e[2] - p.iy) <= 1) { sd += e[3]; sx += e[4]; sy += e[5]; n++; }
    let T = { dth: sd / n, tx: sx / n, ty: sy / n };
    let pairs = pairUp(a, b, T, cx, cy, o);
    for (let k = 0; k < 2; k++) { T = refine(a, b, T, pairs, cx, cy); pairs = pairUp(a, b, T, cx, cy, o); }
    if (!best || pairs.length > best.pairs.length) best = { T, pairs, votes: p.n };
  }
  let nOvA = 0, nOvB = 0;
  for (const m of a) { const q = xform(m, best.T, cx, cy), ix = Math.round(q.x), iy = Math.round(q.y);
    if (ix >= 0 && iy >= 0 && ix < B.w && iy < B.h && B.valid[iy * B.w + ix]) nOvA++; }
  for (const m of b) if (inverseHit(best.T, m.x, m.y, cx, cy, A)) nOvB++;
  const np = best.pairs.length;
  const score = np < 3 ? 0 : 100 * np * np / (Math.max(nOvA, o.floorN) * Math.max(nOvB, o.floorN));
  return { score, pairs: best.pairs, T: best.T, nOvA, nOvB, votes: best.votes, cx, cy };
}

root.FP = { IMG_W, IMG_H, PERIOD, makeFinger, renderImpression, segment, orientation, gabor, binarize, thin, extract, runAll, match, DEF, xform };
if (typeof module !== 'undefined') module.exports = root.FP;
})(typeof window !== 'undefined' ? window : globalThis);
