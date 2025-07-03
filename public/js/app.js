// JAVASCRIPT MODERNO - SISTEMA DE AGENDAMENTO CLEAN - VERSÃO CORRIGIDA

// Verificar se CONFIG já existe para evitar redeclaração
if (typeof window.BARBERSHOP_CONFIG === 'undefined') {
  window.BARBERSHOP_CONFIG = {
    WHATSAPP_NUMBER: '5563992014547',
    GOOGLE_CLIENT_ID: 'SEU_GOOGLE_CLIENT_ID_AQUI'
  };
}

// Usar referência global para evitar conflitos
const CONFIG = window.BARBERSHOP_CONFIG;

// Estado global da aplicação
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

// Logs detalhados
function log(message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [CLIENT] ${message}`, data || '');
}

function logError(message, error = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.error(`[${timestamp}] [CLIENT ERROR] ${message}`, error || '');
}

// Configurar event listeners (calendário, mascas, validações)
function setupEventListeners() {
  // Navegação de meses no calendário
  document.getElementById('prevMonth')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth')?.addEventListener('click', () => changeMonth(1));
  
  // Validação de formulário
  ['clientFirstName', 'clientLastName', 'clientPhone'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', validateClientForm);
  });
  
  // Google login
  document.getElementById('googleLogin')?.addEventListener('click', handleGoogleLogin);
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  log('Inicializando sistema de agendamento moderno');
  try {
    await loadServices();
    setupEventListeners();
    loadBarbers();
    initializeCalendar();
    setupPhoneMask();
    
    // só chama se o CLIENT_ID estiver configurado
    if (CONFIG.GOOGLE_CLIENT_ID !== 'SEU_GOOGLE_CLIENT_ID_AQUI') {
      initializeGoogleLogin();
    }
    log('Sistema inicializado com sucesso');
  } catch (error) {
    logError('Erro na inicialização', error);
  }
});

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
    container.style.display = 'grid';
    container.classList.add('show');
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
  if (!container) {
    logError('Container de serviços não encontrado');
    return;
  }
  
  container.innerHTML = '';
  
  services.forEach(svc => {
    const priceNum = Number(svc.price);
    const card = document.createElement('div');
    card.className = 'service-card';
    card.dataset.serviceId = svc.id;
    card.innerHTML = `
      <div class="service-header">
        <div>
          <div class="service-name">${svc.name}</div>
          <div class="service-duration">${svc.duration}min</div>
        </div>
        <div class="service-price">R$ ${Number.isNaN(priceNum) ? '0.00' : priceNum.toFixed(2)}</div>
      </div>
    `;
    card.addEventListener('click', () => selectService(svc));
    container.appendChild(card);
  });
  
  log('Cards de serviços renderizados');
}

// Selecionar serviço
function selectService(service) {
  log('Serviço selecionado', service);
  
  document.querySelectorAll('.service-card').forEach(card => card.classList.remove('selected'));
  const selectedCard = document.querySelector(`[data-service-id="${service.id}"]`);
  if (selectedCard) selectedCard.classList.add('selected');
  
  appState.selectedService = service;
  
  const continueBtn = document.getElementById('continueToBarber');
  if (continueBtn) {
    continueBtn.disabled = false;
    continueBtn.classList.remove('disabled');
  }
  
  goToStep(2);
  log('Botão continuar ativado');
}

// Ir para etapa - CORRIGIDO
function goToStep(step) {
  log(`Avançando para etapa ${step}`);

  // Esconder todas as etapas
  document.querySelectorAll('.step').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });

  // Mostrar etapa atual
  const targetStep = document.getElementById(`step${step}`);
  if (targetStep) {
    targetStep.classList.add('active');
    targetStep.style.display = 'block';
    targetStep.classList.add('fade-in-up');
  } else {
    logError(`Elemento step${step} não encontrado no DOM.`);
    return;
  }

  // Ações específicas por etapa
  if (step === 2) {
    loadBarbers();
  }
  if (step === 3) {
    // Limpar estado de horários
    appState.availableTimes = [];
    const timesContainer = document.getElementById('timesContainer');
    const slotsContainer = document.getElementById('timeSlotsContainer');
    
    if (timesContainer) {
      timesContainer.style.display = 'none';
      timesContainer.classList.remove('show');
    }
    if (slotsContainer) {
      slotsContainer.innerHTML = '';
    }
    
    generateCalendar();
  }
  if (step === 4) {
    updateBookingSummary();
  }

  // Atualizar indicadores
  updateStepIndicators(step);
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

// Criar card de barbeiro
function createBarberCard(barber) {
  const card = document.createElement('div');
  card.className = 'barber-card';
  card.dataset.barberId = barber.id;

  const avatarUrl = barber.avatarUrl || generateAvatarUrl(barber.name);
  const avatarContent = `<img class="barber-avatar-img" src="${avatarUrl}" alt="${barber.name}" onerror="this.onerror=null;this.style.display='none';" />`;

  card.innerHTML = `
    <div class="barber-avatar">${avatarContent}</div>
    <div class="barber-name">${barber.name}</div>
    <div class="barber-specialty">${barber.specialties || 'Especialista'}</div>
  `;

  card.addEventListener('click', () => selectBarber(barber));
  return card;
}

// Selecionar barbeiro
function selectBarber(barber) {
  log('Barbeiro selecionado', barber);
  
  document.querySelectorAll('.barber-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  const selectedCard = document.querySelector(`[data-barber-id="${barber.id}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }
  
  appState.selectedBarber = barber;
  
  const continueBtn = document.getElementById('continueToDate');
  if (continueBtn) {
    continueBtn.disabled = false;
    continueBtn.classList.remove('disabled');
  }
  
  log('Botão continuar ativado');
  goToStep(3);
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
    
    // Verificar se é dia passado
    if (currentDate < today.setHours(0, 0, 0, 0)) {
      dayElement.classList.add('disabled');
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
  
  // Remover seleção anterior
  document.querySelectorAll('.calendar-day').forEach(day => {
    day.classList.remove('selected');
  });
  
  // Selecionar nova data
  event.target.classList.add('selected');
  
  appState.selectedDate = date;
  
  // Carregar horários disponíveis
  loadAvailableTimes(date);
  abrirModal();
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
  
  // Remover seleção anterior
  document.querySelectorAll('.time-slot').forEach(slot => {
    slot.classList.remove('selected');
  });
  
  // Selecionar novo horário
  const selectedSlot = document.querySelector(`[data-time="${time}"]`);
  if (selectedSlot) {
    selectedSlot.classList.add('selected');
  }
  
  appState.selectedTime = time;
  
  // Ativar botão continuar
  const continueBtn = document.getElementById('continueToConfirm');
  if (continueBtn) {
    continueBtn.disabled = false;
    continueBtn.classList.remove('disabled');
  }
  
  log('Botão continuar ativado');
  fecharModal();
  goToStep(4);
}

// Mudar mês
function changeMonth(direction) {
  appState.currentMonth += direction;
  
  if (appState.currentMonth < 0) {
    appState.currentMonth = 11;
    appState.currentYear--;
  } else if (appState.currentMonth > 11) {
    appState.currentMonth = 0;
    appState.currentYear++;
  }
  
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

  phoneInput.addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length >= 2) {
      if (value.length <= 10) {
        value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
      } else {
        value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      }
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
  const firstName = document.getElementById('clientFirstName')?.value.trim();
  const lastName = document.getElementById('clientLastName')?.value.trim();
  const phone = document.getElementById('clientPhone')?.value.trim();

  const phoneRegex = /^\(\d{2}\)\s9\d{4}-\d{4}$/;
  const isValidPhone = phoneRegex.test(phone);

  const isValid = firstName && lastName && isValidPhone;

  const confirmBtn = document.getElementById('confirmBooking');
  if (confirmBtn) {
    confirmBtn.disabled = !isValid;
    confirmBtn.classList.toggle('disabled', !isValid);
  }

  return isValid;
}

// Confirmar agendamento
async function confirmBooking() {
  if (!validateClientForm()) {
    showNotification('Preencha todos os campos corretamente', 'error');
    return;
  }

  const phone = document.getElementById('clientPhone').value;
  const formattedPhone = formatPhoneForWhatsApp(phone);

  if (!formattedPhone) {
    showNotification('Telefone inválido para WhatsApp', 'error');
    return;
  }

  const bookingData = {
    serviceId: appState.selectedService.id,
    barberId: appState.selectedBarber.id,
    appointmentDate: appState.selectedDate.toISOString().split('T')[0],
    appointmentTime: appState.selectedTime,
    clientData: {
      firstName: document.getElementById('clientFirstName').value.trim(),
      lastName: document.getElementById('clientLastName').value.trim(),
      phone: formattedPhone,
      email: document.getElementById('clientEmail')?.value.trim() || ''
    }
  };

  const btn = document.getElementById('confirmBooking');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Confirmando...';

  try {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(bookingData)
    });
    if (!res.ok) throw new Error((await res.json()).message || res.statusText);
    updateFinalConfirmation(bookingData);
    goToStep(5);
    showNotification('Agendamento confirmado!', 'success');
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Erro ao confirmar', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check me-2"></i>Confirmar Agendamento';
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

// Filtrar serviços
function filterServices() {
  const input = document.getElementById('searchInput').value.toLowerCase();
  const cards = document.querySelectorAll('#servicesContainer .service-card');

  cards.forEach(card => {
    const serviceName = card.querySelector('.service-name').textContent.toLowerCase();
    if (serviceName.includes(input)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// ===== MODAL - CORRIGIDO =====
const modal = document.getElementById('meuModal');

function abrirModal() {
  if (!modal) {
    logError('Modal não encontrado no DOM');
    return;
  }
  
  modal.style.display = 'flex';
  modal.classList.add('show');
  
  setTimeout(() => {
    modal.classList.add('fade-in-modal');
  }, 10);
  
  document.body.classList.add('modal-open');
  log('Modal aberto');
}

function fecharModal() {
  if (!modal) return;
  
  modal.classList.remove('show', 'fade-in-modal');
  modal.style.display = 'none';
  document.body.classList.remove('modal-open');
  log('Modal fechado');
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

// Chame esta função após carregar os horários
adjustTimeSlots();
// Configurar validação de formulário
document.addEventListener('DOMContentLoaded', () => {
  ['clientFirstName', 'clientLastName', 'clientPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', validateClientForm);
    }
  });
});

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

