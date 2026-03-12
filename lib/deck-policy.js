import { readFileSync } from 'fs';

const EXPECTED_LAYER_ORDER = '@layer content, theme, canvas;';
const INLINE_STYLE_RE = /\sstyle\s*=/i;
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

export function validateDeckSource(html, sourceName = 'deck') {
  const failures = [];

  if (!html.includes(EXPECTED_LAYER_ORDER)) {
    failures.push(
      `Missing required layer declaration "${EXPECTED_LAYER_ORDER}" so canvas remains highest priority.`
    );
  }

  if (INLINE_STYLE_RE.test(html)) {
    failures.push('Inline style attributes are not allowed because they bypass the framework layers.');
  }

  for (const match of html.matchAll(STYLE_BLOCK_RE)) {
    const css = match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!css) continue;
    if (!css.startsWith('@layer')) {
      failures.push('All <style> blocks must be wrapped in an explicit @layer rule.');
      break;
    }
  }

  if (failures.length > 0) {
    const details = failures.map((msg) => `- ${msg}`).join('\n');
    throw new Error(`Deck policy violation in ${sourceName}:\n${details}`);
  }
}

export function validateDeckFile(htmlPath) {
  const html = readFileSync(htmlPath, 'utf-8');
  validateDeckSource(html, htmlPath);
}
