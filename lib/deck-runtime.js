export const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
export const DEFAULT_FONT_WAIT_MS = 1500;

const DECK_PREPARE_STYLES = `
  .rv, .rv-l, .rv-r, .rv-s {
    opacity: 1 !important;
    transform: none !important;
  }
  .dot-nav { display: none !important; }
  .export-bar { display: none !important; }
`;

export async function prepareDeckPage(page, opts = {}) {
  const { fontWaitMs = DEFAULT_FONT_WAIT_MS } = opts;

  await page.waitForFunction(() => document.fonts.ready);
  await page.waitForTimeout(fontWaitMs);

  await page.evaluate(() => {
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    }
    if (typeof gsap !== 'undefined') {
      gsap.globalTimeline.clear();
      gsap.killTweensOf('*');
    }
  });

  await page.addStyleTag({ content: DECK_PREPARE_STYLES });

  await page.evaluate(() => {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const decimals = parseInt(el.dataset.decimals || '0', 10);

      el.textContent = decimals > 0
        ? prefix + target.toFixed(decimals) + suffix
        : prefix + Math.round(target).toLocaleString('en-IN') + suffix;
    });
  });
}

export async function discoverDeckSlides(page) {
  return page.evaluate(() => {
    const sections = document.querySelectorAll('[data-slide]');

    return Array.from(sections).map((section, index) => {
      const slideEl = section.querySelector('.slide, .slide-wide, .slide-hero');
      if (!slideEl) return null;

      const sectionId = section.id || `slide-${index + 1}`;
      const escapedId = typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(sectionId)
        : sectionId;

      let selector = `#${escapedId} .slide`;
      if (slideEl.classList.contains('slide-wide')) selector = `#${escapedId} .slide-wide`;
      if (slideEl.classList.contains('slide-hero')) selector = `#${escapedId} .slide-hero`;

      return {
        id: sectionId,
        index,
        selector,
        variant: slideEl.classList.contains('slide-wide')
          ? 'wide'
          : slideEl.classList.contains('slide-hero')
            ? 'hero'
            : 'default',
      };
    }).filter(Boolean);
  });
}
