# Kai-san Install — Empty PC, One Command

## Step 1: Open PowerShell

Press `Win + X` → Click "Windows PowerShell" or "Terminal"

## Step 2: Paste this one line

```powershell
irm https://raw.githubusercontent.com/osamumiyashita/kai-san-jpr/master/setup.bat -OutFile $env:TEMP\setup.bat; Start-Process $env:TEMP\setup.bat
```

## Step 3: Wait

Everything installs automatically:
- Git, Python, Node.js, Claude Code, Ollama, Google CLI
- Kai-san repo (100MB)
- All Python/npm packages
- HTTPS certificates
- Desktop shortcut

## Step 4: Restart terminal, click "Kai-san" on Desktop

Done. Total time: ~10 minutes.

## What gets installed

| Tool | Purpose | Size |
|------|---------|------|
| Git | Version control | ~50MB |
| Python 3.12 | Pure Functions engine | ~100MB |
| Node.js LTS | kai-san-chat server | ~80MB |
| Claude Code | AI CLI | ~50MB |
| Ollama | Free local LLM | ~500MB |
| gemma3:4b | Default LLM model | ~3GB |
| Google Cloud CLI | Gmail integration | ~200MB |
| kai-san repo | Brain (encrypted) | 100MB |
| npm packages | Chat dependencies | ~200MB |
| Python packages | duckdb, numpy, etc. | ~300MB |

Total: ~4.5GB (one-time download)
