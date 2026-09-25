/* ==========================================================================
   Designwave — interactions
   Vanilla JS, no dependencies. Every module is optional: it looks for its
   markup and quietly does nothing when that markup is not on the page.
   ========================================================================== */
(() => {
  'use strict';

  /* ---- Site settings — edit these ------------------------------------- */
  const SITE = {
    email: 'hello@yourdomain.com', // where the contact form sends enquiries
    timeZone: null,                // e.g. 'Europe/Berlin'; null = visitor's local time
  };

  /* ---- Helpers --------------------------------------------------------- */
  const html = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fontsReady = () => Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(1500)]);
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };
  const safe = (fn) => { try { fn(); } catch (err) { console.error('[designwave]', fn.name, err); } };

  if (!reduceMotion) html.classList.add('has-motion');

  /* ---- Frame loop ------------------------------------------------------ */
  const ticks = new Set();
  const onResize = new Set();
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let scrollY = window.scrollY;
  let lastScrollY = scrollY;
  let velocity = 0;
  let dt = 1;
  let lastT = performance.now();

  window.addEventListener('resize', debounce(() => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    onResize.forEach((fn) => fn());
  }, 120));

  /* ---- Smooth wheel scrolling (desktop only) --------------------------- */
  const smooth = (() => {
    if (reduceMotion || !finePointer) return null;
    let target = window.scrollY;
    let current = target;
    let active = false;
    let locked = false;
    const max = () => document.documentElement.scrollHeight - window.innerHeight;

    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey) return; // pinch-zoom
      if (locked) { e.preventDefault(); return; }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // horizontal sliders
      if (e.target.closest && e.target.closest('textarea, [data-native-scroll]')) return;
      e.preventDefault();
      if (!active) target = current = window.scrollY;
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 40;
      else if (e.deltaMode === 2) d *= window.innerHeight;
      target = clamp(target + d, 0, max());
      active = true;
    }, { passive: false });

    window.addEventListener('scroll', () => { if (!active) target = current = window.scrollY; }, { passive: true });

    return {
      update() {
        if (!active) return;
        current = lerp(current, target, clamp(0.1 * dt, 0, 1));
        if (Math.abs(target - current) < 0.5) { current = target; active = false; }
        window.scrollTo(0, current);
      },
      to(y) {
        if (!active) current = window.scrollY;
        target = clamp(y, 0, max());
        active = true;
      },
      lock(v) { locked = v; if (v) active = false; },
    };
  })();

  const scrollToY = (y) => {
    if (smooth) smooth.to(y);
    else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  const lockScroll = (v) => {
    if (smooth) smooth.lock(v);
    html.style.overflow = v ? 'hidden' : '';
  };

  const frame = (t) => {
    dt = clamp((t - lastT) / 16.667, 0.25, 3);
    lastT = t;
    if (smooth) smooth.update();
    scrollY = window.scrollY;
    velocity = lerp(velocity, scrollY - lastScrollY, 0.25);
    lastScrollY = scrollY;
    ticks.forEach((fn) => fn(t));
    requestAnimationFrame(frame);
  };

  /* ---- Text splitting -------------------------------------------------- */
  // data-split="words" | "chars" wraps each word (and letter) in masks so it
  // can slide up into place. The original text stays readable for assistive
  // technology through a visually hidden copy.
  function split(el) {
    const mode = el.dataset.split || 'words';
    const plain = el.textContent.replace(/\s+/g, ' ').trim();
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'split-w';
            w.setAttribute('aria-hidden', 'true');
            if (mode === 'chars') {
              Array.from(part).forEach((ch) => {
                const c = document.createElement('span');
                c.className = 'split-c split-i';
                c.style.setProperty('--i', i++);
                c.textContent = ch;
                w.appendChild(c);
              });
            } else {
              const inner = document.createElement('span');
              inner.className = 'split-i';
              inner.style.setProperty('--i', i++);
              inner.textContent = part;
              w.appendChild(inner);
            }
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR' && !child.classList.contains('sr-only')) {
          walk(child);
        }
      });
    };
    walk(el);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = plain;
    el.appendChild(sr);
  }

  /* ---- Scroll reveals -------------------------------------------------- */
  function initReveal() {
    $$('[data-reveal="stagger"]').forEach((el) => {
      Array.from(el.children).forEach((c, i) => c.style.setProperty('--i', i));
    });
    const els = $$('[data-reveal], [data-split]');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-inview')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-inview');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ---- Preloader ------------------------------------------------------- */
  function runPreloader() {
    const el = $('.preloader');
    if (!el || !html.classList.contains('is-preloading') || reduceMotion) {
      html.classList.remove('is-preloading');
      return Promise.resolve();
    }
    const count = $('[data-count]', el);
    const bar = $('.preloader__bar', el);
    const duration = 2000;
    const start = performance.now();
    let fontsLoaded = false;
    fontsReady().then(() => { fontsLoaded = true; });

    return new Promise((resolve) => {
      const step = (now) => {
        let t = clamp((now - start) / duration, 0, 1);
        if (!fontsLoaded) t = Math.min(t, 0.92);
        const p = 1 - Math.pow(1 - t, 3);
        count.textContent = String(Math.round(p * 100)).padStart(2, '0');
        bar.style.setProperty('--p', p.toFixed(3));
        if (t < 1) { requestAnimationFrame(step); return; }
        setTimeout(() => {
          el.classList.add('is-done');
          setTimeout(resolve, 350);
          setTimeout(() => html.classList.remove('is-preloading'), 1200);
        }, 250);
      };
      requestAnimationFrame(step);
    });
  }

  /* ---- Page transitions ------------------------------------------------ */
  const PAGE_NAMES = { '': 'Home', index: 'Home', work: 'Work', services: 'Services', about: 'About', contact: 'Contact', project: 'Case study' };

  async function runEnter() {
    if (!html.classList.contains('is-entering')) return;
    await fontsReady();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    html.classList.add('is-entered');
    setTimeout(() => html.classList.remove('is-entering', 'is-entered'), 1000);
    await wait(250);
  }

  let closeMenu = () => {};

  function initTransitions() {
    if (reduceMotion) return;
    const label = $('.transition__label span');
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download') || 'noTransition' in a.dataset) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
      e.preventDefault();
      const slug = url.pathname.split('/').pop().replace(/\.html$/, '');
      if (label) label.textContent = PAGE_NAMES[slug] || 'Designwave';
      store.set('dw-nav', '1');
      closeMenu();
      html.classList.add('is-leaving');
      setTimeout(() => { location.href = url.href; }, 780);
    });
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) html.classList.remove('is-leaving', 'is-entering', 'is-entered');
    });
  }

  /* ---- Header ---------------------------------------------------------- */
  function initHeader() {
    const header = $('[data-header]');
    if (!header) return;
    let last = window.scrollY;
    ticks.add(() => {
      const y = scrollY;
      header.classList.toggle('is-scrolled', y > 20);
      if (!html.classList.contains('menu-open')) {
        if (y > last + 3 && y > 240) header.classList.add('is-hidden');
        else if (y < last - 3 || y < 240) header.classList.remove('is-hidden');
      }
      last = y;
    });
  }

  /* ---- Mobile menu ----------------------------------------------------- */
  function initMenu() {
    const btn = $('[data-menu-toggle]');
    const menu = $('[data-menu]');
    if (!btn || !menu) return;
    const isOpen = () => html.classList.contains('menu-open');
    const set = (open) => {
      html.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.inert = !open;
      lockScroll(open);
      if (open) setTimeout(() => { const a = $('a', menu); if (a) a.focus({ preventScroll: true }); }, 350);
    };
    menu.inert = true;
    closeMenu = () => { if (isOpen()) set(false); };
    btn.addEventListener('click', () => set(!isOpen()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) { set(false); btn.focus(); }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) closeMenu(); });
  }

  /* ---- Custom cursor --------------------------------------------------- */
  function initCursor() {
    if (!finePointer || reduceMotion) return;
    const el = $('.cursor');
    const dot = $('.cursor-dot');
    if (!el || !dot) return;
    const ring = $('.cursor__ring', el);
    const label = $('.cursor__label', el);
    html.classList.add('has-cursor');
    const m = { x: vw / 2, y: vh / 2 };
    const r = { x: m.x, y: m.y };
    let seen = false;
    el.classList.add('is-hidden');
    dot.classList.add('is-hidden');

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      m.x = e.clientX;
      m.y = e.clientY;
      if (!seen) { seen = true; r.x = m.x; r.y = m.y; }
      el.classList.remove('is-hidden');
      dot.classList.remove('is-hidden');
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => {
      el.classList.add('is-hidden');
      dot.classList.add('is-hidden');
    });
    window.addEventListener('pointerdown', () => el.classList.add('is-down'));
    window.addEventListener('pointerup', () => el.classList.remove('is-down'));

    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], a, button, label, [role="button"], input[type="submit"]');
      el.classList.remove('is-hover', 'is-view');
      dot.classList.remove('is-hover');
      if (!t) return;
      if (t.dataset.cursor) {
        label.textContent = t.dataset.cursorLabel || 'View';
        el.classList.add('is-view');
        dot.classList.add('is-hover');
      } else {
        el.classList.add('is-hover');
        dot.classList.add('is-hover');
      }
    });

    ticks.add(() => {
      r.x = lerp(r.x, m.x, clamp(0.2 * dt, 0, 1));
      r.y = lerp(r.y, m.y, clamp(0.2 * dt, 0, 1));
      dot.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
      ring.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
    });
  }

  /* ---- Magnetic elements ----------------------------------------------- */
  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    const active = new Set();
    $$('[data-magnetic]').forEach((el) => {
      const s = { el, strength: parseFloat(el.dataset.magnetic) || 0.35, x: 0, y: 0, tx: 0, ty: 0, rect: null };
      el.addEventListener('pointerenter', () => { s.rect = el.getBoundingClientRect(); active.add(s); });
      el.addEventListener('pointermove', (e) => {
        const rc = s.rect || el.getBoundingClientRect();
        s.tx = (e.clientX - (rc.left - s.x + rc.width / 2)) * s.strength;
        s.ty = (e.clientY - (rc.top - s.y + rc.height / 2)) * s.strength;
      });
      el.addEventListener('pointerleave', () => { s.tx = 0; s.ty = 0; s.rect = null; });
    });
    ticks.add(() => {
      active.forEach((s) => {
        s.x = lerp(s.x, s.tx, clamp(0.16 * dt, 0, 1));
        s.y = lerp(s.y, s.ty, clamp(0.16 * dt, 0, 1));
        s.el.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0)`;
        if (!s.rect && Math.abs(s.x) < 0.05 && Math.abs(s.y) < 0.05) {
          s.el.style.transform = '';
          active.delete(s);
        }
      });
    });
  }

  /* ---- Hero: generative wave field + scroll-out ------------------------ */
  function initWaves() {
    $$('[data-waves]').forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const host = canvas.parentElement;
      const accent = getComputedStyle(html).getPropertyValue('--accent').trim() || '#3b4bff';
      const count = parseInt(canvas.dataset.waves, 10) || 16;
      const accentLine = Math.floor(count * 0.62);
      const mouse = { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0 };
      let w = 0;
      let h = 0;
      let visible = true;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      const draw = (t) => {
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < count; i++) {
          const k = i / (count - 1);
          const baseY = h * (0.1 + k * 0.84);
          ctx.beginPath();
          for (let x = -10; x <= w + 10; x += 10) {
            const dx = x - mouse.x;
            const dy = baseY - mouse.y;
            const infl = Math.exp(-(dx * dx + dy * dy) / 45000) * mouse.s;
            const y = baseY
              + Math.sin(x * 0.0032 + t * 0.00042 + i * 0.42) * (12 + k * 26)
              + Math.sin(x * 0.0085 - t * 0.00066 + i * 0.9) * 5
              + infl * 70 * (dy / (Math.abs(dy) + 60));
            if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          const isAccent = i === accentLine;
          ctx.strokeStyle = isAccent ? accent : 'rgba(15, 15, 15, 0.09)';
          ctx.lineWidth = isAccent ? 1.6 : 1;
          ctx.stroke();
        }
      };

      resize();
      onResize.add(resize);
      if (reduceMotion) { draw(0); onResize.add(() => draw(0)); return; }

      host.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.tx = e.clientX - r.left;
        mouse.ty = e.clientY - r.top;
        if (mouse.ts === 0) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
        mouse.ts = 1;
      });
      host.addEventListener('pointerleave', () => { mouse.ts = 0; });
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);

      ticks.add((t) => {
        if (!visible) return;
        mouse.x = lerp(mouse.x, mouse.tx, 0.08);
        mouse.y = lerp(mouse.y, mouse.ty, 0.08);
        mouse.s = lerp(mouse.s, mouse.ts, 0.05);
        draw(t);
      });
    });
  }

  function initHero() {
    const hero = $('[data-hero]');
    if (!hero || reduceMotion) return;
    const inner = $('.hero__inner', hero);
    ticks.add(() => {
      if (scrollY > vh * 1.3) return;
      const p = scrollY / vh;
      inner.style.transform = `translate3d(0, ${(scrollY * 0.35).toFixed(1)}px, 0)`;
      inner.style.opacity = String(clamp(1 - p * 1.15, 0, 1));
    });
  }

  /* ---- Showreel: grows to full-bleed on scroll ------------------------- */
  function initReel() {
    const reel = $('[data-reel]');
    if (!reel) return;
    const frameEl = $('.reel__frame', reel);
    if (reduceMotion) { frameEl.style.setProperty('--p', '1'); return; }
    ticks.add(() => {
      const r = reel.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const start = vh * 0.7;
      const range = start + (r.height - vh) * 0.65;
      const p = clamp((start - r.top) / range, 0, 1);
      frameEl.style.setProperty('--p', (p * p * (3 - 2 * p)).toFixed(4));
    });
  }

  /* ---- Modal (showreel lightbox) --------------------------------------- */
  function initModal() {
    let lastFocus = null;
    const open = (modal) => {
      if (!modal) return;
      lastFocus = document.activeElement;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      modal.inert = false;
      lockScroll(true);
      const vid = $('video', modal);
      if (vid) vid.play().catch(() => {});
      setTimeout(() => { const c = $('[data-modal-close]', modal); if (c) c.focus(); }, 50);
    };
    const close = (modal) => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      modal.inert = true;
      lockScroll(false);
      const vid = $('video', modal);
      if (vid) vid.pause();
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    };
    $$('.modal').forEach((m) => {
      m.inert = true;
      $$('[data-modal-close]', m).forEach((b) => b.addEventListener('click', () => close(m)));
      m.addEventListener('click', (e) => { if (e.target === m) close(m); });
    });
    $$('[data-modal-open]').forEach((b) => b.addEventListener('click', () => open($(b.dataset.modalOpen))));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const m = $('.modal.is-open');
      if (m) close(m);
    });
  }

  /* ---- Scroll-scrubbed word highlight ---------------------------------- */
  function initHighlight() {
    $$('[data-highlight]').forEach((el) => {
      const words = [];
      const walk = (node) => {
        Array.from(node.childNodes).forEach((child) => {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
              const s = document.createElement('span');
              s.className = 'hl-w';
              s.textContent = part;
              words.push(s);
              frag.appendChild(s);
            });
            child.replaceWith(frag);
          } else if (child.nodeType === 1) walk(child);
        });
      };
      walk(el);
      if (reduceMotion) { words.forEach((w) => w.classList.add('is-on')); return; }
      let last = -1;
      ticks.add(() => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const start = vh * 0.85;
        const end = vh * 0.3 - r.height * 0.5;
        const p = clamp((start - r.top) / (start - end), 0, 1);
        const n = Math.round(p * words.length);
        if (n === last) return;
        last = n;
        words.forEach((w, i) => w.classList.toggle('is-on', i < n));
      });
    });
  }

  /* ---- Marquee: speeds up with scroll, flips with scroll direction ----- */
  function initMarquee() {
    $$('[data-marquee]').forEach((m) => {
      const track = $('.marquee__track', m);
      const group = $('.marquee__group', track);
      if (!group) return;
      const base = parseFloat(m.dataset.marquee) || 1;
      const reverse = m.dataset.direction === 'right' ? -1 : 1;
      let gw = 1;
      let x = 0;
      let dir = 1;
      let visible = true;
      const fill = () => {
        $$('.marquee__group', track).slice(1).forEach((g) => g.remove());
        gw = group.offsetWidth || 1;
        const copies = Math.max(2, Math.ceil((vw * 2) / gw) + 1);
        for (let i = 1; i < copies; i++) {
          const c = group.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          track.appendChild(c);
        }
      };
      fill();
      fontsReady().then(fill);
      onResize.add(fill);
      if (reduceMotion) return;
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(m);
      ticks.add(() => {
        if (!visible) return;
        if (Math.abs(velocity) > 0.6) dir = velocity > 0 ? 1 : -1;
        const speed = (base + Math.min(Math.abs(velocity) * 0.3, 20)) * dir * reverse * dt;
        x -= speed;
        if (x <= -gw) x += gw;
        if (x > 0) x -= gw;
        track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
      });
    });
  }

  /* ---- Parallax media -------------------------------------------------- */
  function initParallax() {
    if (reduceMotion) return;
    const items = $$('[data-parallax]').map((el) => ({ el, speed: parseFloat(el.dataset.parallax) || 0.1 }));
    if (!items.length) return;
    ticks.add(() => {
      items.forEach(({ el, speed }) => {
        const inner = el.firstElementChild;
        if (!inner) return;
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const offset = (r.top + r.height / 2 - vh / 2) * -speed;
        const max = r.height * 0.09;
        inner.style.transform = `translate3d(0, ${clamp(offset, -max, max).toFixed(2)}px, 0)`;
      });
    });
  }

  /* ---- Work list: floating preview that follows the cursor ------------- */
  function initWorkHover() {
    const list = $('[data-work-list]');
    const pv = $('[data-hover-preview]');
    if (!list || !pv || !finePointer) return;
    const inner = $('.hover-preview__inner', pv);
    $$('.hover-preview__item', inner).forEach((it, i) => { it.style.top = `${i * 100}%`; });
    const pos = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let rot = 0;
    let on = false;
    list.addEventListener('pointermove', (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!on) { cur.x = pos.x; cur.y = pos.y; }
    });
    $$('.work-row', list).forEach((row, i) => {
      row.addEventListener('pointerenter', () => {
        on = true;
        pv.classList.add('is-active');
        inner.style.transform = `translate3d(0, ${-i * 100}%, 0)`;
      });
    });
    list.addEventListener('pointerleave', () => { on = false; pv.classList.remove('is-active'); });
    ticks.add(() => {
      const px = cur.x;
      cur.x = lerp(cur.x, pos.x, clamp(0.14 * dt, 0, 1));
      cur.y = lerp(cur.y, pos.y, clamp(0.14 * dt, 0, 1));
      rot = lerp(rot, clamp((cur.x - px) * 0.5, -14, 14), 0.12);
      pv.style.transform = `translate3d(${cur.x.toFixed(1)}px, ${cur.y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
    });
  }

  /* ---- Accordions ------------------------------------------------------ */
  function initAccordion() {
    $$('[data-accordion]').forEach((acc) => {
      const single = acc.dataset.accordion !== 'multi';
      const items = $$('.acc-item', acc);
      const setItem = (item, open) => {
        item.classList.toggle('is-open', open);
        $('.acc-item__btn', item).setAttribute('aria-expanded', String(open));
        $('.acc-item__panel', item).inert = !open;
        item.dispatchEvent(new CustomEvent('accordion:toggle', { bubbles: true, detail: { open } }));
      };
      items.forEach((item) => {
        setItem(item, item.classList.contains('is-open'));
        $('.acc-item__btn', item).addEventListener('click', () => {
          const open = !item.classList.contains('is-open');
          if (single) items.forEach((o) => { if (o !== item) setItem(o, false); });
          setItem(item, open);
        });
      });
    });
  }

  /* ---- Service animations (homepage accordion) ------------------------- */
  // Each scene is an inline SVG animated by CSS keyframes (gated by
  // .is-playing) plus a few SMIL elements (paths, morphs, playhead). A scene
  // plays only while its service is open and on screen, restarts from the top
  // whenever the service is reopened, and pauses when scrolled away.
  function initServiceAnims() {
    const LOOP = 10;
    const scenes = $$('[data-svc-anim]').map((el) => ({
      el,
      svg: $('svg', el),
      item: el.closest('.acc-item'),
      timecode: $('[data-timecode]', el),
      still: parseFloat(el.dataset.still) || 0,
      visible: false,
      started: false,
    }));
    if (!scenes.length) return;
    const smil = (s, fn, ...args) => { if (s.svg && typeof s.svg[fn] === 'function') s.svg[fn](...args); };
    const pad = (n) => String(n).padStart(2, '0');
    const writeTimecode = (s, t) => {
      if (!s.timecode) return;
      const sec = Math.floor(t);
      s.timecode.textContent = `00:00:${pad(sec)}:${pad(Math.floor((t - sec) * 24))}`;
    };

    scenes.forEach((s) => {
      smil(s, 'pauseAnimations');
      smil(s, 'setCurrentTime', reduceMotion ? s.still : 0);
      if (reduceMotion) writeTimecode(s, s.still);
    });
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    const isOpen = (s) => !s.item || s.item.classList.contains('is-open');
    const restart = (s) => {
      s.el.classList.remove('is-playing', 'is-paused');
      void s.el.offsetWidth; // flush styles so CSS animations start from 0
      s.el.classList.add('is-playing');
      smil(s, 'setCurrentTime', 0);
      smil(s, 'unpauseAnimations');
      s.started = true;
    };
    const update = (s) => {
      const play = s.visible && isOpen(s);
      if (play && !s.started) restart(s);
      else if (play) { s.el.classList.remove('is-paused'); smil(s, 'unpauseAnimations'); }
      else if (s.started) { s.el.classList.add('is-paused'); smil(s, 'pauseAnimations'); }
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const s = scenes.find((x) => x.el === en.target);
        s.visible = en.isIntersecting;
        update(s);
      });
    }, { threshold: 0.2 });
    scenes.forEach((s) => io.observe(s.el));

    document.addEventListener('accordion:toggle', (e) => {
      const s = scenes.find((x) => x.item === e.target);
      if (!s) return;
      if (e.detail.open) s.started = false;
      update(s);
    });

    ticks.add(() => {
      scenes.forEach((s) => {
        if (s.timecode && s.started && !s.el.classList.contains('is-paused') && s.svg.getCurrentTime) {
          writeTimecode(s, s.svg.getCurrentTime() % LOOP);
        }
      });
    });
  }

  /* ---- Counters -------------------------------------------------------- */
  function initCounters() {
    const els = $$('[data-counter]');
    if (!els.length || reduceMotion || !('IntersectionObserver' in window)) return;
    els.forEach((el) => { el.textContent = '0'; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target;
        const to = parseFloat(el.dataset.counter);
        const t0 = performance.now();
        const step = (now) => {
          const t = clamp((now - t0) / 2000, 0, 1);
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - t, 4))));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    els.forEach((el) => io.observe(el));
  }

  /* ---- Pinned horizontal scroll ---------------------------------------- */
  function initHScroll() {
    const sec = $('[data-hscroll]');
    if (!sec) return;
    const track = $('[data-hscroll-track]', sec);
    const bar = $('.process__progress', sec);
    const mobile = window.matchMedia('(max-width: 900px)');
    let dist = 0;
    const measure = () => {
      if (mobile.matches || reduceMotion) {
        sec.style.height = '';
        track.style.transform = '';
        dist = 0;
        return;
      }
      dist = Math.max(0, track.offsetWidth - vw);
      sec.style.height = `${vh + dist}px`;
    };
    measure();
    fontsReady().then(measure);
    onResize.add(measure);
    ticks.add(() => {
      if (!dist) return;
      const r = sec.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const p = clamp(-r.top / dist, 0, 1);
      track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px, 0, 0)`;
      if (bar) bar.style.setProperty('--p', p.toFixed(4));
    });
  }

  /* ---- Draggable slider ------------------------------------------------ */
  function initSlider() {
    $$('[data-slider]').forEach((sl) => {
      let down = false;
      let moved = false;
      let startX = 0;
      let startLeft = 0;
      sl.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        down = true;
        moved = false;
        startX = e.clientX;
        startLeft = sl.scrollLeft;
      });
      window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) { moved = true; sl.classList.add('is-dragging'); }
        if (moved) sl.scrollLeft = startLeft - dx;
      });
      window.addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        sl.classList.remove('is-dragging');
      });
      sl.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
      sl.addEventListener('dragstart', (e) => e.preventDefault());

      const bar = $(`[data-slider-progress="${sl.id}"]`);
      const update = () => {
        if (!bar) return;
        const max = sl.scrollWidth - sl.clientWidth;
        const visible = sl.clientWidth / sl.scrollWidth;
        const p = max > 0 ? sl.scrollLeft / max : 1;
        bar.style.setProperty('--p', (visible + (1 - visible) * p).toFixed(4));
      };
      sl.addEventListener('scroll', update, { passive: true });
      onResize.add(update);
      update();

      const stepSize = () => {
        const card = sl.querySelector('.slider__track > *');
        return card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(sl.firstElementChild).columnGap || 0) : sl.clientWidth * 0.8;
      };
      $$(`[data-slider-prev="${sl.id}"]`).forEach((b) => b.addEventListener('click', () => sl.scrollBy({ left: -stepSize(), behavior: 'smooth' })));
      $$(`[data-slider-next="${sl.id}"]`).forEach((b) => b.addEventListener('click', () => sl.scrollBy({ left: stepSize(), behavior: 'smooth' })));
    });
  }

  /* ---- Work page: filters & grid/list view ----------------------------- */
  function layoutCards(cards) {
    let n = 0;
    cards.forEach((c) => { if (!c.classList.contains('is-filtered')) c.dataset.pos = String(n++ % 4); });
    return n;
  }

  function initFilters() {
    const wrap = $('[data-filters]');
    const grid = $('[data-work-grid]');
    if (!wrap || !grid) return;
    const cards = $$('.card', grid);
    const empty = $('[data-empty]');
    const buttons = $$('button[data-filter]', wrap);
    const matches = (card, f) => f === 'all' || card.dataset.cats.split(' ').includes(f);

    buttons.forEach((b) => {
      const sup = $('sup', b);
      if (sup) sup.textContent = String(cards.filter((c) => matches(c, b.dataset.filter)).length).padStart(2, '0');
    });

    const apply = (f, animate) => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
      const run = () => {
        cards.forEach((c) => c.classList.toggle('is-filtered', !matches(c, f)));
        const shown = layoutCards(cards);
        if (empty) empty.classList.toggle('is-visible', shown === 0);
        grid.classList.remove('is-switching');
      };
      if (!animate || reduceMotion) { run(); return; }
      grid.classList.add('is-switching');
      setTimeout(run, 380);
    };

    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-filter]');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      apply(b.dataset.filter, true);
      const url = new URL(location.href);
      if (b.dataset.filter === 'all') url.searchParams.delete('filter');
      else url.searchParams.set('filter', b.dataset.filter);
      history.replaceState(null, '', url);
    });

    const initial = new URLSearchParams(location.search).get('filter');
    if (initial && buttons.some((b) => b.dataset.filter === initial)) apply(initial, false);
  }

  function initViewToggle() {
    const toggle = $('[data-view-toggle]');
    const grid = $('[data-work-grid]');
    if (!toggle || !grid) return;
    const buttons = $$('button[data-view]', toggle);
    const set = (v) => {
      grid.classList.toggle('is-list', v === 'list');
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
      try { localStorage.setItem('dw-view', v); } catch (e) { /* storage blocked */ }
    };
    buttons.forEach((b) => b.addEventListener('click', () => set(b.dataset.view)));
    let saved = null;
    try { saved = localStorage.getItem('dw-view'); } catch (e) { /* storage blocked */ }
    if (saved === 'list') set('list');
  }

  /* ---- Case study page: fills the template from projects.js ------------ */
  function initProject() {
    const root = $('[data-project]');
    const list = window.DW_PROJECTS;
    if (!root || !Array.isArray(list) || !list.length) return;
    const slug = new URLSearchParams(location.search).get('p');
    let idx = list.findIndex((p) => p.slug === slug);
    if (idx < 0) idx = 0;
    const p = list[idx];
    const next = list[(idx + 1) % list.length];

    document.title = `${p.title} — Case study — Designwave`;
    $$('[data-field]', root).forEach((el) => {
      const v = p[el.dataset.field];
      if (v != null) el.textContent = Array.isArray(v) ? v.join(', ') : v;
    });
    $$('[data-ph-variant]', root).forEach((el, i) => {
      el.className = el.className.replace(/\bph--\d\b/g, '').trim();
      el.classList.add(`ph--${i % 3 === 1 ? ((p.ph % 8) + 1) : p.ph}`);
      if (el.dataset.phPrefix !== undefined) el.dataset.ph = `${p.title} — ${el.dataset.phPrefix}`;
    });
    const results = $('[data-results]', root);
    if (results && p.results) {
      results.innerHTML = p.results.map(([num, label]) => `
        <div class="stat"><span class="stat__num">${num}</span><span class="stat__label">${label}</span></div>`).join('');
    }
    const nextLink = $('[data-next]', root);
    if (nextLink) {
      nextLink.href = `project.html?p=${encodeURIComponent(next.slug)}`;
      const t = $('[data-next-title]', nextLink);
      if (t) t.textContent = next.title;
    }
  }

  /* ---- Contact form (mailto fallback — see README to use a form service) */
  function initForm() {
    const form = $('[data-contact-form]');
    if (!form) return;
    const success = $('[data-form-success]');
    const fields = {
      name: form.elements.name,
      email: form.elements.email,
      message: form.elements.message,
    };
    const validate = () => {
      let firstBad = null;
      Object.entries(fields).forEach(([key, input]) => {
        const v = input.value.trim();
        const ok = key === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) : v.length > 1;
        input.closest('.field').classList.toggle('is-invalid', !ok);
        input.setAttribute('aria-invalid', String(!ok));
        if (!ok && !firstBad) firstBad = input;
      });
      return firstBad;
    };
    Object.values(fields).forEach((input) => input.addEventListener('input', () => {
      if (input.closest('.field').classList.contains('is-invalid')) validate();
    }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = validate();
      if (bad) { bad.focus(); return; }
      const data = new FormData(form);
      const services = data.getAll('services');
      const lines = [
        `Name: ${data.get('name')}`,
        `Email: ${data.get('email')}`,
        data.get('company') ? `Company: ${data.get('company')}` : null,
        `Services: ${services.length ? services.join(', ') : '—'}`,
        `Budget: ${data.get('budget') || '—'}`,
        '',
        String(data.get('message')),
      ].filter((l) => l !== null);
      const subject = `New project enquiry — ${data.get('name')}`;
      window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      if (success) success.classList.add('is-visible');
    });
  }

  /* ---- Small utilities ------------------------------------------------- */
  let toastEl = null;
  let toastTimer = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2200);
  }

  function initCopy() {
    $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
        toast('Email copied to clipboard');
      } catch (e) {
        toast(text);
      }
    }));
  }

  function initEmail() {
    $$('[data-email]').forEach((el) => {
      if (el.tagName === 'A') el.href = `mailto:${SITE.email}`;
      if (el.hasAttribute('data-copy')) el.dataset.copy = SITE.email;
      const label = el.querySelector('[data-email-label]') || (el.children.length ? null : el);
      if (label) label.textContent = SITE.email;
    });
  }

  function initClock() {
    const els = $$('[data-clock]');
    if (!els.length) return;
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: SITE.timeZone || undefined, timeZoneName: 'short' });
    } catch (e) {
      fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    }
    const tick = () => { const s = fmt.format(new Date()); els.forEach((el) => { el.textContent = s; }); };
    tick();
    setInterval(tick, 10000);
  }

  function initAnchors() {
    $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
    $$('[data-to-top]').forEach((b) => b.addEventListener('click', () => scrollToY(0)));
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').length < 2) return;
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      scrollToY(target.getBoundingClientRect().top + window.scrollY);
      if (target.id === 'main') target.focus({ preventScroll: true });
    });
  }

  function initFooterReveal() {
    const f = $('.footer');
    if (!f) return;
    const check = () => f.classList.toggle('is-reveal', !reduceMotion && vw > 900 && f.offsetHeight < vh * 0.98);
    check();
    fontsReady().then(check);
    onResize.add(check);
  }

  /* ---- Boot ------------------------------------------------------------ */
  async function boot() {
    store.set('dw-loaded', '1');
    safe(initProject);        // must run before text is split
    safe(initEmail);
    $$('[data-split]').forEach((el) => safe(() => split(el)));
    [
      initHighlight, initMarquee, initHeader, initMenu, initCursor, initMagnetic,
      initTransitions, initWaves, initHero, initReel, initModal, initParallax,
      initWorkHover, initAccordion, initServiceAnims, initCounters, initHScroll, initSlider,
      initFilters, initViewToggle, initForm, initCopy, initClock, initAnchors,
      initFooterReveal,
    ].forEach(safe);
    requestAnimationFrame(frame);

    try {
      await runPreloader();
      await runEnter();
    } catch (err) {
      console.error('[designwave]', err);
      html.classList.remove('is-preloading', 'is-entering');
    }
    html.classList.add('is-ready');
    safe(initReveal);
  }

  boot();
})();
