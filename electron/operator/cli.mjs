#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import process from 'node:process';

import { ensureOperatorDir, getOperatorSessionId, getOperatorStateFile } from './paths.mjs';

async function ping(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

function readOperatorState(stateFile) {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

async function ensureServer() {
  ensureOperatorDir();
  const sessionId = getOperatorSessionId();
  const stateFile = getOperatorStateFile(sessionId);
  const current = readOperatorState(stateFile);
  if (current?.port && await ping(current.port)) {
    return current;
  }

  rmSync(stateFile, { force: true });
  const child = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url)), '--serve'], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
    env: {
      ...process.env,
      PRESENTATION_OPERATOR_SESSION: sessionId,
    },
  });
  child.unref();

  for (let attempt = 0; attempt < 100; attempt += 1) {
    await delay(100);
    const next = readOperatorState(stateFile);
    if (next?.port && await ping(next.port)) {
      return next;
    }
  }

  throw new Error('Timed out starting Electron operator server.');
}

async function invoke(command, args) {
  const state = command === 'serve' ? null : await ensureServer();
  if (command === 'serve') {
    return { ok: true, result: { message: 'Use --serve directly to run the operator server.' } };
  }

  const response = await fetch(`http://127.0.0.1:${state.port}/command`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ command, args }),
  });
  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Operator command failed: ${command}`);
  }
  return json;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--serve') {
    await new Promise(() => {});
    return;
  }

  const command = args[0] || 'state';
  const result = await invoke(command, args.slice(1));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2)}\n`);
  process.exit(1);
});
