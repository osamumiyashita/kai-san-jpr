#!/bin/bash
echo "============================================"
echo "  Kai-san Deploy (JPR)"
echo "  git clone → ~/.claude/ → done"
echo "============================================"

if ! command -v git &> /dev/null; then
    echo "[ERROR] Git not found. Install: xcode-select --install"
    exit 1
fi

if [ -d "$HOME/.claude/.git" ]; then
    echo "[UPDATE] Updating..."
    cd "$HOME/.claude" && git pull origin main
    echo "[OK] Updated."
else
    echo "[INSTALL] Deploying..."
    git clone -b main https://github.com/osamumiyashita/jpr-home-claude-source.git "$HOME/.claude"
    echo "[OK] Deployed."
fi

echo "============================================"
echo "  Done! Start Claude to use Kai-san."
echo "============================================"
