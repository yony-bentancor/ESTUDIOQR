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
const USUARIO = String(process.env.PANEL_USUARIO || 'admin').trim().toLowerCase();
const CLAVE = String(process.env.PANEL_CLAVE || '').trim();
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
      country: geo.country, countryCode: geo.countryCode, region: geo.region, city: geo.city, isp: geo.isp, lat: geo.lat, lon: geo.lon,
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
  res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'strict-origin' });
  next();
});
panel.use(express.urlencoded({ extended: false, limit: '10kb' }));

panel.get('/', async (req, res, next) => {
  const sesion = sesionValida(req);
  if (!sesion) return res.render('panel/login.njk', { title: 'Ingresar', ruta: PANEL_RUTA, error: req.query.error });
  try { res.render('panel/index.njk', await armarPanel(req, sesion)); } catch (e) {
    console.error('[estadisticas] error del panel:', e);
    res.status(500).render('panel/error.njk', { title: 'Panel', ruta: PANEL_RUTA, mensaje: e.message, esMongo: store.tipo === 'mongo' });
  }
});

panel.post('/ingresar', (req, res) => {
  if (demasiadosLogins(req)) return res.redirect(`${PANEL_RUTA}?error=intentos`);
  const ok = iguales(String(req.body.usuario || '').trim().toLowerCase(), USUARIO) && iguales(String(req.body.clave || '').trim(), CLAVE);
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

/* ---------- bandeja de mensajes ---------- */
panel.get('/mensajes', async (req, res, next) => {
  const sesion = sesionValida(req);
  if (!sesion) return res.redirect(PANEL_RUTA);
  try {
    const lista = await store.leerMensajes(200);
    res.render('panel/mensajes.njk', {
      title: 'Mensajes', ruta: PANEL_RUTA, csrf: firmar('csrf' + sesion), borrados: Number(req.query.borrados) || 0,
      mensajes: lista.map((m) => ({
        id: m.id, nuevo: !m.leido, fecha: fmtFecha.format(new Date(m.ts)), nombre: m.nombre, email: m.email, mensaje: m.mensaje,
        resumen: limpiar(String(m.mensaje || '').replace(/\s+/g, ' '), 140),
        correo: m.correo === 'enviado' ? 'Aviso enviado por correo' : m.correo === 'error' ? 'No se pudo enviar el aviso por correo' : ''
      }))
    });
    // Al abrir la bandeja, los mensajes quedan leídos (en la lista se siguen viendo como «nuevo» esta vez).
    store.marcarLeidos().catch(() => {});
  } catch (e) { next(e); }
});

panel.post('/mensajes/borrar', async (req, res, next) => {
  const sesion = sesionValida(req);
  if (!sesion || !iguales(req.body._csrf || '', firmar('csrf' + sesion))) return res.redirect(PANEL_RUTA);
  try {
    let ids = [].concat(req.body.id || []).map((id) => limpiar(id, 40)).filter(Boolean);
    if (req.body.todos === '1') ids = (await store.leerMensajes(1000)).map((m) => m.id);
    if (ids.length) await store.borrarMensajes(ids);
    res.redirect(`${PANEL_RUTA}/mensajes?borrados=${ids.length}`);
  } catch (e) { next(e); }
});

router.use(PANEL_RUTA, panel);

/* ---------- cálculo del panel ---------- */
const RANGOS = { ayer: 'Ayer', hoy: 'Hoy', 7: 'Última semana', 30: 'Último mes', 90: 'Últimos 90 días', 365: 'Último año' };
const RANGO_INICIAL = 'ayer';
const FRASE = { ayer: 'Ayer', hoy: 'Hoy', 7: 'En la última semana', 30: 'En el último mes', 90: 'En los últimos 90 días', 365: 'En el último año' };

function contar(lista, clave, top = 8) {
  const m = new Map();
  lista.forEach((v) => { const k = typeof clave === 'function' ? clave(v) : v[clave]; if (k) m.set(k, (m.get(k) || 0) + 1); });
  const total = lista.length || 1;
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => ({ k, n, pct: Math.round((n / total) * 100) }));
}
const lugar = (v) => [v.city, v.region && v.region !== v.city ? v.region : '', v.country].filter(Boolean).join(', ') || 'Sin datos';
// Versión corta para el resumen: "Montevideo", "Colonia, Uruguay", "Madrid, España".
const lugarCorto = (v) => {
  if (!v.country) return 'Sin ubicación';
  if (v.country === 'Red local') return 'Red local';
  const ciudad = v.city || v.region;
  if (v.countryCode === 'UY' && ciudad && /montevideo/i.test(ciudad)) return 'Montevideo';
  return ciudad ? `${ciudad}, ${v.country}` : v.country;
};
const bandera = (cc) => (/^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : '');
const fmtHora = new Intl.DateTimeFormat('es-UY', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });

async function armarPanel(req, sesion) {
  const rango = RANGOS[req.query.rango] ? String(req.query.rango) : RANGO_INICIAL;
  const sitio = SITIOS[req.query.sitio] ? req.query.sitio : '';
  const mios = ['ocultar', 'mostrar', 'solo'].includes(req.query.mios) ? req.query.mios : 'ocultar';
  const bots = req.query.bots === 'mostrar' ? 'mostrar' : 'ocultar';

  const ahora = new Date();
  const inicioDia = (f) => new Date(`${fmtDia.format(f)}T00:00:00${offsetDe(f)}`);
  const hoy0 = inicioDia(ahora);
  let desde; let hasta = ahora;
  if (rango === 'hoy') desde = hoy0;
  else if (rango === 'ayer') { desde = inicioDia(new Date(hoy0.getTime() - 12 * 3600e3)); hasta = new Date(hoy0.getTime() - 1); }
  else desde = new Date(ahora.getTime() - Number(rango) * 864e5);

  const config = await store.leerConfig();
  const duenos = new Set(config.ownerVids || []);
  const aliases = config.aliases || {};
  const esMio = (v) => v.yo || duenos.has(v.vid);

  const todas = (await store.buscar(desde, hasta)).sort((a, b) => b.ts - a.ts);
  const base = todas.filter((v) => (bots === 'mostrar' || !v.bot) && (!sitio || v.site === sitio));
  const visitas = base.filter((v) => (mios === 'mostrar' ? true : mios === 'solo' ? esMio(v) : !esMio(v)));
  const ajenas = base.filter((v) => !esMio(v));

  // Visitas guardadas antes de registrar coordenadas: se ubican ahora (máx. 40 IPs por carga).
  const sinCoords = [...new Set(visitas.filter((v) => v.lat == null && v.ip).map((v) => v.ip))].slice(0, 40);
  if (sinCoords.length) {
    const res = await Promise.all(sinCoords.map(async (ip) => [ip, await ubicar(ip)]));
    const porIp = new Map(res.filter(([, g]) => g.lat != null));
    visitas.forEach((v) => { const g = porIp.get(v.ip); if (g && v.lat == null) { v.lat = g.lat; v.lon = g.lon; } });
    for (const [ip, g] of porIp) store.completarUbicacion(ip, g.lat, g.lon).catch(() => {});
  }

  // Puntos del mapa: se agrupan las visitas por lugar (coordenadas redondeadas).
  const puntos = new Map();
  visitas.forEach((v) => {
    if (v.lat == null || v.lon == null) return;
    const k = `${Number(v.lat).toFixed(2)},${Number(v.lon).toFixed(2)}`;
    let p = puntos.get(k);
    if (!p) { p = { lat: Number(v.lat), lon: Number(v.lon), lugar: lugar(v), entradas: 0, ajenas: 0, quienes: new Set(), sitios: new Set(), ultima: v.ts }; puntos.set(k, p); }
    p.entradas++;
    if (!esMio(v)) p.ajenas++;
    p.quienes.add(aliases[v.vid] || (esMio(v) ? 'vos' : v.vid.slice(0, 8)));
    p.sitios.add(SITIOS[v.site] ? SITIOS[v.site].nombre : v.site);
    if (v.ts > p.ultima) p.ultima = v.ts;
  });
  const mapa = [...puntos.values()].map((p) => ({
    lat: p.lat, lon: p.lon, lugar: p.lugar, entradas: p.entradas, ajenas: p.ajenas,
    quienes: [...p.quienes].slice(0, 8).join(', '), personas: p.quienes.size,
    sitios: [...p.sitios].join(', '), ultima: fmtFecha.format(p.ultima)
  }));
  const sinUbicar = visitas.filter((v) => v.lat == null).length;

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
  const nDias = rango === 'hoy' || rango === 'ayer' ? 1 : Math.min(Number(rango), 90);
  for (let i = nDias - 1; i >= 0; i--) {
    const d = fmtDia.format(new Date(hasta.getTime() - i * 864e5));
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

  // Quién entró: una fila por persona (navegador) y sitio, de la más reciente a la más vieja.
  const porPersona = new Map();
  visitas.forEach((v) => { // visitas está ordenada de la más nueva a la más vieja
    const k = v.vid + '|' + v.site;
    let p = porPersona.get(k);
    if (!p) { p = { v, paginas: [], ultima: v.ts, primera: v.ts }; porPersona.set(k, p); }
    p.primera = v.ts; p.paginas.push(v.path); p.llegada = v;
  });
  const fmtCuando = nDias === 1 ? fmtHora : fmtFecha;
  const personas = [...porPersona.values()].slice(0, 200).map(({ v, paginas, ultima, primera, llegada }) => ({
    vid: v.vid, quien: aliases[v.vid] || '', mio: esMio(v),
    sitio: SITIOS[v.site] ? SITIOS[v.site].nombre : v.site,
    lugar: lugarCorto(v), detalle: lugar(v), bandera: bandera(v.countryCode), isp: v.isp,
    paginas: paginas.length, recorrido: [...new Set(paginas.reverse())].slice(0, 6).join(' → '),
    cuando: fmtCuando.format(primera) + (ultima - primera > 60e3 ? ' – ' + fmtHora.format(ultima) : ''),
    origen: origenDe(llegada.referrer, llegada.host), ref: llegada.ref,
    dispositivo: `${v.device} · ${v.os}`, bot: v.bot
  }));
  // Resumen en una frase: cuántas personas y de dónde.
  const lugares = new Map();
  [...porPersona.values()].forEach(({ v }) => { const l = lugarCorto(v); lugares.set(l, (lugares.get(l) || 0) + 1); });
  const nPersonas = new Set(visitas.map((v) => v.vid)).size;
  const frase = {
    cuando: FRASE[rango],
    personas: nPersonas,
    donde: sitio ? (SITIOS[sitio] ? SITIOS[sitio].nombre : sitio) : 'tus sitios',
    paginas: visitas.length,
    lugares: [...lugares.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([l, n]) => (n > 1 ? `${n} de ${l}` : l)),
    quien: mios === 'solo' ? 'tus visitas' : mios === 'mostrar' ? 'todas' : 'otras personas'
  };
  // Pestañas de sitios: personas de cada sitio en el período (con los mismos filtros, sin el de sitio).
  const sinSitio = todas.filter((v) => (bots === 'mostrar' || !v.bot) && (mios === 'mostrar' ? true : mios === 'solo' ? esMio(v) : !esMio(v)));
  const pestanas = Object.entries(SITIOS).map(([clave, s]) => ({
    clave, nombre: s.nombre, personas: new Set(sinSitio.filter((v) => v.site === clave).map((v) => v.vid)).size
  }));
  const totalPersonas = new Set(sinSitio.map((v) => v.vid)).size;

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
    porSitio, dias, personas, frase, pestanas, totalPersonas,
    paises: contar(visitas, lugar),
    mapaJson: JSON.stringify(mapa).replace(/</g, '\\u003c'), mapaPuntos: mapa.length, sinUbicar,
    origenes: contar(visitas, (v) => origenDe(v.referrer, v.host)),
    refs: contar(visitas, 'ref'),
    dispositivos: contar(visitas, 'device'),
    paginas: contar(visitas, (v) => `${SITIOS[v.site] ? SITIOS[v.site].nombre : v.site} ${v.path}`),
    visitantes, ultimas,
    noLeidos: await store.contarNoLeidos().catch(() => 0),
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
