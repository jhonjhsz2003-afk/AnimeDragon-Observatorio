$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {throw 'Instale Node.js 22 ou superior.'}
npm install
if ($LASTEXITCODE -ne 0) {throw 'Falha em npm install'}
npm test
if ($LASTEXITCODE -ne 0) {throw 'Alguns testes falharam'}
npm run dev
