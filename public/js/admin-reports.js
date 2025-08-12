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
  // Se o admin.js já restaurou do localStorage, os inputs terão valor;
  // então só setamos quando estiver vazio:
  setDefaultDatesForReports();
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

    const translatedLabels = Object.keys(statusData).map(status => {
      if (status === 'confirmed') return 'Confirmado';
      if (status === 'cancelled') return 'Cancelado';
      if (status === 'pending') return 'Pendente';
      if (status === 'completed') return 'Concluído';
      if (status === 'in_progress') return 'Em Atendimento';
      return status;
    });


    const backgroundColors = Object.keys(statusData).map(status => {
      if (status === 'confirmed') return '#007bff';  // Azul
      if (status === 'cancelled') return '#dc3545'; // Vermelho
      if (status === 'pending') return '#ffc107';   // Amarelo
      if (status === 'completed') return '#28a745';// verde
      if (status === 'in_progress') return '#17a2b8'; // Azul claro (info)
      return '#6c757d'; // Cinza padrão
    });



    chartStatus = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: translatedLabels,
        datasets: [{
          data: Object.values(statusData),
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

