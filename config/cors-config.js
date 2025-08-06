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

  // Configuração para produção
  production: {
    // IMPORTANTE: Substitua pelos seus domínios reais de produção
    allowedOrigins: [
      'https://seu-dominio.com',
      'https://www.seu-dominio.com',
      'https://app.seu-dominio.com',
      // Adicione APENAS os domínios que você controla
    ],
    
    // Métodos mais restritivos para produção
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
  'http://127.0.0.1:3000',
  'http://localhost',
  'https://optimum-lizard-whole.ngrok-free.app' 
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
    allowedOrigins: [
     'https://optimum-lizard-whole.ngrok-free.app', // Apenas subdomínio admin
      // NÃO adicione domínios públicos aqui
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'OPTIONS'], // Sem DELETE em produção
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token'
    ],
    credentials: true,
    maxAge: 1800 // 30 minutos
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
    allowedOrigins: [
      'https://optimum-lizard-whole.ngrok-free.app',
            // Pode incluir mais domínios para APIs públicas
    ],
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
function createCorsConfig(configType = 'default') {
  const env = process.env.NODE_ENV || 'development';

  let config;
  switch (configType) {
    case 'admin':
      config = adminApiCorsConfig[env];
      break;
    case 'public':
      config = publicApiCorsConfig[env];
      break;
    default:
      config = corsConfig[env];
  }

  return {
    origin: function (origin, callback) {
      // Permitir requisições sem origin (ex: formulário POST tradicional, Postman)
      if (!origin) return callback(null, true);

      // DEBUG: mostrar origem e lista permitida
      console.log(`[CORS CHECK] Origin recebida: ${origin}`);
      console.log(`[CORS CHECK] Permitidas: ${config.allowedOrigins.join(', ')}`);

      // Verifica se a origin está permitida
      if (config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn(`[CORS BLOQUEIO] Origin não permitida: ${origin}`);
        return callback(new Error('Não permitido pelo CORS'), false);
      }
    },
    methods: config.allowedMethods,
    allowedHeaders: config.allowedHeaders,
    credentials: config.credentials,
    maxAge: config.maxAge,
    exposedHeaders: config.exposedHeaders || []
  };
}

// Middleware de logging para CORS
function corsLogger(req, res, next) {
  const origin = req.headers.origin;
  const method = req.method;
  
  if (method === 'OPTIONS') {
    console.log(`[CORS] Preflight request from: ${origin || 'unknown'}`);
  } else if (origin) {
    console.log(`[CORS] Request from: ${origin} - ${method} ${req.url}`);
  }
  
  next();
}

// Middleware de validação adicional
function additionalSecurityValidation(req, res, next) {
  const origin = req.headers.origin;
  const userAgent = req.headers['user-agent'];
  const env = process.env.NODE_ENV || 'development';

  // Bloquear user-agents suspeitos
  const suspiciousUserAgents = [
    'curl', 'wget', 'python-requests', 'bot', 'crawler'
  ];

  if (userAgent && suspiciousUserAgents.some(ua => userAgent.toLowerCase().includes(ua))) {
    console.warn(`[SECURITY] User-Agent suspeito bloqueado: ${userAgent}`);
    return res.status(403).json({ error: 'Acesso negado' });
  }

  // 🔥 NOVO BLOCO - validar origem com base na ROTA acessada
  let allowedOrigins = corsConfig[env].allowedOrigins;
  if (req.url.startsWith('/admin')) {
    allowedOrigins = adminApiCorsConfig[env].allowedOrigins;
  } else if (req.url.startsWith('/api')) {
    allowedOrigins = publicApiCorsConfig[env].allowedOrigins;
  }

  // Validar origem corretamente
  if (origin && !allowedOrigins.includes(origin)) {
    console.warn(`[SECURITY] Tentativa de acesso de origin não autorizada: ${origin}`);
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

