param(
  [Parameter(Mandatory = $true)]
  [string]$LogPath
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Set-Location -LiteralPath $repoRoot

function Invoke-LoggedCommand {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  $output = & npx @Arguments 2>&1 | Out-String
  Add-Content -LiteralPath $LogPath -Value $output
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: npx $($Arguments -join ' ')"
  }
  return $output
}

Add-Content -LiteralPath $LogPath -Value "national_orchestrator_started=$([DateTimeOffset]::UtcNow.ToString('o'))"

for ($batch = 1; $batch -le 20; $batch += 1) {
  $dry = Invoke-LoggedCommand -Arguments @(
    'tsx', '--conditions=react-server', '--tsconfig', 'apps/web/tsconfig.json',
    'apps/web/scripts/facility-identity-pilot.ts', 'cohort', '--dry-run', '--national',
    '--batch-size=1000'
  )
  if ($dry -notmatch 'facilities=(\d+)') { throw 'Unable to parse dry-run facility count' }
  $remaining = [int]$Matches[1]
  if ($remaining -eq 0) { break }

  $created = Invoke-LoggedCommand -Arguments @(
    'tsx', '--conditions=react-server', '--tsconfig', 'apps/web/tsconfig.json',
    'apps/web/scripts/facility-identity-pilot.ts', 'cohort', '--persist', '--national',
    '--batch-size=1000'
  )
  if ($created -notmatch 'run_id=([0-9a-f-]+) facilities=(\d+)') {
    throw 'Unable to parse persisted batch run'
  }
  $sourceRunId = $Matches[1]
  Add-Content -LiteralPath $LogPath -Value "batch=$batch source_run_id=$sourceRunId"

  $acquisition = Invoke-LoggedCommand -Arguments @(
    'tsx', '--conditions=react-server', '--tsconfig', 'apps/web/tsconfig.json',
    'apps/web/scripts/facility-identity-pilot.ts', 'run', $sourceRunId, '--national',
    '--batch-size=1000'
  )
  if ($acquisition -notmatch 'requested_facility_fingerprint"\s*:\s*"([0-9a-f]{64})"') {
    throw 'Unable to parse batch fingerprint'
  }
  $fingerprint = $Matches[1]

  Invoke-LoggedCommand -Arguments @(
    'tsx', '--conditions=react-server', '--tsconfig', 'apps/web/tsconfig.json',
    'apps/web/scripts/resolver-v2-retest.ts', 'holdout', $sourceRunId
  ) | Out-Null
  Invoke-LoggedCommand -Arguments @(
    'tsx', '--conditions=react-server', '--tsconfig', 'apps/web/tsconfig.json',
    'apps/web/scripts/holdout-field-audit.ts', $fingerprint
  ) | Out-Null

  Add-Content -LiteralPath $LogPath -Value "batch=$batch completed=$([DateTimeOffset]::UtcNow.ToString('o'))"
}

Add-Content -LiteralPath $LogPath -Value "national_orchestrator_completed=$([DateTimeOffset]::UtcNow.ToString('o'))"
