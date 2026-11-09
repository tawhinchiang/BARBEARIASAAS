// Configuração Segura de CORS para BarberShop SaaS
// Arquivo: config/cors-config.js

const corsConfig = {
  // Configuração para desenvolvimento
  development: {
    // Domínios permitidos para desenvolvimento
  allowedOrigins: [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost' ,
  'https://optimum-lizard-whole.ngrok-free.app'
  // ← necessário caso o referer esteja vindo assim
],
    
    // Métodos HTTP permitidos
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    
    // Headers permitidos
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-CSRF-Token'
    ],
    
    // Permitir credenciais (cookies, headers de autorização)
    credentials: true,
    
    // Cache do preflight (em segundos)
    maxAge: 86400, // 24 horas
    
    // Headers expostos para o cliente
    exposedHeaders: ['X-Total-Count', 'X-Page-Count']
  },

  production: {
  allowedOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [process.env.BASE_URL],
    
    allowedMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    
    // Headers mais restritivos
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token'
    ],
    
    credentials: true,
    maxAge: 3600, // 1 hora (menor cache em produção)
    exposedHeaders: ['X-Total-Count']
  }
};

// Configuração específica para APIs administrativas (mais restritiva)

const adminApiCorsConfig = {
  development: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token'
    ],
    credentials: true,
    maxAge: 3600
  },

production: {
  allowedOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [process.env.BASE_URL],
    allowedMethods: ['GET', 'POST', 'PUT', 'OPTIONS'], 
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token'
    ],
    credentials: true,
    maxAge: 1800 
  }
};



// Configuração para APIs públicas (menos restritiva, mas ainda segura)
const publicApiCorsConfig = {
  development: {
    allowedOrigins: corsConfig.development.allowedOrigins,
    allowedMethods: ['GET', 'OPTIONS'], // Apenas leitura
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept'
    ],
    credentials: false, // Não precisa de credenciais para APIs públicas
    maxAge: 86400
  },
  
production: {
  allowedOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [process.env.BASE_URL],
    allowedMethods: ['GET', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept'
    ],
    credentials: false,
    maxAge: 86400
  }
};

// Função para criar configuração CORS dinâmica
function resolveAllowedOrigins(config, req) {
  const list = []
    .concat(config && config.allowedOrigins ? config.allowedOrigins : [])
    .concat(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [])
    .concat(process.env.BASE_URL ? [process.env.BASE_URL] : [])
    .map(v => String(v || '').trim())
    .filter(Boolean);
  if (req && req.headers && req.headers.host) {
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    list.push(proto + '://' + req.headers.host);
  }
  return [...new Set(list)];
}

function isOriginAllowed(origin, allowedOrigins, req) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    if (req && req.headers && req.headers.host) {
      const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
      if (origin === proto + '://' + req.headers.host) return true;
    }
  } catch {}
  const explicit = [
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
    ...(process.env.BASE_URL ? [process.env.BASE_URL] : [])
  ].map(v => String(v || '').trim()).filter(Boolean);
  if (explicit.length === 0) return true;
  return false;
}

function createCorsConfig(configType = 'default') {
  const env = process.env.NODE_ENV || 'development';
  let config;
  switch (configType) {
    case 'admin':
      config = adminApiCorsConfig[env] || adminApiCorsConfig.development;
      break;
    case 'public':
      config = publicApiCorsConfig[env] || publicApiCorsConfig.development;
      break;
    default:
      config = corsConfig[env] || corsConfig.development;
  }
  return {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const explicit = resolveAllowedOrigins(config).filter(Boolean);
      if (explicit.includes(origin)) return callback(null, true);
      const explicitEnv = [
        ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
        ...(process.env.BASE_URL ? [process.env.BASE_URL] : [])
      ].map(v => String(v || '').trim()).filter(Boolean);
      if (explicitEnv.length === 0) return callback(null, true);
      return callback(new Error('Não permitido pelo CORS'), false);
    },
    methods: config.allowedMethods,
    allowedHeaders: config.allowedHeaders,
    credentials: config.credentials,
    maxAge: config.maxAge,
    exposedHeaders: config.exposedHeaders || []
  };
}

function corsLogger(req, res, next) { next(); }

function additionalSecurityValidation(req, res, next) {
  const origin = req.headers.origin;
  const env = process.env.NODE_ENV || 'development';
  let config = corsConfig[env] || corsConfig.development;
  if (req.url.startsWith('/admin')) config = adminApiCorsConfig[env] || adminApiCorsConfig.development;
  else if (req.url.startsWith('/api')) config = publicApiCorsConfig[env] || publicApiCorsConfig.development;
  const allowedOrigins = resolveAllowedOrigins(config, req);
  if (origin && !isOriginAllowed(origin, allowedOrigins, req)) {
    return res.status(403).json({
      error: 'Acesso negado por CORS',
      message: 'Sua origem não está autorizada a acessar este recurso'
    });
  }
  next();
}

module.exports = {
  createCorsConfig,
  corsLogger,
  additionalSecurityValidation,
  corsConfig,
  adminApiCorsConfig,
  publicApiCorsConfig
};
