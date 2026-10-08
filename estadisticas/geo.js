/*
  Ubicación aproximada a partir de la IP (país / región / ciudad / proveedor).
  Usa servicios gratuitos sin clave; si fallan, la visita se guarda igual sin ubicación.
  La ubicación por IP es aproximada: a veces muestra la ciudad del proveedor de internet.
*/
const cache = new Map();
const VACIO = { country: '', countryCode: '', region: '', city: '', isp: '' };

function esPrivada(ip) {
  return !ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip) || ip === '::';
}

async function consultar(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; } finally { clearTimeout(t); }
}

async function ubicar(ip) {
  if (esPrivada(ip)) return { ...VACIO, country: 'Red local' };
  if (cache.has(ip)) return cache.get(ip);
  let geo = null;
  const a = await consultar(`https://ipwho.is/${encodeURIComponent(ip)}?lang=es`, 2500);
  if (a && a.success !== false && a.country) {
    geo = { country: a.country, countryCode: a.country_code || '', region: a.region || '', city: a.city || '', isp: (a.connection && (a.connection.isp || a.connection.org)) || '' };
  } else {
    const b = await consultar(`http://ip-api.com/json/${encodeURIComponent(ip)}?lang=es&fields=status,country,countryCode,regionName,city,isp`, 2500);
    if (b && b.status === 'success') geo = { country: b.country, countryCode: b.countryCode, region: b.regionName, city: b.city, isp: b.isp };
  }
  geo = geo || { ...VACIO };
  if (cache.size > 5000) cache.clear();
  if (geo.country) cache.set(ip, geo);
  return geo;
}

module.exports = { ubicar };
