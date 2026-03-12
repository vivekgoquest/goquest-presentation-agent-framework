/*
 * animations.js — GSAP + ScrollTrigger reveal system
 * Auto-discovers .rv, .rv-l, .rv-r, .rv-s elements
 * Requires: GSAP + ScrollTrigger loaded via CDN before this script
 */

(function () {
  gsap.registerPlugin(ScrollTrigger);

  // Lenis smooth scroll (if loaded)
  if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({ lerp: 0.12 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Reveal definitions: class → GSAP from-properties
  const reveals = [
    { sel: '.rv',   from: { opacity: 0, y: 30 } },
    { sel: '.rv-l', from: { opacity: 0, x: -40 } },
    { sel: '.rv-r', from: { opacity: 0, x: 40 } },
    { sel: '.rv-s', from: { opacity: 0, scale: 0.9 } },
  ];

  reveals.forEach(({ sel, from }) => {
    document.querySelectorAll(sel).forEach((el) => {
      gsap.from(el, {
        ...from,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          once: true,
        },
      });
    });
  });
})();
