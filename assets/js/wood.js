/* A Bueno · procedural wood for small surfaces (form tiles, service samples, the proof plank).
   Grain is drawn in grayscale and multiplied by the wood tone; no image files. ABWood.paint(canvas) reads data-wood. */
(function () {
  'use strict';

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  var GRAIN = [];
  function makeGrain(i, w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'), r = rng(9173 + i * 131), k, x, y0, amp, f, ph;
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    if (r() < 0.55) {
      var cx = w * (0.25 + r() * 0.5), cy = h * (0.5 + (r() - 0.5) * 0.4);
      for (k = 0; k < 7; k++) { g.beginPath(); g.ellipse(cx, cy, w * (0.12 + k * 0.06), h * (0.12 + k * 0.07), 0, 0, Math.PI * 2); g.strokeStyle = 'rgba(90,55,30,' + (0.1 + r() * 0.1) + ')'; g.lineWidth = 0.7 + r() * 1.1; g.stroke(); }
    }
    for (k = 0; k < Math.round(h / 5.5); k++) {
      y0 = r() * h; amp = 0.8 + r() * 3; f = 0.003 + r() * 0.01; ph = r() * 6.28;
      g.beginPath();
      for (x = 0; x <= w; x += 6) { var y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7 + ph) * amp * 0.35; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.strokeStyle = 'rgba(80,48,26,' + (0.06 + r() * 0.2) + ')'; g.lineWidth = 0.5 + r() * 1.6; g.stroke();
    }
    for (k = 0; k < w * h / 90; k++) { g.fillStyle = 'rgba(70,40,20,' + r() * 0.22 + ')'; g.fillRect(r() * w, r() * h, 1 + r() * 3, 0.8); }
    return c;
  }
  function grains() { if (!GRAIN.length) for (var i = 0; i < 8; i++) GRAIN.push(makeGrain(i, 520, 64)); return GRAIN; }

  var TONES = {
    refinish: { base: '#D9A674', mult: '#704428', finish: true },   // Special Walnut over red oak
    hardwood: { base: '#DDB07C', mult: null, finish: true },        // natural, new strip
    lvp: { base: '#C8B6A0', mult: '#B8A58C', finish: false },       // greige vinyl plank
    plank: { base: '#D9B285', mult: null, finish: false }           // one bare board (the proof plank)
  };
  function hex(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function jitter(h, amt, r) { var c = hex(h), j = 1 + (r() - 0.5) * amt; return 'rgb(' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v * j))); }).join(',') + ')'; }

  function paint(cv) {
    var kind = cv.getAttribute('data-wood') || 'hardwood';
    var T = TONES[kind] || TONES.hardwood;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    var rect = cv.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width * d)), h = Math.max(1, Math.round(rect.height * d));
    if (cv.width === w && cv.height === h && cv.__painted) return;
    cv.width = w; cv.height = h; cv.__painted = true;
    var ctx = cv.getContext('2d'), r = rng(kind.length * 977 + 31), G = grains();
    var planks = [], y, x, len;
    if (kind === 'plank') {
      planks.push({ x: -40, y: 0, w: w + 80, h: h });
    } else {
      var bw = (kind === 'lvp' ? 46 : 26) * d * (w < 300 ? 0.7 : 1);
      for (y = -bw * r(); y < h + bw; y += bw) {
        x = -r() * 300 * d;
        while (x < w) { len = (kind === 'lvp' ? 260 : 150) * d + r() * 260 * d; planks.push({ x: x, y: y, w: len, h: bw }); x += len; }
      }
    }
    planks.forEach(function (p) {
      ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
      ctx.fillStyle = jitter(T.base, kind === 'lvp' ? 0.12 : 0.24, r); ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.globalCompositeOperation = 'multiply';
      var g = G[Math.floor(r() * G.length)];
      ctx.drawImage(g, r() * 80, 0, Math.min(g.width - 80, p.w / d), g.height, p.x, p.y, p.w, kind === 'plank' ? p.h : Math.max(p.h, 18 * d));
      ctx.restore();
      if (kind !== 'plank') { ctx.strokeStyle = 'rgba(60,36,20,.30)'; ctx.lineWidth = d * 0.9; ctx.strokeRect(p.x, p.y, p.w, p.h); }
    });
    ctx.save();
    if (T.mult) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = T.mult; ctx.globalAlpha = kind === 'lvp' ? 0.5 : 0.9; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    if (T.finish) {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(232,160,80,.28)'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'soft-light';
      var sh = ctx.createLinearGradient(0, 0, w, h);
      sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.45, 'rgba(255,248,235,.5)'); sh.addColorStop(0.62, 'rgba(255,248,235,.06)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
    } else if (kind === 'plank') {
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,246,232,.14)'; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function paintAll(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('canvas[data-wood]'), function (cv) {
      if (cv.offsetWidth) paint(cv);
    });
  }

  window.ABWood = { paint: paint, paintAll: paintAll, grains: grains, rng: rng };
})();
