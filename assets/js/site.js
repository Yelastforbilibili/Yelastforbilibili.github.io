/* ==========================================================================
   site.js — interface behaviour
   Boot counter, custom cursor, reveal observer, EN/中文 switch, clock, and the
   one living artifact (the Kelire buffer). Everything degrades to a readable
   static page if any of it fails.
   ========================================================================== */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var body = document.body;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------- 01. Boot --------------------------------------------- */
  var boot = $('.boot');
  var bootNum = $('.boot__num');

  function ready() {
    body.classList.add('is-ready');
    if (boot) {
      boot.classList.add('is-out');
      window.setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 1500);
    }
  }

  if (boot && !reduced) {
    var t0 = performance.now();
    var DUR = 1250;
    var count = function (t) {
      var p = Math.min(1, (t - t0) / DUR);
      var eased = 1 - Math.pow(1 - p, 3);
      bootNum.textContent = ('00' + Math.round(eased * 100)).slice(-3);
      boot.style.setProperty('--boot-p', eased.toFixed(3));
      if (p < 1) requestAnimationFrame(count);
      else window.setTimeout(ready, 240);
    };
    requestAnimationFrame(count);
  } else {
    ready();
  }

  /* ---------------- 02. Custom cursor ------------------------------------ */
  if (fine) {
    var cursor = $('.cursor');
    var ring = $('.cursor__ring');
    var label = $('.cursor__label');

    if (cursor) {
      body.classList.add('has-cursor');
      docEl.style.cursor = 'none';

      var mx = window.innerWidth / 2, my = window.innerHeight / 2;
      var rx = mx, ry = my;

      document.addEventListener('pointermove', function (e) {
        mx = e.clientX; my = e.clientY;
        cursor.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      }, { passive: true });

      (function loop() {
        rx += (mx - rx) * 0.16;
        ry += (my - ry) * 0.16;
        ring.style.transform = 'translate3d(' + (rx - mx).toFixed(2) + 'px,' + (ry - my).toFixed(2) + 'px,0)';
        requestAnimationFrame(loop);
      })();

      var setHover = function (el) {
        if (!el) {
          cursor.classList.remove('is-hover');
          if (label) label.textContent = '';
          return;
        }
        cursor.classList.add('is-hover');
        var txt = el.getAttribute('data-cursor') || '';
        if (txt === 'Open' && body.classList.contains('zh')) txt = '打开';
        if (label) label.textContent = txt;
      };

      document.addEventListener('pointerover', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        setHover(t.closest('[data-cursor]') || t.closest('a,button'));
      }, { passive: true });

      document.addEventListener('pointerout', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (!t.closest('[data-cursor]') && !t.closest('a,button')) return;
        setHover(null);
      }, { passive: true });
    }
  } else {
    docEl.classList.add('touch');
    var c0 = $('.cursor');
    if (c0 && c0.parentNode) c0.parentNode.removeChild(c0);
  }

  /* ---------------- 03. Reveal ------------------------------------------- */
  var revealables = $$('[data-reveal]');

  if (!('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      var shown = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.transitionDelay = (shown * 90) + 'ms';
        el.classList.add('in');
        io.unobserve(el);
        shown++;
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- 04. Language ----------------------------------------- */
  var langBtn = $('#lang');
  var STORE = 'yelast-lang';

  function applyLang(lang) {
    var zh = lang === 'zh';
    body.classList.toggle('zh', zh);
    docEl.setAttribute('lang', zh ? 'zh-CN' : 'en');

    $$('[data-en]').forEach(function (el) {
      var next = zh ? el.getAttribute('data-zh') : el.getAttribute('data-en');
      if (next != null && el.textContent !== next) el.textContent = next;
    });

    // terminal-style artifacts stay in English on purpose; only prose flips.
    if (langBtn) langBtn.setAttribute('aria-label', zh ? '切换到英文' : 'Switch language');
    try { localStorage.setItem(STORE, lang); } catch (err) {}
  }

  if (langBtn) {
    langBtn.addEventListener('click', function () {
      applyLang(body.classList.contains('zh') ? 'en' : 'zh');
    });
  }

  var saved = null;
  try { saved = localStorage.getItem(STORE); } catch (err) {}
  if (saved === 'zh') applyLang('zh');

  /* ---------------- 05. Clock + scroll readout ---------------------------- */
  var clockEl = $('#clock');
  var footClock = $('#footclock');
  var readout = $('#readout');
  var edgeBar = $('.edge__bar');
  var head = $('.head');

  var fmt = null;
  try {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  } catch (err) {}

  function tickClock() {
    var now = new Date();
    var s = fmt ? fmt.format(now) : now.toTimeString().slice(0, 8);
    if (clockEl) clockEl.textContent = s;
    if (footClock) footClock.textContent = 'UTC+8 ' + s.slice(0, 5);
  }
  tickClock();
  window.setInterval(tickClock, 1000);

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 1 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

      if (readout) readout.textContent = ('00' + Math.round(p * 100)).slice(-3);
      if (edgeBar) edgeBar.style.height = (p * 100).toFixed(2) + '%';
      if (head) head.classList.toggle('is-scrolled', window.scrollY > 24);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ---------------- 06. Kelire buffer (the one living artifact) ----------- */
  var buffer = $('.buffer');
  var bufRead = $('#bufread');

  if (buffer) {
    var pos = 14, dir = 1;
    var EP = 24 * 60;                       // pretend the episode is 24:00
    var stamp = function (v) {
      var secs = Math.round((v / 100) * EP);
      var m = Math.floor(secs / 60), s = secs % 60;
      return ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
    };

    var step = function () {
      pos += dir * 0.42;
      if (pos > 96) { dir = -1; }
      if (pos < 12) { dir = 1; }
      var cache = Math.min(100, pos + 24);
      buffer.style.setProperty('--play', pos.toFixed(2) + '%');
      buffer.style.setProperty('--cache', cache.toFixed(2) + '%');
      if (bufRead) bufRead.textContent = stamp(pos) + ' / 24:00';
    };

    step();
    if (!reduced) window.setInterval(step, 260);
  }

  /* ---------------- 07. Year + anchors ------------------------------------ */
  var yr = $('#yr');
  if (yr) yr.textContent = String(new Date().getFullYear());

  var yrInFoot = $('.foot #yr');
  if (yrInFoot) yrInFoot.textContent = String(new Date().getFullYear());

  if (location.hash) {
    var target = document.querySelector(location.hash);
    if (target) {
      window.setTimeout(function () {
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      }, 60);
    }
  }
})();
