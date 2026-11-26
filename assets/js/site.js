/* A Bueno Hardwood Floors · page motion and UI.
   Everything is visible in the HTML first; motion starts from that final state (gsap.from with clearProps).
   Libraries are optional: without GSAP, ScrollTrigger, Lenis or the stage the page still works and shows everything. */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.remove('no-js');
  doc.classList.add('js');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';
  var gsap = window.gsap;
  if (hasST) gsap.registerPlugin(window.ScrollTrigger);
  var script = document.currentScript;
  var here = script && script.src ? script.src : window.location.href;

  var $ = function (sel, rootEl) { return (rootEl || document).querySelector(sel); };
  var $$ = function (sel, rootEl) { return Array.prototype.slice.call((rootEl || document).querySelectorAll(sel)); };
  var isDesktop = function () { return window.innerWidth >= 1024; };

  /* ── smooth scroll: fine pointer, desktop, no reduced motion; loaded after the page (relative to this file) ── */
  var lenis = null;
  function startLenis() {
    if (reduce || !finePointer || !isDesktop() || typeof window.Lenis === 'undefined') return;
    lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    doc.classList.add('has-lenis');
    if (hasST) {
      lenis.on('scroll', window.ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  if (!reduce && finePointer && isDesktop()) {
    window.addEventListener('load', function () {
      var s = document.createElement('script');
      s.src = new URL('../vendor/lenis.min.js', here).href;
      s.onload = startLenis;
      document.head.appendChild(s);
    }, { once: true });
  }
  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y);
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  function scrollToEl(el, offset) {
    if (!el) return;
    scrollToY(Math.max(0, el.getBoundingClientRect().top + window.scrollY + (offset == null ? -90 : offset)));
  }

  /* ── header: transparent over the dark stage, Ebony after it, hides on fast scroll down ── */
  var hdr = $('[data-hdr]');
  var hero = $('[data-hero]');
  var lastY = window.scrollY;
  function onScrollHeader() {
    if (!hdr) return;
    var y = window.scrollY;
    var stageBox = $('.hero__stage');
    var limit = !hero ? -1 : isDesktop() ? 40 : Math.max(20, (stageBox ? stageBox.offsetTop : 0) - 40);
    hdr.classList.toggle('is-solid', y > limit);
    var menuOpen = doc.classList.contains('menu-open');
    // capítulos presos no celular (obras, "why people call"): o header fica, senão sobra uma faixa vazia em cima
    var keep = $$('.work__track.is-scrub, .why.is-rail').some(function (el) { var r = el.getBoundingClientRect(); return r.top <= 72 && r.bottom > 72; });
    hdr.classList.toggle('is-hidden', !menuOpen && !keep && y > 900 && y > lastY + 4);
    if (keep || y < lastY - 4 || y < 900) hdr.classList.remove('is-hidden');
    lastY = y;
  }
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  /* ── wood swatches (tiles, samples, the proof plank) ── */
  function paintWood() { if (window.ABWood) window.ABWood.paintAll(); }
  if ('requestIdleCallback' in window) requestIdleCallback(paintWood, { timeout: 900 }); else setTimeout(paintWood, 200);
  var lastW = window.innerWidth, rzT;
  window.addEventListener('resize', function () {
    if (Math.abs(window.innerWidth - lastW) < 2) return;
    lastW = window.innerWidth;
    clearTimeout(rzT);
    rzT = setTimeout(function () { $$('canvas[data-wood]').forEach(function (c) { c.__painted = false; }); paintWood(); }, 200);
  });

  /* ── hero intro: the two poster lines rise from their masks, then the supporting lines ── */
  if (hasGsap && !reduce && hero) {
    gsap.from($$('.h1__l2 .ln > span', hero), { yPercent: 105, duration: 1.1, ease: 'expo.out', stagger: 0.12, delay: 0.05, clearProps: 'transform' });
    gsap.from($$('[data-intro]', hero), { y: 18, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, delay: 0.25, clearProps: 'transform,opacity' });
  }

  /* ── reveals ── */
  if (hasST && !reduce) {
    $$('[data-reveal]').forEach(function (group) {
      gsap.from(group.children, { y: 32, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, clearProps: 'transform,opacity',
        scrollTrigger: { trigger: group, start: 'top 86%', once: true } });
    });
    $$('[data-reveal-title]').forEach(function (el) {
      gsap.from(el, { y: 26, opacity: 0, duration: 1, ease: 'expo.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
  }

  /* ── 2 · the stamps press into the plank, one after the other ── */
  if (hasST && !reduce) {
    var stamps = $$('[data-stamps] .stamp');
    if (stamps.length) gsap.from(stamps, { scale: 1.18, opacity: 0, rotate: function (i) { return i % 2 ? 2.5 : -2.5; }, duration: 0.42, ease: 'back.out(2.2)', stagger: 0.12, clearProps: 'transform,opacity',
      scrollTrigger: { trigger: '[data-stamps]', start: 'top 88%', once: true } });
  }

  /* ── forms ── */
  var COAT = { 1: 'first coat', 2: 'second coat', 3: 'final coat' };
  var NAMES = { 'hardwood-floor-refinishing': 'Refinish my hardwood', 'lvp-flooring-installation': 'Install LVP', 'hardwood-floor-installation': 'Install hardwood' };
  var heroForm = $('#quote-hero');
  var finalForm = $('#quote-final');
  var forms = $$('form[data-cs-form]');

  function svcOf(form) { var el = form.querySelector('[name="service"]'); if (!el) return ''; if (el.tagName === 'SELECT') return el.value; var c = form.querySelector('[name="service"]:checked'); return c ? c.value : ''; }
  function one(form, name) { var el = form.querySelector('[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function setRadio(form, name, value) {
    var r = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
    return r;
  }

  forms.forEach(function (form) {
    var details = $('[data-details]', form);
    var sumBox = $('[data-request-summary]', form), sumText = $('[data-request-summary-text]', form), face = $('[data-ticket-face]', form);
    var stepEls = $$('[data-cs-step]', form);
    var nowEl = $('[data-step-now]', form), coatEl = $('[data-coat-now]', form);

    function syncService() {
      var svc = svcOf(form), refinish = !svc || svc === 'hardwood-floor-refinishing';
      var rf = $('[data-reason-for="refinish"]', form), ins = $('[data-reason-for="install"]', form), st = $('[data-stairs]', form);
      if (rf && ins) {
        var hide = refinish ? ins : rf;
        rf.hidden = !refinish; ins.hidden = refinish;
        $$('input', hide).forEach(function (i) { i.checked = false; });
      }
      if (st) { st.hidden = !refinish; if (!refinish) $$('input', st).forEach(function (i) { i.checked = false; }); }
    }
    function compose() {
      var notesEl = form.querySelector('[name="notes"]');
      var notes = notesEl ? notesEl.value.trim().replace(/\s+/g, ' ') : '';
      var sms = one(form, 'sms_consent');
      var parts = [];
      if (form.getAttribute('data-audience') === 'gc') parts.push('Audience: General contractor');
      if (one(form, 'reason')) parts.push('Reason: ' + one(form, 'reason'));
      if (one(form, 'size')) parts.push('Size: ' + one(form, 'size'));
      if (one(form, 'stairs')) parts.push('Stairs: ' + one(form, 'stairs'));
      parts.push('Text messages: ' + (sms || 'unanswered'));
      if (notes) parts.push('Notes: ' + notes);
      if (details) details.value = parts.join(' | ').slice(0, 1000);
      if (sumBox && sumText) {
        var zip = (form.querySelector('[name="zip"]') || {}).value || '';
        var bits = [form.getAttribute('data-audience') === 'gc' ? 'GC' : '', NAMES[svcOf(form)] || '', one(form, 'reason'), one(form, 'size'), one(form, 'stairs') === 'Yes' ? 'Stairs: yes' : '', /^\d{5}$/.test(zip) ? 'ZIP ' + zip : ''].filter(Boolean);
        sumText.textContent = bits.join(' · ');
        sumBox.hidden = bits.length === 0;
        if (face) {
          var tile = form.querySelector('input[name="service"]:checked + .tile__face canvas');
          var src = tile && tile.width ? tile.toDataURL('image/png') : '';
          face.style.setProperty('--ticket-img', src ? 'url("' + src + '")' : '');
        }
      }
    }
    // step 2 size is required but is not a module field: checked here before the module moves on
    function need(show) {
      var miss = [];
      $$('[data-need]', form).forEach(function (fs) {
        if (fs.closest('[data-cs-step]').hidden) return;
        var name = fs.getAttribute('data-need');
        var ok = !!form.querySelector('[name="' + name + '"]:checked');
        var err = $('[data-need-error="' + name + '"]', form);
        if (err && (show || ok)) err.hidden = ok;
        $$('input', fs).forEach(function (i) { if (show || ok) i.setAttribute('aria-invalid', ok ? 'false' : 'true'); });
        if (!ok) miss.push(fs);
      });
      return miss;
    }
    form.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-cs-next]');
      if (!btn) return;
      var miss = need(true);
      if (miss.length) { e.preventDefault(); e.stopImmediatePropagation(); var first = $('input', miss[0]); if (first) first.focus(); }
    }, true);
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || (e.target && e.target.tagName === 'TEXTAREA')) return;
      if (need(false).length) { need(true); e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    form.addEventListener('submit', compose, true);
    form.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'service') syncService();
      if (e.target && e.target.name === 'size') need(false);
      compose();
    });
    form.addEventListener('input', compose);
    var edit = $('[data-edit-request]', form);
    if (edit) edit.addEventListener('click', function () {
      var back = $$('[data-cs-step="3"] [data-cs-back]', form)[0];
      if (back) back.click();
      setTimeout(function () { var b2 = $$('[data-cs-step="2"] [data-cs-back]', form)[0]; if (b2) b2.click(); }, 30);
    });
    // the step line under the coats: "Step 2 of 3 · second coat"
    var sync = function () {
      var vis = stepEls.filter(function (s) { return !s.hidden; })[0];
      if (!vis) return;
      var k = vis.getAttribute('data-cs-step');
      if (nowEl && /^\d$/.test(k)) nowEl.textContent = k;
      if (coatEl && COAT[k]) coatEl.textContent = COAT[k];
      form.classList.toggle('is-done', k === 'done');
      compose();
    };
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(sync);
      stepEls.forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['hidden'] }); });
    }
    form.__abSync = function () { syncService(); compose(); };
    syncService();
    compose();
  });

  /* general contractor: same form, another audience (tag in the request + the notes placeholder) */
  function setAudience(form, gc) {
    if (!form) return;
    if (gc) form.setAttribute('data-audience', 'gc'); else form.removeAttribute('data-audience');
    var badge = $('[data-gc-badge]', form); if (badge) badge.hidden = !gc;
    var notes = form.querySelector('[name="notes"]');
    if (notes) notes.placeholder = notes.getAttribute(gc ? 'data-ph-gc' : 'data-ph-home') || notes.placeholder;
    $$('.qform__gclink', form).forEach(function (l) { l.hidden = gc; });
    form.dispatchEvent(new Event('input', { bubbles: true }));
  }
  $$('[data-gc-off]').forEach(function (b) { b.addEventListener('click', function () { setAudience(b.closest('form'), false); }); });
  $$('[data-gc-link]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var own = a.closest('form');
      var form = own || heroForm;
      if (!form) return;
      e.preventDefault();
      setAudience(form, true);
      if (!own) goEstimate({});
      else { var f = form.querySelector('[name="service"]'); if (f) f.focus(); }
    });
  });
  if (/[?&]audience=gc\b/.test(window.location.search) && heroForm) setAudience(heroForm, true);

  /* ── the stage and step 1 are the same answer ── */
  if (heroForm) {
    heroForm.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'service' && !e.target.__fromStage && window.ABStage) window.ABStage.run(e.target.value);
      if (e.target && e.target.__fromStage) e.target.__fromStage = false;
      syncFinal();
    });
    heroForm.addEventListener('input', function (e) { if (e.target && e.target.name === 'zip') syncFinal(); });
    document.addEventListener('stage:sand', function () {
      // sanding the floor answers step 1: "Refinish my hardwood"
      if ($('[data-cs-step="1"]', heroForm).hidden) return;
      var r = heroForm.querySelector('input[name="service"][value="hardwood-floor-refinishing"]');
      if (r && !r.checked) { r.checked = true; r.__fromStage = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }

  /* the final sentence starts from what the visitor chose up top (until they touch it) */
  var finalTouched = false;
  if (finalForm) {
    finalForm.addEventListener('input', function (e) { if (e.isTrusted) finalTouched = true; });
    finalForm.addEventListener('change', function (e) { if (e.isTrusted) finalTouched = true; });
  }
  function syncFinal() {
    if (!finalForm || !heroForm || finalTouched) return;
    var s = svcOf(heroForm), z = heroForm.querySelector('[name="zip"]');
    var fs = finalForm.querySelector('[name="service"]'), fz = finalForm.querySelector('[name="zip"]');
    // set silently: the visitor has not touched the final form yet (no form_start for it)
    if (s && fs && fs.value !== s) fs.value = s;
    if (z && fz && /^\d{5}$/.test(z.value)) fz.value = z.value;
    if (finalForm.__abSync) finalForm.__abSync();
  }

  /* any CTA → the hero form; a service, a reason or the stairs picked elsewhere arrive already answered */
  function goEstimate(o) {
    o = o || {};
    if (!heroForm) { window.location.href = '/#estimate'; return; }
    var onStep1 = !$('[data-cs-step="1"]', heroForm).hidden;
    var target = isDesktop() ? 0 : Math.max(0, ($('.hero__stage') || heroForm).getBoundingClientRect().top + window.scrollY - 70);
    scrollToY(target);
    var wait = reduce ? 0 : Math.min(1300, 300 + window.scrollY / 4);
    setTimeout(function () {
      if (o.service && onStep1) setRadio(heroForm, 'service', o.service);
      if (o.reason) setRadio(heroForm, 'reason', o.reason);
      if (o.stairs) setRadio(heroForm, 'stairs', 'Yes');
      if (o.zip) { var z = heroForm.querySelector('[name="zip"]'); if (z) { z.value = o.zip; z.dispatchEvent(new Event('input', { bubbles: true })); } }
      var focusEl = onStep1 ? (o.zip ? (heroForm.querySelector('[name="service"]:checked') ? $('[data-cs-step="1"] [data-cs-next]', heroForm) : heroForm.querySelector('[name="service"]')) : heroForm.querySelector('[name="zip"]')) : null;
      if (focusEl) focusEl.focus({ preventScroll: true });
    }, wait);
  }
  $$('[data-service], [data-reason], [data-go-estimate]').forEach(function (a) {
    if (a.tagName === 'FORM' || a.closest('form')) return;
    a.addEventListener('click', function (e) {
      if (a.hasAttribute('data-menu-link')) return;
      e.preventDefault();
      var reason = a.getAttribute('data-reason');
      goEstimate({ service: a.getAttribute('data-service') || (reason ? 'hardwood-floor-refinishing' : ''), reason: reason, stairs: a.hasAttribute('data-stairs-yes') });
    });
  });

  /* ── 3 · real work: the job reel (one job per tab) + full screen ── */
  var reelEl = $('[data-reel]');
  var reel = null;
  if (reelEl && window.JobReel) {
    reel = new window.JobReel(reelEl);
    if (reel.cur) {
      reel.intro();
      var tabs = $$('[data-tab]');
      var nameEl = $('[data-job-name]');
      tabs.forEach(function (t) {
        t.addEventListener('click', function () {
          tabs.forEach(function (x) { x.setAttribute('aria-pressed', String(x === t)); });
          if (nameEl) nameEl.textContent = $('b', t).textContent;
          reel.show(t.getAttribute('data-tab'), true);
        });
        t.addEventListener('pointerenter', function () { reel.prefetch(t.getAttribute('data-tab')); }, { once: true });
      });
      workScrub(tabs, nameEl);
    }
  }

  /* celular: as obras viram uma história de rolagem. O quadro fica preso com o nome da obra em cima; rolar leva cada
     obra do antes ao acabado e passa para a próxima. Nenhuma obra fica escondida atrás de uma aba. */
  function workScrub(tabs, nameEl) {
    var track = $('[data-work-track]'), work = $('.work');
    if (!track || !work || tabs.length < 2) return;
    var pin = $('.work__pin', track);
    var nowName = $('[data-now-name]'), nowTag = $('[data-now-tag]'), nowI = $('[data-now-i]'), segBox = $('[data-now-segs]');
    var jobs = tabs.map(function (t) {
      return { svc: t.getAttribute('data-tab'), name: $('b', t).textContent, tag: $('span', t).textContent };
    });
    var N = jobs.length, on = false, cur = -1, raf = 0, near = false;
    $('[data-now-total]').textContent = String(N);
    segBox.innerHTML = jobs.map(function (j, k) {
      return '<button type="button" class="work__seg" data-seg="' + k + '" aria-label="Show ' + j.name + '"><i></i></button>';
    }).join('');
    var segs = $$('.work__seg', segBox), fills = segs.map(function (b) { return $('i', b); });
    var mq = window.matchMedia('(max-width: 1023px)');
    var TOP = 64;
    // cada obra: um trecho parado no "antes", a subida até o acabado e um respiro no acabado
    var stageOf = function (u) { return Math.max(0, Math.min(1, (u - 0.12) / 0.66)); };
    function travel() { return track.offsetHeight - pin.offsetHeight; }
    function update() {
      raf = 0;
      if (!on) return;
      var r = track.getBoundingClientRect(), T = travel();
      if (!near) { if (r.top > window.innerHeight * 2) return; near = true; }  // as fotos só carregam perto da seção
      var t = T > 0 ? Math.max(0, Math.min(1, (TOP - r.top) / T)) : 0;
      var x = Math.min(N - 0.0001, t * N), k = Math.floor(x), u = x - k;
      if (k !== cur) {
        cur = k;
        nowName.textContent = jobs[k].name; nowTag.textContent = jobs[k].tag; nowI.textContent = String(k + 1);
        if (nameEl) nameEl.textContent = jobs[k].name;
        tabs.forEach(function (x2, j) { x2.setAttribute('aria-pressed', String(j === k)); });
        if (jobs[k + 1]) reel.prefetch(jobs[k + 1].svc);
      }
      fills.forEach(function (f, j) { f.style.transform = 'scaleX(' + (j < k ? 1 : j > k ? 0 : Math.min(1, u / 0.78)).toFixed(3) + ')'; });
      reel.scrubTo(jobs[k].svc, stageOf(u));
    }
    var kick = function () { if (!raf) raf = requestAnimationFrame(update); };
    function size() {
      track.style.setProperty('--n', String(N));
      track.style.setProperty('--pin-h', pin.offsetHeight + 'px');
    }
    function set(want) {
      if (want === on) return;
      on = want;
      work.classList.toggle('is-scrub', on);
      track.classList.toggle('is-scrub', on);
      if (on) { size(); cur = -1; kick(); }
      else { track.style.removeProperty('--pin-h'); reel.show(jobs[Math.max(0, cur)].svc, false); }
      if (hasST) window.ScrollTrigger.refresh();
    }
    segs.forEach(function (b, k) {
      b.addEventListener('click', function () {
        var y = track.getBoundingClientRect().top + window.scrollY - TOP + (travel() * (k + 0.14)) / N;
        window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
      });
    });
    window.addEventListener('scroll', kick, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(function () { if (on) { size(); kick(); } }).observe(pin);
    var onMq = function () { set(mq.matches); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);
    set(mq.matches);
  }

  /* ── 4 · why people call (celular): a seção fica presa e a rolagem vertical passa pelos cartões até o último.
     Reduced motion: fica o carrossel de arrastar (com a mesma barra de progresso). ── */
  (function () {
    var sec = $('.why'), grid = $('.why__grid'), fill = $('[data-why-fill]'), iEl = $('[data-why-i]');
    if (!sec || !grid) return;
    var stick = $('.wrap', sec), cards = $$('.why__card', grid), n = cards.length;
    var tot = $('[data-why-total]');
    if (tot) tot.textContent = String(n);
    var mq = window.matchMedia('(max-width: 639px)');
    var rail = false, raf = 0, dist = 0, TOP = 64;
    function paint(f) {
      f = Math.max(0, Math.min(1, f));
      if (fill) fill.style.transform = 'scaleX(' + (1 / n + (1 - 1 / n) * f).toFixed(4) + ')';
      if (iEl) iEl.textContent = String(Math.round(f * (n - 1)) + 1);
    }
    function measure() {
      grid.style.transform = '';
      var g = grid.getBoundingClientRect(), last = cards[n - 1].getBoundingClientRect();
      dist = Math.max(0, Math.round(last.right - (g.right - 16)));
      sec.style.setProperty('--dist', dist + 'px');
    }
    function update() {
      raf = 0;
      if (!rail) return;
      var r = sec.getBoundingClientRect(), T = sec.offsetHeight - stick.offsetHeight;
      var hold = Math.max(0, (T - dist) / 2);
      var x = Math.max(0, Math.min(dist, TOP - r.top - hold));
      grid.style.transform = 'translate3d(' + (-x).toFixed(1) + 'px,0,0)';
      paint(dist ? x / dist : 0);
    }
    var kick = function () { if (!raf) raf = requestAnimationFrame(update); };
    function set() {
      var want = mq.matches && !reduce;
      if (want !== rail) {
        rail = want;
        sec.classList.toggle('is-rail', rail);
        if (!rail) { grid.style.transform = ''; sec.style.removeProperty('--dist'); }
        if (hasST) window.ScrollTrigger.refresh();
      }
      if (rail) { measure(); kick(); }
    }
    window.addEventListener('scroll', kick, { passive: true });
    // teclado: o cartão que recebe o foco vem para a tela (a página rola até a posição dele no trilho)
    grid.addEventListener('focusin', function (e) {
      if (!rail) return;
      var k = cards.indexOf(e.target.closest('.why__card'));
      if (k < 0) return;
      var T = sec.offsetHeight - stick.offsetHeight, hold = Math.max(0, (T - dist) / 2);
      window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - TOP + hold + (n > 1 ? dist * k / (n - 1) : 0), behavior: 'auto' });
    });
    grid.addEventListener('scroll', function () {  // carrossel (reduced motion): a barra segue o arrasto
      if (!rail) paint(grid.scrollWidth > grid.clientWidth ? grid.scrollLeft / (grid.scrollWidth - grid.clientWidth) : 0);
    }, { passive: true });
    var lastW = window.innerWidth;
    window.addEventListener('resize', function () { if (window.innerWidth !== lastW) { lastW = window.innerWidth; set(); } });
    if (mq.addEventListener) mq.addEventListener('change', set); else mq.addListener(set);
    set();
    paint(0);
  })();

  /* lightbox: photos of the current job, arrows, keys and swipe; Esc returns the focus */
  var lb = null;
  function lightbox(items, start, opener) {
    if (typeof HTMLDialogElement === 'undefined' || !items.length) return;
    if (!lb) {
      lb = document.createElement('dialog');
      lb.className = 'lb';
      lb.setAttribute('aria-label', 'Photos of the job');
      lb.innerHTML = '<div class="lb__stage"><img class="lb__img" alt=""></div><div class="lb__bar"><p class="lb__cap"></p><p class="lb__count"></p></div>' +
        '<button class="lb__btn lb__close" type="button" aria-label="Close"><svg class="ic" aria-hidden="true"><use href="#i-close"></use></svg></button>' +
        '<button class="lb__btn lb__prev" type="button" aria-label="Previous photo"><svg class="ic" aria-hidden="true"><use href="#i-arrow-left"></use></svg></button>' +
        '<button class="lb__btn lb__next" type="button" aria-label="Next photo"><svg class="ic" aria-hidden="true"><use href="#i-arrow-right"></use></svg></button>';
      document.body.appendChild(lb);
      lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb__stage')) lb.close(); });
      $('.lb__close', lb).addEventListener('click', function () { lb.close(); });
      $('.lb__prev', lb).addEventListener('click', function () { lb.__show(lb.__i - 1); });
      $('.lb__next', lb).addEventListener('click', function () { lb.__show(lb.__i + 1); });
      lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') lb.__show(lb.__i - 1); if (e.key === 'ArrowRight') lb.__show(lb.__i + 1); });
      lb.addEventListener('close', function () { if (lenis) lenis.start(); if (lb.__opener) lb.__opener.focus(); });
      var sx = null;
      lb.addEventListener('pointerdown', function (e) { sx = e.clientX; });
      lb.addEventListener('pointerup', function (e) { if (sx === null) return; var d = e.clientX - sx; sx = null; if (Math.abs(d) > 50) lb.__show(lb.__i + (d < 0 ? 1 : -1)); });
    }
    lb.__items = items; lb.__opener = opener;
    lb.__show = function (i) {
      var n = lb.__items.length; lb.__i = (i + n) % n;
      var it = lb.__items[lb.__i];
      $('.lb__img', lb).src = it.src; $('.lb__img', lb).alt = it.alt;
      $('.lb__cap', lb).textContent = it.cap; $('.lb__count', lb).textContent = (lb.__i + 1) + ' / ' + n;
    };
    lb.__show(start || 0);
    lb.showModal();
    if (lenis) lenis.stop();
  }
  var zoom = $('[data-reel-zoom]');
  if (zoom && reelEl) zoom.addEventListener('click', function () {
    var set = $('.reel__set.is-on', reelEl);
    var tag = ($('[data-tab][aria-pressed="true"]') || {}).getAttribute ? $('[data-tab][aria-pressed="true"]').getAttribute('data-tag') : '';
    var items = $$('img', set).map(function (img) {
      var ss = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
      var big = ss.split(',').map(function (s) { return s.trim().split(' ')[0]; }).filter(Boolean).pop() || img.src;
      return { src: big, alt: img.alt, cap: tag + ' · ' + img.getAttribute('data-label') };
    });
    var at = reel ? Math.round(reel.p) : items.length - 1;
    lightbox(items, at, zoom);
  });

  /* ── 5 · process: the frame follows the step on screen; each clip plays once (~4 s), only near the section ── */
  var steps = $$('[data-steps] .step');
  var pitems = $$('[data-pm]');
  var pcap = $('[data-pm-cap]');
  var current = 0;
  function playStep(n) {
    if (n === current) return;
    current = n;
    steps.forEach(function (s) { s.classList.toggle('is-on', +s.getAttribute('data-step-n') === n); });
    pitems.forEach(function (it) {
      var on = +it.getAttribute('data-pm') === n;
      it.classList.toggle('is-on', on);
      var v = $('video', it);
      if (!v) return;
      if (on && !reduce) {
        if (!v.src && v.getAttribute('data-src')) v.src = new URL(v.getAttribute('data-src'), window.location.href).href;
        try { v.currentTime = 0; } catch (_e) { /* not loaded yet */ }
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } else if (!on) v.pause();
    });
    var st = steps.filter(function (s) { return +s.getAttribute('data-step-n') === n; })[0];
    if (pcap && st) pcap.textContent = st.getAttribute('data-cap');
  }
  if (steps.length && 'IntersectionObserver' in window) {
    var stepIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) playStep(+e.target.getAttribute('data-step-n')); });
    }, { rootMargin: isDesktop() ? '-45% 0px -45% 0px' : '-62% 0px -26% 0px' });
    steps.forEach(function (s) { stepIO.observe(s); });
    current = 1;
  }

  /* ── 6 · the name on the door gets its sanding pass with the scroll ── */
  var door = $('[data-door-fin]');
  if (door && hasST && !reduce) {
    gsap.fromTo(door, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', ease: 'none',
      scrollTrigger: { trigger: door.parentNode, start: 'top 92%', end: 'bottom 55%', scrub: 0.6 } });
  }

  /* ── 8 · reviews: one at a time ── */
  var qs = $$('[data-quotes] .quote'), qi = 0, qNow = $('[data-q-now]');
  function showQ(i) {
    qi = (i + qs.length) % qs.length;
    qs.forEach(function (q, k) { q.classList.toggle('is-on', k === qi); });
    if (qNow) qNow.textContent = String(qi + 1);
  }
  var qp = $('[data-q-prev]'), qn = $('[data-q-next]');
  if (qp) qp.addEventListener('click', function () { showQ(qi - 1); });
  if (qn) qn.addEventListener('click', function () { showQ(qi + 1); });
  var qsx = null, qtrack = $('.quotes__track');
  if (qtrack) {
    qtrack.addEventListener('pointerdown', function (e) { qsx = e.clientX; });
    qtrack.addEventListener('pointerup', function (e) { if (qsx === null) return; var d = e.clientX - qsx; qsx = null; if (Math.abs(d) > 50) showQ(qi + (d < 0 ? 1 : -1)); });
  }

  /* ── 9 · the scope: a pencil tick on each line as it comes in ── */
  if (hasST && !reduce) {
    $$('.scope__t tbody tr').forEach(function (tr) {
      var tick = $('.tick path', tr);
      if (tick) gsap.fromTo(tick, { strokeDashoffset: 24 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out', scrollTrigger: { trigger: tr, start: 'top 88%', once: true } });
    });
  }

  /* ── 10 · map: from Fairfield to every town ── */
  var routes = $('[data-map-routes]');
  var hq = $('.town--hq');
  if (routes && hq) {
    var pos = function (g) { var m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute('transform') || ''); return m ? [+m[1], +m[2]] : [0, 0]; };
    var o = pos(hq), paths = [];
    $$('.town:not(.town--hq)').forEach(function (t) {
      var p = pos(t), mx = (o[0] + p[0]) / 2, my = (o[1] + p[1]) / 2 - Math.hypot(p[0] - o[0], p[1] - o[1]) * 0.18;
      var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', 'M' + o[0] + ' ' + o[1] + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + p[0] + ' ' + p[1]);
      routes.appendChild(el); paths.push(el);
    });
    if (hasST && !reduce) {
      paths.forEach(function (el) { var L = el.getTotalLength(); el.style.strokeDasharray = L; el.style.strokeDashoffset = L; });
      gsap.to(paths, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out', stagger: 0.06, scrollTrigger: { trigger: '[data-map]', start: 'top 75%', once: true } });
      gsap.from($$('.town:not(.town--hq) circle'), { attr: { r: 0 }, duration: 0.5, ease: 'back.out(3)', stagger: 0.06, delay: 0.5, scrollTrigger: { trigger: '[data-map]', start: 'top 75%', once: true } });
    }
  }
  // on a phone the map keeps only the dots: the town list opens below it
  var towns = $('.towns');
  if (towns && window.innerWidth < 640) towns.open = true;
  var zc = $('[data-zipcheck]');
  if (zc) zc.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('input', zc), err = $('[data-zipcheck-err]', zc);
    var z = (input.value || '').replace(/\D/g, '');
    var ok = /^\d{5}$/.test(z);
    err.hidden = ok; input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (!ok) { input.focus(); return; }
    goEstimate({ zip: z });
  });

  /* ── 12 · "what's under there": the worn strip gets one pass with the scroll ── */
  var strip = $('.final__strip');
  if (strip) {
    // as duas fotos são <img loading="lazy"> com srcset (até 2400 px): o navegador escolhe a nitidez pela tela
    var bare = $('[data-final-bare]'), line = $('[data-final-line]');
    if (hasST && !reduce && bare && line) {
      gsap.set(bare, { clipPath: 'inset(0 100% 0 0)' });
      gsap.set(line, { left: '0%' });
      var tl = gsap.timeline({ scrollTrigger: { trigger: strip, start: 'top 85%', end: 'bottom 30%', scrub: 0.6 } });
      tl.to(bare, { clipPath: 'inset(0 0% 0 0)', ease: 'none' }, 0).to(line, { left: '100%', ease: 'none' }, 0);
    }
  }

  /* ── open now? (Fairfield time; every day 7 AM–9 PM per the Google profile) ── */
  (function () {
    var els = $$('[data-open-status]');
    if (!els.length || typeof Intl === 'undefined') return;
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      var get = function (t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : ''; };
      var t = (parseInt(get('hour'), 10) % 24) + parseInt(get('minute'), 10) / 60;
      var open = t >= 7 && t < 21;
      var text = open ? 'Open now · Alex answers until 9 PM' : 'Closed now · Alex answers from 7 AM ' + (t >= 21 ? 'tomorrow' : 'today');
      els.forEach(function (el) { el.classList.toggle('is-open', open); var tx = $('[data-open-text]', el); if (tx) tx.textContent = text; });
    } catch (_e) { /* keeps the static hours */ }
  })();

  /* ── mobile bar: after the hero form, hidden while the final form is on screen ── */
  var mbar = $('[data-mbar]');
  var heroBox = $('[data-hero-form]');
  var finalBox = $('[data-final-form]');
  if (mbar && 'IntersectionObserver' in window) {
    var pastHero = !heroBox, finalOn = false;
    var paint = function () { mbar.classList.toggle('is-on', pastHero && !finalOn); };
    if (heroBox) new IntersectionObserver(function (es) { es.forEach(function (e) { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; }); paint(); }).observe(heroBox);
    if (finalBox) new IntersectionObserver(function (es) { es.forEach(function (e) { finalOn = e.isIntersecting; }); paint(); }, { threshold: 0.15 }).observe(finalBox);
    paint();
  }

  /* ── mobile menu: focus trapped, Esc closes, focus returns to the button ── */
  var menu = $('[data-menu]');
  var toggle = $('[data-menu-toggle]');
  if (menu && toggle) {
    var main = $('#main'), footer = $('.ftr');
    var focusables = function () { return $$('a[href], button:not([disabled])', menu); };
    var open = function () {
      menu.hidden = false; doc.classList.add('menu-open'); toggle.setAttribute('aria-expanded', 'true');
      [main, footer, hdr, mbar].forEach(function (el) { if (el) el.inert = true; });
      if (lenis) lenis.stop();
      document.body.style.overflow = 'hidden';
      var f = focusables(); if (f[1]) f[1].focus();
    };
    var close = function (back) {
      doc.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false');
      [main, footer, hdr, mbar].forEach(function (el) { if (el) el.inert = false; });
      if (lenis) lenis.start();
      document.body.style.overflow = '';
      menu.hidden = true;
      if (back !== false) toggle.focus();
    };
    toggle.addEventListener('click', open);
    $('[data-menu-close]', menu).addEventListener('click', function () { close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) close(); });
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$('[data-menu-link]', menu).forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href') || '';
        var id = href.indexOf('#') > -1 ? href.slice(href.indexOf('#')) : '';
        close(false);
        if (a.hasAttribute('data-go-estimate')) { e.preventDefault(); goEstimate({}); return; }
        if (id && $(id)) { e.preventDefault(); scrollToEl($(id), -70); }
      });
    });
  }

  /* in-page anchors go through Lenis when it is on */
  document.addEventListener('click', function (e) {
    if (!lenis) return;
    var a = e.target.closest && e.target.closest('a[href^="/#"], a[href^="#"]');
    if (!a || a.hasAttribute('data-service') || a.hasAttribute('data-reason') || a.hasAttribute('data-go-estimate') || a.hasAttribute('data-menu-link') || a.hasAttribute('data-gc-link')) return;
    var href = a.getAttribute('href'); var id = href.slice(href.indexOf('#'));
    var t = id.length > 1 ? $(id) : null;
    if (t) { e.preventDefault(); scrollToEl(t, -84); }
  });

  if (hasST) window.addEventListener('load', function () { window.ScrollTrigger.refresh(); });
})();
