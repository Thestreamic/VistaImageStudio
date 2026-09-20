# Stop leftover Next.js / Electron from this repo so run-app.bat can bind
# port 3000. Next.js 16 refuses a second `next dev` in the same folder.
$ErrorActionPreference = 'SilentlyContinue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$rootMatch = [regex]::Escape($root)

function Stop-Tree([int]$ProcessId) {
  if ($ProcessId -le 0) { return }
  Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId } | ForEach-Object {
    Stop-Tree $_.ProcessId
  }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

$killed = New-Object 'System.Collections.Generic.HashSet[int]'
Get-CimInstance Win32_Process | ForEach-Object {
  $cmd = $_.CommandLine
  if (-not $cmd) { return }
  if ($cmd -notmatch $rootMatch) { return }
  $isDev = ($cmd -match 'next(\s|"|''|/|\\)' -or $cmd -match 'electron(\.exe|\.cmd)?' -or $cmd -match 'wait-on tcp:3000')
  if (-not $isDev) { return }
  if ($_.Name -notmatch '^(node|electron|cmd|powershell|pwsh)') { return }
  if ($killed.Add($_.ProcessId)) { Stop-Tree $_.ProcessId }
}

foreach ($port in 3000, 3100) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)" -ErrorAction SilentlyContinue
    if ($owner -and $owner.CommandLine -and $owner.CommandLine -match $rootMatch) {
      if ($killed.Add($owner.ProcessId)) { Stop-Tree $owner.ProcessId }
    }
  }
}

exit 0
