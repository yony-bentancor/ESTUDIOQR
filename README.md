# ESTUDIO QR · Ecosistema

Página de entrada del estudio. Presenta los proyectos y enlaza a cada uno:

- **QPROPIEDADES** (gestor de propiedades) → repositorio `QPROPIEDADES`
- **QCASA** (inmobiliaria) → repositorio propio
- Dulce 29, Club Relámpago y La Mala Leche (enlaces externos)

Antes los tres proyectos vivían juntos en `INMOBILIARIA`. Ahora este repositorio contiene **solo la página de ecosistema**; no tiene base de datos ni sesiones.

## Ejecutar

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
npm run dev               # o npm start
```

Abrí http://localhost:3000

## Variables

| Variable | Para qué | Ejemplo |
|---|---|---|
| `PORT` | Puerto local | `3000` |
| `QPROPIEDADES_URL` | Botón «Gestor de propiedades» | `https://qpropiedades.herokuapp.com` |
| `QCASA_URL` | Botón «Inmobiliaria» | `https://qcasa.herokuapp.com/qcasa` |

En Heroku: `heroku config:set QPROPIEDADES_URL=... QCASA_URL=...`

Los enlaces viejos del repo unificado (`/qpropiedades`, `/alta`, `/seguimiento`, `/ingresar`, `/qcasa/...`) redirigen al proyecto que corresponde.

## Estructura

```
app.js
views/home.njk            página de ecosistema
views/layouts/base.njk
views/errors/             404 y 500
public/css/ecosistema.css, app.css
public/js/ecosistema.js, contacto-modal.js, app.js
```

## Estadísticas de visitas (panel privado)

Estudio QR mide las entradas de todos los sitios del ecosistema y las muestra en un panel privado que **no está enlazado desde ninguna página**.

- Cada sitio incluye `<script async src="https://estudioqr.com.uy/t.js" data-site="nombre"></script>`.
- El script envía cada página vista a `/t/collect` (sin cookies; usa un identificador anónimo del navegador).
- El panel está en `/<PANEL_RUTA>` (por defecto `/panel-privado-qr`) y pide usuario y contraseña.

Muestra: entradas por sitio y por día, desde dónde (ubicación aproximada por IP), cómo llegaron, dispositivo, cada visitante y las últimas entradas, con aviso cuando entró alguien que no sos vos.

**Distinguir tus visitas:** en el panel, «Herramientas · Marcar mis dispositivos» tiene un link por sitio; abrilo una vez desde cada navegador tuyo. También podés tocar «Soy yo» en cualquier visitante.

**Saber quién entró:** generá links con nombre (`?ref=juan`) desde el panel y pasale uno distinto a cada persona.

| Variable | Para qué |
|---|---|
| `PANEL_CLAVE` | Contraseña del panel. **Sin esto el panel no existe.** |
| `PANEL_USUARIO` | Usuario del panel (por defecto `admin`) |
| `PANEL_RUTA` | Dirección secreta del panel, sin barra (por defecto `panel-privado-qr`) |
| `PANEL_SECRETO` | Texto largo al azar para firmar la sesión y la marca de tus dispositivos |
| `MONGODB_URI` | Base de datos donde se guardan las visitas (MongoDB Atlas gratuito). Sin esto se guardan en un archivo que Heroku borra al reiniciar. |
| `ESTADISTICAS_DIAS` | Días que se conservan las visitas (por defecto 365) |

```bash
heroku config:set PANEL_CLAVE=... PANEL_SECRETO=... PANEL_RUTA=... MONGODB_URI=...
```
