/* Motion is event-driven. Media loads only on intent; one decoder at a time. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const connection = navigator.connection;
  let savedMotion;
  try { savedMotion = localStorage.getItem('ethos-motion-experience'); } catch {}
  let motionEnabled = savedMotion !== 'off' && !reduced.matches && !connection?.saveData;
  const motionButton = $('.motion-toggle');
  const sculpture = $('.sculpture');
  const sculptureWrap = $('.sculpture-wrap');
  const cinema = $('.cinema');
  let heroVisible = true;
  let tiltFrame = 0;
  let preview = null;
  let previewOwner = null;
  let previewTimer = 0;
  let previewIntent = null;
  let refreshPointer = () => {};
  let releaseDepth = () => {};

  function stopPreview() {
    clearTimeout(previewTimer);
    previewIntent = null;
    if (preview) { preview.pause(); preview.removeAttribute('src'); preview.load(); preview.remove(); }
    preview = null; previewOwner = null;
  }
  function updateMotion() {
    document.documentElement.classList.toggle('motion-off', !motionEnabled);
    motionButton.setAttribute('aria-pressed', String(motionEnabled));
    motionButton.disabled = reduced.matches;
    motionButton.setAttribute('aria-label', reduced.matches ? 'Motion paused by your device accessibility settings' : motionEnabled ? 'Pause decorative motion' : 'Enable decorative motion');
    $('.motion-label').textContent = motionEnabled ? 'Motion on' : 'Motion off';
    if (!motionEnabled) { stopPreview(); resetTilt(); }
    refreshPointer();
    if (!motionEnabled) releaseDepth();
    sculptureWrap.classList.toggle('is-visible', heroVisible && motionEnabled && !document.hidden && !cinema.open);
  }
  function resetTilt() {
    if (!tiltFrame && !sculpture.style.transform && !sculpture.classList.contains('is-tracking')) return;
    cancelAnimationFrame(tiltFrame); tiltFrame = 0;
    sculpture.classList.remove('is-tracking');
    sculpture.style.removeProperty('transform');
  }
  motionButton.addEventListener('click', () => {
    motionEnabled = !motionEnabled && !reduced.matches;
    savedMotion = motionEnabled ? 'on' : 'off';
    try { localStorage.setItem('ethos-motion-experience', savedMotion); } catch {}
    updateMotion();
  });
  reduced.addEventListener('change', () => { motionEnabled = savedMotion !== 'off' && !reduced.matches && !connection?.saveData; updateMotion(); });
  updateMotion();

  // Native scroll, small transform writes, no scroll interception.
  let scrollFrame = 0;
  let scrollRange = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const progress = $('.progress');
  function updateProgress() {
    progress.style.transform = `scaleX(${scrollRange > 0 ? Math.min(1, scrollY / scrollRange) : 0})`;
    scrollFrame = 0;
  }
  addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress); }, {passive:true});
  addEventListener('resize', () => {
    scrollRange = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    updateProgress(); resetTilt();
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => {
    scrollRange = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    updateProgress();
  }).observe(document.body);
  updateProgress();

  const menuButton = $('.menu-toggle');
  const nav = $('.nav');
  function closeMenu(returnFocus = false) {
    nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    if (returnFocus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    nav.classList.toggle('open', open); menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  $$('.nav a').forEach(link => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(nav.classList.contains('open')); });
  document.addEventListener('click', event => { if (!event.target.closest('.header')) closeMenu(); });
  matchMedia('(min-width:1101px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('js-ready');
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
    }), {threshold:.07});
    $$('.reveal').forEach(el => revealObserver.observe(el));
    new IntersectionObserver(entries => {
      heroVisible = entries[0].isIntersecting; updateMotion();
      if (!heroVisible) resetTilt();
    }, {threshold:.05}).observe(sculptureWrap);
    const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      $$('.nav a').forEach(link => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }), {rootMargin:'-15% 0px -65% 0px'});
    $$('main>section[id]').forEach(section => sectionObserver.observe(section));
  }

  let tiltRect = null;
  let heroPointerX = 0, heroPointerY = 0;
  sculptureWrap.addEventListener('pointerenter', () => {
    if (!motionEnabled || !finePointer.matches || cinema.open) return;
    tiltRect = sculptureWrap.getBoundingClientRect();
    sculpture.classList.add('is-tracking');
  });
  sculptureWrap.addEventListener('pointermove', event => {
    if (!motionEnabled || !heroVisible || !finePointer.matches || cinema.open) return;
    heroPointerX = event.clientX; heroPointerY = event.clientY;
    if (tiltFrame) return;
    tiltFrame = requestAnimationFrame(() => {
      const rect = tiltRect || (tiltRect = sculptureWrap.getBoundingClientRect());
      const dx = Math.max(-.5, Math.min(.5, (heroPointerX-rect.left)/rect.width-.5));
      const dy = Math.max(-.5, Math.min(.5, (heroPointerY-rect.top)/rect.height-.5));
      if (!sculpture.classList.contains('is-tracking')) sculpture.classList.add('is-tracking');
      sculpture.style.transform = `rotateX(${(-5-dy*12).toFixed(2)}deg) rotateY(${(-12+dx*16).toFixed(2)}deg)`;
      tiltFrame = 0;
    });
  }, {passive:true});
  sculptureWrap.addEventListener('pointerleave', () => { tiltRect = null; resetTilt(); });

  // The same optical reticle is a native SVG cursor: no DOM follower or RAF loop.
  const contrast = matchMedia('(forced-colors: active)');
  const cursorViewport = matchMedia('(min-width:651px)');
  let cursorActive = false;
  function hideCursor() {
    if (!cursorActive) return;
    cursorActive = false;
    document.documentElement.classList.remove('cursor-native');
  }
  function pointerAllowed() {
    return motionEnabled && finePointer.matches && cursorViewport.matches && !contrast.matches && !document.hidden && !cinema.open;
  }
  refreshPointer = () => { if (!pointerAllowed()) hideCursor(); };
  document.addEventListener('pointermove', event => {
    if (cursorActive || event.pointerType !== 'mouse' || !pointerAllowed()) return;
    cursorActive = true;
    document.documentElement.classList.add('cursor-native');
  }, {passive:true});
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) hideCursor(); }, {passive:true});
  document.addEventListener('keydown', event => { if (event.key === 'Tab') hideCursor(); });
  addEventListener('blur', hideCursor);
  finePointer.addEventListener('change', () => { hideCursor(); resetTilt(); releaseDepth(); });
  contrast.addEventListener('change', hideCursor);
  cursorViewport.addEventListener('change', hideCursor);

  // Card perspective and light follow only the currently hovered surface.
  let activeDepth = null;
  $$('.film,.service-art').forEach(panel => {
    const state = {panel,rect:null,frame:0,x:0,y:0};
    function reset() {
      cancelAnimationFrame(state.frame); state.frame = 0; state.rect = null;
      panel.classList.remove('is-tracking');
      panel.style.removeProperty('transform');
      if (activeDepth === state) activeDepth = null;
    }
    state.reset = reset;
    panel.addEventListener('pointerenter', () => {
      if (!motionEnabled || !finePointer.matches || cinema.open) return;
      if (activeDepth && activeDepth !== state) activeDepth.reset();
      activeDepth = state; state.rect = panel.getBoundingClientRect(); panel.classList.add('is-tracking');
    });
    panel.addEventListener('pointermove', event => {
      if (!motionEnabled || !finePointer.matches || document.hidden || cinema.open) return;
      state.x = event.clientX; state.y = event.clientY;
      if (state.frame) return;
      state.frame = requestAnimationFrame(() => {
        state.frame = 0;
        const r = state.rect || (state.rect = panel.getBoundingClientRect());
        const dx = Math.max(-.5, Math.min(.5, (state.x-r.left)/r.width-.5));
        const dy = Math.max(-.5, Math.min(.5, (state.y-r.top)/r.height-.5));
        activeDepth = state;
        if (!panel.classList.contains('is-tracking')) panel.classList.add('is-tracking');
        panel.style.transform = `perspective(1200px) rotateX(${(-dy*8).toFixed(2)}deg) rotateY(${(dx*8).toFixed(2)}deg) translateY(-4px)`;
        panel.style.setProperty('--gx', `${((dx+.5)*100).toFixed(1)}%`); panel.style.setProperty('--gy', `${((dy+.5)*100).toFixed(1)}%`);
      });
    }, {passive:true});
    panel.addEventListener('pointerleave', reset);
    panel.addEventListener('focusout', event => { if (!panel.contains(event.relatedTarget)) reset(); });
  });
  releaseDepth = () => { if (activeDepth) activeDepth.reset(); };
  addEventListener('scroll', () => { tiltRect = null; resetTilt(); releaseDepth(); }, {passive:true});
  addEventListener('resize', () => { tiltRect = null; releaseDepth(); hideCursor(); });

  const films = $$('.film');
  const filters = $$('.filter');
  filters.forEach(button => button.addEventListener('click', () => {
    stopPreview();
    releaseDepth();
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    const category = button.dataset.filter;
    $('.work-grid').dataset.view = category;
    let count = 0;
    films.forEach(film => { film.hidden = category !== 'all' && film.dataset.category !== category; if (!film.hidden) count++; });
    $('.filter-status').textContent = `${count} production${count === 1 ? '' : 's'} shown`;
    scrollRange = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    updateProgress();
  }));
  filters.forEach(button => {
    const count = films.filter(film => button.dataset.filter === 'all' || film.dataset.category === button.dataset.filter).length;
    $('.filter-count', button).textContent = String(count).padStart(2, '0');
  });

  function startPreview(film) {
    if (!motionEnabled || !finePointer.matches || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '') || cinema.open || document.hidden) return;
    stopPreview(); previewIntent = film;
    previewTimer = setTimeout(() => {
      if (previewIntent !== film || film.hidden || document.hidden || !motionEnabled) return;
      const video = document.createElement('video');
      video.className = 'film-preview'; video.muted = true; video.loop = true; video.playsInline = true;
      video.preload = 'none'; video.setAttribute('aria-hidden','true');
      video.src = film.dataset.src; $('.film-media', film).append(video);
      preview = video; previewOwner = film;
      video.addEventListener('playing', () => video.classList.add('playing'), {once:true});
      video.play().catch(() => { if (preview === video) stopPreview(); });
    }, 400);
  }
  films.forEach(film => {
    film.addEventListener('pointerenter', () => startPreview(film));
    film.addEventListener('pointerleave', () => { if (previewOwner === film || previewIntent === film) stopPreview(); });
    $('.film-button', film).addEventListener('click', event => openCinema(film, event.currentTarget));
  });
  if ('IntersectionObserver' in window) {
    const previewObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting && (entry.target === previewOwner || entry.target === previewIntent)) stopPreview();
    }), {threshold:.15});
    films.forEach(film => previewObserver.observe(film));
  }

  const player = $('.cinema video');
  const playerMessage = $('.cinema-message');
  let cinemaTrigger = null;
  function openCinema(film, trigger) {
    hideCursor(); resetTilt(); releaseDepth();
    stopPreview(); cinemaTrigger = trigger || $('.film-button', film);
    $('.cinema-title').textContent = $('h3', film).textContent;
    $('.cinema-client').textContent = $('.film-client', film).textContent;
    $('.cinema-type').textContent = $('.film-type', film).textContent;
    $('.cinema-description').textContent = $('.film-summary', film).textContent;
    player.poster = $('img', film).src; player.src = film.dataset.src;
    playerMessage.textContent = ''; playerMessage.classList.remove('visible');
    cinema.showModal(); document.body.classList.add('locked');
    updateMotion();
    $('.cinema-close').focus();
    player.play().catch(() => { playerMessage.textContent = 'Press play to start the film.'; playerMessage.classList.add('visible'); });
  }
  $$('.hero-showreel,.hero-float,.studio-reel-open').forEach(button => button.addEventListener('click', event => openCinema($('#studio-reel-source') || $('.film[data-featured]'), event.currentTarget)));
  $('.cinema-close').addEventListener('click', () => cinema.close());
  cinema.addEventListener('click', event => {
    const rect = cinema.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cinema.close();
  });
  cinema.addEventListener('close', () => {
    player.pause(); player.removeAttribute('src'); player.load();
    document.body.classList.remove('locked'); cinemaTrigger?.focus({preventScroll:true});
    updateMotion();
  });
  player.addEventListener('error', () => {
    if (!player.getAttribute('src')) return;
    playerMessage.textContent = 'This preview could not be played. Visit our YouTube archive to explore the studio films.';
    playerMessage.classList.add('visible');
  });
  player.addEventListener('playing', () => playerMessage.classList.remove('visible'));
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('page-hidden', document.hidden);
    if (document.hidden) { stopPreview(); player.pause(); resetTilt(); hideCursor(); releaseDepth(); }
    updateMotion();
  });
  addEventListener('pagehide', () => { stopPreview(); player.pause(); hideCursor(); releaseDepth(); });
  // Native details remain usable without JS. Keep the index concise when enhanced.
  $$('.service-item').forEach(item => item.addEventListener('toggle', () => {
    if (item.open) $$('.service-item').forEach(other => { if (other !== item) other.open = false; });
  }));
})();
