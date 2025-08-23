// Middleware de autenticação para área administrativa - CORRIGIDO

// const log = (message, data = null) => {
//   const timestamp = new Date().toISOString();
//   console.log(`[${timestamp}] [AUTH] ${message}`);
//   if (data) {
//     console.log(`[${timestamp}] [AUTH] Data:`, JSON.stringify(data, null, 2));
//   }
// };

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [AUTH ERROR] ${message}`);
  if (error && error.stack) {
    console.error(`[${timestamp}] [AUTH ERROR] Stack:`, error.stack);
  }
};

// Middleware para rotas web (redireciona para login se não autenticado)
const isAuthenticated = (req, res, next) => {
  // log('Verificando autenticação', { 
  //   url: req.url,
  //   method: req.method,
  //   hasSession: !!req.session,
  //   hasUser: !!(req.session && req.session.user),
  //   sessionId: req.sessionID
  // });

  if (req.session && req.session.user) {
    // log('Usuário autenticado', { 
    //   user: req.session.user,
    //   sessionId: req.sessionID
    // });
    return next();
  } else {
    log('Usuário não autenticado, redirecionando para login', {
      url: req.url,
      sessionId: req.sessionID
    });
    return res.redirect('/admin/login?error=Acesso negado. Faça login primeiro.');
  }
};

// Middleware para APIs (retorna JSON 401 se não autenticado)
const isAuthenticatedApi = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'Usuário não autenticado' });
};

// Middleware para verificar role de usuário
const hasRole = (roles) => {
  return (req, res, next) => {
    log('Verificando role do usuário', { 
      requiredRoles: roles,
      userRole: req.session?.user?.role,
      user: req.session?.user
    });
    
    if (req.session && req.session.user && roles.includes(req.session.user.role)) {
      log('Role autorizada', { 
        userRole: req.session.user.role,
        requiredRoles: roles
      });
      return next();
    } else {
      log('Role não autorizada', { 
        userRole: req.session?.user?.role,
        requiredRoles: roles
      });
      return res.status(403).render('error', {
        title: 'Acesso Negado',
        layout: 'admin',
        error: 'Você não tem permissão para acessar esta página.'
      });
    }
  };
};

// Middleware para redirecionar se usuário já estiver logado
const redirectIfAuthenticated = (req, res, next) => {
  log('Verificando se usuário já está logado', {
    hasSession: !!req.session,
    hasUser: !!(req.session && req.session.user),
    user: req.session?.user
  });
  
  if (req.session && req.session.user) {
    log('Usuário já logado, redirecionando para dashboard', {
      user: req.session.user
    });
    return res.redirect('/admin/dashboard');
  }
  
  log('Usuário não logado, prosseguindo');
  next();
};

// Middleware para debug de sessão
const debugSession = (req, res, next) => {
  log('Debug da sessão', {
    sessionId: req.sessionID,
    session: req.session,
    cookies: req.headers.cookie,
    url: req.url,
    method: req.method
  });
  next();
};

module.exports = {
  isAuthenticated,
  isAuthenticatedApi,
  hasRole,
  redirectIfAuthenticated,
  debugSession
};
