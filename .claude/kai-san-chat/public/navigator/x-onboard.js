/**
 * x-onboard.js — Navigator Wizard behavior
 * 海憲法 §17: JS is ONLY for behavior. No styling. No structure.
 *
 * Depends on: x-glossary.js (loaded first)
 */

'use strict';

// ===== STATE =====
const STATE = {
  currentStep: 1,
  selectedFolders: [],   // [{path, name}]
  importance: {},        // {path: 'high'|'medium'|'ref'}
  depth: {},             // {path: 1|2|3}
  currentDrive: 'C:',
  currentPath: 'C:\\',
  yStructure: [],
  yMeaning: [],
  yMedia: [],
  ySavePath: '',
  macros: JSON.parse(localStorage.getItem('kai-macros') || '[]')
};

// ===== SAFE DOM HELPERS =====

function createEl(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(function(kv) {
      if (kv[0] === 'className') el.className = kv[1];
      else if (kv[0] === 'textContent') el.textContent = kv[1];
      else if (kv[0].startsWith('on')) el.addEventListener(kv[0].slice(2).toLowerCase(), kv[1]);
      else el.setAttribute(kv[0], kv[1]);
    });
  }
  if (children) {
    (Array.isArray(children) ? children : [children]).forEach(function(c) {
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else if (c) el.appendChild(c);
    });
  }
  return el;
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// ===== STEP NAVIGATION =====

function goToStep(n) {
  document.querySelectorAll('.wizard-step').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('#progress .step').forEach(function(el) {
    var s = parseInt(el.dataset.step);
    el.classList.toggle('active', s === n);
    el.classList.toggle('done', s < n);
  });
  var stepEl = document.getElementById('step-' + n);
  if (stepEl) {
    stepEl.classList.add('active');
    STATE.currentStep = n;
    onStepEnter(n);
  }
}

function onStepEnter(n) {
  if (n === 2) renderImportance();
  if (n === 3) renderDepth();
  if (n === 5) renderMatrix();
  if (n === 9) renderYSelection();
  if (n === 10) renderMacroPreview();
}

// ===== STEP 1: FOLDER EXPLORER =====

function loadDrives() {
  var container = document.getElementById('drive-selector');
  var drives = ['C:', 'D:', 'G:'];
  clearChildren(container);
  drives.forEach(function(d) {
    var btn = createEl('button', {
      textContent: d,
      className: d === STATE.currentDrive ? 'active' : '',
      onClick: function() {
        STATE.currentDrive = d;
        STATE.currentPath = d + '\\';
        container.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        loadFolderList(STATE.currentPath);
      }
    });
    container.appendChild(btn);
  });
}

function loadFolderList(path) {
  STATE.currentPath = path;
  document.getElementById('folder-current-path').textContent = path;

  var list = document.getElementById('folder-list');
  clearChildren(list);
  list.appendChild(createEl('div', { style: 'padding:12px;color:#64748b;', textContent: '読み込み中...' }));

  fetch('/api/folders?path=' + encodeURIComponent(path))
    .then(function(res) { return res.json(); })
    .then(function(data) {
      clearChildren(list);
      if (!data.folders || data.folders.length === 0) {
        list.appendChild(createEl('div', { style: 'padding:12px;color:#475569;', textContent: 'フォルダがありません' }));
        return;
      }

      data.folders.forEach(function(f) {
        var isSelected = STATE.selectedFolders.some(function(sf) { return sf.path === f.path; });

        var icon = createEl('span', { className: 'folder-icon', textContent: '📁' });
        var name = createEl('span', { className: 'folder-name', textContent: f.name });
        var check = createEl('span', { className: 'folder-check', textContent: '✓' });

        var row = createEl('div', {
          className: 'folder-row' + (isSelected ? ' selected' : '')
        }, [icon, name, check]);

        row.addEventListener('dblclick', function() {
          loadFolderList(f.path);
        });

        var clickTimer = null;
        row.addEventListener('click', function() {
          if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
          clickTimer = setTimeout(function() {
            clickTimer = null;
            toggleFolderSelection(f, row);
          }, 250);
        });

        list.appendChild(row);
      });
    })
    .catch(function(err) {
      clearChildren(list);
      list.appendChild(createEl('div', { style: 'padding:12px;color:#f87171;', textContent: '読み込みエラー: ' + err.message }));
    });
}

function toggleFolderSelection(folder, rowEl) {
  var idx = STATE.selectedFolders.findIndex(function(f) { return f.path === folder.path; });
  if (idx >= 0) {
    STATE.selectedFolders.splice(idx, 1);
    rowEl.classList.remove('selected');
  } else {
    if (STATE.selectedFolders.length >= 7) {
      alert('最大7フォルダまで選べます。先に1つ外してください。');
      return;
    }
    STATE.selectedFolders.push({ path: folder.path, name: folder.name });
    rowEl.classList.add('selected');
  }
  renderSelectedList();
}

function renderSelectedList() {
  var list = document.getElementById('selected-list');
  var count = document.getElementById('selected-count');
  count.textContent = STATE.selectedFolders.length;

  clearChildren(list);
  STATE.selectedFolders.forEach(function(f, i) {
    var pathSpan = createEl('span', { className: 'sel-path', title: f.path, textContent: f.name });
    var removeBtn = createEl('span', { className: 'sel-remove', title: '外す', textContent: '✕',
      onClick: function() {
        STATE.selectedFolders.splice(i, 1);
        renderSelectedList();
        document.querySelectorAll('.folder-row').forEach(function(row) {
          var rowName = row.querySelector('.folder-name').textContent;
          var stillSelected = STATE.selectedFolders.some(function(sf) { return sf.name === rowName; });
          row.classList.toggle('selected', stillSelected);
        });
      }
    });
    var li = createEl('li', {}, [pathSpan, removeBtn]);
    list.appendChild(li);
  });

  document.getElementById('btn-to-step2').disabled = STATE.selectedFolders.length === 0;
}

// ===== STEP 2: IMPORTANCE =====

function renderImportance() {
  var container = document.getElementById('importance-list');
  clearChildren(container);

  STATE.selectedFolders.forEach(function(f) {
    var current = STATE.importance[f.path] || 'medium';
    if (!STATE.importance[f.path]) STATE.importance[f.path] = 'medium';

    var nameSpan = createEl('span', { className: 'imp-name', title: f.path, textContent: f.name });
    var options = createEl('div', { className: 'imp-options' });

    ['high', 'medium', 'ref'].forEach(function(val) {
      var label = val === 'high' ? '高い' : val === 'medium' ? '普通' : '参考';
      var btn = createEl('button', {
        className: 'imp-btn' + (current === val ? ' selected-' + val : ''),
        textContent: label,
        onClick: function() {
          STATE.importance[f.path] = val;
          options.querySelectorAll('.imp-btn').forEach(function(b) { b.className = 'imp-btn'; });
          btn.classList.add('selected-' + val);
        }
      });
      options.appendChild(btn);
    });

    var row = createEl('div', { className: 'importance-row' }, [nameSpan, options]);
    container.appendChild(row);
  });
}

// ===== STEP 3: DEPTH =====

function renderDepth() {
  var container = document.getElementById('depth-settings');
  clearChildren(container);

  STATE.selectedFolders.forEach(function(f) {
    var imp = STATE.importance[f.path] || 'medium';
    var defaultDepth = imp === 'high' ? 3 : imp === 'medium' ? 2 : 1;
    if (!STATE.depth[f.path]) STATE.depth[f.path] = defaultDepth;

    var nameSpan = createEl('span', { className: 'depth-name', textContent: f.name });
    var impLabel = imp === 'high' ? '高い' : imp === 'medium' ? '普通' : '参考';
    var badge = createEl('span', { className: 'depth-badge badge ' + imp, textContent: impLabel });

    var select = createEl('select');
    [{ v: 1, t: '浅い（Level 1）' }, { v: 2, t: '標準（Level 2）' }, { v: 3, t: '詳しく（Level 3）' }].forEach(function(opt) {
      var option = createEl('option', { value: opt.v, textContent: opt.t });
      if (STATE.depth[f.path] === opt.v) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', function(e) {
      STATE.depth[f.path] = parseInt(e.target.value);
    });

    var row = createEl('div', { className: 'depth-row' }, [nameSpan, badge, select]);
    container.appendChild(row);
  });
}

// ===== STEP 5: RELATIONSHIP MATRIX =====

function renderMatrix() {
  var table = document.getElementById('folder-matrix');
  clearChildren(table);
  var folders = STATE.selectedFolders;
  var n = folders.length;

  // Header row
  var headerRow = createEl('tr');
  headerRow.appendChild(createEl('th'));
  folders.forEach(function(f) {
    headerRow.appendChild(createEl('th', { title: f.path, textContent: shortName(f.name) }));
  });
  table.appendChild(headerRow);

  // Data rows
  for (var i = 0; i < n; i++) {
    var tr = createEl('tr');
    tr.appendChild(createEl('th', { title: folders[i].path, textContent: shortName(folders[i].name) }));
    for (var j = 0; j < n; j++) {
      var td = createEl('td');
      if (i === j) {
        td.style.background = '#0f172a';
        td.textContent = '—';
      } else {
        var arrow = createEl('span', { className: 'arrow arrow-none', textContent: '?' });
        td.appendChild(arrow);
        td.dataset.from = i;
        td.dataset.to = j;
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

// ===== STEP 9: Y SELECTION =====

function renderYSelection() {
  STATE.yStructure = Array.from(document.querySelectorAll('#y-structure input:checked')).map(function(i) { return i.value; });
  STATE.yMeaning = Array.from(document.querySelectorAll('#y-meaning input:checked')).map(function(i) { return i.value; });
  STATE.yMedia = Array.from(document.querySelectorAll('.pipe-step input:checked')).map(function(i) { return i.value; });
}

// ===== STEP 10: MACRO =====

function renderMacroPreview() {
  renderYSelection();

  document.getElementById('macro-fc').textContent =
    STATE.selectedFolders.length + ' フォルダの能力を使用';
  document.getElementById('macro-x').textContent =
    STATE.selectedFolders.map(function(f) { return f.name; }).join(', ');
  document.getElementById('macro-fpa').textContent =
    document.getElementById('macro-name').value || '（未入力）';
  document.getElementById('macro-y').textContent =
    (STATE.yStructure.join(', ') || '未選択') + ' / ' + (STATE.yMedia.join(', ') || '未選択');
  document.getElementById('macro-save-path').textContent =
    STATE.ySavePath || '未選択';

  renderMacroList();
}

function saveMacro() {
  var name = document.getElementById('macro-name').value.trim();
  if (!name) { alert('マクロの名前を入力してください'); return; }

  renderYSelection();

  var macro = {
    id: Date.now(),
    name: name,
    fc: STATE.selectedFolders.map(function(f) { return f.path; }),
    x: STATE.selectedFolders.map(function(f) { return { path: f.path, name: f.name }; }),
    importance: Object.assign({}, STATE.importance),
    fpa: name,
    yStructure: STATE.yStructure.slice(),
    yMeaning: STATE.yMeaning.slice(),
    yMedia: STATE.yMedia.slice(),
    ySavePath: STATE.ySavePath,
    created: new Date().toISOString()
  };

  STATE.macros.push(macro);
  localStorage.setItem('kai-macros', JSON.stringify(STATE.macros));
  renderMacroList();
  document.getElementById('macro-name').value = '';
}

function renderMacroList() {
  var container = document.getElementById('macro-list');
  clearChildren(container);

  STATE.macros.forEach(function(m, i) {
    var nameSpan = createEl('span', { className: 'macro-item-name', textContent: m.name });
    var countSpan = createEl('span', { style: 'font-size:11px;color:#64748b;', textContent: (m.x ? m.x.length : 0) + ' フォルダ' });
    var runBtn = createEl('button', {
      className: 'macro-run', textContent: '▶ 実行',
      onClick: function() { executeMacro(m); }
    });
    var item = createEl('div', { className: 'macro-item' }, [nameSpan, countSpan, runBtn]);
    container.appendChild(item);
  });
}

function executeMacro(macro) {
  var message = '[マクロ実行: ' + macro.name + ']\n' +
    'データ: ' + macro.x.map(function(f) { return f.name; }).join(', ') + '\n' +
    '出力: ' + macro.yMedia.join(' → ') + '\n' +
    '保存先: ' + (macro.ySavePath || '未指定');

  if (window.opener && window.opener.sendToKai) {
    window.opener.sendToKai(message);
  } else {
    alert('Kai-sanチャットに送信:\n\n' + message);
  }
}

// ===== UTILITIES =====

function shortName(name) {
  return name.length > 12 ? name.substring(0, 12) + '\u2026' : name;
}

// ===== ANALYSIS (Step 4) =====

function startAnalysis() {
  var total = STATE.selectedFolders.length;
  var fill = document.getElementById('progress-fill');
  var text = document.getElementById('progress-text');
  var detail = document.getElementById('progress-detail');
  var log = document.getElementById('analysis-log');

  var i = 0;

  function analyzeNext() {
    if (i >= total) {
      fill.style.width = '100%';
      text.textContent = '分析完了！';
      detail.textContent = total + ' フォルダの分析が終わりました。';
      setTimeout(function() { goToStep(5); }, 1000);
      return;
    }

    var f = STATE.selectedFolders[i];
    var pct = Math.round(((i + 1) / total) * 100);
    fill.style.width = pct + '%';
    text.textContent = 'フォルダ ' + (i + 1) + '/' + total + ' を分析中...';
    detail.textContent = f.name;

    var imp = STATE.importance[f.path] || 'medium';
    var depth = STATE.depth[f.path] || 2;

    var logEntry = createEl('div', { textContent: '📁 ' + f.name + ' [' + imp + '] 深さ' + depth + ' → 分析開始' });
    log.appendChild(logEntry);

    fetch('/api/analyze-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: f.path, importance: imp, depth: depth })
    })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        var success = createEl('div', { style: 'color:#4ade80;', textContent: '  ✓ ' + (result.files || 0) + ' ファイル, ' + (result.themes || 0) + ' テーマ検出' });
        log.appendChild(success);
      })
      .catch(function(err) {
        var errEl = createEl('div', { style: 'color:#f87171;', textContent: '  ✕ エラー: ' + err.message });
        log.appendChild(errEl);
      })
      .finally(function() {
        log.scrollTop = log.scrollHeight;
        i++;
        setTimeout(analyzeNext, 300);
      });
  }

  analyzeNext();
}

// ===== EVENT BINDINGS =====

document.addEventListener('DOMContentLoaded', function() {

  var navMap = {
    'btn-to-step2': 2, 'btn-to-step3': 3,
    'btn-to-step6': 6, 'btn-to-step7': 7, 'btn-to-step8': 8,
    'btn-to-step9': 9, 'btn-to-step10': 10,
    'btn-back-to-1': 1, 'btn-back-to-2': 2, 'btn-back-to-4': 4,
    'btn-back-to-5': 5, 'btn-back-to-6': 6, 'btn-back-to-7': 7,
    'btn-back-to-8': 8, 'btn-back-to-9': 9
  };

  Object.keys(navMap).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function() { goToStep(navMap[id]); });
  });

  // Step 1: Folder up
  document.getElementById('folder-up').addEventListener('click', function() {
    var parts = STATE.currentPath.replace(/\\$/, '').split('\\');
    if (parts.length > 1) {
      parts.pop();
      loadFolderList(parts.join('\\') + '\\');
    }
  });

  // Step 4: Start analysis
  document.getElementById('btn-to-step4').addEventListener('click', function() {
    goToStep(4);
    startAnalysis();
  });

  // Step 9: Browse save location
  document.getElementById('btn-browse-save').addEventListener('click', function() {
    var path = prompt('保存先フォルダのパスを入力してください:', STATE.currentPath);
    if (path) {
      STATE.ySavePath = path;
      document.getElementById('save-path-display').textContent = path;
    }
  });

  // Step 10: Save macro
  document.getElementById('btn-save-macro').addEventListener('click', saveMacro);

  // Step 10: Finish
  document.getElementById('btn-finish').addEventListener('click', function() {
    alert('設定が完了しました！\nKai-sanチャットに戻ります。');
    if (window.opener) window.close();
  });

  // Initialize
  loadDrives();
  loadFolderList(STATE.currentPath);
  renderSelectedList();
});
