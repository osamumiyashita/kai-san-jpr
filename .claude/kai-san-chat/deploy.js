/**
 * Kai-san Chat — Deploy Configuration
 * 4層デプロイアーキテクチャ + 全環境自動検出
 *
 * PURE: 同じ入力 → 同じ出力。副作用なし。
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

// =============================================================================
// 4 Deploy Layers
// =============================================================================

// =============================================================================
// Hierarchy: Company → Org (subsidiary/dept) → Person → PC
//
//   L0 dev:             person × pc  (developer only)
//   L1 jpr:             org(JPR) × person × pc
//   L2 client-analysis: company only (JPR analyzes — no person/pc)
//   L3 client-dispatch: company × org × person × pc
// =============================================================================

const HIERARCHY = {
  dev:               { company: false, org: false, person: true,  pc: true  },
  jpr:               { company: false, org: true,  person: true,  pc: true  },
  'client-analysis': { company: true,  org: false, person: false, pc: false },
  'client-dispatch': { company: true,  org: true,  person: true,  pc: true  },
};

const LAYERS = {
  dev: {
    label: 'L0 開発',
    theme: 'red',
    accent: '#dc2626',
    description: '宮下修 開発環境',
    data: ['meta'],
    dropbox_sync: false,
    hierarchy: HIERARCHY.dev,
  },
  jpr: {
    label: 'L1 JPR社員',
    theme: 'red',
    accent: '#dc2626',
    description: 'JPR社内分析',
    data: ['meta', 'jpr'],
    dropbox_sync: true,
    hierarchy: HIERARCHY.jpr,
  },
  'client-analysis': {
    label: 'L2 顧客分析',
    theme: 'blue',
    accent: '#2563eb',
    description: 'JPRによる顧客分析',
    data: ['meta', 'client-analysis'],
    dropbox_sync: true,
    hierarchy: HIERARCHY['client-analysis'],
  },
  'client-dispatch': {
    label: 'L3 顧客派遣',
    theme: 'green',
    accent: '#059669',
    description: 'クライアント企業での稼働',
    data: ['meta', 'client-dispatch'],
    dropbox_sync: false,
    hierarchy: HIERARCHY['client-dispatch'],
  },
};

// =============================================================================
// OS / Platform Detection
// =============================================================================

function detectPlatform() {
  const p = os.platform();
  if (p === 'win32') return 'windows';
  if (p === 'darwin') return 'mac';
  return 'linux';
}

function detectStorage(dir) {
  const s = dir.toLowerCase().replace(/\\/g, '/');
  if (s.includes('dropbox')) return 'dropbox';
  if (s.includes('onedrive') || s.includes('one drive')) return 'onedrive';
  if (s.includes('google') && s.includes('drive')) return 'google-drive';
  if (s.includes('icloud') || s.includes('mobile documents')) return 'icloud';
  if (s.startsWith('//') || s.startsWith('\\\\')) return 'network';
  if (/^\/volumes\//i.test(s) || /^\/mnt\//i.test(s)) return 'external';
  return 'local';
}

// =============================================================================
// SSL Certificate — auto-detect
// =============================================================================

function getCertPaths() {
  const dir = __dirname;
  const candidates = [
    { key: path.join(dir, 'key.pem'), cert: path.join(dir, 'cert.pem') },
    { key: path.join(dir, 'certs', 'key.pem'), cert: path.join(dir, 'certs', 'cert.pem') },
  ];
  for (const c of candidates) {
    if (fs.existsSync(c.key) && fs.existsSync(c.cert)) return c;
  }
  return null;
}

function canUseHTTPS() {
  return getCertPaths() !== null;
}

// =============================================================================
// Port
// =============================================================================

function getPort() {
  if (process.env.KAI_PORT) return parseInt(process.env.KAI_PORT, 10);
  const djPath = path.join(__dirname, 'deploy.json');
  if (fs.existsSync(djPath)) {
    try {
      const dj = JSON.parse(fs.readFileSync(djPath, 'utf-8'));
      if (dj.port && dj.port !== 'auto') return parseInt(dj.port, 10);
    } catch (e) {}
  }
  return 10001;
}

function findAvailablePort(startPort, maxAttempts) {
  maxAttempts = maxAttempts || 10;
  const net = require('net');
  return new Promise((resolve, reject) => {
    let attempt = 0;
    function tryPort(port) {
      const srv = net.createServer();
      srv.once('error', () => {
        attempt++;
        if (attempt >= maxAttempts) reject(new Error('No available port found'));
        else tryPort(port + 1);
      });
      srv.once('listening', () => {
        srv.close(() => resolve(port));
      });
      srv.listen(port);
    }
    tryPort(startPort);
  });
}

// =============================================================================
// Claude CLI detection (safe: execFileSync, no shell)
// =============================================================================

function findClaudePath() {
  // Check well-known locations directly (no PATH dependency)
  const platform = detectPlatform();
  if (platform === 'windows') {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const candidates = [
      path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      path.join(home, '.npm-global', 'claude.cmd'),
      'C:\\Program Files\\nodejs\\claude.cmd',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const candidates = [
      '/usr/local/bin/claude',
      path.join(process.env.HOME || '', '.npm-global/bin/claude'),
      '/opt/homebrew/bin/claude',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function detectClaudeCLI() {
  const cacheFile = path.join(__dirname, 'deploy.cache.json');
  const now = Date.now();
  try {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    if (cache.claudePath !== undefined && now - cache.ts < 3600000) {
      return cache.claudePath;  // full path or null
    }
  } catch (e) {}

  const claudePath = findClaudePath();
  try { fs.writeFileSync(cacheFile, JSON.stringify({ claudePath, ts: now })); } catch (e) {}
  return claudePath;
}

// =============================================================================
// Shell command — OS-aware
// =============================================================================

function getShellCommand() {
  const platform = detectPlatform();
  const claudePath = detectClaudeCLI();  // full path or null

  if (claudePath) {
    if (platform === 'windows') return { file: 'cmd.exe', args: ['/c', claudePath] };
    else return { file: '/bin/bash', args: ['-c', claudePath] };
  } else {
    if (platform === 'windows') return { file: 'cmd.exe', args: [] };
    else if (platform === 'mac') return { file: '/bin/zsh', args: [] };
    else return { file: '/bin/bash', args: [] };
  }
}

// =============================================================================
// Layer Auto-Detection
// =============================================================================

function detectLayer() {
  // 1. 環境変数
  const env = process.env.KAI_LAYER;
  if (env && LAYERS[env]) return env;

  // 2. deploy.json
  const djPath = path.join(__dirname, 'deploy.json');
  if (fs.existsSync(djPath)) {
    try {
      const dj = JSON.parse(fs.readFileSync(djPath, 'utf-8'));
      if (dj.layer && LAYERS[dj.layer]) return dj.layer;
    } catch (e) {}
  }

  // 3. パスから推測
  const cwd = __dirname.toLowerCase().replace(/\\/g, '/');

  // Dropbox
  if (cwd.includes('dropbox')) {
    if (cwd.includes('client-analysis')) return 'client-analysis';
    if (cwd.includes('jpr') || cwd.includes('kai-dispatch/jpr')) return 'jpr';
    return 'jpr';
  }
  // OneDrive
  if (cwd.includes('onedrive')) {
    if (cwd.includes('client')) return 'client-analysis';
    return 'jpr';
  }
  // Google Drive
  if (cwd.includes('google') && cwd.includes('drive')) return 'client-analysis';
  // iCloud
  if (cwd.includes('icloud') || cwd.includes('mobile documents')) return 'client-analysis';

  // Client PC (no 宮下修/miyashita in path)
  const isOsamuPC = cwd.includes('宮下修') || cwd.includes('miyashita');
  if (!isOsamuPC) return 'client-dispatch';

  // C:\kai-san\ pattern
  if (cwd.match(/^[a-z]:[/\\]kai-san/)) return 'client-dispatch';

  return 'dev';
}

// =============================================================================
// Hosts entry check
// =============================================================================

function hasHostsEntry() {
  const platform = detectPlatform();
  const hostsPath = platform === 'windows'
    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    : '/etc/hosts';
  try {
    return fs.readFileSync(hostsPath, 'utf-8').includes('kai-san-chat');
  } catch (e) {
    return false;
  }
}

// =============================================================================
// Sync warnings
// =============================================================================

function getSyncWarnings(storage) {
  const cloud = ['DuckDB: read_only=True (sync lock)', 'Writes: JSON Queue only'];
  const map = {
    'local': [],
    'external': [],
    'dropbox': [...cloud, 'LAN Sync recommended'],
    'onedrive': [...cloud, 'Disable Files On-Demand for data/'],
    'google-drive': [...cloud, 'Disable Stream mode'],
    'icloud': [...cloud, 'Keep data/ downloaded'],
    'network': ['DuckDB: read_only=True', 'High latency expected'],
  };
  return map[storage] || cloud;
}

// =============================================================================
// Hierarchy Identity — auto-detect company/org/person/pc
// =============================================================================

function detectIdentity(layer) {
  const h = HIERARCHY[layer];
  const djPath = path.join(__dirname, 'deploy.json');
  let dj = {};
  try { dj = JSON.parse(fs.readFileSync(djPath, 'utf-8')); } catch (e) {}

  const identity = {};

  // --- company ---
  if (h.company) {
    // deploy.json > env > path detection
    identity.company = dj.company || process.env.KAI_COMPANY || detectCompanyFromPath() || 'unknown';
  }

  // --- org (subsidiary / department) ---
  if (h.org) {
    identity.org = dj.org || process.env.KAI_ORG || detectOrgFromPath(layer) || 'default';
  }

  // --- person ---
  if (h.person) {
    identity.person = dj.person || process.env.KAI_PERSON
      || os.userInfo().username || 'unknown';
  }

  // --- pc ---
  if (h.pc) {
    identity.pc = dj.pc || process.env.KAI_PC || os.hostname();
  }

  return identity;
}

function detectCompanyFromPath() {
  const cwd = __dirname.toLowerCase().replace(/\\/g, '/');
  // Dropbox: kai-dispatch/client-analysis/{company}/
  const m1 = cwd.match(/client-analysis\/([^/]+)/);
  if (m1) return m1[1];
  // C:\kai-san\{company}\  or  /opt/kai-san/{company}/
  const m2 = cwd.match(/kai-san\/([^/]+)/);
  if (m2) return m2[1];
  return null;
}

function detectOrgFromPath(layer) {
  if (layer === 'jpr') return 'jpr';
  const cwd = __dirname.toLowerCase().replace(/\\/g, '/');
  // kai-san/{company}/{org}/
  const m = cwd.match(/kai-san\/[^/]+\/([^/]+)/);
  if (m) return m[1];
  return null;
}

// Build data path: company/org/person/pc scoped
function getDataPath(identity) {
  const parts = [];
  if (identity.company) parts.push(identity.company);
  if (identity.org) parts.push(identity.org);
  if (identity.person) parts.push(identity.person);
  if (identity.pc) parts.push(identity.pc);
  return parts.join('/');
}

// =============================================================================
// Full config
// =============================================================================

function getConfig() {
  const layer = detectLayer();
  const platform = detectPlatform();
  const storage = detectStorage(__dirname);
  const port = getPort();
  const useHTTPS = canUseHTTPS();
  const certPaths = getCertPaths();
  const hosts = hasHostsEntry();
  const shell = getShellCommand();
  const identity = detectIdentity(layer);

  // docs path: deploy.json > env > default (__dirname/docs)
  let docsPath = null;
  try {
    const dj = JSON.parse(fs.readFileSync(path.join(__dirname, 'deploy.json'), 'utf-8'));
    if (dj.docsPath) docsPath = dj.docsPath;
  } catch (e) {}
  docsPath = docsPath || process.env.KAI_DOCS_PATH || null;

  return {
    ...LAYERS[layer],
    layer,
    platform,
    storage,
    port,
    https: useHTTPS,
    certPaths,
    hosts,
    shell,
    identity,
    docsPath,
    dataPath: getDataPath(identity),
    baseUrl: hosts
      ? `${useHTTPS ? 'https' : 'http'}://kai-san-chat:${port}`
      : `${useHTTPS ? 'https' : 'http'}://localhost:${port}`,
    overlayDirs: LAYERS[layer].data.map(d => path.join(__dirname, 'overlays', d)),
    syncWarnings: getSyncWarnings(storage),
  };
}

// =============================================================================
// Deploy manifest
// =============================================================================

function getDeployManifest(targetLayer, company) {
  const manifest = {
    layer: targetLayer,
    company: company || null,
    files: ['server.js', 'package.json', 'package-lock.json', 'start.bat', 'kai.ico', 'deploy.js', '.gitignore'],
    dirs: ['node_modules', 'overlays/meta'],
  };
  if (targetLayer === 'jpr') manifest.dirs.push('overlays/jpr');
  else if (targetLayer === 'client-analysis' && company) manifest.dirs.push(`overlays/client-analysis/${company}`);
  else if (targetLayer === 'client-dispatch') manifest.dirs.push('overlays/client-dispatch');
  return manifest;
}

// =============================================================================
// Startup info
// =============================================================================

function printStartupInfo(cfg) {
  console.log('');
  console.log('  ┌─────────────────────────────────────┐');
  console.log('  │  海 Kai-san Chat                     │');
  console.log('  └─────────────────────────────────────┘');
  console.log(`  Layer:    ${cfg.label} (${cfg.layer})`);
  // Identity hierarchy
  const id = cfg.identity;
  if (id.company)  console.log(`  Company:  ${id.company}`);
  if (id.org)      console.log(`  Org:      ${id.org}`);
  if (id.person)   console.log(`  Person:   ${id.person}`);
  if (id.pc)       console.log(`  PC:       ${id.pc}`);
  if (cfg.dataPath) console.log(`  DataPath: ${cfg.dataPath}`);
  console.log(`  Platform: ${cfg.platform}`);
  console.log(`  Storage:  ${cfg.storage}`);
  console.log(`  Port:     ${cfg.port}`);
  console.log(`  HTTPS:    ${cfg.https ? 'YES' : 'NO (HTTP fallback)'}`);
  console.log(`  Hosts:    ${cfg.hosts ? 'kai-san-chat -> 127.0.0.1' : 'NOT SET (using localhost)'}`);
  console.log(`  Shell:    ${cfg.shell.file} ${cfg.shell.args.join(' ')}`);
  console.log(`  URL:      ${cfg.baseUrl}`);
  cfg.syncWarnings.forEach(w => console.log(`  ! ${w}`));
  console.log('');
}

module.exports = {
  LAYERS, HIERARCHY, detectLayer, detectPlatform, detectStorage,
  detectIdentity, getDataPath,
  getConfig, getDeployManifest, getPort, getShellCommand,
  canUseHTTPS, getCertPaths, hasHostsEntry, printStartupInfo,
  getSyncWarnings, findAvailablePort,
};
