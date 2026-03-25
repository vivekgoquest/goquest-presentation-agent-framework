import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveActionUiModel,
  deriveProjectUiModel,
  deriveTerminalUiModel,
  formatTerminalOutputEvent,
  normalizeRuntimeActionResult,
} from '../ui-model.js';

test('deriveProjectUiModel keeps the main shell minimal during onboarding', () => {
  const model = deriveProjectUiModel({
    meta: { active: true },
    projectState: {
      status: 'onboarding',
      nextStep: 'Complete brief.md with the normalized user request.',
      slidesComplete: 0,
      slidesTotal: 3,
      briefComplete: false,
      outlineRequired: false,
      outlineComplete: true,
      pdfReady: false,
      lastPolicyError: 'Deck policy violation in brief.md',
    },
  });

  assert.equal(model.hasProject, true);
  assert.equal(model.actions.validate.enabled, true);
  assert.equal(model.actions.export.enabled, false);
  assert.equal(model.preview.showChrome, false);
  assert.equal(model.status.visible, false);
});

test('deriveProjectUiModel keeps advanced actions available when project is ready', () => {
  const model = deriveProjectUiModel({
    meta: { active: true },
    projectState: {
      status: 'ready_to_finalize',
      nextStep: 'Run finalize to generate the deck outputs.',
      slidesComplete: 3,
      slidesTotal: 3,
      briefComplete: true,
      outlineRequired: false,
      outlineComplete: true,
      pdfReady: false,
      lastPolicyError: '',
    },
  });

  assert.equal(model.actions.validate.enabled, true);
  assert.equal(model.actions.export.enabled, true);
  assert.equal(model.actions.more.enabled, true);
  assert.equal(model.preview.showChrome, false);
  assert.equal(model.status.visible, false);
});

test('normalizeRuntimeActionResult treats fail as error', () => {
  const failure = normalizeRuntimeActionResult('Build', {
    status: 'fail',
    issues: ['Deck policy violation in brief.md'],
  });

  assert.equal(failure.tone, 'error');
  assert.match(failure.message, /failed/i);
  assert.match(failure.detail, /brief\.md/i);
});

test('deriveActionUiModel keeps one primary CTA and moves secondary actions into More', () => {
  const model = deriveActionUiModel({
    meta: { active: true },
    projectState: { status: 'ready_to_finalize' },
    actions: [
      {
        id: 'export_presentation',
        label: 'Export',
        surface: 'primary',
        enabled: true,
        reasonDisabled: '',
      },
      {
        id: 'validate_presentation',
        label: 'Check project',
        surface: 'secondary',
        enabled: true,
        reasonDisabled: '',
      },
      {
        id: 'export_presentation_artifacts',
        label: 'Export files',
        surface: 'dialog',
        enabled: true,
        reasonDisabled: '',
      },
      {
        id: 'capture_screenshots',
        label: 'Capture screenshots',
        surface: 'menu',
        enabled: true,
        reasonDisabled: '',
      },
      {
        id: 'fix_validation_issues',
        label: 'Fix issues',
        surface: 'menu',
        enabled: false,
        reasonDisabled: 'Agent actions are unavailable right now.',
      },
      {
        id: 'review_narrative_presentation',
        label: 'Review writing',
        surface: 'menu',
        enabled: true,
        reasonDisabled: '',
      },
      {
        id: 'apply_narrative_review_changes',
        label: 'Apply writing fixes',
        surface: 'menu',
        enabled: true,
        reasonDisabled: '',
      },
      {
        id: 'review_visual_presentation',
        label: 'Review visuals',
        surface: 'menu',
        enabled: true,
        reasonDisabled: '',
      },
      {
        id: 'apply_visual_review_changes',
        label: 'Apply visual fixes',
        surface: 'menu',
        enabled: true,
        reasonDisabled: '',
      },
    ],
  });

  assert.equal(model.primary?.id, 'export_presentation');
  assert.equal(model.secondary, null);
  assert.deepEqual(
    model.menu.map((action) => action.id),
    [
      'validate_presentation',
      'capture_screenshots',
      'fix_validation_issues',
      'review_narrative_presentation',
      'apply_narrative_review_changes',
      'review_visual_presentation',
      'apply_visual_review_changes',
    ]
  );
  assert.equal(model.menu.find((action) => action.id === 'fix_validation_issues')?.enabled, false);
});

test('deriveActionUiModel promotes check project when export is not ready yet', () => {
  const model = deriveActionUiModel({
    meta: { active: true },
    projectState: { status: 'onboarding' },
    actions: [
      {
        id: 'export_presentation',
        label: 'Export',
        surface: 'primary',
        enabled: false,
        reasonDisabled: 'Not ready yet.',
      },
      {
        id: 'validate_presentation',
        label: 'Check project',
        surface: 'secondary',
        enabled: true,
        reasonDisabled: '',
      },
      {
        id: 'capture_screenshots',
        label: 'Capture screenshots',
        surface: 'menu',
        enabled: true,
        reasonDisabled: '',
      },
    ],
  });

  assert.equal(model.primary?.id, 'validate_presentation');
  assert.equal(model.secondary, null);
  assert.deepEqual(model.menu.map((action) => action.id), ['capture_screenshots']);
});

test('normalizeRuntimeActionResult treats started as success and blocked as error', () => {
  const started = normalizeRuntimeActionResult('Review visuals', {
    status: 'started',
    message: 'Visual review started in the agent terminal.',
  });
  assert.equal(started.tone, 'success');
  assert.match(started.message, /started/i);

  const blocked = normalizeRuntimeActionResult('Apply visual fixes', {
    status: 'blocked',
    message: 'Visual review issue file is missing.',
  });
  assert.equal(blocked.tone, 'error');
  assert.match(blocked.message, /missing/i);
});

test('normalizeRuntimeActionResult preserves explicit detail on successful export actions', () => {
  const result = normalizeRuntimeActionResult('Export', {
    status: 'pass',
    detail: 'Saved 2 PNG files to /tmp/exports',
  });

  assert.equal(result.tone, 'success');
  assert.match(result.message, /completed/i);
  assert.match(result.detail, /Saved 2 PNG files/i);
});

test('formatTerminalOutputEvent dims system output while leaving PTY output untouched', () => {
  const pty = formatTerminalOutputEvent({ data: 'shell output\r\n', source: 'pty' });
  const system = formatTerminalOutputEvent({ data: 'system output\r\n', source: 'system' });

  assert.equal(pty, 'shell output\r\n');
  assert.match(system, /system output/);
  assert.match(system, /\x1b\[90m/);
  assert.match(system, /\x1b\[0m/);
});

test('deriveTerminalUiModel communicates shell states with explicit language', () => {
  const idle = deriveTerminalUiModel({ meta: { alive: false, state: 'idle' } });
  assert.match(idle.detail, /open or create a project/i);
  assert.equal(idle.showRetry, false);

  const running = deriveTerminalUiModel({
    meta: {
      alive: true,
      state: 'running',
      projectRoot: '/tmp/demo',
      cwd: '/tmp/demo/slides/020-slide-02',
      shell: '/bin/zsh',
      loginShell: true,
    },
  });
  assert.match(running.label, /shell open/i);
  assert.match(running.context, /zsh/i);
  assert.match(running.context, /login shell/i);
  assert.match(running.cwdContext, /slides\/020-slide-02/i);
  assert.match(running.detail, /zsh/i);
  assert.match(running.detail, /login shell/i);
  assert.doesNotMatch(running.detail, /\/bin\/zsh/i);

  const interactiveFallback = deriveTerminalUiModel({
    meta: {
      alive: true,
      state: 'running',
      projectRoot: '/tmp/demo',
      cwd: '/opt/workbench',
      shell: '/usr/local/bin/elvish',
      loginShell: false,
      shellIntegration: {
        supported: true,
        commandState: 'failed',
        lastCommandExitCode: 23,
      },
    },
  });
  assert.match(interactiveFallback.context, /elvish/i);
  assert.match(interactiveFallback.detail, /elvish/i);
  assert.match(interactiveFallback.cwdContext, /workbench/i);
  assert.match(interactiveFallback.commandContext, /exit 23/i);
  assert.doesNotMatch(interactiveFallback.context, /login shell/i);
  assert.doesNotMatch(interactiveFallback.detail, /login shell/i);

  const runningCommand = deriveTerminalUiModel({
    meta: {
      alive: true,
      state: 'running',
      projectRoot: '/tmp/demo',
      cwd: '/tmp/demo',
      shell: '/bin/bash',
      loginShell: true,
      shellIntegration: {
        supported: true,
        commandState: 'running',
        lastCommandExitCode: null,
      },
    },
  });
  assert.match(runningCommand.commandContext, /command running/i);

  const stopped = deriveTerminalUiModel({ meta: { alive: false, state: 'stopped' } });
  assert.match(stopped.label, /shell closed/i);
  assert.match(stopped.detail, /open the shell/i);
  assert.equal(stopped.showClear, false);
});
