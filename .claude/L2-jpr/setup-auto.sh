#!/bin/bash
# Kai-san 自動セットアップ — Mac / Linux
# J-Phoenix Research Inc.

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0
TOTAL=8

echo ""
echo "============================================================"
echo "  Kai-san 自動セットアップ"
echo "  J-Phoenix Research Inc."
echo "============================================================"
echo ""
echo "  所要時間: 約5〜10分"
echo "  エラーが出たら画面を修さんに送ってください。"
echo ""

check_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================================
# [1/8] Git
# ============================================================
echo "[1/$TOTAL] Git を確認中..."
if check_cmd git; then
    echo -e "  ${GREEN}✓${NC} 既にインストール済み: $(git --version)"
    ((SKIP++))
else
    echo -e "  ${YELLOW}✗${NC} 未インストール"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  xcode-select --install でインストールします..."
        xcode-select --install 2>/dev/null || true
        echo "  ポップアップが出たら「インストール」をクリックしてください。"
        echo "  完了後、このスクリプトをもう一度実行してください。"
        ((FAIL++))
    else
        sudo apt-get update -qq && sudo apt-get install -y -qq git >/dev/null 2>&1 && echo -e "  ${GREEN}✓${NC} インストール完了" && ((PASS++)) || { echo -e "  ${RED}✗${NC} 失敗"; ((FAIL++)); }
    fi
fi
echo ""

# ============================================================
# [2/8] Node.js
# ============================================================
echo "[2/$TOTAL] Node.js を確認中..."
if check_cmd node; then
    echo -e "  ${GREEN}✓${NC} 既にインストール済み: $(node --version)"
    ((SKIP++))
else
    echo -e "  ${YELLOW}✗${NC} 未インストール"
    if check_cmd brew; then
        echo "  Homebrewでインストール中..."
        brew install node >/dev/null 2>&1 && echo -e "  ${GREEN}✓${NC} 完了" && ((PASS++)) || { echo -e "  ${RED}✗${NC} 失敗"; ((FAIL++)); }
    else
        echo "  手動インストールが必要です: https://nodejs.org/ からLTS版をダウンロード"
        ((FAIL++))
    fi
fi
echo ""

# ============================================================
# [3/8] Python
# ============================================================
echo "[3/$TOTAL] Python を確認中..."
if check_cmd python3; then
    echo -e "  ${GREEN}✓${NC} 既にインストール済み: $(python3 --version)"
    ((SKIP++))
elif check_cmd python; then
    echo -e "  ${GREEN}✓${NC} 既にインストール済み: $(python --version)"
    ((SKIP++))
else
    echo -e "  ${YELLOW}✗${NC} 未インストール"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  xcode-select --install で入るはず（Step 1参照）"
        ((FAIL++))
    else
        sudo apt-get install -y -qq python3 python3-pip >/dev/null 2>&1 && echo -e "  ${GREEN}✓${NC} 完了" && ((PASS++)) || { echo -e "  ${RED}✗${NC} 失敗"; ((FAIL++)); }
    fi
fi
echo ""

# ============================================================
# [4/8] Claude CLI
# ============================================================
echo "[4/$TOTAL] Claude CLI を確認中..."
if check_cmd claude; then
    echo -e "  ${GREEN}✓${NC} 既にインストール済み: $(claude --version 2>/dev/null || echo 'installed')"
    ((SKIP++))
else
    echo -e "  ${YELLOW}✗${NC} 未インストール — npmでインストールします..."
    if check_cmd npm; then
        npm install -g @anthropic-ai/claude-code >/dev/null 2>&1 && echo -e "  ${GREEN}✓${NC} 完了" && ((PASS++)) || {
            echo "  sudoで再試行..."
            sudo npm install -g @anthropic-ai/claude-code >/dev/null 2>&1 && echo -e "  ${GREEN}✓${NC} 完了" && ((PASS++)) || { echo -e "  ${RED}✗${NC} 失敗"; ((FAIL++)); }
        }
    else
        echo -e "  ${RED}✗${NC} npmがありません。Node.jsを先にインストールしてください。"
        ((FAIL++))
    fi
fi
echo ""

# ============================================================
# [5/8] pip ライブラリ
# ============================================================
echo "[5/$TOTAL] pip ライブラリ（duckdb, cryptography）を確認中..."
PIP_CMD="pip3"
check_cmd pip3 || PIP_CMD="pip"

python3 -c "import duckdb; import cryptography" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} 既にインストール済み"
    ((SKIP++))
else
    echo "  インストール中..."
    $PIP_CMD install duckdb cryptography >/dev/null 2>&1 && echo -e "  ${GREEN}✓${NC} 完了" && ((PASS++)) || { echo -e "  ${RED}✗${NC} 失敗"; ((FAIL++)); }
fi
echo ""

# ============================================================
# [6/8] Ollama
# ============================================================
echo "[6/$TOTAL] Ollama を確認中...（オプション）"
if check_cmd ollama; then
    echo -e "  ${GREEN}✓${NC} 既にインストール済み"
    ((SKIP++))
else
    echo -e "  ${YELLOW}△${NC} 未インストール（オプション）"
    echo "  手動: https://ollama.com/download からダウンロード"
    ((SKIP++))
fi
echo ""

# ============================================================
# [7/8] GoGCLI
# ============================================================
echo "[7/$TOTAL] GoGCLI を確認中...（オプション）"
if [ -f "$HOME/gogcli/gog" ] || [ -f "$HOME/gogcli/gog.exe" ]; then
    echo -e "  ${GREEN}✓${NC} 既にインストール済み"
    ((SKIP++))
else
    echo -e "  ${YELLOW}△${NC} 未インストール（オプション）"
    mkdir -p "$HOME/gogcli"
    echo "  フォルダを作成しました: $HOME/gogcli/"
    echo "  修さんからgogファイルを受け取り、このフォルダに配置してください。"
    ((SKIP++))
fi
echo ""

# ============================================================
# [8/8] git clone — Kai-san本体
# ============================================================
echo "[8/$TOTAL] Kai-san 本体を確認中..."
if [ -f "$HOME/.claude/rules/kai-constitution.md" ]; then
    echo -e "  ${GREEN}✓${NC} 既にインストール済み。最新版に更新します..."
    cd "$HOME/.claude" && git pull >/dev/null 2>&1 && echo -e "  ${GREEN}✓${NC} 更新完了" || echo -e "  ${YELLOW}△${NC} 更新失敗（ローカル変更あり？）"
    ((SKIP++))
else
    echo "  インストール中（git clone）..."
    git clone https://github.com/osamumiyashita/jpr-home-claude-source.git "$HOME/.claude" 2>&1
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} Kai-san インストール完了！"
        ((PASS++))
    else
        echo -e "  ${RED}✗${NC} インストール失敗"
        echo "  確認事項:"
        echo "    1. GitHubの招待メールで「Accept invitation」をクリックしましたか？"
        echo "    2. インターネットに接続されていますか？"
        echo "    3. 修さん（miyashita@j-phoenix.com）に連絡してください"
        ((FAIL++))
    fi
fi
echo ""

# ============================================================
# 結果サマリー
# ============================================================
echo "============================================================"
echo "  セットアップ結果"
echo "============================================================"
echo ""
echo "  新規インストール: $PASS 件"
echo "  既にインストール済: $SKIP 件"
echo "  失敗:             $FAIL 件"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "  ${GREEN}============================================${NC}"
    echo -e "  ${GREEN}✓ セットアップ完了！${NC}"
    echo -e "  ${GREEN}============================================${NC}"
    echo ""
    echo "  次のステップ:"
    echo "    1. ターミナルを閉じて開き直す"
    echo "    2. claude login でログイン"
    echo "    3. claude で起動 → Kai-sanが応答します"
else
    echo -e "  ${YELLOW}============================================${NC}"
    echo -e "  ${YELLOW}△ 一部失敗がありました${NC}"
    echo -e "  ${YELLOW}============================================${NC}"
    echo ""
    echo "  画面のスクリーンショットを修さんに送ってください。"
    echo "  miyashita@j-phoenix.com"
fi
echo ""
echo "  J-Phoenix Research Inc."
echo "  miyashita@j-phoenix.com"
echo ""
