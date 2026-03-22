import { CANVAS_STAGE } from '../canvas/canvas-contract.mjs';

function parseCssPixels(value) {
  const match = String(value || '').trim().match(/^([0-9]+(?:\.[0-9]+)?)px$/i);
  return match ? Number.parseFloat(match[1]) : NaN;
}

function normalizeAspectRatio(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function expectedMaxWidthForVariant(variant) {
  return variant === 'wide'
    ? CANVAS_STAGE.slideWideMaxWidth
    : CANVAS_STAGE.slideMaxWidth;
}

export function validateRenderedCanvasContract(slides = []) {
  const violations = [];

  for (const slide of slides) {
    const expectedWidth = expectedMaxWidthForVariant(slide.variant);
    const measuredMaxWidth = parseCssPixels(slide.styles?.maxWidth);
    const measuredAspectRatio = normalizeAspectRatio(slide.styles?.aspectRatio);

    if (!Number.isFinite(measuredMaxWidth) || Math.abs(measuredMaxWidth - expectedWidth) > 1) {
      violations.push(
        `${slide.id}: canvas contract max-width drifted to "${slide.styles?.maxWidth || 'unknown'}" (expected ${expectedWidth}px).`
      );
    }

    if (measuredAspectRatio !== CANVAS_STAGE.slideRatio) {
      violations.push(
        `${slide.id}: canvas contract aspect ratio drifted to "${slide.styles?.aspectRatio || 'unknown'}" (expected ${CANVAS_STAGE.slideRatio}).`
      );
    }

    if ((slide.dimensions?.width || 0) > expectedWidth + 2) {
      violations.push(
        `${slide.id}: rendered slide width ${slide.dimensions?.width}px exceeded the ${expectedWidth}px canvas contract.`
      );
    }

    if (slide.overflowDetected) {
      violations.push(`${slide.id}: rendered slide overflowed its canvas.`);
    }
  }

  return {
    valid: violations.length === 0,
    expectedAspectRatio: CANVAS_STAGE.slideRatio,
    expectedWidths: {
      default: CANVAS_STAGE.slideMaxWidth,
      wide: CANVAS_STAGE.slideWideMaxWidth,
    },
    violations,
  };
}
