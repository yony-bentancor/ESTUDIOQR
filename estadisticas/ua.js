/* Interpretación simple del navegador, sistema y tipo de dispositivo. */
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|headless|lighthouse|pagespeed|curl|wget|python|axios|node-fetch|go-http/i;

function interpretar(ua = '') {
  let browser = 'Otro';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  if (/Instagram/.test(ua)) browser += ' (Instagram)';
  else if (/FBAN|FBAV/.test(ua)) browser += ' (Facebook)';

  let os = 'Otro';
  if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let device = 'Computadora';
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device = 'Tablet';
  else if (/Mobi|iPhone|Android/.test(ua)) device = 'Celular';

  return { browser, os, device, bot: BOTS.test(ua) };
}

function origenDe(referrer, propioHost) {
  if (!referrer) return 'Directo / link compartido';
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, '');
    if (propioHost && h === propioHost) return 'Navegación interna';
    if (/google\./.test(h)) return 'Google';
    if (/bing\.|duckduckgo|yahoo\./.test(h)) return 'Buscador';
    if (/facebook\.|fb\./.test(h)) return 'Facebook';
    if (/instagram\./.test(h)) return 'Instagram';
    if (/whatsapp|wa\.me/.test(h)) return 'WhatsApp';
    if (/t\.co$|twitter\.|x\.com/.test(h)) return 'X / Twitter';
    if (/linkedin\./.test(h)) return 'LinkedIn';
    if (/estudioqr/.test(h)) return 'Estudio QR';
    return h;
  } catch (e) { return 'Desconocido'; }
}

module.exports = { interpretar, origenDe };
