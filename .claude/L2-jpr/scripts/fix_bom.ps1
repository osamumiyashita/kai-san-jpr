$path = "G:\OneDrive - ジェイ・フェニックス・リサーチ株式会社\ドキュメント\.claude\scripts\batch-session-recorder.ps1"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($path, $content, $utf8Bom)
Write-Output "Saved with UTF-8 BOM"

# Also fix start-batch-recorder.ps1
$path2 = "G:\OneDrive - ジェイ・フェニックス・リサーチ株式会社\ドキュメント\.claude\scripts\start-batch-recorder.ps1"
if (Test-Path $path2) {
    $content2 = [System.IO.File]::ReadAllText($path2, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($path2, $content2, $utf8Bom)
    Write-Output "Saved start-batch-recorder.ps1 with UTF-8 BOM too"
}
