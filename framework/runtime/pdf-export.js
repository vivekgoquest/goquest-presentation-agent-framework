/**
 * pdf-export.js — Shared Playwright + pdf-lib export logic
 *
 * Renders a virtual workspace preview over localhost, screenshots each slide,
 * and assembles a 16:9 PDF.
 */

import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { createPresentationTarget } from './deck-paths.js';
import { renderPresentationHtml } from './deck-assemble.js';
import { withRuntimeServer } from './runtime-app.js';
import {
  DEFAULT_FONT_WAIT_MS,
  DEFAULT_VIEWPORT,
  discoverDeckSlides,
  prepareDeckPage,
  selectDeckSlides,
} from './deck-runtime.js';

const PAGE_W = 960;
const PAGE_H = 540;

async function generatePDFFromPreviewUrl(previewUrl, opts = {}) {
  const {
    viewportWidth = DEFAULT_VIEWPORT.width,
    viewportHeight = DEFAULT_VIEWPORT.height,
    deviceScaleFactor = 3,
    fontWaitMs = DEFAULT_FONT_WAIT_MS,
    slideIds = [],
  } = opts;

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor,
    });
    const page = await context.newPage();

    await page.goto(previewUrl, { waitUntil: 'load' });
    await prepareDeckPage(page, { fontWaitMs });
    const slides = selectDeckSlides(await discoverDeckSlides(page), slideIds);

    const screenshots = [];
    for (const slide of slides) {
      const el = await page.$(slide.selector);
      if (!el) {
        console.warn(`Slide not found: "${slide.selector}", skipping`);
        continue;
      }
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      const png = await el.screenshot({ type: 'png' });
      screenshots.push(png);
      console.log(`Captured: ${slide.selector}`);
    }

    await browser.close();

    const pdf = await PDFDocument.create();

    for (const png of screenshots) {
      const img = await pdf.embedPng(png);
      const pdfPage = pdf.addPage([PAGE_W, PAGE_H]);
      pdfPage.drawImage(img, {
        x: 0,
        y: 0,
        width: PAGE_W,
        height: PAGE_H,
      });
    }

    const pdfBytes = await pdf.save();
    console.log(`PDF assembled: ${screenshots.length} pages, ${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB`);
    return Buffer.from(pdfBytes);
  } catch (err) {
    await browser.close();
    throw err;
  }
}

export async function generatePDF(targetInput, opts = {}) {
  const target = createPresentationTarget(targetInput);
  renderPresentationHtml(target);
  return withRuntimeServer(target, ({ previewUrl }) => generatePDFFromPreviewUrl(previewUrl, opts));
}
