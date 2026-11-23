/* Sitios que se miden. La clave es el valor de data-site en el script de cada sitio. */
const SITIOS = {
  estudioqr: { nombre: 'Estudio QR', url: process.env.ESTUDIOQR_URL || 'https://estudioqr.com.uy/' },
  qpropiedades: { nombre: 'QPROPIEDADES', url: process.env.QPROPIEDADES_URL || 'https://qpropiedades-810f06568918.herokuapp.com/' },
  qcasa: { nombre: 'QCASA', url: process.env.QCASA_URL || 'https://qcasa-e445db3b49f9.herokuapp.com/qcasa' },
  dulce29: { nombre: 'Dulce 29', url: process.env.DULCE29_URL || 'https://dulce29.com.uy/' },
  relampago: { nombre: 'Club Relámpago', url: process.env.RELAMPAGO_URL || 'https://relampago-cbb2642c1c45.herokuapp.com/' },
  lamalaleche: { nombre: 'La Mala Leche', url: process.env.LAMALALECHE_URL || 'https://still-hat-f113.yonybentancor.workers.dev/' },
  lamalaleche2: { nombre: 'La Mala Leche 2', url: process.env.LAMALALECHE2_URL || 'https://lamalaleche2.yonybentancor.workers.dev/' },
  furia: { nombre: 'Furia Callejera', url: process.env.FURIA_URL || 'https://furia-callejera.yonybentancor.workers.dev/' },
  alternativa: { nombre: 'Alternativa', url: process.env.ALTERNATIVA_URL || 'https://alternativas-1c4c4edd0605.herokuapp.com/' }
};

module.exports = SITIOS;
