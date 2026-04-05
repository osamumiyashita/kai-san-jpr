/**
 * feedback-api.js — Preview broadcast + feedback email
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

/**
 * @param {Function} getWssClients — returns iterable of WebSocket clients (injected from server.js)
 */
function handleFeedbackAPI(req, res, url, getWssClients) {
  // POST /api/preview — broadcast preview URL to all WS clients
  if (url.startsWith('/api/preview') && req.method === 'POST') {
    readBody(req).then(({ path: filePath }) => {
      if (!filePath || !fs.existsSync(filePath)) {
        json(res, 404, { error: 'File not found', path: filePath });
        return;
      }
      const viewUrl = '/view?path=' + encodeURIComponent(filePath);
      const clients = getWssClients();
      clients.forEach(c => {
        try { c.send(JSON.stringify({ type: 'preview', url: viewUrl, path: filePath })); } catch (e) {}
      });
      json(res, 200, { ok: true, url: viewUrl });
    }).catch(e => json(res, 400, { error: e.message }));
    return true;
  }

  // POST /api/send-feedback — log locally + send via gogcli
  if (url === '/api/send-feedback' && req.method === 'POST') {
    readBody(req).then(fb => {
      const subject = fb.subject || 'Kai-san Feedback [Score: ' + (fb.score || '?') + '/5]';
      const mailBody = fb.body || '(no body)';
      const to = fb.to || 'info-jpr@j-phoenix.com';

      const logDir = path.join(__dirname, 'feedback-log');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry = JSON.stringify({ ts: new Date().toISOString(), score: fb.score, comment: fb.comment, to }) + '\n';
      fs.appendFileSync(path.join(logDir, 'feedback.jsonl'), logEntry, 'utf-8');

      const gogcli = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'bash-force', 'gogcli.exe');
      if (fs.existsSync(gogcli)) {
        execFile(gogcli, ['send', '--to', to, '--subject', subject, '--body', mailBody], { timeout: 30000 }, (err) => {
          if (err) console.error('gogcli send error:', err.message);
        });
      }

      json(res, 200, { ok: true, logged: true });
    }).catch(e => json(res, 400, { error: e.message }));
    return true;
  }

  return false;
}

module.exports = { handleFeedbackAPI };
