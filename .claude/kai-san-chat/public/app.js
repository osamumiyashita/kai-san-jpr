// Kai-san Chat — Client Application (PURE: no server-side template, config via API)

// ═══════════════════════════════════════════════════════════
// DISPLAY MODE: エンジニアモード / 自然言語モード
// ═══════════════════════════════════════════════════════════
let displayMode = 'natural'; // 'natural' or 'engineer'

// IT用語 → 自然言語 翻訳辞書
const IT_TO_NATURAL = {
  // ツール操作
  'Read': '📖 ファイルを読んでいます',
  'Write': '📝 ファイルを作成しています',
  'Edit': '✏️ ファイルを修正しています',
  'Bash': '⚙️ コマンドを実行しています',
  'Glob': '🔍 ファイルを探しています',
  'Grep': '🔍 テキストを検索しています',
  'Agent': '🤖 専門スタッフに依頼しています',
  'Skill': '📚 スキルを使用しています',
  'WebFetch': '🌐 ウェブから情報を取得しています',
  'WebSearch': '🌐 ウェブを検索しています',
  'TaskCreate': '📋 タスクを作成しています',
  'TaskUpdate': '📋 タスクを更新しています',
  // ステータス
  'Connecting...': '🔄 接続しています...',
  'Connected': '✅ 接続完了',
  'Reconnecting...': '🔄 再接続中...',
  // Git
  'git commit': '💾 変更を記録しています',
  'git push': '📤 変更をサーバーに送信しています',
  'git pull': '📥 最新の変更を取得しています',
  'git status': '📊 変更状態を確認しています',
  'git diff': '📊 変更内容を比較しています',
  // npm/Python
  'npm install': '📦 ソフトウェア部品をインストールしています',
  'pip install': '📦 Python部品をインストールしています',
  'python': '🐍 Pythonプログラムを実行しています',
  // DB
  'DuckDB': '🗄️ データベースを操作しています',
  'duckdb': '🗄️ データベースを操作しています',
  'SELECT': '🔍 データを検索しています',
  'INSERT': '➕ データを追加しています',
  'UPDATE': '✏️ データを更新しています',
  // ファイル
  '.py': 'Pythonプログラム',
  '.js': 'JavaScriptプログラム',
  '.html': 'Webページ',
  '.css': 'デザインファイル',
  '.md': '文書ファイル',
  '.json': '設定ファイル',
  '.duckdb': 'データベース',
  '.png': '画像ファイル',
  '.pdf': 'PDFファイル',
  '.xlsx': 'Excelファイル',
};

// IT行動の自然言語翻訳
const ACTION_PATTERNS = [
  { pattern: /^(Read|Bash|Write|Edit|Glob|Grep|Agent|Skill)\s*\(/,
    translate: (line) => {
      const tool = line.match(/^(\w+)/)[1];
      return IT_TO_NATURAL[tool] || '🔧 ' + tool + 'を実行中';
    }},
  { pattern: /Allowed|Allow\?|Deny/,
    translate: () => '⏳ 許可を確認しています' },
  { pattern: /^\d+ (file|tool|Agent)/,
    translate: (line) => '📊 ' + line.replace(/file/g, 'ファイル').replace(/tool/g, 'ツール').replace(/Agent/g, 'スタッフ').replace(/uses/g, '回使用').replace(/tokens/g, '文字') },
  { pattern: /completed|Done|finished|完了/,
    translate: () => '✅ 完了しました' },
  { pattern: /Error|error|failed|失敗/,
    translate: () => '❌ エラーが発生しました' },
  { pattern: /^[A-Z]:\\.*\.(py|js|html|css|md|json)/,
    translate: (line) => {
      const ext = line.match(/\.(\w+)$/);
      const name = ext ? IT_TO_NATURAL['.' + ext[1]] || ext[1] + 'ファイル' : 'ファイル';
      const fileName = line.split('\\').pop();
      return '📄 ' + fileName + '（' + name + '）';
    }},
  { pattern: /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏●◐◑◒◓]/,
    translate: () => '⏳ 処理中...' },
];

function translateToNatural(text) {
  if (displayMode !== 'natural') return text;
  const lines = text.split('\n');
  const translated = [];
  let lastTranslation = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let found = false;
    for (const ap of ACTION_PATTERNS) {
      if (ap.pattern.test(trimmed)) {
        const t = ap.translate(trimmed);
        // 重複除去（同じ翻訳が連続しない）
        if (t !== lastTranslation) {
          translated.push(t);
          lastTranslation = t;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      // IT行でないもの（Kai(海):の回答テキスト等）はそのまま表示
      if (/^(Kai|━|10000|Layer|Growth|Connection|Confidence|MVC|SG100Y|Task|Cost)/.test(trimmed) ||
          trimmed.length > 20) {
        translated.push(line);
        lastTranslation = '';
      }
    }
  }
  return translated.join('\n');
}

// --- PURE: ANSI strip ---
function stripAnsi(s) {
  return s.replace(/\x1b\[[?>=!]?[0-9;]*[a-zA-Z]/g, '')
          .replace(/\x1b\][^\x07]*\x07/g, '')
          .replace(/\x1b[^[]\S*/g, '')
          .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
          .replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// --- PURE: extract answer text from terminal output ---
function extractAnswer(raw) {
  const text = stripAnsi(raw);
  const lines = text.split('\n');
  const answer = [];
  let inToolBlock = false;
  let inSystemBlock = false;
  for (const line of lines) {
    const t = line.trim();
    // Spinner / progress chars
    if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏●◐◑◒◓⣾⣽⣻⢿⡿⣟⣯⣷✢✶✻✽·*]/.test(t)) continue;
    // Prompt chars
    if (/^[❯⎿]/.test(t)) continue;
    // Extended thinking
    if (/^\(think(ing|ought)/.test(t)) continue;
    // Claude CLI thinking/processing words (comprehensive list)
    if (/^[A-Z][a-z]+\.\.\.\s*$/.test(t)) continue;
    if (/^(Simmering|Meandering|Channelling|Orchestrating|Brewing|Thinking|Pondering|Composing|Reflecting|Swooping|Bootstrapping|Drizzling|Julienning|Braising|Blanching|Caramelizing|Deglazing|Emulsifying|Fermenting|Garnishing|Infusing|Marinating|Pickling|Poaching|Reducing|Searing|Tempering|Whisking|Zesting|Analyzing|Processing|Generating|Evaluating|Reasoning|Exploring|Investigating|Synthesizing|Contemplating|Deliberating|Examining|Formulating|Calculating|Assembling|Connecting|Mapping|Structuring|Weaving|Crafting|Distilling|Filtering|Parsing|Scanning|Tracing|Unwinding|Validating)/.test(t)) continue;
    // Hook execution messages
    if (/running (stop|start|pre|post) hooks?\.*\s*\d*\/?\d*/i.test(t)) continue;
    if (/hook (error|says)|MCP server|Tip:|for shortcuts|claude\.ai conn/.test(t)) continue;
    // System-reminder / memory / rule leakage
    if (/^<\/?system-reminder>/.test(t)) { inSystemBlock = !inSystemBlock; continue; }
    if (inSystemBlock) continue;
    if (/^(Memory|MEMORY|IMPORTANT|UserPromptSubmit|SessionStart|SUPREME|MANDATORY|NEVER|ALWAYS):?\s/.test(t) && t.length < 200) continue;
    if (/Do NOT propose|Do NOT ropse|cognitive burden|認知負担/.test(t) && !/^Kai/.test(t)) continue;
    if (/^(MVC CONTEXT|BUS-WRITER|BUS READ|TRIGGERS|免疫発動|🔴|🟡|🟢)/.test(t)) continue;
    // Tool use blocks
    if (/^(Read|Write|Edit|Bash|Glob|Grep|Agent|Skill|ToolSearch|SendMessage|TaskCreate|TaskUpdate|TaskGet|TaskList|TaskOutput|TodoWrite|NotebookEdit|EnterPlanMode|ExitPlanMode|WebFetch|WebSearch|CronCreate|CronDelete|CronList|LSP)\s*[:(]/.test(t)) { inToolBlock = true; continue; }
    if (/^(Allowed|Allow|Deny|Yes|No)\s*[?]?\s*$/.test(t)) continue;
    // Box drawing / table borders
    if (/^[─━╭╮╰╯│┃├┤┬┴┼═╔╗╚╝║┌┐└┘┬┴]/.test(t)) continue;
    if (/^[+\-]{3,}/.test(t)) continue;
    if (/^[\|┃].*[\|┃]\s*$/.test(t) && (t.match(/[\|┃]/g) || []).length >= 3) continue;
    // Line numbers (diff or code output)
    if (/^\d+[→│]/.test(t)) continue;
    // Diff lines (+/- prefix with code)
    if (/^[+-]\s*(display|flex|padding|margin|border|font|background|color|overflow|position|gap|align|justify|width|height|max-|min-|cursor|outline|white-space|text-|z-index)/.test(t)) continue;
    if (/^[+-]\d+\s/.test(t)) continue;
    if (/^@@\s/.test(t)) continue;
    // CSS / HTML / code lines leaked into chat
    if (/^[.#][a-zA-Z_-]+[\s{:]/.test(t) && !/^[.#]\s/.test(t)) continue;
    if (/^\s*[a-z-]+\s*:\s*[^;]+;\s*$/.test(t)) continue;
    if (/^<\/?[a-z][a-z0-9-]*[\s>\/]/.test(t) && !/^<strong|^<em|^<br/.test(t)) continue;
    // File paths as standalone lines (not part of a sentence)
    if (/^[A-Z]:\\[\w\\.-]+\s*$/.test(t)) continue;
    if (/^\/[a-z][\w/.-]+\s*$/.test(t) && t.length < 80) continue;
    // Markdown table separator
    if (/^\|?\s*[-:]+\s*\|/.test(t)) continue;
    // Pure markdown table rows (3+ pipe-separated cells of non-sentence data)
    if (/^\|.*\|.*\|/.test(t) && !/^\|\s*\*/.test(t)) continue;
    // Tool block end
    if (t === '' && inToolBlock) { inToolBlock = false; continue; }
    if (inToolBlock) continue;
    // Empty line handling
    if (t === '') { if (answer.length > 0 && answer[answer.length - 1] !== '') answer.push(''); continue; }
    answer.push(t);
  }
  while (answer.length && answer[0] === '') answer.shift();
  while (answer.length && answer[answer.length - 1] === '') answer.pop();
  return answer.join('\n');
}

// --- PURE: time string ---
function now() {
  const d = new Date();
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

// --- DOM: init ---
document.addEventListener('DOMContentLoaded', async () => {
  // Fetch server config (label, accent, layer)
  let cfg = { label: '', accent: '#dc2626' };
  try {
    const r = await fetch('/api/config');
    cfg = await r.json();
  } catch (e) {}

  // Apply config to header badge
  const badge = document.getElementById('deploy-badge');
  if (badge) {
    badge.textContent = cfg.label;
    badge.style.background = cfg.accent;
  }

  // Terminal
  // Terminal — Windows Terminal完全再現設定
  const term = new Terminal({
    cursorBlink: true,
    cursorStyle: 'bar',
    cursorWidth: 2,
    fontSize: 14,
    lineHeight: 1.2,
    letterSpacing: 0,
    fontFamily: "'Cascadia Code', 'Cascadia Mono', 'Consolas', 'Courier New', monospace",
    fontWeight: 'normal',
    fontWeightBold: 'bold',
    scrollback: 10000,
    allowProposedApi: true,
    rightClickSelectsWord: true, // 右クリックで単語選択
    overviewRulerWidth: 0,   // スクロールバーオーバーレイなし
    // Windows Terminal "One Half Dark" テーマ完全再現
    theme: {
      background:       '#282c34',
      foreground:       '#dcdfe4',
      cursor:           '#a3b3cc',
      cursorAccent:     '#282c34',
      selectionBackground: 'rgba(90, 120, 180, 0.4)',
      selectionForeground: '#dcdfe4',
      // ANSI 16色 — Windows Terminal "One Half Dark" 準拠
      black:            '#282c34',
      red:              '#e06c75',
      green:            '#98c379',
      yellow:           '#e5c07b',
      blue:             '#61afef',
      magenta:          '#c678dd',
      cyan:             '#56b6c2',
      white:            '#dcdfe4',
      brightBlack:      '#5a6374',
      brightRed:        '#e06c75',
      brightGreen:      '#98c379',
      brightYellow:     '#e5c07b',
      brightBlue:       '#61afef',
      brightMagenta:    '#c678dd',
      brightCyan:       '#56b6c2',
      brightWhite:      '#ffffff',
    }
  });
  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  // Unicode11: CJK文字の正しい幅計算（全角=2セル）
  if (typeof Unicode11Addon !== 'undefined') {
    const unicode11 = new Unicode11Addon.Unicode11Addon();
    term.loadAddon(unicode11);
    term.unicode.activeVersion = '11';
  }

  term.open(document.getElementById('terminal-container'));

  // WebGL Renderer: 高品質レンダリング（CJK文字のアンチエイリアス改善）
  if (typeof WebglAddon !== 'undefined') {
    try {
      const webgl = new WebglAddon.WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch (e) {
      console.warn('WebGL addon failed, using canvas renderer:', e);
    }
  }

  fitAddon.fit();

  // --- IME Composition Overlay (日本語入力の可視化改善) ---
  const imeOverlay = document.getElementById('ime-overlay');
  const termContainer = document.getElementById('terminal-container');

  // === IME最適化: textareaをカーソル位置に追従させる ===
  // これによりOSのIME候補ウィンドウがカーソル近くに表示される
  const xtermTextarea = termContainer.querySelector('.xterm-helper-textarea');

  function getCursorPixelPosition() {
    // xterm.jsのカーソルレイヤーからピクセル位置を取得
    const cursorLayer = termContainer.querySelector('.xterm-cursor-layer');
    if (!cursorLayer) return null;
    const canvas = cursorLayer;
    const rect = canvas.getBoundingClientRect();
    // カーソルのセル位置からピクセル位置を計算
    const cellWidth = rect.width / term.cols;
    const cellHeight = rect.height / term.rows;
    const buf = term.buffer.active;
    const x = rect.left + buf.cursorX * cellWidth;
    const y = rect.top + buf.cursorY * cellHeight;
    return { x, y, cellHeight };
  }

  function moveTextareaToCursor() {
    if (!xtermTextarea) return;
    const pos = getCursorPixelPosition();
    if (!pos) return;
    const containerRect = termContainer.getBoundingClientRect();
    // textareaをカーソル位置に移動（IME候補ウィンドウがここに出る）
    xtermTextarea.style.position = 'fixed';
    xtermTextarea.style.left = pos.x + 'px';
    xtermTextarea.style.top = pos.y + 'px';
    xtermTextarea.style.width = '1px';
    xtermTextarea.style.height = pos.cellHeight + 'px';
  }

  if (xtermTextarea) {
    let composing = false;

    // IME入力開始 → textareaをカーソル位置に移動
    xtermTextarea.addEventListener('compositionstart', () => {
      composing = true;
      moveTextareaToCursor();
      imeOverlay.style.display = 'block';
      imeOverlay.textContent = '';
      const pos = getCursorPixelPosition();
      if (pos) {
        imeOverlay.style.left = pos.x + 'px';
        imeOverlay.style.top = (pos.y - 32) + 'px';
      }
    });

    // IME変換中 → オーバーレイにプレビュー表示
    xtermTextarea.addEventListener('compositionupdate', (e) => {
      imeOverlay.textContent = e.data || '';
      imeOverlay.style.display = 'block';
    });

    // IME確定
    xtermTextarea.addEventListener('compositionend', () => {
      composing = false;
      imeOverlay.style.display = 'none';
      imeOverlay.textContent = '';
    });

    // カーソル移動のたびにtextarea位置を更新
    // （これによりIME候補ウィンドウが常にカーソルに追従）
    const cursorObserver = new MutationObserver(() => {
      if (composing) moveTextareaToCursor();
    });
    const cursorLayer = termContainer.querySelector('.xterm-cursor-layer');
    if (cursorLayer) {
      cursorObserver.observe(cursorLayer, { attributes: true, childList: true, subtree: true });
    }

    // フォーカス時にもtextarea位置を更新
    xtermTextarea.addEventListener('focus', moveTextareaToCursor);
  }

  // State
  let ws, responseBuffer = '', responseTimer = null, lastSentTime = 0;
  const chatEl = document.getElementById('tab-chat');
  const statusEl = document.getElementById('status');
  const inputEl = document.getElementById('chat-input');

  // --- WebSocket with auto-reconnect ---
  let reconnectDelay = 2000;
  const MAX_RECONNECT_DELAY = 30000;

  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws');
    ws.onopen = () => {
      statusEl.textContent = 'Connected';
      statusEl.style.color = '#4ade80';
      reconnectDelay = 2000;
      // 接続直後にfit()で正しいcols/rowsを計算し、PTYに送信
      fitAddon.fit();
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };
    ws.onmessage = (e) => {
      // Handle preview command from server (JSON with type:'preview')
      try {
        if (e.data.startsWith('{')) {
          const msg = JSON.parse(e.data);
          if (msg.type === 'preview' && msg.url) {
            const frame = document.getElementById('docs-frame');
            if (frame) frame.src = msg.url;
            // Switch to Docs tab
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            const docsBtn = document.querySelector('[data-tab="docs"]');
            if (docsBtn) docsBtn.classList.add('active');
            const docsTab = document.getElementById('tab-docs');
            if (docsTab) docsTab.classList.add('active');
            return;
          }
        }
      } catch {}
      term.write(e.data);
      if (Date.now() - lastSentTime < 120000) {
        responseBuffer += e.data;
        clearTimeout(responseTimer);
        responseTimer = setTimeout(flushResponse, 2000);
      }
    };
    ws.onclose = () => {
      statusEl.textContent = 'Reconnecting... (' + Math.round(reconnectDelay / 1000) + 's)';
      statusEl.style.color = '#facc15';
      if (reconnectDelay >= MAX_RECONNECT_DELAY) {
        term.write('\r\n\x1b[33m[kai-san-chat] Connection lost. Retrying...\x1b[0m\r\n');
      }
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
        connectWS();
      }, reconnectDelay);
    };
    ws.onerror = () => {};  // suppress console noise; onclose handles reconnect
  }
  connectWS();

  // --- Clipboard: Ctrl+C/V with keyCode for IME compatibility ---
  term.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== 'keydown') return true;
    const isC = ev.keyCode === 67; // 'C' key (works regardless of IME state)
    const isV = ev.keyCode === 86; // 'V' key

    // Ctrl+C
    if (ev.ctrlKey && isC) {
      const sel = term.getSelection();
      if (sel) {
        // テキスト選択あり → コピー
        navigator.clipboard.writeText(sel);
        term.clearSelection();
        return false;
      }
      // テキスト選択なし → SIGINT（そのままPTYに送信）
      return true;
    }

    // Ctrl+V → ペースト
    if (ev.ctrlKey && isV) {
      navigator.clipboard.readText().then(text => {
        if (text && ws && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'input', data: text }));
        }
      });
      return false;
    }

    return true;
  });

  // Right-click → paste from clipboard
  document.getElementById('terminal-container').addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    navigator.clipboard.readText().then(text => {
      if (text && ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'input', data: text }));
      }
    });
  });

  term.onData((d) => ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'input', data: d })));
  term.onResize(({ cols, rows }) => ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'resize', cols, rows })));
  window.addEventListener('resize', () => fitAddon.fit());

  // Focus management: click terminal → focus terminal, click input → focus input
  document.getElementById('terminal-container').addEventListener('mousedown', () => {
    setTimeout(() => term.focus(), 0);
  });
  inputEl.addEventListener('focus', () => term.blur());

  // --- Chat messages ---
  function addMsg(text, type, timeStr, save) {
    const empty = document.getElementById('empty-state');
    if (empty) empty.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'msg';
    const bubble = document.createElement('div');
    bubble.className = type === 'you' ? 'msg-you' : 'msg-kai';

    const label = document.createElement('div');
    label.className = type === 'you' ? 'label' : 'label kai';
    label.textContent = type === 'you' ? 'あなた' : 'Kai(海)';

    const body = document.createElement('div');
    body.textContent = text;

    const time = document.createElement('div');
    time.className = 'msg-time';
    time.textContent = timeStr || now();

    bubble.appendChild(label);
    bubble.appendChild(body);
    bubble.appendChild(time);
    wrapper.appendChild(bubble);
    chatEl.appendChild(wrapper);
    chatEl.scrollTop = chatEl.scrollHeight;

    // Save to server (skip for restored messages)
    if (save !== false) {
      fetch('/api/chat/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, text })
      }).catch(() => {});
    }
  }

  // --- Load today's chat history ---
  async function loadHistory() {
    try {
      const r = await fetch('/api/chat/history');
      const msgs = await r.json();
      for (const m of msgs) {
        const t = new Date(m.ts);
        const ts = t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0');
        addMsg(m.text, m.type, ts, false);
      }
    } catch (e) {}
  }
  loadHistory();

  // --- Load suggestions from past chats ---
  async function loadSuggestions() {
    const el = document.getElementById('suggestions');
    try {
      const r = await fetch('/api/chat/suggestions');
      const items = await r.json();
      if (items.length === 0) return;
      const label = document.createElement('div');
      label.className = 'suggestion-label';
      label.textContent = 'チャット履歴から:';
      el.appendChild(label);
      for (const item of items) {
        const chip = document.createElement('span');
        chip.className = 'suggestion-chip';
        chip.textContent = item.text;
        chip.title = item.date;
        chip.addEventListener('click', () => {
          inputEl.value = item.text;
          inputEl.focus();
          inputEl.style.height = 'auto';
          inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
        });
        el.appendChild(chip);
      }
    } catch (e) {}
  }
  loadSuggestions();

  // ═══════════════════════════════════════════════════════════
  // CATEGORY TREE — チャット履歴を自動カテゴリー化+階層ナビ
  // ═══════════════════════════════════════════════════════════
  const CAT_ICONS = {
    '財務分析': '📊', 'GCC': '🎯', 'IR・開示': '📋', '技術': '⚙️',
    'データ': '🗄️', 'クライアント': '🏢', 'コミュニケーション': '💬',
    '研究': '🔬', '戦略': '🧭', 'その他': '📌'
  };
  let catData = null;
  let catCrosslinks = {};

  async function loadCategories() {
    try {
      const r = await fetch('/api/chat/categories');
      const d = await r.json();
      catData = d.categories;
      catCrosslinks = d.crosslinks || {};
      renderCatRoot();
    } catch (e) {}
  }

  function makeCatHeader(iconText, nameText, countText) {
    const h = document.createElement('div');
    h.className = 'cat-header';
    const icon = document.createElement('span');
    icon.className = 'cat-icon';
    icon.textContent = iconText;
    const name = document.createElement('span');
    name.textContent = nameText;
    const count = document.createElement('span');
    count.className = 'cat-count';
    count.textContent = countText;
    h.appendChild(icon);
    h.appendChild(name);
    h.appendChild(count);
    return h;
  }

  function renderCatRoot() {
    const tree = document.getElementById('cat-tree');
    tree.textContent = '';
    setBreadcrumb([{ label: '💬 チャット', level: 'root' }]);
    if (!catData || catData.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:12px;color:#475569;font-size:12px;';
      empty.textContent = 'まだチャット履歴がありません';
      tree.appendChild(empty);
      return;
    }
    for (const cat of catData) {
      const g = document.createElement('div');
      g.className = 'cat-group';
      const h = makeCatHeader(CAT_ICONS[cat.name] || '📁', cat.name, String(cat.count));
      h.addEventListener('click', () => renderCatSubs(cat));
      g.appendChild(h);
      tree.appendChild(g);
    }
  }

  function renderCatSubs(cat) {
    const tree = document.getElementById('cat-tree');
    tree.textContent = '';
    setBreadcrumb([
      { label: '💬 チャット', level: 'root', action: () => renderCatRoot() },
      { label: (CAT_ICONS[cat.name] || '') + ' ' + cat.name, level: 'cat' }
    ]);
    for (const sub of cat.subcategories) {
      const s = document.createElement('div');
      s.className = 'cat-sub';
      const sh = document.createElement('div');
      sh.className = 'cat-sub-header';
      const subIcon = document.createElement('span');
      subIcon.textContent = '📂 ' + sub.name;
      const subCount = document.createElement('span');
      subCount.className = 'sub-count';
      subCount.textContent = String(sub.items.length);
      sh.appendChild(subIcon);
      sh.appendChild(subCount);
      sh.addEventListener('click', () => renderCatItems(cat, sub));
      s.appendChild(sh);
      tree.appendChild(s);
    }
  }

  function renderCatItems(cat, sub) {
    const tree = document.getElementById('cat-tree');
    tree.textContent = '';
    setBreadcrumb([
      { label: '💬 チャット', level: 'root', action: () => renderCatRoot() },
      { label: (CAT_ICONS[cat.name] || '') + ' ' + cat.name, level: 'cat', action: () => renderCatSubs(cat) },
      { label: sub.name, level: 'sub' }
    ]);
    for (const item of sub.items) {
      const el = document.createElement('div');
      el.className = 'cat-item';
      const textSpan = document.createElement('span');
      textSpan.className = 'item-text';
      textSpan.textContent = item.text;
      el.appendChild(textSpan);
      // Cross-link badges
      if (catCrosslinks[item.id]) {
        for (const xlinkPath of catCrosslinks[item.id]) {
          const currentPath = cat.name + '/' + sub.name;
          if (xlinkPath !== currentPath) {
            const xlink = document.createElement('span');
            xlink.className = 'cat-xlink';
            xlink.textContent = xlinkPath.split('/')[0];
            xlink.title = '→ ' + xlinkPath;
            xlink.addEventListener('click', (e) => {
              e.stopPropagation();
              navigateToPath(xlinkPath);
            });
            el.appendChild(xlink);
          }
        }
      }
      const dateSpan = document.createElement('span');
      dateSpan.className = 'item-date';
      dateSpan.textContent = item.date;
      el.appendChild(dateSpan);
      el.addEventListener('click', () => {
        const inputEl = document.getElementById('chat-input');
        inputEl.value = item.text;
        inputEl.focus();
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
      });
      tree.appendChild(el);
    }
  }

  function navigateToPath(path) {
    if (!catData) return;
    const [catName, subName] = path.split('/');
    const cat = catData.find(c => c.name === catName);
    if (!cat) return;
    if (!subName) { renderCatSubs(cat); return; }
    const sub = cat.subcategories.find(s => s.name === subName);
    if (sub) renderCatItems(cat, sub);
    else renderCatSubs(cat);
  }

  function setBreadcrumb(crumbs) {
    const bc = document.getElementById('cat-breadcrumb');
    bc.textContent = '';
    crumbs.forEach((c, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '›';
        bc.appendChild(sep);
      }
      const span = document.createElement('span');
      span.className = 'crumb' + (i === crumbs.length - 1 ? ' active' : '');
      span.textContent = c.label;
      if (c.action) span.addEventListener('click', c.action);
      bc.appendChild(span);
    });
  }

  // Toggle button
  const toggleCatBtn = document.getElementById('btn-toggle-cat');
  const catTreeEl = document.getElementById('cat-tree');
  if (toggleCatBtn && catTreeEl) {
    toggleCatBtn.addEventListener('click', () => {
      const hidden = catTreeEl.style.display === 'none';
      catTreeEl.style.display = hidden ? 'block' : 'none';
      toggleCatBtn.textContent = hidden ? 'チャット履歴 ▼' : 'チャット履歴 ▶';
      if (hidden && !catData) loadCategories();
    });
  }

  function flushResponse() {
    const clean = extractAnswer(responseBuffer);
    if (clean.length > 5) {
      // 自然言語モードの場合は翻訳して表示
      const display = translateToNatural(clean);
      addMsg(display, 'kai');
    }
    responseBuffer = '';
  }

  // --- Input (chunked send for large text, no truncation) ---
  const MAX_INPUT = 50000; // 50K chars max
  const CHUNK_SIZE = 512;  // PTY-safe chunk size
  const CHUNK_DELAY = 50;  // ms between chunks

  function sendChunked(text) {
    if (text.length <= CHUNK_SIZE) {
      ws.send(JSON.stringify({ type: 'input', data: text }));
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let offset = 0;
      function next() {
        if (offset >= text.length) { resolve(); return; }
        const chunk = text.slice(offset, offset + CHUNK_SIZE);
        ws.send(JSON.stringify({ type: 'input', data: chunk }));
        offset += CHUNK_SIZE;
        setTimeout(next, CHUNK_DELAY);
      }
      next();
    });
  }

  async function sendInput() {
    let text = inputEl.value.trim();
    if (!text || !ws || ws.readyState !== 1) return;
    if (text.length > MAX_INPUT) text = text.slice(0, MAX_INPUT);
    addMsg(text, 'you');
    await sendChunked(text + '\r');
    inputEl.value = '';
    updateCharCount();
    inputEl.style.height = 'auto';
    inputEl.focus();
    lastSentTime = Date.now();
    clearTimeout(responseTimer);
    responseTimer = null;
    responseBuffer = '';
  }

  // --- Character countdown ---
  function updateCharCount() {
    let counter = document.getElementById('char-count');
    if (!counter) {
      counter = document.createElement('span');
      counter.id = 'char-count';
      counter.style.cssText = 'position:absolute; right:80px; bottom:8px; font-size:11px; color:#64748b; pointer-events:none; font-family:monospace;';
      inputEl.parentElement.style.position = 'relative';
      inputEl.parentElement.appendChild(counter);
    }
    const len = inputEl.value.length;
    const remain = MAX_INPUT - len;
    if (len === 0) {
      counter.textContent = '';
    } else if (remain < 5000) {
      counter.textContent = `${remain.toLocaleString()} / ${MAX_INPUT.toLocaleString()}`;
      counter.style.color = remain < 1000 ? '#ef4444' : '#f59e0b';
    } else {
      counter.textContent = `${len.toLocaleString()} 文字`;
      counter.style.color = '#64748b';
    }
  }

  // --- Chat input history (↑↓ keys) ---
  const inputHistory = [];
  let historyIndex = -1;
  let savedInput = '';

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      // Save to history before sending
      const text = inputEl.value.trim();
      if (text && (inputHistory.length === 0 || inputHistory[inputHistory.length - 1] !== text)) {
        inputHistory.push(text);
      }
      historyIndex = -1;
      savedInput = '';
      sendInput();
    }
    // ↑ key: go back in history
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      if (inputHistory.length === 0) return;
      if (historyIndex === -1) {
        savedInput = inputEl.value;
        historyIndex = inputHistory.length - 1;
      } else if (historyIndex > 0) {
        historyIndex--;
      }
      inputEl.value = inputHistory[historyIndex];
      e.preventDefault();
    }
    // ↓ key: go forward in history
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      if (historyIndex === -1) return;
      if (historyIndex < inputHistory.length - 1) {
        historyIndex++;
        inputEl.value = inputHistory[historyIndex];
      } else {
        historyIndex = -1;
        inputEl.value = savedInput;
      }
      e.preventDefault();
    }
  });
  inputEl.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    updateCharCount();
  });
  document.getElementById('btn-send').addEventListener('click', sendInput);

  // --- Tabs ---
  let docsLoaded = false;
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      btn.classList.add('active');
      // Lazy-load docs iframe on first click
      if (btn.dataset.tab === 'docs' && !docsLoaded) {
        document.getElementById('docs-frame').src = '/docs/';
        docsLoaded = true;
      }
    });
  });

  // --- Display Mode Toggle (自然言語 ⟷ エンジニア) ---
  const modeBtn = document.getElementById('btn-mode');
  // 全Kaiメッセージの原文を保存（モード切替時に再翻訳するため）
  const originalMessages = new Map(); // DOM element → original text

  function updateModeDisplay() {
    if (displayMode === 'natural') {
      modeBtn.textContent = '🌐 自然言語モード';
      modeBtn.classList.remove('mode-engineer');
      modeBtn.classList.add('mode-natural');
    } else {
      modeBtn.textContent = '⚙️ エンジニアモード';
      modeBtn.classList.remove('mode-natural');
      modeBtn.classList.add('mode-engineer');
    }
  }
  updateModeDisplay();

  modeBtn.addEventListener('click', () => {
    displayMode = displayMode === 'natural' ? 'engineer' : 'natural';
    updateModeDisplay();
    // 既存のKaiメッセージを全て再翻訳/元に戻す
    originalMessages.forEach((originalText, bodyEl) => {
      if (displayMode === 'natural') {
        bodyEl.textContent = translateToNatural(originalText);
      } else {
        bodyEl.textContent = originalText;
      }
    });
  });

  // addMsg関数を拡張: Kaiメッセージの原文を保存
  const _origAddMsg = addMsg;
  addMsg = function(text, type, timeStr, save) {
    _origAddMsg(text, type, timeStr, save);
    // 最後に追加されたKaiメッセージのbody要素を記録
    if (type === 'kai') {
      const msgs = chatEl.querySelectorAll('.msg-kai');
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        const bodyEl = lastMsg.querySelector('div:nth-child(2)');
        if (bodyEl) {
          originalMessages.set(bodyEl, text);
        }
      }
    }
  };

  // --- Restart with auto-reconnect ---
  document.getElementById('btn-restart').addEventListener('click', () => {
    if (!confirm('Kai-sanを再起動しますか？')) return;
    statusEl.textContent = '再起動中...';
    statusEl.style.color = '#facc15';
    fetch('/api/restart', { method: 'POST' }).catch(() => {});
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (attempts > 30) { clearInterval(poll); statusEl.textContent = 'タイムアウト'; statusEl.style.color = '#f87171'; return; }
      fetch('/api/config', { cache: 'no-store' }).then(r => {
        if (r.ok) { clearInterval(poll); location.reload(); }
      }).catch(() => {});
    }, 1000);
  });

  // --- Panel resize divider ---
  const divider = document.getElementById('divider');
  const leftPanel = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  let dragging = false;

  divider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    divider.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  let fitDebounce = null;
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const totalWidth = document.body.clientWidth;
    const leftWidth = Math.max(200, Math.min(e.clientX, totalWidth - 200));
    const rightWidth = totalWidth - leftWidth - divider.offsetWidth;
    leftPanel.style.flex = 'none';
    leftPanel.style.width = leftWidth + 'px';
    rightPanel.style.flex = 'none';
    rightPanel.style.width = rightWidth + 'px';
    // ドラッグ中は100msデバウンスでfit（カクつき防止）
    clearTimeout(fitDebounce);
    fitDebounce = setTimeout(() => {
      fitAddon.fit();
    }, 100);
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // ドラッグ終了時に確定fit + PTYリサイズ
    clearTimeout(fitDebounce);
    fitAddon.fit();
    // 少し遅延してもう一度fit（レイアウト確定後）
    setTimeout(() => fitAddon.fit(), 50);
  });

  // --- Graph auto-detect: scan terminal output for PNG/image paths ---
  const graphList = document.getElementById('graph-list');
  const graphEmpty = document.getElementById('graph-empty');
  const seenGraphs = new Set();

  function detectAndShowGraphs(text) {
    const clean = stripAnsi(text);
    const pathRegex = /([A-Z]:\\[^\s"'<>|*?]+\.(?:png|jpg|jpeg|svg))/gi;
    const matches = clean.match(pathRegex);
    if (!matches) return;
    for (const imgPath of matches) {
      const normalized = imgPath.replace(/\\/g, '/').toLowerCase();
      if (seenGraphs.has(normalized)) continue;
      seenGraphs.add(normalized);

      graphEmpty.style.display = 'none';

      const card = document.createElement('div');
      card.style.cssText = 'margin-bottom:12px;border:1px solid #333;border-radius:4px;overflow:hidden;cursor:pointer;';

      const header = document.createElement('div');
      header.style.cssText = 'padding:6px 10px;background:#1a1a2e;color:#ccc;font-size:11px;display:flex;justify-content:space-between;align-items:center;';
      const fileName = imgPath.split('\\').pop();
      const nameSpan = document.createElement('span');
      nameSpan.textContent = fileName;
      const toggleSpan = document.createElement('span');
      toggleSpan.style.color = '#666';
      toggleSpan.textContent = 'click to expand';
      header.appendChild(nameSpan);
      header.appendChild(toggleSpan);

      const imgContainer = document.createElement('div');
      imgContainer.style.cssText = 'display:none;background:#111;padding:4px;';
      const img = document.createElement('img');
      img.src = '/view?path=' + encodeURIComponent(imgPath);
      img.style.cssText = 'width:100%;height:auto;display:block;';
      img.alt = fileName;
      imgContainer.appendChild(img);

      let expanded = false;
      header.addEventListener('click', () => {
        expanded = !expanded;
        imgContainer.style.display = expanded ? 'block' : 'none';
        toggleSpan.textContent = expanded ? 'click to collapse' : 'click to expand';
      });

      card.appendChild(header);
      card.appendChild(imgContainer);
      graphList.prepend(card);

      // Auto-switch to Graph tab
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
      document.getElementById('tab-graphs').classList.add('active');
      const graphBtn = document.querySelector('[data-tab="graphs"]');
      if (graphBtn) graphBtn.classList.add('active');

      // Auto-expand first graph
      expanded = true;
      imgContainer.style.display = 'block';
      toggleSpan.textContent = 'click to collapse';
    }
  }

  // Scan terminal output buffer periodically for image paths
  setInterval(() => {
    if (responseBuffer.length > 0) {
      detectAndShowGraphs(responseBuffer);
    }
  }, 3000);

  // Focus terminal by default (user types directly into terminal)
  setTimeout(() => term.focus(), 300);
});
