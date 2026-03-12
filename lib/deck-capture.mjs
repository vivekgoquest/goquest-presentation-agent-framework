/**
 * deck-capture.mjs — Playwright-based deck data extraction
 *
 * Opens an HTML deck in a headless browser, captures screenshots of every slide,
 * and extracts structured data (text, numbers, styles, layout) into a JSON report.
 *
 * Usage:
 *   node lib/deck-capture.mjs <html-file> [output-dir]
 *
 * Output:
 *   <output-dir>/report.json     — Structured data for every slide
 *   <output-dir>/slide-<id>.png  — Screenshot of each slide
 *   <output-dir>/full-page.png   — Full-page screenshot
 *
 * Each verification agent runs this independently in its own browser session.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { pathToFileURL } from 'url';
import { validateDeckFile } from './deck-policy.js';
import {
  DEFAULT_VIEWPORT,
  discoverDeckSlides,
  prepareDeckPage,
} from './deck-runtime.js';

export async function captureDeck(htmlFile, outputDir = `/tmp/deck-verify-${Date.now()}`) {
  const htmlPath = resolve(import.meta.dirname, '..', htmlFile);

  if (!existsSync(htmlPath)) {
    throw new Error(`File not found: ${htmlPath}`);
  }

  validateDeckFile(htmlPath);
  mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: DEFAULT_VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Load
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await prepareDeckPage(page);

  // Full-page screenshot
  await page.screenshot({ path: resolve(outputDir, 'full-page.png'), fullPage: true });

  const slideTargets = await discoverDeckSlides(page);
  const slideIndex = new Map(slideTargets.map((slide) => [slide.id, slide]));

  // Extract comprehensive data from every slide
  const slides = await page.evaluate(() => {
    const sections = document.querySelectorAll('[data-slide]');
    return Array.from(sections).map((section) => {
      const slideEl = section.querySelector('.slide, .slide-wide, .slide-hero');
      if (!slideEl) return null;

      const rect = slideEl.getBoundingClientRect();

      // ── Text extraction ──
      const allText = slideEl.innerText.trim();
      const headings = Array.from(slideEl.querySelectorAll('.hero-title, .sect-title, h1, h2, h3'))
        .map((h) => ({ tag: h.tagName, class: h.className, text: h.textContent.trim() }));
      const eyebrows = Array.from(slideEl.querySelectorAll('.eyebrow'))
        .map((e) => e.textContent.trim());
      const bodyTexts = Array.from(slideEl.querySelectorAll('.body-text, .body-lg'))
        .map((b) => b.textContent.trim());

      // ── Numbers & statistics ──
      const stats = Array.from(slideEl.querySelectorAll('[data-count]')).map((el) => ({
        value: el.dataset.count,
        prefix: el.dataset.prefix || '',
        suffix: el.dataset.suffix || '',
        displayed: el.textContent.trim(),
        label: el.closest('.stat-card')?.querySelector('.stat-label')?.textContent.trim() || '',
      }));

      // All numbers found in text (for cross-referencing)
      const numbersInText = allText.match(/\d[\d,.]*/g) || [];

      // ── Episode references ──
      const episodeRefs = [];
      const epMatches = allText.matchAll(/Ep(?:isode)?\s*(\d+)[:\s]*[""]?([^"""\n]{0,80})[""]?/gi);
      for (const m of epMatches) {
        episodeRefs.push({ number: parseInt(m[1], 10), title: m[2]?.trim() || '' });
      }

      // ── Badges ──
      const badges = Array.from(slideEl.querySelectorAll('.badge, [class*="badge-"]'))
        .map((b) => ({ text: b.textContent.trim(), classes: b.className }));

      // ── Tables ──
      const tables = Array.from(slideEl.querySelectorAll('table')).map((table) => {
        const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent.trim());
        const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim())
        ).filter((r) => r.length > 0);
        return { headers, rows };
      });

      // ── Images ──
      const images = Array.from(slideEl.querySelectorAll('img')).map((img) => ({
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || '',
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayed: { width: img.clientWidth, height: img.clientHeight },
      }));

      // ── Layout & grid analysis ──
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
          // Check if all children have equal widths (symmetry)
          widthsEqual: childRects.length > 1 && new Set(childRects.map((r) => r.width)).size === 1,
          // Check if all children are top-aligned
          topsAligned: childRects.length > 1 && new Set(childRects.map((r) => r.top)).size === 1,
        };
      });

      // ── Computed styles ──
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

      // ── Logo detection ──
      const beforeStyle = window.getComputedStyle(slideEl, '::before');
      const afterStyle = window.getComputedStyle(slideEl, '::after');
      const logos = {
        right: {
          visible: beforeStyle.content !== 'none' && beforeStyle.display !== 'none',
          backgroundImage: beforeStyle.backgroundImage,
          position: { top: beforeStyle.top, right: beforeStyle.right },
          size: { width: beforeStyle.width, height: beforeStyle.height },
        },
        left: {
          visible: afterStyle.content !== 'none' && afterStyle.display !== 'none',
          backgroundImage: afterStyle.backgroundImage,
          position: { top: afterStyle.top, left: afterStyle.left },
          size: { width: afterStyle.width, height: afterStyle.height },
        },
      };

      // ── Overflow detection ──
      const overflowDetected = slideEl.scrollHeight > slideEl.clientHeight + 2
        || slideEl.scrollWidth > slideEl.clientWidth + 2;

      // ── Typography inventory ──
      const fontSizes = new Set();
      const fontWeights = new Set();
      slideEl.querySelectorAll('*').forEach((el) => {
        const s = window.getComputedStyle(el);
        if (el.textContent.trim()) {
          fontSizes.add(s.fontSize);
          fontWeights.add(s.fontWeight);
        }
      });

      // ── Inner cards ──
      const innerCards = Array.from(slideEl.querySelectorAll('.icard')).map((card) => {
        const r = card.getBoundingClientRect();
        return {
          text: card.textContent.trim().substring(0, 200),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      });

      // ── Takeaway boxes ──
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

  // Screenshot each slide individually
  for (const slide of slides) {
    const target = slideIndex.get(slide.id);
    const el = target ? await page.$(target.selector) : await page.$(`#${slide.id}`);
    if (el) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const screenshotPath = resolve(outputDir, `slide-${slide.id}.png`);
      await el.screenshot({ path: screenshotPath, type: 'png' });
      slide.screenshotPath = screenshotPath;
      console.log(`  Captured: ${slide.id}`);
    }
  }

  await browser.close();

  // ── Global analysis ──
  const report = {
    file: basename(htmlFile),
    htmlPath,
    timestamp: new Date().toISOString(),
    outputDir,
    slideCount: slides.length,
    consoleErrors,
    slides,
    // Cross-slide consistency checks
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
  console.log(`Screenshots: ${outputDir}/slide-*.png`);

  // Print summary to stdout for agent consumption
  console.log('\n--- SUMMARY ---');
  console.log(JSON.stringify({
    outputDir,
    reportPath,
    slideCount: slides.length,
    slideIds: slides.map((s) => s.id),
    consoleErrors: consoleErrors.length,
    overflowSlides: report.consistency.slidesWithOverflow,
    episodeCount: report.consistency.allEpisodeRefs.length,
  }));

  return report;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const htmlFile = process.argv[2];
  if (!htmlFile) {
    console.error('Usage: node lib/deck-capture.mjs <html-file> [output-dir]');
    process.exit(1);
  }

  const outputDir = process.argv[3] || `/tmp/deck-verify-${Date.now()}`;

  captureDeck(htmlFile, outputDir).catch((err) => {
    console.error('Capture failed:', err);
    process.exit(1);
  });
}
