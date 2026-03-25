import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const OPERATOR_DIR = join(tmpdir(), 'presentation-framework-electron-operator');
export const DEFAULT_OPERATOR_SESSION = 'default';

export function ensureOperatorDir() {
  mkdirSync(OPERATOR_DIR, { recursive: true });
  return OPERATOR_DIR;
}

export function normalizeOperatorSessionId(sessionId = DEFAULT_OPERATOR_SESSION) {
  const normalized = String(sessionId || DEFAULT_OPERATOR_SESSION).trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
  return normalized || DEFAULT_OPERATOR_SESSION;
}

export function getOperatorSessionId() {
  return normalizeOperatorSessionId(process.env.PRESENTATION_OPERATOR_SESSION || DEFAULT_OPERATOR_SESSION);
}

export function getOperatorStateFile(sessionId = getOperatorSessionId()) {
  return join(OPERATOR_DIR, `${normalizeOperatorSessionId(sessionId)}.json`);
}

export const OPERATOR_STATE_FILE = getOperatorStateFile();
