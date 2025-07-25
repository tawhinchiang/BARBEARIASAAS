
 // Variáveis globais
let selectedBarberId = '';
let openMenuId = null;
// No topo do seu <script>, junto com as outras variáveis
let viewAppointmentModal = null;
let editModal;
document.addEventListener('DOMContentLoaded', function () {
  console.log('[ADMIN] Página de agendamentos carregada');

  initModals();
  initFilterForm();
  initTableListeners();
  // initJQueryHandlers();
  // Executa tarefas mais leves logo
  requestIdleCallback(() => {
    setDefaultDates();
    restoreFilters();
  });

  // Socket.IO - Atualização em tempo real
document.querySelectorAll('.js-no-show-appointment').forEach(button => {
  button.addEventListener('click', async () => {
    const id = button.dataset.id;
    if (!confirm('Marcar como "não compareceu"?')) return;

    try {
      const res = await fetch(`/admin/appointments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'no_show' })
      });

      let result = {};
      try {
        result = await res.json();
      } catch (e) {
        console.warn('[WARN] Não foi possível parsear JSON da resposta');
      }

      if (res.ok && result.success !== false) {
        showToast('Agendamento marcado como não compareceu.', 'warning');
        await refreshAppointmentsTable(); // ✅ Correto
      } else {
        alert(result.error || 'Erro ao atualizar status.');
      }

    } catch (err) {
      console.error(err);
      alert('Erro ao marcar como não compareceu.');
    }
  });
});



if (typeof io !== 'undefined') {
  const socket = io();

  socket.on('new_appointment', async (data) => {
    
    showToast(`✅ Novo agendamento de <strong>${data.client}</strong> às <strong>${data.time}</strong>`, 'success');
    await refreshAppointmentsTable();
  });

  socket.on('appointment_cancelled', async (data) => {
    console.log('[SOCKET] Agendamento cancelado:', data);
    showToast(`❌ Agendamento cancelado: <strong>${data.client}</strong> (${data.time})`, 'danger');
    await refreshAppointmentsTable();
  });


}


});

function initModals() {
  const modalElement = document.getElementById('viewModal');
  viewAppointmentModal = modalElement ? new bootstrap.Modal(modalElement) : null;

  const editModalElement = document.getElementById('editModal');
  editModal = editModalElement ? new bootstrap.Modal(editModalElement) : null;

  modalElement?.querySelector('.btn-close')?.addEventListener('click', () => viewAppointmentModal.hide());

  modalElement?.addEventListener('click', (e) => {
    if (e.target === modalElement) viewAppointmentModal.hide();
  });
}
// function initJQueryHandlers() {
//   $('.js-toggle-actions').on('click', function (e) {
//     e.preventDefault();
//     const id = $(this).data('id');
//     const menu = $('#actions-' + id);
//     const parent = $(this).closest('.actions-menu');

//     $('.actions-menu').not(parent).removeClass('show');
//     parent.toggleClass('show');
//   });

//   $(document).on('click', function (e) {
//     if (!$(e.target).closest('.actions-menu').length) {
//       $('.actions-menu').removeClass('show');
//     }
//   });
// }

function initFilterForm() {
  const filterForm = document.getElementById('filterForm');
  if (!filterForm) return;

  filterForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const formData = new FormData(filterForm);
    const params = new URLSearchParams();
    const filtersToSave = {};

    for (const [key, value] of formData.entries()) {
      if (value) {
        params.append(key, value);
        filtersToSave[key] = value;
      }
    }

    localStorage.setItem('adminFilters', JSON.stringify(filtersToSave));
    window.location.href = `/admin/appointments?${params.toString()}`;
  });
}

function restoreFilters() {
  const filterForm = document.getElementById('filterForm');
  const savedFilters = JSON.parse(localStorage.getItem('adminFilters') || '{}');

  for (const [key, value] of Object.entries(savedFilters)) {
    const el = filterForm.elements[key];
    if (el) el.value = value;
  }
}

function initTableListeners() {
  document.addEventListener('click', async function (event) {
    const button = event.target.closest('button');
    if (!button || !button.classList.contains('action-item')) return;

    const appointmentId = button.dataset.id;
    if (!appointmentId || isNaN(Number(appointmentId))) {
      console.error('[ADMIN] ID inválido:', appointmentId);
      return;
    }

    closeAllMenus();

    if (button.classList.contains('js-toggle-actions')) toggleActionsMenu(appointmentId);
    else if (button.classList.contains('js-view-appointment')) viewAppointment(appointmentId);
    else if (button.classList.contains('js-edit-appointment')) editAppointment(appointmentId);
    else if (button.classList.contains('js-send-whatsapp')) sendWhatsApp(appointmentId);
    else if (button.classList.contains('js-confirm-appointment')) confirmAppointment(appointmentId);
    else if (button.classList.contains('js-complete-appointment')) completeAppointment(appointmentId);
    else if (button.classList.contains('js-cancel-appointment')) cancelAppointment(appointmentId);
  });
}
document.addEventListener('click', function (e) {
  if (!e.target.closest('.actions-menu')) {
    closeAllMenus();
  }
});

 window.clearFilters = function () {
    localStorage.removeItem('adminFilters');
    window.location.href = window.location.pathname;
  };



// Configurar datas padrão
function setDefaultDates() {
  const today = new Date();
  const startDate = document.getElementById('startDate');
  const endDate = document.getElementById('endDate');
  
  if (startDate && !startDate.value) {
    startDate.value = today.toISOString().split('T')[0];
  }
  
  if (endDate && !endDate.value) {
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    endDate.value = nextMonth.toISOString().split('T')[0];
  }
}

// Selecionar barbeiro no filtro
function selectBarber(barberId, barberName) {
  console.log('[ADMIN] Barbeiro selecionado:', barberName);
  selectedBarberId = barberId;
  document.getElementById('selectedBarber').textContent = barberName;
}



// Toggle menu de ações
function toggleActionsMenu(appointmentId) {
  console.log('[ADMIN] Toggle menu para agendamento:', appointmentId);
  
  // Fechar outros menus
  if (openMenuId && openMenuId !== appointmentId) {
    closeMenu(openMenuId);
  }
  
  const menu = document.getElementById(`actions-${appointmentId}`);
  if (menu) {
    const isOpen = menu.classList.contains('show');
    
    if (isOpen) {
      closeMenu(appointmentId);
    } else {
      openMenu(appointmentId);
    }
  }
}

// Abrir menu
function openMenu(appointmentId) {
  const menu = document.getElementById(`actions-${appointmentId}`);
  if (menu) {
    menu.classList.add('show');
    openMenuId = appointmentId;
  }
}

// Fechar menu
function closeMenu(appointmentId) {
  const menu = document.getElementById(`actions-${appointmentId}`);
  if (menu) {
    menu.classList.remove('show');
    if (openMenuId === appointmentId) {
      openMenuId = null;
    }
  }
}

// Fechar todos os menus
function closeAllMenus() {
  document.querySelectorAll('.actions-dropdown').forEach(menu => {
    menu.classList.remove('show');
  });
  openMenuId = null;
}

// Visualizar agendamento
function createParagraph(label, value) {
  const p = document.createElement('p');
  p.innerHTML = `<strong>${label}:</strong> ${value}`;
  return p;
}

async function viewAppointment(appointmentId) {
  console.log('[ADMIN] Visualizando agendamento:', appointmentId);
  closeAllMenus();

  try {
    const response = await fetch(`/admin/appointments/${appointmentId}`);
    const result = await response.json();

    if (!result.success) throw new Error('Agendamento não encontrado');

    const { appointment } = result;
    const client = appointment.client || {};
    const service = appointment.serviceType || {};
    const barber = appointment.barber || {};
    const appointmentDate = appointment.appointmentDate
      ? new Date(appointment.appointmentDate).toLocaleDateString('pt-BR')
      : '—';
    const appointmentTime = appointment.appointmentTime || '—';
    const totalPrice = appointment.totalPrice
      ? Number(appointment.totalPrice).toFixed(2)
      : '0.00';

    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = ''; // limpa

    const row = document.createElement('div');
    row.className = 'row';

    const colClient = document.createElement('div');
    colClient.className = 'col-md-6';
    colClient.innerHTML = `<h6 class="mb-3">Informações do Cliente</h6>`;
    colClient.appendChild(createParagraph('Nome', `${client.firstName || ''} ${client.lastName || ''}`));
    colClient.appendChild(createParagraph('Telefone', client.phone || 'Não informado'));
    colClient.appendChild(createParagraph('Email', client.email || 'Não informado'));

    const colDetails = document.createElement('div');
    colDetails.className = 'col-md-6';
    colDetails.innerHTML = `<h6 class="mb-3">Detalhes do Agendamento</h6>`;
    colDetails.appendChild(createParagraph('Serviço', service.name || '—'));
    colDetails.appendChild(createParagraph('Barbeiro', barber.name || '—'));
    colDetails.appendChild(createParagraph('Data', appointmentDate));
    colDetails.appendChild(createParagraph('Horário', appointmentTime));
    colDetails.appendChild(createParagraph('Status',
      `<span class="status-badge status-${appointment.status}">${getStatusText(appointment.status)}</span>`));
    colDetails.appendChild(createParagraph('Valor', `R$ ${totalPrice}`));

    row.appendChild(colClient);
    row.appendChild(colDetails);
    modalContent.appendChild(row);

    if (appointment.notes) {
      const notesDiv = document.createElement('div');
      notesDiv.className = 'mt-3';
      notesDiv.innerHTML = `<h6>Observações:</h6><p>${appointment.notes}</p>`;
      modalContent.appendChild(notesDiv);
    }

    viewAppointmentModal?.show();
  } catch (error) {
    console.error('[ADMIN ERROR] Erro ao carregar agendamento:', error);
    showNotification('Erro ao carregar detalhes do agendamento', 'error');
  }
}





// Outras funções (editar, confirmar, cancelar, etc.)
async function editAppointment(appointmentId) {
  closeAllMenus();

  const globalLoader = document.getElementById('global-loading');
  globalLoader.classList.remove('d-none');

  try {
    await new Promise(requestAnimationFrame);

    const res = await fetch(`/admin/appointments/${appointmentId}`);
    const { appointment } = await res.json();

    document.getElementById('edit-id').value = appointment.id;
    document.getElementById('edit-client-name').value = `${appointment.client.firstName} ${appointment.client.lastName}`;
    document.getElementById('edit-client-phone').value = appointment.client.phone;
    document.getElementById('edit-date').value = appointment.appointmentDate;
    document.getElementById('edit-time').value = appointment.appointmentTime.slice(0, 5);

    await loadSelectOptions('edit-service', '/api/services', appointment.serviceType.id);
    await loadSelectOptions('edit-barber', '/api/barbers', appointment.barber.id);

    editModal.show();
  } catch (err) {
    console.error('[ADMIN ERROR] Erro ao carregar agendamento:', err);
    showNotification('Erro ao carregar dados do agendamento', 'error');
  } finally {
    globalLoader.classList.add('d-none');
  }
}


async function confirmAppointment(appointmentId) {
  console.log('[ADMIN] Confirmando agendamento:', appointmentId);
  closeAllMenus();
  
  if (confirm('Confirmar este agendamento?')) {
    try {
      const response = await fetch(`/admin/appointments/${appointmentId}/confirm`, {
        method: 'POST'
      });
      
      if (response.ok) {
        showNotification('Agendamento confirmado com sucesso!', 'success');
        setTimeout(() => location.reload(), 1500);
      } else {
        throw new Error('Erro ao confirmar agendamento');
      }
    } catch (error) {
      console.error('[ADMIN ERROR] Erro ao confirmar:', error);
      showNotification('Erro ao confirmar agendamento', 'error');
    }
  }
}


async function completeAppointment(appointmentId) {
  console.log('[ADMIN] Concluindo agendamento:', appointmentId);
  closeAllMenus();
  
  if (confirm('Marcar este agendamento como concluído?')) {
    try {
      const response = await fetch(`/admin/appointments/${appointmentId}/complete`, {
        method: 'POST'
      });
      
      if (response.ok) {
        showNotification('Agendamento concluído com sucesso!', 'success');
        setTimeout(() => location.reload(), 1500);
      } else {
        throw new Error('Erro ao concluir agendamento');
      }
    } catch (error) {
      console.error('[ADMIN ERROR] Erro ao concluir:', error);
      showNotification('Erro ao concluir agendamento', 'error');
    }
  }
}

async function cancelAppointment(appointmentId) {
  console.log('[ADMIN] Cancelando agendamento:', appointmentId);
  closeAllMenus();
  
  const reason = prompt('Motivo do cancelamento (opcional):');
  if (reason !== null) {
    try {
       console.log('[DEBUG] Disparando cancelamento...');
      const response = await fetch(`/admin/api/appointments/${appointmentId}/cancel`, {

        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      
      if (response.ok) {
        showNotification('Agendamento cancelado com sucesso!', 'success');
        setTimeout(() => location.reload(), 1500);
      } else {
        throw new Error('Erro ao cancelar agendamento');
      }
    } catch (error) {
      console.error('[ADMIN ERROR] Erro ao cancelar:', error);
      showNotification('Erro ao cancelar agendamento', 'error');
    }
  }
}

async function deleteAppointment(appointmentId) {
  console.log('[ADMIN] Excluindo agendamento:', appointmentId);
  closeAllMenus();
  
  if (confirm('ATENÇÃO: Esta ação não pode ser desfeita. Excluir este agendamento?')) {
    try {
      const response = await fetch(`/admin/appointments/${appointmentId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        showNotification('Agendamento excluído com sucesso!', 'success');
        setTimeout(() => location.reload(), 1500);
      } else {
        throw new Error('Erro ao excluir agendamento');
      }
    } catch (error) {
      console.error('[ADMIN ERROR] Erro ao excluir:', error);
      showNotification('Erro ao excluir agendamento', 'error');
    }
  }
}

async function sendWhatsApp(appointmentId) {
  console.log('[ADMIN] Enviando WhatsApp para agendamento:', appointmentId);
  closeAllMenus();
  
  try {
    const response = await fetch(`/admin/appointments/${appointmentId}/whatsapp`, {
      method: 'POST'
    });
    
    if (response.ok) {
      showNotification('Mensagem WhatsApp enviada com sucesso!', 'success');
      setTimeout(() => location.reload(), 1500);
    } else {
      throw new Error('Erro ao enviar WhatsApp');
    }
  } catch (error) {
    console.error('[ADMIN ERROR] Erro ao enviar WhatsApp:', error);
    showNotification('Erro ao enviar mensagem WhatsApp', 'error');
  }
}

function exportAppointments() {
  console.log('[ADMIN] Exportando agendamentos');

  const startDate = document.getElementById('startDate')?.value;
  const endDate = document.getElementById('endDate')?.value;
  const status = document.getElementById('statusFilter')?.value;
  const barberId = document.getElementById('barberId')?.value;

  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (barberId) params.append('barberId', barberId);
  if (status) params.append('status', status);
  params.append('export', 'csv');

  window.open(`/admin/appointments?${params.toString()}`, '_blank');
}


// Utilitários
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

function showNotification(message, type = 'info') {

    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
}


async function loadSelectOptions(selectId, endpoint, selectedId) {
  try {
    const res = await fetch(endpoint);
    const dataRaw = await res.json();

    const data = Array.isArray(dataRaw) ? dataRaw : dataRaw.services || dataRaw.barbers || [];

    const select = document.getElementById(selectId);
    select.innerHTML = '';

    data.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      if (item.id === selectedId) option.selected = true;
      select.appendChild(option);
    });
    if (selectId === 'edit-service' || selectId === 'edit-barber') {
  $(select).select2({
    dropdownParent: $('#editModal'),
    width: '100%',
    placeholder: 'Selecione',
    theme: 'bootstrap-5'
  });
}
  } catch (err) {
    console.error(`Erro ao carregar ${selectId}:`, err);
    showNotification(`Erro ao carregar ${selectId}`, 'error');
  }
}

function exportAppointments() {
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportando...';
  }

  const startDate = document.getElementById('startDate')?.value;
  const endDate = document.getElementById('endDate')?.value;
  const status = document.getElementById('statusFilter')?.value;
  const barberId = document.getElementById('barberId')?.value;

  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (barberId) params.append('barberId', barberId);
  if (status) params.append('status', status);
  params.append('export', 'csv');

  window.open(`/admin/appointments?${params.toString()}`, '_blank');

  if (btn) {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-download"></i> Exportar';
    }, 2000);
  }
}

const editForm = document.getElementById('editAppointmentForm');
if (editForm) {
  editForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const id = document.getElementById('edit-id').value;
    const payload = {
      appointmentDate: document.getElementById('edit-date').value,
      appointmentTime: document.getElementById('edit-time').value,
      barberId: document.getElementById('edit-barber').value,
      serviceTypeId: document.getElementById('edit-service').value
    };

    try {
      const response = await fetch(`/admin/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Erro ao atualizar');

      showNotification('Agendamento atualizado com sucesso', 'success');
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      console.error('[ADMIN ERROR] Falha ao atualizar agendamento:', err);
      showNotification('Erro ao atualizar agendamento', 'error');
    }
  });
}



function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type} border-0 show`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.right = '20px';
  toast.style.zIndex = '9999';
  toast.style.transition = 'opacity 0.5s ease-in-out';

  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('show');
    toast.style.opacity = 0;
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}


async function refreshAppointmentsTable() {
  const tableBody = document.querySelector('.admin-table tbody');
  if (!tableBody) return;

  const params = new URLSearchParams(window.location.search);

  try {
    const response = await fetch(`/admin/appointments/partial?${params.toString()}`);
    const html = await response.text();
    tableBody.innerHTML = html;

    initTableListeners(); // reanexar eventos
    // initJQueryHandlers(); // menu dropdown
  } catch (err) {
    console.error('[ADMIN] Erro ao atualizar a tabela:', err);
  }
}

