Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Use Documents path via environment variable to avoid Japanese encoding issues
batPath = fso.BuildPath(WshShell.ExpandEnvironmentStrings("%USERPROFILE%"), ".claude\scripts\start-kai-slack-poller.bat")

If fso.FileExists(batPath) Then
    WshShell.Run """" & batPath & """", 0, False
End If
