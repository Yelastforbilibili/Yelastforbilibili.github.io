/* ==========================================================================
   field.js — "The Wire"
   A three-dimensional braid of hairlines rendered in raw WebGL2 (no three.js).
   Every point is computed in the vertex shader; JavaScript only supplies four
   sets of morph parameters that are lerped against scroll progress, so the
   geometry reshapes itself as the page moves instead of merely rotating.
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('field');
  if (!canvas) return;

  var gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    depth: true,
    powerPreference: 'low-power'
  });
  if (!gl) { canvas.style.display = 'none'; return; }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none)').matches;

  /* ---------------- shaders ---------------------------------------------- */
  var VERT = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 aData;',   // x: strand 0..1   y: t along length   z: hot 0/1
    'uniform mat4 uProj;',
    'uniform mat4 uMV;',
    'uniform float uTime;',
    'uniform float uTwist;',
    'uniform float uRadius;',
    'uniform float uSpread;',
    'uniform float uCoil;',
    'uniform float uLen;',
    'uniform float uPulse;',
    'uniform float uGain;',
    'uniform vec2 uShift;',
    'out float vFade;',
    'out float vHot;',
    'out float vPulse;',
    'const float TAU = 6.28318530718;',
    'void main(){',
    '  float s = aData.x;',
    '  float t = aData.y;',
    '  float hot = aData.z;',
    '  float a = s * TAU + t * TAU * uTwist;',
    // the tube breathes in radius so the braid never reads as a machined cylinder
    '  float rr = uRadius * (1.0 + 0.17 * sin(t * TAU * 2.0 + s * 11.0 + uTime * 0.18));',
    '  float coilR = uSpread * (1.0 + 0.09 * sin(t * TAU * 0.5 + uTime * 0.11));',
    '  float ang = t * TAU * uCoil;',
    '  vec3 p;',
    '  p.x = cos(ang) * coilR + cos(a) * rr;',
    '  p.z = sin(ang) * coilR + sin(a) * rr;',
    '  p.y = (t - 0.5) * uLen + sin(a * 1.3) * rr * 0.55;',
    '  p *= 1.0 + 0.022 * sin(uTime * 0.33 + t * 3.1);',
    '  vec4 mv = uMV * vec4(p, 1.0);',
    '  mv.xy += uShift;',
    '  float dist = -mv.z;',
    '  vFade = (1.0 - smoothstep(7.0, 24.0, dist)) * smoothstep(0.6, 2.6, dist);',
    '  vPulse = smoothstep(0.05, 0.0, abs(t - uPulse));',
    '  vHot = hot;',
    '  gl_Position = uProj * mv;',
    '}'
  ].join('\n');

  var FRAG = [
    '#version 300 es',
    'precision mediump float;',
    'in float vFade;',
    'in float vHot;',
    'in float vPulse;',
    'uniform vec3 uBone;',
    'uniform vec3 uAccent;',
    'uniform float uGain;',
    'out vec4 frag;',
    'void main(){',
    '  float base = 0.28 + 0.72 * vHot;',
    '  float a = vFade * uGain * base * (0.92 + 1.70 * vPulse);',
    '  vec3 col = mix(uBone, uAccent, clamp(max(vHot * 0.85, vPulse), 0.0, 1.0));',
    '  frag = vec4(col * a, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[field] shader', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.style.display = 'none'; return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[field] link', gl.getProgramInfoLog(prog));
    canvas.style.display = 'none';
    return;
  }
  gl.useProgram(prog);

  /* ---------------- geometry --------------------------------------------- */
  var STRANDS = isTouch ? 44 : 76;
  var SEGS = isTouch ? 42 : 68;
  var HOT_EVERY = 26;                     // every 26th strand is the orange thread
  var verts = STRANDS * SEGS * 2;
  var data = new Float32Array(verts * 3);

  var k = 0;
  for (var s = 0; s < STRANDS; s++) {
    var sn = s / STRANDS;
    var hot = (s % HOT_EVERY === 0) ? 1 : 0;
    for (var i = 0; i < SEGS; i++) {
      data[k++] = sn; data[k++] = i / SEGS; data[k++] = hot;
      data[k++] = sn; data[k++] = (i + 1) / SEGS; data[k++] = hot;
    }
  }

  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  /* ---------------- uniforms --------------------------------------------- */
  var U = {};
  ['uProj', 'uMV', 'uTime', 'uTwist', 'uRadius', 'uSpread', 'uCoil', 'uLen',
   'uPulse', 'uGain', 'uShift', 'uBone', 'uAccent'].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });

  gl.uniform3f(U.uBone, 0.925, 0.910, 0.875);
  gl.uniform3f(U.uAccent, 1.0, 0.353, 0.122);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);      // additive: overlaps bloom a little
  gl.disable(gl.DEPTH_TEST);
  gl.clearColor(0.0314, 0.0314, 0.0392, 1);

  /* ---------------- matrices --------------------------------------------- */
  function perspective(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
    return out;
  }

  function mul(out, a, b) {
    for (var c = 0; c < 4; c++) {
      var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      out[c * 4]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
      out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
      out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return out;
  }

  var proj = new Float32Array(16);
  var tmp = new Float32Array(16);
  var mv = new Float32Array(16);
  var T = new Float32Array(16);
  var RXm = new Float32Array(16);
  var RYm = new Float32Array(16);
  var RZm = new Float32Array(16);
  var tmp2 = new Float32Array(16);

  function rotX(out, r) {
    var c = Math.cos(r), s = Math.sin(r);
    out.set([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
    return out;
  }
  function rotY(out, r) {
    var c = Math.cos(r), s = Math.sin(r);
    out.set([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
    return out;
  }
  function rotZ(out, r) {
    var c = Math.cos(r), s = Math.sin(r);
    out.set([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
    return out;
  }

  /* ---------------- stage parameters -------------------------------------
     Four states. Scroll progress picks a pair and lerps between them, so the
     braid is a loose cable in the hero, a tight coil over the work, a wide
     sheet behind the manifesto, and a collapsing ring under the contact block.
     ------------------------------------------------------------------------ */
  var STAGES = [
    { spread: 3.35, radius: 0.60, twist: 1.05, coil: 0.10, len: 9.6, dist: 9.6, tilt: -0.24, roll: 0.00, yaw: 0.05, gain: 0.72, sx: 1.25, sy: -0.10 },
    { spread: 2.60, radius: 0.62, twist: 1.80, coil: 0.05, len: 8.0, dist: 8.6, tilt: -0.28, roll: 1.52, yaw: 0.04, gain: 0.60, sx: 0.10, sy: -1.70 },
    { spread: 3.20, radius: 0.55, twist: 1.20, coil: 0.10, len: 10.5, dist: 12.0, tilt: 0.09, roll: 0.35, yaw: 0.06, gain: 0.75, sx: 0.90, sy: 0.00 },
    { spread: 1.70, radius: 0.85, twist: 3.40, coil: 0.60, len: 7.2, dist: 6.6, tilt: -0.10, roll: -1.25, yaw: 0.09, gain: 0.92, sx: 1.85, sy: 0.00 }
  ];

  var cur = {
    spread: STAGES[0].spread, radius: STAGES[0].radius, twist: STAGES[0].twist,
    coil: STAGES[0].coil, len: STAGES[0].len, dist: STAGES[0].dist,
    tilt: STAGES[0].tilt, gain: STAGES[0].gain,
    roll: STAGES[0].roll, sx: STAGES[0].sx, sy: STAGES[0].sy
  };

  /* ---------------- state ------------------------------------------------ */
  var dpr = 1, W = 0, H = 0;
  var yawAcc = 0, pointerYaw = 0, pointerTilt = 0, targetPY = 0, targetPT = 0;
  var scrollP = 0, time = 0, pulse = -0.1;
  var running = true, rafId = 0, last = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    perspective(proj, (44 * Math.PI) / 180, canvas.width / canvas.height, 0.1, 60);
    gl.uniformMatrix4fv(U.uProj, false, proj);
  }

  function scrollProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (max <= 1) return 0;
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (!running) return;

    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    time += dt;
    pulse += dt * 0.16;
    if (pulse > 1.12) pulse = -0.12;

    // page progress -> stage pair
    var p = scrollProgress();
    scrollP += (p - scrollP) * Math.min(1, dt * 6.0);

    var n = STAGES.length - 1;
    var f = scrollP * n;
    var i0 = Math.min(n - 1, Math.floor(f));
    var rem = f - i0;
    var e = rem * rem * (3 - 2 * rem);            // smoothstep between states
    var A = STAGES[i0], B = STAGES[i0 + 1];

    var kk = Math.min(1, dt * 2.6);
    cur.spread = lerp(cur.spread, lerp(A.spread, B.spread, e), kk);
    cur.radius = lerp(cur.radius, lerp(A.radius, B.radius, e), kk);
    cur.twist  = lerp(cur.twist,  lerp(A.twist,  B.twist,  e), kk);
    cur.coil   = lerp(cur.coil,   lerp(A.coil,   B.coil,   e), kk);
    cur.len    = lerp(cur.len,    lerp(A.len,    B.len,    e), kk);
    cur.dist   = lerp(cur.dist,   lerp(A.dist,   B.dist,   e), kk);
    cur.tilt   = lerp(cur.tilt,   lerp(A.tilt,   B.tilt,   e), kk);
    cur.gain   = lerp(cur.gain,   lerp(A.gain,   B.gain,   e), kk);
    cur.roll   = lerp(cur.roll,   lerp(A.roll,   B.roll,   e), kk);
    cur.sx     = lerp(cur.sx,     lerp(A.sx,     B.sx,     e), kk);
    cur.sy     = lerp(cur.sy,     lerp(A.sy,     B.sy,     e), kk);

    // pointer parallax, heavily damped
    pointerYaw = lerp(pointerYaw, targetPY, Math.min(1, dt * 2.2));
    pointerTilt = lerp(pointerTilt, targetPT, Math.min(1, dt * 2.2));

    var yawSpeed = lerp(A.yaw, B.yaw, e);
    yawAcc += dt * yawSpeed;
    var yaw = yawAcc + pointerYaw;
    var tilt = cur.tilt + pointerTilt;

    // model-view = translate(0,0,-dist) * rotX(tilt) * rotY(yaw)
    T.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-cur.dist,1]);
    rotX(RXm, tilt);
    rotY(RYm, yaw);
    rotZ(RZm, cur.roll);
    mul(tmp, T, RXm);
    mul(tmp2, tmp, RYm);
    mul(mv, tmp2, RZm);

    // Narrow viewports get the same composition, not a magnified crop: the
    // projection's horizontal field of view shrinks with W/H, so world scale
    // is pulled back with it.
    var geo = Math.min(1, Math.max(0.52, W / (H || 1)));
    // On portrait viewports the coil's own offset pushes the braid past the
    // right edge; pull the whole composition back toward the optical centre.
    var narrow = Math.min(1, Math.max(0, (1 - W / (H || 1)) * 1.4));
    var pushX = -1.55 * narrow;

    gl.uniformMatrix4fv(U.uMV, false, mv);
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uTwist, cur.twist);
    gl.uniform1f(U.uRadius, cur.radius * geo);
    gl.uniform1f(U.uSpread, cur.spread * geo);
    gl.uniform1f(U.uCoil, cur.coil);
    gl.uniform1f(U.uLen, cur.len * geo);
    gl.uniform1f(U.uPulse, pulse);
    // a 1-device-pixel hairline covers 1/dpr of a CSS pixel, so retina screens would
    // otherwise read as a fainter braid; compensate so brightness is display-independent.
    gl.uniform1f(U.uGain, cur.gain * Math.pow(dpr, 0.55));
    gl.uniform2f(U.uShift, cur.sx * geo + pushX, cur.sy * geo);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.LINES, 0, verts);
  }

  function onPointer(e) {
    var x = (e.clientX / window.innerWidth) * 2 - 1;
    var y = (e.clientY / window.innerHeight) * 2 - 1;
    targetPY = x * 0.22;
    targetPT = -y * 0.16;
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });

  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) last = 0;
  });

  resize();

  if (reduced) {
    // one still, settled frame — no animation loop at all
    running = true;
    frame(0);
    cancelAnimationFrame(rafId);
  } else {
    rafId = requestAnimationFrame(frame);
  }
})();
