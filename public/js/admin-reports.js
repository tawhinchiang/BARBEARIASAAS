let chartStatus = null;
let chartBarber = null;

const FILTER_KEY = `adminFilters:${window.location.pathname}`;
function setDefaultDatesForReports() {
  const startEl = document.getElementById('startDate');
  const endEl   = document.getElementById('endDate');
  if (!startEl || !endEl) return;

  // Só define se estiver vazio (não pisa em filtros restaurados/salvos)
  if (!startEl.value) {
    const today = new Date();
    startEl.value = today.toISOString().split('T')[0];
  }
  if (!endEl.value) {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    endEl.value = next.toISOString().split('T')[0];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setDefaultDatesForReports();

  const limitSelect = document.getElementById('itemsPerPage');
  const filterForm  = document.getElementById('filterForm');

  if (limitSelect && filterForm) {
    limitSelect.addEventListener('change', () => {
      const url = new URL(window.location.href);

      // 1) Preserva o 'view' atual se já estiver na URL (cards|table)
      const currentView = url.searchParams.get('view');
      if (currentView) url.searchParams.set('view', currentView);

      // 2) Reaplica os filtros visíveis do formulário
      const keys = ['startDate','endDate','barberId','status','sort'];
      keys.forEach((k) => {
        const val = filterForm.elements[k]?.value ?? '';
        if (val) url.searchParams.set(k, val);
        else url.searchParams.delete(k);
      });

      // 3) Ajusta paginação
      url.searchParams.set('limit', limitSelect.value);
      url.searchParams.set('page', '1');

      window.location.href = url.toString();
    });
  }
});



const runWhenIdle = window.requestIdleCallback || function (cb) {
  setTimeout(cb, 200);
};

runWhenIdle(() => {
  if (chartStatus || chartBarber) return;

  const statusData = window.statsByStatus || {};
  const barberData = window.statsByBarber || {};

  const statusCanvas = document.getElementById('statusChart');
  if (statusCanvas) {
    const statusCtx = statusCanvas.getContext('2d');

    if (Chart.getChart(statusCanvas)) {
      Chart.getChart(statusCanvas).destroy();
    }

      const statusDataFiltered = Object.fromEntries(
  Object.entries(statusData).filter(([status]) => status !== 'pending')
);

const translatedLabels = Object.keys(statusDataFiltered).map(status => {
  if (status === 'confirmed') return 'Confirmado';
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'completed') return 'Concluído';
  if (status === 'in_progress') return 'Em Atendimento';
  if (status === 'no_show') return 'Não compareceu';
  return status;
});

const backgroundColors = Object.keys(statusDataFiltered).map(status => {
  if (status === 'confirmed') return '#007bff';   // Azul
  if (status === 'cancelled') return '#dc3545';   // Vermelho
  if (status === 'completed') return '#28a745';   // Verde
  if (status === 'in_progress') return '#17a2b8'; // Azul claro
  if (status === 'no_show') return '#6c757d';     // Cinza
  return '#6c757d';                               // Cinza padrão
});



    chartStatus = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: translatedLabels,
        datasets: [{
          data: Object.values(statusDataFiltered),
          backgroundColor: backgroundColors
        }]
      },
     options: {
  responsive: true,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#ffffff' // legenda branca
      }
    }
  },
  layout: {
    padding: 10
  }
}
    });
  }

  const barberCanvas = document.getElementById('barberChart');
  if (barberCanvas) {
    const barberCtx = barberCanvas.getContext('2d');

    if (Chart.getChart(barberCanvas)) {
      Chart.getChart(barberCanvas).destroy();
    }

    chartBarber = new Chart(barberCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(barberData),
        datasets: [{
          label: 'Agendamentos',
          data: Object.values(barberData),
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: 'rgba(102, 126, 234, 1)',
          borderWidth: 1
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: '#ffffff' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#ffffff' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#ffffff'
            }
          }
        },
        layout: {
          padding: 10
        }
      }
    });
  }
});

function clearFilters() {
  // remove o novo e o legado
  localStorage.removeItem(FILTER_KEY);
  localStorage.removeItem('adminFilters');
  // recarrega sem querystring
  window.location.href = window.location.pathname;
}
// garante acessível ao onclick inline do HBS, mesmo se mudar p/ type="module"
window.clearFilters = clearFilters;


function exportReport(format) {
  const form = document.getElementById('exportForm');
  document.getElementById('exportFormat').value = format;
  form.submit();
}

// substitua a função atual:
function submitExport(format) {
  const form = document.getElementById('exportForm');
  const filterForm = document.getElementById('filterForm');

  // Copia os valores visíveis para os hidden antes do submit
  form.elements['startDate'].value = filterForm.elements['startDate']?.value || '';
  form.elements['endDate'].value   = filterForm.elements['endDate']?.value   || '';
  form.elements['barberId'].value  = filterForm.elements['barberId']?.value  || '';
  form.elements['status'].value    = filterForm.elements['status']?.value    || '';
  form.elements['sort'].value      = filterForm.elements['sort']?.value      || '';

  document.getElementById('exportFormat').value = format;
  form.submit();
}

