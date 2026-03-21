import { createRuntimeApp } from './runtime-app.js';
import { parsePresentationTargetCliArgs } from './deck-paths.js';

function parseArgs(argv) {
  let port = null;
  const passthrough = [];

  for (const arg of argv) {
    if (!arg.startsWith('--') && /^\d+$/.test(arg) && port === null) {
      port = Number.parseInt(arg, 10);
      continue;
    }
    passthrough.push(arg);
  }

  const parsed = parsePresentationTargetCliArgs(passthrough);
  return {
    target: parsed.target,
    port: port ?? 0,
  };
}

let parsed;
try {
  parsed = parseArgs(process.argv.slice(2));
} catch (err) {
  console.error(`Usage: npm run debug:preview -- --project /abs/path [port]\n\n${err.message}`);
  process.exit(1);
}

const host = '127.0.0.1';
const app = createRuntimeApp({
  currentTarget: parsed.target,
});
const server = app.listen(parsed.port, host, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : parsed.port;
  console.log(`Debug preview URL: http://${host}:${port}/preview/`);
  console.log('Press Ctrl+C to stop.');
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
