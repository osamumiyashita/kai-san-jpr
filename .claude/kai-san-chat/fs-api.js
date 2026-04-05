/**
 * fs-api.js — Filesystem API handler (drives, bookmarks, list, tab-complete)
 * §17-7: Separate file. server.js only routes here.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const MAX_BODY_BYTES = 1024 * 1024;

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

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function handleFsAPI(req, res, url) {
  // /api/fs/drives
  if (url === '/api/fs/drives') {
    if (process.platform !== 'win32') { json(res, 200, { drives: ['/'] }); return true; }
    execFile('wmic', ['logicaldisk', 'get', 'name'], { encoding: 'utf-8' }, (err, stdout) => {
      const drives = (stdout || '').split('\n').map(l => l.trim()).filter(l => /^[A-Z]:$/.test(l)).sort();
      json(res, 200, { drives });
    });
    return true;
  }

  // /api/fs/bookmarks
  if (url.startsWith('/api/fs/bookmarks')) {
    const bmFile = path.join(__dirname, 'explorer-bookmarks.json');
    const loadBm = () => { try { return JSON.parse(fs.readFileSync(bmFile, 'utf-8')); } catch { return []; } };
    const saveBm = (bm) => fs.writeFileSync(bmFile, JSON.stringify(bm, null, 2), 'utf-8');
    const toRelative = (p) => { try { const r = path.relative(__dirname, p); return path.isAbsolute(r) ? p : r; } catch { return p; } };
    const toAbsolute = (p) => path.isAbsolute(p) ? p : path.resolve(__dirname, p);

    if (req.method === 'GET') {
      const bm = loadBm().map(b => ({ ...b, absolute: toAbsolute(b.path) }));
      json(res, 200, bm);
      return true;
    }
    if (req.method === 'POST') {
      readBody(req).then(({ path: absPath, label }) => {
        const bm = loadBm();
        const rel = toRelative(absPath);
        if (!bm.some(b => b.path === rel)) {
          bm.push({ path: rel, label: label || path.basename(absPath), added: new Date().toISOString() });
          saveBm(bm);
        }
        json(res, 200, { ok: true, stored: rel });
      }).catch(e => json(res, 400, { error: e.message }));
      return true;
    }
    if (req.method === 'DELETE') {
      readBody(req).then(({ path: delPath }) => {
        const bm = loadBm().filter(b => b.path !== delPath);
        saveBm(bm);
        json(res, 200, { ok: true });
      }).catch(e => json(res, 400, { error: e.message }));
      return true;
    }
    return false;
  }

  // /api/fs?path=...
  if (url.startsWith('/api/fs?')) {
    const params = new URL(url, 'http://localhost').searchParams;
    const dirPath = params.get('path') || process.env.USERPROFILE || 'C:\\';
    fs.readdir(dirPath, { withFileTypes: true }, (err, entries) => {
      if (err) { json(res, 400, { error: err.message }); return; }
      const items = entries.map(e => ({ name: e.name, isDir: e.isDirectory() })).sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name, 'ja');
      });
      json(res, 200, { path: dirPath, items });
    });
    return true;
  }

  // /api/fs/complete?partial=...
  if (url.startsWith('/api/fs/complete?')) {
    const params = new URL(url, 'http://localhost').searchParams;
    const partial = params.get('partial') || '';
    const dir = path.dirname(partial);
    const prefix = path.basename(partial).toLowerCase();
    fs.readdir(dir, { withFileTypes: true }, (err, entries) => {
      if (err) { json(res, 200, { matches: [] }); return; }
      const matches = entries.filter(e => e.name.toLowerCase().startsWith(prefix))
        .map(e => ({ name: e.name, full: path.join(dir, e.name), isDir: e.isDirectory() }))
        .sort((a, b) => { if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; return a.name.localeCompare(b.name, 'ja'); })
        .slice(0, 20);
      json(res, 200, { matches });
    });
    return true;
  }

  return false;
}

module.exports = { handleFsAPI };
