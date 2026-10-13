import { runDiagnostics, validateOptions } from './diagnostics.js';

const securityHeaders = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'Cache-Control':'no-store',
  'X-Frame-Options':'DENY',
  'Access-Control-Allow-Origin':'none',
};
const rateCache = new Map();
const RETAIN_MS = 45_000;
function sendJson(data,status=200) {return new Response(JSON.stringify(data),{status,headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8'}});}
function commonHeaders(response) {
  const h = new Headers(response.headers);
  h.set('X-Content-Type-Options','nosniff');
  h.set('Referrer-Policy','no-referrer');
  h.set('X-Frame-Options','DENY');
  if (h.get('content-type')?.includes('text/html')) {
    h.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}
export default {
 async fetch(request,env={},ctx={}) {
   const url = new URL(request.url);
   if(url.pathname==='/api/health')return sendJson({ok:true,service:'AnimeDragon Observatório',version:'1.0.0'});
   if(url.pathname==='/api/diagnose') {
     if(request.method!=='GET')return sendJson({ok:false,error:'Somente GET.'},405);
     let options;
     try { options=validateOptions(Object.fromEntries(url.searchParams)); }
     catch(e) {return sendJson({ok:false,error:e.message},400);}
     const key = JSON.stringify(options); const now=Date.now();
     const previous=rateCache.get(key);
     if(previous && now < previous.until) return sendJson(await previous.task);
     const task=runDiagnostics(fetch,options);
     rateCache.set(key,{until:now+RETAIN_MS,task});
     if(rateCache.size>100) rateCache.delete(rateCache.keys().next().value);
     try {return sendJson(await task);} catch {rateCache.delete(key);return sendJson({ok:false,error:'Falha interna temporária na análise.'},503);}
   }
   if(url.pathname.startsWith('/api/'))return sendJson({ok:false,error:'Rota não encontrada.'},404);
   if(!env.ASSETS)return new Response('Configure o binding ASSETS no Cloudflare.',{status:503});
   return commonHeaders(await env.ASSETS.fetch(request));
 }
};
