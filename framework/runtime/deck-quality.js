import { readFileSync, existsSync } from 'fs';

/**
 * Identifies the primary grid/content block in a slide's HTML.
 * Returns the first structural class found, or 'none'.
 */
function getPrimaryContentBlock(html) {
  // Order matters — check most specific first
  if (/<table\b/i.test(html)) return 'table';
  if (/class="[^"]*\bg4\b/.test(html)) return 'g4';
  if (/class="[^"]*\bg3\b/.test(html)) return 'g3';
  if (/class="[^"]*\bg2\b/.test(html)) return 'g2';
  if (/class="[^"]*\btkwy\b/.test(html)) return 'tkwy';
  return 'none';
}

/**
 * Checks if a slide is a hero slide (dark background, typically opening/closing).
 */
function isHeroSlide(html) {
  return /class="[^"]*\bslide-hero\b/.test(html);
}

// ── Rules ───────────────────────────────────────────────────

function layoutVariety(slides) {
  const warnings = [];
  const contentSlides = slides.filter((s) => !isHeroSlide(s.html));
  if (contentSlides.length < 5) return warnings;

  const blockCounts = {};
  for (const s of contentSlides) {
    const block = getPrimaryContentBlock(s.html);
    blockCounts[block] = (blockCounts[block] || 0) + 1;
  }

  for (const [block, count] of Object.entries(blockCounts)) {
    const pct = Math.round((count / contentSlides.length) * 100);
    if (pct > 50 && block !== 'none') {
      const affected = contentSlides
        .filter((s) => getPrimaryContentBlock(s.html) === block)
        .map((s) => s.slideId);
      warnings.push({
        rule: 'layout-variety',
        slideId: affected.join(', '),
        message: `${pct}% of content slides use .${block}. The deck looks monotonous.`,
        fix: `Change at least ${Math.ceil(count / 2)} of these slides to use a different content block (table, .g2, .tkwy, or narrative text). Affected slides: ${affected.join(', ')}.`,
      });
    }
  }
  return warnings;
}

function consecutiveSameLayout(slides) {
  const warnings = [];
  let runStart = 0;
  let runBlock = null;

  for (let i = 0; i <= slides.length; i++) {
    const block = i < slides.length ? getPrimaryContentBlock(slides[i].html) : null;
    const isHero = i < slides.length ? isHeroSlide(slides[i].html) : false;

    if (!isHero && block === runBlock && block !== 'none') {
      continue; // still in the same run
    }

    // Run ended — check if it was 3+
    const runLength = i - runStart;
    if (runLength >= 3 && runBlock && runBlock !== 'none') {
      const affected = slides.slice(runStart, i).map((s) => s.slideId);
      warnings.push({
        rule: 'consecutive-same-layout',
        slideId: affected.join(', '),
        message: `${runLength} consecutive slides all use .${runBlock}.`,
        fix: `Break the visual rhythm. Change at least one of these slides to use a different content block: ${affected.join(', ')}.`,
      });
    }

    runStart = i;
    runBlock = (!isHero && i < slides.length) ? block : null;
  }
  return warnings;
}

function statCardMisuse(slides) {
  const warnings = [];
  const STAT_VALUE_RE = /class="[^"]*\bstat-value\b[^"]*"[^>]*>([^<]+)</g;
  const HAS_DIGIT = /\d/;

  for (const s of slides) {
    let match;
    STAT_VALUE_RE.lastIndex = 0;
    while ((match = STAT_VALUE_RE.exec(s.html)) !== null) {
      const text = match[1].trim();
      if (text && !HAS_DIGIT.test(text)) {
        warnings.push({
          rule: 'stat-card-misuse',
          slideId: s.slideId,
          message: `stat-value contains "${text}" which is not a number. stat-card is for numeric metrics.`,
          fix: `In ${s.slideHtmlRel}, replace the .stat-card/.stat-value containing "${text}" with an .icard using .body-text.body-strong for the heading instead.`,
        });
      }
    }
  }
  return warnings;
}

function imageCoverage(slides) {
  const warnings = [];
  if (slides.length < 10) return warnings;

  const slidesWithImages = slides.filter((s) => /<img\b/i.test(s.html));
  if (slidesWithImages.length === 0) {
    warnings.push({
      rule: 'image-coverage',
      slideId: 'deck-wide',
      message: `${slides.length}-slide deck has zero images. The deck is entirely typographic.`,
      fix: 'Add images where they serve the content — team headshots (.img-circle), product screenshots (.img-round), or architecture diagrams. Place assets in the slide\'s assets/ folder or the deck-shared assets/ folder.',
    });
  }
  return warnings;
}

function componentDiversity(slides) {
  const warnings = [];
  const contentSlides = slides.filter((s) => !isHeroSlide(s.html));
  if (contentSlides.length < 8) return warnings;

  const blockTypes = new Set();
  for (const s of contentSlides) {
    blockTypes.add(getPrimaryContentBlock(s.html));
  }
  blockTypes.delete('none');

  if (blockTypes.size <= 1) {
    const only = blockTypes.size === 1 ? [...blockTypes][0] : 'none';
    warnings.push({
      rule: 'component-diversity',
      slideId: 'deck-wide',
      message: `All ${contentSlides.length} content slides use the same content block type${only !== 'none' ? ` (.${only})` : ''}. The deck has no visual variety.`,
      fix: 'Use a mix of content blocks across the deck: .g2 for comparisons, .g3/.g4 for features, table for data, .tkwy for standalone insights, narrative text (.body-lg + .max-w-650) for argument slides.',
    });
  }
  return warnings;
}

// ── Rule registry ───────────────────────────────────────────

const RULES = [
  layoutVariety,
  consecutiveSameLayout,
  statCardMisuse,
  imageCoverage,
  componentDiversity,
];

// ── Public API ──────────────────────────────────────────────

/**
 * Run all quality rules against the slide entries.
 * slideEntries: array from listSlideSourceEntries(), each with slideId, slideHtmlAbs, slideHtmlRel.
 * Returns { warnings: [{ rule, slideId, message, fix }] }
 */
export function checkDeckQuality(slideEntries) {
  const slides = slideEntries
    .filter((entry) => entry.isValidName && existsSync(entry.slideHtmlAbs))
    .map((entry) => ({
      slideId: entry.slideId,
      slideHtmlRel: entry.slideHtmlRel,
      html: readFileSync(entry.slideHtmlAbs, 'utf-8'),
    }));

  const warnings = [];
  for (const rule of RULES) {
    warnings.push(...rule(slides));
  }

  return { warnings };
}
