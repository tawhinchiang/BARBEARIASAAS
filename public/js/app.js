// JavaScript principal para clientes - Sistema de Agendamento
// Variáveis globais para controle do agendamento
let selectedService = null;
let selectedBarber = null;
let selectedDate = null;
let selectedTime = null;
let currentMonth = new Date();
let appointmentsCalendar = {};

// Inicialização quando página carrega
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Carregar dados iniciais
    loadServices();
    loadBarbers();
    initializeCalendar();
    loadMonthlyCalendar();
});

// Navegação entre etapas do agendamento
function nextStep(step) {
    // Validar etapa atual antes de avançar
    if (!validateCurrentStep(step - 1)) {
        return;
    }
    
    // Ocultar etapa atual
    document.querySelectorAll('.step').forEach(s => s.classList.add('d-none'));
    
    // Mostrar próxima etapa
    document.getElementById(`step${step}`).classList.remove('d-none');
    
    // Carregar dados específicos da etapa
    if (step === 4) {
        loadAvailableTimes();
    } else if (step === 5) {
        showAppointmentSummary();
    }
}

// Voltar para etapa anterior
function prevStep(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.add('d-none'));
    document.getElementById(`step${step}`).classList.remove('d-none');
}

// Validar dados da etapa atual
function validateCurrentStep(step) {
    switch(step) {
        case 1:
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const phone = document.getElementById('phone').value.trim();
            
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
    try {
        const response = await fetch('/api/services');
        const services = await response.json();
        
        const container = document.getElementById('servicesContainer');
        container.innerHTML = '';
        
        services.forEach(service => {
            const serviceCard = document.createElement('div');
            serviceCard.className = 'col-md-6 mb-3';
            serviceCard.innerHTML = `
                <div class="card service-card h-100" onclick="selectService(${service.id}, '${service.name}', ${service.price})">
                    <div class="card-body text-center">
                        <h5 class="card-title">${service.name}</h5>
                        <p class="card-text">${service.description}</p>
                        <p class="price">R$ ${parseFloat(service.price).toFixed(2)}</p>
                        <small class="text-muted">${service.duration} minutos</small>
                    </div>
                </div>
            `;
            container.appendChild(serviceCard);
        });
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        showAlert('Erro ao carregar serviços. Tente novamente.', 'error');
    }
}

// Selecionar serviço
function selectService(id, name, price) {
    selectedService = { id, name, price };
    
    // Remover seleção anterior
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Marcar como selecionado
    event.currentTarget.classList.add('selected');
    
    // Atualizar display
    document.getElementById('selectedServiceDisplay').textContent = name;
}

// Carregar lista de barbeiros disponíveis
async function loadBarbers() {
    try {
        const response = await fetch('/api/barbers');
        const barbers = await response.json();
        
        const container = document.getElementById('barbersContainer');
        container.innerHTML = '';
        
        barbers.forEach(barber => {
            const barberCard = document.createElement('div');
            barberCard.className = 'col-md-6 mb-3';
            barberCard.innerHTML = `
                <div class="card barber-card h-100" onclick="selectBarber(${barber.id}, '${barber.name}')">
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
        console.error('Erro ao carregar barbeiros:', error);
        showAlert('Erro ao carregar barbeiros. Tente novamente.', 'error');
    }
}

// Selecionar barbeiro
function selectBarber(id, name) {
    selectedBarber = { id, name };
    
    // Remover seleção anterior
    document.querySelectorAll('.barber-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Marcar como selecionado
    event.currentTarget.classList.add('selected');
    
    // Atualizar display
    document.getElementById('selectedBarberDisplay').textContent = name;
}

// Inicializar calendário
function initializeCalendar() {
    updateCalendarHeader();
    generateCalendar();
}

// Atualizar cabeçalho do calendário
function updateCalendarHeader() {
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    document.getElementById('currentMonth').textContent = 
        `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
}

// Gerar calendário do mês
function generateCalendar() {
    const calendarBody = document.getElementById('calendarBody');
    calendarBody.innerHTML = '';
    
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
            cell.className = 'calendar-day';
            
            // Verificar se é do mês atual
            if (cellDate.getMonth() !== currentMonth.getMonth()) {
                cell.classList.add('other-month');
            }
            
            // Verificar se é hoje
            const today = new Date();
            if (cellDate.toDateString() === today.toDateString()) {
                cell.classList.add('today');
            }
            
            // Verificar se é passado
            if (cellDate < today.setHours(0,0,0,0)) {
                cell.classList.add('past');
            } else {
                cell.addEventListener('click', () => selectDate(cellDate));
                cell.classList.add('available');
            }
            
            row.appendChild(cell);
        }
        
        calendarBody.appendChild(row);
    }
}

// Navegar mês anterior
function prevMonth() {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    updateCalendarHeader();
    generateCalendar();
}

// Navegar próximo mês
function nextMonth() {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    updateCalendarHeader();
    generateCalendar();
}

// Selecionar data
function selectDate(date) {
    selectedDate = date.toISOString().split('T')[0];
    
    // Remover seleção anterior
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    
    // Marcar como selecionado
    event.currentTarget.classList.add('selected');
    
    // Atualizar display
    document.getElementById('selectedDateDisplay').textContent = 
        date.toLocaleDateString('pt-BR');
}

// Carregar horários disponíveis
async function loadAvailableTimes() {
    if (!selectedBarber || !selectedDate || !selectedService) {
        return;
    }
    
    try {
        const response = await fetch(
            `/api/available-times?barberId=${selectedBarber.id}&date=${selectedDate}&serviceId=${selectedService.id}`
        );
        const data = await response.json();
        
        const container = document.getElementById('timesContainer');
        container.innerHTML = '';
        
        if (data.availableTimes.length === 0) {
            container.innerHTML = '<p class="text-center">Nenhum horário disponível para esta data.</p>';
            return;
        }
        
        data.availableTimes.forEach(time => {
            const timeButton = document.createElement('button');
            timeButton.className = 'btn btn-outline-primary time-btn';
            timeButton.textContent = time;
            timeButton.onclick = () => selectTime(time);
            container.appendChild(timeButton);
        });
    } catch (error) {
        console.error('Erro ao carregar horários:', error);
        showAlert('Erro ao carregar horários. Tente novamente.', 'error');
    }
}

// Selecionar horário
function selectTime(time) {
    selectedTime = time;
    
    // Remover seleção anterior
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-primary');
    });
    
    // Marcar como selecionado
    event.currentTarget.classList.remove('btn-outline-primary');
    event.currentTarget.classList.add('btn-primary');
    
    // Atualizar display
    document.getElementById('selectedTimeDisplay').textContent = time;
}

// Mostrar resumo do agendamento
function showAppointmentSummary() {
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const phone = document.getElementById('phone').value;
    
    document.getElementById('summaryName').textContent = `${firstName} ${lastName}`;
    document.getElementById('summaryPhone').textContent = phone;
    document.getElementById('summaryService').textContent = selectedService.name;
    document.getElementById('summaryBarber').textContent = selectedBarber.name;
    document.getElementById('summaryDate').textContent = new Date(selectedDate).toLocaleDateString('pt-BR');
    document.getElementById('summaryTime').textContent = selectedTime;
    document.getElementById('summaryPrice').textContent = `R$ ${parseFloat(selectedService.price).toFixed(2)}`;
}

// Confirmar agendamento
async function confirmAppointment() {
    const appointmentData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        phone: document.getElementById('phone').value.replace(/\D/g, ''),
        barberId: selectedBarber.id,
        serviceTypeId: selectedService.id,
        appointmentDate: selectedDate,
        appointmentTime: selectedTime
    };
    
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
            window.location.href = '/agendamento-confirmado';
        } else {
            showAlert(result.error || 'Erro ao criar agendamento', 'error');
        }
    } catch (error) {
        console.error('Erro ao confirmar agendamento:', error);
        showAlert('Erro ao confirmar agendamento. Tente novamente.', 'error');
    }
}

// Carregar calendário mensal (visualização)
async function loadMonthlyCalendar() {
    // Implementar se necessário para mostrar agendamentos existentes
}

// Função para mostrar alertas
function showAlert(message, type = 'info') {
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

