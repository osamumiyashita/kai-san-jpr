' Kai-san Chat — Start server + open app window
Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Detect script directory
Dim scriptDir
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Start server hidden
ws.Run "cmd /c cd /d """ & scriptDir & """ && node server.js", 0, False

' Detect HTTPS: check if cert.pem exists
Dim useHttps, baseProto, baseUrl
useHttps = fso.FileExists(scriptDir & "\cert.pem")
If useHttps Then
    baseProto = "https"
Else
    baseProto = "http"
End If

' Detect hosts entry: check if kai-san-chat is resolvable
Dim hostName
hostName = "127.0.0.1"
Dim hostsFile
hostsFile = "C:\Windows\System32\drivers\etc\hosts"
If fso.FileExists(hostsFile) Then
    Dim hostsContent
    hostsContent = fso.OpenTextFile(hostsFile, 1).ReadAll
    If InStr(hostsContent, "kai-san-chat") > 0 Then
        hostName = "kai-san-chat"
    End If
End If

baseUrl = baseProto & "://" & hostName & ":10001"

' Wait for server (max 10s) — try both HTTP and HTTPS health check
Dim http, i
For i = 1 To 20
    WScript.Sleep 500
    On Error Resume Next
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    ' For self-signed certs: ignore SSL errors
    If useHttps Then
        http.Option(4) = 256 + 512 + 4096 + 8192 ' SslErrorIgnoreFlags: all
    End If
    http.Open "GET", baseUrl & "/api/config", False
    http.Send
    If Err.Number = 0 And http.Status = 200 Then
        Set http = Nothing
        On Error GoTo 0
        ws.Run """C:\Program Files\Google\Chrome\Application\chrome.exe"" --app=" & baseUrl & "/ --profile-directory=Default", 1, False
        WScript.Quit
    End If
    Set http = Nothing
    Err.Clear
    On Error GoTo 0
Next

' Fallback: open anyway
ws.Run """C:\Program Files\Google\Chrome\Application\chrome.exe"" --app=" & baseUrl & "/ --profile-directory=Default", 1, False
