// Middleware Adicional de Segurança para BarberShop SaaS
// Arquivo: middleware/security.js

const rateLimit = require('express-rate-limit');

// Rate limiting para APIs
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`[RATE LIMIT] IP ${req.ip} excedeu limite para ${req.url}`);
      res.status(429).json({ 
        error: message,
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Rate limits específicos
const rateLimits = {
  // Limite geral para todas as rotas
  general: createRateLimit(
    15 * 60 * 1000, // 15 minutos
    100, // 100 requisições por IP
    'Muitas requisições. Tente novamente em 15 minutos.'
  ),
  
  // Limite para APIs administrativas (mais restritivo)
  admin: createRateLimit(
    15 * 60 * 1000, // 15 minutos
    30, // 30 requisições por IP
    'Muitas requisições para área administrativa. Tente novamente em 15 minutos.'
  ),
  
  // Limite para login (muito restritivo)
  login: createRateLimit(
    15 * 60 * 1000, // 15 minutos
    5, // 5 tentativas de login por IP
    'Muitas tentativas de login. Tente novamente em 15 minutos.'
  ),
  
  // Limite para APIs públicas
  publicApi: createRateLimit(
    1 * 60 * 1000, // 1 minuto
    20, // 20 requisições por minuto
    'Muitas requisições para API pública. Tente novamente em 1 minuto.'
  )
};

// Middleware de validação de headers de segurança
const securityHeaders = (req, res, next) => {
  // Headers de segurança
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
// Content Security Policy
const csp = [
  "default-src 'self'",

  // Scripts (incluso kits da FontAwesome e contas Google)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://kit.fontawesome.com https://accounts.google.com https://*.fontawesome.com",

  "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://kit.fontawesome.com https://accounts.google.com https://*.fontawesome.com",

  // Estilos (Google Fonts, FontAwesome, Bootstrap)
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://stackpath.bootstrapcdn.com https://use.fontawesome.com https://kit.fontawesome.com",

  "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://stackpath.bootstrapcdn.com https://use.fontawesome.com https://kit.fontawesome.com",

  // Imagens e fontes
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://use.fontawesome.com https://kit.fontawesome.com",

  // Conexões externas (por exemplo: WhatsApp API ou ngrok)
  "connect-src 'self' https://optimum-lizard-whole.ngrok-free.app https://cdn.jsdelivr.net",

  // Segurança de iframe
  "frame-ancestors 'none'"
];

// Aplica a política
res.setHeader('Content-Security-Policy', csp.join('; '));



  
  // HSTS para produção
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

// Middleware de validação de origem mais rigorosa
const strictOriginValidation = (allowedOrigins) => {
  return (req, res, next) => {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    
    // Para requisições sem origin (ex: Postman, apps móveis)
    if (!origin && !referer) {
      return next();
    }
    
    // Validar origin
    if (origin && !allowedOrigins.includes(origin)) {
      console.warn(`[SECURITY] Origin não autorizada: ${origin}`);
      return res.status(403).json({ 
        error: 'Origem não autorizada',
        code: 'FORBIDDEN_ORIGIN'
      });
    }
    
    // Validar referer se presente
    if (referer) {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        console.warn(`[SECURITY] Referer não autorizado: ${referer}`);
        return res.status(403).json({ 
          error: 'Referer não autorizado',
          code: 'FORBIDDEN_REFERER'
        });
      }
    }
    
    next();
  };
};

// Middleware de detecção de ataques
const attackDetection = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const url = req.url.toLowerCase();
  const body = JSON.stringify(req.body).toLowerCase();
  
  // Padrões suspeitos
  const suspiciousPatterns = [
    // SQL Injection
    /(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bupdate\b)/i,
    // XSS
    /<script|javascript:|onload=|onerror=/i,
    // Path Traversal
    /\.\.\//,
    // Command Injection
    /(\bwget\b|\bcurl\b|\bping\b|\bnc\b|\bnetcat\b)/i
  ];
  
  // Verificar URL e body
  const content = url + ' ' + body;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      console.error(`[SECURITY] Possível ataque detectado:`, {
        ip: req.ip,
        userAgent,
        url: req.url,
        method: req.method,
        pattern: pattern.toString()
      });
      
      return res.status(400).json({ 
        error: 'Requisição inválida',
        code: 'INVALID_REQUEST'
      });
    }
  }
  
  next();
};

// Middleware de logging de segurança
const securityLogger = (req, res, next) => {
  const securityInfo = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
    referer: req.headers.referer,
    contentType: req.headers['content-type']
  };
  
  // Log apenas para rotas sensíveis
  if (req.url.startsWith('/admin') || req.url.startsWith('/api')) {
    console.log('[SECURITY LOG]', JSON.stringify(securityInfo));
  }
  
  next();
};

// Middleware de validação de token CSRF (para formulários)
const csrfValidation = (req, res, next) => {
  // Aplicar apenas para métodos que modificam dados
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session.csrfToken;
    
    if (!token || !sessionToken || token !== sessionToken) {
      console.warn(`[CSRF] Token inválido ou ausente:`, {
        ip: req.ip,
        url: req.url,
        hasToken: !!token,
        hasSessionToken: !!sessionToken
      });
      
      return res.status(403).json({ 
        error: 'Token CSRF inválido',
        code: 'INVALID_CSRF_TOKEN'
      });
    }
  }
  
  next();
};

// Função para gerar token CSRF
const generateCSRFToken = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

module.exports = {
  rateLimits,
  securityHeaders,
  strictOriginValidation,
  attackDetection,
  securityLogger,
  csrfValidation,
  generateCSRFToken
};

