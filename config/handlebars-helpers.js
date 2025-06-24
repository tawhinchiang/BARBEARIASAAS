module.exports = {
  formatDate: function(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('pt-BR');
  },

  formatTime: function(time) {
    if (!time) return '';
    if (typeof time === 'string' && time.includes(':')) return time;
    if (time instanceof Date) {
      return time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    try {
      const date = new Date(time);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return time || '';
    }
  },

  formatDateTime: function(date) {
    if (!date) return '';
    return new Date(date).toLocaleString('pt-BR');
  },

  formatCurrency: function(value) {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  },

  eq: function(a, b) {
    return a === b;
  },

  inc: function(value) {
    return parseInt(value) + 1;
  },

  add: function(a, b) {
    return Number(a) + Number(b);
  },

  statusText: function(status) {
    const statusMap = {
      'scheduled': 'Agendado',
      'confirmed': 'Confirmado',
      'completed': 'Concluído',
      'cancelled': 'Cancelado',
      'no_show': 'Não compareceu'
    };
    return statusMap[status] || status;
  },

  statusClass: function(status) {
    const classMap = {
      'scheduled': 'warning',
      'confirmed': 'info',
      'completed': 'success',
      'cancelled': 'danger',
      'no_show': 'secondary'
    };
    return classMap[status] || 'secondary';
  },

  isToday: function(date) {
    if (!date) return false;
    const today = new Date();
    const checkDate = new Date(date);
    return today.toDateString() === checkDate.toDateString();
  },

  monthName: function(monthNumber) {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[monthNumber] || '';
  },

  substring: function(str, start, end) {
    if (!str) return '';
    return str.substring(start, end);
  },

  new: function(type) {
    if (type === 'Date') {
      return new Date();
    }
    return null;
  },

  hasItems: function(array) {
    return array && array.length > 0;
  },

  first: function(array) {
    return array && array.length > 0 ? array[0] : null;
  },

  last: function(array) {
    return array && array.length > 0 ? array[array.length - 1] : null;
  },

  count: function(array) {
    return array ? array.length : 0;
  },

  debug: function(value) {
    console.log('[HANDLEBARS DEBUG]', value);
    return '';
  },

  json: function(context) {
    return JSON.stringify(context);
  }
};
