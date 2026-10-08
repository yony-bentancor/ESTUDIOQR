/*
  Almacenamiento de visitas.
  - Con MONGODB_URI (por ejemplo MongoDB Atlas gratuito) las visitas quedan guardadas para siempre.
  - Sin MONGODB_URI se guardan en memoria + archivo local (data/estadisticas.json).
    Sirve para probar en tu PC, pero en Heroku se borra cada vez que la app se reinicia.
*/
const fs = require('fs');
const path = require('path');

const DIAS_GUARDADO = Number(process.env.ESTADISTICAS_DIAS || 365);
const CONFIG_INICIAL = { ownerVids: [], aliases: {} };

function crearStoreArchivo() {
  const archivo = path.join(__dirname, '..', 'data', 'estadisticas.json');
  let estado = { visitas: [], config: { ...CONFIG_INICIAL } };
  try {
    const leido = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    estado = { visitas: (leido.visitas || []).map((v) => ({ ...v, ts: new Date(v.ts) })), config: { ...CONFIG_INICIAL, ...leido.config } };
  } catch (e) { /* sin datos previos */ }
  let pendiente = null;
  function persistir() {
    if (pendiente) return;
    pendiente = setTimeout(() => {
      pendiente = null;
      try {
        fs.mkdirSync(path.dirname(archivo), { recursive: true });
        fs.writeFileSync(archivo, JSON.stringify(estado));
      } catch (e) { console.error('[estadisticas] no se pudo guardar el archivo:', e.message); }
    }, 1500);
  }
  return {
    tipo: 'archivo',
    async insertar(visita) {
      estado.visitas.push(visita);
      const limite = Date.now() - DIAS_GUARDADO * 864e5;
      if (estado.visitas.length > 50000 || (estado.visitas[0] && estado.visitas[0].ts < limite)) {
        estado.visitas = estado.visitas.filter((v) => v.ts >= limite).slice(-50000);
      }
      persistir();
    },
    async buscar(desde, hasta) {
      return estado.visitas.filter((v) => v.ts >= desde && v.ts <= hasta);
    },
    async completarUbicacion(ip, lat, lon) {
      estado.visitas.forEach((v) => { if (v.ip === ip && v.lat == null) { v.lat = lat; v.lon = lon; } });
      persistir();
    },
    async leerConfig() { return estado.config; },
    async guardarConfig(config) { estado.config = config; persistir(); }
  };
}

function crearStoreMongo(uri) {
  const { MongoClient } = require('mongodb');
  let listo = null;
  let ultimoError = '';
  function conectar() {
    if (listo) return listo;
    const cliente = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    listo = (async () => {
      await cliente.connect();
      const db = cliente.db(process.env.ESTADISTICAS_DB || 'estudioqr_estadisticas');
      const visitas = db.collection('visitas');
      await visitas.createIndex({ ts: 1 }, { expireAfterSeconds: DIAS_GUARDADO * 86400 });
      await visitas.createIndex({ site: 1, ts: -1 });
      ultimoError = '';
      return { visitas, config: db.collection('config') };
    })();
    // Si falla, se descarta para reintentar en el próximo pedido.
    listo.catch((e) => {
      ultimoError = e.message;
      console.error('[estadisticas] no se pudo conectar a MongoDB:', e.message);
      listo = null;
      cliente.close().catch(() => {});
    });
    return listo;
  }
  conectar();
  return {
    tipo: 'mongo',
    get ultimoError() { return ultimoError; },
    async insertar(visita) { const c = await conectar(); await c.visitas.insertOne(visita); },
    async buscar(desde, hasta) {
      const c = await conectar();
      return c.visitas.find({ ts: { $gte: desde, $lte: hasta } }, { projection: { _id: 0 } })
        .sort({ ts: -1 }).limit(50000).toArray();
    },
    // Visitas viejas sin coordenadas: se completan cuando el panel las ubica.
    async completarUbicacion(ip, lat, lon) {
      const c = await conectar();
      await c.visitas.updateMany({ ip, lat: null }, { $set: { lat, lon } });
    },
    async leerConfig() {
      const c = await conectar();
      const doc = await c.config.findOne({ _id: 'panel' });
      return { ...CONFIG_INICIAL, ...(doc || {}) };
    },
    async guardarConfig(config) {
      const c = await conectar();
      const { _id, ...resto } = config;
      await c.config.updateOne({ _id: 'panel' }, { $set: resto }, { upsert: true });
    }
  };
}

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
const store = uri ? crearStoreMongo(uri) : crearStoreArchivo();
if (!uri) console.warn('[estadisticas] Sin MONGODB_URI: las visitas se guardan en un archivo local (en Heroku se pierden al reiniciar).');

module.exports = store;
