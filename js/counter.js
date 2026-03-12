/*
 * counter.js — Animated counters
 * Auto-discovers elements with [data-count] attribute
 * Supports data-prefix, data-suffix, data-decimals
 * Uses IntersectionObserver for trigger
 */

(function () {
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length === 0) return;

  const DURATION = 1200; // ms
  const FPS = 60;
  const FRAMES = Math.round(DURATION / (1000 / FPS));

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function animateCounter(el) {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    let frame = 0;

    function step() {
      frame++;
      const progress = easeOutQuart(frame / FRAMES);
      const current = target * progress;

      if (decimals > 0) {
        el.textContent = prefix + current.toFixed(decimals) + suffix;
      } else {
        el.textContent = prefix + Math.round(current).toLocaleString('en-IN') + suffix;
      }

      if (frame < FRAMES) {
        requestAnimationFrame(step);
      } else {
        // Ensure final value is exact
        if (decimals > 0) {
          el.textContent = prefix + target.toFixed(decimals) + suffix;
        } else {
          el.textContent = prefix + Math.round(target).toLocaleString('en-IN') + suffix;
        }
      }
    }

    step();
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((el) => observer.observe(el));
})();
