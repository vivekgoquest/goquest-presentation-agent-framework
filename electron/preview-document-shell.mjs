import { DEFAULT_VIEWPORT } from '../framework/runtime/deck-runtime.js';

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
}

function renderSlidesHostHtml(html, viewport = DEFAULT_VIEWPORT) {
  const { width, height } = viewport;

  return `<!DOCTYPE html>
<html lang="en" data-electron-preview-host="slides">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presentation Preview</title>
  <style>
    :root {
      --electron-preview-scale: 1;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
    }

    body {
      display: grid;
      place-items: center;
    }

    #electron-preview-shell {
      width: 100vw;
      height: 100vh;
      display: grid;
      place-items: center;
      overflow: hidden;
      padding: 16px;
    }

    #electron-preview-stage {
      display: block;
      width: ${width}px;
      height: ${height}px;
      border: 0;
      background: transparent;
      zoom: var(--electron-preview-scale);
    }
  </style>
</head>
<body>
  <div id="electron-preview-shell">
    <iframe
      id="electron-preview-stage"
      title="Presentation preview stage"
      srcdoc="${escapeHtmlAttribute(html)}"
    ></iframe>
  </div>
  <script>
    (function () {
      const shell = document.getElementById('electron-preview-shell');
      const stage = document.getElementById('electron-preview-stage');
      const viewportWidth = ${width};
      const viewportHeight = ${height};

      function centerFirstSlide() {
        if (!stage || !stage.contentDocument) {
          return;
        }

        const firstSection = stage.contentDocument.querySelector('section[data-slide]');
        if (!firstSection) {
          return;
        }

        firstSection.scrollIntoView({ behavior: 'auto', block: 'center' });
      }

      function fitPreviewStage() {
        if (!shell) {
          return;
        }

        const scale = Math.min(
          shell.clientWidth / viewportWidth,
          shell.clientHeight / viewportHeight
        );

        document.documentElement.style.setProperty(
          '--electron-preview-scale',
          String(Math.max(scale, 0.1))
        );
      }

      window.addEventListener('resize', fitPreviewStage);
      if (stage) {
        stage.addEventListener('load', () => {
          fitPreviewStage();
          centerFirstSlide();
        });
      }
      fitPreviewStage();
    })();
  </script>
</body>
</html>`;
}

export function renderElectronPreviewHtml(html, kind = 'slides') {
  if (typeof html !== 'string' || html.length === 0) {
    return html;
  }

  if (kind !== 'slides') {
    return html;
  }

  return renderSlidesHostHtml(html);
}
