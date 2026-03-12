/**
 * pdf-export.js — Shared Playwright + pdf-lib export logic
 * Used by both server.mjs and export-pdf.mjs
 *
 * Takes an absolute HTML file path, auto-discovers [data-slide] sections,
 * screenshots each .slide element, and assembles a 16:9 PDF.
 */

import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { validateDeckFile } from './deck-policy.js';
import {
  DEFAULT_FONT_WAIT_MS,
  DEFAULT_VIEWPORT,
  discoverDeckSlides,
  prepareDeckPage,
} from './deck-runtime.js';

const PAGE_W = 960;  // PDF points (13.33" at 72dpi)
const PAGE_H = 540;  // PDF points (7.5" at 72dpi)

/**
 * @param {string} htmlPath — Absolute path to the HTML file
 * @param {object} [opts]
 * @param {number} [opts.viewportWidth=1280]
 * @param {number} [opts.viewportHeight=720]
 * @param {number} [opts.deviceScaleFactor=3]
 * @param {number} [opts.fontWaitMs=1500]
 * @returns {Promise<Buffer>} — PDF file as a Buffer
 */
export async function generatePDF(htmlPath, opts = {}) {
  validateDeckFile(htmlPath);

  const {
    viewportWidth = DEFAULT_VIEWPORT.width,
    viewportHeight = DEFAULT_VIEWPORT.height,
    deviceScaleFactor = 3,
    fontWaitMs = DEFAULT_FONT_WAIT_MS,
  } = opts;

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor,
    });
    const page = await context.newPage();

    // Load the HTML file
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

    await prepareDeckPage(page, { fontWaitMs });
    const slides = await discoverDeckSlides(page);

    // Screenshot each slide
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

    // Assemble PDF
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
