const FALLBACK_VIEWPORT = { width: 1280, height: 720 };

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
}

function renderSlidesHostHtml(html, viewport = FALLBACK_VIEWPORT) {
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
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
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

        const shellStyle = window.getComputedStyle(shell);
        const horizontalInsets =
          parseFloat(shellStyle.paddingLeft || '0') + parseFloat(shellStyle.paddingRight || '0');
        const verticalInsets =
          parseFloat(shellStyle.paddingTop || '0') + parseFloat(shellStyle.paddingBottom || '0');
        const availableWidth = Math.max(shell.clientWidth - horizontalInsets, 1);
        const availableHeight = Math.max(shell.clientHeight - verticalInsets, 1);

        const scale = Math.min(
          availableWidth / viewportWidth,
          availableHeight / viewportHeight
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

export function renderElectronPreviewHtml(html, options = {}) {
  const kind = typeof options === 'string' ? options : (options.kind || 'slides');
  const viewport = typeof options === 'object' && options
    ? (options.viewport || FALLBACK_VIEWPORT)
    : FALLBACK_VIEWPORT;

  if (typeof html !== 'string' || html.length === 0) {
    return html;
  }

  if (kind !== 'slides') {
    return html;
  }

  return renderSlidesHostHtml(html, viewport);
}
