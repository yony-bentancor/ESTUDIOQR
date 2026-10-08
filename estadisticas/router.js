/*
  Estadísticas de Estudio QR
  - GET  /t.js          script que se incluye en cada sitio
  - POST /t/collect     recibe cada página vista
  - PANEL_RUTA          panel privado (no está enlazado desde ninguna página)
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const store = require('./store');
const { ubicar } = require('./geo');
const { interpretar, origenDe } = require('./ua');
const SITIOS = require('./sitios');

const PANEL_RUTA = '/' + String(process.env.PANEL_RUTA || 'panel-privado-qr').replace(/^\/+|\/+$/g, '');
const USUARIO = process.env.PANEL_USUARIO || 'admin';
const CLAVE = process.env.PANEL_CLAVE || '';
const SECRETO = process.env.PANEL_SECRETO || CLAVE;
const ZONA = process.env.ESTADISTICAS_ZONA || 'America/Montevideo';
const COOKIE = 'qr_panel';
const HORAS_SESION = 12;

const router = express.Router();
const trackerJs = fs.readFileSync(path.join(__dirname, 'tracker.js'), 'utf8');

/* ---------- utilidades ---------- */
const firmar = (texto) => crypto.createHmac('sha256', SECRETO).update(texto).digest('base64url');
const iguales = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const claveDueno = () => firmar('navegador-del-dueno').slice(0, 22);

function leerCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((par) => {
    const i = par.indexOf('=');
    if (i > 0) out[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  });
  return out;
}

function sesionValida(req) {
  if (!CLAVE) return false;
  const valor = leerCookies(req)[COOKIE];
  if (!valor) return false;
  const [datos, firma] = valor.split('.');
  if (!datos || !firma || !iguales(firma, firmar(datos))) return false;
  try {
    const s = JSON.parse(Buffer.from(datos, 'base64url').toString());
    return s.u === USUARIO && s.exp > Date.now() ? valor : false;
  } catch (e) { return false; }
}

function intentosLimitados(max, minutos) {
  const hits = new Map();
  return (req) => {
    const ahora = Date.now();
    const lista = (hits.get(req.ip) || []).filter((t) => ahora - t < minutos * 60000);
    lista.push(ahora);
    hits.set(req.ip, lista);
    if (hits.size > 10000) hits.clear();
    return lista.length > max;
  };
}
const demasiadosLogins = intentosLimitados(8, 15);
const demasiadasVisitas = intentosLimitados(240, 1);

const fmtFecha = new Intl.DateTimeFormat('es-UY', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
const limpiar = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').slice(0, max);

/* ---------- script público ---------- */
router.get('/t.js', (req, res) => {
  res.set({
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Access-Control-Allow-Origin': '*'
  });
  res.send(trackerJs);
});

router.options('/t/collect', (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.sendStatus(204);
});

router.post('/t/collect', express.text({ type: '*/*', limit: '4kb' }), async (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' });
  res.sendStatus(204);
  try {
    if (demasiadasVisitas(req)) return;
    const d = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const site = limpiar(d.site, 40).toLowerCase();
    if (!SITIOS[site]) return;
    const vid = limpiar(d.vid, 64);
    if (!/^[\w-]{8,64}$/.test(vid)) return;
    const ua = req.get('user-agent') || '';
    const info = interpretar(ua);
    const ip = req.ip || '';
    const geo = await ubicar(ip);
    let host = '';
    try { host = new URL(req.get('origin') || req.get('referer') || '').hostname; } catch (e) { /* sin origen */ }
    await store.insertar({
      ts: new Date(),
      site,
      host,
      path: limpiar(d.path, 300) || '/',
      title: limpiar(d.title, 150),
      referrer: limpiar(d.referrer, 300),
      ref: limpiar(d.ref, 60),
      vid,
      sid: limpiar(d.sid, 64),
      yo: (d.yo && iguales(d.yo, claveDueno())) || Boolean(sesionValida(req)),
      ip,
      country: geo.country, countryCode: geo.countryCode, region: geo.region, city: geo.city, isp: geo.isp,
      browser: info.browser, os: info.os, device: info.device, bot: info.bot,
      lang: limpiar(d.lang, 20), screen: limpiar(d.screen, 20), tz: limpiar(d.tz, 50),
      ua: limpiar(ua, 300)
    });
  } catch (e) {
    if (!(e instanceof SyntaxError)) console.error('[estadisticas] visita descartada:', e.message);
  }
});

/* ---------- panel ---------- */
const panel = express.Router();
panel.use((req, res, next) => {
  if (!CLAVE) return next('router'); // sin PANEL_CLAVE el panel no existe (da 404)
  res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  next();
});
panel.use(express.urlencoded({ extended: false, limit: '10kb' }));

panel.get('/', async (req, res, next) => {
  const sesion = sesionValida(req);
  if (!sesion) return res.render('panel/login.njk', { title: 'Ingresar', ruta: PANEL_RUTA, error: req.query.error });
  try { res.render('panel/index.njk', await armarPanel(req, sesion)); } catch (e) { next(e); }
});

panel.post('/ingresar', (req, res) => {
  if (demasiadosLogins(req)) return res.redirect(`${PANEL_RUTA}?error=intentos`);
  const ok = iguales(req.body.usuario || '', USUARIO) && iguales(req.body.clave || '', CLAVE);
  if (!ok) return res.redirect(`${PANEL_RUTA}?error=datos`);
  const datos = Buffer.from(JSON.stringify({ u: USUARIO, exp: Date.now() + HORAS_SESION * 3600e3 })).toString('base64url');
  const seguro = req.secure ? '; Secure' : '';
  res.set('Set-Cookie', `${COOKIE}=${datos}.${firmar(datos)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${HORAS_SESION * 3600}${seguro}`);
  res.redirect(PANEL_RUTA);
});

panel.post('/salir', (req, res) => {
  res.set('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.redirect(PANEL_RUTA);
});

panel.post('/visitante', async (req, res, next) => {
  const sesion = sesionValida(req);
  if (!sesion || !iguales(req.body._csrf || '', firmar('csrf' + sesion))) return res.redirect(PANEL_RUTA);
  try {
    const vid = limpiar(req.body.vid, 64);
    const config = await store.leerConfig();
    const duenos = new Set(config.ownerVids || []);
    const aliases = { ...(config.aliases || {}) };
    if (req.body.accion === 'soyyo') duenos.add(vid);
    if (req.body.accion === 'noesmio') duenos.delete(vid);
    if (req.body.accion === 'nombre') {
      const nombre = limpiar(req.body.nombre, 40).trim();
      if (nombre) aliases[vid] = nombre; else delete aliases[vid];
    }
    await store.guardarConfig({ ...config, ownerVids: [...duenos], aliases });
    res.redirect(PANEL_RUTA + (req.body.volver || ''));
  } catch (e) { next(e); }
});

router.use(PANEL_RUTA, panel);

/* ---------- cálculo del panel ---------- */
const RANGOS = { hoy: 'Hoy', 7: 'Últimos 7 días', 30: 'Últimos 30 días', 90: 'Últimos 90 días', 365: 'Último año' };

function contar(lista, clave, top = 8) {
  const m = new Map();
  lista.forEach((v) => { const k = typeof clave === 'function' ? clave(v) : v[clave]; if (k) m.set(k, (m.get(k) || 0) + 1); });
  const total = lista.length || 1;
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => ({ k, n, pct: Math.round((n / total) * 100) }));
}
const lugar = (v) => [v.city, v.region && v.region !== v.city ? v.region : '', v.country].filter(Boolean).join(', ') || 'Sin datos';

async function armarPanel(req, sesion) {
  const rango = RANGOS[req.query.rango] ? String(req.query.rango) : '7';
  const sitio = SITIOS[req.query.sitio] ? req.query.sitio : '';
  const mios = ['ocultar', 'mostrar', 'solo'].includes(req.query.mios) ? req.query.mios : 'ocultar';
  const bots = req.query.bots === 'mostrar' ? 'mostrar' : 'ocultar';

  const ahora = new Date();
  let desde;
  if (rango === 'hoy') desde = new Date(`${fmtDia.format(ahora)}T00:00:00${offsetDe(ahora)}`);
  else desde = new Date(ahora.getTime() - Number(rango) * 864e5);

  const config = await store.leerConfig();
  const duenos = new Set(config.ownerVids || []);
  const aliases = config.aliases || {};
  const esMio = (v) => v.yo || duenos.has(v.vid);

  const todas = (await store.buscar(desde, ahora)).sort((a, b) => b.ts - a.ts);
  const base = todas.filter((v) => (bots === 'mostrar' || !v.bot) && (!sitio || v.site === sitio));
  const visitas = base.filter((v) => (mios === 'mostrar' ? true : mios === 'solo' ? esMio(v) : !esMio(v)));
  const ajenas = base.filter((v) => !esMio(v));

  // por sitio
  const porSitio = Object.entries(SITIOS).map(([clave, s]) => {
    const vs = visitas.filter((v) => v.site === clave);
    const aj = ajenas.filter((v) => v.site === clave);
    return {
      clave, nombre: s.nombre, url: s.url,
      entradas: vs.length,
      visitantes: new Set(vs.map((v) => v.vid)).size,
      ajenas: aj.length,
      ultimaAjena: aj[0] ? fmtFecha.format(aj[0].ts) : '—'
    };
  }).filter((s) => s.url || s.entradas);

  // por día
  const dias = [];
  const nDias = rango === 'hoy' ? 1 : Math.min(Number(rango), 90);
  for (let i = nDias - 1; i >= 0; i--) {
    const d = fmtDia.format(new Date(ahora.getTime() - i * 864e5));
    dias.push({ dia: d, n: 0 });
  }
  const idx = new Map(dias.map((d, i) => [d.dia, i]));
  visitas.forEach((v) => { const i = idx.get(fmtDia.format(v.ts)); if (i !== undefined) dias[i].n++; });
  const maxDia = Math.max(1, ...dias.map((d) => d.n));
  dias.forEach((d) => { d.alto = Math.round((d.n / maxDia) * 100); d.etiqueta = d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7); });

  // visitantes
  const grupos = new Map();
  [...base].reverse().forEach((v) => {
    let g = grupos.get(v.vid);
    if (!g) {
      g = { vid: v.vid, primera: v.ts, entradas: 0, sitios: new Set(), refs: new Set(), ips: new Set() };
      grupos.set(v.vid, g);
    }
    g.entradas++; g.ultima = v.ts; g.sitios.add(SITIOS[v.site] ? SITIOS[v.site].nombre : v.site);
    if (v.ref) g.refs.add(v.ref);
    if (v.ip) g.ips.add(v.ip);
    g.lugar = lugar(v); g.dispositivo = `${v.device} · ${v.os} · ${v.browser}`; g.isp = v.isp; g.mio = esMio(v) || g.mio;
  });
  const visitantes = [...grupos.values()]
    .filter((g) => (mios === 'mostrar' ? true : mios === 'solo' ? g.mio : !g.mio))
    .sort((a, b) => b.ultima - a.ultima)
    .slice(0, 150)
    .map((g) => ({
      vid: g.vid, corto: g.vid.slice(0, 8), alias: aliases[g.vid] || '', mio: g.mio,
      entradas: g.entradas, primera: fmtFecha.format(g.primera), ultima: fmtFecha.format(g.ultima),
      sitios: [...g.sitios].join(', '), refs: [...g.refs].join(', '), ips: [...g.ips].slice(-3).join(', '),
      lugar: g.lugar, dispositivo: g.dispositivo, isp: g.isp
    }));

  const ultimas = visitas.slice(0, 300).map((v) => ({
    fecha: fmtFecha.format(v.ts),
    sitio: SITIOS[v.site] ? SITIOS[v.site].nombre : v.site,
    path: v.path,
    titulo: v.title,
    origen: origenDe(v.referrer, v.host),
    ref: v.ref,
    lugar: lugar(v),
    isp: v.isp,
    ip: v.ip,
    dispositivo: `${v.device} · ${v.os} · ${v.browser}`,
    quien: aliases[v.vid] || v.vid.slice(0, 8),
    mio: esMio(v),
    bot: v.bot
  }));

  const filtros = new URLSearchParams({ rango, sitio, mios, bots }).toString();
  const token = claveDueno();
  return {
    title: 'Panel de visitas',
    ruta: PANEL_RUTA,
    filtros: '?' + filtros,
    rango, sitio, mios, bots, RANGOS,
    sitios: Object.entries(SITIOS).map(([clave, s]) => ({ clave, ...s })),
    almacenamiento: store.tipo,
    csrf: firmar('csrf' + sesion),
    resumen: {
      entradas: visitas.length,
      visitantes: new Set(visitas.map((v) => v.vid)).size,
      sesiones: new Set(visitas.map((v) => v.sid)).size,
      ajenas: ajenas.length,
      visitantesAjenos: new Set(ajenas.map((v) => v.vid)).size,
      ultimaAjena: ajenas[0] ? `${fmtFecha.format(ajenas[0].ts)} · ${SITIOS[ajenas[0].site] ? SITIOS[ajenas[0].site].nombre : ajenas[0].site} · ${lugar(ajenas[0])}` : ''
    },
    porSitio, dias,
    paises: contar(visitas, lugar),
    origenes: contar(visitas, (v) => origenDe(v.referrer, v.host)),
    refs: contar(visitas, 'ref'),
    dispositivos: contar(visitas, 'device'),
    paginas: contar(visitas, (v) => `${SITIOS[v.site] ? SITIOS[v.site].nombre : v.site} ${v.path}`),
    visitantes, ultimas,
    linksDueno: Object.values(SITIOS).filter((s) => s.url).map((s) => ({
      nombre: s.nombre,
      marcar: s.url + (s.url.includes('?') ? '&' : '?') + 'qr_yo=' + token,
      desmarcar: s.url + (s.url.includes('?') ? '&' : '?') + 'qr_yo=0'
    }))
  };
}

// Desfase horario de la zona configurada, por ejemplo "-03:00".
function offsetDe(fecha) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, timeZoneName: 'longOffset' }).formatToParts(fecha);
  const t = (partes.find((p) => p.type === 'timeZoneName') || {}).value || 'GMT';
  const m = t.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : 'Z';
}

module.exports = { router, PANEL_RUTA };
