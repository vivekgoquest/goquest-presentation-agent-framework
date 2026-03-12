import { basename } from 'path';
import { captureDeck } from './deck-capture.mjs';

const htmlFile = process.argv[2] || 'demo.html';
const outputDir = process.argv[3] || `/tmp/deck-check-${basename(htmlFile, '.html')}-${Date.now()}`;

try {
  const report = await captureDeck(htmlFile, outputDir);
  const failures = [];

  if (report.slideCount === 0) {
    failures.push('No slides were discovered.');
  }
  if (report.consoleErrors.length > 0) {
    failures.push(`Browser console errors: ${report.consoleErrors.length}`);
  }
  if (report.consistency.slidesWithOverflow.length > 0) {
    failures.push(`Overflow detected on slides: ${report.consistency.slidesWithOverflow.join(', ')}`);
  }

  console.log('\n--- CHECK ---');
  console.log(JSON.stringify({
    file: report.file,
    outputDir: report.outputDir,
    slideCount: report.slideCount,
    consoleErrors: report.consoleErrors.length,
    overflowSlides: report.consistency.slidesWithOverflow,
    status: failures.length === 0 ? 'pass' : 'fail',
  }, null, 2));

  if (failures.length > 0) {
    console.error('\nCheck failed:');
    failures.forEach((msg) => console.error(`- ${msg}`));
    process.exit(1);
  }
} catch (err) {
  console.error('Check failed:', err.message);
  process.exit(1);
}
