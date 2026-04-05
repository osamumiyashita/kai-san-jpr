/**
 * navigator-api.js — Server-side API for Navigator (FC / X / FP / Y)
 *
 * Scans ~/.claude/ to populate FC items.
 * Returns items with display names, descriptions, paths.
 *
 * PF原則: 関心の分離 — server.js はルーティングのみ、このファイルがナビゲーターロジック。
 */

'use strict';

const fs = require('fs');
const path = require('path');

// .claude base directory
const CLAUDE_HOME = path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude');

const MAX_BODY_BYTES = 1024 * 1024; // 1MB limit

function safeReadBody(req) {
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

// ===== Helpers =====

function readFrontmatter(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!m) return {};
    const fm = {};
    for (const line of m[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        fm[key] = val;
      }
    }
    return fm;
  } catch { return {}; }
}

function extractTitle(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    // Try frontmatter name/description
    const fm = readFrontmatter(filePath);
    if (fm.name) return fm.name;
    if (fm.description) return fm.description.slice(0, 60);
    // Try first # heading
    const headingMatch = text.match(/^#\s+(.+)/m);
    if (headingMatch) return headingMatch[1].slice(0, 60);
    // Fallback to filename
    return path.basename(filePath, path.extname(filePath));
  } catch {
    return path.basename(filePath, path.extname(filePath));
  }
}

function extractDescription(filePath) {
  try {
    const fm = readFrontmatter(filePath);
    if (fm.description) return fm.description.slice(0, 80);
    const text = fs.readFileSync(filePath, 'utf-8');
    // First non-empty, non-heading, non-frontmatter line
    const lines = text.split('\n');
    let inFm = false;
    for (const line of lines) {
      if (line.trim() === '---') { inFm = !inFm; continue; }
      if (inFm) continue;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      return trimmed.slice(0, 80);
    }
    return '';
  } catch { return ''; }
}

function humanName(filename) {
  // Convert kebab-case filename to display name
  return filename
    .replace(/\.md\.enc$/, '')
    .replace(/\.md$/, '')
    .replace(/\.py$/, '')
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function listMdFiles(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(f => (f.endsWith('.md') || f.endsWith('.md.enc')) && !f.startsWith('_') && !f.startsWith('.'))
      .sort();
  } catch { return []; }
}

function listPyFiles(dir, depth) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name.startsWith('_') || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name.endsWith('.py')) {
        results.push(full);
      } else if (e.isDirectory() && (depth || 0) < 2) {
        results.push(...listPyFiles(full, (depth || 0) + 1));
      }
    }
  } catch {}
  return results;
}

// ===== FC Scanner =====

function scanFC(category) {
  const items = [];

  switch (category) {
    case 'rules': {
      const dir = path.join(CLAUDE_HOME, 'rules');
      for (const f of listMdFiles(dir)) {
        const fp = path.join(dir, f);
        items.push({
          name: f,
          display_name: extractTitle(fp),
          tooltip: extractDescription(fp),
          hint: f.replace('.md', ''),
          path: fp,
        });
      }
      break;
    }
    case 'commands': {
      const dir = path.join(CLAUDE_HOME, 'commands');
      for (const f of listMdFiles(dir)) {
        const fp = path.join(dir, f);
        const fm = readFrontmatter(fp);
        items.push({
          name: f,
          display_name: fm.name || '/' + f.replace('.md', ''),
          tooltip: fm.description || extractDescription(fp),
          hint: '/' + f.replace('.md', ''),
          path: fp,
        });
      }
      break;
    }
    case 'skills': {
      const dir = path.join(CLAUDE_HOME, 'skills');
      for (const f of listMdFiles(dir)) {
        const fp = path.join(dir, f);
        const fm = readFrontmatter(fp);
        items.push({
          name: f,
          display_name: fm.name || humanName(f),
          tooltip: fm.description || extractDescription(fp),
          hint: f.replace('.md', ''),
          path: fp,
        });
      }
      break;
    }
    case 'agents': {
      const dir = path.join(CLAUDE_HOME, 'agents');
      for (const f of listMdFiles(dir)) {
        const fp = path.join(dir, f);
        const fm = readFrontmatter(fp);
        items.push({
          name: f,
          display_name: fm.name || humanName(f),
          tooltip: fm.description || extractDescription(fp),
          hint: f.replace('.md', ''),
          path: fp,
        });
      }
      break;
    }
    case 'pf': {
      const dir = path.join(CLAUDE_HOME, 'py');
      const pyFiles = listPyFiles(dir);
      for (const fp of pyFiles) {
        const rel = path.relative(dir, fp);
        items.push({
          name: path.basename(fp),
          display_name: humanName(path.basename(fp)),
          tooltip: 'py/' + rel,
          hint: rel.replace(/\\/g, '/'),
          path: fp,
        });
      }
      break;
    }
    case 'memory': {
      const dir = path.join(CLAUDE_HOME, 'memory');
      for (const f of listMdFiles(dir)) {
        if (f === 'MEMORY.md' || f === 'MEMORY.md.enc') continue;
        const fp = path.join(dir, f);
        const isEnc = f.endsWith('.enc');
        // Encrypted files: use filename only. Plain files: read frontmatter.
        if (isEnc) {
          const baseName = f.replace('.md.enc', '');
          const typeMatch = baseName.match(/^(feedback|project|user|reference)_/);
          items.push({
            name: f,
            display_name: humanName(baseName),
            tooltip: '暗号化メモリ',
            hint: typeMatch ? typeMatch[1] : 'memory',
            path: fp,
          });
        } else {
          const fm = readFrontmatter(fp);
          items.push({
            name: f,
            display_name: fm.name || humanName(f),
            tooltip: fm.description || extractDescription(fp),
            hint: fm.type || 'memory',
            path: fp,
          });
        }
      }
      break;
    }
    case 'macro': {
      // Load from localStorage equivalent (server-side JSON file)
      const macroFile = path.join(CLAUDE_HOME, 'kai-san-chat', 'macros.json');
      try {
        const macros = JSON.parse(fs.readFileSync(macroFile, 'utf-8'));
        for (const m of macros) {
          items.push({
            name: m.id || m.name,
            display_name: (m.icon || '') + ' ' + m.name,
            tooltip: 'FC: ' + (m.fc || []).length + '件, 形式: ' + (m.formats || []).join(','),
            hint: 'マクロ',
            path: macroFile,
          });
        }
      } catch {}
      break;
    }
  }

  return items;
}

function scanFCCounts() {
  const counts = {};
  const categories = ['rules', 'commands', 'skills', 'agents', 'pf', 'memory', 'macro'];
  for (const cat of categories) {
    counts[cat] = scanFC(cat).length;
  }
  return counts;
}

// ===== API Handler =====

function handleNavigatorAPI(req, res, url) {
  const json = (data) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  // GET /api/navigator/fc?category=rules
  if (url.startsWith('/api/navigator/fc') && !url.includes('fc-counts')) {
    const params = new URL(url, 'http://localhost').searchParams;
    const category = params.get('category') || 'rules';
    const items = scanFC(category);
    json({ items });
    return true;
  }

  // GET /api/navigator/fc-counts
  if (url.startsWith('/api/navigator/fc-counts')) {
    json(scanFCCounts());
    return true;
  }

  // POST /api/navigator/generate-fpa
  if (url === '/api/navigator/generate-fpa' && req.method === 'POST') {
    safeReadBody(req).then(({ fph }) => {
      const fpa = generateFPATemplate(fph);
      json({ fpa });
    }).catch(e => {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.message }));
    });
    return true;
  }

  // POST /api/navigator/save-macro
  if (url === '/api/navigator/save-macro' && req.method === 'POST') {
    safeReadBody(req).then(macro => {
      const macroFile = path.join(CLAUDE_HOME, 'kai-san-chat', 'macros.json');
      let macros = [];
      try { macros = JSON.parse(fs.readFileSync(macroFile, 'utf-8')); } catch {}
      macros.push({ ...macro, created: new Date().toISOString() });
      fs.writeFileSync(macroFile, JSON.stringify(macros, null, 2), 'utf-8');
      json({ ok: true, count: macros.length });
    }).catch(e => {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.message }));
    });
    return true;
  }

  return false; // not handled
}

// ===== FPA Template Generator =====

function generateFPATemplate(fph) {
  if (!fph || fph.length < 2) return '（指示が短すぎます。もう少し詳しく教えてください）';

  const lower = fph.toLowerCase();
  const parts = [];

  // Detect intent
  let structure = 'analysis';
  let meaning = 'general';
  const fcSuggestions = [];
  const xSuggestions = [];

  // Financial keywords
  if (/wacc|roic|eva|pbr|dcf|資本コスト|スプレッド/.test(lower)) {
    meaning = 'financial';
    fcSuggestions.push('jpr-master-file-gateway.md', 'wacc_calculator.py');
    xSuggestions.push('FactSet WACC Master');
  }
  if (/gcc|growth|connection|confidence/.test(lower)) {
    meaning = 'gcc';
    fcSuggestions.push('gcc-guideline.md');
  }
  if (/ir|開示|統合報告|評価/.test(lower)) {
    meaning = 'ir';
    fcSuggestions.push('tse-ir-evaluation.md');
  }
  if (/決算|短信|四半期|レビュー/.test(lower)) {
    meaning = 'financial';
    fcSuggestions.push('create-ir-review.md');
    structure = 'report';
  }

  // Report keywords
  if (/レポート|報告|作成|作って/.test(lower)) structure = 'report';
  if (/提案|改善/.test(lower)) structure = 'proposal';
  if (/分析|計算|比較/.test(lower)) structure = 'analysis';

  // Company detection
  const companyMatch = fph.match(/(\d{4})|日特|gsユアサ|ハーバー|ハピネス/i);
  if (companyMatch) {
    xSuggestions.push('Enterprise DB (' + companyMatch[0] + ')');
  }

  // Build FPA
  parts.push('【実行計画】');
  parts.push('');
  parts.push('FC（使う能力）:');
  if (fcSuggestions.length > 0) {
    fcSuggestions.forEach(fc => parts.push('  - ' + fc));
  } else {
    parts.push('  - （自動選択）');
  }
  parts.push('');
  parts.push('X（使うデータ）:');
  if (xSuggestions.length > 0) {
    xSuggestions.forEach(x => parts.push('  - ' + x));
  } else {
    parts.push('  - （指示から自動検出）');
  }
  parts.push('');
  parts.push('処理:');
  parts.push('  1. データ取得・検証');
  parts.push('  2. ' + (meaning === 'gcc' ? 'GCC 3軸評価' : meaning === 'financial' ? '財務指標計算' : '分析'));
  if (structure === 'report') {
    parts.push('  3. レポート生成（HTML A4横）');
    parts.push('  4. PDF変換');
  } else if (structure === 'proposal') {
    parts.push('  3. 改善提案作成');
    parts.push('  4. 提案書生成（HTML A4横）');
  } else {
    parts.push('  3. 結果をまとめて表示');
  }
  parts.push('');
  parts.push('Y（成果物）:');
  parts.push('  形式: MD' + (structure === 'report' ? ' → HTML → PDF' : ''));
  parts.push('  保存: ~/output/');

  return parts.join('\n');
}

module.exports = { handleNavigatorAPI };
