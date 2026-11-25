/**
 * Ethos Vision — Modern Studio Animation & Interactive Controller v3
 * Extreme 3D Depth, Zero-Lag In-Card Video Engine, Butter-Smooth 60/120 FPS.
 */

(function () {
  'use strict';

  // =========================================================
  // 1. AMBIENT FLOATING CINEMATIC PARTICLES (GPU OPTIMIZED)
  // =========================================================
  const canvas = document.getElementById('ambientCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width  = canvas.width  = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let isHeroVisible = true;

    window.addEventListener('resize', () => {
      width  = canvas.width  = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }, { passive: true });

    // Pause canvas drawing when hero is offscreen to preserve 100% resources for showcase
    const heroSection = document.getElementById('home');
    if ('IntersectionObserver' in window && heroSection) {
      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isHeroVisible = entry.isIntersecting;
        });
      }, { threshold: 0.05 });
      heroObserver.observe(heroSection);
    }

    const COLOR_POOL = [
      'rgba(181, 108, 255,',
      'rgba(181, 108, 255,',
      'rgba(255, 255, 255,',
      'rgba(142, 60, 255,',
      'rgba(52, 211, 153,',
    ];

    const particles = Array.from({ length: 42 }, () => ({
      x:       Math.random() * window.innerWidth,
      y:       Math.random() * window.innerHeight,
      size:    Math.random() * 2 + 0.6,
      speedY:  Math.random() * 0.35 + 0.1,
      speedX:  (Math.random() - 0.5) * 0.22,
      opacity: Math.random() * 0.45 + 0.15,
      color:   COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)],
      wobble:  Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.007 + 0.003,
    }));

    function animateParticles() {
      if (isHeroVisible) {
        ctx.clearRect(0, 0, width, height);
        particles.forEach((p) => {
          p.y -= p.speedY;
          p.wobble += p.wobbleSpeed;
          p.x += p.speedX + Math.sin(p.wobble) * 0.16;
          if (p.y < -4) {
            p.y = height + 4;
            p.x = Math.random() * width;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color} ${p.opacity})`;
          ctx.fill();
        });
      }
      requestAnimationFrame(animateParticles);
    }
    requestAnimationFrame(animateParticles);
  }

  // =========================================================
  // 2. HERO 3D MONUMENT GYROSCOPIC TILT (ZERO-REFLOW)
  // =========================================================
  const lensWidget = document.getElementById('cameraLensWidget');
  if (lensWidget) {
    let heroRect = null;
    const heroSection = document.getElementById('home');

    if (heroSection) {
      heroSection.addEventListener('mouseenter', () => {
        heroRect = heroSection.getBoundingClientRect();
      }, { passive: true });

      heroSection.addEventListener('mousemove', (e) => {
        if (!heroRect) heroRect = heroSection.getBoundingClientRect();
        const relX = (e.clientX - heroRect.left) / heroRect.width - 0.5;
        const relY = (e.clientY - heroRect.top)  / heroRect.height - 0.5;
        const rotX = relY * -14;
        const rotY = relX *  14;
        lensWidget.style.transform =
          `perspective(1200px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
      }, { passive: true });

      heroSection.addEventListener('mouseleave', () => {
        heroRect = null;
        lensWidget.style.transform =
          'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      });
    }
  }

  // =========================================================
  // 3. FLUID 3D HUD STUDIO POINTER (DESKTOP ONLY)
  // =========================================================
  const cursor = document.createElement('div');
  cursor.className = 'studio-cursor';
  document.body.appendChild(cursor);

  let mouseX = -500, mouseY = -500;
  let cursorX = -500, cursorY = -500;
  let hasMoved = false;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  if (isFinePointer) {
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!hasMoved) {
        hasMoved = true;
        cursorX = mouseX;
        cursorY = mouseY;
        cursor.classList.add('cursor-active');
      }
    }, { passive: true });

    document.addEventListener('mouseenter', () => {
      cursor.classList.add('cursor-active');
    });

    document.addEventListener('mouseleave', () => {
      cursor.classList.remove('cursor-active');
      cursor.textContent = '';
      cursor.className = 'studio-cursor';
    });

    // High refresh-rate smooth tracking loop (lerp factor 0.42 for razor-sharp responsiveness)
    function renderCursor() {
      cursorX += (mouseX - cursorX) * 0.42;
      cursorY += (mouseY - cursorY) * 0.42;
      cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(renderCursor);
    }
    requestAnimationFrame(renderCursor);

    // Contextual cursor states
    document.addEventListener('mouseover', (e) => {
      const workCard   = e.target.closest('.work-card');
      const actionLink = e.target.closest('a, button, .filter-tab, .camera-lens-widget, .service-card');

      if (workCard) {
        cursor.textContent = 'PLAY ▶';
        cursor.className   = 'studio-cursor cursor-active cursor-play';
      } else if (actionLink) {
        cursor.textContent = 'VIEW ↗';
        cursor.className   = 'studio-cursor cursor-active cursor-view';
      } else {
        cursor.textContent = '';
        cursor.className   = 'studio-cursor cursor-active';
      }
    }, { passive: true });
  }

  // =========================================================
  // 4. ZERO-LAG IN-CARD PREVIEW VIDEO ENGINE + 3D TILT
  // =========================================================
  const allWorkCards = document.querySelectorAll('.work-card');
  let activePreviewVideo = null;
  let hoverTimer = null;

  allWorkCards.forEach((card) => {
    let cardRect = null;
    let targetRotX = 0, targetRotY = 0;
    let curRotX = 0, curRotY = 0;
    let isCardHovered = false;
    let animId = null;

    function tiltLoop() {
      if (!isCardHovered && Math.abs(curRotX) < 0.05 && Math.abs(curRotY) < 0.05) {
        card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0) scale3d(1, 1, 1)';
        return;
      }
      curRotX += (targetRotX - curRotX) * 0.22;
      curRotY += (targetRotY - curRotY) * 0.22;
      card.style.transform =
        `perspective(1200px) rotateX(${curRotX.toFixed(2)}deg) rotateY(${curRotY.toFixed(2)}deg) translate3d(0, -6px, 16px) scale3d(1.02, 1.02, 1.02)`;
      animId = requestAnimationFrame(tiltLoop);
    }

    card.addEventListener('mouseenter', () => {
      isCardHovered = true;
      cardRect = card.getBoundingClientRect(); // Cached ONCE on enter, never in mousemove!
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(tiltLoop);

      // Debounced video preview spin-up: loads ONLY when user pauses on the card
      const videoSrc = card.getAttribute('data-preview');
      if (videoSrc) {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          if (!isCardHovered) return;

          // Remove any previous preview video
          if (activePreviewVideo) {
            activePreviewVideo.pause();
            activePreviewVideo.remove();
            activePreviewVideo = null;
          }

          const mediaContainer = card.querySelector('.work-card-media');
          if (mediaContainer) {
            const vid = document.createElement('video');
            vid.className = 'work-card-preview-video';
            vid.src = videoSrc;
            vid.muted = true;
            vid.loop = true;
            vid.playsInline = true;
            vid.preload = 'auto';

            vid.addEventListener('canplay', () => {
              vid.classList.add('is-playing');
            }, { once: true });

            mediaContainer.appendChild(vid);
            vid.play().catch(() => {});
            activePreviewVideo = vid;
          }
        }, 80);
      }
    }, { passive: true });

    card.addEventListener('mousemove', (e) => {
      if (!cardRect) cardRect = card.getBoundingClientRect();
      const relX = (e.clientX - cardRect.left) / cardRect.width  - 0.5;
      const relY = (e.clientY - cardRect.top)  / cardRect.height - 0.5;
      targetRotX = relY * -10;
      targetRotY = relX *  10;

      // 3D Specular glare position
      card.style.setProperty('--glare-x', `${((relX + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-y', `${((relY + 0.5) * 100).toFixed(1)}%`);
    }, { passive: true });

    card.addEventListener('mouseleave', () => {
      isCardHovered = false;
      cardRect = null;
      targetRotX = 0;
      targetRotY = 0;
      clearTimeout(hoverTimer);

      // Immediately release GPU video decoder resources
      if (activePreviewVideo) {
        activePreviewVideo.pause();
        activePreviewVideo.src = '';
        activePreviewVideo.remove();
        activePreviewVideo = null;
      }
    });
  });

  // =========================================================
  // 5. CATEGORY FILTER TABS
  // =========================================================
  const filterTabs = document.querySelectorAll('.filter-tab');

  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const category = tab.getAttribute('data-filter');
      filterTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      allWorkCards.forEach((card) => {
        const cardCat = card.getAttribute('data-category');
        if (category === 'all' || cardCat === category) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // =========================================================
  // 6. SCROLL PROGRESS BAR
  // =========================================================
  const scrollProgress = document.querySelector('.scroll-progress');
  if (scrollProgress) {
    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct       = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      scrollProgress.style.width = `${pct}%`;
    }, { passive: true });
  }

  // =========================================================
  // 7. SCROLL REVEAL OBSERVER
  // =========================================================
  const revealEls = document.querySelectorAll('.reveal');
  document.querySelectorAll('.hero-content, .camera-lens-wrapper').forEach((el) => {
    el.classList.add('is-visible', 'visible');
  });

  if ('IntersectionObserver' in window && revealEls.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible', 'visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    revealEls.forEach((el) => revealObserver.observe(el));
  }

  console.log('✨ Ethos Vision v3 extreme active — 3D depth, 0-lag video preview, 120 FPS performance.');
})();
