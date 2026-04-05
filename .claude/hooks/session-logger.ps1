# Claude Code Session Logging Hook (PowerShell for Windows)
# Triggered by: Stop event (after Claude completes response)
# Purpose: Append latest response to active session log

param()

$LOG_DIR = "G:\OneDrive - ジェイ・フェニックス・リサーチ株式会社\ドキュメント\.claude\log-md"

# Find the active log file (marked with _ACTIVE suffix or most recent)
$activeLogPattern = Join-Path $LOG_DIR "*.md"
$logFiles = Get-ChildItem -Path $activeLogPattern -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "_ACTIVE\.md$" } |
    Sort-Object LastWriteTime -Descending

if ($logFiles.Count -eq 0) {
    # No active log file, exit silently
    exit 0
}

$LATEST_LOG = $logFiles[0].FullName

# Read hook input from stdin (JSON from Claude Code)
$INPUT = $input | Out-String

if ([string]::IsNullOrWhiteSpace($INPUT)) {
    exit 0
}

# Get timestamp
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Append to log with timestamp
$logEntry = @"

---

## [$TIMESTAMP] Response Recorded

### Assistant Response (Auto-logged)

``````
$INPUT
``````

"@

Add-Content -Path $LATEST_LOG -Value $logEntry -Encoding UTF8

exit 0
