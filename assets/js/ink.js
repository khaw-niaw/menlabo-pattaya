/* ==========================================================================
   ink.js — 濡れた紙に墨が滲むWebGLシミュレーション
   ピンポンFBOで拡散・乾燥を毎フレーム計算し、カーソルの軌跡に墨を落とす。
   WebGL非対応環境では body.no-ink を付けて静かに退場する（フォールバック）。
   ========================================================================== */

// --- 設定値（すべてここで調整する） ---
const SIM_SCALE       = 0.5;      // シミュレーション解像度（表示の何倍か）
const MAX_DPR         = 1.5;      // devicePixelRatio の上限
const SIM_STEPS       = 2;        // 1フレームあたりの拡散ステップ数
const BRUSH_RADIUS    = 0.024;    // 筆の太さ（uv単位）
const INK_FLOW        = 0.85;     // 筆から落ちる墨の量
const DRYING_SPEED    = 0.0030;   // 乾く速さ（1ステップあたり）
const DIFFUSION_BASE  = 0.16;     // 滲みの基本量
const DIFFUSION_GRAIN = 0.15;     // 紙の繊維による滲みムラ
const GRAIN_SCALE     = 620.0;    // 紙繊維ノイズの細かさ
const INK_LIGHT       = [0.36, 0.33, 0.35]; // 薄墨
const INK_DEEP        = [0.10, 0.08, 0.10]; // 濃墨
const DEMO_DURATION   = 2400;     // 初回デモ筆運びの長さ(ms)

const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// 拡散ステップ：周囲4点との平均化＋紙繊維ノイズ＋乾燥＋筆入れ
const SIM_SRC = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uMouse;
uniform vec2 uPrevMouse;
uniform float uAspect;
uniform float uBrush;
uniform float uAddInk;
uniform float uDiffBase;
uniform float uDiffGrain;
uniform float uGrainScale;
uniform float uDrying;
uniform float uFlow;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y);
}

void main() {
  float c = texture2D(uPrev, vUv).r;
  float l = texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r;
  float r = texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r;
  float b = texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r;
  float t = texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r;

  float grain = noise(vUv * uGrainScale);
  float diff = uDiffBase + uDiffGrain * grain;

  float ink = c + diff * ((l + r + b + t) * 0.25 - c);
  ink -= uDrying;

  if (uAddInk > 0.5) {
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    vec2 a = vec2(uPrevMouse.x * uAspect, uPrevMouse.y);
    vec2 m = vec2(uMouse.x * uAspect, uMouse.y);
    vec2 pa = p - a;
    vec2 ba = m - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    float d = length(pa - ba * h);
    ink += smoothstep(uBrush, 0.0, d) * uFlow * (0.55 + 0.45 * grain);
  }

  gl_FragColor = vec4(clamp(ink, 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

// 描画ステップ：墨の濃さを色に変換。縁が濃く残る「乾き際」を再現
const RENDER_SRC = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec3 uInkLight;
uniform vec3 uInkDeep;

void main() {
  float ink = texture2D(uTex, vUv).r;
  float alpha = smoothstep(0.012, 0.30, ink) * 0.82;
  float edge = smoothstep(0.012, 0.09, ink) * (1.0 - smoothstep(0.09, 0.45, ink));
  float depth = clamp(edge * 0.85 + smoothstep(0.45, 1.0, ink), 0.0, 1.0);
  vec3 col = mix(uInkLight, uInkDeep, depth);
  gl_FragColor = vec4(col, alpha);
}`;

(function initInk() {
  const canvas = document.getElementById('ink-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) {
    document.body.classList.add('no-ink');
    return;
  }

  // --- シェーダー構築 ---
  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }
  function program(vsSrc, fsSrc) {
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  const simProg = program(VERT_SRC, SIM_SRC);
  const renderProg = program(VERT_SRC, RENDER_SRC);
  if (!simProg || !renderProg) {
    document.body.classList.add('no-ink');
    return;
  }

  // --- フルスクリーン三角形 ---
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  [simProg, renderProg].forEach((p) => {
    const loc = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  });

  // --- テクスチャ形式：half float が使えれば滑らか、ダメなら byte で動かす ---
  const halfExt = gl.getExtension('OES_texture_half_float');
  gl.getExtension('OES_texture_half_float_linear');

  let texType = gl.UNSIGNED_BYTE;
  let filter = gl.LINEAR;

  function makeTarget(w, h, type) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? { tex, fbo, w, h } : null;
  }

  if (halfExt) {
    const probe = makeTarget(4, 4, halfExt.HALF_FLOAT_OES);
    if (probe) {
      texType = halfExt.HALF_FLOAT_OES;
      gl.deleteTexture(probe.tex);
      gl.deleteFramebuffer(probe.fbo);
    }
  }

  // --- ピンポンFBO ---
  let simA = null;
  let simB = null;
  let simW = 0;
  let simH = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    simW = Math.max(64, Math.round(canvas.width * SIM_SCALE));
    simH = Math.max(64, Math.round(canvas.height * SIM_SCALE));
    simA = makeTarget(simW, simH, texType);
    simB = makeTarget(simW, simH, texType);
    if (!simA || !simB) {
      document.body.classList.add('no-ink');
      return false;
    }
    // 初期状態を透明（墨なし）にクリア
    [simA, simB].forEach((t) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }

  if (!resize()) return;
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });

  // --- ポインター追跡（uv座標） ---
  const pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, active: false, moved: false };
  let userTouched = false;

  function setPointer(clientX, clientY) {
    const nx = clientX / window.innerWidth;
    const ny = 1.0 - clientY / window.innerHeight;
    if (!pointer.active) {
      pointer.px = nx;
      pointer.py = ny;
    }
    pointer.x = nx;
    pointer.y = ny;
    pointer.active = true;
    pointer.moved = true;
  }

  window.addEventListener('pointermove', (e) => {
    userTouched = true;
    setPointer(e.clientX, e.clientY);
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    userTouched = true;
    setPointer(e.clientX, e.clientY);
  }, { passive: true });
  window.addEventListener('pointerleave', () => { pointer.active = false; });
  window.addEventListener('blur', () => { pointer.active = false; });

  // --- 初回デモ：誰も触っていなくても一筆だけ見せる ---
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const demoStart = performance.now() + 600;

  function demoStroke(now) {
    if (reduceMotion || userTouched) return false;
    const t = (now - demoStart) / DEMO_DURATION;
    if (t < 0 || t > 1) return false;
    const ease = t * t * (3 - 2 * t);
    const x = (0.28 + 0.44 * ease) * window.innerWidth;
    const y = (0.34 + 0.05 * Math.sin(t * Math.PI * 2.2)) * window.innerHeight;
    setPointer(x, y);
    return true;
  }

  // --- uniform 取得 ---
  const su = (name) => gl.getUniformLocation(simProg, name);
  const ru = (name) => gl.getUniformLocation(renderProg, name);
  const U = {
    prev: su('uPrev'), texel: su('uTexel'), mouse: su('uMouse'),
    prevMouse: su('uPrevMouse'), aspect: su('uAspect'), brush: su('uBrush'),
    addInk: su('uAddInk'), diffBase: su('uDiffBase'), diffGrain: su('uDiffGrain'),
    grainScale: su('uGrainScale'), drying: su('uDrying'), flow: su('uFlow'),
    rTex: ru('uTex'), rLight: ru('uInkLight'), rDeep: ru('uInkDeep'),
  };

  // --- メインループ ---
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || !simA || !simB) return;

    const demoing = demoStroke(now);
    const drawing = pointer.moved && (pointer.active || demoing);
    const aspect = window.innerWidth / window.innerHeight;

    gl.useProgram(simProg);
    gl.uniform2f(U.texel, 1 / simW, 1 / simH);
    gl.uniform1f(U.aspect, aspect);
    gl.uniform1f(U.brush, BRUSH_RADIUS);
    gl.uniform1f(U.diffBase, DIFFUSION_BASE);
    gl.uniform1f(U.diffGrain, DIFFUSION_GRAIN);
    gl.uniform1f(U.grainScale, GRAIN_SCALE);
    gl.uniform1f(U.drying, DRYING_SPEED);
    gl.uniform1f(U.flow, INK_FLOW);

    gl.viewport(0, 0, simW, simH);
    for (let i = 0; i < SIM_STEPS; i++) {
      gl.uniform2f(U.mouse, pointer.x, pointer.y);
      gl.uniform2f(U.prevMouse, pointer.px, pointer.py);
      gl.uniform1f(U.addInk, drawing && i === 0 ? 1 : 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, simB.fbo);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, simA.tex);
      gl.uniform1i(U.prev, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const tmp = simA; simA = simB; simB = tmp;
    }

    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.moved = false;
    if (demoing) pointer.active = false;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(renderProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, simA.tex);
    gl.uniform1i(U.rTex, 0);
    gl.uniform3fv(U.rLight, INK_LIGHT);
    gl.uniform3fv(U.rDeep, INK_DEEP);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  requestAnimationFrame(frame);
})();
