/**
 * rpa-api.js — RPA (Playwright Codegen) API handler
 * §17-7: Separate file. server.js only routes here.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RPA_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.claude', 'py', 'rpa');
const CMD_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.claude', 'commands');
const REGISTRY = path.join(RPA_DIR, 'registry.json');
const MAX_RECORD_MS = 30 * 60 * 1000; // 30 min timeout

let activeRecording = null; // { name, url, pid, process, outputPath, startTime, timeout }
let activeReplay = null;    // { name, pid, process, startTime }

// Ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(RPA_DIR)) fs.mkdirSync(RPA_DIR, { recursive: true });
  if (!fs.existsSync(CMD_DIR)) fs.mkdirSync(CMD_DIR, { recursive: true });
}

// Read registry
function readRegistry() {
  ensureDirs();
  if (!fs.existsSync(REGISTRY)) return { rpas: [] };
  try { return JSON.parse(fs.readFileSync(REGISTRY, 'utf-8')); }
  catch { return { rpas: [] }; }
}

// Write registry
function writeRegistry(data) {
  ensureDirs();
  fs.writeFileSync(REGISTRY, JSON.stringify(data, null, 2), 'utf-8');
}

// Generate slash command MD
function generateSlashCommand(name, url, scriptPath) {
  const date = new Date().toISOString().slice(0, 10);
  const md = `---
description: "RPA: ${name} (${url})"
---

# RPA Replay: ${name}

Replay the recorded browser automation "${name}".

## How to run

\`\`\`bash
python "${scriptPath}"
\`\`\`

## Details
- **URL**: ${url}
- **Recorded**: ${date}
- **Script**: \`${scriptPath}\`

## What this does
This script replays the browser actions that were recorded on ${url}.
It will open a Chromium browser and execute the recorded clicks, typing, and navigation.
`;
  const cmdPath = path.join(CMD_DIR, `rpa-${name}.md`);
  fs.writeFileSync(cmdPath, md, 'utf-8');
  return cmdPath;
}

// Generate FPA (AI-friendly prompt) from recorded script
function generateFPA(name, url, scriptPath) {
  if (!fs.existsSync(scriptPath)) return null;
  const code = fs.readFileSync(scriptPath, 'utf-8');

  // Extract human-readable steps from playwright code
  const steps = [];
  const lines = code.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('page.goto(')) {
      const m = trimmed.match(/page\.goto\("([^"]+)"\)/);
      if (m) steps.push(`Navigate to: ${m[1]}`);
    } else if (trimmed.startsWith('page.click(') || trimmed.startsWith('page.get_by_')) {
      if (trimmed.includes('.click(')) {
        const m = trimmed.match(/["']([^"']+)["']/);
        steps.push(`Click: ${m ? m[1] : trimmed}`);
      } else if (trimmed.includes('.fill(')) {
        const parts = trimmed.match(/\.fill\(["']([^"']*)["']\)/);
        steps.push(`Type: "${parts ? parts[1] : '...'}" into field`);
      }
    } else if (trimmed.includes('.fill(')) {
      const sel = trimmed.match(/["']([^"']+)["'].*\.fill\(["']([^"']*)["']\)/);
      if (sel) steps.push(`Type "${sel[2]}" into "${sel[1]}"`);
    } else if (trimmed.includes('.press(')) {
      const m = trimmed.match(/\.press\(["']([^"']+)["']\)/);
      if (m) steps.push(`Press key: ${m[1]}`);
    } else if (trimmed.includes('.select_option(')) {
      const m = trimmed.match(/\.select_option\(["']([^"']+)["']\)/);
      if (m) steps.push(`Select option: ${m[1]}`);
    }
  }

  const stepsText = steps.length > 0
    ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : '(No steps extracted — see raw script below)';

  const fpa = `# RPA: ${name}
## Target: ${url}
## Recorded: ${new Date().toISOString().slice(0, 10)}

## Steps (human-readable):
${stepsText}

## Instructions for AI:
Please perform the following browser automation on ${url}:
${stepsText}

## Raw Playwright Python script:
\`\`\`python
${code}
\`\`\`

## How to replay:
\`\`\`bash
python "${scriptPath}"
\`\`\`
`;
  // Save FPA as .md next to script
  const fpaPath = path.join(RPA_DIR, `${name}_fpa.md`);
  fs.writeFileSync(fpaPath, fpa, 'utf-8');
  return { fpa, fpaPath };
}

// Parse JSON body from request (with 1MB size limit)
const MAX_BODY_BYTES = 1024 * 1024;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { req.destroy(); reject(new Error('Request body too large')); return; }
      body += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// JSON response helper
function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ── API Handler ──────────────────────────────────────────────
function handleRpaAPI(req, res, url) {
  const route = url.split('?')[0].replace('/api/rpa', '');
  const params = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');

  // GET /api/rpa/list
  if (route === '/list' && req.method === 'GET') {
    const reg = readRegistry();
    json(res, 200, reg);
    return true;
  }

  // GET /api/rpa/status
  if (route === '/status' && req.method === 'GET') {
    const state = {
      recording: activeRecording ? {
        name: activeRecording.name,
        url: activeRecording.url,
        elapsed: Date.now() - activeRecording.startTime
      } : null,
      replay: activeReplay ? {
        name: activeReplay.name,
        elapsed: Date.now() - activeReplay.startTime
      } : null
    };
    json(res, 200, state);
    return true;
  }

  // POST /api/rpa/record
  if (route === '/record' && req.method === 'POST') {
    parseBody(req).then(body => {
      const { name, url: targetUrl } = body;
      if (!name || !targetUrl) return json(res, 400, { error: '名前とURLを入力してください' });
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) return json(res, 400, { error: '名前は英数字・ハイフン・アンダースコアのみ' });
      if (activeRecording) return json(res, 409, { error: '録画中です。先に停止してください' });

      // Check duplicate
      const reg = readRegistry();
      if (reg.rpas.some(r => r.name === name)) return json(res, 409, { error: `"${name}" は既に存在します` });

      ensureDirs();
      const outputPath = path.join(RPA_DIR, `${name}.py`);

      const proc = spawn('python', [
        '-m', 'playwright', 'codegen',
        '--target', 'python',
        targetUrl,
        '-o', outputPath
      ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false });

      activeRecording = {
        name, url: targetUrl, pid: proc.pid,
        process: proc, outputPath, startTime: Date.now(),
        timeout: setTimeout(() => {
          if (activeRecording && activeRecording.pid === proc.pid) {
            try { proc.kill(); } catch {}
            activeRecording = null;
          }
        }, MAX_RECORD_MS)
      };

      proc.on('close', (code) => {
        if (activeRecording && activeRecording.pid === proc.pid) {
          clearTimeout(activeRecording.timeout);
          activeRecording = null;
        }
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10) {
          const cmdPath = generateSlashCommand(name, targetUrl, outputPath);
          const fpaResult = generateFPA(name, targetUrl, outputPath);
          const r = readRegistry();
          r.rpas.push({
            name, url: targetUrl, scriptPath: outputPath, commandPath: cmdPath,
            fpaPath: fpaResult ? fpaResult.fpaPath : null,
            createdAt: new Date().toISOString(),
            lastReplayed: null, replayCount: 0
          });
          writeRegistry(r);
        }
      });

      proc.on('error', (err) => {
        if (activeRecording && activeRecording.pid === proc.pid) {
          clearTimeout(activeRecording.timeout);
          activeRecording = null;
        }
      });

      json(res, 200, { ok: true, pid: proc.pid, name, status: 'recording' });
    }).catch(e => json(res, 400, { error: e.message }));
    return true;
  }

  // POST /api/rpa/stop
  if (route === '/stop' && req.method === 'POST') {
    if (!activeRecording) return json(res, 400, { error: '録画中ではありません' }), true;
    try {
      activeRecording.process.kill();
      clearTimeout(activeRecording.timeout);
    } catch {}
    activeRecording = null;
    json(res, 200, { ok: true });
    return true;
  }

  // POST /api/rpa/replay
  if (route === '/replay' && req.method === 'POST') {
    parseBody(req).then(body => {
      const { name } = body;
      const reg = readRegistry();
      const entry = reg.rpas.find(r => r.name === name);
      if (!entry) return json(res, 404, { error: `"${name}" が見つかりません` });
      if (!fs.existsSync(entry.scriptPath)) return json(res, 404, { error: 'スクリプトファイルが見つかりません' });
      if (activeReplay) return json(res, 409, { error: '再生中です。完了をお待ちください' });

      const proc = spawn('python', [entry.scriptPath], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false });
      activeReplay = { name, pid: proc.pid, process: proc, startTime: Date.now() };

      proc.on('close', () => {
        activeReplay = null;
        // Update replay count
        entry.lastReplayed = new Date().toISOString();
        entry.replayCount = (entry.replayCount || 0) + 1;
        writeRegistry(reg);
      });
      proc.on('error', () => { activeReplay = null; });

      json(res, 200, { ok: true, pid: proc.pid, name, status: 'replaying' });
    }).catch(e => json(res, 400, { error: e.message }));
    return true;
  }

  // DELETE /api/rpa/delete
  if (route === '/delete' && req.method === 'POST') {
    parseBody(req).then(body => {
      const { name } = body;
      const reg = readRegistry();
      const idx = reg.rpas.findIndex(r => r.name === name);
      if (idx === -1) return json(res, 404, { error: `"${name}" が見つかりません` });
      const entry = reg.rpas[idx];
      // Remove files
      try { if (fs.existsSync(entry.scriptPath)) fs.unlinkSync(entry.scriptPath); } catch {}
      try { if (fs.existsSync(entry.commandPath)) fs.unlinkSync(entry.commandPath); } catch {}
      try { if (entry.fpaPath && fs.existsSync(entry.fpaPath)) fs.unlinkSync(entry.fpaPath); } catch {}
      reg.rpas.splice(idx, 1);
      writeRegistry(reg);
      json(res, 200, { ok: true });
    }).catch(e => json(res, 400, { error: e.message }));
    return true;
  }

  // GET /api/rpa/script?name=xxx
  if (route === '/script' && req.method === 'GET') {
    const name = params.get('name');
    const reg = readRegistry();
    const entry = reg.rpas.find(r => r.name === name);
    if (!entry || !fs.existsSync(entry.scriptPath)) return json(res, 404, { error: 'Not found' }), true;
    const code = fs.readFileSync(entry.scriptPath, 'utf-8');
    json(res, 200, { name, code });
    return true;
  }

  // GET /api/rpa/fpa?name=xxx
  if (route === '/fpa' && req.method === 'GET') {
    const name = params.get('name');
    const reg = readRegistry();
    const entry = reg.rpas.find(r => r.name === name);
    if (!entry) return json(res, 404, { error: 'Not found' }), true;
    // Generate FPA on-the-fly if not cached
    if (!entry.fpaPath || !fs.existsSync(entry.fpaPath)) {
      const result = generateFPA(name, entry.url, entry.scriptPath);
      if (!result) return json(res, 404, { error: 'Script not found' }), true;
      entry.fpaPath = result.fpaPath;
      writeRegistry(reg);
      json(res, 200, { name, fpa: result.fpa });
    } else {
      const fpa = fs.readFileSync(entry.fpaPath, 'utf-8');
      json(res, 200, { name, fpa });
    }
    return true;
  }

  return false;
}

module.exports = { handleRpaAPI };
