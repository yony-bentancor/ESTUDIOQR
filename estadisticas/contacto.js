/*
  Formulario de contacto de Estudio QR.
  POST /contacto → guarda el mensaje en la base (se ve en el panel) y avisa por correo.

  Correo (opcional, con Resend: https://resend.com, plan gratis):
    RESEND_API_KEY      clave de la API
    CONTACTO_DESTINO    a dónde llega el aviso (con el remitente de prueba de Resend,
                        tiene que ser el mismo correo con el que creaste la cuenta)
    CONTACTO_REMITENTE  opcional, por ejemplo "Estudio QR <hola@estudioqr.com.uy>"
                        (requiere verificar el dominio en Resend). Por defecto usa el de prueba.
  Sin RESEND_API_KEY el mensaje igual queda guardado y visible en el panel.
*/
const express = require('express');
const crypto = require('crypto');
const store = require('./store');

const router = express.Router();
const intentos = new Map(); // ip -> [tiempos]
const VENTANA = 10 * 60 * 1000;
const MAXIMO = 5;

function demasiados(ip) {
  const ahora = Date.now();
  const lista = (intentos.get(ip) || []).filter((t) => ahora - t < VENTANA);
  lista.push(ahora);
  intentos.set(ip, lista);
  if (intentos.size > 5000) intentos.clear();
  return lista.length > MAXIMO;
}

const limpiar = (v, max) => String(v || '').replace(/\r\n/g, '\n').trim().slice(0, max);
const emailValido = (v) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);

async function avisarPorCorreo(m) {
  const clave = String(process.env.RESEND_API_KEY || '').trim();
  const destino = String(process.env.CONTACTO_DESTINO || '').trim();
  if (!clave || !destino) return 'sin-configurar';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: String(process.env.CONTACTO_REMITENTE || 'Estudio QR <onboarding@resend.dev>').trim(),
      to: destino.split(',').map((d) => d.trim()).filter(Boolean),
      reply_to: m.email,
      subject: `Nuevo contacto en Estudio QR: ${m.nombre}`,
      text: `Nombre: ${m.nombre}\nEmail: ${m.email}\n\n${m.mensaje}\n\n— Enviado desde el formulario de estudioqr.com.uy`
    }),
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`Resend respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return 'enviado';
}

router.post('/contacto', express.urlencoded({ extended: false, limit: '20kb' }), express.json({ limit: '20kb' }), async (req, res) => {
  const quiereJson = (req.get('accept') || '').includes('application/json');
  const responder = (status, ok, mensaje) => quiereJson
    ? res.status(status).json({ ok, mensaje })
    : res.redirect(303, `/?contacto=${ok ? 'ok' : 'error'}#contacto`);

  const b = req.body || {};
  if (b.sitio_web) return responder(200, true, '¡Gracias! Recibimos tu mensaje.'); // trampa para robots
  const m = {
    id: crypto.randomBytes(6).toString('hex'),
    ts: new Date(),
    nombre: limpiar(b.nombre || b.Nombre, 120),
    email: limpiar(b.email || b.Email, 160).toLowerCase(),
    mensaje: limpiar(b.mensaje || b.Mensaje, 4000),
    ip: req.ip,
    correo: 'pendiente'
  };
  if (!m.nombre || !emailValido(m.email) || m.mensaje.length < 2) {
    return responder(400, false, 'Revisá los datos: falta el nombre, el email no es válido o el mensaje está vacío.');
  }
  if (demasiados(req.ip)) return responder(429, false, 'Enviaste varios mensajes seguidos. Probá de nuevo en unos minutos.');

  try {
    m.correo = await avisarPorCorreo(m).catch((e) => { console.error('[contacto] no se pudo enviar el correo:', e.message); return 'error'; });
    await store.guardarMensaje(m);
  } catch (e) {
    console.error('[contacto] no se pudo guardar el mensaje:', e.message);
    if (m.correo !== 'enviado') return responder(503, false, 'No pudimos enviar tu mensaje en este momento. Probá de nuevo en unos minutos.');
  }
  responder(200, true, '¡Gracias! Recibimos tu mensaje y te respondemos a la brevedad.');
});

module.exports = router;
