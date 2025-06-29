const express = require('express');
const path = require('path');
const session = require('express-session');
const { engine } = require('express-handlebars');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();


app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
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

log('Inicializando aplicação BarberShop');

// Configurar Handlebars - CORRIGIDO
const hbs = engine({
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  extname: '.hbs',
  helpers: require('./config/handlebars-helpers'),
  runtimeOptions: {
    allowProtoPropertiesByDefault: true, // <- Adiciona isso
    allowProtoMethodsByDefault: true     // <- E isso
  }
});


app.engine('hbs', hbs);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

log('Handlebars configurado');

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

log('Middlewares básicos configurados');

// Configurar sessões
app.use(session({
  secret: process.env.SESSION_SECRET || 'barbershop_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

log('Sessões configuradas');

// Middleware para log de todas as requisições
app.use((req, res, next) => {
  log(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    query: req.query,
    params: req.params
  });
  next();
});

// Rotas - CORRIGIDAS
log('Configurando rotas');

// Rotas principais (inclui APIs)
app.use('/', require('./routes/index'));

// Rotas de agendamentos (inclui /api/appointments)
app.use('/', require('./routes/appointments'));

// Rotas administrativas
app.use('/admin', require('./routes/admin'));

app.use('/admin/api', require('./routes/adminApi'));

log('Rotas configuradas');
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
  logError('Erro interno do servidor', err);
  res.status(500).render('error', {
    title: 'Erro interno',
    error: 'Ocorreu um erro interno no servidor.',
    layout: req.url.startsWith('/admin') ? 'admin' : 'main'
  });
});
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end(); // Sem conteúdo
});

log('Aplicação configurada com sucesso');

module.exports = app;

