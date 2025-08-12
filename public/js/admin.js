// JavaScript para área administrativa - Frontend
document.addEventListener('DOMContentLoaded', function () {
  // Filtros de agendamentos
   const toggler = document.getElementById('sidebarToggle');
  const filterForm = document.getElementById('filterForm');
  // Aplica estado salvo
  const saved = localStorage.getItem('adminSidebarCollapsed');
  if (saved === '1') document.body.classList.add('sidebar-collapsed');

  // === NUNCA PERSISTIR FILTROS (para qualquer formulário) ===
  if (filterForm) {
    // 1) limpa qualquer persistência legada
    try {
      localStorage.removeItem('adminFilters');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('adminFilters:')) localStorage.removeItem(k);
      }
    } catch (_) {}

    // 2) se veio com query (?startDate=...), limpa a URL sem recarregar
    if (window.location.search) {
      history.replaceState(null, '', window.location.pathname + window.location.hash);
    }

    // 3) submit: apenas navega (GET) com fade, sem salvar nada
    filterForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const formData = new FormData(filterForm);
      const params = new URLSearchParams();
      for (const [key, value] of formData.entries()) {
        if (value) params.append(key, value);
      }

      navigateWithFade(`${window.location.pathname}?${params.toString()}`);
    });

    // 4) "Limpar": zera campos e volta ao estado base (sem query)
    function clearFilters() {
      Array.from(filterForm.elements).forEach(el => {
        if (!el?.name) return;
        const type = (el.type || '').toLowerCase();

        if (type === 'checkbox' || type === 'radio') {
          el.checked = false;
        } else if (el.tagName === 'SELECT') {
          el.selectedIndex = 0;
          // dispara change se usar select2 ou similares
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          el.value = '';
        }
      });

      // volta para a rota base sem parâmetros
      navigateWithFade(window.location.pathname);
    }
    // expõe global para onclick do HBS
    window.clearFilters = clearFilters;
  }

  toggler?.addEventListener('click', (e) => {
    if (window.innerWidth >= 992) {
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem('adminSidebarCollapsed',
        document.body.classList.contains('sidebar-collapsed') ? '1' : '0');
    }
  });
  
   // Marca ativo nos dois menus (fixo e offcanvas)
  const current = window.location.pathname;
  const markActive = (selector) => {
    document.querySelectorAll(selector).forEach(a => {
      const href = a.getAttribute('href');
      if (href && (current === href || current.startsWith(href + '/'))) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });
  };
  markActive('.sidenav-item');
  markActive('.admin-menu .list-group-item'); // sua offcanvas

  // Atualizar status do agendamento
  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async function () {
      const appointmentId = this.dataset.appointmentId;
      const newStatus = this.value;

      try {
        const response = await fetch(`/admin/appointments/${appointmentId}/status`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(ADMIN_CSRF ? { 'X-CSRF-Token': ADMIN_CSRF } : {})
          },
          body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
          showAlert('Status atualizado com sucesso!', 'success');
        } else {
          showAlert('Erro ao atualizar status', 'error');
        }
      } catch (error) {
        console.error('Erro:', error);
        showAlert('Erro ao atualizar status', 'error');
      }
    });
  });

  // Exportar relatórios
  const exportButtons = document.querySelectorAll('.export-btn');
  exportButtons.forEach(button => {
    button.addEventListener('click', async function () {
      const format = this.dataset.format;
      const startDate = document.getElementById('startDate')?.value;
      const endDate = document.getElementById('endDate')?.value;
      const barberId = document.getElementById('barberId')?.value;

      // Validar datas
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        showAlert('Data inicial deve ser anterior à data final', 'error');
        return;
      }

      // Mostrar loading
      this.disabled = true;
      this.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> Gerando...';


      try {
        const response = await fetch('/admin/reports/export', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(ADMIN_CSRF ? { 'X-CSRF-Token': ADMIN_CSRF } : {})

          },
          body: JSON.stringify({
            format,
            startDate,
            endDate,
            barberId
          })
        });

        if (response.ok) {
          // Criar link para download
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `relatorio-agendamentos.${format}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          showAlert(`Relatório ${format.toUpperCase()} gerado com sucesso!`, 'success');
        } else {
          const error = await response.json();
          showAlert(error.error || 'Erro ao gerar relatório', 'error');
        }
      } catch (error) {
        console.error('Erro:', error);
        showAlert('Erro ao gerar relatório', 'error');
      } finally {
        // Restaurar botão
        this.disabled = false;
        if (format === 'pdf') {
          this.innerHTML = '<i class="fa-regular fa-file-pdf"></i> Exportar PDF';
        } else {
          this.innerHTML = '<i class="fa-regular fa-file-excel"></i> Exportar CSV';

        }
      }
    });
  });

  // Gráficos (se Chart.js estiver disponível)
  if (typeof Chart !== 'undefined') {
    initializeCharts();
  }

  // Auto-refresh do dashboard a cada 5 minutos
  if (window.location.pathname.includes('/admin/dashboard')) {
    setInterval(() => {
      document.body.classList.add('fade-out-soft');
      setTimeout(() => reloadWithFade(), 1500);
    }, 300000); // 5 minutos
  }
  setTimeout(updateCounters, 500);

  // Transição suave ao mudar de página
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');

    // pula links da Offcanvas e externos/anchors/novas abas
    if (
      !href ||
      link.closest('#adminSidebar') ||      // ← não mexe nos links da sidebar
      href.startsWith('http') ||
      href.includes('#') ||
      link.hasAttribute('target')
    ) {
      return;
    }

    // Só para internos
    if (href.startsWith('/')) {
      link.addEventListener('click', function (e) {
        if (window.location.pathname === href) return; // evita recarregar a mesma página
        e.preventDefault();
        navigateWithFade(href);
      });
    }
  });

  // Ao carregar, aplica fade-in
  document.body.classList.add('fade-in-soft');
  document.body.style.opacity = '1';

  // Remove após a animação
  document.body.addEventListener('transitionend', () => {
    document.body.classList.remove('fade-in-soft', 'fade-out-soft');
  });

  if (window.location.pathname.includes('/admin/config')) {
    // Atualiza a cada 10s só se o estado mudar
    setInterval(loadQRCodeIfDisconnected, 10000);
  }

  if (typeof window.checkWhatsAppStatus === 'function') {
    window.checkWhatsAppStatus(); // usa a versão do admin.hbs (toast)
  } else {
    checkWhatsAppStatusFallback(); // fallback
  }

});
const ADMIN_CSRF = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
// API: notify({ type: 'success'|'error'|'warning'|'info', message, title, delay })
function notify({ type = 'info', message = '', title = '', delay = 5000 } = {}) {
  const stack = document.getElementById('toastStack');
  if (!stack) return console.warn('toastStack não encontrado');

  // mapeia cores bootstrap
  const typeToBg = {
    success: 'text-bg-success',
    error: 'text-bg-danger',
    warning: 'text-bg-warning',
    info: 'text-bg-info'
  };
  const bgClass = typeToBg[type] || typeToBg.info;

  // ícones Font Awesome
  const typeToIcon = {
    success: 'fa-circle-check',
    error: 'fa-triangle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };
  const iconClass = typeToIcon[type] || typeToIcon.info;

  // limita stack (ex.: 5 toasts)
  while (stack.children.length >= 5) {
    stack.removeChild(stack.firstElementChild);
  }

  // cria toast
  const toastEl = document.createElement('div');
  toastEl.className = `toast admin-toast ${type}`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="toast-header ${bgClass} text-white border-0">
      <i class="fa-solid ${iconClass} me-2"></i>
      <strong class="me-auto">${title || type.toUpperCase()}</strong>
      <small class="text-white-50">agora</small>
      <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="toast" aria-label="Fechar"></button>
    </div>
    <div class="toast-body">
      ${message}
    </div>
  `;

  stack.appendChild(toastEl);

  const toast = new bootstrap.Toast(toastEl, { delay, autohide: true });
  toast.show();

  toastEl.addEventListener('hidden.bs.toast', () => {
    toast.dispose();
    toastEl.remove();
  });
}

// Manter compatibilidade com chamadas existentes:
function showAlert(message, type = 'info') {
  notify({ type: type === 'danger' ? 'error' : type, message });
}
// API: confirmDialog({ title, message, confirmText, cancelText, variant }) -> Promise<boolean>
function confirmDialog({
  title = 'Confirmar ação',
  message = 'Tem certeza?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'primary'
} = {}) {
  return new Promise(resolve => {
    const modalEl = document.getElementById('confirmDialogModal');
    if (!modalEl) return resolve(false);

    modalEl.querySelector('#confirmDialogLabel').textContent = title;
    modalEl.querySelector('#confirmDialogMessage').innerHTML = message;

    const btnOk = modalEl.querySelector('#confirmDialogOk');
    const btnCancel = modalEl.querySelector('#confirmDialogCancel');

    // reset e aplica variante
    btnOk.className = 'btn';
    btnOk.classList.add(`btn-${variant}`);
    btnOk.textContent = confirmText;
    btnCancel.textContent = cancelText;

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: 'static' });

    const cleanup = (result) => {
      btnOk.removeEventListener('click', onOk);
      modalEl.removeEventListener('hidden.bs.modal', onHide);
      resolve(result);
    };

    const onOk = () => {
      modal.hide();
      cleanup(true);
    };

    const onHide = () => cleanup(false);

    btnOk.addEventListener('click', onOk, { once: true });
    modalEl.addEventListener('hidden.bs.modal', onHide, { once: true });

    modal.show();
  });
}

// Compatibilidade com seu helper antigo baseado em callback
function confirmAction(message, callback) {
  confirmDialog({ message, title: 'Confirmação', confirmText: 'Sim, continuar', variant: 'danger' })
    .then(ok => ok && callback && callback());
}

// Substituir a função existente por esta versão compatível:
async function checkWhatsAppStatusFallback() {
  try {
    const res = await fetch('/admin/whatsapp/status', { credentials: 'include' });
    const data = await res.json();

    // Novo toast na sidebar
    const toast = document.getElementById('whatsapp-status-toast');
    const text = document.getElementById('whatsapp-status-text');

    // Badge antigo (se existir em alguma página legada)
    const badge = document.getElementById('whatsappStatus');

    if (toast && text) {
      toast.classList.remove('success', 'error', 'd-none', 'show');
      if (data.isConnected) {
        toast.classList.add('success', 'show');
        text.innerText = 'WhatsApp está conectado ✅';
        setTimeout(() => toast.classList.remove('show'), 5000);
      } else {
        toast.classList.add('error', 'show');
        text.innerHTML = 'WhatsApp desconectado! <a href="/admin/config" class="text-danger fw-bold text-decoration-underline">Reconectar</a>';
      }
    } else if (badge) {
      // fallback para badge antigo
      if (data.isConnected) {
        badge.classList.remove('bg-secondary', 'bg-danger');
        badge.classList.add('bg-success');
        badge.textContent = 'WhatsApp: Conectado';
      } else {
        badge.classList.remove('bg-secondary', 'bg-success');
        badge.classList.add('bg-danger');
        badge.textContent = 'WhatsApp: Desconectado';
      }
    }
  } catch (err) {
    console.error('Erro ao verificar status do WhatsApp', err);
  }
}

if (window.location.pathname.includes('/admin/config')) {
  checkWhatsAppStatusConfig();
  loadQRCodeIfDisconnected();
}

async function checkWhatsAppStatusConfig() {
  const statusRes = await fetch('/admin/whatsapp/status');
  const { isConnected } = await statusRes.json();
  const statusSpan = document.getElementById('whatsappStatusConfig');

  if (isConnected) {
    statusSpan.textContent = 'Conectado';
    statusSpan.classList.replace('bg-secondary', 'bg-success');
  } else {
    statusSpan.textContent = 'Desconectado';
    statusSpan.classList.replace('bg-secondary', 'bg-danger');
  }
}

let wasWhatsAppConnected = null;

async function loadQRCodeIfDisconnected() {
  try {
    const statusRes = await fetch('/admin/whatsapp/status');
    const { isConnected } = await statusRes.json();

    const qrSection = document.getElementById('qrCodeSection');
    const qrDiv = document.getElementById('qrCode');
    const statusSpan = document.getElementById('whatsappStatusConfig');
    const toast = document.getElementById('whatsapp-status-toast');
    const toastText = document.getElementById('whatsapp-status-text');

    // Apenas se mudou o estado
    if (wasWhatsAppConnected !== isConnected) {
      wasWhatsAppConnected = isConnected;

      // Atualiza status visual
      if (statusSpan) {
        statusSpan.textContent = isConnected ? 'Conectado' : 'Desconectado';
        statusSpan.classList.remove('bg-secondary', 'bg-danger', 'bg-success');
        statusSpan.classList.add(isConnected ? 'bg-success' : 'bg-danger');
      }

      if (toast && toastText) {
        toast.classList.remove('success', 'error', 'd-none', 'show');

        if (isConnected) {
          toast.classList.add('success', 'show');
          toastText.innerText = 'WhatsApp está conectado ✅';
          setTimeout(() => toast.classList.remove('show'), 5000);
        } else {
          toast.classList.add('error', 'show');
          toastText.innerHTML = 'WhatsApp desconectado! <a href="/admin/config" class="text-danger fw-bold text-decoration-underline">Reconectar</a>';
        }
      }

      // Exibe/oculta QR code
      if (!isConnected && qrSection && qrDiv) {
        const qrRes = await fetch('/admin/whatsapp/qr');
        if (!qrRes.ok) return;
        const { qr } = await qrRes.json();
        qrDiv.innerHTML = '';
        new QRCode(qrDiv, { text: qr, width: 220, height: 220 });
        qrSection.style.display = 'block';
        qrSection.classList.add('fade-in-soft');
      } else if (isConnected && qrSection) {
        qrSection.style.display = 'none';
      }
    }

  } catch (e) {
    console.warn('❌ Erro ao verificar QR Code:', e);
  }
}


// document.body.style.opacity = '1';
// document.body.classList.add('fade-in-soft');
let isNavigating = false;
function navigateWithFade(href) {
  if (isNavigating) return;
  isNavigating = true;
  document.body.classList.add('fade-out-soft');
  setTimeout(() => window.location.href = href, 300);
}
// Função para mostrar alertas administrativos
// function showAlert(message, type = 'info') {
//     const alertContainer = document.getElementById('alertContainer') || createAlertContainer();

//     const alertDiv = document.createElement('div');
//     alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
//     alertDiv.innerHTML = `
//       <i class="fa-solid ${getAlertIcon(type)} me-2"></i>
//       ${message}
//       <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
//     `;

//     alertContainer.appendChild(alertDiv);

//     // Auto-remover após 5 segundos
//     setTimeout(() => {
//         if (alertDiv.parentNode) {
//             alertDiv.remove();
//         }
//     }, 5000);
// }

// Obter ícone do alerta



// Criar container de alertas se não existir
// function createAlertContainer() {
//     const container = document.createElement('div');
//     container.id = 'alertContainer';
//     container.style.position = 'fixed';
//     container.style.top = '20px';
//     container.style.right = '20px';
//     container.style.zIndex = '9999';
//     container.style.maxWidth = '400px';
//     document.body.appendChild(container);
//     return container;
// }

// Inicializar gráficos do dashboard
function initializeCharts() {
  // Gráfico de agendamentos por status
  const statusChartCanvas = document.getElementById('statusChart');
  if (statusChartCanvas) {
    const statusData = JSON.parse(statusChartCanvas.dataset.chartData || '{}');

    new Chart(statusChartCanvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusData).map(status => getStatusText(status)),
        datasets: [{
          data: Object.values(statusData),
          backgroundColor: [
            '#28a745', // Concluído
            '#ffc107', // Agendado
            '#17a2b8', // Confirmado
            '#dc3545', // Cancelado
            '#6c757d'  // Não compareceu
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${context.label}: ${context.parsed} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
  // Gráfico de agendamentos por dia    
  // Gráfico de agendamentos por barbeiro
  const barberChartCanvas = document.getElementById('barberChart');
  if (barberChartCanvas) {
    const barberData = JSON.parse(barberChartCanvas.dataset.chartData || '{}');

    new Chart(barberChartCanvas, {
      type: 'bar',
      data: {
        labels: Object.keys(barberData),
        datasets: [{
          label: 'Agendamentos',
          data: Object.values(barberData),
          backgroundColor: '#6f42c1',
          borderColor: '#5a32a3',
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title: function (context) {
                return `Barbeiro: ${context[0].label}`;
              }
            }
          }
        }
      }
    });
  }

  // Gráfico de receita mensal
  const revenueChartCanvas = document.getElementById('revenueChart');
  if (revenueChartCanvas) {
    const revenueData = JSON.parse(revenueChartCanvas.dataset.chartData || '{}');

    new Chart(revenueChartCanvas, {
      type: 'line',
      data: {
        labels: Object.keys(revenueData),
        datasets: [{
          label: 'Receita (R$)',
          data: Object.values(revenueData),
          borderColor: '#28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return formatCurrency(value);
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                return `Receita: ${formatCurrency(context.parsed.y)}`;
              }
            }
          }
        }
      }
    });
  }
}

// Traduzir status para português
function getStatusText(status) {
  const statusMap = {
    'pending': 'Pendente',
    'confirmed': 'Confirmado',
    'in_progress': 'Em atendimento',
    'completed': 'Concluído',
    'cancelled': 'Cancelado',
    'no_show': 'Não compareceu'
  };
  return statusMap[status] || status;
}

// Função para confirmar ações críticas
// function confirmAction(message, callback) {
//     if (confirm(message)) {
//         callback();
//     }
// }

// Função para formatar moeda brasileira
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Função para formatar data brasileira
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

// Função para formatar data e hora
function formatDateTime(dateTimeString) {
  return new Date(dateTimeString).toLocaleString('pt-BR');
}

// Filtro rápido de tabelas
function filterTable(inputId, tableId) {
  const input = document.getElementById(inputId);
  const table = document.getElementById(tableId);

  if (!input || !table) return;

  input.addEventListener('keyup', function () {
    const filter = this.value.toLowerCase();
    const rows = table.getElementsByTagName('tr');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.getElementsByTagName('td');
      let found = false;

      for (let j = 0; j < cells.length; j++) {
        if (cells[j].textContent.toLowerCase().includes(filter)) {
          found = true;
          break;
        }
      }

      row.style.display = found ? '' : 'none';
    }
  });
}

// Exportar dados da tabela para CSV
function exportTableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const rows = table.querySelectorAll('tr');
  const csvContent = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll('th, td');
    const rowData = Array.from(cells).map(cell => {
      return `"${cell.textContent.trim().replace(/"/g, '""')}"`;
    });
    csvContent.push(rowData.join(','));
  });

  const blob = new Blob([csvContent.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'dados.csv';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Atualizar contador em tempo real
function updateCounters() {
  const counters = document.querySelectorAll('[data-counter]');

  counters.forEach(counter => {
    const target = parseInt(counter.dataset.counter);
    let current = parseInt(counter.textContent) || 0;

    const animate = () => {
      current += Math.ceil(target / 60); // suaviza em ~1 segundo
      if (current >= target) {
        counter.textContent = target;
      } else {
        counter.textContent = current;
        requestAnimationFrame(animate);
      }
    };

    animate();
  });
}

async function confirmAppointment(appointmentId) {
  const ok = await confirmDialog({
    title: 'Confirmar agendamento',
    message: 'Confirmar este agendamento?',
    confirmText: 'Confirmar',
    variant: 'primary'
  });
  if (!ok) return;
  try {
    const response = await fetch(`/admin/appointments/${appointmentId}/confirm`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(ADMIN_CSRF ? { 'X-CSRF-Token': ADMIN_CSRF } : {})

      }
    });
    if (response.ok) {
      showAlert('Agendamento confirmado com sucesso!', 'success');
      setTimeout(() => {
        document.body.classList.add('fade-out-soft');
        setTimeout(() => window.location.href = location.href, 300);
      }, 1500);
    } else {
      showAlert('Erro ao confirmar agendamento', 'error');
    }
  } catch (error) {
    console.error('Erro:', error);
    showAlert('Erro ao confirmar agendamento', 'error');
  }

}

async function completeAppointment(appointmentId) {
  const ok = await confirmDialog({
    title: 'Concluir agendamento',
    message: 'Marcar este agendamento como concluído?',
    confirmText: 'Concluir',
    variant: 'success'
  });
  if (!ok) return;
  try {
    const response = await fetch(`/admin/appointments/${appointmentId}/complete`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(ADMIN_CSRF ? { 'X-CSRF-Token': ADMIN_CSRF } : {})

      }
    });
    if (response.ok) {
      showAlert('Agendamento concluído com sucesso!', 'success');
      setTimeout(() => {
        document.body.classList.add('fade-out-soft');
        setTimeout(() => window.location.href = location.href, 300);
      }, 1500);
    } else {
      showAlert('Erro ao concluir agendamento', 'error');
    }
  } catch (error) {
    console.error('Erro:', error);
    showAlert('Erro ao concluir agendamento', 'error');
  }

}


async function deleteAppointment(appointmentId) {
  const ok = await confirmDialog({
    title: 'Excluir agendamento',
    message: 'ATENÇÃO: Esta ação não pode ser desfeita. Excluir este agendamento?',
    confirmText: 'Excluir',
    variant: 'danger'
  });
  if (!ok) return;

  try {
    const response = await fetch(`/admin/appointments/${appointmentId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
    });
    if (response.ok) {
      showAlert('Agendamento excluído com sucesso!', 'success');
      setTimeout(() => {
        document.body.classList.add('fade-out-soft');
        setTimeout(() => window.location.href = location.href, 300);
      }, 1500);
    } else {
      showAlert('Erro ao excluir agendamento', 'error');
    }
  } catch (error) {
    console.error('Erro:', error);
    showAlert('Erro ao excluir agendamento', 'error');
  }

}
// Redireciona alert(...) para notify(...)
window.alert = (msg) => notify({ type: 'info', message: String(msg) });

// Redireciona confirm(...) para confirmDialog(...) (retorna boolean via Promise)
window.confirm = (msg) => {
  console.warn('Evite usar window.confirm; usando confirmDialog como fallback.');
  return confirmDialog({ message: String(msg) }).then(Boolean);
};

async function sendWhatsApp(appointmentId) {
  try {
    const response = await fetch(`/admin/appointments/${appointmentId}/whatsapp`, {
      method: 'POST',
      credentials: 'include'
    });
    if (response.ok) {
      showAlert('Mensagem enviada pelo WhatsApp com sucesso!', 'success');
    } else {
      showAlert('Erro ao enviar WhatsApp', 'error');
    }
  } catch (error) {
    console.error('Erro:', error);
    showAlert('Erro ao enviar mensagem pelo WhatsApp', 'error');
  }
}

function reloadWithFade() {
  if (isNavigating) return;
  isNavigating = true;
  document.body.classList.add('fade-out-soft');
  setTimeout(() => window.location.reload(), 300);
}

