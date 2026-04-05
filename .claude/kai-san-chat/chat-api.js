// chat-api.js — Chat DuckDB persistence (§17-7: separate file, server.js stays routing-only)
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const duckdb = require('duckdb');

const DB_PATH = path.join(__dirname, 'chat-history', 'chat.duckdb');
let db = null;
let con = null;

// ═══════════════════════════════════════════════════════════
// DB Init
// ═══════════════════════════════════════════════════════════
function initDb() {
  if (con) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new duckdb.Database(DB_PATH);
    con = new duckdb.Connection(db);
    const ddl = `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR PRIMARY KEY,
        ts TIMESTAMP NOT NULL,
        type VARCHAR NOT NULL,
        text VARCHAR NOT NULL,
        important BOOLEAN DEFAULT FALSE,
        session_id VARCHAR,
        category VARCHAR
      );
      CREATE INDEX IF NOT EXISTS idx_chat_ts ON chat_messages(ts);
      CREATE INDEX IF NOT EXISTS idx_chat_important ON chat_messages(important);
    `;
    con.exec(ddl, (err) => {
      if (err) { console.error('chat-api initDb error:', err.message); reject(err); return; }
      console.log('chat-api: DuckDB ready at', DB_PATH);
      resolve();
    });
  });
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════
const MAX_BODY_BYTES = 1024 * 1024; // 1MB limit

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { req.destroy(); reject(new Error('Request body too large')); return; }
      body += chunk;
    });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function jsonResponse(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function query(sql, params) {
  return new Promise((resolve, reject) => {
    if (params && params.length > 0) {
      const stmt = con.prepare(sql);
      stmt.all(...params, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
        stmt.finalize();
      });
    } else {
      con.all(sql, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    }
  });
}

function run(sql, params) {
  return new Promise((resolve, reject) => {
    if (params && params.length > 0) {
      const stmt = con.prepare(sql);
      stmt.run(...params, (err) => {
        if (err) reject(err); else resolve();
        stmt.finalize();
      });
    } else {
      con.run(sql, (err) => {
        if (err) reject(err); else resolve();
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════
// Range to SQL interval
// ═══════════════════════════════════════════════════════════
function rangeToInterval(range) {
  switch (range) {
    case '1d': return "INTERVAL 1 DAY";
    case '3d': return "INTERVAL 3 DAY";
    case '1w': return "INTERVAL 7 DAY";
    case '1m': return "INTERVAL 30 DAY";
    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════
// Category rules
// ═══════════════════════════════════════════════════════════
const CAT_RULES = [
  [/wacc|roic|eva|pbr|dcf|β|ベータ|資本コスト|スプレッド/i, '財務分析', 'バリュエーション'],
  [/決算|短信|四半期|通期|業績|増収|減益|売上|営業利益/i, '財務分析', '決算・業績'],
  [/gcc|growth|connection|confidence|9box/i, 'GCC', 'フレームワーク'],
  [/mvc|yvc|sg100y|mova|価値創造/i, 'GCC', 'MVC・SG100Y'],
  [/ir|開示|統合報告|アワード|投資家|アナリスト/i, 'IR・開示', 'レポート'],
  [/tse|12因子|スコアカード|評価/i, 'IR・開示', '評価'],
  [/html|css|python|node|コード|バグ|エラー|fix|build/i, '技術', '開発'],
  [/hook|rule|skill|command|agent|設定|config/i, '技術', 'システム設定'],
  [/kai|海|チャット|ksc|kc|ターミナル/i, '技術', 'Kai-san Chat'],
  [/edinet|factset|duckdb|excel|データ/i, 'データ', 'データソース'],
  [/検索|folder|search|探/i, 'データ', '検索'],
  [/日特|1929|nittoc|gsユアサ|6674|ハーバー|4925/i, 'クライアント', '企業分析'],
  [/メール|slack|gmail|会議|ミーティング/i, 'コミュニケーション', '連絡'],
  [/論文|paper|spis|ラプラス|数学/i, '研究', '論文'],
  [/戦略|計画|ロードマップ|next|what/i, '戦略', '計画'],
];

function categorize(text) {
  for (const [re, cat, sub] of CAT_RULES) {
    if (re.test(text)) return { cat, sub };
  }
  return { cat: 'その他', sub: '一般' };
}

// ═══════════════════════════════════════════════════════════
// API Handlers
// ═══════════════════════════════════════════════════════════

async function handleSave(req, res) {
  const msg = await readBody(req);
  const id = crypto.randomUUID();
  const ts = new Date().toISOString();
  const { cat } = msg.type === 'you' ? categorize(msg.text || '') : { cat: null };
  await run(
    `INSERT INTO chat_messages (id, ts, type, text, important, category)
     VALUES (?, ?, ?, ?, FALSE, ?)`,
    [id, ts, msg.type, msg.text, cat]
  );
  jsonResponse(res, 200, { ok: true, id });
}

async function handleHistory(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const range = params.get('range') || '1d';
  const interval = rangeToInterval(range);

  let sql;
  if (!interval) {
    sql = `SELECT id, ts, type, text, important, category FROM chat_messages ORDER BY ts ASC`;
  } else {
    sql = `SELECT id, ts, type, text, important, category FROM chat_messages
           WHERE important = TRUE OR ts >= CURRENT_TIMESTAMP - ${interval}
           ORDER BY ts ASC`;
  }
  const rows = await query(sql);
  jsonResponse(res, 200, rows);
}

async function handleImportance(req, res) {
  const body = await readBody(req);
  if (!body.id) { jsonResponse(res, 400, { error: 'id required' }); return; }
  await run(
    `UPDATE chat_messages SET important = NOT important WHERE id = ?`,
    [body.id]
  );
  const rows = await query(`SELECT id, important FROM chat_messages WHERE id = ?`, [body.id]);
  jsonResponse(res, 200, { ok: true, important: rows[0]?.important ?? false });
}

async function handleSearch(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const q = params.get('q') || '';
  if (q.length < 2) { jsonResponse(res, 200, []); return; }
  const rows = await query(
    `SELECT id, ts, type, text, important, category FROM chat_messages
     WHERE text ILIKE ?
     ORDER BY ts DESC LIMIT 50`,
    ['%' + q + '%']
  );
  jsonResponse(res, 200, rows);
}

async function handleSuggestions(req, res) {
  const rows = await query(
    `SELECT DISTINCT text, ts FROM chat_messages
     WHERE type = 'you' AND LENGTH(text) >= 5 AND LENGTH(text) <= 100
     ORDER BY ts DESC LIMIT 20`
  );
  const suggestions = rows.map(r => ({ text: r.text, date: String(r.ts).slice(0, 10) }));
  jsonResponse(res, 200, suggestions);
}

async function handleCategories(req, res) {
  const rows = await query(
    `SELECT id, ts, type, text, category FROM chat_messages
     WHERE type = 'you' AND LENGTH(text) >= 3 AND LENGTH(text) <= 200
     ORDER BY ts DESC LIMIT 500`
  );

  const seen = new Set();
  const allQ = [];
  for (const r of rows) {
    const key = r.text.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      allQ.push({ id: r.id, text: r.text.trim(), date: String(r.ts).slice(0, 10), ts: r.ts });
    }
  }

  const categories = {};
  const crosslinks = {};
  for (const q of allQ) {
    let matched = false;
    const qCats = [];
    for (const [re, cat, sub] of CAT_RULES) {
      if (re.test(q.text)) {
        if (!categories[cat]) categories[cat] = {};
        if (!categories[cat][sub]) categories[cat][sub] = [];
        if (!categories[cat][sub].some(x => x.id === q.id)) {
          categories[cat][sub].push(q);
        }
        qCats.push(cat + '/' + sub);
        matched = true;
      }
    }
    if (!matched) {
      if (!categories['その他']) categories['その他'] = {};
      if (!categories['その他']['一般']) categories['その他']['一般'] = [];
      categories['その他']['一般'].push(q);
      qCats.push('その他/一般');
    }
    if (qCats.length > 1) crosslinks[q.id] = qCats;
  }

  const result = Object.entries(categories).map(([cat, subs]) => ({
    name: cat,
    count: Object.values(subs).reduce((s, arr) => s + arr.length, 0),
    subcategories: Object.entries(subs).map(([sub, items]) => ({
      name: sub,
      items: items.sort((a, b) => String(b.date).localeCompare(String(a.date))),
    })).sort((a, b) => b.items.length - a.items.length),
  })).sort((a, b) => b.count - a.count);

  jsonResponse(res, 200, { categories: result, crosslinks });
}

async function handleMigrate(req, res) {
  const histDir = path.join(__dirname, 'chat-history');
  if (!fs.existsSync(histDir)) { jsonResponse(res, 200, { migrated: 0 }); return; }

  const files = fs.readdirSync(histDir).filter(f => f.endsWith('.jsonl'));
  let count = 0;
  for (const file of files) {
    const filePath = path.join(histDir, file);
    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const m = JSON.parse(line);
        const id = crypto.randomUUID();
        const ts = m.ts || file.replace('.jsonl', '') + 'T00:00:00';
        const { cat } = m.type === 'you' ? categorize(m.text || '') : { cat: null };
        await run(
          `INSERT INTO chat_messages (id, ts, type, text, important, category)
           VALUES (?, ?, ?, ?, FALSE, ?)`,
          [id, ts, m.type, m.text, cat]
        );
        count++;
      } catch (e) { /* skip malformed lines */ }
    }
    fs.renameSync(filePath, filePath + '.migrated');
  }
  jsonResponse(res, 200, { migrated: count, files: files.length });
}

// ═══════════════════════════════════════════════════════════
// Router
// ═══════════════════════════════════════════════════════════
function handleChatAPI(req, res, url) {
  const handle = async () => {
    await initDb();

    if (url === '/api/chat/save' && req.method === 'POST') {
      await handleSave(req, res); return true;
    }
    if (url.startsWith('/api/chat/history')) {
      await handleHistory(req, res); return true;
    }
    if (url === '/api/chat/importance' && req.method === 'POST') {
      await handleImportance(req, res); return true;
    }
    if (url.startsWith('/api/chat/search')) {
      await handleSearch(req, res); return true;
    }
    if (url.startsWith('/api/chat/suggestions')) {
      await handleSuggestions(req, res); return true;
    }
    if (url.startsWith('/api/chat/categories')) {
      await handleCategories(req, res); return true;
    }
    if (url === '/api/chat/migrate' && req.method === 'POST') {
      await handleMigrate(req, res); return true;
    }
    return false;
  };

  handle().catch(err => {
    console.error('chat-api error:', err.message);
    jsonResponse(res, 500, { error: err.message });
  });

  return true;
}

module.exports = { handleChatAPI };
