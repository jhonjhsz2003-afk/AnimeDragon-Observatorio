# Observatório AnimeDragon × AnimeFire

Site independente de diagnóstico, **em português**, para publicar gratuitamente em **Cloudflare Workers Static Assets** e manter em um repositório separado no GitHub. Ele **não substitui nem altera** o AnimeDragon ou o AnimeFire. O nome do Worker é `animedragon-observatorio`, e não `site`: isso evita sobrescrever o Worker do AnimeDragon.

## O que faz

- Verifica acessibilidade da página AnimeDragon, `/api/health`, versão informada e política HTTPS/CSP.
- Consulta o catálogo `/api/catalog/home`, relação de provedores e `/api/playback` do AnimeDragon; distingue `primaryAvailable:true` de fallback EmbedMovies, além de exibir códigos como `MATCH_NOT_FOUND`, `EPISODE_NOT_FOUND`, `API_TIMEOUT` e `NO_COMPATIBLE_STREAM`.
- Verifica página AnimeFire, `/animes/pesquisar?q=...&v=3`, correspondência exata do título, paginação, `/anime/ID?v=3`, temporadas, episódios, duplicidade de IDs, `/episode/ID?v=3`, opções de áudio e capítulos Intro.
- Verifica se a rota `/user?v=3` exige autenticação sem utilizar cookies ou segredos.
- Mostra checklist manual de reprodução real, áudio, login, ranking, pular abertura, continuar assistindo e celular.
- Permite análise **rápida** (4 acessos de rede) e **completa** (até 10 chamadas de rede), filtros de falhas/avisos, histórico **local** (12 relatórios) e exportação JSON/TXT.
- Os domínios de saída estão fixos no código. O formulário recebe **apenas** nome de anime e ID TMDB. Não serve como proxy, não acessa cookies, não lê nem exibe URLs privadas de streaming e não tenta contornar restrições da fonte.

## Limites dos testes

**HTTP 200 não comprova funcionamento do player.** O modo completo não baixa playlists nem segmentos HLS, não vê a tela, não mede áudio e não comprova licenças de distribuição. A API pode declarar `is_offline:false` sem que o vídeo abra em `site.anime-dragon.workers.dev`. Se o AnimeDragon não disponibilizar `providerId` ou `primaryAvailable`, o painel informa limitação. Login e banco de dados são testes manuais para evitar expor dados privados.

A pesquisa e o ID TMDB são **parâmetros independentes**. Informe o ID TMDB correspondente ao título pesquisado para ter um diagnóstico cruzado coerente. No formulário inicial, o título é Black Clover (2017) e o ID TMDB de referência é **73223**. Confira no seu catálogo se a numeração e a versão de Black Clover correspondem antes de tirar conclusões do playback.

## 1. Verificar no computador

Necessário Node.js 22 ou superior:

```powershell
npm install
npm run check
npm test
npm run dev
```

Abra o endereço local exibido pelo Wrangler (normalmente `http://localhost:8787`). O ambiente de desenvolvimento pode precisar de rede para consultar os dois sites.

## 2. Criar repositório GitHub SEPARADO

1. Extraia o ZIP e abra o PowerShell na pasta `AnimeDragon_Observatorio`.
2. Crie no GitHub um repositório vazio chamado `AnimeDragon-Observatorio` (sem README gerado pelo GitHub).
3. Execute `SUBIR-GITHUB.ps1`. Ou use Git manualmente:

```powershell
git init
git add -A
git commit -m "AnimeDragon"
git branch -M main
git remote add origin https://github.com/jhonjhsz2003-afk/AnimeDragon-Observatorio.git
git push -u origin main
```

O script é seguro por padrão: **não** força o push nem apaga arquivos do repositório principal.

## 3. Publicar no Cloudflare Workers Free

Via terminal (mais direto):

```powershell
npm install
npx wrangler login
npm run deploy
```

Alternativamente, execute `PUBLICAR-CLOUDFLARE.ps1` para instalar, testar, conectar a conta e publicar.

O Wrangler vai publicar um Worker chamado `animedragon-observatorio` no endereço `*.workers.dev` da sua conta. Ele é **independente** do Worker `site` usado pelo AnimeDragon.

Via painel Cloudflare com GitHub: Workers & Pages → Create → Import a repository → selecione `AnimeDragon-Observatorio`. Confirme Root directory `/`, Build command `npm install` (ou deixe vazio se disponível) e Deploy command `npx wrangler deploy`. Interfaces e opções de Git podem variar; se o painel pedir comando de build, use `npm run check` após `npm install`. **Não** substitua o Worker `site`.

Os testes GitHub Actions rodam a cada push. **CI não implica deploy automático**: para deploy automático, configure a integração Git do Cloudflare Workers com o repositório ou execute `npm run deploy` autorizado. Não exponha tokens de API em código ou commits.

## 4. Usar o painel

- Abra o Worker do Observatório e clique em **Iniciar diagnóstico completo**.
- Veja as falhas da integração por categoria; em particular a origem `AnimeFire` no `/api/playback` e o `reasonCode`.
- Faça uma análise com o anime e **ID TMDB correspondentes**.
- Confirme a reprodução real em dois navegadores e no celular.
- Exporte o relatório sem copiar cookies, tokens ou endereços assinados.

## Estrutura

```text
public/                HTML, CSS, JavaScript, ícone
src/diagnostics.js     Núcleo de checagens de rede e validação
src/index.js           Endpoints /api/health e /api/diagnose
tests/                 Testes locais e CI Node
.github/workflows/     GitHub Actions (validação)
wrangler.toml          Publicação Worker com assets
SUBIR-GITHUB.ps1       Publicação GitHub inicial, sem force
PUBLICAR-CLOUDFLARE.ps1 Publicação do Worker após login
VALIDACAO.md           Escopo e limitações dos testes
```

## Observações de segurança e custo

O monitor foi projetado para a cota gratuita com poucas consultas por execução e um cache leve em memória de aproximadamente 45 segundos por combinação de parâmetros (não persistente). Se disponibilizado publicamente, visitantes podem iniciar verificações e gerar tráfego nas suas APIs; considere limitar acesso ao painel usando um produto de autenticação como Cloudflare Access ou uma regra de taxa no Cloudflare. O Worker não coleta credenciais, não testa brute force, não lê perfis privados e não redistribui vídeos. A existência de uma fonte técnica de vídeo não confere direitos de disponibilização de obras de terceiros.
