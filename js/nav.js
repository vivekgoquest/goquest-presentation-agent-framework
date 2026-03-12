/*
 * nav.js — Dot navigation
 * Auto-discovers sections with [data-slide] attribute
 * Builds a fixed dot nav on the right side of the viewport
 */

(function () {
  const sections = document.querySelectorAll('[data-slide]');
  if (sections.length === 0) return;

  // Build nav container
  const nav = document.createElement('nav');
  nav.className = 'dot-nav';
  nav.setAttribute('aria-label', 'Slide navigation');

  const dots = [];
  sections.forEach((section) => {
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', section.id || 'slide');
    btn.addEventListener('click', () => {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    nav.appendChild(btn);
    dots.push({ btn, section });
  });

  document.body.appendChild(nav);

  // Track active dot on scroll
  function updateActive() {
    const viewMid = window.innerHeight / 2;
    let closest = dots[0];
    let closestDist = Infinity;

    dots.forEach((d) => {
      const rect = d.section.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(mid - viewMid);
      if (dist < closestDist) {
        closestDist = dist;
        closest = d;
      }
    });

    dots.forEach((d) => d.btn.classList.toggle('active', d === closest));
  }

  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
})();
