/**
 * server.js — Routing only (§17: ≤100 lines, all logic in separate modules)
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const { execFile, execSync: execSyncFn } = require('child_process');

const deploy = require('./deploy');
const { handleNavigatorAPI } = require('./navigator-api');
const { handleChatAPI } = require('./chat-api');
const { handleRpaAPI } = require('./rpa-api');
const { handleFsAPI } = require('./fs-api');
const { handleFeedbackAPI } = require('./feedback-api');
const { handleView, handleDocs, handleStatic } = require('./view-api');
const { handleWsConnection, killAllPTY } = require('./pty-handler');
const { handleLicenseAPI, startupCheck } = require('./license');
const { handleAccountAPI } = require('./account-api');

const cfg = deploy.getConfig();
const PORT = cfg.port || 10001;

// Crash safety
process.on('uncaughtException', (err) => { console.error('[UNCAUGHT]', err.stack || err.message); });
process.on('unhandledRejection', (reason) => { console.error('[UNHANDLED]', reason); });

// License check at startup
const licStatus = startupCheck();

// ── Request handler (routing only) ──────────────────────────
const handler = (req, res) => {
  const url = req.url;
  if (url.startsWith('/api/navigator'))  { if (handleNavigatorAPI(req, res, url)) return; }
  if (url.startsWith('/api/chat/'))      { if (handleChatAPI(req, res, url)) return; }
  if (url.startsWith('/api/rpa'))        { if (handleRpaAPI(req, res, url)) return; }
  if (url.startsWith('/api/fs'))         { if (handleFsAPI(req, res, url)) return; }
  if (url.startsWith('/api/license'))    { if (handleLicenseAPI(req, res, url)) return; }
  if (url.startsWith('/api/account'))    { if (handleAccountAPI(req, res, url)) return; }
  if (url.startsWith('/api/preview') || url === '/api/send-feedback') {
    if (handleFeedbackAPI(req, res, url, () => wss.clients)) return;
  }
  if (url.startsWith('/api/worklog')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end('{"entries":[]}');
    return;
  }
  if (url === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ label: cfg.label, accent: cfg.accent, layer: cfg.layer }));
    return;
  }
  if (url === '/api/restart' && req.method === 'POST') {
    wss.clients.forEach(c => { try { c.close(); } catch (e) {} });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end('{"ok":true}');
    return;
  }
  // No license → redirect to registration (except API and static assets)
  if (url === '/' && licStatus.status === 'no-license') {
    res.writeHead(302, { Location: '/register.html' }); res.end(); return;
  }
  if (url.startsWith('/view?'))                       { handleView(req, res, url); return; }
  if (url.startsWith('/docs/') || url === '/docs')    { handleDocs(req, res, url, cfg.docsPath); return; }
  handleStatic(req, res, url);
};

// ── Server creation (HTTPS primary, HTTP fallback) ──────────
let server, redirectServer = null;
if (cfg.certPaths) {
  try {
    server = https.createServer({ key: fs.readFileSync(cfg.certPaths.key), cert: fs.readFileSync(cfg.certPaths.cert) }, handler);
    const rHost = cfg.hosts ? 'kai-san-chat' : 'localhost';
    redirectServer = http.createServer((req, res) => { res.writeHead(301, { Location: 'https://' + rHost + ':' + PORT + req.url }); res.end(); });
  } catch (e) { console.warn('HTTPS cert error, HTTP fallback:', e.message); server = http.createServer(handler); }
} else { server = http.createServer(handler); }

// 30s request timeout — prevents slow handlers from hanging forever
server.timeout = 30000;
server.keepAliveTimeout = 30000;

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', handleWsConnection);

// ── Startup (safe: detect existing instance) ────────────────
const host = cfg.hosts ? 'kai-san-chat' : 'localhost';
const proto = redirectServer ? 'https' : 'http';

function openBrowser(url) {
  if (process.argv.includes('--no-open')) return;
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  execFile(process.platform === 'win32' ? 'cmd' : 'open', args, () => {});
}

function isPortInUse(port) {
  if (process.platform !== 'win32') return false;
  try { return execSyncFn('netstat -ano | findstr ":' + port + ' " | findstr LISTENING', { encoding: 'utf-8', timeout: 5000, windowsHide: true }).trim().length > 0; }
  catch { return false; }
}

if (isPortInUse(PORT)) {
  console.log('ksc already running — opening browser');
  openBrowser(proto + '://' + host + ':' + PORT);
  setTimeout(() => process.exit(0), 1500);
} else {
  server.listen(PORT, () => { console.log(proto + '://' + host + ':' + PORT); openBrowser(proto + '://' + host + ':' + PORT); });
  server.on('error', (e) => { if (e.code === 'EADDRINUSE') { openBrowser(proto + '://' + host + ':' + PORT); setTimeout(() => process.exit(0), 1500); } });
}

// HTTP redirect disabled — PORT+1 reserved for other ksc instances (GO=10001, HU=10002)

// ── Graceful shutdown ───────────────────────────────────────
function shutdown() { wss.clients.forEach(c => { try { c.close(); } catch (e) {} }); killAllPTY(); server.close(); process.exit(0); }
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(s => process.on(s, shutdown));
