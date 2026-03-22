import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { createProjectAgentLauncher } from '../agent-launcher.mjs';

test('project-mode agent launcher runs inside the project root and does not widen write scope to the framework repo', async () => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-agent-launcher-'));
  const spawns = [];
  mkdirSync(resolve(projectRoot, '.claude', 'skills', 'review-deck'), { recursive: true });
  writeFileSync(resolve(projectRoot, '.claude', 'CLAUDE.md'), '# contract\n');
  writeFileSync(resolve(projectRoot, '.claude', 'skills', 'review-deck', 'SKILL.md'), '# skill\n');

  const launcher = createProjectAgentLauncher({
    frameworkRoot: '/framework-root',
    preferredVendor: 'claude',
    commandAvailabilityResolver() {
      return true;
    },
    spawnImpl(command, args, options) {
      spawns.push({ command, args, options });
      return {
        stdout: {
          setEncoding() {},
          on(event, handler) {
            if (event === 'data') {
              setTimeout(() => handler('ok\n'), 0);
            }
          },
        },
        stderr: {
          setEncoding() {},
          on() {},
        },
        on(event, handler) {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        },
      };
    },
  });

  const result = await launcher.invoke('review_presentation', {
    target: { projectRootAbs: projectRoot },
    meta: { projectRoot },
    terminalService: { writeSystemOutput() {} },
  });

  rmSync(projectRoot, { recursive: true, force: true });

  assert.equal(result.status, 'pass');
  assert.equal(spawns.length, 1);
  assert.equal(spawns[0].options.cwd, projectRoot);
  assert.ok(spawns[0].args.includes('--add-dir'));
  assert.equal(
    spawns[0].args[spawns[0].args.indexOf('--add-dir') + 1],
    projectRoot
  );
  assert.ok(!spawns[0].args.includes('/framework-root'));
});
