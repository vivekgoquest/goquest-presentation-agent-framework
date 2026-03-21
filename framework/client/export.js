(function initDeckExport() {
  function getPresentationTarget() {
    const projectRoot = document.documentElement.dataset.projectRoot;
    if (!projectRoot) {
      return null;
    }
    return { kind: 'project', projectRoot };
  }

  function getDownloadName(target) {
    const root = target.projectRoot.replace(/[\\/]+$/, '');
    const parts = root.split(/[\\/]/);
    return `${parts[parts.length - 1] || 'presentation'}.pdf`;
  }

  function getStatusNode() {
    return document.getElementById('export-status');
  }

  function setStatus(message) {
    const node = getStatusNode();
    if (node) {
      node.textContent = message;
    }
  }

  async function readErrorMessage(res) {
    const type = res.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      const body = await res.json();
      return body.detail || body.error || 'Export failed';
    }

    return res.text();
  }

  async function exportPDF() {
    const target = getPresentationTarget();
    const button = document.querySelector('[data-export-pdf]');

    if (location.protocol === 'file:') {
      setStatus('Start the preview server before exporting.');
      return;
    }

    if (!target) {
      setStatus('This preview is missing its presentation target.');
      return;
    }

    if (button) {
      button.disabled = true;
    }
    setStatus('Exporting...');

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRoot: target.projectRoot }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      const savedPath = res.headers.get('X-Export-Saved-To') || document.documentElement.dataset.exportSavePath || '';
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getDownloadName(target);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setStatus(savedPath ? `Saved to ${savedPath} and downloaded.` : 'PDF downloaded.');
      window.setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      setStatus(`Export failed: ${err.message}`);
      console.error(err);
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  window.exportPDF = exportPDF;

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-export-pdf]');
    if (button) {
      button.addEventListener('click', exportPDF);
    }
  });
})();
