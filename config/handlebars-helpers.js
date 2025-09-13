const moment = require('moment');

module.exports = {
  objectLength: function (obj) {
  return Object.keys(obj || {}).length;
  },
  json: function (context) {
    return JSON.stringify(context, null, 2);
  },

  formatDate: function(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('pt-BR');
  },
dayOfWeek: function(date) {
  if (!date) return '';
  const dias = [
    'Domingo', 'Segunda-feira', 'Terça-feira',
    'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];
  const d = new Date(date);
  return dias[d.getDay()];
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

  eq: function(a, b, options) {
    if (options && typeof options.fn === 'function') {
      return a == b ? options.fn(this) : options.inverse(this);
    } else {
      return a == b;
    }
  },

  inc: function(value) {
    return parseInt(value) + 1;
  },

  add: function(a, b) {
    return Number(a) + Number(b);
  },

  statusText: function(status) {
  const statusMap = {
    'pending': 'Pendente',
    'confirmed': 'Confirmado',
    'in_progress': 'Em atendimento',
    'completed': 'Concluído',
    'cancelled': 'Cancelado',
    'no_show': 'Não compareceu'
  };
    return statusMap[status] || status;
  },

  statusClass: function(status) {
    const classMap = {
      'scheduled': 'warning',
      'confirmed': 'primary',
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
  },

  // ✅ NOVO HELPER: canCancel
  monthNameFromDate: function(date) {
  if (!date) return '';
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const dt = new Date(date);
  return meses[dt.getMonth()];
  },
  canCancel: function(date, time, status, options) {
    const moment = require('moment');
    const now = moment();
    const appointmentDateTime = moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm');

    const isFuture = appointmentDateTime.isAfter(now.add(1, 'hour'));
    const isActive = status !== 'cancelado';

    // Se for modo bloco (com {{#canCancel}}...{{else}}...{{/canCancel}})
    if (options && typeof options.fn === 'function') {
      return isFuture && isActive ? options.fn(this) : options.inverse(this);
    }

    // Se for modo inline (com {{canCancel}})
    return isFuture && isActive;
  },
  // ✅ NOVO HELPER: groupBy
  groupBy: function (array, key) {
    if (!Array.isArray(array)) return {};

    return array.reduce((result, item) => {
      const groupKey = key.split('.').reduce((obj, k) => (obj ? obj[k] : undefined), item) || 'Outros';
      if (!result[groupKey]) result[groupKey] = [];
      result[groupKey].push(item);
      return result;
    }, {});
  },
  timeRange: function(str) {
    if (!str) return '—';
    const [start, end] = String(str).split(/[-–—]/).map(s => s.trim());
    if (!start || !end) return str; // evita quebrar se não for intervalo
    return `${start}–${end}`;
  },
 array: function(...args) {
    return args.slice(0, -1);
  },ifEquals: function(a, b, options) {
  if (a == b) {
    return options.fn(this);
  }
  return options.inverse(this);
},
gt: function(a, b, options) {
  if (options && typeof options.fn === 'function') {
    return a > b ? options.fn(this) : options.inverse(this);
  }
  return a > b;
},


};
