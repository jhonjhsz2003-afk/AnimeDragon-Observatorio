/** AnimeDragon Observatório: somente GET/HEAD em rotas e domínios fixos.
 *  Não contorna autenticação, CORS, geobloqueio ou restrições de mídia.
 *  Não devolve stream URLs, tokens, cookies nem corpos brutos de APIs. */
export const DEFAULTS = Object.freeze({
  animeDragon: 'https://site.anime-dragon.workers.dev',
  animeFire: 'https://animefire.one',
  animeApi: 'https://api.animefire.one',
  title: 'Black Clover',
  knownAnimeId: 'lz78h__iYFA',
  playbackTmdbId: 73223,
});
const jsonHeaders = { Accept: 'application/json' };
const maxResponseBytes = 2_300_000;
export const normalizeTitle = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const validAnimeId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{6,32}$/.test(id);
export function validateOptions(input = {}) {
  const mode = input.mode === 'quick' ? 'quick' : 'full';
  const title = String(input.title || DEFAULTS.title).trim();
  if (title.length < 2 || title.length > 72 || /[\r\n\u0000-\u001f]/.test(title)) throw new Error('Título deve conter entre 2 e 72 caracteres.');
  const tmdb = String(input.tmdb || DEFAULTS.playbackTmdbId);
  if (!/^\d{1,10}$/.test(tmdb) || Number(tmdb) < 1) throw new Error('ID TMDB inválido.');
  return { mode, title, tmdb: Number(tmdb) };
}
const encode = x => encodeURIComponent(x);
function entry(key, group, title, status, details, extra = {}) {
  return { key, group, title, status, details, ...extra };
}
async function limitedRead(response, cap = maxResponseBytes) {
  if (!response.body) return '';
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > cap) throw new Error('RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
  } finally { try { await reader.cancel(); } catch {} }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(result);
}
export async function probe(fetcher, url, { timeout = 7500, parse = 'json', method = 'GET' } = {}) {
  const start = Date.now();
  try {
    const response = await fetcher(url, {
      method, headers: parse === 'json' ? jsonHeaders : {Accept: '*/*'},
      redirect: 'manual', cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    });
    const headers = response.headers;
    const result = {
      status: response.status, ok: response.ok, ms: Date.now() - start,
      contentType: headers.get('content-type') || '',
      cors: headers.get('access-control-allow-origin') || '',
      csp: Boolean(headers.get('content-security-policy')),
      hsts: Boolean(headers.get('strict-transport-security')),
      frame: headers.get('x-frame-options') || '',
      location: response.status >= 300 && response.status < 400 ? 'Redirecionamento (não seguido)' : '',
    };
    if (method === 'HEAD') return result;
    const body = await limitedRead(response, parse === 'html' ? 96_000 : maxResponseBytes);
    if (parse === 'json' && response.ok) {
      try { result.data = JSON.parse(body); }
      catch { result.error = 'A resposta não é um JSON válido.'; }
    }
    if (parse === 'html' && response.ok) result.isHtml = /<html[\s>]|<!doctype html/i.test(body);
    return result;
  } catch (e) {
    const code = e?.name === 'TimeoutError' ? 'TIMEOUT' : e?.message === 'RESPONSE_TOO_LARGE' ? 'RESPONSE_TOO_LARGE' : 'NETWORK_ERROR';
    return { status: null, ok: false, ms: Date.now() - start, error: code };
  }
}
function explanation(p) {
  if (p.error === 'TIMEOUT') return 'A conexão excedeu o tempo limite.';
  if (p.error === 'RESPONSE_TOO_LARGE') return 'Resposta grande demais para análise segura.';
  if (p.error) return p.error === 'NETWORK_ERROR' ? 'Não foi possível conectar ao serviço.' : p.error;
  return `HTTP ${p.status} · ${p.ms} ms`;
}
export function summarize(results) {
  const counts = { ok: 0, warning: 0, error: 0, info: 0 };
  for (const result of results) counts[result.status] = (counts[result.status] || 0) + 1;
  return { counts, verdict: counts.error ? 'falhas' : counts.warning ? 'atenção' : 'sem-falhas-detectadas', total: results.length };
}
export async function runDiagnostics(fetcher, requested = {}) {
  const opts = validateOptions(requested); const checks = [];
  const push = (key, group, title, status, details, extra = {}) => checks.push(entry(key, group, title, status, details, extra));
  const start = Date.now();
  const [dragonHome, dragonHealth, animeHome, apiSearch] = await Promise.all([
    probe(fetcher, DEFAULTS.animeDragon, {parse:'html', timeout:7200}),
    probe(fetcher, `${DEFAULTS.animeDragon}/api/health`, {timeout:7200}),
    probe(fetcher, DEFAULTS.animeFire, {parse:'html', timeout:7200}),
    probe(fetcher, `${DEFAULTS.animeApi}/animes/pesquisar?q=${encode(opts.title)}&v=3`, {timeout:8500}),
  ]);
  push('dragon-web', 'AnimeDragon', 'Página principal responde', dragonHome.ok && dragonHome.isHtml ? 'ok' : 'error', dragonHome.ok && !dragonHome.isHtml ? 'Não retornou HTML reconhecível.' : explanation(dragonHome), { ms: dragonHome.ms });
  push('dragon-https', 'Segurança', 'HTTPS do AnimeDragon', dragonHome.ok && dragonHome.hsts ? 'ok' : 'warning', dragonHome.ok ? dragonHome.hsts ? 'HSTS presente na resposta.' : 'HSTS ausente nesta resposta; conferir política HTTPS do domínio.' : 'Não foi possível verificar os cabeçalhos.', {ms:dragonHome.ms});
  push('dragon-csp', 'Segurança', 'Política de conteúdo do AnimeDragon', dragonHome.ok && dragonHome.csp ? 'ok' : 'warning', dragonHome.ok ? dragonHome.csp ? 'CSP presente (eficácia exige auditoria de regras).' : 'Nenhuma CSP observada no HTML.' : 'Não foi possível analisar a CSP.');
  const version = typeof dragonHealth.data?.version === 'string' ? dragonHealth.data.version.slice(0, 35) : null;
  push('dragon-health', 'AnimeDragon', 'Endpoint /api/health', dragonHealth.ok && dragonHealth.data?.ok === true ? 'ok' : 'error', dragonHealth.ok ? dragonHealth.data?.ok === true ? `API operacional · versão ${version || 'não informada'}.` : 'Respondeu, mas sem sinal ok:true.' : explanation(dragonHealth), {ms:dragonHealth.ms, version});
  push('fire-web','AnimeFire','Página principal responde', animeHome.ok && animeHome.isHtml ? 'ok' : 'warning', animeHome.ok && !animeHome.isHtml ? 'Resposta não parece HTML.' : explanation(animeHome), {ms:animeHome.ms});
  const found = Array.isArray(apiSearch.data?.data) ? apiSearch.data.data : null;
  push('fire-search', 'AnimeFire', 'API de pesquisa', apiSearch.ok && found ? 'ok' : 'error', apiSearch.ok ? found ? `${found.length} resultados nesta página · ${apiSearch.ms} ms.` : 'Formato inesperado: data não é lista.' : explanation(apiSearch), {ms:apiSearch.ms});
  const exact = found?.filter(x=>validAnimeId(x?.id) && Object.values(x?.titles || {}).some(v=>normalizeTitle(v)===normalizeTitle(opts.title))) || [];
  const selected = exact.length === 1 ? exact[0] : null;
  push('match', 'Integração', 'Correspondência exata do anime', !found ? 'info' : selected ? 'ok' : 'warning', !found ? 'Não foi possível avaliar porque a pesquisa falhou.' : selected ? 'Uma correspondência exata foi identificada sem confundir títulos derivados.' : `${exact.length} correspondências exatas; é necessário conferir títulos alternativos ou ambiguidades.`, { count: exact.length });
  const pages = Number(apiSearch.data?.meta?.last_page);
  push('pagination','AnimeFire','Paginação dos resultados', found && Number.isInteger(pages) && pages >= 1 ? 'ok' : 'warning', found && pages >= 1 ? `${pages} página(s). O app consumidor deve preservar o termo de pesquisa ao paginar.` : 'A paginação não pôde ser confirmada.');
  if (opts.mode === 'quick') {
    push('browser-playback', 'Reprodução', 'Reprodução no navegador', 'info', 'Não verificada remotamente. Execute o teste manual em cada domínio e aparelho.');
    const summary = summarize(checks);
    return {at:new Date().toISOString(), elapsedMs:Date.now()-start, mode:opts.mode, requested:{title:opts.title,tmdb:opts.tmdb}, summary, checks, note:'Monitoramento de metadados não comprova reprodução ou licença de exibição.'};
  }
  const targetId = selected?.id || (normalizeTitle(opts.title) === 'black clover' ? DEFAULTS.knownAnimeId : null);
  const [providers, catalog, playback, animeInfo, userSession] = await Promise.all([
    probe(fetcher, `${DEFAULTS.animeDragon}/api/playback/providers`, {timeout:8000}),
    probe(fetcher, `${DEFAULTS.animeDragon}/api/catalog/home`, {timeout:9500}),
    probe(fetcher, `${DEFAULTS.animeDragon}/api/playback?id=${opts.tmdb}&season=1&episode=1&provider=auto`, {timeout:19000}),
    targetId ? probe(fetcher, `${DEFAULTS.animeApi}/anime/${encode(targetId)}?v=3`, {timeout:9000}) : Promise.resolve({skipped:true}),
    probe(fetcher, `${DEFAULTS.animeApi}/user?v=3`, {timeout:6000}),
  ]);
  push('providers','AnimeDragon','Provedores de reprodução',providers.ok && Array.isArray(providers.data?.providers) ? 'ok' : 'warning',providers.ok && Array.isArray(providers.data?.providers) ? `${providers.data.providers.length} provedor(es) informado(s).` : explanation(providers), {ms:providers.ms});
  const homeHasData = catalog.ok && (Array.isArray(catalog.data) || (catalog.data && typeof catalog.data==='object'));
  push('catalog','AnimeDragon','Catálogo TMDB via AnimeDragon', homeHasData ? 'ok' : 'error', homeHasData ? `Resposta JSON válida · ${catalog.ms} ms. As capas devem ser conferidas no navegador.` : explanation(catalog), {ms:catalog.ms});
  const p = playback.data;
  const playbackPayload = playback.ok && p && typeof p === 'object';
  const streams = playbackPayload && Array.isArray(p.streams) ? p.streams : [];
  const primary = p?.primaryAvailable === true || (p?.providerId === 'animefire' && p?.available === true);
  const reasons = ['MATCH_NOT_FOUND', 'EPISODE_NOT_FOUND', 'API_TIMEOUT', 'NO_COMPATIBLE_STREAM', 'DISABLED', 'API_ERROR', 'UPSTREAM_HTTP', 'TITLE_MISMATCH', 'EPISODE_MISMATCH'];
  const reasonCode = reasons.includes(p?.animefireReasonCode) ? p.animefireReasonCode : (p?.animefireReasonCode ? 'OTHER' : '');
  push('playback-json','Integração','Contrato da API /api/playback',playbackPayload && Array.isArray(p.streams) ? 'ok' : 'error',playbackPayload && Array.isArray(p.streams) ? `JSON estruturado · ${streams.length} opção(ões) retornada(s).` : explanation(playback), {ms:playback.ms});
  push('primary-stream','Integração','Fonte AnimeFire encontrada no AnimeDragon',!playbackPayload ? 'info' : primary ? 'ok' : 'warning',!playbackPayload ? 'Não foi possível analisar o provedor.' : primary ? 'Fonte AnimeFire indicada como disponível; ainda não comprova reprodução.' : `Fonte principal indisponível${reasonCode ? ` (${reasonCode})` : ''}. Fallback pode ser usado.`, {reasonCode,primaryAvailable:Boolean(primary)});
  push('fallback','Integração','Alternativa EmbedMovies',!playbackPayload ? 'info' : streams.some(s=>s?.providerId==='embedmovies'||s?.kind==='embed') || p?.embed ? 'ok' : 'warning',!playbackPayload ? 'Falha ao analisar resposta.' : streams.some(s=>s?.providerId==='embedmovies'||s?.kind==='embed') || p?.embed ? 'EmbedMovies consta como alternativa; a escolha manual de servidor ainda pode aparecer.' : 'Nenhum fallback reconhecido no JSON.');
  const direct = streams.filter(s=>s?.kind==='direct' || s?.providerId==='animefire');
  push('audio','Reprodução','Prioridade dublado / legendado',direct.length ? direct[0]?.audio === 'dublado' ? 'ok' : 'warning' : 'info',direct.length ? direct[0]?.audio==='dublado' ? 'A primeira fonte direta retornada é dublada.' : 'A primeira fonte não é dublada; pode não haver dublagem.' : 'Sem fonte direta para verificar a ordem de áudio.');
  const seasonList = Array.isArray(animeInfo.data?.data?.seasons) ? animeInfo.data.data.seasons : null;
  const episodeList = Array.isArray(animeInfo.data?.data?.episodes) ? animeInfo.data.data.episodes : null;
  const animeIdValid = animeInfo.ok && seasonList && episodeList && animeInfo.data?.data?.hero?.id === targetId;
  push('anime-detail','AnimeFire','Detalhes do anime e temporadas',animeInfo.skipped ? 'info' : animeIdValid ? 'ok' : 'error',animeInfo.skipped ? 'Sem título inequívoco; não foi solicitada a rota de outro anime.' : animeIdValid ? `${seasonList.length} temporada(s) · ${episodeList.length} episódio(s).` : explanation(animeInfo), {ms:animeInfo.ms});
  const identifiers = new Set(); let repeated = false, outOfRange = 0;
  for (const item of episodeList || []) {
    if (!validAnimeId(item.id) || identifiers.has(item.id)) repeated = true;
    identifiers.add(item.id);
    if (!Number.isInteger(Number(item.season)) || Number(item.season) < 1 || !Number.isInteger(Number(item.number)) || Number(item.number) < 1) outOfRange++;
  }
  push('episode-index','AnimeFire','IDs e numeração de episódios',!episodeList ? 'info' : !repeated && !outOfRange && episodeList.length ? 'ok' : 'warning',!episodeList ? 'Dependente dos detalhes do anime.' : !repeated && !outOfRange ? `${episodeList.length} identificadores sem repetição; manter numeração separada por temporada.` : `IDs repetidos/inválidos: ${repeated ? 'sim' : 'não'} · números inválidos: ${outOfRange}.`);
  const firstEp = episodeList?.find(e=>e.season===1 && e.number===1 && validAnimeId(e.id));
  const episodeInfo = firstEp ? await probe(fetcher, `${DEFAULTS.animeApi}/episode/${encode(firstEp.id)}?v=3`, {timeout:8500}) : {skipped:true};
  const episodeData = episodeInfo.data?.data;
  const contract = episodeInfo.ok && episodeData?.id===firstEp?.id && episodeData?.anime?.id===targetId;
  push('episode-data','AnimeFire','JSON de um episódio e associação do anime',episodeInfo.skipped ? 'info' : contract ? 'ok' : 'error',episodeInfo.skipped ? 'Nenhum EP1 identificado com segurança.' : contract ? `Episódio associado ao anime correto · ${episodeInfo.ms} ms.` : explanation(episodeInfo), {ms:episodeInfo.ms});
  const variants = Array.isArray(episodeData?.streams) ? episodeData.streams : null;
  const dublado = variants?.some(s=>s.audio==='dublado' && s.is_offline===false);
  const legendado = variants?.some(s=>s.audio==='legendado' && s.is_offline===false);
  push('language','Reprodução','Opções de áudio cadastradas',!variants ? 'info' : dublado || legendado ? 'ok' : 'warning',!variants ? 'Não foi possível conferir fontes.' : `${dublado ? 'Dublado cadastrado · ' : ''}${legendado ? 'Legendado cadastrado · ' : ''}${variants.length} fonte(s). Estado online é metadado, não teste de vídeo.`);
  const intros = (variants || []).flatMap(s=>Array.isArray(s.chapters) ? s.chapters.filter(c=>String(c.type).toLowerCase()==='intro' && Number.isFinite(c.start) && Number.isFinite(c.end) && c.end>c.start) : []);
  push('intro','Reprodução','Capítulos para pular abertura',!variants ? 'info' : intros.length ? 'ok' : 'warning',!variants ? 'Dependente dos dados do episódio.' : intros.length ? `${intros.length} intervalo(s) Intro válido(s) detectado(s).` : 'Não há Intro válido nesse episódio; o botão não deve tentar pular.');
  const cors = apiSearch.cors;
  push('browser-cors','Segurança','CORS na resposta da API AnimeFire',!apiSearch.ok ? 'info' : cors==='*'||cors.includes('site.anime-dragon.workers.dev') ? 'ok' : 'warning',!apiSearch.ok ? 'Não foi possível conferir os cabeçalhos.' : cors ? 'CORS informado; conferir allow-origin exato do navegador AnimeDragon.' : 'Sem Access-Control-Allow-Origin nessa resposta. O Cloudflare Worker pode consultar a API, mas o navegador diretamente pode ser bloqueado.');
  push('user-auth','Segurança','Endpoint privado /user',userSession.status===401 || userSession.status===403 ? 'ok' : userSession.status===200 ? 'warning' : 'info',userSession.status===401||userSession.status===403 ? 'Rota de usuário exige autenticação, como esperado.' : userSession.status===200 ? 'Rota respondeu 200 sem credenciais nesta consulta; avaliar o conteúdo exposto.' : 'Resultado inconclusivo; não enviamos credenciais.', {ms:userSession.ms});
  // O verificador jamais baixa playlists ou segmentos protegidos. Status HTTP 200 ≠ vídeo reproduzível.
  push('hls-browser','Reprodução','HLS no navegador real', 'info', 'Não testado: exige verificar CORS do CDN, codecs, carregamento, imagem/som e restrições do navegador.');
  push('resume','Reprodução','Pular abertura, progresso e próximo episódio','info','A API oferece dados de capítulos. Retomada, salto e transição precisam de teste manual no próprio player e dispositivo.');
  push('db-auth','AnimeDragon','Login, persistência e ranking','info','Não executamos login, não acessamos dados privados nem escrevemos no banco. Valide com uma conta de teste no AnimeDragon.');
  push('rights','Segurança','Permissões para distribuição dos vídeos','info','Não verificável por API. Confirme autorização de uso das obras e das fontes nos dois sites.');
  const summary = summarize(checks);
  return {at:new Date().toISOString(), elapsedMs:Date.now()-start, mode:opts.mode, requested:{title:opts.title,tmdb:opts.tmdb}, summary, checks, note:'HTTP 200 ou is_offline:false não prova que o vídeo foi reproduzido. URLs de streams e credenciais nunca são incluídas no relatório.'};
}
