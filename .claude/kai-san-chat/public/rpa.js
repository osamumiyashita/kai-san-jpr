/**
 * rpa.js — RPA tab frontend (§17-7: separate file)
 * Record browser actions via Playwright codegen, replay, copy FPA to other AI chats
 */
(function () {
  'use strict';

  const TAB = document.getElementById('tab-rpa');
  if (!TAB) return;

  let pollingTimer = null;
  let currentFPA = null; // { name, fpa }

  // ── Build DOM (no innerHTML with user data) ──
  function buildUI() {
    const container = document.createElement('div');
    container.className = 'rpa-container';

    // Title
    const title = document.createElement('div');
    title.className = 'rpa-section-title';
    title.textContent = '🤖 RPA — ブラウザ操作の記録と再生';
    container.appendChild(title);

    // Form
    const form = document.createElement('div');
    form.className = 'rpa-form';
    form.id = 'rpa-form';

    const lbl1 = document.createElement('label');
    lbl1.textContent = '名前（英数字・ハイフン）';
    form.appendChild(lbl1);

    const nameInp = document.createElement('input');
    nameInp.className = 'rpa-input';
    nameInp.id = 'rpa-name';
    nameInp.type = 'text';
    nameInp.placeholder = 'edinet-download';
    nameInp.maxLength = 50;
    form.appendChild(nameInp);

    const lbl2 = document.createElement('label');
    lbl2.textContent = 'URL';
    form.appendChild(lbl2);

    const urlInp = document.createElement('input');
    urlInp.className = 'rpa-input';
    urlInp.id = 'rpa-url';
    urlInp.type = 'url';
    urlInp.placeholder = 'https://example.com';
    form.appendChild(urlInp);

    const row = document.createElement('div');
    row.className = 'rpa-form-row';

    const btnRec = document.createElement('button');
    btnRec.className = 'rpa-btn rpa-btn-record';
    btnRec.id = 'rpa-btn-record';
    btnRec.textContent = '🔴 記録開始';
    row.appendChild(btnRec);

    const btnStp = document.createElement('button');
    btnStp.className = 'rpa-btn rpa-btn-stop';
    btnStp.id = 'rpa-btn-stop';
    btnStp.disabled = true;
    btnStp.textContent = '⏹ 停止';
    row.appendChild(btnStp);

    form.appendChild(row);
    container.appendChild(form);

    // Status
    const status = document.createElement('div');
    status.className = 'rpa-status idle';
    status.id = 'rpa-status';
    const dot = document.createElement('span');
    dot.className = 'rpa-status-dot';
    status.appendChild(dot);
    const stxt = document.createElement('span');
    stxt.id = 'rpa-status-text';
    stxt.textContent = '待機中';
    status.appendChild(stxt);
    container.appendChild(status);

    // List title
    const ltitle = document.createElement('div');
    ltitle.className = 'rpa-section-title';
    ltitle.textContent = '📋 保存済みRPA';
    container.appendChild(ltitle);

    // List container
    const list = document.createElement('div');
    list.className = 'rpa-list';
    list.id = 'rpa-list';
    const empty = document.createElement('div');
    empty.className = 'rpa-empty';
    empty.textContent = 'まだRPAがありません';
    list.appendChild(empty);
    container.appendChild(list);

    // FPA Copy Bar (bottom)
    const fpaBarEl = document.createElement('div');
    fpaBarEl.className = 'rpa-fpa-bar';
    fpaBarEl.id = 'rpa-fpa-bar';

    const fpaHeader = document.createElement('div');
    fpaHeader.className = 'rpa-fpa-bar-header';
    const fpaTitle = document.createElement('span');
    fpaTitle.className = 'rpa-fpa-bar-title';
    fpaTitle.textContent = '📋 FPA — 他のAIにコピー';
    fpaHeader.appendChild(fpaTitle);
    const fpaClose = document.createElement('button');
    fpaClose.className = 'rpa-btn rpa-btn-delete';
    fpaClose.id = 'rpa-fpa-close';
    fpaClose.style.borderColor = '#4c566a';
    fpaClose.style.color = '#4c566a';
    fpaClose.textContent = '✕';
    fpaHeader.appendChild(fpaClose);
    fpaBarEl.appendChild(fpaHeader);

    const fpaPrev = document.createElement('div');
    fpaPrev.className = 'rpa-fpa-preview';
    fpaPrev.id = 'rpa-fpa-preview';
    fpaBarEl.appendChild(fpaPrev);

    const btnCp = document.createElement('button');
    btnCp.className = 'rpa-btn rpa-btn-copy';
    btnCp.id = 'rpa-btn-copy';
    btnCp.textContent = '📋 FPAをコピー（ChatGPT / Gemini / 他のAIに貼り付け）';
    fpaBarEl.appendChild(btnCp);

    const hint = document.createElement('div');
    hint.className = 'rpa-fpa-hint';
    hint.textContent = '↑ クリックでクリップボードにコピー。他のAIチャットに貼り付けて同じ操作を依頼できます';
    fpaBarEl.appendChild(hint);

    container.appendChild(fpaBarEl);
    TAB.appendChild(container);
  }

  buildUI();

  // ── Element refs ──
  const nameInput = document.getElementById('rpa-name');
  const urlInput = document.getElementById('rpa-url');
  const btnRecord = document.getElementById('rpa-btn-record');
  const btnStop = document.getElementById('rpa-btn-stop');
  const statusEl = document.getElementById('rpa-status');
  const statusText = document.getElementById('rpa-status-text');
  const listEl = document.getElementById('rpa-list');
  const fpaBar = document.getElementById('rpa-fpa-bar');
  const fpaPreview = document.getElementById('rpa-fpa-preview');
  const btnCopy = document.getElementById('rpa-btn-copy');
  const btnFpaClose = document.getElementById('rpa-fpa-close');

  // ── API helpers ──
  async function api(path, opts) {
    const r = await fetch('/api/rpa' + path, Object.assign({
      headers: { 'Content-Type': 'application/json' }
    }, opts || {}));
    return r.json();
  }

  // ── Status polling ──
  function startPolling() {
    if (pollingTimer) return;
    pollingTimer = setInterval(async function () {
      var s = await api('/status');
      if (s.recording) {
        setStatus('recording', '録画中: ' + s.recording.name + ' (' + Math.floor(s.recording.elapsed / 1000) + '秒)');
        btnRecord.disabled = true;
        btnStop.disabled = false;
      } else if (s.replay) {
        setStatus('replaying', '再生中: ' + s.replay.name + ' (' + Math.floor(s.replay.elapsed / 1000) + '秒)');
      } else {
        setStatus('idle', '待機中');
        btnRecord.disabled = false;
        btnStop.disabled = true;
        stopPolling();
        loadList();
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
  }

  function setStatus(state, text) {
    statusEl.className = 'rpa-status ' + state;
    statusText.textContent = text;
  }

  // ── Build single RPA item DOM ──
  function buildRpaItem(r) {
    var item = document.createElement('div');
    item.className = 'rpa-item';
    item.dataset.name = r.name;

    var header = document.createElement('div');
    header.className = 'rpa-item-header';
    var nameSpan = document.createElement('span');
    nameSpan.className = 'rpa-item-name';
    nameSpan.textContent = '📋 ' + r.name;
    header.appendChild(nameSpan);
    var meta = document.createElement('span');
    meta.className = 'rpa-item-meta';
    meta.textContent = (r.createdAt ? r.createdAt.slice(0, 10) : '') + (r.replayCount ? ' (再生' + r.replayCount + '回)' : '');
    header.appendChild(meta);
    item.appendChild(header);

    var urlDiv = document.createElement('div');
    urlDiv.className = 'rpa-item-url';
    urlDiv.textContent = r.url;
    item.appendChild(urlDiv);

    var actions = document.createElement('div');
    actions.className = 'rpa-item-actions';

    function mkBtn(cls, act, label) {
      var b = document.createElement('button');
      b.className = 'rpa-btn ' + cls;
      b.dataset.action = act;
      b.dataset.name = r.name;
      b.textContent = label;
      return b;
    }
    actions.appendChild(mkBtn('rpa-btn-replay', 'replay', '▶ 再生'));
    actions.appendChild(mkBtn('rpa-btn-view', 'script', '📄 スクリプト'));
    actions.appendChild(mkBtn('rpa-btn-fpa', 'fpa', '📋 FPA'));
    actions.appendChild(mkBtn('rpa-btn-delete', 'delete', '🗑'));
    item.appendChild(actions);

    var viewer = document.createElement('div');
    viewer.className = 'rpa-viewer';
    viewer.id = 'rpa-viewer-' + r.name;
    var pre = document.createElement('pre');
    viewer.appendChild(pre);
    item.appendChild(viewer);

    return item;
  }

  // ── Load saved RPAs ──
  async function loadList() {
    var data = await api('/list');
    var rpas = data.rpas || [];
    listEl.textContent = ''; // clear
    if (rpas.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'rpa-empty';
      empty.textContent = 'まだRPAがありません';
      listEl.appendChild(empty);
      return;
    }
    for (var i = 0; i < rpas.length; i++) {
      listEl.appendChild(buildRpaItem(rpas[i]));
    }
  }

  // ── Record ──
  btnRecord.addEventListener('click', async function () {
    var name = nameInput.value.trim();
    var url = urlInput.value.trim();
    if (!name) return alert('名前を入力してください');
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) return alert('名前は英数字・ハイフン・アンダースコアのみ');
    if (!url || !url.startsWith('http')) return alert('URLを入力してください（https://...）');

    btnRecord.disabled = true;
    var r = await api('/record', { method: 'POST', body: JSON.stringify({ name: name, url: url }) });
    if (r.error) { alert(r.error); btnRecord.disabled = false; return; }

    setStatus('recording', '録画中: ' + name + ' — ブラウザを操作してください');
    btnStop.disabled = false;
    nameInput.value = '';
    urlInput.value = '';
    startPolling();
  });

  // ── Stop ──
  btnStop.addEventListener('click', async function () {
    btnStop.disabled = true;
    await api('/stop', { method: 'POST', body: '{}' });
    setStatus('idle', '停止しました。保存中...');
    setTimeout(loadList, 1500);
  });

  // ── List actions (event delegation) ──
  listEl.addEventListener('click', async function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var name = btn.dataset.name;

    if (action === 'replay') {
      var r = await api('/replay', { method: 'POST', body: JSON.stringify({ name: name }) });
      if (r.error) return alert(r.error);
      setStatus('replaying', '再生中: ' + name);
      startPolling();
    }

    if (action === 'script') {
      var viewer = document.getElementById('rpa-viewer-' + name);
      if (viewer.classList.contains('open')) {
        viewer.classList.remove('open');
        return;
      }
      var data = await api('/script?name=' + encodeURIComponent(name));
      if (data.error) return alert(data.error);
      viewer.querySelector('pre').textContent = data.code;
      viewer.classList.add('open');
    }

    if (action === 'fpa') {
      var data = await api('/fpa?name=' + encodeURIComponent(name));
      if (data.error) return alert(data.error);
      currentFPA = { name: name, fpa: data.fpa };
      fpaPreview.textContent = data.fpa.length > 500 ? data.fpa.slice(0, 500) + '\n...' : data.fpa;
      fpaBar.classList.add('visible');
      btnCopy.textContent = '📋 FPAをコピー（ChatGPT / Gemini / 他のAIに貼り付け）';
      btnCopy.classList.remove('copied');
    }

    if (action === 'delete') {
      if (!confirm('"' + name + '" を削除しますか？\nスクリプト・コマンド・FPAが全て削除されます。')) return;
      await api('/delete', { method: 'POST', body: JSON.stringify({ name: name }) });
      loadList();
      if (currentFPA && currentFPA.name === name) {
        fpaBar.classList.remove('visible');
        currentFPA = null;
      }
    }
  });

  // ── FPA Copy ──
  btnCopy.addEventListener('click', async function () {
    if (!currentFPA) return;
    try {
      await navigator.clipboard.writeText(currentFPA.fpa);
      btnCopy.textContent = '✅ コピーしました！';
      btnCopy.classList.add('copied');
      setTimeout(function () {
        btnCopy.textContent = '📋 FPAをコピー（ChatGPT / Gemini / 他のAIに貼り付け）';
        btnCopy.classList.remove('copied');
      }, 3000);
    } catch (err) {
      // Fallback for non-HTTPS
      var ta = document.createElement('textarea');
      ta.value = currentFPA.fpa;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btnCopy.textContent = '✅ コピーしました！';
      btnCopy.classList.add('copied');
    }
  });

  // ── FPA bar close ──
  btnFpaClose.addEventListener('click', function () {
    fpaBar.classList.remove('visible');
    currentFPA = null;
  });

  // ── Init: load list when tab activates ──
  var observer = new MutationObserver(function () {
    if (TAB.classList.contains('active')) {
      loadList();
      api('/status').then(function (s) {
        if (s.recording || s.replay) startPolling();
      });
    } else {
      stopPolling();
    }
  });
  observer.observe(TAB, { attributes: true, attributeFilter: ['class'] });

  // Initial load if tab is already active
  if (TAB.classList.contains('active')) loadList();

})();
