// Kai-san Chat — File Explorer Component (PURE + DOM)
// Features: drive selector, bookmarks (relative-path persistence), path bar, Tab completion

document.addEventListener('DOMContentLoaded', () => {
  const pathInput = document.getElementById('explorer-path');
  const listEl = document.getElementById('explorer-list');
  const statusEl = document.getElementById('explorer-status');
  const completionsEl = document.getElementById('explorer-completions');
  const upBtn = document.getElementById('explorer-up');
  const goBtn = document.getElementById('explorer-go');
  const bookmarkBtn = document.getElementById('explorer-bookmark');
  const drivesEl = document.getElementById('explorer-drives');
  const bookmarksEl = document.getElementById('explorer-bookmarks');
  if (!pathInput) return;

  let currentPath = '';
  let history = [];
  let completionItems = [];
  let completionIndex = -1;
  let drives = [];
  let bookmarks = [];

  // ===== PURE FUNCTIONS =====

  function normPath(p) {
    return p.replace(/\//g, '\\');
  }

  function parentDir(p) {
    const parts = normPath(p).replace(/\\$/, '').split('\\');
    if (parts.length <= 1) return p;
    parts.pop();
    return parts.join('\\') || parts[0] + '\\';
  }

  function fileIcon(name, isDir) {
    if (isDir) return '\uD83D\uDCC1';
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
      md: '\uD83D\uDCC4', txt: '\uD83D\uDCC4', log: '\uD83D\uDCC4',
      js: '\uD83D\uDFE8', ts: '\uD83D\uDD35', py: '\uD83D\uDFE2',
      html: '\uD83C\uDF10', css: '\uD83C\uDFA8', json: '\u2699\uFE0F',
      xlsx: '\uD83D\uDCCA', xls: '\uD83D\uDCCA', csv: '\uD83D\uDCCA',
      pdf: '\uD83D\uDCD5', doc: '\uD83D\uDCD8', docx: '\uD83D\uDCD8',
      pptx: '\uD83D\uDCDD', png: '\uD83D\uDDBC\uFE0F', jpg: '\uD83D\uDDBC\uFE0F',
      svg: '\uD83D\uDDBC\uFE0F', gif: '\uD83D\uDDBC\uFE0F',
      zip: '\uD83D\uDCE6', exe: '\u26A1', bat: '\u26A1', sh: '\u26A1',
      duckdb: '\uD83E\uDD86',
    };
    return icons[ext] || '\uD83D\uDCC4';
  }

  function currentDrive(p) {
    const m = normPath(p).match(/^([A-Z]):/i);
    return m ? m[1].toUpperCase() + ':' : '';
  }

  // ===== API FUNCTIONS =====

  async function loadDir(dirPath) {
    dirPath = normPath(dirPath);
    pathInput.value = dirPath;
    statusEl.textContent = 'Loading...';
    hideCompletions();
    try {
      const r = await fetch('/api/fs?path=' + encodeURIComponent(dirPath));
      const data = await r.json();
      if (data.error) {
        statusEl.textContent = 'Error: ' + data.error;
        return;
      }
      currentPath = data.path;
      pathInput.value = currentPath;
      renderList(data.items);
      statusEl.textContent = data.items.length + ' items';
      if (!history.length || history[history.length - 1] !== currentPath) {
        history.push(currentPath);
      }
      updateDriveHighlight();
      updateBookmarkBtn();
    } catch (e) {
      statusEl.textContent = 'Connection error';
    }
  }

  async function fetchCompletions(partial) {
    partial = normPath(partial);
    try {
      const r = await fetch('/api/fs/complete?partial=' + encodeURIComponent(partial));
      const data = await r.json();
      return data.matches || [];
    } catch (e) { return []; }
  }

  async function fetchDrives() {
    try {
      const r = await fetch('/api/fs/drives');
      const data = await r.json();
      drives = data.drives || [];
      renderDrives();
    } catch (e) { /* silent */ }
  }

  async function fetchBookmarks() {
    try {
      const r = await fetch('/api/fs/bookmarks');
      bookmarks = await r.json();
      renderBookmarks();
    } catch (e) { /* silent */ }
  }

  async function addBookmark(absPath) {
    try {
      await fetch('/api/fs/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: absPath }),
      });
      await fetchBookmarks();
      updateBookmarkBtn();
      statusEl.textContent = 'Bookmarked: ' + absPath;
    } catch (e) { /* silent */ }
  }

  async function removeBookmark(storedPath) {
    try {
      await fetch('/api/fs/bookmarks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: storedPath }),
      });
      await fetchBookmarks();
      updateBookmarkBtn();
    } catch (e) { /* silent */ }
  }

  // ===== DOM: RENDER =====

  function renderDrives() {
    drivesEl.textContent = '';
    drives.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'drive-btn';
      btn.textContent = d;
      btn.title = d + '\\';
      btn.addEventListener('click', () => loadDir(d + '\\'));
      drivesEl.appendChild(btn);
    });
  }

  function updateDriveHighlight() {
    const cur = currentDrive(currentPath);
    drivesEl.querySelectorAll('.drive-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent === cur);
    });
  }

  function renderBookmarks() {
    bookmarksEl.textContent = '';
    bookmarksEl.classList.toggle('has-items', bookmarks.length > 0);
    bookmarks.forEach(bm => {
      const chip = document.createElement('div');
      chip.className = 'bookmark-chip';
      chip.title = bm.absolute;

      const label = document.createElement('span');
      label.className = 'bm-label';
      label.textContent = bm.label;

      const remove = document.createElement('span');
      remove.className = 'bm-remove';
      remove.textContent = '\u00D7';
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        removeBookmark(bm.path);
      });

      chip.appendChild(label);
      chip.appendChild(remove);
      chip.addEventListener('click', () => loadDir(bm.absolute));
      bookmarksEl.appendChild(chip);
    });
  }

  function updateBookmarkBtn() {
    const isBookmarked = bookmarks.some(b => b.absolute === currentPath);
    bookmarkBtn.textContent = isBookmarked ? '\u2605' : '\u2606';
    bookmarkBtn.classList.toggle('bookmarked', isBookmarked);
  }

  function renderList(items) {
    listEl.textContent = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'explorer-empty';
      empty.textContent = 'Empty directory';
      listEl.appendChild(empty);
      return;
    }
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'explorer-row' + (item.isDir ? ' is-dir' : '');
      row.tabIndex = 0;

      const icon = document.createElement('span');
      icon.className = 'explorer-icon';
      icon.textContent = fileIcon(item.name, item.isDir);

      const name = document.createElement('span');
      name.className = 'explorer-name';
      name.textContent = item.name;

      const fullPath = currentPath + (currentPath.endsWith('\\') ? '' : '\\') + item.name;

      row.appendChild(icon);
      row.appendChild(name);

      row.addEventListener('dblclick', () => {
        if (item.isDir) { loadDir(fullPath); }
        else { copyToClipboard(fullPath); statusEl.textContent = 'Copied: ' + fullPath; }
      });

      row.addEventListener('click', () => {
        listEl.querySelectorAll('.explorer-row.selected').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        pathInput.value = fullPath;
      });

      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (item.isDir) loadDir(fullPath);
          else { copyToClipboard(fullPath); statusEl.textContent = 'Copied: ' + fullPath; }
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); const next = row.nextElementSibling; if (next) next.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); const prev = row.previousElementSibling; if (prev) prev.focus(); }
      });

      listEl.appendChild(row);
    });
  }

  // ===== CLIPBOARD =====

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  // ===== COMPLETIONS =====

  function showCompletions(matches) {
    completionItems = matches;
    completionIndex = -1;
    completionsEl.textContent = '';
    if (!matches.length) { completionsEl.style.display = 'none'; return; }
    completionsEl.style.display = 'block';
    matches.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'completion-item';
      row.textContent = (m.isDir ? '\uD83D\uDCC1 ' : '\uD83D\uDCC4 ') + m.name;
      row.addEventListener('click', () => {
        pathInput.value = m.full + (m.isDir ? '\\' : '');
        hideCompletions();
        if (m.isDir) loadDir(m.full);
      });
      completionsEl.appendChild(row);
    });
  }

  function hideCompletions() {
    completionsEl.style.display = 'none';
    completionsEl.textContent = '';
    completionItems = [];
    completionIndex = -1;
  }

  function highlightCompletion(idx) {
    const items = completionsEl.querySelectorAll('.completion-item');
    items.forEach((el, i) => el.classList.toggle('active', i === idx));
    if (idx >= 0 && idx < completionItems.length) {
      pathInput.value = completionItems[idx].full + (completionItems[idx].isDir ? '\\' : '');
    }
  }

  // ===== EVENTS =====

  pathInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (completionsEl.style.display === 'block' && completionItems.length) {
        completionIndex = (completionIndex + 1) % completionItems.length;
        highlightCompletion(completionIndex);
      } else {
        const matches = await fetchCompletions(pathInput.value);
        if (matches.length === 1) {
          pathInput.value = matches[0].full + (matches[0].isDir ? '\\' : '');
          hideCompletions();
          if (matches[0].isDir) loadDir(matches[0].full);
        } else {
          showCompletions(matches);
        }
      }
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); hideCompletions(); loadDir(pathInput.value); return; }
    if (e.key === 'Escape') { hideCompletions(); pathInput.value = currentPath; return; }
    if (completionsEl.style.display === 'block') {
      if (e.key === 'ArrowDown') { e.preventDefault(); completionIndex = Math.min(completionIndex + 1, completionItems.length - 1); highlightCompletion(completionIndex); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); completionIndex = Math.max(completionIndex - 1, 0); highlightCompletion(completionIndex); return; }
    }
    if (completionsEl.style.display === 'block' && e.key.length === 1) { hideCompletions(); }
  });

  // Ctrl+Alt+C = copy current path
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      const pathToCopy = pathInput.value || currentPath;
      if (pathToCopy) {
        copyToClipboard(pathToCopy);
        statusEl.textContent = 'Copied: ' + pathToCopy;
        pathInput.classList.add('copied');
        setTimeout(() => pathInput.classList.remove('copied'), 500);
      }
    }
  });

  // Up button / Alt+Up
  upBtn.addEventListener('click', () => {
    if (currentPath) loadDir(parentDir(currentPath));
  });
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowUp' && document.getElementById('tab-explorer').classList.contains('active')) {
      e.preventDefault();
      if (currentPath) loadDir(parentDir(currentPath));
    }
  });

  // Go button
  goBtn.addEventListener('click', () => { hideCompletions(); loadDir(pathInput.value); });

  // Bookmark button — toggle
  bookmarkBtn.addEventListener('click', () => {
    if (!currentPath) return;
    const existing = bookmarks.find(b => b.absolute === currentPath);
    if (existing) { removeBookmark(existing.path); }
    else { addBookmark(currentPath); }
  });

  // Click outside completions
  document.addEventListener('click', (e) => {
    if (!completionsEl.contains(e.target) && e.target !== pathInput) { hideCompletions(); }
  });

  // ===== INIT =====

  let initialized = false;
  const observer = new MutationObserver(() => {
    if (!initialized && document.getElementById('tab-explorer').classList.contains('active')) {
      initialized = true;
      fetchDrives();
      fetchBookmarks();
      loadDir('C:\\Users');
    }
  });
  observer.observe(document.getElementById('tab-explorer'), { attributes: true, attributeFilter: ['class'] });
});
