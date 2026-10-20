/*
  SEO y visibilidad en buscadores y asistentes de IA.
  - /robots.txt   permite buscadores y rastreadores de IA (ChatGPT, Claude, Perplexity, Gemini…)
  - /sitemap.xml  mapa del sitio para Google Search Console y Bing Webmaster Tools
  - /llms.txt     resumen en texto plano pensado para modelos de lenguaje
  La ruta del panel privado NO se nombra acá (sería revelarla); el panel se
  protege con la cabecera X-Robots-Tag: noindex en estadisticas/router.js y app.js.
*/
const express = require('express');

const SITIO = {
  nombre: 'Estudio QR',
  url: 'https://estudioqr.com.uy',
  descripcion: 'Estudio de desarrollo digital en Montevideo, Uruguay. Creamos sitios web, sistemas de gestión, plataformas inmobiliarias, tiendas online, juegos y herramientas a medida para negocios.',
  ciudad: 'Montevideo',
  pais: 'UY',
  telefono: '+59895789647',
  instagram: 'https://www.instagram.com/estudio.qr/',
  whatsapp: 'https://wa.me/59895789647'
};

// Rastreadores de IA que se permiten de forma explícita.
const BOTS_IA = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',            // OpenAI / ChatGPT
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User',       // Anthropic / Claude
  'PerplexityBot', 'Perplexity-User',                   // Perplexity
  'Google-Extended', 'Applebot', 'Applebot-Extended',   // Gemini / Apple Intelligence
  'Bingbot', 'meta-externalagent', 'CCBot', 'DuckAssistBot'
];

function crearRouterSeo(links) {
  const router = express.Router();
  const base = SITIO.url;

  router.get('/robots.txt', (req, res) => {
    const lineas = [];
    for (const bot of BOTS_IA) lineas.push(`User-agent: ${bot}`, 'Allow: /', '');
    lineas.push('User-agent: *', 'Allow: /', 'Disallow: /t/', '');
    lineas.push(`Sitemap: ${base}/sitemap.xml`, '');
    res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(lineas.join('\n'));
  });

  router.get('/sitemap.xml', (req, res) => {
    const hoy = new Date().toISOString().slice(0, 10);
    const urls = [
      { loc: `${base}/`, prioridad: '1.0' },
      { loc: `${base}/llms.txt`, prioridad: '0.3' }
    ];
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${hoy}</lastmod><changefreq>monthly</changefreq><priority>${u.prioridad}</priority></url>`).join('\n')
      + '\n</urlset>\n';
    res.type('application/xml').set('Cache-Control', 'public, max-age=86400').send(xml);
  });

  router.get('/llms.txt', (req, res) => {
    const texto = `# ${SITIO.nombre}

> ${SITIO.descripcion}

Estudio QR es un estudio de desarrollo digital con base en ${SITIO.ciudad}, Uruguay. Trabaja con negocios, inmobiliarias y emprendedores que necesitan una solución digital a medida: desde un sitio web hasta un sistema de gestión completo.

## Servicios

- Desarrollo de sitios web a medida para negocios y marcas
- Tiendas online con panel de administración
- Sistemas de gestión de propiedades y alquileres
- Portales inmobiliarios
- Juegos online y experiencias interactivas
- Herramientas web (por ejemplo, edición de video en el navegador)
- Códigos QR aplicados a negocios y propiedades

## Proyectos

- [QPROPIEDADES – Gestor de propiedades](${links.qpropiedades}): sistema para administrar propiedades, inquilinos y seguimiento de incidencias.
- [QCASA – Inmobiliaria](${links.qcasa}): portal inmobiliario para publicar propiedades.
- [Dulce 29](https://dulce29-eccb0f7d7a32.herokuapp.com/): sitio web con tienda y panel de administración.
- [Club Relámpago](https://relampago-cbb2642c1c45.herokuapp.com/): sitio web institucional de un club.
- [La Mala Leche](https://still-hat-f113.yonybentancor.workers.dev/): juego online de plataformas 2D.
- [Editor de video](${links.editor}): editor de video online.
- [Alternativa](${links.alternativa}): sitio web.

## Contacto

- Sitio: ${base}/
- WhatsApp: ${SITIO.whatsapp}
- Instagram: ${SITIO.instagram}
- Ubicación: ${SITIO.ciudad}, Uruguay
`;
    res.type('text/plain; charset=utf-8').set('Cache-Control', 'public, max-age=86400').send(texto);
  });

  return router;
}

// Datos estructurados (schema.org) para Google y asistentes de IA.
function datosEstructurados(links) {
  const proyectos = [
    ['Gestor de propiedades QPROPIEDADES', links.qpropiedades],
    ['Inmobiliaria QCASA', links.qcasa],
    ['Sitio web Dulce 29', 'https://dulce29-eccb0f7d7a32.herokuapp.com/'],
    ['Sitio web Club Relámpago', 'https://relampago-cbb2642c1c45.herokuapp.com/'],
    ['Juego online La Mala Leche', 'https://still-hat-f113.yonybentancor.workers.dev/'],
    ['Editor de video', links.editor],
    ['Sitio web Alternativa', links.alternativa]
  ];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfessionalService',
        '@id': `${SITIO.url}/#estudio`,
        name: SITIO.nombre,
        url: `${SITIO.url}/`,
        description: SITIO.descripcion,
        image: `${SITIO.url}/img/og-estudioqr.png`,
        logo: `${SITIO.url}/img/og-estudioqr.png`,
        telephone: SITIO.telefono,
        address: { '@type': 'PostalAddress', addressLocality: SITIO.ciudad, addressCountry: SITIO.pais },
        areaServed: [{ '@type': 'Country', name: 'Uruguay' }],
        sameAs: [SITIO.instagram],
        knowsAbout: ['Desarrollo web', 'Diseño web', 'Tiendas online', 'Software de gestión inmobiliaria', 'Códigos QR', 'Desarrollo de juegos web'],
        makesOffer: [
          'Desarrollo de sitios web a medida',
          'Tiendas online con panel de administración',
          'Sistemas de gestión de propiedades',
          'Portales inmobiliarios',
          'Juegos online'
        ].map(n => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: n } })),
        contactPoint: { '@type': 'ContactPoint', telephone: SITIO.telefono, contactType: 'customer service', availableLanguage: ['es'] }
      },
      {
        '@type': 'WebSite',
        '@id': `${SITIO.url}/#web`,
        url: `${SITIO.url}/`,
        name: SITIO.nombre,
        inLanguage: 'es-UY',
        publisher: { '@id': `${SITIO.url}/#estudio` }
      },
      {
        '@type': 'ItemList',
        name: 'Proyectos de Estudio QR',
        itemListElement: proyectos.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, url }))
      }
    ]
  };
}

module.exports = { SITIO, crearRouterSeo, datosEstructurados };
