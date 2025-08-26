/// JAVASCRIPT MODERNO - SISTEMA DE AGENDAMENTO CLEAN - VERSÃO CORRIGIDA

if (typeof window.BARBERSHOP_CONFIG === 'undefined') {
  window.BARBERSHOP_CONFIG = {
    WHATSAPP_NUMBER: '5563992014547',
    GOOGLE_CLIENT_ID: 'SEU_GOOGLE_CLIENT_ID_AQUI'
  };
}

const CONFIG = window.BARBERSHOP_CONFIG;

let appState = {
  services: [],
  availableBarbers: [],
  availableTimes: [],
  currentStep: 1,
  selectedService: null,
  selectedBarber: null,
  selectedDate: null,
  selectedTime: null,
  clientData: {},
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear()
};

function log(message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [CLIENT] ${message}`, data || '');
}

function logError(message, error = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.error(`[${timestamp}] [CLIENT ERROR] ${message}`, error || '');
}

// Detectar se é a página de histórico
const isHistoryPage = window.location.pathname.includes('/history');

document.addEventListener('DOMContentLoaded', async () => {
  if (isHistoryPage) {
    log('Histórico detectado - Inicializando somente transição suave.');
    setupSmoothPageTransition();
    return;
  }

  log('Inicializando sistema de agendamento moderno');
  try {
    await loadServices();
    // setupEventListeners();
    loadBarbers();
    initializeCalendar();
    setupPhoneMask();
    document.getElementById('prevMonth')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth')?.addEventListener('click', () => changeMonth(1));
    
    if (CONFIG.GOOGLE_CLIENT_ID !== 'SEU_GOOGLE_CLIENT_ID_AQUI') {
      initializeGoogleLogin();
    }

    ['clientFirstName', 'clientLastName', 'clientPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', validateClientForm);
      el.addEventListener('blur', validateClientForm); // 👈 importante
    }
  });


    log('Sistema inicializado com sucesso');
  } catch (error) {
    logError('Erro na inicialização', error);
  }
});

function setupSmoothPageTransition() {
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('/') || href === window.location.pathname) return;

    link.addEventListener('click', function (e) {
      e.preventDefault();
      document.body.classList.add('carousel-slide');
      setTimeout(() => {
        window.location.href = href;
      }, 400);
    });
  });
}



// ===== CARREGAR SERVIÇOS - CORRIGIDO =====
async function loadServices() {
  log('Buscando serviços disponíveis');

  const spinner = document.getElementById('servicesSpinner');
  const container = document.getElementById('servicesContainer');


  // Verificar se os elementos existem
  if (!spinner || !container) {
    logError('Elementos de serviços não encontrados no DOM');
    return;
  }

  try {
    // 1) Mostrar spinner e esconder container
    spinner.style.display = 'flex';
    spinner.classList.add('show');
    container.style.display = 'none';
    container.classList.remove('show');

    const res = await fetch('/api/services');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { services } = await res.json();
    appState.services = services;
    
    // Renderizar serviços
    renderServices(services);

    // 2) Esconder spinner e mostrar container com animação
    spinner.style.display = 'none';
    spinner.classList.remove('show');
    
    // Garantir que o container seja visível
   container.style.removeProperty("display");
    container.classList.remove("d-none");

    // container.classList.add('show');
    container.classList.add('fade-in-soft');
    
    log(`${services.length} serviços carregados e exibidos`);
    
  } catch (err) {
    logError('Erro ao carregar serviços', err);
    showNotification('Erro ao carregar serviços. Tente recarregar.', 'error');
    
    // Em caso de erro, esconder spinner
    if (spinner) {
      spinner.style.display = 'none';
      spinner.classList.remove('show');
    }
  }
  

}

// Renderizar cards de serviços dinamicamente
function renderServices(services) {
  const container = document.getElementById('servicesContainer');
  if (!container) return;

  container.innerHTML = '';

  services.forEach(svc => {
    const priceNum = Number(svc.price);

    const item = document.createElement('div');
    item.className = 'service-card bg-dark text-light border-secondary rounded-3 mb-2 px-3 py-2 d-flex align-items-center justify-content-between w-100';
    item.dataset.serviceId = svc.id;

    item.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <img src="${svc.photo || '/images/logo.jpg'}" alt="${svc.name}" 
             class="rounded-circle" style="width:40px; height:40px; object-fit:cover;">
        <div>
          <h6 class="mb-0 fw-bold service-name">${svc.name}</h6>
          <small class="text-muted">
            <i class="far fa-clock me-1"></i> ${svc.duration} min
          </small>
        </div>
      </div>
      <div class="text-end">
<span class="text-success fw-bold d-block">R$ ${Number.isNaN(priceNum) ? '0,00' : priceNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>        <button class="btn btn-primary btn-sm mt-1">Agendar</button>
      </div>
    `;

    item.querySelector('button').addEventListener('click', () => selectService(svc));
    container.appendChild(item);
  });

  log('Serviços renderizados no formato slim 100% width');
}





// Selecionar serviço
function selectService(service) {
  log('Serviço selecionado', service);
  appState.selectedService = service;
  goToStep(2); // vai para barbeiros
}

// Ir para etapa - CORRIGIDO
function goToStep(step) {
  log(`Avançando para etapa ${step}`);

  // Esconder todas as etapas
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`step${i}`);
    if (el) el.style.display = 'none';
  }

  // Mostrar etapa atual
  const targetStep = document.getElementById(`step${step}`);
  if (targetStep) {
    targetStep.style.display = 'block';
    targetStep.classList.add('fade-in-up');
  } else {
    logError(`Elemento step${step} não encontrado no DOM.`);
    return;
  }

  // Ações específicas
  if (step === 2) loadBarbers();
  if (step === 3) generateCalendar();
  if (step === 4) updateBookingSummary();

  appState.currentStep = step;
}

// Atualizar indicadores de etapa
function updateStepIndicators(currentStep) {
  document.querySelectorAll('.step-indicator').forEach(indicator => {
    const dots = indicator.querySelectorAll('.step-dot');
    dots.forEach((dot, index) => {
      dot.classList.remove('active', 'completed');
      if (index + 1 < currentStep) {
        dot.classList.add('completed');
      } else if (index + 1 === currentStep) {
        dot.classList.add('active');
      }
    });
  });
}

// Carregar barbeiros
async function loadBarbers() {
  log('Carregando barbeiros');
  
  try {
    const response = await fetch('/api/barbers');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const barbers = data.barbers || data;
    
    const container = document.getElementById('barbersContainer');
    if (!container) {
      logError('Container de barbeiros não encontrado');
      return;
    }
    
    container.innerHTML = '';
    
    if (!Array.isArray(barbers)) {
      logError('Resposta de barbeiros não é um array', barbers);
      return;
    }
    
    barbers.forEach(barber => {
      const barberCard = createBarberCard(barber);
      container.appendChild(barberCard);
    });
    
    appState.availableBarbers = barbers;
    log(`${barbers.length} barbeiros carregados`);
    
  } catch (error) {
    logError('Erro ao carregar barbeiros', error);
    showNotification('Erro ao carregar barbeiros. Tente recarregar a página.', 'error');
  }
}

// Gerar URL do avatar
function generateAvatarUrl(name) {
  const fileName = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '-');
  return `/images/barbers/${fileName}.png`;
}


// Criar card de barbeiro (formato AppBarber)
function createBarberCard(barber) {
  const item = document.createElement('div');
  item.className = 'list-group-item d-flex justify-content-between align-items-center bg-dark text-light border-secondary rounded-3 mb-2 p-3';
  item.dataset.barberId = barber.id;

  const avatarContent = barber.photo
    ? `<img src="${barber.photo}" alt="${barber.name}" class="rounded-circle me-3" style="width:50px; height:50px; object-fit:cover;">`
    : `<div class="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-3" style="width:50px; height:50px;">${barber.name.charAt(0)}</div>`;

  item.innerHTML = `
    <div class="d-flex align-items-center">
      ${avatarContent}
      <div>
        <h6 class="mb-0 fw-bold">${barber.name}</h6>
        
      </div>
    </div>
    <button class="btn btn-outline-light btn-sm">Selecionar</button>
  `;

  // Seleção do barbeiro
  item.querySelector('button').addEventListener('click', () => selectBarber(barber));

  return item;
}


// Selecionar barbeiro

function selectBarber(barber) {
  log('Barbeiro selecionado', barber);
  appState.selectedBarber = barber;
  goToStep(3); // vai para calendário
}



// Inicializar calendário
function initializeCalendar() {
  log('Inicializando calendário');
  generateCalendar();
}

// Gerar calendário
function generateCalendar() {
  log(`Gerando calendário para ${appState.currentMonth + 1}/${appState.currentYear}`);
  
  const calendarGrid = document.getElementById('calendarGrid');
  const calendarTitle = document.getElementById('calendarTitle');
  
  if (!calendarGrid || !calendarTitle) {
    logError('Elementos do calendário não encontrados');
    return;
  }
  
  // Atualizar título
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  calendarTitle.textContent = `${monthNames[appState.currentMonth]} ${appState.currentYear}`;
  
  // Limpar grid
  calendarGrid.innerHTML = '';
  
  // Cabeçalhos dos dias
  const dayHeaders = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  dayHeaders.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    header.textContent = day;
    calendarGrid.appendChild(header);
  });
  
  // Gerar dias do mês
  const firstDay = new Date(appState.currentYear, appState.currentMonth, 1);
  const lastDay = new Date(appState.currentYear, appState.currentMonth + 1, 0);
  const today = new Date();
  
  // Dias vazios no início
  for (let i = 0; i < firstDay.getDay(); i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    calendarGrid.appendChild(emptyDay);
  }
  
  // Dias do mês
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    dayElement.textContent = day;
    
  const currentDate = new Date(appState.currentYear, appState.currentMonth, day);
  const todayOnlyDate = new Date();
  todayOnlyDate.setHours(0, 0, 0, 0); // zera a hora para comparar só a data

  if (currentDate < todayOnlyDate) {
    dayElement.classList.add('disabled');
    dayElement.title = 'Dia indisponível';
  } else {
    dayElement.classList.add('available');
    dayElement.addEventListener('click', () => selectDate(currentDate));
  }
    calendarGrid.appendChild(dayElement);
  }
  
  log('Calendário gerado com sucesso');
}

// Selecionar data
function selectDate(date) {
  log('Data selecionada', date);
  appState.selectedDate = date;

  // Abrir modal de horários
  abrirModal();
  loadAvailableTimes(date);
}

// ===== CARREGAR HORÁRIOS - CORRIGIDO =====
async function loadAvailableTimes(date) {
  log('Carregando horários disponíveis para', date);

  const spinner = document.getElementById('loadingSpinner');
  const timesContainer = document.getElementById('timesContainer');
  const slotsContainer = document.getElementById('timeSlotsContainer');

  // Verificar se os elementos existem
  if (!timesContainer || !slotsContainer) {
    logError('Elementos de horários não encontrados no DOM');
    return;
  }

  try {
    // Mostrar spinner e esconder horários
    if (spinner) {
      spinner.style.display = 'flex';
      spinner.classList.add('show');
    }
    
    timesContainer.style.display = 'none';
    timesContainer.classList.remove('show');

    const dateStr = date.toISOString().split('T')[0];
    const service = appState.selectedService;
    if (!service) throw new Error('Serviço não selecionado');

    let durationMinutes;
    if (typeof service.duration === 'string' && service.duration.endsWith('min')) {
      durationMinutes = parseInt(service.duration, 10);
    } else if (typeof service.duration === 'number') {
      durationMinutes = service.duration;
    } else {
      throw new Error(`Formato de duração inválido: ${service.duration}`);
    }

    const response = await fetch(
      `/api/available-times?` +
      `date=${dateStr}` +
      `&barberId=${appState.selectedBarber.id}` +
      `&serviceTypeId=${service.id}` +
      `&duration=${durationMinutes}`
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const data = await response.json();
    const times = Array.isArray(data.availableTimes) ? data.availableTimes : [];

    appState.availableTimes = times;

    // Limpar container
    slotsContainer.innerHTML = '';

    if (times.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'text-muted text-center fade-in-soft';
      emptyMsg.textContent = 'Nenhum horário disponível para esta data';
      slotsContainer.appendChild(emptyMsg);
    } else {
      times.forEach(time => {
        slotsContainer.appendChild(createTimeSlot(time));
      });
    }

    // Esconder spinner e mostrar horários
    if (spinner) {
      spinner.style.display = 'none';
      spinner.classList.remove('show');
    }
    
    // Garantir que o container seja visível
    timesContainer.style.display = 'block';
    timesContainer.classList.add('show');
    timesContainer.classList.add('fade-in-soft');
   
    log(`${times.length} horários carregados e exibidos`);

  } catch (error) {
    logError('Erro ao carregar horários', error);
    showNotification('Erro ao buscar horários disponíveis. Tente novamente.', 'error');

    // Esconder spinner e horários em caso de erro
    if (spinner) {
      spinner.style.display = 'none';
      spinner.classList.remove('show');
    }
    timesContainer.style.display = 'none';
    timesContainer.classList.remove('show');
  }
}

// Criar slot de horário - CORRIGIDO
function createTimeSlot(time) {
  const slot = document.createElement('div');
  slot.className = 'time-slot';
  slot.textContent = time;
  slot.dataset.time = time;

  // Verificar se o horário está disponível
  if (!appState.availableTimes.includes(time)) {
    slot.classList.add('disabled');
    slot.title = 'Horário indisponível';
    return slot;
  }

  // Adicionar evento de clique apenas para horários disponíveis
  slot.addEventListener('click', () => selectTime(time));
  return slot;
}

// Selecionar horário
function selectTime(time) {
  log('Horário selecionado', time);
  appState.selectedTime = time;
  fecharModal();
  goToStep(4); // vai para cliente + resumo
}


// Mudar mês
function changeMonth(direction) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let newMonth = appState.currentMonth + direction;
  let newYear = appState.currentYear;

  if (newMonth < 0) {
    newMonth = 11;
    newYear--;
  } else if (newMonth > 11) {
    newMonth = 0;
    newYear++;
  }

  // Permitir somente o mês atual e o próximo mês
  const maxMonth = (currentMonth + 1) % 12;
  const maxYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  const isBeforeCurrent =
    newYear < currentYear || (newYear === currentYear && newMonth < currentMonth);
  const isAfterNext =
    newYear > maxYear || (newYear === maxYear && newMonth > maxMonth);

  if (isBeforeCurrent || isAfterNext) {
    log('Mês fora do intervalo permitido');
    return;
  }

  appState.currentMonth = newMonth;
  appState.currentYear = newYear;
  generateCalendar();
}






// Atualizar resumo do agendamento
function updateBookingSummary() {
  log('Atualizando resumo do agendamento');
  
  const elements = {
    service: document.getElementById('summaryService'),
    barber: document.getElementById('summaryBarber'),
    date: document.getElementById('summaryDate'),
    time: document.getElementById('summaryTime'),
    duration: document.getElementById('summaryDuration'),
    price: document.getElementById('summaryPrice')
  };
  
  if (elements.service) 
    elements.service.textContent = appState.selectedService?.name || '-';
  if (elements.barber) 
    elements.barber.textContent = appState.selectedBarber?.name || '-';
  if (elements.date) 
    elements.date.textContent = appState.selectedDate?.toLocaleDateString('pt-BR') || '-';
  if (elements.time) 
    elements.time.textContent = appState.selectedTime || '-';
  if (elements.duration) 
    elements.duration.textContent = appState.selectedService?.duration + 'min' || '-';

  if (elements.price) {
    const priceNum = Number(appState.selectedService?.price) || 0;
    elements.price.textContent = `R$ ${priceNum.toFixed(2)}`;
  }
}

// Máscara de telefone
function setupPhoneMask() {
  const phoneInput = document.getElementById('clientPhone');
  if (!phoneInput) return;

  phoneInput.addEventListener('blur', () => {
    validateClientForm(); // força validação após sair do campo
  });
phoneInput.addEventListener('input', function (e) {
  let value = e.target.value.replace(/\D/g, '');

  // Se apagar tudo, não força nada
  if (value.length === 0) {
    e.target.value = '';
    return;
  }

  if (value.length > 11) value = value.slice(0, 11);

  if (value.length <= 2) {
    value = value.replace(/(\d{0,2})/, '($1');
  } else if (value.length <= 6) {
    value = value.replace(/(\d{2})(\d{0,4})/, '($1) $2');
  } else if (value.length <= 10) {
    value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else {
    value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  }

  e.target.value = value;
  setTimeout(validateClientForm, 0);
});

}

// Formatar telefone para WhatsApp
function formatPhoneForWhatsApp(phone) {
  let digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits[2] === '9') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }

  if (digits.length === 10) {
    return '55' + digits;
  }

  return null;
}

// Validação do formulário do cliente
function validateClientForm() {
  const firstNameEl = document.getElementById('clientFirstName');
  const lastNameEl = document.getElementById('clientLastName');
  const phoneEl = document.getElementById('clientPhone');

  if (!firstNameEl || !lastNameEl || !phoneEl) {
    logError('Algum campo obrigatório não foi encontrado no DOM');
    return false;
  }

  const firstName = firstNameEl.value.trim();
  const lastName = lastNameEl.value.trim();
  const phone = phoneEl.value.trim();

  const phoneRegex = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;
  const isValidPhone = phoneRegex.test(phone);
  const isValid = firstName.length > 0 && lastName.length > 0 && isValidPhone;

  const confirmBtn = document.getElementById('confirmBooking');
  if (confirmBtn) {
    confirmBtn.disabled = !isValid;
    confirmBtn.classList.toggle('disabled', !isValid);
  }

  console.log('Validação:', { firstName, lastName, phone, isValidPhone, isValid });
  return isValid;
}

// Confirmar agendamento
// Confirmar agendamento
function setBtnLoading(btn, isLoading, textWhenLoading = 'Confirmando agendamento...', textWhenIdle = 'Confirmar agendamento') {
  if (!btn) return;
  const spinner = btn.querySelector('.spinner-border');
  const label = btn.querySelector('.btn-label');

  if (isLoading) {
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.setAttribute('aria-busy', 'true');
    if (spinner) spinner.classList.remove('d-none');
    if (label) label.textContent = textWhenLoading;
  } else {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
    btn.setAttribute('aria-busy', 'false');
    if (spinner) spinner.classList.add('d-none');
    if (label) label.textContent = textWhenIdle;
  }
}

async function confirmBooking(btnEl) {
 if (typeof validateClientForm === 'function' && !validateClientForm()) {
    if (typeof showNotification === 'function') {
      showNotification('Preencha todos os campos corretamente', 'error');
    }
    return;
  }
  setBtnLoading(btnEl, true, 'Confirmando agendamento...', 'Confirmar agendamento');
  
  try {
    
    const phoneInput = document.getElementById('clientPhone');
    const formattedPhone = typeof formatPhoneForWhatsApp === 'function'
      ? formatPhoneForWhatsApp(phoneInput.value)
      : (phoneInput?.value || '').trim();

    const bookingData = typeof collectBookingData === 'function' ? collectBookingData() : {};
    bookingData.clientPhone = formattedPhone;

   
    const csrfToken = (typeof getCsrfToken === 'function' ? getCsrfToken() : (window.csrfToken || ''));
    const resp = await fetch('/api/appointments/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
      },
      body: JSON.stringify(bookingData)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(errText || 'Falha ao confirmar o agendamento');
    }

    const result = await resp.json();

  
    if (result?.sendWhatsApp === true && formattedPhone) {
      const wppResp = await fetch('/api/whatsapp/send-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        },
        body: JSON.stringify({
          to: formattedPhone,
          appointmentId: result.appointmentId,
          message: result?.whatsMessage || 'Seu agendamento foi confirmado!'
        })
      });
      if (!wppResp.ok) {
        const errText = await wppResp.text();
        throw new Error(errText || 'Agendou, mas falhou ao enviar mensagem no WhatsApp');
      }
    }

    if (typeof showNotification === 'function') {
      showNotification('Agendamento confirmado com sucesso!', 'success');
    }
  
    if (typeof goToStep === 'function') goToStep(5);

  } catch (err) {
    console.error('[confirmBooking] erro:', err);
    if (typeof showNotification === 'function') {
      showNotification(err.message || 'Erro ao confirmar agendamento', 'error');
    }
  } finally {
    
    setBtnLoading(btnEl, false);
  }
}

// Atualizar confirmação final
function updateFinalConfirmation(bookingData) {
  const elements = {
    service: document.getElementById('finalService'),
    barber: document.getElementById('finalBarber'),
    date: document.getElementById('finalDate'),
    time: document.getElementById('finalTime'),
    client: document.getElementById('finalClient'),
    price: document.getElementById('finalPrice')
  };
  
  if (elements.service) elements.service.textContent = appState.selectedService.name;
  if (elements.barber) elements.barber.textContent = appState.selectedBarber.name;
  if (elements.date) elements.date.textContent = appState.selectedDate.toLocaleDateString('pt-BR');
  if (elements.time) elements.time.textContent = appState.selectedTime;
  if (elements.client) elements.client.textContent = `${bookingData.clientData.firstName} ${bookingData.clientData.lastName}`;
  if (elements.price) {
    const priceNum = Number(appState.selectedService.price) || 0;
    elements.price.textContent = `R$ ${priceNum.toFixed(2)}`;
  }
}

// Inicializar Google Login
function initializeGoogleLogin() {
  log('Inicializando Google Login');
  
  if (typeof google !== 'undefined') {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse
    });
  }
}

// Manipular login do Google
function handleGoogleLogin() {
  log('Tentativa de login com Google');
  
  if (typeof google !== 'undefined') {
    google.accounts.id.prompt();
  } else {
    showNotification('Google Login não está disponível', 'warning');
  }
}

// Manipular resposta do Google
function handleGoogleResponse(response) {
  log('Resposta do Google recebida');
  
  try {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    
    document.getElementById('clientFirstName').value = payload.given_name || '';
    document.getElementById('clientLastName').value = payload.family_name || '';
    document.getElementById('clientEmail').value = payload.email || '';
    
    validateClientForm();
    showNotification('Dados preenchidos com sucesso!', 'success');
    
  } catch (error) {
    logError('Erro ao processar resposta do Google', error);
    showNotification('Erro ao fazer login com Google', 'error');
  }
}

// Mostrar notificação
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Função para normalizar textos (remove acentos e padroniza para minúsculo)
// Normaliza textos (remove acentos e deixa minúsculo)
function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")                  // separa acentos
    .replace(/[\u0300-\u036f]/g, "")   // remove acentos
    .trim();
}

function filterServices() {
  const inputEl = document.getElementById('searchInput');
  if (!inputEl) return;

  const searchTerm = normalizeText(inputEl.value);

  // 🔹 Filtra direto no array original de serviços
  const filtered = appState.services.filter(svc =>
    normalizeText(svc.name).includes(searchTerm)
  );

  // 🔹 Renderiza só os filtrados
  renderServices(filtered);

  console.log(`[FILTER] "${searchTerm}" => ${filtered.length} resultados`);
}






// ===== MODAL - CORRIGIDO =====
const modal = document.getElementById('meuModal');

function abrirModal(){
  if (!modal) return;
  if (modal.parentElement !== document.body) document.body.appendChild(modal);
  modal.classList.add('show');
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
}






let modalResizeObserver;


function fecharModal(){
  if (!modal) return;
  modal.classList.remove('show');
  modal.style.display = 'none';
  document.body.classList.remove('modal-open');
}



// Fechar modal ao clicar fora
if (modal) {
  modal.addEventListener('click', function(event) {
    if (event.target === modal) {
      fecharModal();
    }
  });
}
function adjustTimeSlots() {
  const timeSlotsContainer = document.getElementById('timeSlotsContainer');
  const timeSlots = timeSlotsContainer.querySelectorAll('.time-slot');
  
  // Ativa modo compacto se mais de 12 horários
  if(timeSlots.length > 12) {
    timeSlotsContainer.classList.add('compact-mode');
  } else {
    timeSlotsContainer.classList.remove('compact-mode');
  }
}



function scrollToTop() {
  goToStep(1);
}



// Exportar funções globais necessárias
window.loadServices = loadServices;
window.selectService = selectService;
window.selectBarber = selectBarber;
window.selectDate = selectDate;
window.selectTime = selectTime;
window.confirmBooking = confirmBooking;
window.goToStep = goToStep;
window.changeMonth = changeMonth;
window.filterServices = filterServices;
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;

