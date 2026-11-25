/* Ethos Vision / atmosphere. The page is one shoot, from prep to wrap.
   A fixed light layer sits behind the content. Each scene owns a lighting setup (painted once as CSS gradients);
   scrolling only cross-fades opacity, and the haze drifts with a transform. Everything runs on the compositor:
   no canvas, no per-frame painting, nothing that can fight with video playback. */
(() => {
  const root = document.documentElement;
  const scenes = [
    { sel: '#home', name: 'Prep' },
    { sel: '.reel-section', name: 'Rolling', beam: 1 },
    { sel: '#work', name: 'Dailies' },
    { sel: '#partners', name: 'Collaborators', beam: .35 },
    { sel: '#services', name: 'Craft' },
    { sel: '#about', name: 'The studio' },
    { sel: '#contact', name: 'Wrap' }
  ].map((s, i) => ({ ...s, i, el: document.querySelector(s.sel) })).filter(s => s.el);
  if (!scenes.length) return;

  const layer = document.createElement('div');
  layer.className = 'atmos'; layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = scenes.map(s => `<div class="atmos__light" data-scene="${s.i}"></div>`).join('') +
    '<div class="atmos__beam"></div><div class="atmos__haze atmos__haze--a"></div><div class="atmos__haze atmos__haze--b"></div>';
  document.body.prepend(layer);
  const lights = [...layer.querySelectorAll('.atmos__light')];
  const beam = layer.querySelector('.atmos__beam');

  const marker = document.createElement('div');
  marker.className = 'scene-marker'; marker.setAttribute('aria-hidden', 'true');
  marker.innerHTML = '<span class="scene-marker__scene"></span><span class="scene-marker__name"></span><span class="scene-marker__tc">00:00:00:00</span>';
  document.body.append(marker);
  const mScene = marker.querySelector('.scene-marker__scene'), mName = marker.querySelector('.scene-marker__name'), mTc = marker.querySelector('.scene-marker__tc');

  let tops = [], active = -1, queued = false;
  const layout = () => { tops = scenes.map(s => s.el.getBoundingClientRect().top + scrollY); };
  function update() {
    queued = false;
    const c = scrollY + innerHeight * .55;
    let i = 0; while (i < tops.length - 1 && c >= tops[i + 1]) i++;
    const next = Math.min(i + 1, scenes.length - 1);
    const edge = i + 1 < tops.length ? tops[i + 1] : Infinity;
    const f = Math.max(0, Math.min(1, 1 - (edge - c) / (innerHeight * .6)));
    const e = f * f * (3 - 2 * f);
    lights.forEach((l, j) => {
      const o = j === i ? (next === i ? 1 : 1 - e) : j === next ? e : 0;
      l.style.opacity = o.toFixed(3);
      l.classList.toggle('is-live', o > 0);
    });
    beam.style.opacity = ((scenes[i].beam || 0) * (1 - e) + (next !== i ? (scenes[next].beam || 0) * e : 0)).toFixed(3);
    const show = e > .5 ? next : i;
    if (show !== active) {
      active = show;
      mScene.textContent = `Sc. ${show + 1}`; mName.textContent = scenes[show].name;
      marker.dataset.scene = String(show);
      marker.classList.remove('is-in'); void marker.offsetWidth; marker.classList.add('is-in');
    }
  }
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => { layout(); request(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { layout(); request(); }).observe(document.body);

  // Timecode at 24 fps, like the camera. Updated on a timer, only while visible on desktop with motion on.
  const started = performance.now(); let timer = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), wide = matchMedia('(min-width: 1024px)');
  function tick() {
    const total = Math.floor((performance.now() - started) / (1000 / 24)), s = Math.floor(total / 24);
    mTc.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60, total % 24].map(v => String(v).padStart(2, '0')).join(':');
  }
  function clock() {
    const run = !document.hidden && wide.matches && !reduced.matches && !root.classList.contains('motion-off');
    if (run && !timer) timer = setInterval(tick, 1000 / 24);
    if (!run && timer) { clearInterval(timer); timer = 0; tick(); }
  }
  document.addEventListener('visibilitychange', clock);
  wide.addEventListener('change', clock); reduced.addEventListener('change', clock);
  new MutationObserver(clock).observe(root, { attributes: true, attributeFilter: ['class'] });

  layout(); update(); clock();
  root.classList.add('atmosphere-ready');
})();
