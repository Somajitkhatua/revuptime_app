param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$EasArguments
)

$taskPreviousAppData = $env:APPDATA
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
try {
  # Keep this workaround local to this process; do not change Windows settings.
  $env:APPDATA = Join-Path $taskProjectRoot 'output\eas-user-config'
  New-Item -ItemType Directory -Path $env:APPDATA -Force | Out-Null
  & npx.cmd --yes eas-cli@latest @EasArguments
  $taskExitCode = $LASTEXITCODE
} finally {
  $env:APPDATA = $taskPreviousAppData
}
exit $taskExitCode
