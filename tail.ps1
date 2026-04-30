$f = 'C:\Users\David\.qoder\cache\projects\AgentID-2.0-4a26a3e5\agent-tools\1b0993a0\d4ddc318.txt'
$c = [System.IO.File]::ReadAllText($f)
Write-Output $c.Substring([Math]::Max(0, $c.Length - 3000))
