// JavaScript principal para clientes - Sistema de Agendamento CORRIGIDO
// Variáveis globais para controle do agendamento
let selectedService = null;
let selectedBarber = null;
let selectedDate = null;
let selectedTime = null;
let currentMonth = new Date();

// Inicialização quando página carrega
document.addEventListener('DOMContentLoaded', function() {
    console.log('[CLIENT] Inicializando sistema de agendamento');
    
    // Máscara para telefone brasileiro
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/(\d{2})(\d)/, '($1) $2');
            value = value.replace(/(\d{5})(\d)/, '$1-$2');
            e.target.value = value;
        });
    }
    
    // Configurar eventos dos botões de navegação do calendário
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', prevMonth);
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', nextMonth);
    
    // Carregar dados iniciais
    loadServices();
    loadBarbers();
    initializeCalendar();
});

// Navegação entre etapas do agendamento
function nextStep(step) {
    console.log(`[CLIENT] Avançando para etapa ${step}`);
    
    // Validar etapa atual antes de avançar
    if (!validateCurrentStep(step - 1)) {
        return;
    }
    
    // Ocultar etapa atual
    document.querySelectorAll('.step').forEach(s => s.classList.add('d-none'));
    
    // Mostrar próxima etapa
    const nextStepElement = document.getElementById(`step${step}`);
    if (nextStepElement) {
        nextStepElement.classList.remove('d-none');
    }
    
    // Carregar dados específicos da etapa
    if (step === 4) {
        loadAvailableTimes();
    } else if (step === 5) {
        showAppointmentSummary();
    }
}

// Voltar para etapa anterior
function prevStep(step) {
    console.log(`[CLIENT] Voltando para etapa ${step}`);
    document.querySelectorAll('.step').forEach(s => s.classList.add('d-none'));
    const stepElement = document.getElementById(`step${step}`);
    if (stepElement) {
        stepElement.classList.remove('d-none');
    }
}

// Validar dados da etapa atual
function validateCurrentStep(step) {
    console.log(`[CLIENT] Validando etapa ${step}`);
    
    switch(step) {
        case 1:
            const firstName = document.getElementById('firstName')?.value.trim();
            const lastName = document.getElementById('lastName')?.value.trim();
            const phone = document.getElementById('phone')?.value.trim();
            
            if (!firstName || !lastName || !phone) {
                showAlert('Por favor, preencha todos os campos obrigatórios.', 'warning');
                return false;
            }
            
            if (phone.length < 14) {
                showAlert('Por favor, insira um telefone válido.', 'warning');
                return false;
            }
            break;
            
        case 2:
            if (!selectedService) {
                showAlert('Por favor, selecione um serviço.', 'warning');
                return false;
            }
            break;
            
        case 3:
            if (!selectedBarber) {
                showAlert('Por favor, selecione um barbeiro.', 'warning');
                return false;
            }
            break;
            
        case 4:
            if (!selectedDate || !selectedTime) {
                showAlert('Por favor, selecione uma data e horário.', 'warning');
                return false;
            }
            break;
    }
    return true;
}

// Carregar lista de serviços disponíveis
async function loadServices() {
    console.log('[CLIENT] Carregando serviços');
    
    try {
        const response = await fetch('/api/services');
        const services = await response.json();
        
        console.log('[CLIENT] Serviços carregados:', services.length);
        
        const container = document.getElementById('servicesContainer');
        if (!container) {
            console.error('[CLIENT ERROR] Container de serviços não encontrado');
            return;
        }
        
        container.innerHTML = '';
        
        services.forEach(service => {
            const serviceCard = document.createElement('div');
            serviceCard.className = 'col-md-6 mb-3';
            serviceCard.innerHTML = `
                <div class="card service-card h-100" onclick="selectService(${service.id}, '${service.name}', ${service.price})" style="cursor: pointer;">
                    <div class="card-body text-center">
                        <h5 class="card-title">${service.name}</h5>
                        <p class="card-text">${service.description}</p>
                        <p class="price fw-bold text-primary">R$ ${parseFloat(service.price).toFixed(2)}</p>
                        <small class="text-muted">${service.duration} minutos</small>
                    </div>
                </div>
            `;
            container.appendChild(serviceCard);
        });
    } catch (error) {
        console.error('[CLIENT ERROR] Erro ao carregar serviços:', error);
        showAlert('Erro ao carregar serviços. Tente novamente.', 'error');
    }
}

// Selecionar serviço
function selectService(id, name, price) {
    console.log(`[CLIENT] Serviço selecionado: ${name}`);
    
    selectedService = { id, name, price };
    
    // Remover seleção anterior
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('selected');
        card.style.border = '';
    });
    
    // Marcar como selecionado
    event.currentTarget.classList.add('selected');
    event.currentTarget.style.border = '2px solid #0d6efd';
    
    // Ativar botão continuar
    const continueBtn = document.getElementById('continueToBarber');
    if (continueBtn) {
        continueBtn.disabled = false;
    }
}

// Carregar lista de barbeiros disponíveis
async function loadBarbers() {
    console.log('[CLIENT] Carregando barbeiros');
    
    try {
        const response = await fetch('/api/barbers');
        const barbers = await response.json();
        
        console.log('[CLIENT] Barbeiros carregados:', barbers.length);
        
        const container = document.getElementById('barbersContainer');
        if (!container) {
            console.error('[CLIENT ERROR] Container de barbeiros não encontrado');
            return;
        }
        
        container.innerHTML = '';
        
        barbers.forEach(barber => {
            const barberCard = document.createElement('div');
            barberCard.className = 'col-md-6 mb-3';
            barberCard.innerHTML = `
                <div class="card barber-card h-100" onclick="selectBarber(${barber.id}, '${barber.name}')" style="cursor: pointer;">
                    <div class="card-body text-center">
                        <h5 class="card-title">${barber.name}</h5>
                        <p class="card-text">
                            <strong>Especialidades:</strong><br>
                            ${barber.specialties.join(', ')}
                        </p>
                        <small class="text-muted">${barber.phone}</small>
                    </div>
                </div>
            `;
            container.appendChild(barberCard);
        });
    } catch (error) {
        console.error('[CLIENT ERROR] Erro ao carregar barbeiros:', error);
        showAlert('Erro ao carregar barbeiros. Tente novamente.', 'error');
    }
}

// Selecionar barbeiro
function selectBarber(id, name) {
    console.log(`[CLIENT] Barbeiro selecionado: ${name}`);
    
    selectedBarber = { id, name };
    
    // Remover seleção anterior
    document.querySelectorAll('.barber-card').forEach(card => {
        card.classList.remove('selected');
        card.style.border = '';
    });
    
    // Marcar como selecionado
    event.currentTarget.classList.add('selected');
    event.currentTarget.style.border = '2px solid #0d6efd';
    
    // Ativar botão continuar
    const continueBtn = document.getElementById('continueToDate');
    if (continueBtn) {
        continueBtn.disabled = false;
    }
}

// Inicializar calendário
function initializeCalendar() {
    console.log('[CLIENT] Inicializando calendário');
    updateCalendarHeader();
    generateCalendar();
}

// Atualizar cabeçalho do calendário
function updateCalendarHeader() {
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    const currentMonthElement = document.getElementById('currentMonth');
    if (currentMonthElement) {
        currentMonthElement.textContent = 
            `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    }
}

// Gerar calendário do mês
function generateCalendar() {
    console.log('[CLIENT] Gerando calendário');
    
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) {
        console.error('[CLIENT ERROR] Grid do calendário não encontrado');
        return;
    }
    
    // Criar estrutura do calendário
    calendarGrid.innerHTML = `
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th class="text-center">Dom</th>
                    <th class="text-center">Seg</th>
                    <th class="text-center">Ter</th>
                    <th class="text-center">Qua</th>
                    <th class="text-center">Qui</th>
                    <th class="text-center">Sex</th>
                    <th class="text-center">Sáb</th>
                </tr>
            </thead>
            <tbody id="calendarBody"></tbody>
        </table>
    `;
    
    const calendarBody = document.getElementById('calendarBody');
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        
        for (let day = 0; day < 7; day++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + (week * 7) + day);
            
            const cell = document.createElement('td');
            cell.textContent = cellDate.getDate();
            cell.className = 'calendar-day text-center p-2';
            cell.style.cursor = 'pointer';
            
            // Verificar se é do mês atual
            if (cellDate.getMonth() !== currentMonth.getMonth()) {
                cell.classList.add('text-muted');
                cell.style.cursor = 'default';
            }
            
            // Verificar se é hoje
            const today = new Date();
            if (cellDate.toDateString() === today.toDateString()) {
                cell.classList.add('bg-primary', 'text-white');
            }
            
            // Verificar se é passado
            if (cellDate < today.setHours(0,0,0,0)) {
                cell.classList.add('text-muted');
                cell.style.cursor = 'default';
            } else if (cellDate.getMonth() === currentMonth.getMonth()) {
                cell.addEventListener('click', () => selectDate(cellDate));
                cell.classList.add('calendar-available');
                cell.addEventListener('mouseenter', function() {
                    if (!this.classList.contains('selected')) {
                        this.style.backgroundColor = '#e9ecef';
                    }
                });
                cell.addEventListener('mouseleave', function() {
                    if (!this.classList.contains('selected')) {
                        this.style.backgroundColor = '';
                    }
                });
            }
            
            row.appendChild(cell);
        }
        
        calendarBody.appendChild(row);
    }
}

// Navegar mês anterior
function prevMonth() {
    console.log('[CLIENT] Navegando para mês anterior');
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    updateCalendarHeader();
    generateCalendar();
}

// Navegar próximo mês
function nextMonth() {
    console.log('[CLIENT] Navegando para próximo mês');
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    updateCalendarHeader();
    generateCalendar();
}

// Selecionar data
function selectDate(date) {
    console.log(`[CLIENT] Data selecionada: ${date.toLocaleDateString('pt-BR')}`);
    
    selectedDate = date.toISOString().split('T')[0];
    
    // Remover seleção anterior
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
        day.style.backgroundColor = '';
    });
    
    // Marcar como selecionado
    event.currentTarget.classList.add('selected');
    event.currentTarget.style.backgroundColor = '#0d6efd';
    event.currentTarget.style.color = 'white';
    
    // Carregar horários disponíveis
    loadAvailableTimes();
}

// Carregar horários disponíveis
async function loadAvailableTimes() {
    console.log('[CLIENT] Carregando horários disponíveis');
    
    if (!selectedBarber || !selectedDate || !selectedService) {
        console.log('[CLIENT] Dados incompletos para carregar horários');
        return;
    }
    
    try {
        const response = await fetch(
            `/api/available-times?barberId=${selectedBarber.id}&date=${selectedDate}&serviceId=${selectedService.id}`
        );
        const data = await response.json();
        
        console.log('[CLIENT] Horários disponíveis:', data.availableTimes);
        
        const container = document.getElementById('timeSlotsContainer');
        if (!container) {
            console.error('[CLIENT ERROR] Container de horários não encontrado');
            return;
        }
        
        container.innerHTML = '';
        
        if (data.availableTimes.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">Nenhum horário disponível para esta data.</p>';
            return;
        }
        
        const timesGrid = document.createElement('div');
        timesGrid.className = 'row g-2';
        
        data.availableTimes.forEach(time => {
            const timeCol = document.createElement('div');
            timeCol.className = 'col-6 col-md-3';
            
            const timeButton = document.createElement('button');
            timeButton.type = 'button';
            timeButton.className = 'btn btn-outline-primary w-100 time-btn';
            timeButton.textContent = time;
            timeButton.onclick = () => selectTime(time);
            
            timeCol.appendChild(timeButton);
            timesGrid.appendChild(timeCol);
        });
        
        container.appendChild(timesGrid);
    } catch (error) {
        console.error('[CLIENT ERROR] Erro ao carregar horários:', error);
        showAlert('Erro ao carregar horários. Tente novamente.', 'error');
    }
}

// Selecionar horário
function selectTime(time) {
    console.log(`[CLIENT] Horário selecionado: ${time}`);
    
    selectedTime = time;
    
    // Remover seleção anterior
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-primary');
    });
    
    // Marcar como selecionado
    event.currentTarget.classList.remove('btn-outline-primary');
    event.currentTarget.classList.add('btn-primary');
    
    // Ativar botão continuar
    const continueBtn = document.getElementById('continueToConfirm');
    if (continueBtn) {
        continueBtn.disabled = false;
    }
}

// Mostrar resumo do agendamento
function showAppointmentSummary() {
    console.log('[CLIENT] Mostrando resumo do agendamento');
    
    const firstName = document.getElementById('firstName')?.value || '';
    const lastName = document.getElementById('lastName')?.value || '';
    const phone = document.getElementById('phone')?.value || '';
    
    const summaryContainer = document.getElementById('appointmentSummary');
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Nome:</strong> ${firstName} ${lastName}</p>
                    <p><strong>Telefone:</strong> ${phone}</p>
                    <p><strong>Serviço:</strong> ${selectedService?.name || 'N/A'}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Barbeiro:</strong> ${selectedBarber?.name || 'N/A'}</p>
                    <p><strong>Data:</strong> ${selectedDate ? new Date(selectedDate).toLocaleDateString('pt-BR') : 'N/A'}</p>
                    <p><strong>Horário:</strong> ${selectedTime || 'N/A'}</p>
                    <p><strong>Valor:</strong> R$ ${selectedService ? parseFloat(selectedService.price).toFixed(2) : '0,00'}</p>
                </div>
            </div>
        `;
    }
    
    // Configurar evento de confirmação
    const confirmBtn = document.getElementById('confirmAppointment');
    if (confirmBtn) {
        confirmBtn.onclick = confirmAppointment;
    }
}

// Confirmar agendamento
async function confirmAppointment() {
    console.log('[CLIENT] Confirmando agendamento');
    
    const appointmentData = {
        firstName: document.getElementById('firstName')?.value,
        lastName: document.getElementById('lastName')?.value,
        phone: document.getElementById('phone')?.value.replace(/\D/g, ''),
        barberId: selectedBarber?.id,
        serviceTypeId: selectedService?.id,
        appointmentDate: selectedDate,
        appointmentTime: selectedTime
    };
    
    console.log('[CLIENT] Dados do agendamento:', appointmentData);
    
    try {
        const response = await fetch('/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(appointmentData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('[CLIENT] Agendamento confirmado com sucesso');
            window.location.href = '/agendamento-confirmado';
        } else {
            console.error('[CLIENT ERROR] Erro ao confirmar agendamento:', result.error);
            showAlert(result.error || 'Erro ao criar agendamento', 'error');
        }
    } catch (error) {
        console.error('[CLIENT ERROR] Erro ao confirmar agendamento:', error);
        showAlert('Erro ao confirmar agendamento. Tente novamente.', 'error');
    }
}

// Função para mostrar alertas
function showAlert(message, type = 'info') {
    console.log(`[CLIENT] Alerta: ${type} - ${message}`);
    
    const alertContainer = document.getElementById('alertContainer') || createAlertContainer();
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.appendChild(alertDiv);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Criar container de alertas
function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.maxWidth = '400px';
    document.body.appendChild(container);
    return container;
}

