/**
 * view-api.js — File viewing, docs serving, and static file serving
 * §17-7: Separate file. server.js only routes here.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const STATIC_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const VIEW_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// /view?path=... — serve any local file by absolute path
function handleView(req, res, url) {
  const params = new URL(url, 'http://localhost').searchParams;
  const filePath = params.get('path');
  if (!filePath || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>File not found</h1><p>' + (filePath || 'no path') + '</p>');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': VIEW_MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

// /docs/* — serve from docs folder
function handleDocs(req, res, url, docsPath) {
  const docsBase = docsPath || path.join(__dirname, 'docs');
  const rel = url === '/docs' ? '/index.html' : url.replace('/docs', '');
  const filePath = path.join(docsBase, rel);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': VIEW_MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

// Fallback: serve from public/ and node_modules (xterm)
function handleStatic(req, res, url) {
  const rawUrl = url.split('?')[0];
  const cleanUrl = rawUrl === '/' ? '/index.html' : rawUrl;
  const candidates = [
    path.join(__dirname, 'public', cleanUrl),
    path.join(__dirname, 'node_modules/@xterm/xterm', cleanUrl.replace('/xterm/', '/')),
    path.join(__dirname, 'node_modules/@xterm/addon-fit', cleanUrl.replace('/xterm-addon-fit/', '/')),
    path.join(__dirname, 'node_modules/@xterm/addon-unicode11', cleanUrl.replace('/xterm-addon-unicode11/', '/')),
    path.join(__dirname, 'node_modules/@xterm/addon-webgl', cleanUrl.replace('/xterm-addon-webgl/', '/')),
  ];
  const file = candidates.find(f => fs.existsSync(f));
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': STATIC_MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

module.exports = { handleView, handleDocs, handleStatic };
