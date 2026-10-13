# Validação de entrega — Observatório 1.0

Os diagnósticos são consultas **sem alterações** aos sites do usuário. Não controlam nem corrigem automaticamente as APIs monitoradas.

Testes automatizados locais feitos com APIs simuladas:

- Parâmetros de nome e TMDB aceitos/rejeitados apropriadamente.
- Proteção contra uso do monitor como proxy de domínios arbitrários.
- Limitação de payload JSON e redirecionamento não seguido.
- Rápido: exatamente 4 chamadas de rede.
- Completo: pesquisa → anime → episódio, idioma, capítulos e status dos dois serviços.
- Diferencia retorno de EmbedMovies e retorno real de fonte AnimeFire.
- Erro na busca não é confundido com sucesso de reprodução.
- URLs assinadas não aparecem no relatório retornado.
- `/api/health` retorna status; roteamento inválido recebe 404; entrada inválida recebe 400.

**Sem teste real de produção:** não foi publicada nenhuma instância Cloudflare nesta entrega; sucesso com dados simulados não demonstra que o site AnimeFire responderá ao Worker em todas as regiões, nem valida CORS, DRM, codecs, transcodificação, disponibilidade de cada anime ou qualquer permissão de exibição.
