let currentPhone = '';
let resendCooldown = 50; // segundos
let codeExpireSeconds = 120;
let resendTimerInterval = null;
let expireTimerInterval = null;
const phoneInput = document.getElementById('phoneInput');
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

document.addEventListener('DOMContentLoaded', () => {
  const savedPhone = localStorage.getItem('lastPhone');
  const savedTime = localStorage.getItem('lastPhoneTime');

  if (savedPhone && savedTime) {
    const now = Date.now();
    const timeDiff = now - parseInt(savedTime, 10);

    const TEN_MINUTES = 10 * 60 * 1000; // 10 minutos em ms
    if (timeDiff <= TEN_MINUTES) {
      phoneInput.value = savedPhone;
      phoneInput.dispatchEvent(new Event('blur'));
    } else {
      localStorage.removeItem('lastPhone');
      localStorage.removeItem('lastPhoneTime');
    }
  }
});


// Função para formatar telefone enquanto digita
document.getElementById('phoneInput').addEventListener('input', function(e) {
  let value = e.target.value.replace(/\D/g, '');
  
  if (value.length <= 11) {
    if (value.length <= 2) {
      value = value.replace(/(\d{0,2})/, '($1');
    } else if (value.length <= 7) {
      value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    } else {
      value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    }
  }
  
  e.target.value = value;
});

document.getElementById('phoneInput').addEventListener('blur', async function () {
  const phoneInput = document.getElementById('phoneInput');
  const phone = phoneInput.value.trim();
    // Salva no localStorage com timestamp
    localStorage.setItem('lastPhone', phone);
    localStorage.setItem('lastPhoneTime', Date.now().toString());

  if (phone.length < 10) return;

  try {
    const res = await fetch('/history/check-code-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      body: JSON.stringify({ phone })
    });

    const result = await res.json();

    if (!result.hasCode) return;

    currentPhone = phone;
    document.getElementById('verificationSection').classList.remove('d-none');

    const sendBtn = document.getElementById('sendCodeBtn');
    sendBtn.disabled = true;

    // Timer de reenvio
    let cooldown = result.timeLeft;
    sendBtn.innerHTML = `<i class="fas fa-hourglass-half me-1"></i> Reenviar em ${cooldown}s`;

    if (resendTimerInterval) clearInterval(resendTimerInterval);
    resendTimerInterval = setInterval(() => {
      cooldown--;
      if (cooldown <= 0) {
        clearInterval(resendTimerInterval);
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<i class="fas fa-paper-plane me-1"></i> Enviar Código`;
      } else {
        sendBtn.innerHTML = `<i class="fas fa-hourglass-half me-1"></i> Reenviar em ${cooldown}s`;
      }
    }, 1000);

    // Timer de expiração
    const expirationLabel = document.getElementById('expirationTimer');
    let timeLeft = result.timeLeft;
    if (expireTimerInterval) clearInterval(expireTimerInterval);
    expireTimerInterval = setInterval(() => {
      timeLeft--;
      const min = String(Math.floor(timeLeft / 60)).padStart(1, '0');
      const sec = String(timeLeft % 60).padStart(2, '0');
      expirationLabel.textContent = `O código expira em ${min}:${sec}`;
      if (timeLeft <= 10) expirationLabel.classList.add('warning');
      else expirationLabel.classList.remove('warning');
      if (timeLeft <= 0) {
        clearInterval(expireTimerInterval);
        expirationLabel.textContent = 'Código expirado. Solicite um novo.';
      }
    }, 1000);

  } catch (err) {
    console.warn('Erro ao checar código anterior:', err);
  }
});

async function enviarCodigo() {
  const phoneInput = document.getElementById('phoneInput');
  const phone = phoneInput.value.trim();
  const sendBtn = document.getElementById('sendCodeBtn');

  if (!phone) {
    showAlert('Digite seu telefone.', 'warning');
    return;
  }

  showLoading(true);
  hideContainer();
  currentPhone = phone;

  try {
    const response = await fetch('/history/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      body: JSON.stringify({ phone })
    });

    const result = await response.json();
    showLoading(false);

    if (!result.success) {
      showAlert('Falha ao enviar código. Tente novamente.', 'danger');
      return;
    }

    showAlert('Código enviado via WhatsApp!', 'success');
    document.getElementById('verificationSection').classList.remove('d-none');

    // === Desativa botão por 50s ===
    sendBtn.disabled = true;
    let cooldown = resendCooldown;
    sendBtn.innerHTML = `<i class="fas fa-hourglass-half me-1"></i> Reenviar em ${cooldown}s`;

    if (resendTimerInterval) clearInterval(resendTimerInterval);
    resendTimerInterval = setInterval(() => {
      cooldown--;
      if (cooldown <= 0) {
        clearInterval(resendTimerInterval);
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<i class="fas fa-paper-plane me-1"></i> Enviar Código`;
      } else {
        sendBtn.innerHTML = `<i class="fas fa-hourglass-half me-1"></i> Reenviar em ${cooldown}s`;
      }
    }, 1000);

    // === Timer de expiração do código ===
    const expirationLabel = document.getElementById('expirationTimer');
    let timeLeft = codeExpireSeconds;
    if (expireTimerInterval) clearInterval(expireTimerInterval);
    expireTimerInterval = setInterval(() => {
      timeLeft--;
      const min = String(Math.floor(timeLeft / 60)).padStart(1, '0');
      const sec = String(timeLeft % 60).padStart(2, '0');
      expirationLabel.textContent = `O código expira em ${min}:${sec}`;
      if (timeLeft <= 10) expirationLabel.classList.add('warning');
      else expirationLabel.classList.remove('warning');
      if (timeLeft <= 0) {
        clearInterval(expireTimerInterval);
        expirationLabel.textContent = 'Código expirado. Solicite um novo.';
      }
    }, 1000);

  } catch (err) {
    console.error('Erro ao enviar código:', err);
    showAlert('Erro interno ao enviar código.', 'danger');
    showLoading(false);
  }
}


async function verificarCodigo(codeArg = null) {
  const code = codeArg || Array.from(document.querySelectorAll('.code-digit')).map(el => el.value).join('');

  if (code.length !== 4) {
    showAlert('Código inválido. Digite os 4 dígitos.', 'warning');
    return;
  }

  try {
    showLoading(true);

    const response = await fetch('/history/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      body: JSON.stringify({ phone: currentPhone, code })
    });

    const result = await response.json();
    showLoading(false);

    if (!result.success) {
      showAlert('Código incorreto ou expirado.', 'danger');
      return;
    }

    // ✅ CORREÇÃO: Esconde completamente o container de autenticação
    const authContainer = document.querySelector('.container.fade-in-soft');
    if (authContainer) {
      authContainer.style.display = 'none';
      authContainer.style.visibility = 'hidden';
      authContainer.style.position = 'absolute';
      authContainer.style.top = '-9999px';
      authContainer.style.left = '-9999px';
      authContainer.style.width = '0';
      authContainer.style.height = '0';
      authContainer.style.overflow = 'hidden';
      authContainer.style.margin = '0';
      authContainer.style.padding = '0';
      authContainer.style.minHeight = '0';
    }

    // ✅ CORREÇÃO: Remove o min-height do main-container
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
      mainContainer.style.minHeight = 'auto';
      mainContainer.style.height = 'auto';
    }

    // ✅ Esconde seção/formulário
    document.getElementById('verificationSection')?.classList.add('d-none');
    document.querySelector('form')?.classList.add('d-none');

    // ✅ CORREÇÃO: Revela histórico com posicionamento correto
    const historyContainer = document.getElementById('historyContainer');
    historyContainer.classList.remove('d-none');
    historyContainer.style.display = 'block';
    historyContainer.style.opacity = '1';
    historyContainer.style.position = 'relative';
    historyContainer.style.top = '0';
    historyContainer.style.left = '0';
    historyContainer.style.width = '100%';
    historyContainer.style.height = 'auto';
    historyContainer.style.minHeight = 'auto';
    historyContainer.style.marginTop = '20px';
    historyContainer.style.paddingTop = '20px';

    console.log('[DEBUG] Container revelado com posicionamento corrigido');

    // ✅ Carrega agendamentos
    carregarHistorico();

  } catch (err) {
    console.error('Erro ao verificar código:', err);
    showAlert('Erro interno ao verificar código.', 'danger');
    showLoading(false);
  }
}



async function carregarHistorico() {
  try {
    const phoneInput = document.getElementById('phoneInput');
    const phone = phoneInput.value;
    
    if (!phone) {
      showAlert('Digite seu telefone.', 'warning');
      return;
    }

    currentPhone = phone;
    showLoading(true);
    hideContainer();

    const res = await fetch('/history/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      body: new URLSearchParams({ phone })
    });

    const data = await res.json();
    showLoading(false);

    if (!data.success) {
      showAlert(data.message, 'warning');
      return;
    }

    if (data.appointments.length === 0) {
      showAlert('Nenhum agendamento encontrado para esse telefone.', 'info');
      showActiveAppointmentsButton();
      return;
    }

    renderAppointments(data.appointments);
    showActiveAppointmentsButton();

  } catch (err) {
    console.error('Erro ao carregar histórico:', err);
    showLoading(false);
    showAlert('Erro ao carregar histórico. Tente novamente.', 'danger');
  }
}

async function verificarAgendamentosAtivos() {
  if (!currentPhone) {
    showAlert('Digite seu telefone primeiro.', 'warning');
    return;
  }

  try {
    showLoading(true);

    const res = await fetch('/history/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      body: new URLSearchParams({ phone: currentPhone })
    });

    const data = await res.json();
    showLoading(false);

    if (!data.success) {
      showAlert(data.message, 'warning');
      return;
    }

    if (!data.hasActiveAppointments) {
      showAlert('Você não possui agendamentos em andamento ou futuros.', 'info');
      return;
    }

    renderAppointments(data.appointments, true);

  } catch (err) {
    console.error('Erro ao verificar agendamentos ativos:', err);
    showLoading(false);
    showAlert('Erro ao verificar agendamentos ativos.', 'danger');
  }
}

async function cancelarAgendamento(appointmentId) {
   const ok = await confirmDialog({
    title: 'Cancelar agendamento',
    message: 'Tem certeza que deseja cancelar este agendamento?',
    confirmText: 'Cancelar',
    variant: 'danger'
  });
  if (!ok) return;

  try {
    const res = await fetch(`/history/cancel/${appointmentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
    });

    const data = await res.json();

    if (data.success) {
      showAlert('Agendamento cancelado com sucesso!', 'success');
      // Recarregar a lista
      setTimeout(() => {
        carregarHistorico();
      }, 1500);
    } else {
      showAlert(data.message, 'danger');
    }

  } catch (err) {
    console.error('Erro ao cancelar agendamento:', err);
    showAlert('Erro ao cancelar agendamento. Tente novamente.', 'danger');
  }
}

function renderAppointments(appointments, activeOnly = false) {
  
  const container = document.getElementById('historyContainer');
  
  const title = activeOnly ? 
    '<h4 class="text-center text-info mb-3"><i class="fas fa-clock me-2"></i>Agendamentos em Andamento</h4>' :
    '<h4 class="text-center text-light mb-3"><i class="fas fa-list me-2"></i>Todos os Agendamentos</h4>';

  const cards = appointments.map(app => {
    const statusClass = getStatusClass(app.status);
    const statusText = getStatusText(app.status);
    
    const cancelButton = app.canCancel
      ? `<button class="btn btn-outline-danger btn-sm w-100 mt-2" onclick="cancelarAgendamento(${app.id})">
          <i class="fas fa-times-circle me-1"></i> Cancelar Agendamento
        </button>`
      : '';

    const priceDisplay = app.totalPrice > 0 
      ? `<p class="mb-1"><i class="fas fa-money-bill-wave me-2"></i> Valor: R$ ${parseFloat(app.totalPrice).toFixed(2)}</p>`
      : '';

      return `
        <div class="col">
          <div class="card ${statusClass} bg-dark text-white shadow-sm rounded-3 h-100 fade-in-soft">
            <div class="card-body">
              <h5 class="card-title mb-2">
                <i class="fas fa-cut me-1"></i> ${app.service}
              </h5>
              <p class="mb-1"><i class="fas fa-calendar-alt me-2"></i> ${app.date} às ${app.time}</p>
              <p class="mb-1"><i class="fas fa-user-tie me-2"></i> Barbeiro: ${app.barber}</p>
              <p class="mb-1">
                <i class="fas fa-info-circle me-2"></i>
                Status: <span class="fw-bold ${statusClass.replace('card-', 'text-')}">${statusText}</span>
              </p>
              ${priceDisplay}
              ${cancelButton}
            </div>
          </div>
        </div>
      `;

  }).join('');

  // ✅ CORREÇÃO: Container com posicionamento adequado
  container.innerHTML = `
  <div class="container py-4" style="margin-top: 0; padding-top: 20px;">
    ${title}
    <div class="row row-cols-1 row-cols-md-2 g-4">${cards}</div>
  </div>
`;

  // ✅ CORREÇÃO: Garante posicionamento correto do container
  container.classList.remove('d-none');
  container.style.position = 'relative';
  container.style.top = '0';
  container.style.marginTop = '0';
  container.style.paddingTop = '20px';
  
  console.log('[DEBUG] Container revelado com posicionamento corrigido');
}

function getStatusClass(status) {
  switch (status) {
    case 'confirmed':
    case 'scheduled':
      return 'card-neon-green';
    case 'cancelled':
      return 'card-neon-red';
    case 'completed':
      return 'card-neon-blue';
    default:
      return '';
  }
}

function getStatusText(status) {
  switch (status) {
    case 'scheduled':
      return 'Agendado';
    case 'confirmed':
      return 'Confirmado';
    case 'cancelled':
      return 'Cancelado';
    case 'completed':
      return 'Concluído';
    case 'no_show':
      return 'Não Compareceu';
    default:
      return status;
  }
}

function showAlert(message, type = 'info') {
  // Usa toasts padronizados
  const map = { danger: 'error', error: 'error', success: 'success', warning: 'warning', info: 'info' };
  notify({ type: map[type] || 'info', message });
}


function showLoading(show) {
  const loading = document.getElementById('loadingIndicator');
  if (show) {
    loading.classList.remove('d-none');
    // ✅ CORREÇÃO: Loading com posicionamento adequado
    loading.style.position = 'relative';
    loading.style.top = '0';
    loading.style.marginTop = '20px';
  } else {
    loading.classList.add('d-none');
  }
}

function hideContainer() {
  const container = document.getElementById('historyContainer');
  container.classList.add('d-none');
}

function showActiveAppointmentsButton() {
  const section = document.getElementById('activeAppointmentsSection');
  section.classList.remove('d-none');
  // ✅ CORREÇÃO: Botão com posicionamento adequado
  section.style.position = 'relative';
  section.style.top = '0';
  section.style.marginTop = '20px';
}

// Transição suave entre páginas
function setupSmoothPageTransition() {
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');

    // Permitir navegação normal para a página de histórico
    if (!href || !href.startsWith('/') || href === '/history') return;

link.addEventListener('click', function(e) {
  e.preventDefault();
  document.body.classList.add('page-fade-out'); // Adiciona classe CSS
  setTimeout(() => {
    window.location.href = href;
  }, 100);
});
  });
}

document.addEventListener('DOMContentLoaded', setupSmoothPageTransition);
document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('phoneInput');
  if (phoneInput.value.trim().length >= 10) {
    phoneInput.dispatchEvent(new Event('blur')); // Força verificação no carregamento
  }
});

document.querySelectorAll('.code-digit').forEach((input, idx, all) => {
  input.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val.slice(0, 1);

    if (val.length === 1 && idx < all.length - 1) {
      all[idx + 1].focus();
    }

    // Verificar automaticamente quando todos preenchidos
    const code = Array.from(all).map(el => el.value).join('');
    if (code.length === 4) {
      verificarCodigo(code);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
      all[idx - 1].focus();
    }
  });

  // Suporte a colar os 4 dígitos de uma vez
  input.addEventListener('paste', (e) => {
    const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    if (paste.length === 4) {
      e.preventDefault();
      all.forEach((el, i) => el.value = paste[i] || '');
      verificarCodigo(paste);
    }
  });
});

