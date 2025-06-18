// Middleware de autenticação para área administrativa
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.redirect('/admin/login?error=Acesso negado. Faça login primeiro.');
  }
};

// Middleware para verificar role de usuário
const hasRole = (roles) => {
  return (req, res, next) => {
    if (req.session && req.session.user && roles.includes(req.session.user.role)) {
      return next();
    } else {
      return res.status(403).render('error', {
        title: 'Acesso Negado',
        error: 'Você não tem permissão para acessar esta página.'
      });
    }
  };
};

// Middleware para verificar se usuário já está logado
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  next();
};

module.exports = {
  isAuthenticated,
  hasRole,
  redirectIfAuthenticated
};

