/**
 * x-worklog.js ��� AI作業の自然言語リアルタイム表示
 *
 * 三世界統合の核心:
 *   右パネル（IT言語）→ DuckDB → 左パネル（自然言語 + 金融数字）
 *
 * 表示位置: FPA と Y の間
 * データ: /api/worklog からポーリング（1秒間隔）
 *
 * 【ブラックボックスゼロの原則】
 * AIが裏で何をやっているか、全て自然言語で説明する。
 * ITの専門用語は使わない。結果の数字は金融言語で正確に示す。
 */

'use strict';

var WORKLOG = {
  container: null,
  pollTimer: null,
  lastId: 0,
  sessionId: null
};

/**
 * Status icons with natural language meaning
 */
var STATUS_DISPLAY = {
  running:   { icon: '⏳', label: '作業中' },
  done:      { icon: '✓',  label: '完了' },
  error:     { icon: '✕',  label: 'エラー' },
  thinking:  { icon: '💭', label: '考え中' },
  searching: { icon: '🔍', label: '探し中' },
  reading:   { icon: '📖', label: '読み込み中' },
  computing: { icon: '🧮', label: '計算中' },
  writing:   { icon: '✏️', label: '作成中' },
  saving:    { icon: '💾', label: '保存中' }
};

/**
 * Create the worklog container and insert it between FPA and Y
 */
function initWorklog(parentEl) {
  WORKLOG.container = document.createElement('div');
  WORKLOG.container.id = 'worklog';
  WORKLOG.container.setAttribute('role', 'log');
  WORKLOG.container.setAttribute('aria-label', '作業の経過');

  // Header
  var header = document.createElement('div');
  header.className = 'worklog-header';
  header.textContent = '━━ 作業の経過 ━━━━━━━━━━━';
  WORKLOG.container.appendChild(header);

  // Log entries area
  var entries = document.createElement('div');
  entries.id = 'worklog-entries';
  entries.className = 'worklog-entries';
  WORKLOG.container.appendChild(entries);

  if (parentEl) {
    parentEl.appendChild(WORKLOG.container);
  }

  return WORKLOG.container;
}

/**
 * Add a single log entry (from server push or local call)
 *
 * entry = {
 *   id: 1,
 *   status: 'running' | 'done' | 'error' | 'thinking' | 'searching' | ...,
 *   natural_text: '過去3年の決算を読み込んでいます',
 *   detail: 'FY2023, FY2024, FY2025 の有価証券報告書',
 *   numbers: 'ROIC 8.0%, WACC 6.2%, スプレッド +1.8%',
 *   ai_explanation: 'ROICがWACCを上回っているので、この会社は価値を創造しています',
 *   timestamp: '2026-04-05T10:23:45'
 * }
 */
function addWorklogEntry(entry) {
  var entries = document.getElementById('worklog-entries');
  if (!entries) return;

  var statusInfo = STATUS_DISPLAY[entry.status] || STATUS_DISPLAY.running;

  // Main row
  var row = document.createElement('div');
  row.className = 'worklog-row worklog-' + entry.status;
  row.dataset.id = entry.id;

  // Icon
  var icon = document.createElement('span');
  icon.className = 'worklog-icon';
  icon.textContent = statusInfo.icon;
  row.appendChild(icon);

  // Natural language text (main message)
  var text = document.createElement('span');
  text.className = 'worklog-text';
  text.textContent = entry.natural_text;
  row.appendChild(text);

  entries.appendChild(row);

  // Detail line (optional — what specifically is being processed)
  if (entry.detail) {
    var detailRow = document.createElement('div');
    detailRow.className = 'worklog-detail';
    detailRow.textContent = '   ' + entry.detail;
    entries.appendChild(detailRow);
  }

  // Numbers line (optional — financial results in exact numbers)
  if (entry.numbers) {
    var numRow = document.createElement('div');
    numRow.className = 'worklog-numbers';
    numRow.textContent = '   📊 ' + entry.numbers;
    entries.appendChild(numRow);
  }

  // AI explanation (optional — WHY this matters, in natural language)
  if (entry.ai_explanation) {
    var explRow = document.createElement('div');
    explRow.className = 'worklog-explanation';
    explRow.textContent = '   💡 ' + entry.ai_explanation;
    entries.appendChild(explRow);
  }

  // Auto-scroll to bottom
  entries.scrollTop = entries.scrollHeight;

  // Update existing running entry to done if same step
  if (entry.status === 'done' || entry.status === 'error') {
    var prevRunning = entries.querySelectorAll('.worklog-running');
    prevRunning.forEach(function(el) {
      if (el.dataset.id && parseInt(el.dataset.id) < entry.id) {
        el.classList.remove('worklog-running');
        el.classList.add('worklog-done');
        var prevIcon = el.querySelector('.worklog-icon');
        if (prevIcon) prevIcon.textContent = '✓';
      }
    });
  }

  WORKLOG.lastId = entry.id;
}

/**
 * Poll server for new worklog entries
 * Server returns entries from DuckDB worklog table
 */
function startPolling(sessionId) {
  WORKLOG.sessionId = sessionId || 'current';

  if (WORKLOG.pollTimer) {
    clearInterval(WORKLOG.pollTimer);
  }

  WORKLOG.pollTimer = setInterval(function() {
    fetch('/api/worklog?after=' + WORKLOG.lastId + '&session=' + WORKLOG.sessionId)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.entries && data.entries.length > 0) {
          data.entries.forEach(addWorklogEntry);
        }
      })
      .catch(function() {
        // Silent fail — will retry next interval
      });
  }, 1000); // 1 second polling
}

function stopPolling() {
  if (WORKLOG.pollTimer) {
    clearInterval(WORKLOG.pollTimer);
    WORKLOG.pollTimer = null;
  }
}

/**
 * Clear the worklog for a new task
 */
function clearWorklog() {
  var entries = document.getElementById('worklog-entries');
  if (entries) {
    while (entries.firstChild) entries.removeChild(entries.firstChild);
  }
  WORKLOG.lastId = 0;
}

/**
 * Show feedback form after task completion
 * 0-5 scale + free comment → gogcli → info-jpr@j-phoenix.com
 */
function showFeedbackForm() {
  var entries = document.getElementById('worklog-entries');
  if (!entries) return;

  // Already shown?
  if (document.getElementById('worklog-feedback')) return;

  var fb = document.createElement('div');
  fb.id = 'worklog-feedback';
  fb.className = 'worklog-feedback';

  // Title
  var title = document.createElement('div');
  title.className = 'feedback-title';
  title.textContent = '📝 改善要望';
  fb.appendChild(title);

  // 0-5 Scale
  var scaleLabel = document.createElement('div');
  scaleLabel.className = 'feedback-label';
  scaleLabel.textContent = '今回の結果に満足していますか？';
  fb.appendChild(scaleLabel);

  var scaleRow = document.createElement('div');
  scaleRow.className = 'feedback-scale';

  var scaleLabels = ['0 不満', '1', '2', '3 普通', '4', '5 満足'];
  var selectedScore = -1;

  scaleLabels.forEach(function(label, i) {
    var btn = document.createElement('button');
    btn.className = 'scale-btn';
    btn.textContent = label;
    btn.dataset.score = i;
    btn.addEventListener('click', function() {
      selectedScore = i;
      scaleRow.querySelectorAll('.scale-btn').forEach(function(b) {
        b.classList.remove('scale-selected');
      });
      btn.classList.add('scale-selected');
    });
    scaleRow.appendChild(btn);
  });
  fb.appendChild(scaleRow);

  // Free comment
  var commentLabel = document.createElement('div');
  commentLabel.className = 'feedback-label';
  commentLabel.textContent = '改善してほしいこと・気づいたこと:';
  fb.appendChild(commentLabel);

  var textarea = document.createElement('textarea');
  textarea.id = 'feedback-comment';
  textarea.className = 'feedback-textarea';
  textarea.placeholder = '例: 計算結果の説明がもう少し詳しいと助かります';
  textarea.rows = 3;
  fb.appendChild(textarea);

  // Send button
  var sendRow = document.createElement('div');
  sendRow.className = 'feedback-send-row';

  var sendBtn = document.createElement('button');
  sendBtn.className = 'feedback-send-btn';
  sendBtn.textContent = '送信';
  sendBtn.addEventListener('click', function() {
    if (selectedScore < 0) {
      alert('満足度（0-5）を選んでください');
      return;
    }
    var comment = textarea.value.trim();
    sendFeedback(selectedScore, comment, sendBtn);
  });
  sendRow.appendChild(sendBtn);

  var dest = document.createElement('span');
  dest.className = 'feedback-dest';
  dest.textContent = '→ JPR（ジェイ・フェニックス・リサーチ）に届きます';
  sendRow.appendChild(dest);

  fb.appendChild(sendRow);

  // Hedge clause
  var hedge = document.createElement('div');
  hedge.className = 'feedback-hedge';
  hedge.textContent = '※ いただいた改善要望は今後のサービス向上の参考とさせていただきますが、必ずしもその内容を反映させることをお約束するものではありません。あらかじめご了承ください。';
  fb.appendChild(hedge);


  entries.appendChild(fb);
  entries.scrollTop = entries.scrollHeight;
}

/**
 * Send feedback via gogcli → info-jpr@j-phoenix.com
 */
function sendFeedback(score, comment, btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = '送信中...';

  var subject = 'Kai-san 改善要望 [Score: ' + score + '/5]';
  var body = '━━ Kai-san 改善要望 ━━\n\n'
    + '満足度: ' + score + ' / 5\n'
    + '日時: ' + new Date().toLocaleString('ja-JP') + '\n';

  if (WORKLOG.sessionId) {
    body += 'セッション: ' + WORKLOG.sessionId + '\n';
  }

  body += '\n━━ コメント ━━\n'
    + (comment || '（コメントなし）') + '\n'
    + '\n━━ 作業経過 ━━\n';

  // Append worklog summary
  var entries = document.getElementById('worklog-entries');
  if (entries) {
    var rows = entries.querySelectorAll('.worklog-row');
    rows.forEach(function(row) {
      var icon = row.querySelector('.worklog-icon');
      var text = row.querySelector('.worklog-text');
      if (icon && text) {
        body += icon.textContent + ' ' + text.textContent + '\n';
      }
    });
  }

  // Send via gogcli (server-side API)
  fetch('/api/send-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'info-jpr@j-phoenix.com',
      subject: subject,
      body: body,
      score: score,
      comment: comment
    })
  })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      btnEl.textContent = '✓ 送信しました';
      btnEl.className = 'feedback-send-btn feedback-sent';

      // Replace form with thank you
      var thankYou = document.createElement('div');
      thankYou.className = 'feedback-thankyou';
      thankYou.textContent = 'ありがとうございます。改善に役立てます。';

      var fb = document.getElementById('worklog-feedback');
      if (fb && fb.parentNode) {
        fb.parentNode.insertBefore(thankYou, fb.nextSibling);
      }
    })
    .catch(function(err) {
      btnEl.disabled = false;
      btnEl.textContent = '送信（再試行）';
      alert('送信に失敗しました。ネットワークを確認してください。');
    });
}

/**
 * Auto-show feedback form when task completes (status: 'done' on final step)
 */
var _originalAddEntry = addWorklogEntry;
addWorklogEntry = function(entry) {
  _originalAddEntry(entry);
  // Show feedback after final completion
  if (entry.status === 'done' && entry.natural_text && entry.natural_text.indexOf('完了') >= 0) {
    setTimeout(showFeedbackForm, 500);
  }
};

/**
 * Demo: show example worklog for testing
 */
function demoWorklog() {
  clearWorklog();

  var steps = [
    { id: 1, status: 'searching', natural_text: 'GSユアサのデータを探しています', delay: 0 },
    { id: 2, status: 'done', natural_text: 'GSユアサ(6674)のフォルダを見つけました', detail: '168テーマ、29ファイルのデータベース', delay: 1500 },
    { id: 3, status: 'reading', natural_text: '過去3年分の決算データを読み込んでいます', detail: 'FY2023/3, FY2024/3, FY2025/3 の有価証券報告書', delay: 3000 },
    { id: 4, status: 'computing', natural_text: 'ROIC（投資の稼ぎ効率）を計算しています', delay: 5000 },
    { id: 5, status: 'done', natural_text: 'ROIC計算完了', numbers: 'ROIC = 9.3%（JPRリーン定義: 余剰現預金を除いた純粋な事業投下資本で計算）', ai_explanation: '業界平均6%を大きく上回っています。事業に使ったお金を効率よく利益に変えています。', delay: 7000 },
    { id: 6, status: 'computing', natural_text: 'WACC（お金を集めるコスト）を計算しています', detail: 'β=1.05（同業他社との比較から推定）、株主の期待リターン7.3%、銀行の金利0.56%', delay: 9000 },
    { id: 7, status: 'done', natural_text: 'WACC計算完了', numbers: 'WACC = 6.0%（株主80%×7.3% + 銀行20%×0.56%）', ai_explanation: 'WACCが6.0%ということは、「最低でも6%以上稼がないとお金を集めるコストすら払えない」ということです。', delay: 11000 },
    { id: 8, status: 'done', natural_text: 'スプレッド（真の儲け率）を算出', numbers: 'スプレッド = ROIC 9.3% − WACC 6.0% = +3.3%', ai_explanation: '資本コストを3.3%上回って稼いでいます。つまり投下資本300億円に対して、毎年約10億円の「本当の価値」を創造しています。', delay: 13000 },
    { id: 9, status: 'writing', natural_text: 'GCC評価レポートをHTML形式で作成しています', delay: 15000 },
    { id: 10, status: 'saving', natural_text: 'PDFに変換して保存しています', detail: 'G:\\clients\\6674\\reports\\GCC評価_2026-04-05.pdf', delay: 17000 },
    { id: 11, status: 'done', natural_text: '完了しました！', ai_explanation: 'GSユアサはスプレッド+3.3%で堅実に価値を創造しています。Growth（EV市場拡大）に注目すると、さらにMVCが伸びる可能性があります。', delay: 19000 }
  ];

  steps.forEach(function(step) {
    setTimeout(function() {
      addWorklogEntry(step);
    }, step.delay);
  });
}
