/**
 * server.mjs — Development server with live reload + PDF export
 *
 * Usage: node server.mjs [port]
 *
 * Features:
 *   - Serves HTML files with auto-injected live-reload script
 *   - Watches all files for changes → triggers browser reload via SSE
 *   - POST /api/export { file: "demo.html" } → returns PDF download
 *   - GET / → index page listing all available decks
 *
 * This is the user-facing dev server. Verification agents open their
 * own Playwright sessions separately — they never touch this server.
 */

import express from 'express';
import { readFileSync, existsSync, watch, readdirSync } from 'fs';
import { resolve, basename, extname } from 'path';
import { generatePDF } from './lib/pdf-export.js';
import { validateDeckFile } from './lib/deck-policy.js';

const PORT = parseInt(process.argv[2] || '3000', 10);
const ROOT = import.meta.dirname;

const app = express();
app.use(express.json());

// ─────────────────────────────────────
// Live Reload via Server-Sent Events
// ─────────────────────────────────────

const clients = new Set();
let debounceTimer = null;

// Watch the entire framework directory for changes
watch(ROOT, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  // Ignore noise
  if (
    filename.includes('node_modules') ||
    filename.startsWith('.') ||
    filename.endsWith('.pdf') ||
    filename.endsWith('.DS_Store')
  ) return;

  // Debounce: wait 150ms for rapid saves to settle
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\x1b[36m[${timestamp}] Changed: ${filename}\x1b[0m`);

    for (const client of clients) {
      client.write(`data: ${JSON.stringify({ file: filename, time: timestamp })}\n\n`);
    }
  }, 150);
});

// SSE endpoint — browsers connect here for reload notifications
app.get('/api/live-reload', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  // Send initial heartbeat
  res.write('data: {"connected":true}\n\n');

  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// ─────────────────────────────────────
// Live-reload script injected into HTML
// ─────────────────────────────────────

const LIVE_RELOAD_SCRIPT = `
<!-- Live Reload (dev server only — not included in PDF export) -->
<script>
(function() {
  var dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;bottom:8px;left:8px;width:8px;height:8px;border-radius:50%;z-index:99999;transition:background .3s;';
  dot.title = 'Live reload connected';
  document.body.appendChild(dot);

  var es = new EventSource('/api/live-reload');

  es.onopen = function() {
    dot.style.background = '#4caf50';
  };

  es.onmessage = function(e) {
    var data = JSON.parse(e.data);
    if (data.connected) { dot.style.background = '#4caf50'; return; }
    dot.style.background = '#ff9800';
    console.log('[live-reload] ' + data.file + ' changed, reloading...');
    setTimeout(function() { location.reload(); }, 100);
  };

  es.onerror = function() {
    dot.style.background = '#f44336';
    dot.title = 'Live reload disconnected';
  };
})();
</script>
`;

// ─────────────────────────────────────
// HTML serving with script injection
// ─────────────────────────────────────

app.get('/', (req, res) => {
  // Index page — list all available decks
  const htmlFiles = readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .sort();

  const links = htmlFiles
    .map((f) => `      <li><a href="/${f}">${f}</a></li>`)
    .join('\n');

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pitch Framework</title>
  <style>
    body { font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 4rem auto; color: #1d1d1f; }
    h1 { font-size: 1.8rem; font-weight: 800; }
    ul { list-style: none; padding: 0; margin-top: 1.5rem; }
    li { margin: 0.5rem 0; }
    a { color: #b71c1c; text-decoration: none; font-size: 1.1rem; font-weight: 600; }
    a:hover { text-decoration: underline; }
    .hint { color: #888; font-size: 0.85rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Pitch Framework</h1>
  <p>Available decks:</p>
  <ul>
${links}
  </ul>
  <p class="hint">Live reload is active. Edit any file and the browser will refresh automatically.</p>
${LIVE_RELOAD_SCRIPT}
</body>
</html>`);
});

// Serve any .html file with live-reload injected
app.get('/:file.html', (req, res) => {
  const safeName = basename(req.params.file + '.html');
  const filePath = resolve(ROOT, safeName);

  if (!existsSync(filePath)) {
    return res.status(404).send('Not found: ' + safeName);
  }

  try {
    validateDeckFile(filePath);
  } catch (err) {
    return res.status(400).type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Deck Policy Violation</title>
  <style>
    body { font-family: Inter, -apple-system, sans-serif; max-width: 760px; margin: 4rem auto; color: #1d1d1f; }
    pre { white-space: pre-wrap; background: #f5f5f7; padding: 1rem 1.25rem; border-radius: 12px; }
  </style>
</head>
<body>
  <h1>Deck Policy Violation</h1>
  <pre>${String(err.message)}</pre>
</body>
</html>`);
  }

  let html = readFileSync(filePath, 'utf-8');

  // Inject live-reload script before </body>
  if (html.includes('</body>')) {
    html = html.replace('</body>', LIVE_RELOAD_SCRIPT + '\n</body>');
  } else {
    // No </body> tag — append
    html += LIVE_RELOAD_SCRIPT;
  }

  res.type('html').send(html);
});

// Static files for CSS, JS, assets, images (non-HTML)
app.use(express.static(ROOT, {
  index: false, // Don't serve index.html via static — our route handles it
}));

// ─────────────────────────────────────
// PDF export endpoint
// ─────────────────────────────────────

app.post('/api/export', async (req, res) => {
  const file = req.body?.file;
  if (!file || typeof file !== 'string') {
    return res.status(400).json({ error: 'Missing "file" field (e.g. "demo.html")' });
  }

  const safeName = basename(file);
  if (extname(safeName) !== '.html') {
    return res.status(400).json({ error: 'Only .html files are allowed' });
  }

  const htmlPath = resolve(ROOT, safeName);
  if (!existsSync(htmlPath)) {
    return res.status(404).json({ error: `File not found: ${safeName}` });
  }

  console.log(`\x1b[33mExporting: ${safeName}\x1b[0m`);

  try {
    const pdfBuffer = await generatePDF(htmlPath);
    const outputName = safeName.replace(/\.html$/, '.pdf');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${outputName}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
    console.log(`\x1b[32mExported: ${outputName} (${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB)\x1b[0m`);
  } catch (err) {
    console.error('Export failed:', err);
    res.status(500).json({ error: 'PDF export failed', detail: err.message });
  }
});

// ─────────────────────────────────────
// Start
// ─────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
\x1b[1mPitch Framework — Dev Server\x1b[0m
\x1b[36m────────────────────────────\x1b[0m

  \x1b[1mIndex:\x1b[0m    http://localhost:${PORT}/
  \x1b[1mExport:\x1b[0m   POST /api/export { "file": "demo.html" }

  \x1b[32mLive reload active\x1b[0m — editing any file triggers browser refresh
  \x1b[90mVerification agents use their own Playwright sessions\x1b[0m
`);
});
