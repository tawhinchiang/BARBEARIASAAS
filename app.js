const express = require('express');
const path = require('path');
const session = require('express-session');
const { engine } = require('express-handlebars');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const { sequelize } = require('./models');
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const {
  securityHeaders,
  attackDetection,
  securityLogger,
  blockScanners
} = require('./middleware/security');
const compression = require('compression');


// IMPORTAR CONFIGURAÇÃO SEGURA DE CORS
const { 
  createCorsConfig, 
  corsLogger, 
  additionalSecurityValidation 
} = require('./config/cors-config');

const app = express();
app.use(compression());
app.use(securityHeaders);
app.set('trust proxy', 1);
app.locals.BARBERSHOP_LOGO = process.env.BARBERSHOP_LOGO || '/images/logo-barbearia.svg';
app.locals.adminFavicon = process.env.ADMIN_FAVICON || '/images/favicon-barbearia.svg';
app.locals.barbershopName = process.env.BARBERSHOP_NAME || 'Barbearia';
app.locals.appVersion = process.env.npm_package_version || '1.0.0';
const log = (message, data = null) => {
  if (process.env.NODE_ENV === 'production') return;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [APP] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
};
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
  lastModified: true
}));
// Configurar Handlebars - CORRIGIDO
const helpers = require('./config/handlebars-helpers');

const hbs = engine({
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  extname: '.hbs',
  helpers: helpers,
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true
  }
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 50, 
  message: { error: 'Muitas requisições, tente mais tarde.' }
});


app.engine('hbs', hbs);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(corsLogger);
app.use(additionalSecurityValidation);
app.use(cors(createCorsConfig('default')));

app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use(securityLogger);       
app.use(attackDetection);  
app.use(blockScanners);

// Configurar sessões
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'sessions',
  checkExpirationInterval: 15 * 60 * 1000, // Limpa sessões expiradas a cada 15min
  expiration: 24 * 60 * 60 * 1000         // Sessão expira em 24h
});

(async () => {
  try {
    await sequelize.authenticate();
    console.log('[DB] Conexão com o banco de dados OK');
    await sessionStore.sync();
    console.log('[SESSION] Tabela de sessões sincronizada');
  } catch (error) {
    console.error('[SESSION] Erro ao sincronizar a tabela de sessões:', error);
  }
})();
app.use(session({
  secret: process.env.SESSION_SECRET || 'barbershop_secret_key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: true,                 
  cookie: {
    secure: 'auto',           
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
console.log('[SESSION] Store em uso:', sessionStore && sessionStore.constructor && sessionStore.constructor.name);

log('Sessões configuradas com segurança aprimorada');

// Rotas

// Rotas principais (CORS padrão já aplicado)
app.use('/', require('./routes/index'));

// APIs PÚBLICAS - CORS menos restritivo para leitura
app.use('/api',apiLimiter, cors(createCorsConfig('public')),require('./routes/publicApi')      
);
// Rotas de agendamentos (CORS padrão)
app.use('/', require('./routes/appointments'));

// Rotas de histórico (CORS padrão)
app.use('/history', require('./routes/history'));

// ÁREA ADMINISTRATIVA - CORS MAIS RESTRITIVO
app.use('/admin', cors(createCorsConfig('admin')), require('./routes/admin'));

// APIs ADMINISTRATIVAS - CORS MUITO RESTRITIVO
app.use('/admin/api', cors(createCorsConfig('admin')), require('./routes/adminApi'));

// Rota específica para DevTools (sem CORS)
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

// Rotas “comuns” para reduzir ruído de 404
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /admin\n');
});

app.get('/sitemap.xml', (req, res) => {
  res
    .type('application/xml')
    .send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
});

// Evita ruído de 404 p/ favicon ausente
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Responde rápido a varredura maliciosa por .env
app.all('/.env', (req, res) => res.status(404).type('txt').send('Not Found'));

// Middleware de erro 404
// 404 limpo (sem stack)
app.use((req, res) => {
  const wantsJson =
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json')) ||
    req.path.startsWith('/api/');

  console.warn(`[APP 404] ${req.method} ${req.originalUrl} from ${req.ip}`);

  if (wantsJson) {
    return res.status(404).json({ error: 'Not Found', path: req.originalUrl });
  }

  try {
    return res.status(404).render('404', {
      title: 'Página não encontrada',
      url: req.originalUrl,
      layout: req.url.startsWith('/admin') ? 'admin' : 'main'
    });
  } catch {
    return res.status(404).type('txt').send('404 Not Found');
  }
});

// Middleware de erro geral
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const wantsJson =
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json')) ||
    req.path.startsWith('/api/');

  if (status !== 404) {
    console.error('[APP ERROR]', {
      status,
      method: req.method,
      url: req.originalUrl,
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  }

  if (wantsJson) {
    return res.status(status).json({
      error: status === 404 ? 'Not Found' : 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
  }

  try {
    return res.status(status).render('error', {
      title: status === 403 ? 'Acesso negado' : 'Erro interno',
      message: process.env.NODE_ENV === 'production' ? 'Ocorreu um erro interno no servidor.' : (err.message || ''),
      status,
      layout: req.url.startsWith('/admin') ? 'admin' : 'main'
    });
  } catch {
    return res.status(status).type('txt').send(`Erro ${status}`);
  }
});



module.exports = app;

