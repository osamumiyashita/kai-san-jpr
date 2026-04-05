/**
 * x-navigator.js — Navigator tab behavior (FC / X / FP / Y)
 *
 * 三世界統合:
 *   右パネル（IT言語）→ worklog → 左パネル（自然言語 + 金融数字）
 *
 * Depends on: x-glossary.js, x-worklog.js (loaded first)
 */

'use strict';

// ===== SUB-TAB SWITCHING =====

document.addEventListener('DOMContentLoaded', function() {

  // Sub-tab switching (FC / X / FP / Y)
  var subtabs = document.querySelectorAll('.nav-subtab');
  subtabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      subtabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');

      document.querySelectorAll('.nav-panel').forEach(function(p) { p.classList.remove('active'); });
      var target = document.getElementById('navtab-' + tab.dataset.navtab);
      if (target) target.classList.add('active');
    });
  });

  // Category expand/collapse (accordion — max 1 open at a time per panel)
  document.querySelectorAll('.nav-cat-header').forEach(function(header) {
    header.addEventListener('click', function() {
      var cat = header.parentElement;
      var items = cat.querySelector('.nav-cat-items');
      if (!items) return;

      var isOpen = items.style.display !== 'none';

      // Close all in same panel
      var panel = cat.closest('.nav-panel');
      if (panel) {
        panel.querySelectorAll('.nav-cat-items').forEach(function(el) {
          el.style.display = 'none';
        });
      }

      // Toggle this one
      items.style.display = isOpen ? 'none' : 'block';

      // Load items if empty
      if (!isOpen && items.children.length === 0) {
        loadCategoryItems(cat.dataset.cat, items);
      }
    });
  });

  // X tab: onboard button
  var onboardBtn = document.getElementById('btn-x-onboard');
  if (onboardBtn) {
    onboardBtn.addEventListener('click', function() {
      window.open('/navigator/x-onboard.html', 'kai-onboard', 'width=960,height=800');
    });
  }

  // FP tab: generate FPA when FPH is entered
  var fphInput = document.getElementById('fph-input');
  if (fphInput) {
    var fphTimer = null;
    fphInput.addEventListener('input', function() {
      if (fphTimer) clearTimeout(fphTimer);
      fphTimer = setTimeout(function() {
        var text = fphInput.value.trim();
        if (text.length >= 3) {
          generateFPA(text);
        }
      }, 800);
    });
  }

  // FP tab: execute button
  var executeBtn = document.getElementById('btn-fpa-execute');
  if (executeBtn) {
    executeBtn.addEventListener('click', executeFPA);
  }

  // FP tab: edit button (add FPH2)
  var editBtn = document.getElementById('btn-fpa-edit');
  if (editBtn) {
    editBtn.addEventListener('click', function() {
      var fphInput = document.getElementById('fph-input');
      if (fphInput) {
        fphInput.focus();
        fphInput.placeholder = '修正や追加の指示を入力してください...';
      }
    });
  }

  // Y tab: browse save folder
  var browseBtn = document.getElementById('btn-y-browse');
  if (browseBtn) {
    browseBtn.addEventListener('click', function() {
      var path = prompt('保存先フォルダのパスを入力してください:');
      if (path) {
        document.getElementById('y-save-display').textContent = path;
      }
    });
  }

  // Y tab: save macro
  var macroBtn = document.getElementById('btn-y-save-macro');
  if (macroBtn) {
    macroBtn.addEventListener('click', function() {
      var name = document.getElementById('y-macro-name').value.trim();
      if (!name) { alert('マクロ名を入力してください'); return; }
      saveMacroFromNavigator(name);
      document.getElementById('y-macro-name').value = '';
    });
  }

  // Initialize worklog in FP tab
  var worklogArea = document.getElementById('nav-worklog-area');
  if (worklogArea) {
    initWorklog(worklogArea);
  }

  // Load initial FC counts
  loadFCCounts();
});

// ===== FC: Load category items =====

function loadCategoryItems(cat, container) {
  // Fetch from server API
  fetch('/api/navigator/fc?category=' + encodeURIComponent(cat))
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.items || data.items.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'nav-item';
        empty.textContent = '（まだありません）';
        empty.style.color = '#475569';
        container.appendChild(empty);
        return;
      }
      data.items.forEach(function(item) {
        var el = document.createElement('div');
        el.className = 'nav-item';
        el.dataset.path = item.path || '';
        el.title = item.tooltip || item.name;

        var nameSpan = document.createElement('span');
        nameSpan.className = 'nav-item-name';
        nameSpan.textContent = item.display_name || item.name;
        el.appendChild(nameSpan);

        if (item.hint) {
          var hintSpan = document.createElement('span');
          hintSpan.className = 'nav-item-hint';
          hintSpan.textContent = item.hint;
          el.appendChild(hintSpan);
        }

        el.addEventListener('click', function() {
          el.classList.toggle('selected');
        });

        container.appendChild(el);
      });
    })
    .catch(function() {
      var err = document.createElement('div');
      err.className = 'nav-item';
      err.textContent = '読み込みエラー';
      err.style.color = '#f87171';
      container.appendChild(err);
    });
}

function loadFCCounts() {
  fetch('/api/navigator/fc-counts')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      Object.keys(data).forEach(function(cat) {
        var el = document.getElementById('fc-' + cat + '-count');
        if (el) el.textContent = data[cat];
      });
    })
    .catch(function() { /* silent */ });
}

// ===== FP: Generate FPA from FPH =====

var fpHistory = [];

function generateFPA(fphText) {
  var section = document.getElementById('fpa-section');
  var content = document.getElementById('fpa-content');

  section.style.display = 'block';
  content.textContent = '考えています...';

  fetch('/api/navigator/generate-fpa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fph: fphText })
  })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      content.textContent = data.fpa || '（生成できませんでした）';

      // Add to history
      fpHistory.push({ fph: fphText, fpa: data.fpa, ts: new Date().toISOString() });
      renderFPHistory();
    })
    .catch(function(err) {
      content.textContent = 'エラー: ' + err.message;
    });
}

function renderFPHistory() {
  var list = document.getElementById('fp-history-list');
  if (!list) return;

  while (list.firstChild) list.removeChild(list.firstChild);

  fpHistory.forEach(function(item, i) {
    var div = document.createElement('div');
    div.className = 'fp-history-item';

    var fphDiv = document.createElement('div');
    fphDiv.className = 'fph-text';
    fphDiv.textContent = '👤 ' + item.fph;
    div.appendChild(fphDiv);

    if (item.fpa) {
      var fpaDiv = document.createElement('div');
      fpaDiv.className = 'fpa-text';
      fpaDiv.textContent = '🤖 ' + (item.fpa.length > 80 ? item.fpa.substring(0, 80) + '...' : item.fpa);
      div.appendChild(fpaDiv);
    }

    list.appendChild(div);
  });
}

// ===== FP: Execute FPA =====

function executeFPA() {
  var content = document.getElementById('fpa-content');
  if (!content) return;

  var fpaText = content.textContent;
  if (!fpaText || fpaText === '考えています...' || fpaText.startsWith('エラー')) return;

  // Clear worklog for new execution
  clearWorklog();

  // Start polling for worklog updates
  startPolling('current');

  // Send FPA to chat input on right panel
  var chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.value = fpaText;
    // Trigger send
    var sendBtn = document.getElementById('btn-send');
    if (sendBtn) sendBtn.click();
  }

  // Add initial worklog entry
  addWorklogEntry({
    id: 1,
    status: 'thinking',
    natural_text: '指示を受け取りました。実行計画を確認しています...'
  });
}

// ===== Y: Save macro =====

function saveMacroFromNavigator(name) {
  var selectedFC = [];
  document.querySelectorAll('#navtab-fc .nav-item.selected').forEach(function(el) {
    selectedFC.push(el.dataset.path || el.querySelector('.nav-item-name').textContent);
  });

  var selectedX = [];
  document.querySelectorAll('#navtab-x .nav-item.selected').forEach(function(el) {
    selectedX.push(el.dataset.path || el.querySelector('.nav-item-name').textContent);
  });

  var formats = [];
  document.querySelectorAll('#navtab-y .y-fmt input:checked').forEach(function(el) {
    formats.push(el.value);
  });

  var savePath = document.getElementById('y-save-display').textContent;

  var macro = {
    id: Date.now(),
    name: name,
    fc: selectedFC,
    x: selectedX,
    formats: formats,
    savePath: savePath === '未選択' ? '' : savePath,
    created: new Date().toISOString()
  };

  // Save to localStorage
  var macros = JSON.parse(localStorage.getItem('kai-macros') || '[]');
  macros.push(macro);
  localStorage.setItem('kai-macros', JSON.stringify(macros));

  alert('マクロ「' + name + '」を保存しました。\n能力: ' + selectedFC.length + '件\nデータ: ' + selectedX.length + '件\n形式: ' + formats.join(', '));
}
