// JAVASCRIPT MODERNO - SISTEMA DE AGENDAMENTO CLEAN

// Verificar se CONFIG já existe para evitar redeclaração
if (typeof window.BARBERSHOP_CONFIG === 'undefined') {
  window.BARBERSHOP_CONFIG = {
    WHATSAPP_NUMBER: '5563992014547',
    GOOGLE_CLIENT_ID: 'SEU_GOOGLE_CLIENT_ID_AQUI'
  };
}

// Usar referência global para evitar conflitos
// const CONFIG = window.BARBERSHOP_CONFIG;

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

// Carregar serviços disponíveis da API
async function loadServices() {
  log('Buscando serviços disponíveis');
  try {
    const res = await fetch('/api/services');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { services } = await res.json();
    appState.services = services;
    renderServices(services);
    log(`${services.length} serviços carregados`);
  } catch (err) {
    logError('Erro ao carregar serviços', err);
    showNotification('Erro ao carregar serviços. Tente recarregar.', 'error');
  }
}

// Renderizar cards de serviços dinamicamente
function renderServices(services) {
  const container = document.getElementById('servicesContainer');
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
   log('Botão continuar ativado');
}
 


// Ir para etapa
function goToStep(stepNumber) {
  log(`Avançando para etapa ${stepNumber}`);

  if (stepNumber === 2) {
    loadBarbers();
  }
  if (stepNumber === 3) {
    // limpa o UI e o estado antes de pedir novos horários
    appState.availableTimes = [];
    const cont = document.getElementById('timeSlotsContainer');
    if (cont) cont.innerHTML = '';
    document.getElementById('timesContainer').style.display = 'none';
    generateCalendar();
  }
  if (stepNumber === 4) {
    updateBookingSummary();
  }

  showStep(stepNumber);
  updateStepIndicators(stepNumber);
  appState.currentStep = stepNumber;
}


// Mostrar etapa
function showStep(stepNumber) {
  // Esconder todas as etapas
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('active');
  });
  
  // Mostrar etapa atual
  const currentStep = document.getElementById(`step${stepNumber}`);
  if (currentStep) {
    currentStep.classList.add('active');
    currentStep.classList.add('fade-in-up');
  }
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
    const barbers = data.barbers || data; // Suportar diferentes formatos de resposta
    
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

// Criar card de barbeiro
// function createBarberCard(barber) {
//   const card = document.createElement('div');
//   card.className = 'barber-card';
//   card.dataset.barberId = barber.id;
  
//   const initials = barber.name.split(' ').map(n => n[0]).join('').substring(0, 2);
  
//   card.innerHTML = `
//     <div class="barber-avatar">${initials}</div>
//     <div class="barber-name">${barber.name}</div>
//     <div class="barber-specialty">${barber.specialties || 'Especialista'}</div>
//   `;
  
//   card.addEventListener('click', () => selectBarber(barber));
  
//   return card;
// }
function createBarberCard(barber) {
  const card = document.createElement('div');
  card.className = 'barber-card';
  card.dataset.barberId = barber.id;

  const avatarContent = barber.avatarUrl
    ? `<img class="barber-avatar-img" src="${barber.avatarUrl}" alt="${barber.name}" />`
    : `<div class="barber-avatar-text">${barber.name.split(' ').map(n => n[0]).join('').substring(0, 2)}</div>`;

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
  
  // Remover seleção anterior
  document.querySelectorAll('.barber-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  // Selecionar novo barbeiro
  const selectedCard = document.querySelector(`[data-barber-id="${barber.id}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }
  
  appState.selectedBarber = barber;
  
  // Ativar botão continuar
  const continueBtn = document.getElementById('continueToDate');
  if (continueBtn) {
    continueBtn.disabled = false;
    continueBtn.classList.remove('disabled');
  }
  
  log('Botão continuar ativado');
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
}

// Carregar horários disponíveis - CORRIGIDO
async function loadAvailableTimes(date) {
  log('Carregando horários disponíveis para', date);

  try {
    const dateStr = date.toISOString().split('T')[0];
    const service = appState.selectedService;
    if (!service) throw new Error('Serviço não selecionado');

    // 1) Extrai a duração em minutos como inteiro
    let durationMinutes;
    if (typeof service.duration === 'string' && service.duration.endsWith('min')) {
      durationMinutes = parseInt(service.duration, 10);
    } else if (typeof service.duration === 'number') {
      durationMinutes = service.duration;
    } else {
      throw new Error(`Formato de duração inválido: ${service.duration}`);
    }

    log('Duração do serviço (minutos):', durationMinutes);

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

    // 2) Log de depuração rápido
    console.log('→ availableTimes (API):', times);

    // Renderiza
    const container = document.getElementById('timeSlotsContainer');
    const timesContainer = document.getElementById('timesContainer');
    if (!container || !timesContainer) return;

    container.innerHTML = '';
    if (times.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">Nenhum horário disponível para esta data</p>';
    } else {
      appState.availableTimes = times;
      times.forEach(time => {
        container.appendChild(createTimeSlot(time));
      });
    }

    timesContainer.style.display = 'block';

  } catch (error) {
    logError('Erro ao carregar horários', error);
    showNotification('Erro ao buscar horários disponíveis. Tente novamente.', 'error');
  }
}




// Função auxiliar para gerar slots de 20 minutos (de startTime até endTime)
function generateAllSlots(startTime, endTime) {
  const slots = [];
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  for (let time = start; time < end; time += 20) {
    slots.push(minutesToTime(time));
  }
  return slots;
}

// Atualize sua createTimeSlot para receber isAvailable e aplicar a classe e evento
function createTimeSlot(time) {
  const slot = document.createElement('div');
  slot.className = 'time-slot';
  slot.textContent = time;
  slot.dataset.time = time;

  // Apenas desabilita se o horário NÃO está disponível
  if (!appState.availableTimes.includes(time)) {
    slot.classList.add('disabled');
    slot.title = 'Horário indisponível';
    return slot;
  }

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
    // converte string ou número em Number e formata
    const priceNum = Number(appState.selectedService?.price) || 0;
    elements.price.textContent = `R$ ${priceNum.toFixed(2)}`;
  }
}


// Configurar máscara de telefone
function setupPhoneMask() {
  const phoneInput = document.getElementById('clientPhone');
  if (!phoneInput) return;

  phoneInput.addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, ''); // remove tudo que não é número

    if (value.length > 11) value = value.slice(0, 11); // limita a 11 dígitos

    if (value.length >= 2) {
      if (value.length <= 10) {
        // telefone fixo: (99) 9999-9999
        value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
      } else {
        // celular: (99) 99999-9999
        value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      }
    }

    e.target.value = value;
  });
}


// Validar formulário do cliente
function validateClientForm() {
  const firstName = document.getElementById('clientFirstName')?.value.trim();
  const lastName = document.getElementById('clientLastName')?.value.trim();
  const phone = document.getElementById('clientPhone')?.value.trim();

  const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
  const isValidPhone = phoneRegex.test(phone);

  const isValid = firstName && lastName && isValidPhone;

  const confirmBtn = document.getElementById('confirmBooking');
  if (confirmBtn) {
    confirmBtn.disabled = !isValid;
    confirmBtn.classList.toggle('disabled', !isValid);
  }

  return isValid;
}


// Confirmar agendamento - CORRIGIDO
async function confirmBooking() {
  log('Confirmando agendamento');
  
  if (!validateClientForm()) {
    showNotification('Por favor, preencha todos os campos obrigatórios', 'error');
    return;
  }
  
  // Verificar se todos os dados necessários estão disponíveis
  if (!appState.selectedService || !appState.selectedBarber || !appState.selectedDate || !appState.selectedTime) {
    logError('Dados de agendamento incompletos', {
      service: appState.selectedService,
      barber: appState.selectedBarber,
      date: appState.selectedDate,
      time: appState.selectedTime
    });
    showNotification('Dados de agendamento incompletos. Reinicie o processo.', 'error');
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
      phone: document.getElementById('clientPhone').value.trim(),
      email: document.getElementById('clientEmail')?.value.trim() || ''
    }
  };
  
  log('Dados do agendamento preparados', bookingData);
  
  try {
    // Mostrar loading
    const confirmBtn = document.getElementById('confirmBooking');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Confirmando...';
    }
    
    log('Enviando requisição para /api/appointments');
    
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(bookingData)
    });
    
    log('Resposta recebida', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (response.ok) {
      const result = await response.json();
      log('Agendamento confirmado com sucesso', result);
      
      // Atualizar dados finais
      updateFinalConfirmation(bookingData);
      
      // Ir para tela de confirmação
      goToStep(5);
      
      showNotification('Agendamento confirmado com sucesso!', 'success');
    } else {
      // Tentar ler a resposta de erro
      let errorMessage = 'Erro ao confirmar agendamento';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        logError('Erro na resposta da API', errorData);
      } catch (parseError) {
        logError('Erro ao parsear resposta de erro', parseError);
      }
      
      throw new Error(errorMessage);
    }
    
  } catch (error) {
    logError('Erro ao confirmar agendamento', error);
    
    // Verificar se é erro de rede
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      showNotification('Erro de conexão. Verifique sua internet e tente novamente.', 'error');
    } else {
      showNotification(error.message || 'Erro ao confirmar agendamento. Tente novamente.', 'error');
    }
  } finally {
    // Restaurar botão
    const confirmBtn = document.getElementById('confirmBooking');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fas fa-check me-2"></i>Confirmar Agendamento';
    }
  }
}

// Atualizar confirmação updateBookingSummary
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
    
    // Preencher formulário com dados do Google
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
// // Considerando que você já tem a lista `availableTimes` da API
// // const allPossibleSlots = generateAllSlotsForDay(start, end); 
//  function generateAllSlotsForDay(start, end) {
//   return generateAllSlots(start, end); // Usa a função que você já tem
// }
// // Ex: ['09:00', '09:30', ...]
// const bookedTimes = allPossibleSlots.filter(slot => !availableTimes.includes(slot));

// allPossibleSlots.forEach(slot => {
//   const slotDiv = document.createElement('div');
//   slotDiv.classList.add('time-slot');
//   slotDiv.textContent = slot;

//   if (bookedTimes.includes(slot)) {
//     slotDiv.classList.add('disabled');
//   } else {
//     slotDiv.addEventListener('click', () => {
//       // lógica para selecionar horário
//     });
//   }

//   container.appendChild(slotDiv);
// });

// Exportar para uso global
// window.BookingApp = {
//   state: appState,
//   config: CONFIG,
//   log,
//   logError,
//   showNotification
// };


