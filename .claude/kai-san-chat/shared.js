/**
 * shared.js — Common helpers used by multiple API modules
 * §17-7: Single source of truth for readBody + json response.
 */
'use strict';

const MAX_BODY_BYTES = 1024 * 1024; // 1MB request body limit

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { req.destroy(); reject(new Error('Request body too large (max 1MB)')); return; }
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

module.exports = { readBody, json, MAX_BODY_BYTES };
