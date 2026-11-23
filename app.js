require('dotenv').config();
const path=require('path');
const express=require('express');
const compression=require('compression');
const helmet=require('helmet');
const nunjucks=require('nunjucks');
const estadisticas=require('./estadisticas/router');
const {SITIO,crearRouterSeo,datosEstructurados}=require('./seo');

/*
  ESTUDIO QR · Ecosistema
  Página de entrada del estudio. Enlaza a cada proyecto, que ahora vive
  en su propio repositorio y su propio despliegue:
  - QPROPIEDADES (gestión)  → QPROPIEDADES_URL
  - QCASA (inmobiliaria)     → QCASA_URL
*/
const app=express();
const PORT=process.env.PORT||3000;
app.locals.links={
  qpropiedades:process.env.QPROPIEDADES_URL||'https://qpropiedades-810f06568918.herokuapp.com/',
  qcasa:process.env.QCASA_URL||'https://qcasa-e445db3b49f9.herokuapp.com/qcasa',
  alternativa:process.env.ALTERNATIVA_URL||'https://alternativas-1c4c4edd0605.herokuapp.com/',
  // Laboratorio Arcade: sin URL el juego aparece como «Muy pronto».
  lamalaleche:process.env.LAMALALECHE_URL||'https://still-hat-f113.yonybentancor.workers.dev/',
  lamalaleche2:process.env.LAMALALECHE2_URL||'https://lamalaleche2.yonybentancor.workers.dev/',
  furia:process.env.FURIA_URL||'https://furia-callejera.yonybentancor.workers.dev/'
};
// Juegos del Laboratorio Arcade (/arcade)
const juegos=()=>[
  {nombre:'La Mala Leche',genero:'Plataformas 2D',color:'#5aa9ff',url:app.locals.links.lamalaleche,imagen:'/img/arcade/la-mala-leche.jpg',
    texto:'Una botella de leche que se niega a quedarse en el molde. De la fábrica al fondo del mar, en cinco niveles.'},
  {nombre:'La Mala Leche 2',genero:'Plataformas · Vuelta al mundo',color:'#e5c35a',url:app.locals.links.lamalaleche2,imagen:'/img/arcade/la-mala-leche-2.jpg',
    texto:'La botella sale a recorrer el mundo: Estados Unidos, España, Francia, Italia y más, con humor sobre los problemas de cada país.'},
  {nombre:'Furia Callejera',genero:'Peleas 2D',color:'#e5533d',url:app.locals.links.furia,imagen:'/img/arcade/furia-callejera.jpg',
    texto:'Juego de peleas con luchadores exagerados, poderes propios, combos y finales espectaculares. Ganá y pasá al siguiente rival.'}
].map(j=>({...j,imagen:require('fs').existsSync(path.join(__dirname,'public',j.imagen))?j.imagen:null}));

app.set('trust proxy',1);
nunjucks.configure(path.join(__dirname,'views'),{autoescape:true,express:app,noCache:process.env.NODE_ENV!=='production'});
app.set('view engine','njk');
// Dominio principal: la dirección vieja de Heroku y www pasan a estudioqr.com.uy.
// El contador (/t.js y /t/collect) no se redirige, para no perder visitas de páginas viejas.
const DOMINIO=String(process.env.DOMINIO_PRINCIPAL||'estudioqr.com.uy').trim().toLowerCase();
app.use((req,res,next)=>{
  const host=String(req.hostname||'').toLowerCase();
  const otroHost=host.endsWith('.herokuapp.com')||host===`www.${DOMINIO}`;
  if(DOMINIO&&otroHost&&(req.method==='GET'||req.method==='HEAD')&&!req.path.startsWith('/t.js')&&!req.path.startsWith('/t/')){
    return res.redirect(301,`https://${DOMINIO}${req.originalUrl}`);
  }
  next();
});
app.use(compression());
app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
// Metadatos para buscadores: la URL canónica siempre apunta al dominio principal.
const jsonLd=JSON.stringify(datosEstructurados(app.locals.links)).replace(/</g,'\\u003c');
app.use((req,res,next)=>{
  res.locals.canonicalUrl=`${SITIO.url}${req.path==='/'?'/':req.path}`;
  res.locals.metaDescription=SITIO.descripcion;
  res.locals.metaImage=`${SITIO.url}/img/og-estudioqr.png`;
  res.locals.jsonLd=jsonLd;
  next();
});

const staticOptions={maxAge:process.env.NODE_ENV==='production'?'7d':0,etag:true};
app.use('/css',express.static(path.join(__dirname,'public/css'),staticOptions));
app.use('/js',express.static(path.join(__dirname,'public/js'),staticOptions));
app.use('/img',express.static(path.join(__dirname,'public/img'),staticOptions));

// Estadísticas: script /t.js, recolector /t/collect y panel privado (PANEL_RUTA, sin enlaces públicos).
// El panel y el contador nunca deben aparecer en buscadores.
app.use((req,res,next)=>{
  if(req.path.startsWith(estadisticas.PANEL_RUTA||'/__sin_panel__')||req.path.startsWith('/t/')) res.set('X-Robots-Tag','noindex, nofollow');
  next();
});
app.use(estadisticas.router);
app.use(require('./estadisticas/contacto'));

app.use(crearRouterSeo(app.locals.links));

app.get('/',(req,res)=>res.render('home.njk',{title:'Estudio QR',pageTitle:'Estudio QR · Desarrollo web y software a medida en Montevideo, Uruguay'}));
app.get('/arcade',(req,res)=>{
  res.locals.metaDescription='Laboratorio Arcade de Estudio QR: juegos 2D hechos en Uruguay que se juegan en el navegador. La Mala Leche, La Mala Leche 2 y Furia Callejera.';
  res.render('arcade.njk',{title:'Laboratorio Arcade',pageTitle:'Laboratorio Arcade · Juegos online de Estudio QR',juegos:juegos()});
});
// Enlaces viejos del repo unificado: se mandan al proyecto que corresponde.
app.get(['/qpropiedades','/alta','/seguimiento','/ingresar'],(req,res)=>res.redirect(301,app.locals.links.qpropiedades));
app.get('/qcasa*',(req,res)=>res.redirect(301,app.locals.links.qcasa));

app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).render('errors/500.njk',{title:'Error',noindex:true,error:process.env.NODE_ENV==='development'?err.message:null});
});
app.use((req,res)=>res.status(404).set('X-Robots-Tag','noindex').render('errors/404.njk',{title:'Página no encontrada',noindex:true}));

if(require.main===module) app.listen(PORT,()=>console.log(`Estudio QR activo en http://localhost:${PORT}`));
module.exports={app};
