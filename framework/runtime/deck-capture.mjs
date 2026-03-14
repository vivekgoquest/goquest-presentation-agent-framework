/**
 * deck-capture.mjs — Playwright-based deck data extraction
 *
 * Opens a virtual deck preview in a headless browser, captures screenshots of every
 * slide, and extracts structured data (text, numbers, styles, layout) into a JSON report.
 *
 * Usage:
 *   node framework/runtime/deck-capture.mjs --deck sample [output-dir]
 *   node framework/runtime/deck-capture.mjs --example demo [output-dir]
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import {
  createPresentationTarget,
  getPresentationId,
  getPresentationPaths,
  parsePresentationTargetCliArgs,
} from './deck-paths.js';
import { renderPresentationHtml } from './deck-assemble.js';
import { withRuntimeServer } from './runtime-app.js';
import {
  DEFAULT_VIEWPORT,
  discoverDeckSlides,
  prepareDeckPage,
} from './deck-runtime.js';

function buildReportSummary(slides, consoleErrors) {
  const slideIds = slides.map((slide) => slide.id);
  const overflowSlides = slides.filter((slide) => slide.overflowDetected).map((slide) => slide.id);

  return {
    slideIds,
    consoleErrorCount: consoleErrors.length,
    overflowSlides,
    episodeCount: slides.flatMap((slide) => slide.episodeRefs).length,
    status: slideIds.length === 0 || consoleErrors.length > 0 || overflowSlides.length > 0
      ? 'needs-review'
      : 'pass',
  };
}

async function captureDeckFromPreviewUrl(previewUrl, target, outputDir, options = {}) {
  const { slidesDirName = '' } = options;
  const slidesOutputDir = slidesDirName
    ? resolve(outputDir, slidesDirName)
    : outputDir;

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(slidesOutputDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: DEFAULT_VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  await page.goto(previewUrl, { waitUntil: 'load' });
  await prepareDeckPage(page);
  await page.screenshot({ path: resolve(outputDir, 'full-page.png'), fullPage: true });

  const slideTargets = await discoverDeckSlides(page);
  const slideIndex = new Map(slideTargets.map((slide) => [slide.id, slide]));

  const slides = await page.evaluate(() => {
    const sections = document.querySelectorAll('[data-slide]');
    return Array.from(sections).map((section) => {
      const slideEl = section.querySelector('.slide, .slide-wide, .slide-hero');
      if (!slideEl) return null;

      const rect = slideEl.getBoundingClientRect();
      const allText = slideEl.innerText.trim();
      const headings = Array.from(slideEl.querySelectorAll('.hero-title, .sect-title, h1, h2, h3'))
        .map((h) => ({ tag: h.tagName, class: h.className, text: h.textContent.trim() }));
      const eyebrows = Array.from(slideEl.querySelectorAll('.eyebrow'))
        .map((e) => e.textContent.trim());
      const bodyTexts = Array.from(slideEl.querySelectorAll('.body-text, .body-lg'))
        .map((b) => b.textContent.trim());

      const stats = Array.from(slideEl.querySelectorAll('[data-count]')).map((el) => ({
        value: el.dataset.count,
        prefix: el.dataset.prefix || '',
        suffix: el.dataset.suffix || '',
        displayed: el.textContent.trim(),
        label: el.closest('.stat-card')?.querySelector('.stat-label')?.textContent.trim() || '',
      }));

      const numbersInText = allText.match(/\d[\d,.]*/g) || [];

      const episodeRefs = [];
      const epMatches = allText.matchAll(/Ep(?:isode)?\s*(\d+)[:\s]*[""]?([^"""\n]{0,80})[""]?/gi);
      for (const m of epMatches) {
        episodeRefs.push({ number: parseInt(m[1], 10), title: m[2]?.trim() || '' });
      }

      const badges = Array.from(slideEl.querySelectorAll('.badge, [class*="badge-"]'))
        .map((b) => ({ text: b.textContent.trim(), classes: b.className }));

      const tables = Array.from(slideEl.querySelectorAll('table')).map((table) => {
        const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent.trim());
        const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim())
        ).filter((r) => r.length > 0);
        return { headers, rows };
      });

      const images = Array.from(slideEl.querySelectorAll('img')).map((img) => ({
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || '',
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayed: { width: img.clientWidth, height: img.clientHeight },
      }));

      const grids = Array.from(slideEl.querySelectorAll('.g2, .g3, .g4')).map((grid) => {
        const children = Array.from(grid.children);
        const childRects = children.map((c) => {
          const r = c.getBoundingClientRect();
          return { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) };
        });
        return {
          class: grid.className,
          childCount: children.length,
          childRects,
          widthsEqual: childRects.length > 1 && new Set(childRects.map((r) => r.width)).size === 1,
          topsAligned: childRects.length > 1 && new Set(childRects.map((r) => r.top)).size === 1,
        };
      });

      const cs = window.getComputedStyle(slideEl);
      const styles = {
        backgroundColor: cs.backgroundColor,
        borderRadius: cs.borderRadius,
        fontFamily: cs.fontFamily,
        padding: cs.padding,
        boxShadow: cs.boxShadow,
        overflow: cs.overflow,
        aspectRatio: cs.aspectRatio,
      };

      const beforeStyle = window.getComputedStyle(slideEl, '::before');
      const afterStyle = window.getComputedStyle(slideEl, '::after');
      const readPseudoLogo = (style, positionKey) => {
        const hasAsset = style.backgroundImage && style.backgroundImage !== 'none';
        return {
          visible: Boolean(
            hasAsset
            && style.content !== 'none'
            && style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0'
          ),
          hasAsset: Boolean(hasAsset),
          backgroundImage: style.backgroundImage,
          position: positionKey === 'right'
            ? { top: style.top, right: style.right }
            : { top: style.top, left: style.left },
          size: { width: style.width, height: style.height },
        };
      };
      const logos = {
        right: readPseudoLogo(beforeStyle, 'right'),
        left: readPseudoLogo(afterStyle, 'left'),
      };

      const overflowDetected = slideEl.scrollHeight > slideEl.clientHeight + 2
        || slideEl.scrollWidth > slideEl.clientWidth + 2;

      const fontSizes = new Set();
      const fontWeights = new Set();
      slideEl.querySelectorAll('*').forEach((el) => {
        const s = window.getComputedStyle(el);
        if (el.textContent.trim()) {
          fontSizes.add(s.fontSize);
          fontWeights.add(s.fontWeight);
        }
      });

      const innerCards = Array.from(slideEl.querySelectorAll('.icard')).map((card) => {
        const r = card.getBoundingClientRect();
        return {
          text: card.textContent.trim().substring(0, 200),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      });

      const takeaways = Array.from(slideEl.querySelectorAll('.tkwy'))
        .map((t) => t.textContent.trim());

      return {
        id: section.id,
        index: Array.from(sections).indexOf(section),
        isHero: slideEl.classList.contains('slide-hero'),
        dimensions: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          aspectRatio: (rect.width / rect.height).toFixed(3),
        },
        allText,
        headings,
        eyebrows,
        bodyTexts,
        stats,
        numbersInText,
        episodeRefs,
        badges,
        tables,
        images,
        grids,
        innerCards,
        takeaways,
        styles,
        logos,
        overflowDetected,
        typography: {
          fontSizesUsed: Array.from(fontSizes),
          fontWeightsUsed: Array.from(fontWeights),
        },
      };
    }).filter(Boolean);
  });

  for (const slide of slides) {
    const target = slideIndex.get(slide.id);
    const el = target ? await page.$(target.selector) : await page.$(`#${slide.id}`);
    if (el) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const screenshotPath = resolve(slidesOutputDir, `slide-${slide.id}.png`);
      await el.screenshot({ path: screenshotPath, type: 'png' });
      slide.screenshotPath = screenshotPath;
      console.log(`  Captured: ${slide.id}`);
    }
  }

  await browser.close();

  const summary = buildReportSummary(slides, consoleErrors);

  const report = {
    workspace: getPresentationId(target),
    presentation: getPresentationId(target),
    previewUrl,
    timestamp: new Date().toISOString(),
    outputDir,
    slidesDir: slidesOutputDir,
    slideCount: slides.length,
    slideIds: summary.slideIds,
    consoleErrors,
    consoleErrorCount: summary.consoleErrorCount,
    overflowSlides: summary.overflowSlides,
    episodeCount: summary.episodeCount,
    status: summary.status,
    issues: [],
    slides,
    consistency: {
      allSlidesHaveLogos: slides.filter((s) => !s.isHero).every((s) => s.logos.right.visible && s.logos.left.visible),
      slidesWithoutRightLogo: slides.filter((s) => !s.isHero && !s.logos.right.visible).map((s) => s.id),
      slidesWithoutLeftLogo: slides.filter((s) => !s.isHero && !s.logos.left.visible).map((s) => s.id),
      slidesWithOverflow: slides.filter((s) => s.overflowDetected).map((s) => s.id),
      aspectRatios: [...new Set(slides.map((s) => s.dimensions.aspectRatio))],
      allEpisodeRefs: slides.flatMap((s) => s.episodeRefs),
      allStats: slides.flatMap((s) => s.stats),
      allBadges: slides.flatMap((s) => s.badges.map((b) => b.text)),
    },
  };

  const reportPath = resolve(outputDir, 'report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${reportPath}`);
  console.log(`Slides: ${slides.length}`);
  console.log(`Screenshots: ${slidesOutputDir}/slide-*.png`);

  console.log('\n--- SUMMARY ---');
  console.log(JSON.stringify({
    outputDir,
    reportPath,
    slideCount: slides.length,
    slideIds: report.slideIds,
    consoleErrors: report.consoleErrorCount,
    overflowSlides: report.overflowSlides,
    episodeCount: report.episodeCount,
    status: report.status,
  }));

  return report;
}

export async function captureDeck(targetInput, outputDir = `/tmp/deck-verify-${Date.now()}`, options = {}) {
  const target = createPresentationTarget(targetInput);
  renderPresentationHtml(target);
  return withRuntimeServer(target, ({ previewUrl }) =>
    captureDeckFromPreviewUrl(previewUrl, target, outputDir, options)
  );
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  let parsed;
  try {
    parsed = parsePresentationTargetCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Usage: node framework/runtime/deck-capture.mjs --project /abs/path [output-dir] | --deck <slug> [output-dir] | --example <name> [output-dir]\n\n${err.message}`);
    process.exit(1);
  }

  const targetPaths = getPresentationPaths(parsed.target);
  const outputDir = parsed.rest[0] || `/tmp/deck-verify-${targetPaths.slug}-${Date.now()}`;

  captureDeck(parsed.target, outputDir).catch((err) => {
    console.error('Capture failed:', err);
    process.exit(1);
  });
}
