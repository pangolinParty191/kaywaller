// Shared behaviour: card rails, expanding galleries, video autoplay, reveal-on-scroll.
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 760px)');

  /* ---------- Project cards, built from js/projects.js ---------- */
  // [data-project-cards] gets every project. With data-limit ("Other work") it shows the next projects after the
  // page you're on, in landing-page order, wrapping round to the start.
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-project-cards]').forEach((list) => {
    const all = window.PROJECTS || [];
    const lazy = list.dataset.limit ? ' loading="lazy"' : '';
    let picks = all;
    if (list.dataset.limit) {
      const at = all.findIndex((p) => p.href === here);
      picks = Array.from({ length: Math.min(Number(list.dataset.limit), all.length - 1) }, (_, k) => all[(at + 1 + k) % all.length]);
    }
    picks.forEach((p) => {
      const card = document.createElement('a');
      card.className = 'card';
      card.href = p.href;
      card.innerHTML = `
        <div class="card-media">
          <img src="${p.cover}" alt="" width="1280" height="1792"${lazy}>
          <span class="card-hover"><svg viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="28" cy="28" r="26"/><path d="M17 28h21M30 19l9 9-9 9" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="card-hover-label"></span></span>
        </div>
        <p class="card-sub"></p>
        <p class="card-note"></p>`;
      card.querySelector('img').alt = p.alt;
      card.querySelector('.card-hover-label').textContent = p.hover;
      card.querySelector('.card-sub').textContent = p.title;
      card.querySelector('.card-note').textContent = p.note;
      list.append(card);
    });
  });

  /* ---------- Horizontal card rails ---------- */
  document.querySelectorAll('.rail-wrap').forEach((wrap) => {
    const rail = wrap.querySelector('.rail');
    const prev = wrap.querySelector('.rail-nav.prev');
    const next = wrap.querySelector('.rail-nav.next');
    const fadeL = wrap.querySelector('.rail-fade.left');
    const fadeR = wrap.querySelector('.rail-fade.right');
    if (!rail) return;

    const step = () => {
      const card = rail.firstElementChild;
      const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
      return card ? card.getBoundingClientRect().width + gap : rail.clientWidth * 0.8;
    };
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth - 2;
      const atStart = rail.scrollLeft <= 2;
      const atEnd = rail.scrollLeft >= max;
      const overflow = max > 2;
      if (prev) prev.disabled = atStart || !overflow;
      if (next) next.disabled = atEnd || !overflow;
      if (fadeL) fadeL.hidden = atStart || !overflow;
      if (fadeR) fadeR.hidden = atEnd || !overflow;
      const media = rail.querySelector('.card-media, .shot-media');
      if (media) wrap.style.setProperty('--card-h', media.getBoundingClientRect().height + 'px');
    };
    // Eased scrolling shared by the wheel and the arrow buttons: each input moves the target,
    // and the rail glides toward it, so repeated wheel ticks blend into one continuous motion.
    let target = null, pos = 0, raf = 0, last = 0;
    const glide = (now) => {
      const k = 1 - Math.pow(1 - 0.12, Math.min(now - last, 64) / 16.7);
      last = now;
      pos += (target - pos) * k;
      if (Math.abs(target - pos) < 0.5) { rail.scrollLeft = target; target = null; raf = 0; return; }
      rail.scrollLeft = pos;
      raf = requestAnimationFrame(glide);
    };
    const glideTo = (x) => {
      const dest = Math.max(0, Math.min(x, rail.scrollWidth - rail.clientWidth));
      if (reduceMotion) { rail.scrollLeft = dest; return; }
      if (!raf) { pos = rail.scrollLeft; last = performance.now(); raf = requestAnimationFrame(glide); }
      target = dest;
    };
    const page = (dir) => {
      const s = step();
      glideTo((Math.round((target ?? rail.scrollLeft) / s) + dir) * s);
    };
    prev?.addEventListener('click', () => page(-1));
    next?.addEventListener('click', () => page(1));
    rail.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    rail.querySelectorAll('img').forEach((img) => img.complete || img.addEventListener('load', update, { once: true }));

    // On the landing page (which never scrolls vertically) let a vertical mouse wheel scroll the rail sideways,
    // handing control back at either end. Rails inside scrolling pages leave the wheel to the page.
    if (wrap.closest('.landing')) rail.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) return;
      const max = rail.scrollWidth - rail.clientWidth;
      const from = target ?? rail.scrollLeft;
      const goingRight = e.deltaY > 0;
      if ((goingRight && from >= max - 1) || (!goingRight && from <= 1)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? rail.clientWidth : 1;
      glideTo(from + e.deltaY * unit);
    }, { passive: false });

    update();
  });

  /* ---------- Landing load-in: block hover until the last card has been dealt ---------- */
  const dealRail = document.querySelector('.landing .rail');
  if (dealRail && !reduceMotion) {
    dealRail.classList.add('dealing');
    const done = () => dealRail.classList.remove('dealing');
    dealRail.lastElementChild?.addEventListener('animationend', (e) => { if (e.animationName === 'deal') done(); });
    setTimeout(done, 800); // fallback in case animationend never fires
  }

  /* ---------- "Jump to final designs": centre the final video (and its caption) on screen ---------- */
  // The target is revealed first so its fade-in offset doesn't skew the measurement, and the position is
  // re-checked as the scroll settles, since media above it can finish loading and shift the page mid-scroll.
  document.querySelectorAll('a.jump[href^="#"]').forEach((link) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    const spot = () => {
      const r = target.getBoundingClientRect();
      return Math.round(scrollY + r.top - Math.max(24, (innerHeight - r.height) / 2));
    };
    link.addEventListener('click', (e) => {
      e.preventDefault();
      target.classList.add('in');
      const behavior = reduceMotion ? 'auto' : 'smooth';
      scrollTo({ top: spot(), behavior });
      [500, 1000, 1600].forEach((ms) => setTimeout(() => {
        if (Math.abs(spot() - scrollY) > 4) scrollTo({ top: spot(), behavior });
      }, ms));
    });
  });

  /* ---------- "Back to top": bottom-left pill that appears once you've scrolled away from the top ---------- */
  if (!document.body.classList.contains('home')) {
    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'to-top';
    top.setAttribute('aria-label', 'Back to top');
    top.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    top.addEventListener('click', () => {
      scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      // hand focus to the first header link (not the skip link, which would pop into view)
      document.querySelector('.topnav a, .site-header a')?.focus({ preventScroll: true });
    });
    document.body.append(top);
    const toggle = () => top.classList.toggle('show', scrollY > innerHeight * 0.6);
    addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  /* ---------- Contact: copy the email address instead of opening a mail app ---------- */
  document.querySelectorAll('a[href^="mailto:"].pill').forEach((link) => {
    const email = link.getAttribute('href').slice(7);
    let toast, hideTimer;
    const notify = (msg) => {
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.append(toast);
      }
      toast.textContent = msg;
      requestAnimationFrame(() => toast.classList.add('show'));
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    };
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(email);
      } catch {
        const field = Object.assign(document.createElement('textarea'), { value: email });
        field.style.cssText = 'position:fixed;opacity:0';
        document.body.append(field);
        field.select();
        const ok = document.execCommand('copy');
        field.remove();
        if (!ok) throw new Error('copy failed');
      }
    };
    link.addEventListener('click', (e) => {
      e.preventDefault();
      copy().then(() => notify(`Email copied: ${email}`), () => { location.href = link.href; });
    });
  });

  /* ---------- Expanding galleries ---------- */
  document.querySelectorAll('.expand').forEach((gallery) => {
    const track = gallery.querySelector('.expand-track');
    const panels = [...gallery.querySelectorAll('.panel')];
    const out = gallery.querySelector('.expand-caption');
    const n = panels.length;
    const GAP = 10;
    const minClosed = n > 6 ? 44 : 72; // narrowest a closed panel may get
    let height = 460;

    const ratioOf = (p) => {
      const m = p.querySelector('img, video');
      const w = m.naturalWidth || m.videoWidth, h = m.naturalHeight || m.videoHeight;
      return w && h ? w / h : 16 / 10;
    };

    // Give the open panel exactly the width its image needs at the strip's height, so nothing is cropped.
    const fitOpen = (panel) => {
      if (mobile.matches) return;
      const free = track.clientWidth - GAP * (n - 1);
      const maxOpen = free - minClosed * (n - 1);
      const openW = Math.min(maxOpen, height * ratioOf(panel));
      const grow = n === 1 ? 1 : (openW * (n - 1)) / Math.max(free - openW, 1);
      gallery.style.setProperty('--active-grow', Math.max(grow, 1.2).toFixed(3));
    };

    const activate = (panel) => {
      fitOpen(panel);
      panels.forEach((p) => {
        const on = p === panel;
        p.classList.toggle('is-active', on);
        p.setAttribute('aria-expanded', on);
        const v = p.querySelector('video');
        if (v && !mobile.matches) v.controls = on;
      });
      if (out) {
        const i = panels.indexOf(panel) + 1;
        const text = panel.querySelector('figcaption')?.textContent.trim() ?? '';
        out.innerHTML = `<b>${String(i).padStart(2, '0')} / ${String(n).padStart(2, '0')}</b><span></span>`;
        out.querySelector('span').textContent = text;
      }
    };

    // Pick one strip height that lets the widest image still open fully.
    const size = () => {
      if (mobile.matches) { track.style.removeProperty('--h'); return; }
      const free = track.clientWidth - GAP * (n - 1);
      const maxOpen = free - minClosed * (n - 1);
      const widest = Math.max(...panels.map(ratioOf));
      height = Math.round(Math.max(300, Math.min(innerHeight * 0.78, 680, maxOpen / widest)));
      track.style.setProperty('--h', height + 'px');
      fitOpen(gallery.querySelector('.panel.is-active') || panels[0]);
    };

    panels.forEach((p, i) => {
      p.tabIndex = 0;
      p.setAttribute('role', 'button');
      p.setAttribute('aria-label', `Show image ${i + 1} of ${n}: ${p.querySelector('figcaption')?.textContent.trim() ?? ''}`);
      p.addEventListener('mouseenter', () => !mobile.matches && activate(p));
      p.addEventListener('focus', () => activate(p));
      p.addEventListener('click', () => activate(p));
      p.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          panels[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n].focus();
        }
      });
      const m = p.querySelector('img, video');
      m.addEventListener(m.tagName === 'IMG' ? 'load' : 'loadedmetadata', size, { once: true });
    });
    activate(panels[0]);
    size();
    addEventListener('resize', size);
    mobile.addEventListener('change', () => { size(); activate(gallery.querySelector('.panel.is-active') || panels[0]); });
  });

  /* ---------- Videos: muted loops, one at a time ---------- */
  // Only the video taking up the most of the screen plays; the rest pause. Visible area is tracked
  // per video, and that includes clipping by carousels, so scrolling a rail sideways hands playback over too.
  const videos = [...document.querySelectorAll('video[data-autoplay]')];
  videos.forEach((v) => { v.muted = true; v.loop = true; v.playsInline = true; });
  const autoPause = (v) => { if (!v.paused) { v.dataset.autoPaused = '1'; v.pause(); } };
  if ('IntersectionObserver' in window) {
    const visibleArea = new Map();
    const pick = () => {
      let best = null, bestArea = 0;
      visibleArea.forEach((area, v) => { if (area > bestArea) { best = v; bestArea = area; } });
      videos.forEach((v) => { if (v !== best) autoPause(v); });
      if (!best) return;
      if (best.preload !== 'auto') best.preload = 'auto';
      if (!reduceMotion && !best.dataset.userPaused && best.paused) best.play().catch(() => {});
    };
    const steps = Array.from({ length: 21 }, (_, i) => i / 20);
    const vio = new IntersectionObserver((entries) => {
      entries.forEach(({ target: v, isIntersecting, intersectionRect: r }) => {
        if (isIntersecting && r.width * r.height > 0) {
          visibleArea.set(v, r.width * r.height);
          if (v.preload === 'none') v.preload = 'metadata'; // show a first frame while it waits its turn
        } else visibleArea.delete(v);
      });
      pick();
    }, { threshold: steps });
    videos.forEach((v) => {
      vio.observe(v);
      // Remember when someone pauses on purpose so scrolling doesn't restart it.
      v.addEventListener('pause', () => { if (!v.dataset.autoPaused) v.dataset.userPaused = '1'; delete v.dataset.autoPaused; });
      // Starting one by hand stops whichever other video was playing.
      v.addEventListener('play', () => { delete v.dataset.userPaused; videos.forEach((o) => { if (o !== v) autoPause(o); }); });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('in'));
  } else {
    const rio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => rio.observe(el));
  }
})();
