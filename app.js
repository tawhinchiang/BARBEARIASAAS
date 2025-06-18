const express = require('express');
const path = require('path');
const session = require('express-session');
const { engine } = require('express-handlebars');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Configurar Handlebars
const hbs = engine({
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  helpers: require('./config/handlebars-helpers')
});

app.engine('handlebars', hbs);
app.engine('hbs', hbs);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Configurar sessões
app.use(session({
  secret: process.env.SESSION_SECRET || 'barbershop_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true apenas em HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Rotas
app.use('/', require('./routes/index'));
app.use('/appointments', require('./routes/appointments'));
app.use('/admin', require('./routes/admin'));

// Middleware de erro 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página não encontrada',
    error: 'A página que você procura não foi encontrada.'
  });
});

// Middleware de erro geral
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Erro interno',
    error: 'Ocorreu um erro interno no servidor.'
  });
});

module.exports = app;

