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

export function renderPolicyErrorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Presentation needs attention</title>
  <style>
    body { font-family: "Aptos", "Inter", "Segoe UI", sans-serif; max-width: 760px; margin: 4rem auto; color: #1d1d1f; padding: 0 1.5rem; }
    pre { white-space: pre-wrap; background: #f5f5f7; padding: 1rem 1.25rem; border-radius: 12px; }
    p { line-height: 1.6; color: #4b5563; }
    .eyebrow { display: inline-block; padding: 0.35rem 0.7rem; border-radius: 999px; background: #eef4ff; color: #2563eb; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
  </style>
</head>
<body>
  <span class="eyebrow">Needs attention</span>
  <h1>This presentation needs a quick fix</h1>
  <p>Ask the assistant to fix the issue below, then reload the preview.</p>
  <pre>${escapeHtml(message)}</pre>
</body>
</html>`;
}

function getFriendlyNextStep(state) {
  if (!state.briefComplete) {
    return 'Ask the assistant to turn your idea into the first presentation brief.';
  }

  if (state.outlineRequired && !state.outlineComplete) {
    return 'Ask the assistant to sketch the story arc before it fills the slides.';
  }

  if (state.remainingSlides.length > 0) {
    return 'Ask the assistant to finish the remaining slide drafts so the presentation can come together.';
  }

  if (state.status === 'policy_error') {
    return 'Ask the assistant to fix the current presentation issue.';
  }

  return 'Ask the assistant to keep building the presentation.';
}

export function renderProjectOnboardingPage(state) {
  const outlineRow = state.outlineRequired
    ? `<li><strong>Story outline</strong><span>${state.outlineComplete ? 'Ready' : 'Waiting for a first pass'}</span></li>`
    : '';
  const slideStatus = state.remainingSlides.length > 0
    ? `${state.remainingSlides.length} slide${state.remainingSlides.length === 1 ? '' : 's'} still waiting for a first draft`
    : 'Every slide has a first draft';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(state.title)} • Presentation in progress</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111e;
      --panel: rgba(17, 28, 45, 0.92);
      --line: rgba(173, 189, 217, 0.18);
      --text: #eef4ff;
      --muted: #a2b3ce;
      --accent: #7bb7ff;
      --chip: rgba(123, 183, 255, 0.14);
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
      width: min(860px, calc(100vw - 3rem));
      padding: 2rem;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(22, 34, 53, 0.96), var(--panel));
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
    }

    h1 {
      margin: 0.25rem 0 0;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1.02;
    }

    p {
      margin: 0;
      line-height: 1.6;
      color: var(--muted);
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.4rem 0.72rem;
      border-radius: 999px;
      background: var(--chip);
      border: 1px solid rgba(123, 183, 255, 0.18);
      color: var(--accent);
      font-size: 0.82rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .lede {
      margin-top: 1rem;
      max-width: 60ch;
      font-size: 1.02rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .card {
      padding: 1rem 1.1rem;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.03);
    }

    .card strong {
      display: block;
      margin-bottom: 0.28rem;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }

    .card span {
      font-size: 1.18rem;
      font-weight: 700;
    }

    .checklist {
      list-style: none;
      padding: 0;
      margin: 1.65rem 0 0;
      display: grid;
      gap: 0.8rem;
    }

    .checklist li {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.88rem 1rem;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.02);
    }

    .checklist li span {
      color: var(--muted);
      text-align: right;
    }

    .next-step {
      margin-top: 1.4rem;
      padding: 1rem 1.1rem;
      border-radius: 16px;
      background: rgba(123, 183, 255, 0.1);
      border: 1px solid rgba(123, 183, 255, 0.2);
    }

    .next-step strong {
      display: block;
      margin-bottom: 0.35rem;
      font-size: 0.8rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }

    code {
      padding: 0.14rem 0.42rem;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
    }
  </style>
</head>
<body>
  <main>
    <span class="eyebrow">Presentation in progress</span>
    <h1>${escapeHtml(state.title)} is still taking shape</h1>
    <p class="lede">Nothing is broken. The assistant is still turning the starter files into a real presentation, so this preview will fill in as the draft comes together.</p>

    <div class="grid">
      <div class="card">
        <strong>Progress</strong>
        <span>${state.slidesComplete}/${state.slidesTotal} slides ready</span>
      </div>
      <div class="card">
        <strong>Slides left</strong>
        <span>${Math.max(0, state.slidesTotal - state.slidesComplete)}</span>
      </div>
      <div class="card">
        <strong>PDF</strong>
        <span>${state.pdfReady ? 'Ready to export' : 'Will appear later'}</span>
      </div>
    </div>

    <ul class="checklist">
      <li><strong>Brief</strong><span>${state.briefComplete ? 'Ready' : 'Waiting for your first request'}</span></li>
      ${outlineRow}
      <li><strong>Slides</strong><span>${escapeHtml(slideStatus)}</span></li>
      <li><strong>Export</strong><span>${state.pdfReady ? 'PDF is ready' : 'Not ready yet'}</span></li>
    </ul>

    <div class="next-step">
      <strong>What to do next</strong>
      <p>${escapeHtml(getFriendlyNextStep(state))}</p>
    </div>
  </main>
</body>
</html>`;
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
