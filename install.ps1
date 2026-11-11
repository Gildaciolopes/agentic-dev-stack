# Windows entrypoint (PowerShell 5+ / 7). Thin wrapper around the cross-platform Node CLI.
#   .\install.ps1 --all
#   irm https://raw.githubusercontent.com/Gildaciolopes/agentic-dev-stack/main/install.ps1 | iex   (then: agentic-dev-stack install --all)
param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Rest)
$ErrorActionPreference = "Stop"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js >= 18 is required: winget install OpenJS.NodeJS.LTS"
  exit 1
}
$cli = Join-Path $PSScriptRoot "bin/cli.mjs"
if ($PSScriptRoot -and (Test-Path $cli)) {
  node $cli install @Rest
} else {
  npx -y agentic-dev-stack@latest install @Rest
}
exit $LASTEXITCODE
