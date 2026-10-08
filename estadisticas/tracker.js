/* Estudio QR · contador de visitas.
   Se incluye en cada sitio con:
   <script async src="https://<estudioqr>/t.js" data-site="nombre-del-sitio"></script>
   Registra una entrada por página vista. No usa cookies: guarda un identificador
   anónimo del navegador en localStorage para poder distinguir visitantes. */
(function () {
  try {
    var script = document.currentScript;
    if (!script) return;
    var site = script.getAttribute('data-site') || location.hostname;
    var destino = new URL(script.src).origin + '/t/collect';
    var local = null, sesion = null;
    try { local = window.localStorage; } catch (e) {}
    try { sesion = window.sessionStorage; } catch (e) {}
    function leer(st, k) { try { return st ? st.getItem(k) : null; } catch (e) { return null; } }
    function guardar(st, k, v) { try { if (st) st.setItem(k, v); } catch (e) {} }
    function borrar(st, k) { try { if (st) st.removeItem(k); } catch (e) {} }
    function nuevoId() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    }

    var vid = leer(local, 'qr_vid');
    if (!vid) { vid = nuevoId(); guardar(local, 'qr_vid', vid); }
    var sid = leer(sesion, 'qr_sid');
    if (!sid) { sid = nuevoId(); guardar(sesion, 'qr_sid', sid); }

    var url = new URL(location.href);
    var cambioUrl = false;
    // ?qr_yo=<clave> marca este navegador como del dueño; ?qr_yo=0 lo desmarca.
    var yo = url.searchParams.get('qr_yo');
    if (yo !== null) {
      if (yo === '0' || yo === '') borrar(local, 'qr_yo'); else guardar(local, 'qr_yo', yo);
      url.searchParams.delete('qr_yo');
      cambioUrl = true;
    }
    // ?ref=<nombre> identifica a quién se le pasó el link.
    var ref = url.searchParams.get('ref') || url.searchParams.get('utm_source') || '';
    if (ref) guardar(sesion, 'qr_ref_' + site, ref); else ref = leer(sesion, 'qr_ref_' + site) || '';
    if (cambioUrl && history.replaceState) {
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }

    var datos = JSON.stringify({
      site: site,
      path: location.pathname,
      title: (document.title || '').slice(0, 150),
      referrer: document.referrer || '',
      ref: ref.slice(0, 60),
      vid: vid,
      sid: sid,
      yo: leer(local, 'qr_yo') || '',
      lang: navigator.language || '',
      screen: (screen && screen.width ? screen.width + 'x' + screen.height : ''),
      tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || '')
    });

    if (navigator.sendBeacon && navigator.sendBeacon(destino, new Blob([datos], { type: 'text/plain' }))) return;
    if (window.fetch) fetch(destino, { method: 'POST', body: datos, mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' } });
  } catch (e) { /* el contador nunca debe romper el sitio */ }
})();
