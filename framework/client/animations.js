/*
 * animations.js — local, dependency-free reveal system
 * Auto-discovers .rv, .rv-l, .rv-r, .rv-s elements and marks them visible
 * with IntersectionObserver. This keeps the scaffold fully offline-safe.
 */

(function () {
  const revealNodes = document.querySelectorAll('.rv, .rv-l, .rv-r, .rv-s');
  if (revealNodes.length === 0) {
    return;
  }

  const reveal = (node) => node.classList.add('is-visible');

  if (!('IntersectionObserver' in window)) {
    revealNodes.forEach(reveal);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.2,
      rootMargin: '0px 0px -8% 0px',
    }
  );

  revealNodes.forEach((node) => observer.observe(node));
})();
