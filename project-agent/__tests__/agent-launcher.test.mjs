import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { createProjectAgentLauncher } from '../agent-launcher.mjs';

test('project-mode agent launcher runs inside the project root and does not widen write scope to the framework repo', async () => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-agent-launcher-'));
  const spawns = [];
  writeFileSync(resolve(projectRoot, 'AGENTS.md'), '# project contract\n');
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

  const prompt = spawns[0].args.at(-1);
  const projectAgentsIndex = prompt.indexOf(resolve(projectRoot, 'AGENTS.md'));
  const adapterIndex = prompt.indexOf(resolve(projectRoot, '.claude', 'CLAUDE.md'));
  const skillIndex = prompt.indexOf(resolve(projectRoot, '.claude', 'skills', 'review-deck', 'SKILL.md'));
  assert.notEqual(projectAgentsIndex, -1);
  assert.notEqual(adapterIndex, -1);
  assert.notEqual(skillIndex, -1);
  assert.ok(projectAgentsIndex < adapterIndex);
  assert.ok(adapterIndex < skillIndex);
});

test('project-mode agent launcher falls back to the Claude adapter when legacy projects do not have AGENTS.md yet', async () => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-agent-launcher-legacy-'));
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
  const prompt = spawns[0].args.at(-1);
  assert.equal(prompt.includes(resolve(projectRoot, 'AGENTS.md')), false);
  assert.ok(prompt.includes(resolve(projectRoot, '.claude', 'CLAUDE.md')));
});

test('project-mode agent launcher appends application-prepared workflow context without owning the workflow itself', async () => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-agent-launcher-workflow-'));
  const spawns = [];
  writeFileSync(resolve(projectRoot, 'AGENTS.md'), '# project contract\n');
  mkdirSync(resolve(projectRoot, '.claude', 'skills', 'fix-warnings'), { recursive: true });
  writeFileSync(resolve(projectRoot, '.claude', 'CLAUDE.md'), '# contract\n');
  writeFileSync(resolve(projectRoot, '.claude', 'skills', 'fix-warnings', 'SKILL.md'), '# skill\n');

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

  const result = await launcher.invoke('fix_warnings', {
    target: { projectRootAbs: projectRoot },
    meta: { projectRoot },
    terminalService: { writeSystemOutput() {} },
    workflow: {
      prompt: [
        'Canonical workflow context prepared by the application layer.',
        'Current quality warnings:',
        '- [layout-variety] slide-02: repeated layout',
      ].join('\n'),
    },
  });

  rmSync(projectRoot, { recursive: true, force: true });

  assert.equal(result.status, 'pass');
  const prompt = spawns[0].args.at(-1);
  assert.match(prompt, /application-prepared workflow context below as the canonical workflow definition/i);
  assert.doesNotMatch(prompt, /Treat those files as the source of truth for the workflow\./);
  assert.match(prompt, /Canonical workflow context prepared by the application layer\./);
  assert.match(prompt, /Current quality warnings:/);
});
