(function initLauncher() {
  const RECENTS_KEY = 'presentation-framework.recent-projects';
  const MAX_RECENTS = 8;

  const statusNode = document.getElementById('launcher-status');
  const openFolderButton = document.getElementById('open-folder');
  const createPresentationButton = document.getElementById('create-presentation');
  const browseFolderButton = document.getElementById('browse-folder');
  const projectRootInput = document.getElementById('project-root');
  const slideCountInput = document.getElementById('slide-count');
  const copyFrameworkInput = document.getElementById('copy-framework');
  const openExistingButton = document.getElementById('open-existing');
  const createForm = document.getElementById('create-form');
  const recentList = document.getElementById('recent-list');

  function setStatus(message, tone = '') {
    statusNode.textContent = message;
    statusNode.classList.remove('is-error', 'is-good');
    if (tone) {
      statusNode.classList.add(tone);
    }
  }

  async function postJson(url, body = {}) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : { error: await response.text() };

    if (!response.ok) {
      const error = new Error(payload?.error || payload?.detail || `Request failed: ${response.status}`);
      Object.assign(error, payload);
      throw error;
    }

    return payload;
  }

  function loadRecents() {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveRecent(projectRoot) {
    if (!projectRoot) {
      return;
    }

    const next = loadRecents()
      .filter((entry) => entry.projectRoot !== projectRoot);
    next.unshift({
      projectRoot,
      label: projectRoot.split(/[\\/]/).filter(Boolean).pop() || projectRoot,
      lastOpenedAt: new Date().toISOString(),
    });

    localStorage.setItem(RECENTS_KEY, JSON.stringify(next.slice(0, MAX_RECENTS)));
  }

  function renderRecents() {
    const recents = loadRecents();
    recentList.innerHTML = '';

    if (recents.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'recent-empty';
      empty.textContent = 'No recent projects yet.';
      recentList.appendChild(empty);
      return;
    }

    for (const recent of recents) {
      const item = document.createElement('div');
      item.className = 'recent-item';

      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = recent.label || recent.projectRoot;
      const path = document.createElement('span');
      path.textContent = recent.projectRoot;
      copy.append(title, path);

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Open';
      button.addEventListener('click', () => {
        openProject(recent.projectRoot).catch((err) => {
          setStatus(err.message, 'is-error');
        });
      });

      item.append(copy, button);
      recentList.appendChild(item);
    }
  }

  function redirectToWorkspace() {
    window.location.href = '/';
  }

  async function pickFolder() {
    try {
      const payload = await postJson('/api/project/open-dialog');
      if (payload.projectRoot) {
        projectRootInput.value = payload.projectRoot;
      }
      return payload.projectRoot || '';
    } catch (err) {
      if (err.supported === false) {
        setStatus('Native folder browsing is not available here yet. Paste an absolute path instead.', 'is-error');
        return '';
      }

      if (err.cancelled) {
        setStatus('Folder selection cancelled.');
        return '';
      }

      throw err;
    }
  }

  async function openProject(projectRoot) {
    if (!projectRoot) {
      throw new Error('Choose a project folder first.');
    }

    setStatus(`Opening ${projectRoot}…`);
    try {
      await postJson('/api/project/open', { projectRoot });
      saveRecent(projectRoot);
      redirectToWorkspace();
    } catch (err) {
      if (err.needsInitialization) {
        projectRootInput.value = err.projectRoot || projectRoot;
        setStatus('That folder is not a presentation project yet. Initialize it below.');
        return;
      }
      throw err;
    }
  }

  async function createProject(projectRoot) {
    if (!projectRoot) {
      throw new Error('Choose a target folder first.');
    }

    const slides = Number.parseInt(slideCountInput.value || '20', 10);
    const copyFramework = copyFrameworkInput.checked;
    setStatus(`Initializing ${projectRoot}…`);
    await postJson('/api/project/create', {
      projectRoot,
      slides,
      copyFramework,
    });
    saveRecent(projectRoot);
    redirectToWorkspace();
  }

  openFolderButton.addEventListener('click', async () => {
    try {
      const selected = await pickFolder();
      if (selected) {
        await openProject(selected);
      }
    } catch (err) {
      setStatus(err.message, 'is-error');
    }
  });

  browseFolderButton.addEventListener('click', async () => {
    try {
      const selected = await pickFolder();
      if (selected) {
        setStatus(`Selected ${selected}`, 'is-good');
      }
    } catch (err) {
      setStatus(err.message, 'is-error');
    }
  });

  createPresentationButton.addEventListener('click', async () => {
    try {
      const selected = await pickFolder();
      if (selected) {
        setStatus('Folder selected. Review the options below and initialize the project.', 'is-good');
      }
    } catch (err) {
      setStatus(err.message, 'is-error');
    }
  });

  openExistingButton.addEventListener('click', () => {
    openProject(projectRootInput.value.trim()).catch((err) => {
      setStatus(err.message, 'is-error');
    });
  });

  createForm.addEventListener('submit', (event) => {
    event.preventDefault();
    createProject(projectRootInput.value.trim()).catch((err) => {
      setStatus(err.message, 'is-error');
    });
  });

  renderRecents();
})();
