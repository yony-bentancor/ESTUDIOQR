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
