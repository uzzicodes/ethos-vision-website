/* Ethos Vision / smooth scroll. Mouse-wheel steps become one continuous glide.
   Only for a mouse wheel on desktop. Trackpads, touch, keyboard, scrollbar drags and in-page links keep native scrolling,
   and the glide hands control back the moment anything else moves the page. Off with Motion off or reduced motion. */
(() => {
  const root = document.documentElement;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cinema = document.querySelector('.cinema');
  let target = scrollY, current = scrollY, frame = 0, last = 0, expected = -1;
  const enabled = () => fine.matches && !reduced.matches && !root.classList.contains('motion-off');
  const max = () => document.documentElement.scrollHeight - innerHeight;

  function nestedScroller(node, dy) {
    for (let n = node; n && n !== document.body && n !== root; n = n.parentElement) {
      if (n.scrollHeight <= n.clientHeight + 1) continue;
      const y = getComputedStyle(n).overflowY;
      if (y !== 'auto' && y !== 'scroll') continue;
      if ((dy < 0 && n.scrollTop > 0) || (dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return true;
    }
    return false;
  }

  addEventListener('wheel', e => {
    if (!enabled() || e.ctrlKey || e.shiftKey || e.defaultPrevented || cinema?.open) return;
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 40; else if (e.deltaMode === 2) dy *= innerHeight;
    // Small pixel deltas come from trackpads, which already glide. Leave them alone unless a glide is running.
    if (!frame && e.deltaMode === 0 && Math.abs(dy) < 50) return;
    if (nestedScroller(e.target, dy)) return;
    e.preventDefault();
    if (!frame) { target = current = scrollY; }
    target = Math.max(0, Math.min(max(), target + dy));
    if (!frame) { last = 0; frame = requestAnimationFrame(step); }
  }, { passive: false });

  function step(now) {
    const dt = last ? Math.min((now - last) / 1000, .05) : 1 / 60; last = now;
    const k = 1 - Math.exp(-dt * 9.5);
    current += (target - current) * k;
    if (Math.abs(target - current) < .4) current = target;
    expected = Math.round(current);
    window.scrollTo({ top: current, behavior: 'instant' });
    frame = current === target ? 0 : requestAnimationFrame(step);
  }

  // Anything else that moves the page (keys, links, scrollbar, find-in-page) wins immediately.
  addEventListener('scroll', () => {
    if (!frame) { target = current = scrollY; return; }
    if (Math.abs(scrollY - expected) > 2) { cancelAnimationFrame(frame); frame = 0; target = current = scrollY; }
  }, { passive: true });
  addEventListener('keydown', () => { if (frame) { cancelAnimationFrame(frame); frame = 0; target = current = scrollY; } });
  addEventListener('resize', () => { target = Math.min(target, max()); });
})();
