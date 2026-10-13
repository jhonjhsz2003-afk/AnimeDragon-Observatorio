$ErrorActionPreference = 'Stop'
$repo = 'https://github.com/jhonjhsz2003-afk/AnimeDragon-Observatorio.git'
$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $folder
if (-not (Test-Path 'wrangler.toml')) { throw 'Não encontrei o projeto do Observatório nesta pasta.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Instale o Git for Windows antes de continuar.' }
if (-not (Test-Path '.git')) { git init; if ($LASTEXITCODE -ne 0) { throw 'Falha em git init.' } }
git add -A
if ($LASTEXITCODE -ne 0) { throw 'Falha em git add.' }
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -m 'AnimeDragon'
  if ($LASTEXITCODE -ne 0) { throw 'Falha no commit. Configure git config user.name e user.email.' }
}
git branch -M main
$remotes = @(git remote)
if ($remotes -contains 'origin') { git remote set-url origin $repo }
else { git remote add origin $repo }
Write-Host 'Confira: o destino é o repositorio SEPARADO AnimeDragon-Observatorio, não Anime_Dragon.' -ForegroundColor Yellow
$confirm = Read-Host 'Esse repositorio ja existe na sua conta? Digite SIM para enviar'
if ($confirm -ne 'SIM') { Write-Host 'Operacao cancelada sem publicar.'; exit 0 }
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw 'Git push falhou. Confira se o repositorio existe, permissões, login e branch remota. Nao use --force.' }
Write-Host 'Observatorio enviado ao GitHub!' -ForegroundColor Green
