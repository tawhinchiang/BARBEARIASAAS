// JAVASCRIPT MODERNO - SISTEMA DE AGENDAMENTO CLEAN
// Verificar se CONFIG já existe para evitar redeclaração
if (typeof window.BARBERSHOP_CONFIG === 'undefined') {
  // Configurações editáveis
  window.BARBERSHOP_CONFIG = {
    // ========================================
    // CONFIGURAÇÕES PARA EDITAR:
    // ========================================
    
    // WhatsApp da barbearia (apenas números)
    WHATSAPP_NUMBER: '5563992014547', // EDITE AQUI: Substitua pelo número da barbearia
    
    // Google Client ID para login
    GOOGLE_CLIENT_ID: 'SEU_GOOGLE_CLIENT_ID_AQUI', // EDITE AQUI: Substitua pelo seu Client ID
    
    // Serviços da barbearia (conforme solicitado)
    SERVICES: [
      {
        id: 1,
        name: 'CORTE DEGRADÊ',
        duration: '40min',
        price: 45.00,
        promo: 'Promo seg. a qua.',
        hasPromo: true
      },
     
      {
        id: 2,
        name: 'CORTE SOCIAL',
        duration: '40min',
        price: 30.00,
        promo: 'Promo seg. a qua.',
        hasPromo: true
      },
      {
        id: 3,
        name: 'CORTE + BARBA',
        duration: '60min',
        price: 50.00,
        promo: 'Promo seg. a qua.',
        hasPromo: true
      },
      {
        id: 4,
        name: 'BARBA + PEZINHO',
        duration: 'Tempo não definido',
        price: 25.00,
        promo: null,
        hasPromo: false
      },
       {
        id: 5,
        name: 'CORTE NAVALHADO',
        duration: '40min',
        price: 50.00,
        promo: 'Promo seg. a qua.',
        hasPromo: true
      },
      {
        id: 6,
        name: 'CORTE TESOURA',
        duration: '40min',
        price: 50.00,
        promo: null,
        hasPromo: true
      }
    ]
    
    // ========================================
    // FIM DAS CONFIGURAÇÕES EDITÁVEIS
    // ========================================
  };
}

// Usar referência global para evitar conflitos
const CONFIG = window.BARBERSHOP_CONFIG;

// Estado global da aplicação
let appState = {
  currentStep: 1,
  selectedService: null,
  selectedBarber: null,
  selectedDate: null,
  selectedTime: null,
  clientData: {},
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  availableBarbers: [],
  availableTimes: []
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

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  log('Inicializando sistema de agendamento moderno');
  
  try {
    initializeApp();
    setupEventListeners();
    loadBarbers();
    initializeCalendar();
    setupPhoneMask();
    log('Sistema inicializado com sucesso');
  } catch (error) {
    logError('Erro na inicialização', error);
  }
});

// Inicializar aplicação
function initializeApp() {
  log('Configurando aplicação');
  
  // Mostrar primeira etapa
  showStep(1);
  
  // Configurar Google Login se disponível
  if (CONFIG.GOOGLE_CLIENT_ID !== 'SEU_GOOGLE_CLIENT_ID_AQUI') {
    initializeGoogleLogin();
  }
}

// Configurar event listeners
function setupEventListeners() {
  log('Configurando event listeners');
  
  // Calendário
  document.getElementById('prevMonth')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth')?.addEventListener('click', () => changeMonth(1));
  
  // Validação em tempo real
  ['clientFirstName', 'clientLastName', 'clientPhone'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', validateClientForm);
  });
  
  // Google Login
  document.getElementById('googleLogin')?.addEventListener('click', handleGoogleLogin);
}

// Selecionar serviço
function selectService(service) {
  log('Serviço selecionado', service);
  
  // Remover seleção anterior
  document.querySelectorAll('.service-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  // Selecionar novo serviço
  const selectedCard = document.querySelector(`[data-service-id="${service.id}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }
  
  appState.selectedService = service;
  
  // Ativar botão continuar
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
  } else if (stepNumber === 3) {
    generateCalendar();
  } else if (stepNumber === 4) {
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
function createBarberCard(barber) {
  const card = document.createElement('div');
  card.className = 'barber-card';
  card.dataset.barberId = barber.id;
  
  const initials = barber.name.split(' ').map(n => n[0]).join('').substring(0, 2);
  
  card.innerHTML = `
    <div class="barber-avatar">${initials}</div>
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
    const response = await fetch(`/api/available-times?date=${dateStr}&barberId=${appState.selectedBarber.id}`);

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const data = await response.json();

    // Aqui garantimos que vem os horários certos
    const times = Array.isArray(data.availableTimes) ? data.availableTimes : [];

    const container = document.getElementById('timeSlotsContainer');
    const timesContainer = document.getElementById('timesContainer');

    if (!container || !timesContainer) return;

    container.innerHTML = '';

    if (times.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">Nenhum horário disponível para esta data</p>';
    } else {
      appState.availableTimes = times;
      times.forEach(time => {
        const timeSlot = createTimeSlot(time);
        container.appendChild(timeSlot);
      });
    }

    timesContainer.style.display = 'block';

  } catch (error) {
    logError('Erro ao carregar horários', error);
    showNotification('Erro ao buscar horários disponíveis. Tente novamente.', 'error');
  }
}


// Função auxiliar para gerar slots de 30 minutos (de startTime até endTime)
function generateAllSlots(startTime, endTime) {
  const slots = [];
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  for (let time = start; time < end; time += 30) {
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


// async function loadAvailableTimes(date) {
//   log('Carregando horários disponíveis para', date);
  
//   try {
//     const dateStr = date.toISOString().split('T')[0];
//     const response = await fetch(`/api/available-times?date=${dateStr}&barberId=${appState.selectedBarber.id}`);
    
//     if (!response.ok) {
//       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
//     }
    
//     const data = await response.json();
    
//     // Verificar se a resposta tem o formato esperado
//     let times = [];
//     if (Array.isArray(data)) {
//       times = data;
//     } else if (data.times && Array.isArray(data.times)) {
//       times = data.times;
//     } else if (data.availableTimes && Array.isArray(data.availableTimes)) {
//       times = data.availableTimes;
//     } else {
//       // Se não há horários ou formato inesperado, usar horários padrão
//       times = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
//       log('Usando horários padrão devido a formato inesperado da API');
//     }
    
//     const container = document.getElementById('timeSlotsContainer');
//     const timesContainer = document.getElementById('timesContainer');
    
//     if (!container || !timesContainer) {
//       logError('Containers de horários não encontrados');
//       return;
//     }
    
//     container.innerHTML = '';
    
//     if (times.length === 0) {
//       container.innerHTML = '<p class="text-muted text-center">Nenhum horário disponível para esta data</p>';
//     } else {
//       times.forEach(time => {
//         const timeSlot = createTimeSlot(time);
//         container.appendChild(timeSlot);
//       });
//     }
    
//     timesContainer.style.display = 'block';
//     appState.availableTimes = times;
    
//     log(`${times.length} horários carregados`);
    
//   } catch (error) {
//     logError('Erro ao carregar horários', error);
    
//     // Fallback: mostrar horários padrão
//     const defaultTimes = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
//     const container = document.getElementById('timeSlotsContainer');
//     const timesContainer = document.getElementById('timesContainer');
    
//     if (container && timesContainer) {
//       container.innerHTML = '';
//       defaultTimes.forEach(time => {
//         const timeSlot = createTimeSlot(time);
//         container.appendChild(timeSlot);
//       });
//       timesContainer.style.display = 'block';
//       appState.availableTimes = defaultTimes;
      
//       showNotification('Carregando horários padrão. Verifique disponibilidade.', 'warning');
//     }
//   }
// }


// Criar slot de horário
// function createTimeSlot(time, isAvailable = true) {
//   const slot = document.createElement('div');
//   slot.className = 'time-slot';
//   slot.textContent = time;
//   slot.dataset.time = time;

//   if (!isAvailable) {
//     slot.classList.add('disabled-time');  // classe visual para desabilitado
//   } else {
//     slot.addEventListener('click', () => selectTime(time));
//   }

//   return slot;
// }


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
  
  if (elements.service) elements.service.textContent = appState.selectedService?.name || '-';
  if (elements.barber) elements.barber.textContent = appState.selectedBarber?.name || '-';
  if (elements.date) elements.date.textContent = appState.selectedDate?.toLocaleDateString('pt-BR') || '-';
  if (elements.time) elements.time.textContent = appState.selectedTime || '-';
  if (elements.duration) elements.duration.textContent = appState.selectedService?.duration || '-';
  if (elements.price) elements.price.textContent = `R$ ${appState.selectedService?.price?.toFixed(2) || '0,00'}`;
}

// Configurar máscara de telefone
function setupPhoneMask() {
  const phoneInput = document.getElementById('clientPhone');
  if (!phoneInput) return;
  
  phoneInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
      value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      if (value.length < 14) {
        value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
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
  
  const isValid = firstName && lastName && phone && phone.length >= 14;
  
  const confirmBtn = document.getElementById('confirmBooking');
  if (confirmBtn) {
    confirmBtn.disabled = !isValid;
    if (isValid) {
      confirmBtn.classList.remove('disabled');
    } else {
      confirmBtn.classList.add('disabled');
    }
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
  if (elements.price) elements.price.textContent = `R$ ${appState.selectedService.price.toFixed(2)}`;
}

// // Enviar confirmação via WhatsApp
// function sendWhatsAppConfirmation() {
//   log('Enviando confirmação via WhatsApp');
  
//   const message = `Olá! Gostaria de confirmar meu agendamento:

// 🔸 *Serviço:* ${appState.selectedService.name}
// 🔸 *Barbeiro:* ${appState.selectedBarber.name}
// 🔸 *Data:* ${appState.selectedDate.toLocaleDateString('pt-BR')}
// 🔸 *Horário:* ${appState.selectedTime}
// 🔸 *Cliente:* ${document.getElementById('clientFirstName').value} ${document.getElementById('clientLastName').value}
// 🔸 *Valor:* R$ ${appState.selectedService.price.toFixed(2)}

// Aguardo confirmação. Obrigado!`;
  
//   const encodedMessage = encodeURIComponent(message);
//   const whatsappUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodedMessage}`;
  
//   window.open(whatsappUrl, '_blank');
// }

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
// Considerando que você já tem a lista `availableTimes` da API
const allPossibleSlots = generateAllSlotsForDay(start, end); // Ex: ['09:00', '09:30', ...]
const bookedTimes = allPossibleSlots.filter(slot => !availableTimes.includes(slot));

allPossibleSlots.forEach(slot => {
  const slotDiv = document.createElement('div');
  slotDiv.classList.add('time-slot');
  slotDiv.textContent = slot;

  if (bookedTimes.includes(slot)) {
    slotDiv.classList.add('disabled');
  } else {
    slotDiv.addEventListener('click', () => {
      // lógica para selecionar horário
    });
  }

  container.appendChild(slotDiv);
});

// Exportar para uso global
window.BookingApp = {
  state: appState,
  config: CONFIG,
  log,
  logError,
  showNotification
};

