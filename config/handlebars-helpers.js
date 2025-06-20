const handlebars = require('handlebars');

// Helper para formatar data
handlebars.registerHelper('formatDate', function(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR');
});

// Helper para formatar hora - CORRIGIDO
handlebars.registerHelper('formatTime', function(time) {
  if (!time) return '';
  // Se já é uma string de hora (HH:MM), retorna como está
  if (typeof time === 'string' && time.includes(':')) {
    return time;
  }
  // Se é um objeto Date, extrai apenas a hora
  if (time instanceof Date) {
    return time.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  // Se é uma string de data/hora, converte e extrai hora
  try {
    const date = new Date(time);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (error) {
    return time || '';
  }
});

// Helper para formatar data e hora completa
handlebars.registerHelper('formatDateTime', function(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('pt-BR');
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

// Helper para verificar se é hoje
handlebars.registerHelper('isToday', function(date) {
  if (!date) return false;
  const today = new Date();
  const checkDate = new Date(date);
  return today.toDateString() === checkDate.toDateString();
});

// Helper para obter nome do mês
handlebars.registerHelper('monthName', function(monthNumber) {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[monthNumber] || '';
});

module.exports = handlebars;

