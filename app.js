const express = require('express');
const path = require('path');
const session = require('express-session');
const { engine } = require('express-handlebars');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const { sequelize } = require('./models');
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const {
  securityHeaders,
  strictOriginValidation,
  attackDetection,
  securityLogger,
  csrfValidation,
  generateCSRFToken
} = require('./middleware/security');
const compression = require('compression');
console.log('[DEBUG] NODE_ENV ativo:', process.env.NODE_ENV);


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
app.locals.BARBERSHOP_LOGO = process.env.BARBERSHOP_LOGO || '/images/logo.jpg';
// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [APP] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [APP] Data:`, JSON.stringify(data, null, 2));
  }
};
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    log(`${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    });
  }
  next();
});
const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [APP ERROR] ${message}`);
  console.error(`[${timestamp}] [APP ERROR] Stack:`, error.stack);
};

log('Inicializando aplicação BarberShop com CORS seguro');
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

log('Handlebars configurado');

// ===== CONFIGURAÇÃO SEGURA DE CORS =====

// Middleware de logging para CORS (aplicado globalmente)
app.use(corsLogger);

// Middleware de validação de segurança adicional
app.use(additionalSecurityValidation);

// CORS padrão para rotas gerais (mais restritivo)
app.use(cors(createCorsConfig('default')));

log('CORS seguro configurado');

// Middlewares básicos
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));
app.use(bodyParser.json({ limit: '20mb' }));



app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


log('Middlewares básicos configurados');

app.use(securityLogger);        // se quiser registrar requisições sensíveis
app.use(attackDetection);       // para detectar SQLi, XSS, etc
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

// Middleware para log de todas as requisições
// app.use((req, res, next) => {
//   log(`${req.method} ${req.url}`, {
//     method: req.method,
//     url: req.url,
//     origin: req.headers.origin,
//     userAgent: req.headers['user-agent'],
//     ip: req.ip || req.connection.remoteAddress
//   });
//   next();
// });

// ===== ROTAS COM CORS ESPECÍFICO =====

log('Configurando rotas com CORS específico');

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

log('Rotas configuradas com CORS específico');

// ===== MIDDLEWARE DE SEGURANÇA ADICIONAL =====

// Middleware para detectar tentativas de bypass de CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  // Log de tentativas suspeitas
  if (origin && referer && !origin.includes(new URL(referer).hostname)) {
    log('Possível tentativa de bypass de CORS detectada', {
      origin,
      referer,
      url: req.url,
      method: req.method
    });
  }
  
  next();
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



log('Aplicação configurada com sucesso - CORS seguro ativo');

// Log da configuração de CORS ativa
const env = process.env.NODE_ENV || 'development';
log(`Ambiente: ${env}`);
log('Configuração de CORS carregada para:', {
  ambiente: env,
  corsPublico: 'Configurado para APIs públicas',
  corsAdmin: 'Configurado para área administrativa',
  corsDefault: 'Configurado para rotas gerais'
});




module.exports = app;

