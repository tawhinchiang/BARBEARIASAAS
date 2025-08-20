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

const {
  securityHeaders,
  strictOriginValidation,
  attackDetection,
  securityLogger,
  csrfValidation,
  generateCSRFToken
} = require('./middleware/security');

console.log('[DEBUG] NODE_ENV ativo:', process.env.NODE_ENV);
// IMPORTAR CONFIGURAÇÃO SEGURA DE CORS
const { 
  createCorsConfig, 
  corsLogger, 
  additionalSecurityValidation 
} = require('./config/cors-config');

const app = express();
app.set('trust proxy', 1);
// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [APP] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [APP] Data:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [APP ERROR] ${message}`);
  console.error(`[${timestamp}] [APP ERROR] Stack:`, error.stack);
};

log('Inicializando aplicação BarberShop com CORS seguro');

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
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


log('Middlewares básicos configurados');
app.use(securityHeaders);
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
  cookie: {
    secure: false, // Em produção, só HTTPS
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));
console.log('[SESSION] Store em uso:', sessionStore && sessionStore.constructor && sessionStore.constructor.name);

log('Sessões configuradas com segurança aprimorada');

// Middleware para log de todas as requisições
app.use((req, res, next) => {
  log(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  });
  next();
});

// ===== ROTAS COM CORS ESPECÍFICO =====

log('Configurando rotas com CORS específico');

// Rotas principais (CORS padrão já aplicado)
app.use('/', require('./routes/index'));

// APIs PÚBLICAS - CORS menos restritivo para leitura
app.use('/api', cors(createCorsConfig('public')), require('./routes/publicApi'));

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

// Middleware de erro 404
app.use((req, res) => {
  logError(`Rota não encontrada: ${req.method} ${req.url}`, new Error('404 Not Found'));
  res.status(404).render('error', {
    title: 'Página não encontrada',
    error: 'A página que você procura não foi encontrada.',
    layout: req.url.startsWith('/admin') ? 'admin' : 'main'
  });
});

// Middleware de erro geral
app.use((err, req, res, next) => {
  // Log específico para erros de CORS
  if (err.message && err.message.includes('CORS')) {
    logError('Erro de CORS detectado', err);
    return res.status(403).json({ 
      error: 'Acesso negado por política de CORS',
      message: 'Sua origem não está autorizada a acessar este recurso'
    });
  }
  
  logError('Erro interno do servidor', err);
  res.status(500).render('error', {
    title: 'Erro interno',
    error: 'Ocorreu um erro interno no servidor.',
    layout: req.url.startsWith('/admin') ? 'admin' : 'main'
  });
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

