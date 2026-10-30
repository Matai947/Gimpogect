# Run once by the owner: takes OWNER_CODE and TOKEN_SECRET from Vercel and puts them on the new server.
# Nothing is shown on screen and nothing stays on this computer; the Vercel login in this terminal is used.
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\User\Project 4'
$tmp = Join-Path $env:TEMP ('sevengym-' + [guid]::NewGuid().ToString('N') + '.env')
try {
  cmd /c "npx --yes vercel@59.17.0 env pull `"$tmp`" --environment=production --yes" | Out-Null
  $vals = @{}
  Get-Content $tmp | ForEach-Object { if ($_ -match '^(OWNER_CODE|TOKEN_SECRET)="?([^"]*)"?$') { $vals[$Matches[1]] = $Matches[2] } }
  if (-not $vals.OWNER_CODE -or -not $vals.TOKEN_SECRET) { throw 'OWNER_CODE or TOKEN_SECRET not found in the Vercel project' }
  $lines = "OWNER_CODE=$($vals.OWNER_CODE)`nTOKEN_SECRET=$($vals.TOKEN_SECRET)`n"
  # straight into the root-only file, no temporary copy anywhere
  $lines | ssh ubuntu@185.146.1.53 'sudo sh -c "umask 077; sed -i /^OWNER_CODE=/d\;/^TOKEN_SECRET=/d /etc/sevengym.env; cat >> /etc/sevengym.env; systemctl restart sevengym; sleep 2; systemctl is-active sevengym"'
  Write-Host 'SECRETS-COPIED'
} finally {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
}
