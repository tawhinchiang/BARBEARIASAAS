let chartStatus = null;
let chartBarber = null;

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
      return status;
    });

    const backgroundColors = Object.keys(statusData).map(status => {
      if (status === 'confirmed') return '#28a745'; // Verde
      if (status === 'cancelled') return '#dc3545'; // Vermelho
      if (status === 'pending') return '#ffc107';
      if (status === 'completed') return '#007bff';
      return '#6c757d';
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
          legend: { position: 'bottom' }
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
          y: { beginAtZero: true }
        }
      }
    });
  }
});

function clearFilters() {
  localStorage.removeItem('adminFilters');
  window.location.href = '/admin/reports';
}

function exportReport(format) {
  const form = document.getElementById('exportForm');
  document.getElementById('exportFormat').value = format;
  form.submit();
}

function submitExport(format) {
  const form = document.getElementById('exportForm');
  document.getElementById('exportFormat').value = format;
  form.submit();
}
