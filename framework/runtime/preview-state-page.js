import { createPresentationTarget } from './deck-paths.js';
import { classifyPolicyErrorMessage, getProjectState } from './project-state.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getPolicyErrorSummary(message) {
  const lines = String(message || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bullet = lines.find((line) => line.startsWith('- '));
  if (bullet) {
    return bullet.replace(/^-\s*/, '');
  }

  return lines[0] || 'Fix the issue in the shell, then the preview will return.';
}

function renderPreviewPlaceholderPage({
  title,
  eyebrow,
  lede = '',
  cardLabel,
  cardTitle,
  cardBody,
  cardHint = '',
  tone = 'accent',
} = {}) {
  const isWarning = tone === 'warning';
  const chipBackground = isWarning ? 'rgba(255, 184, 77, 0.14)' : 'rgba(123, 183, 255, 0.14)';
  const chipBorder = isWarning ? 'rgba(255, 184, 77, 0.22)' : 'rgba(123, 183, 255, 0.18)';
  const chipColor = isWarning ? '#ffcf7a' : '#7bb7ff';
  const stageGlow = isWarning ? 'rgba(255, 184, 77, 0.12)' : 'rgba(123, 183, 255, 0.12)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111e;
      --panel: rgba(17, 28, 45, 0.92);
      --line: rgba(173, 189, 217, 0.18);
      --text: #eef4ff;
      --muted: #a2b3ce;
      --accent: ${chipColor};
      --chip: ${chipBackground};
      --chip-border: ${chipBorder};
      --stage: rgba(9, 18, 31, 0.92);
      --stage-glow: ${stageGlow};
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem;
      font-family: "Aptos", "Inter", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(123, 183, 255, 0.22), transparent 26%),
        linear-gradient(180deg, #060e19 0%, var(--bg) 100%);
      color: var(--text);
    }

    main {
      width: min(980px, calc(100vw - 3rem));
      display: grid;
      gap: 1.1rem;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 0.4rem 0.72rem;
      border-radius: 999px;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      color: var(--accent);
      font-size: 0.82rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    p {
      margin: 0;
      line-height: 1.6;
      color: var(--muted);
    }

    .preview-shell {
      border: 1px solid var(--line);
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(22, 34, 53, 0.96), var(--panel));
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
      padding: 1.25rem;
    }

    .preview-stage {
      aspect-ratio: 16 / 9;
      border-radius: 18px;
      border: 1px solid rgba(173, 189, 217, 0.16);
      background:
        linear-gradient(180deg, rgba(15, 27, 45, 0.9), rgba(8, 16, 29, 0.96)),
        var(--stage);
      display: grid;
      place-items: center;
      overflow: hidden;
      position: relative;
    }

    .preview-stage::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at top left, var(--stage-glow), transparent 28%);
      pointer-events: none;
    }

    .placeholder {
      position: relative;
      z-index: 1;
      width: min(72%, 760px);
      padding: 2rem;
      border-radius: 22px;
      border: 1px solid rgba(173, 189, 217, 0.14);
      background: rgba(255, 255, 255, 0.04);
      text-align: left;
    }

    .placeholder strong {
      display: inline-block;
      margin-bottom: 0.9rem;
      padding: 0.34rem 0.64rem;
      border-radius: 999px;
      background: var(--chip);
      color: var(--accent);
      font-size: 0.76rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .placeholder h2 {
      margin: 0 0 0.75rem;
      font-size: clamp(1.6rem, 3vw, 2.3rem);
      line-height: 1.06;
    }

    .placeholder p + p {
      margin-top: 0.75rem;
    }

    .hint {
      margin-top: 0.9rem;
      font-size: 0.96rem;
      color: var(--text);
    }
  </style>
</head>
<body>
  <main>
    <section class="preview-shell" aria-label="Preview placeholder">
      <span class="eyebrow">${escapeHtml(eyebrow)}</span>
      ${lede ? `<p>${escapeHtml(lede)}</p>` : ''}
      <div class="preview-stage">
        <div class="placeholder">
          <strong>${escapeHtml(cardLabel)}</strong>
          <h2>${escapeHtml(cardTitle)}</h2>
          <p>${escapeHtml(cardBody)}</p>
          ${cardHint ? `<p class="hint">${escapeHtml(cardHint)}</p>` : ''}
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

export function renderPolicyErrorPage(message) {
  return renderPreviewPlaceholderPage({
    title: 'Preview blocked',
    eyebrow: 'Preview blocked',
    cardLabel: 'Preview',
    cardTitle: 'Preview unavailable',
    cardBody: getPolicyErrorSummary(message),
    cardHint: 'Fix the issue in the shell, then the preview will return.',
    tone: 'warning',
  });
}

function getFriendlyNextStep(state) {
  if (!state.briefComplete) {
    return 'Use the terminal to turn your idea into the first brief.';
  }

  if (state.outlineRequired && !state.outlineComplete) {
    return 'Use the terminal to sketch the story arc before the slides fill in.';
  }

  if (state.remainingSlides.length > 0) {
    return 'Use the terminal to finish the remaining slide drafts.';
  }

  if (state.status === 'policy_error') {
    return 'Use the terminal to fix the current presentation issue.';
  }

  return 'Use the terminal to keep building the presentation.';
}

export function renderProjectOnboardingPage(state) {
  return renderPreviewPlaceholderPage({
    title: `${state.title} preview`,
    eyebrow: 'Draft preview',
    cardLabel: 'Preview',
    cardTitle: 'Your slides will appear here.',
    cardBody: 'This area stays quiet until the presentation has something to render.',
    cardHint: getFriendlyNextStep(state),
  });
}

export function renderPresentationFailureHtml(targetInput, error) {
  const target = createPresentationTarget(targetInput);
  const message = error?.message || 'Deck policy violation.';

  if (target.kind === 'project') {
    const category = classifyPolicyErrorMessage(message);
    if (category.startsWith('incomplete_')) {
      const state = getProjectState(target.projectRootAbs);
      return {
        kind: 'onboarding',
        html: renderProjectOnboardingPage(state),
      };
    }
  }

  return {
    kind: 'policy_error',
    html: renderPolicyErrorPage(message),
  };
}
