/* A Bueno · the hero stage. Three real photos of one Woodbury, CT room (worn → sanded → finished), aligned to each other,
   plus a matte "stain" state made from the finished photo. The floor is modeled from its two vanishing points, so
   every pass runs along the boards, the way a drum sander does:
     - drag on the floor: the lane under the pointer is sanded to bare wood;
     - run('hardwood-floor-refinishing'): sands the rest, stains lane by lane, then three coats back out of the room;
     - run('lvp-flooring-installation' | 'hardwood-floor-installation'): the new floor goes in plank by plank, from the
       far wall to the door. The new floor is an AI edit of this same room, realigned to the frame (tools/build-photos.py
       --only stage-ai); only the floor is replaced, so walls, trim and stairs stay real. Always labeled "Visualization".
   Canvas only (never an LCP candidate); rAF runs only while something moves. Reduced motion: the finished photo,
   still; choices jump to their end state. Assets load relative to this file (works in a preview subfolder). */
(function () {
  'use strict';

  var D = window.AB_STAGE;
  var root = document.querySelector('[data-stage]');
  if (!D || !root) return;
  var cv = root.querySelector('[data-stage-canvas]');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var script = document.currentScript;
  var base = new URL('../img/stage/', script && script.src ? script.src : window.location.href);

  var stateEl = document.querySelector('[data-stage-state]');
  var srcEl = document.querySelector('[data-stage-src]');
  var hint = root.querySelector('[data-stage-hint]');
  var runBtn = root.querySelector('[data-stage-run]');
  var runLbl = root.querySelector('[data-stage-run-label]');

  /* ── geometry: image px of the aligned photos ── */
  var IW = D.aspect[0], IH = D.aspect[1];
  var V1 = [D.vpBoards[0] * IW, D.vpBoards[1] * IH];   // where the board seams meet
  var V2 = [D.vpAcross[0] * IW, D.vpAcross[1] * IH];   // across the boards
  var FLOOR = D.floor.map(function (p) { return [p[0] * IW, p[1] * IH]; });

  // The floor in "board coordinates": v = which board line (the angle of the ray from the seams' vanishing point),
  // u = how deep along it. Along a line that runs to its vanishing point, equal steps on the floor are equal steps of
  // 1/distance in the photo, so u is linear in 1/r: planks and passes keep their perspective without a full 3D model.
  var angs = FLOOR.map(function (p) { return Math.atan2(p[1] - V1[1], p[0] - V1[0]); });
  var dists = FLOOR.map(function (p) { return Math.hypot(p[0] - V1[0], p[1] - V1[1]); });
  var TH0 = Math.max.apply(null, angs) + 0.004, TH1 = Math.min.apply(null, angs) - 0.004;
  var IA = 1 / (Math.max.apply(null, dists) * 1.02), IB = 1 / (Math.min.apply(null, dists) * 0.98);
  function uv2img(u, v) {
    var th = TH0 + v * (TH1 - TH0), r = 1 / (IA + u * (IB - IA));
    return [V1[0] + r * Math.cos(th), V1[1] + r * Math.sin(th)];
  }
  function img2uv(px, py) {
    var th = Math.atan2(py - V1[1], px - V1[0]), r = Math.hypot(px - V1[0], py - V1[1]);
    return [(1 / r - IA) / (IB - IA), (th - TH0) / (TH1 - TH0)];
  }
  void V2;

  /* ── the job state ── */
  var LANES = 12, CELLS = 40;
  var sand = new Uint8Array(LANES * CELLS), stain = new Uint8Array(LANES * CELLS);
  var coat = 0;          // finished coats (0..3)
  var front = -1;        // sweep front of the coat in progress (v, 0..1), -1 = none
  var settle = 0;        // walls of the finished photo (0..1)
  var mode = 'refinish'; // 'refinish' | 'lvp' | 'hardwood'
  var planks = [], layT = 0;
  var pass = null;       // {lane, u, kind}
  var dust = [];
  // lanes from the far side of the room to the door: order by the lane's height in the photo
  var laneOrder = [];
  for (var L = 0; L < LANES; L++) laneOrder.push(L);
  laneOrder.sort(function (p, q2) { return uv2img(0.5, (p + 0.5) / LANES)[1] - uv2img(0.5, (q2 + 0.5) / LANES)[1]; });

  /* ── images ── */
  var IMG = {};
  var width = function () { return (cv.clientWidth * Math.min(window.devicePixelRatio || 1, 1.5)) > 760 ? 1200 : 720; };
  function load(key) {
    if (IMG[key]) return IMG[key].p;
    var im = new Image();
    im.decoding = 'async';
    var p = new Promise(function (res) { im.onload = function () { res(im); }; im.onerror = function () { res(null); }; });
    im.src = new URL('woodbury-' + key + '-' + width() + '.webp', base).href;
    IMG[key] = { im: im, p: p };
    return p;
  }
  var ok = function (k) { return IMG[k] && IMG[k].im.complete && IMG[k].im.naturalWidth; };

  /* ── view: cover fit with a focal point on the floor ── */
  var W = 0, Hh = 0, DPR = 1, S = 1, OX = 0, OY = 0;
  function resize() {
    var w = cv.clientWidth, hgt = cv.clientHeight;
    if (!w || !hgt) return false;
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    if (w * hgt * DPR * DPR > 4e6) DPR = Math.sqrt(4e6 / (w * hgt));
    W = w; Hh = hgt;
    cv.width = Math.round(w * DPR); cv.height = Math.round(hgt * DPR);
    S = Math.max(w / IW, hgt / IH);
    var fy = w > hgt * 1.4 ? 0.7 : 0.62;
    OX = (w - IW * S) * 0.5; OY = (hgt - IH * S) * fy;
    return true;
  }
  function toC(p) { return [OX + p[0] * S, OY + p[1] * S]; }
  function fromC(x, y) { return [(x - OX) / S, (y - OY) / S]; }

  function quad(u0, u1, v0, v1) {
    var a = toC(uv2img(u0, v0)), b = toC(uv2img(u1, v0)), c = toC(uv2img(u1, v1)), d = toC(uv2img(u0, v1));
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
  }
  function floorClip() {
    ctx.beginPath();
    FLOOR.forEach(function (p, i) { var c = toC(p); if (i) ctx.lineTo(c[0], c[1]); else ctx.moveTo(c[0], c[1]); });
    ctx.closePath(); ctx.clip();
  }
  function runsPath(grid) {
    ctx.beginPath();
    var any = false;
    for (var l = 0; l < LANES; l++) {
      var c = 0;
      while (c < CELLS) {
        if (!grid[l * CELLS + c]) { c++; continue; }
        var s = c; while (c < CELLS && grid[l * CELLS + c]) c++;
        quad(s / CELLS - 0.004, c / CELLS + 0.004, l / LANES - 0.002, (l + 1) / LANES + 0.002); any = true;
      }
    }
    return any;
  }
  function photo(k, alpha) {
    if (!ok(k)) return;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(IMG[k].im, OX, OY, IW * S, IH * S);
    ctx.globalAlpha = 1;
  }

  /* ── drawing ── */
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, Hh);
    if (reduce && mode === 'refinish' && ok('final') && coat >= 3) { photo('final'); return; }
    photo(ok('worn') ? 'worn' : 'final');
    ctx.save(); floorClip();
    if (mode === 'refinish') {
      if (ok('bare') && runsPath(sand)) { ctx.save(); ctx.clip(); photo('bare'); ctx.restore(); }
      if (ok('stain') && runsPath(stain)) { ctx.save(); ctx.clip(); photo('stain'); ctx.restore(); }
      if (ok('final') && (coat > 0 || front >= 0)) {
        var done = coat / 3;
        if (done > 0) photo('final', done);
        if (front >= 0 && coat < 3) {
          ctx.save(); ctx.beginPath(); quad(-0.05, 1.05, -0.05, front); ctx.clip();
          photo('final', (1 / 3) / (1 - done));
          ctx.restore();
          sheen(front);
        }
      }
    } else {
      drawPlanks();
    }
    ctx.restore();
    if (settle > 0 && mode === 'refinish' && ok('final')) photo('final', settle);
    if (pass) drawPass();
    drawDust();
  }
  function sheen(v) {
    var a = toC(uv2img(-0.05, v)), b = toC(uv2img(1.05, v));
    var g = ctx.createLinearGradient(0, a[1] - 40, 0, a[1] + 10);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(255,236,210,.55)'; ctx.lineWidth = 6; ctx.shadowColor = 'rgba(255,226,190,.9)'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.restore();
    void g;
  }
  function drawPass() {
    var l = pass.lane, v0 = l / LANES, v1 = (l + 1) / LANES;
    var a = toC(uv2img(pass.u, v0 - 0.004)), b = toC(uv2img(pass.u, v1 + 0.004));
    ctx.save();
    ctx.lineCap = 'round';
    var col = pass.kind === 'stain' ? 'rgba(112,68,40,.95)' : 'rgba(255,226,191,.95)';
    var glow = pass.kind === 'stain' ? 'rgba(144,80,39,.7)' : 'rgba(201,139,87,.95)';
    ctx.shadowColor = glow; ctx.shadowBlur = 22;
    ctx.strokeStyle = glow; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.restore();
  }
  function emitDust(lane, u, n) {
    if (reduce) return;
    for (var i = 0; i < n; i++) {
      var p = toC(uv2img(u, (lane + Math.random()) / LANES));
      dust.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 1.4, vy: -0.4 - Math.random() * 1.2, life: 1, r: 0.8 + Math.random() * 1.8 });
    }
    if (dust.length > 160) dust.splice(0, dust.length - 160);
  }
  function drawDust() {
    if (!dust.length) return;
    ctx.save();
    dust.forEach(function (d) { ctx.globalAlpha = Math.max(0, d.life) * 0.7; ctx.fillStyle = '#F1DDBF'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill(); });
    ctx.restore();
  }
  function stepDust(dt) {
    for (var i = dust.length - 1; i >= 0; i--) {
      var d = dust[i]; d.x += d.vx * dt / 16; d.y += d.vy * dt / 16; d.vy += 0.02 * dt / 16; d.life -= dt / 700;
      if (d.life <= 0) dust.splice(i, 1);
    }
  }

  /* new floor (visualization): the edited photo of this room, revealed plank by plank from the far wall to the door.
     Plank outlines only cut the reveal; the seams you see are the photo's own. */
  function buildPlanks(kind) {
    var rows = kind === 'lvp' ? 13 : 22, r = window.ABWood ? window.ABWood.rng(kind === 'lvp' ? 41 : 17) : Math.random;
    var out = [];
    for (var row = 0; row < rows; row++) {
      var u = -r() * 0.25 - 0.05;
      while (u < 1.05) {
        var len = kind === 'lvp' ? 0.26 + r() * 0.22 : 0.14 + r() * 0.2;
        out.push({ row: row, u0: u, u1: Math.min(1.08, u + len) });
        u += len;
      }
    }
    var lane = function (row) { return uv2img(0.5, (row + 0.5) / rows)[1]; };
    out.sort(function (a, b) { return lane(a.row) - lane(b.row) || a.u0 - b.u0; });
    var n = out.length;
    out.forEach(function (p, i) { p.t0 = (i / n) * 1.9; p.rows = rows; });
    return out;
  }
  var LAY = 0.32;                                       // seconds for one plank to settle
  function layEnd() { return planks.length ? planks[planks.length - 1].t0 + LAY : 0; }
  function plankShape(p, dv, pad) {
    var e = pad ? 0.004 : 0, f = pad ? 0.0015 : 0;
    var v0 = p.row / p.rows + dv - f, v1 = (p.row + 1) / p.rows + dv + f;
    return { a: toC(uv2img(p.u0 - e, v0)), b: toC(uv2img(p.u1 + e, v0)), c: toC(uv2img(p.u1 + e, v1)), d: toC(uv2img(p.u0 - e, v1)) };
  }
  function plankPath(g, q) {
    g.beginPath(); g.moveTo(q.a[0], q.a[1]); g.lineTo(q.b[0], q.b[1]); g.lineTo(q.c[0], q.c[1]); g.lineTo(q.d[0], q.d[1]); g.closePath();
  }
  // the photo, seen through one plank; dx/dy carry the photo along with a plank that is still moving
  function paintPlank(g, q, dx, dy) {
    g.save(); plankPath(g, q); g.clip();
    g.drawImage(IMG[mode].im, OX + dx, OY + dy, IW * S, IH * S);
    g.restore();
  }
  function centre(q) { return [(q.a[0] + q.b[0] + q.c[0] + q.d[0]) / 4, (q.a[1] + q.b[1] + q.c[1] + q.d[1]) / 4]; }
  var laid = null, laidKey = '';
  function drawPlanks() {
    var kind = mode;
    if (!ok(kind)) return;
    if (layT >= layEnd()) { photo(kind); drawGloss(); return; }  // all down: the photo itself, no plank edges at all
    var key = kind + ':' + cv.width + 'x' + cv.height;
    if (!laid || laidKey !== key) {
      laid = laid || document.createElement('canvas');
      laid.width = cv.width; laid.height = cv.height; laidKey = key;
      laid.getContext('2d').clearRect(0, 0, laid.width, laid.height);
      planks.forEach(function (p) { p.laid = false; });
    }
    var lg = laid.getContext('2d');
    lg.setTransform(DPR, 0, 0, DPR, 0, 0);
    planks.forEach(function (p) {
      if (!p.laid && layT - p.t0 >= LAY) { paintPlank(lg, plankShape(p, 0, true), 0, 0); p.laid = true; }
    });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(laid, 0, 0); ctx.restore();
    planks.forEach(function (p) {
      if (p.laid) return;
      var t = (layT - p.t0) / LAY;
      if (t <= 0) return;
      var e = 1 - Math.pow(1 - Math.min(1, t), 3);
      var dv = kind === 'lvp' ? -(1 - e) * (1 / p.rows) * 0.9 : 0;    // LVP angles in and slides to the click
      var lift = kind === 'hardwood' ? (1 - e) * 16 : 0;              // hardwood drops into place
      var rest = plankShape(p, 0, true), q = plankShape(p, dv, true);
      var c0 = centre(rest), c1 = centre(q), dx = c1[0] - c0[0], dy = c1[1] - c0[1] - lift;
      q = { a: [q.a[0], q.a[1] - lift], b: [q.b[0], q.b[1] - lift], c: [q.c[0], q.c[1] - lift], d: [q.d[0], q.d[1] - lift] };
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 2.2);
      if (lift > 1) {                                                   // its shadow on the old floor
        ctx.save(); ctx.shadowColor = 'rgba(23,17,14,.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = lift * 0.8;
        plankPath(ctx, q); ctx.fillStyle = 'rgb(60,40,28)'; ctx.fill(); ctx.restore();
      }
      paintPlank(ctx, q, dx, dy);
      ctx.restore();
    });
    if (kind === 'lvp') planks.forEach(function (p) {                   // the click: a bright seam for a moment
      var since = layT - p.t0 - LAY;
      if (since < 0 || since > 0.2) return;
      var q = plankShape(p, 0);
      ctx.save(); ctx.globalAlpha = (1 - since / 0.2) * 0.8; ctx.strokeStyle = '#FFE2BF'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(q.a[0], q.a[1]); ctx.lineTo(q.d[0], q.d[1]); ctx.stroke(); ctx.restore();
    });
  }
  // one light pass of gloss over the new floor, right after the last plank
  function drawGloss() {
    var g = (layT - layEnd()) / 0.9;
    if (g <= 0 || g >= 1.1) return;
    ctx.save(); ctx.globalAlpha = 0.55 * (1 - Math.max(0, g - 0.9) / 0.2);
    sheen(Math.min(1.05, g * 1.1)); ctx.restore();
  }

  /* ── animation loop ── */
  var raf = 0, last = 0, tasks = [];
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function loop(now) {
    raf = 0;
    var dt = Math.min(48, now - last); last = now;
    var busy = false;
    for (var i = 0; i < tasks.length; i++) { if (tasks[i](dt)) busy = true; else { tasks.splice(i, 1); i--; } }
    stepDust(dt);
    draw();
    if (busy || dust.length || tasks.length) raf = requestAnimationFrame(loop);
  }
  function task(fn) { tasks.push(fn); kick(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }

  // a lane pass from one end to the other; resolves when done
  function passLane(lane, grid, kind, dur, dir) {
    return new Promise(function (res) {
      var t = 0;
      task(function (dt) {
        t += dt;
        var k = Math.min(1, t / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        var u = dir > 0 ? e : 1 - e;
        var c = Math.min(CELLS - 1, Math.floor(u * CELLS));
        var from = dir > 0 ? 0 : c, to = dir > 0 ? c : CELLS - 1;
        for (var j = from; j <= to; j++) grid[lane * CELLS + j] = 1;
        pass = { lane: lane, u: u, kind: kind };
        if (kind === 'sand') emitDust(lane, u, 3);
        if (k >= 1) { for (var m = 0; m < CELLS; m++) grid[lane * CELLS + m] = 1; pass = null; res(); return false; }
        return true;
      });
    });
  }
  function sweep(grid, kind, total, onlyEmpty) {
    var lanes = laneOrder.filter(function (l) {
      if (!onlyEmpty) return true;
      for (var j = 0; j < CELLS; j++) if (!grid[l * CELLS + j]) return true;
      return false;
    });
    if (!lanes.length) return Promise.resolve();
    if (reduce) { lanes.forEach(function (l) { for (var j = 0; j < CELLS; j++) grid[l * CELLS + j] = 1; }); kick(); return Promise.resolve(); }
    var per = Math.max(110, total / lanes.length);
    var chain = Promise.resolve();
    lanes.forEach(function (l, i) { chain = chain.then(function () { return passLane(l, grid, kind, per, i % 2 ? -1 : 1); }); });
    return chain;
  }
  function coatPass(n, ms) {
    return new Promise(function (res) {
      if (reduce) { coat = n; front = -1; kick(); res(); return; }
      var t = 0, dur = ms || 760;
      task(function (dt) {
        t += dt; var k = Math.min(1, t / dur);
        front = -0.05 + k * 1.12;
        if (k >= 1) { coat = n; front = -1; res(); return false; }
        return true;
      });
    });
  }
  function fade(to, dur) {
    return new Promise(function (res) {
      if (reduce) { settle = to; kick(); res(); return; }
      var from = settle, t = 0;
      task(function (dt) { t += dt; var k = Math.min(1, t / dur); settle = from + (to - from) * k; if (k >= 1) { res(); return false; } return true; });
    });
  }

  /* ── captions ── */
  var CAP = {
    worn: ['The floor before', 'Woodbury, CT · real photos, one job'],
    sand: ['Sanded to bare wood', 'Woodbury, CT · real photos, one job'],
    stain: ['Special Walnut stain', 'Woodbury, CT · real photos, one job'],
    c1: ['Coat 1 of 3', 'Woodbury, CT · real photos, one job'],
    c2: ['Coat 2 of 3', 'Woodbury, CT · real photos, one job'],
    c3: ['Final coat', 'Woodbury, CT · real photos, one job'],
    done: ['Special Walnut + Bona Traffic', 'Woodbury, CT · real photos, one job'],
    lvp: ['New LVP floor', 'Visualization on a real room'],
    hardwood: ['New hardwood floor', 'Visualization on a real room']
  };
  var capNow = '';
  function caption(k) {
    if (k === capNow) return; capNow = k;
    if (stateEl) stateEl.textContent = CAP[k][0];
    if (srcEl) srcEl.textContent = CAP[k][1];
    root.setAttribute('data-phase', k);
    root.dispatchEvent(new CustomEvent('stage:phase', { bubbles: true, detail: { phase: k } }));
  }
  function setBtn(label, disabled) {
    if (!runBtn) return;
    if (runLbl) runLbl.textContent = label;
    runBtn.disabled = !!disabled;
  }

  /* ── the sequences ── */
  var job = 0; // a new choice cancels the running sequence
  function coverage(grid) { var n = 0; for (var i = 0; i < grid.length; i++) n += grid[i]; return n / grid.length; }
  function clearAll() { sand.fill(0); stain.fill(0); coat = 0; front = -1; settle = 0; pass = null; tasks.length = 0; planks = []; layT = 0; laidKey = ''; }

  function finishRefinish() {
    var my = ++job;
    var alive = function () { return my === job; };
    if (mode !== 'refinish') { mode = 'refinish'; clearAll(); }
    hideHint();
    setBtn('Sanding…', true);
    caption('sand');
    return Promise.all([load('bare'), load('stain'), load('final')]).then(function () {
      if (!alive()) return;
      return sweep(sand, 'sand', 1700, true).then(function () {
        if (!alive()) return;
        caption('stain');
        return wait(200).then(function () { return alive() && sweep(stain, 'stain', 1100, false); });
      }).then(function () {
        if (!alive()) return;
        caption('c1'); return wait(180).then(function () { return alive() && coatPass(1); });
      }).then(function () {
        if (!alive()) return;
        caption('c2'); return wait(200).then(function () { return alive() && coatPass(2); });
      }).then(function () {
        if (!alive()) return;
        caption('c3'); return wait(200).then(function () { return alive() && coatPass(3); });
      }).then(function () {
        if (!alive()) return;
        return fade(1, 600).then(function () { caption('done'); setBtn('Start over', false); root.classList.add('is-done'); });
      });
    });
  }

  function install(kind) {
    var my = ++job;
    hideHint();
    clearAll();
    mode = kind;
    planks = buildPlanks(kind);
    caption(kind);
    setBtn('Start over', false);
    root.classList.remove('is-done');
    kick();
    load(kind).then(function () {
      if (my !== job) return;
      if (reduce) { layT = 99; kick(); return; }
      var stop = layEnd() + 1.2;
      task(function (dt) { if (my !== job) return false; layT += dt / 1000; return layT < stop; });
    });
  }

  // on load: the whole job once (under 5 s), then the floor is the visitor's to sand
  function intro(full) {
    var my = ++job;
    clearAll(); mode = 'refinish';
    root.classList.remove('is-done');
    caption('worn');
    setBtn('Sand it for me', false);
    return Promise.all([load('worn'), load('bare'), load('stain'), load('final')]).then(function () {
      if (my !== job) return;
      kick();
      if (reduce || !full) { if (!reduce && hint) hint.classList.remove('is-off'); return; }
      return wait(500).then(function () {
        if (my !== job || touched) return;
        caption('sand');
        return sweep(sand, 'sand', 1350, true);
      }).then(function () {
        if (my !== job || touched) return;
        caption('stain'); return sweep(stain, 'stain', 850, false);
      }).then(function () {
        if (my !== job || touched) return;
        caption('c1'); return coatPass(1, 480);
      }).then(function () {
        if (my !== job || touched) return;
        caption('c2'); return coatPass(2, 480);
      }).then(function () {
        if (my !== job || touched) return;
        caption('c3'); return coatPass(3, 480);
      }).then(function () {
        if (my !== job || touched) return;
        return fade(1, 450).then(function () { caption('done'); setBtn('Start over', false); root.classList.add('is-done'); showHint(); preloadNew(); });
      });
    });
  }

  function preloadNew() {
    var go = function () { load('lvp'); load('hardwood'); };
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 }); else setTimeout(go, 1500);
  }

  /* ── hint ── */
  var touched = false;
  function showHint() { if (hint && !touched) hint.classList.remove('is-off'); }
  function hideHint() { if (hint) hint.classList.add('is-off'); }

  /* ── drag to sand ── */
  var down = null;
  function laneAt(e) {
    var r = cv.getBoundingClientRect();
    var p = fromC(e.clientX - r.left, e.clientY - r.top);
    var uv = img2uv(p[0], p[1]);
    if (uv[0] < -0.02 || uv[0] > 1.02 || uv[1] < 0 || uv[1] >= 1) return null;
    return { lane: Math.max(0, Math.min(LANES - 1, Math.floor(uv[1] * LANES))), u: Math.max(0, Math.min(0.999, uv[0])) };
  }
  function sandSeg(lane, ua, ub) {
    var a = Math.floor(Math.min(ua, ub) * CELLS), b = Math.floor(Math.max(ua, ub) * CELLS);
    for (var j = Math.max(0, a - 1); j <= Math.min(CELLS - 1, b + 1); j++) sand[lane * CELLS + j] = 1;
  }
  root.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || e.target.closest('button')) return;
    var at = laneAt(e);
    if (!at) return;
    if (mode !== 'refinish' || coat > 0 || settle > 0 || front >= 0) { ++job; clearAll(); mode = 'refinish'; root.classList.remove('is-done'); }
    ++job; // the visitor took over
    touched = true; hideHint();
    load('bare'); load('stain'); load('final');
    down = { id: e.pointerId, lane: at.lane, u: at.u, moved: false, x: e.clientX, y: e.clientY };
    root.classList.add('is-sanding');
    if (e.pointerType === 'mouse') root.setPointerCapture(e.pointerId);
    sandSeg(at.lane, at.u, at.u);
    pass = { lane: at.lane, u: at.u, kind: 'sand' };
    caption('sand'); setBtn('Finish the floor', false);
    emitDust(at.lane, at.u, 6);
    root.dispatchEvent(new CustomEvent('stage:sand', { bubbles: true }));
    kick();
  });
  root.addEventListener('pointermove', function (e) {
    if (!down || e.pointerId !== down.id) return;
    var at = laneAt(e);
    if (!at) return;
    if (at.lane === down.lane) sandSeg(at.lane, down.u, at.u);
    else { sandSeg(down.lane, down.u, at.u); sandSeg(at.lane, down.u, at.u); }
    down.lane = at.lane; down.u = at.u;
    pass = { lane: at.lane, u: at.u, kind: 'sand' };
    emitDust(at.lane, at.u, 3);
    kick();
  });
  function up(e) {
    if (!down || (e && e.pointerId !== down.id)) return;
    down = null; pass = null;
    root.classList.remove('is-sanding');
    kick();
    if (coverage(sand) > 0.9) { root.dispatchEvent(new CustomEvent('stage:sanded', { bubbles: true })); finishRefinish(); }
  }
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('lostpointercapture', up);

  if (runBtn) runBtn.addEventListener('click', function () {
    touched = true;
    if (root.classList.contains('is-done') || mode !== 'refinish') { touched = true; intro(false); return; }
    root.dispatchEvent(new CustomEvent('stage:sand', { bubbles: true }));
    finishRefinish();
  });

  /* ── size ── */
  var rz = 0;
  function redraw() { if (resize()) draw(); }
  if ('ResizeObserver' in window) new ResizeObserver(function () { cancelAnimationFrame(rz); rz = requestAnimationFrame(redraw); }).observe(cv);
  else window.addEventListener('resize', redraw);

  // stop drawing work while the hero is off screen (the loop only runs on demand anyway)
  resize();
  root.classList.add('is-ready');

  /* ── start ── */
  if (reduce) {
    coat = 3; settle = 1;
    load('final').then(function () { caption('done'); setBtn('Show the steps', false); root.classList.add('is-done'); redraw(); });
    load('worn');
  } else {
    // the stage starts after the page has painted its text (never competes with the LCP)
    var go = function () { intro(true); };
    if (document.readyState === 'complete') setTimeout(go, 60);
    else window.addEventListener('load', function () { setTimeout(go, 60); }, { once: true });
  }

  window.ABStage = {
    run: function (service) {
      touched = true;
      if (service === 'lvp-flooring-installation') install('lvp');
      else if (service === 'hardwood-floor-installation') install('hardwood');
      else finishRefinish();
    },
    reset: function () { touched = true; intro(false); },
    el: root
  };
})();
