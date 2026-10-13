$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Instale Node.js 22 ou superior antes de publicar.' }
Write-Host 'Instalando dependencias do Observatorio...' -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw 'Erro ao instalar dependencias.' }
Write-Host 'Validando o codigo...' -ForegroundColor Cyan
npm run check
if ($LASTEXITCODE -ne 0) { throw 'Falha de sintaxe.' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Os testes falharam.' }
Write-Host 'Cloudflare: conecte sua conta quando o navegador abrir.' -ForegroundColor Yellow
npx wrangler login
if ($LASTEXITCODE -ne 0) { throw 'Login Cloudflare não concluido.' }
npx wrangler deploy
if ($LASTEXITCODE -ne 0) { throw 'Falha ao publicar no Cloudflare.' }
Write-Host 'Observatorio publicado. Confirme a URL workers.dev exibida acima.' -ForegroundColor Green
