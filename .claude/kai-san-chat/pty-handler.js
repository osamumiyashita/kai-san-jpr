/**
 * pty-handler.js — WebSocket → PTY shell handler
 * §17-7: Separate file. server.js only attaches WSS.
 */
'use strict';

const pty = require('node-pty');

function handleWsConnection(ws) {
  const shellCmd = process.env.COMSPEC || 'cmd.exe';
  let shell;
  try {
    shell = pty.spawn(shellCmd, [], {
      name: 'xterm-256color', cols: 80, rows: 24,
      cwd: process.env.USERPROFILE || __dirname,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        LANG: 'ja_JP.UTF-8',
        PYTHONIOENCODING: 'utf-8',
      },
    });
  } catch (e) {
    console.error('PTY spawn failed:', e.message);
    ws.send('\r\n\x1b[31mERROR: Terminal shell failed to start: ' + e.message + '\x1b[0m\r\n');
    ws.close();
    return;
  }
  console.log('PTY spawned: PID=' + shell.pid + ' shell=' + shellCmd);
  shell.onData((d) => { try { ws.send(d); } catch (e) {} });
  shell.onExit(({ exitCode }) => {
    console.log('PTY exited: PID=' + shell.pid + ' code=' + exitCode);
    try { ws.close(); } catch (e) {}
  });
  ws.on('message', (msg) => {
    try {
      const p = JSON.parse(msg.toString());
      if (p.type === 'input') shell.write(p.data);
      else if (p.type === 'resize') shell.resize(p.cols, p.rows);
    } catch (e) { shell.write(msg.toString()); }
  });
  ws.on('error', (e) => { console.error('WS error:', e.message); shell.kill(); });
  ws.on('close', () => { console.log('WS closed, killing PTY PID=' + shell.pid); shell.kill(); });
}

module.exports = { handleWsConnection };
