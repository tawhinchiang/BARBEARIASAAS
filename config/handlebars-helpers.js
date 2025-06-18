const handlebars = require('handlebars');

// Helper para formatar data
handlebars.registerHelper('formatDate', function(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR');
});

// Helper para formatar moeda
handlebars.registerHelper('formatCurrency', function(value) {
  if (!value) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
});

// Helper para comparação
handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

// Helper para incrementar
handlebars.registerHelper('inc', function(value) {
  return parseInt(value) + 1;
});

// Helper para status em português
handlebars.registerHelper('statusText', function(status) {
  const statusMap = {
    'scheduled': 'Agendado',
    'confirmed': 'Confirmado',
    'completed': 'Concluído',
    'cancelled': 'Cancelado',
    'no_show': 'Não compareceu'
  };
  return statusMap[status] || status;
});

// Helper para classe CSS do status
handlebars.registerHelper('statusClass', function(status) {
  const classMap = {
    'scheduled': 'warning',
    'confirmed': 'info',
    'completed': 'success',
    'cancelled': 'danger',
    'no_show': 'secondary'
  };
  return classMap[status] || 'secondary';
});

module.exports = handlebars;

