require('dotenv').config();
const path=require('path');
const express=require('express');
const compression=require('compression');
const helmet=require('helmet');
const nunjucks=require('nunjucks');
const estadisticas=require('./estadisticas/router');

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
  qcasa:process.env.QCASA_URL||'https://qcasa-e445db3b49f9.herokuapp.com/qcasa'
};

app.set('trust proxy',1);
nunjucks.configure(path.join(__dirname,'views'),{autoescape:true,express:app,noCache:process.env.NODE_ENV!=='production'});
app.set('view engine','njk');
app.use(compression());
app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.use((req,res,next)=>{
  res.locals.canonicalUrl=`${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
  res.locals.metaDescription='Estudio QR · Gestión de propiedades, inmobiliaria, sitios web y juegos online.';
  next();
});

const staticOptions={maxAge:process.env.NODE_ENV==='production'?'7d':0,etag:true};
app.use('/css',express.static(path.join(__dirname,'public/css'),staticOptions));
app.use('/js',express.static(path.join(__dirname,'public/js'),staticOptions));
app.use('/img',express.static(path.join(__dirname,'public/img'),staticOptions));

// Estadísticas: script /t.js, recolector /t/collect y panel privado (PANEL_RUTA, sin enlaces públicos).
app.use(estadisticas.router);

app.get('/',(req,res)=>res.render('home.njk',{title:'Estudio QR'}));
// Enlaces viejos del repo unificado: se mandan al proyecto que corresponde.
app.get(['/qpropiedades','/alta','/seguimiento','/ingresar'],(req,res)=>res.redirect(301,app.locals.links.qpropiedades));
app.get('/qcasa*',(req,res)=>res.redirect(301,app.locals.links.qcasa));
app.get('/robots.txt',(req,res)=>res.type('text/plain').send('User-agent: *\nAllow: /\n'));

app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).render('errors/500.njk',{title:'Error',error:process.env.NODE_ENV==='development'?err.message:null});
});
app.use((req,res)=>res.status(404).render('errors/404.njk',{title:'Página no encontrada'}));

if(require.main===module) app.listen(PORT,()=>console.log(`Estudio QR activo en http://localhost:${PORT}`));
module.exports={app};
