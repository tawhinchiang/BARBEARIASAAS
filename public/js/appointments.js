
// Variáveis globais
let selectedBarberId = '';
let openMenuId = null;
let viewAppointmentModal = null;
let editModal;
const FILTER_KEY = `adminFilters:${window.location.pathname}`;
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

document.addEventListener('DOMContentLoaded', function () {
    console.log('[ADMIN] Página de agendamentos carregada');
    restoreSavedView();

 
    // 2. Configura alternância da visualização
  const toggleBtn = document.getElementById('toggleView');
  if (!toggleBtn) {
    console.warn('[ERRO] Botão de alternância não encontrado');
  } else {
    toggleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      console.log('[DEBUG] Toggle button clicked');

      const tableView = document.getElementById('appointmentsTableView');
      const cardView = document.getElementById('appointmentsCardView');

      if (!tableView || !cardView) {
        console.warn('[WARN] Views não encontrados. Forçando visualização por tabela.');
        tableView?.classList.remove('hidden');
        cardView?.classList.add('hidden');
        return;
      }

      const isTableVisible = !tableView.classList.contains('hidden');
      console.log('[DEBUG] Current state - Table visible:', isTableVisible);
        // Inicializar modal de encaixe

      // Adicionar evento ao botão de encaixe

      if (isTableVisible) {
        tableView.classList.add('hidden');
        cardView.classList.remove('hidden');
        localStorage.setItem('appointmentsView', 'cards');
          // 🔧 Reaplica listeners para expansão
       initCardExpandables();
        console.log('[DEBUG] Switched to cards view');
      } else {
        cardView.classList.add('hidden');
        tableView.classList.remove('hidden');
        localStorage.setItem('appointmentsView', 'table');
          // 🔧 Reanexa os eventos da tabela
  initTableListeners();
  attachActionPanelListeners()
        console.log('[DEBUG] Switched to table view');
      }
    });
  }
    
const fitInForm = document.getElementById('fitInForm');
if (fitInForm) {
  fitInForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitBtn = fitInForm.querySelector('button[type="submit"]');
    const originalHtml = submitBtn.innerHTML;

    // 🔒 Bloqueia múltiplos cliques
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Salvando...
    `;

    try {
      const mode = document.getElementById('fitInMode')?.value || 'fitin'; 
      const isEncaixe = mode === 'fitin';

      const payload = {
        serviceId: document.getElementById('fitInService').value,
        barberId: document.getElementById('fitInBarber').value,
        appointmentDate: document.getElementById('fitInDate').value,
        appointmentTime: document.getElementById('fitInTime').value,
        isEncaixe,
        fitInNote: document.getElementById('fitInNote').value,
        clientData: {
          firstName: document.getElementById('fitInFirstName').value.trim(),
          lastName: document.getElementById('fitInLastName').value.trim(),
          phone: document.getElementById('fitInPhone').value.trim()
        }
      };

      const res = await fetch('/api/appointments', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        notify({
          type: 'success',
          message: isEncaixe
            ? 'Encaixe criado com sucesso!'
            : 'Agendamento criado com sucesso!'
        });

        const fitInModalEl = document.getElementById('fitInModal');
        const fitInModal = bootstrap.Modal.getInstance(fitInModalEl);
        if (fitInModal) fitInModal.hide();

        setTimeout(() => location.reload(), 600);
      } else {
        notify({
          type: 'error',
          message: data.error || 'Erro ao criar agendamento.'
        });
      }
    } catch (err) {
      console.error('[ERRO] Criando agendamento:', err);
      notify({ type: 'error', message: 'Erro ao criar agendamento.' });
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  });
}




    initModals();
    initFilterForm();
    initTableListeners();
    // attachActionPanelListeners();

    
    // Executa tarefas mais leves logo
    requestIdleCallback(() => {
    initCardExpandables();
    setDefaultDates();
    restoreFilters();

    // fase visual 1: alternar view (tabela ou cards)
  
      


    // fase visual 2: limitar tabela
      // setTimeout(() => {
      // requestAnimationFrame(() => {
      //   limitarLinhasDaTabela(10);
      //     });
      // }, 50);

    // fase visual 3: limitar cards
      setTimeout(() => {
        requestAnimationFrame(() => {
        limitarCardsPorBarbeiro(10);
        });
        },100);

    setTimeout(() => {
    attachActionPanelListeners();
    }, 200);

    });

    // Restaura a visualização salva





function initFitInTimePicker() {
  if (!window.tempusDominus) {
    console.warn('[FITIN] Tempus Dominus não encontrado — fallback para <input type="time">');
    const inp = document.getElementById('fitInTime');
    if (inp) inp.type = 'time'; // fallback seguro
    return;
  }

  const pickerEl = document.getElementById('fitInTimePicker');
  if (!pickerEl) return;

  // Evita montar 2x
  if (pickerEl._tdInstance) return;

  const instance = new tempusDominus.TempusDominus(pickerEl, {
    useCurrent: false,
    display: {
      viewMode: 'clock',
      components: {
        decades: false,
        year: false,
        month: false,
        date: false,
        hours: true,
        minutes: true,
        seconds: false
      }
    },
    localization: { hourCycle: 'h23' }
  });

  pickerEl._tdInstance = instance;
}

  // Socket.IO - Atualização em tempo real
  document.querySelectorAll('.js-no-show-appointment').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      const ok = await confirmDialog({
      title: 'Marcar como Não Compareceu',
      message: 'Confirmar marcação de não comparecimento?',
      confirmText: 'Marcar NC',
      variant: 'warning'
    });
    if (!ok) return;

      try {
        const res = await fetch(`/admin/appointments/${id}/status`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' ,
          
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        },
          body: JSON.stringify({ status: 'no_show' })
        });

        let result = {};
        try {
          result = await res.json();
        } catch (e) {
          console.warn('[WARN] Não foi possível parsear JSON da resposta');
        }

        if (res.ok && result.success !== false) {
          notify({ type: 'warning', message: 'Agendamento marcado como não compareceu.' });
          
          // await refreshAppointmentsTable(); 
          requestIdleCallback(() => refreshAppointmentsTable());
        } else {
          notify({ type: 'error', message:  result.error || 'Erro ao atualizar status.' });
         
        }

      } catch (err) {
        console.error(err);
      
        notify({ type: 'error', message: 'Erro ao marcar como não compareceu.' });
      }
    });
  });



  if (typeof io !== 'undefined') {
    const socket = io();

    socket.on('new_appointment', async (data) => {
      notify({ type: 'success', message: `Novo agendamento: <strong>${data.client}</strong> (${data.time})`  });
      
      requestIdleCallback(() => refreshAppointmentsTable());
    });

    socket.on('appointment_cancelled', async (data) => {
      console.log('[SOCKET] Agendamento cancelado:', data);
      notify({ type: 'error', message: `Agendamento cancelado: <strong>${data.client}</strong> (${data.time})` });
      
      requestIdleCallback(() => refreshAppointmentsTable());
    });


  }


});
document.addEventListener("DOMContentLoaded", () => {
  const cells = document.querySelectorAll(".js-appointment-cell[data-id]");

  cells.forEach(cell => {
    const appointmentId = cell.getAttribute("data-id");

    // 🖱️ Desktop: duplo clique
    cell.addEventListener("dblclick", () => {
      openActionPanel(appointmentId);
    });

    // 📱 Mobile: pressionar e segurar
    let pressTimer;
    cell.addEventListener("touchstart", () => {
      pressTimer = setTimeout(() => {
        openActionPanel(appointmentId);
      }, 600); // 600ms de segurar
    });

    cell.addEventListener("touchend", () => {
      clearTimeout(pressTimer);
    });
  });
});


  function populateFitInSelects() {
  loadSelectOptions('fitInService', '/api/services');
  loadSelectOptions('fitInBarber', '/api/barbers');
}
function initModals() {
  const modalElement = document.getElementById('viewModal');
  viewAppointmentModal = modalElement ? new bootstrap.Modal(modalElement) : null;
  
  const editModalElement = document.getElementById('editModal');
  editModal = editModalElement ? new bootstrap.Modal(editModalElement) : null;
  
  modalElement?.querySelector('.btn-close')?.addEventListener('click', () => viewAppointmentModal.hide());
  modalElement?.addEventListener('click', (e) => {
    if (e.target === modalElement) viewAppointmentModal.hide();
  });


const fitInModalEl = document.getElementById('fitInModal');
if (fitInModalEl) {
  // move modal para o body se estiver aninhado (resolve problemas de stacking/context)
  if (fitInModalEl.parentElement !== document.body) {
    document.body.appendChild(fitInModalEl);
    console.log('[DEBUG] #fitInModal movido para <body> para evitar problemas de stacking context');
  }

  // cria modal bootstrap e listeners (mantém populateFill etc)
  const fitInModal = new bootstrap.Modal(fitInModalEl);
  fitInModalEl.addEventListener('show.bs.modal', () => {
    populateFitInSelects();
 const timeInput = document.getElementById('fitInTime');
 timeInput.addEventListener('click', () => {
  timeInput.showPicker?.(); // Método nativo moderno
});
  const agora = new Date();
  
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');

  timeInput.min = `${horas}:${minutos}`;
  });

  const openFitInBtn = document.getElementById('openFitInBtn');
  if (openFitInBtn) {
    openFitInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        fitInModal.show();
      } catch (err) {
        console.error('[DEBUG] Erro ao abrir fitInModal:', err);
      }
    });
  }
}


  if (window.Inputmask) {
    Inputmask({ mask: "(99) 99999-9999" }).mask("#fitInPhone");
  }
}

function gerarSlotsHorarios(intervaloMinutos = 30) {
  const agora = new Date();
  const inicioHora = agora.getHours();
  const inicioMin = Math.ceil(agora.getMinutes() / intervaloMinutos) * intervaloMinutos;
  
  const slots = [];
  const fimDia = 20; // horário final do expediente, pode pegar do banco

  for (let hora = inicioHora; hora <= fimDia; hora++) {
    for (let minuto = (hora === inicioHora ? inicioMin : 0); minuto < 60; minuto += intervaloMinutos) {
      if (hora < fimDia || (hora === fimDia && minuto === 0)) {
        slots.push(
          `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
        );
      }
    }
  }
  return slots;
}



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

    localStorage.setItem(FILTER_KEY, JSON.stringify(filtersToSave));
    requestAnimationFrame(() => {
  window.location.href = `/admin/appointments?${params.toString()}`;
});
  });
}

function restoreFilters() {
  const filterForm = document.getElementById('filterForm');
  const savedFilters = JSON.parse(
     localStorage.getItem(FILTER_KEY) ||
      localStorage.getItem('adminFilters') ||'{}');
  for (const [key, value] of Object.entries(savedFilters)) {
    const el = filterForm.elements[key];
    if (el) el.value = value;
  }
}
let tableListenersAttached = false;
function initTableListeners() {
  if (tableListenersAttached) return; // evita duplicar
  tableListenersAttached = true;
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

function clearFilters() {
  // remove o novo e o legado
  localStorage.removeItem(FILTER_KEY);
  localStorage.removeItem('adminFilters');
  // recarrega sem querystring
  window.location.href = window.location.pathname;
}
// garante acessível ao onclick inline do HBS, mesmo se mudar p/ type="module"
window.clearFilters = clearFilters;


// Configurar datas padrão
function toLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function setDefaultDates() {
  const today = new Date();
  const startDate = document.getElementById('startDate');
  const endDate = document.getElementById('endDate');

  if (startDate && !startDate.value) startDate.value = toLocalYMD(today);

  if (endDate && !endDate.value) {
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    endDate.value = toLocalYMD(nextMonth);
  }
}


// Selecionar barbeiro no filtro
function selectBarber(barberId, barberName) {
  // console.log('[ADMIN] Barbeiro selecionado:', barberName);
  selectedBarberId = barberId;
  document.getElementById('selectedBarber').textContent = barberName;
}



// Toggle menu de ações
function toggleActionsMenu(appointmentId) {
  // console.log('[ADMIN] Toggle menu para agendamento:', appointmentId);

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
  // console.log('[ADMIN] Visualizando agendamento:', appointmentId);
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
  ? new Date(`${appointment.appointmentDate}T00:00:00`).toLocaleDateString('pt-BR') // sem 'Z'!
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
    // console.error('[ADMIN ERROR] Erro ao carregar agendamento:', error);
    
    notify({ type:'error', message:'Erro ao carregar detalhes do agendamento' });
  }
}






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
    notify({ type:'error', message:'Erro ao carregar dados do agendamento' });

  } finally {
    globalLoader.classList.add('d-none');
  }
}


async function confirmAppointment(appointmentId) {
  // console.log('[ADMIN] Confirmando agendamento:', appointmentId);
  closeAllMenus();

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
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) }
      });

      if (response.ok) {
       
        notify({ type:'success', message:'Agendamento confirmado com sucesso!',});
        setTimeout(() => refreshAppointmentsTable(), 300);
      } else {
        throw new Error('Erro ao confirmar agendamento');
      }
    } catch (error) {
      console.error('[ADMIN ERROR] Erro ao confirmar:', error);
      notify({ type:'error', message:'Erro ao confirmar agendamento' });
      
    }
  
}


async function completeAppointment(appointmentId) {
  // console.log('[ADMIN] Concluindo agendamento:', appointmentId);
  closeAllMenus();

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
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) }
      });

      if (response.ok) {
        notify({ type:'success', message:'Agendamento concluído com sucesso!' });
       
       setTimeout(() => refreshAppointmentsTable(), 300);
      } else {
        throw new Error('Erro ao concluir agendamento');
      }
    } catch (error) {
      console.error('[ADMIN ERROR] Erro ao concluir:', error);
      notify({ type:'error', message:'Erro ao concluir agendamento' });
     
    }
  }


async function cancelAppointment(appointmentId) {
  closeAllMenus();

  const textareaId = 'cancel-reason-input';
  const ok = await confirmDialog({
    title: 'Cancelar agendamento',
    message: `
      <label class="form-label">Motivo do cancelamento (opcional):</label>
      <textarea id="${textareaId}" class="form-control" rows="3" placeholder="Ex.: cliente solicitou"></textarea>
    `,
    confirmText: 'Cancelar',
    variant: 'danger'
  });
  if (!ok) return;

  const reason = document.getElementById(textareaId)?.value || '';

  try {
    const response = await fetch(`/admin/api/appointments/${appointmentId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
      credentials: 'include',
      body: JSON.stringify({ reason })
    });

    if (response.ok) {
      notify({ type:'success', message:'Agendamento cancelado com sucesso!' });
      setTimeout(refreshAppointmentsTable, 300);
    } else {
      notify({ type:'error', message:'Erro ao cancelar agendamento' });
    }
  } catch (err) {
    console.error(err);
    notify({ type:'error', message:'Erro ao cancelar agendamento' });
  }
}

async function deleteAppointment(appointmentId) {
  // console.log('[ADMIN] Excluindo agendamento:', appointmentId);
  closeAllMenus();

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
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
        credentials: 'include'
      });

      if (response.ok) {
        notify({ type:'success', message:'Agendamento excluído com sucesso!' });
       setTimeout(() => refreshAppointmentsTable(), 300);
      } else {
        throw new Error('Erro ao excluir agendamento');
      }
    } catch (error) {
      console.error('[ADMIN ERROR] Erro ao excluir:', error);
      notify({ type:'error', message:'Erro ao excluir agendamento' });
    }
  }


async function sendWhatsApp(appointmentId) {
  console.log('[ADMIN] Enviando WhatsApp para agendamento:', appointmentId);
  closeAllMenus();

  try {
    const response = await fetch(`/admin/appointments/${appointmentId}/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
      credentials: 'include'
    });

    if (response.ok) {

       notify({ type:'success', message:'Mensagem WhatsApp enviada com sucesso!' });      
     setTimeout(() => refreshAppointmentsTable(), 300);
    } else {
      throw new Error('Erro ao enviar WhatsApp');
    }
  } catch (error) {
    console.error('[ADMIN ERROR] Erro ao enviar WhatsApp:', error);
    notify({ type:'error', message:'Erro ao enviar mensagem WhatsApp' });
  }
}




// Utilitários
function getStatusText(status) {
  const statusMap = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    in_progress: 'Em atendimento',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    no_show: 'Não compareceu'
  };
  return statusMap[status] || status;
}


// function showNotification(message, type = 'info') {

//   const notification = document.createElement('div');
//   notification.className = `notification ${type} show`;
//   notification.textContent = message;

//   document.body.appendChild(notification);

//   setTimeout(() => {
//     notification.classList.remove('show');
//     setTimeout(() => {
//       if (document.body.contains(notification)) {
//         document.body.removeChild(notification);
//       }
//     }, 300);
//   }, 3000);
// }


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
    if (['edit-service', 'edit-barber'].includes(selectId)) {
    if (window.$ && $.fn && $.fn.select2) {
    $(select).select2({
      dropdownParent: $('#editModal'),
      width: '100%',
      placeholder: 'Selecione',
      theme: 'bootstrap-5'
    });
  } 
  else {
    console.warn('[WARN] select2/jQuery indisponível — seguindo sem aprimoramento.');
  }
}
  } catch (err) {
    console.error(`Erro ao carregar ${selectId}:`, err);
    notify({ type:'error', message:`Erro ao carregar opções para ${selectId}` });
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
      notify({ type:'success', message:'Agendamento atualizado com sucesso'});

      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      console.error('[ADMIN ERROR] Falha ao atualizar agendamento:', err);
      notify({ type:'error', message:'Erro ao atualizar agendamento' });
      
    }
  });
}



// function showToast(message, type = 'success') {
//   const toast = document.createElement('div');
//   toast.className = `toast align-items-center text-white bg-${type} border-0 show`;
//   toast.setAttribute('role', 'alert');
//   toast.setAttribute('aria-live', 'assertive');
//   toast.setAttribute('aria-atomic', 'true');
//   toast.style.position = 'fixed';
//   toast.style.top = '20px';
//   toast.style.right = '20px';
//   toast.style.zIndex = '9999';
//   toast.style.transition = 'opacity 0.5s ease-in-out';

//   toast.innerHTML = `
//     <div class="d-flex">
//       <div class="toast-body">${message}</div>
//       <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
//     </div>
//   `;

//   document.body.appendChild(toast);

//   setTimeout(() => {
//     toast.classList.remove('show');
//     toast.style.opacity = 0;
//     setTimeout(() => toast.remove(), 500);
//   }, 4000);
// }



function initCardExpandables() {
  document.querySelectorAll('.card-collapsible').forEach(card => {
    // Evita adicionar múltiplos listeners
    if (card.dataset.expandableAttached === 'true') return;

    card.addEventListener('click', function (e) {
      if (e.target.closest('.action-item')) return;
      card.classList.toggle('expanded');
    });

    card.dataset.expandableAttached = 'true';
  });
}

async function refreshAppointmentsTable() {
  const params = new URLSearchParams(window.location.search);

  // Atualiza a tabela
  const tableBody = document.querySelector('.admin-table tbody');
  if (tableBody) {
    try {
      const res = await fetch(`/admin/appointments/partial?${params.toString()}`);
      const ct = res.headers.get('content-type') || '';

      if (ct.includes('application/json')) {
        const { html } = await res.json();
        tableBody.innerHTML = html || '';
      } else {
        const html = await res.text();
        tableBody.innerHTML = html;
      }
    } catch (err) {
      console.error('[ADMIN] Erro ao atualizar a TABELA:', err);
    }
  }

  // Atualiza os cards
  const cardContainer = document.getElementById('appointmentsCardView');
  if (cardContainer) {
    try {
      const res = await fetch(`/admin/appointments/partial-cards?${params.toString()}`);
      const ct = res.headers.get('content-type') || '';

      if (ct.includes('application/json')) {
        const { html } = await res.json();
        cardContainer.innerHTML = html || '';
      } else {
        const html = await res.text();
        cardContainer.innerHTML = html;
      }

      requestAnimationFrame(() => {
        initCardExpandables();
        limitarCardsPorBarbeiro(10);
      });
    } catch (err) {
      console.error('[ADMIN] Erro ao atualizar os CARDS:', err);
    }
  }

  initTableListeners(); // reanexar eventos
   attachActionPanelListeners();
}

 function restoreSavedView() {
  const savedView = localStorage.getItem('appointmentsView');
  const tableView = document.getElementById('appointmentsTableView');
  const cardView = document.getElementById('appointmentsCardView');
  
  console.log('[DEBUG] Restoring saved view:', savedView);
  console.log('[DEBUG] Elements found:', { tableView: !!tableView, cardView: !!cardView });

 if (!tableView || !cardView) {
  console.warn('[WARN] Views não encontrados. Forçando visualização por tabela.');
  document.getElementById('appointmentsTableView')?.classList.remove('hidden');
  document.getElementById('appointmentsCardView')?.classList.add('hidden');
  return;
}

  if (savedView === 'cards') {
    tableView.classList.add('hidden');
    cardView.classList.remove('hidden');
    initCardExpandables();
    console.log('[DEBUG] Restored to cards view');
  } else {
    cardView.classList.add('hidden');
    tableView.classList.remove('hidden');
      // reaplica eventos
  initTableListeners();
  attachActionPanelListeners();
    console.log('[DEBUG] Restored to table view');
  }
}
function limitarLinhasDaTabela(qtd = 10) {
  const linhas = document.querySelectorAll('#appointmentsTableBody tr');
  if (linhas.length > qtd) {
    linhas.forEach((tr, index) => {
      if (index >= qtd) tr.classList.add('d-none');
    });

    // DEPOIS (com fallbacks)
    const container =
      document.querySelector('#appointmentsTableView .admin-card') ||
      document.querySelector('#appointmentsTableView .admin-table') ||
      document.getElementById('appointmentsTableView');
    if (!container) return; // segurança

    // Remover botões antigos
    container.querySelectorAll('.btn-ver-mais, .btn-ver-menos').forEach(btn => btn.remove());

    // Criar botão "Ver mais"
    const btnVerMais = document.createElement('button');
    btnVerMais.className = 'btn btn-outline-light d-block mx-auto mt-3 btn-ver-mais';
    btnVerMais.innerHTML = '<i class="fas fa-angle-down"></i> Ver mais';

    // Criar botão "Ver menos"
    const btnVerMenos = document.createElement('button');
    btnVerMenos.className = 'btn btn-outline-light d-block mx-auto mt-3 btn-ver-menos';
    btnVerMenos.innerHTML = '<i class="fas fa-angle-up"></i> Ver menos';

    // Ação "Ver mais"
    btnVerMais.addEventListener('click', () => {
      linhas.forEach(tr => tr.classList.remove('d-none'));
      btnVerMais.remove();
      container.appendChild(btnVerMenos);
    });

    // Ação "Ver menos"
btnVerMenos.addEventListener('click', () => {
  requestAnimationFrame(() => {
    linhas.forEach((tr, index) => {
      if (index >= qtd) {
        tr.classList.add('fade-out');
        setTimeout(() => {
          tr.classList.add('d-none');
          tr.classList.remove('fade-out');
        }, 300);
      }
    });

    const table = document.querySelector('#appointmentsTableView');
    if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });

    btnVerMenos.remove();
    container.appendChild(btnVerMais);
  });
});


    container.appendChild(btnVerMais);
  }
}

document.getElementById('pageSize')?.addEventListener('change', (e) => {
  const limit = e.target.value;
  const url = new URL(window.location.href);
  url.searchParams.set('limit', limit);
  url.searchParams.set('page', '1');
  window.location.href = url.toString();
});

document.addEventListener('click', (e) => {
  const a = e.target.closest('.pagination a[data-page]');
  if (!a) return;
  e.preventDefault();
  const page = a.dataset.page;
  const url = new URL(window.location.href);
  url.searchParams.set('page', page);
  // preserva filtros e limit existentes
  window.location.href = url.toString();
});




function limitarCardsPorBarbeiro(qtd = 10) {
  document.querySelectorAll('.card-group').forEach(group => {
    const cards = group.querySelectorAll('.card-wrapper');
    const barber = group.dataset.barber;
    const btnVerMais = document.querySelector(`.ver-mais-cards[data-barber="${barber}"]`);

    if (cards.length > qtd) {
      cards.forEach((card, i) => {
        if (i >= qtd) card.classList.add('d-none');
      });

      if (btnVerMais) {
        btnVerMais.classList.remove('d-none');
        btnVerMais.innerHTML = '<i class="fas fa-angle-down"></i> Ver mais';
        btnVerMais.addEventListener('click', () => {
          cards.forEach(card => card.classList.remove('d-none'));
          btnVerMais.classList.add('d-none');

          const btnVerMenos = document.createElement('button');
          btnVerMenos.className = 'btn btn-outline-light btn-sm mt-2 ver-menos-cards';
          btnVerMenos.setAttribute('data-barber', barber);
          btnVerMenos.innerHTML = '<i class="fas fa-angle-up"></i> Ver menos';

btnVerMenos.addEventListener('click', () => {
  requestAnimationFrame(() => {
    cards.forEach((card, i) => {
      if (i >= qtd) {
        card.classList.add('fade-out');
        setTimeout(() => {
          card.classList.add('d-none');
          card.classList.remove('fade-out');
        }, 300);
      }
    });

    const column = group.closest('.barber-column');
    if (column) column.scrollIntoView({ behavior: 'smooth', block: 'start' });

    btnVerMenos.remove();
    btnVerMais.classList.remove('d-none');
  });
});

          btnVerMais.parentElement.appendChild(btnVerMenos);
        });
      }
    }
  });
}


function attachActionPanelListeners() {
  document.querySelectorAll('.js-open-action-panel').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const id = this.dataset.id;
      console.log('[PAINEL] Clique detectado:', id);
      openActionPanel(id);
    });
  });
}



// Função para abrir o painel lateral
async function openActionPanel(id) {
  const panel = document.getElementById('actionPanel');
  const body = document.getElementById('actionPanelBody');
  if (!panel || !body) return;
   const btn = document.querySelector(`.js-open-action-panel[data-id="${id}"]`);
  if (btn) {
    btn.click(); // reaproveita a lógica já existente
  } else {
    console.warn("Botão oculto não encontrado para id:", id);
  }
  console.log('[DEBUG] Abrindo painel lateral para o ID:', id);

  try {

    const res = await fetch(`/admin/appointments/${id}`);
    const { appointment } = await res.json();
    const status = appointment.status;

    // Funções comuns sempre visíveis
    let html = `
      <button class="btn btn-outline-light w-100 mb-2 js-view-appointment" onclick="viewAppointment(${id})">
        <i class="fas fa-eye me-2"></i> Ver Detalhes
      </button>
      <button class="btn btn-outline-primary w-100 mb-2 js-edit-appointment" onclick="editAppointment(${id})">
        <i class="fas fa-pen me-2"></i> Editar
      </button>
    `;

    // Regras específicas por status
    if (status === 'pending') {
      html += `
        <button class="btn btn-outline-success w-100 mb-2 js-confirm-appointment" onclick="confirmAppointment(${id})">
          <i class="fas fa-check-circle me-2"></i> Confirmar
        </button>
      `;
    }
    if (status === 'confirmed'|| status === 'in_progress') {
      html += `
        <button class="btn btn-outline-warning w-100 mb-2 js-no-show-appointment" onclick="markNoShow(${id})">
          <i class="fas fa-user-slash me-2"></i> Não Compareceu
        </button>
      `;
    }
    if (status === 'confirmed' || status === 'in_progress') {
      html += `
        <button class="btn btn-outline-warning w-100 mb-2 js-complete-appointment" onclick="completeAppointment(${id})">
          <i class="fas fa-check me-2"></i> Concluir
        </button>
      `;
    }
    
    if (status !== 'cancelled' && status !== 'completed') {
      html += `
        <button class="btn btn-outline-danger w-100 mb-2 js-cancel-appointment" onclick="cancelAppointment(${id})">
          <i class="fas fa-times-circle me-2"></i> Cancelar
        </button>
      `;
    }

    // // WhatsApp é sempre visível
    // html += `
    //   <button class="btn btn-outline-secondary w-100 js-send-whatsapp" onclick="sendWhatsApp(${id})">
    //     <i class="fab fa-whatsapp me-2"></i> Enviar WhatsApp
    //   </button>
    // `;

    body.innerHTML = html;
    panel.classList.add('show');
  } catch (err) {
    console.error('[PAINEL] Erro ao carregar agendamento:', err);
    notify({ type:'error', message:'Erro ao carregar detalhes do agendamento' });
  }
}



// Função para fechar
function closeActionPanel() {
  const panel = document.getElementById('actionPanel');
  panel.classList.remove('show');
}

document.addEventListener('click', e => {
  // --- Encaixe ---
  const fitinBtn = e.target.closest('.js-open-fitin');
  if (fitinBtn) {
    document.getElementById('fitInMode').value = 'fitin';
    document.querySelector('#fitInModal .modal-title').textContent = 'Novo Encaixe';
    document.querySelector('#fitInForm button[type="submit"]').textContent = 'Salvar Encaixe';

    const openBtn = document.getElementById('openFitInBtn');
    if (openBtn) openBtn.click();
    return;
  }

  // --- Agendamento Normal ---
  const scheduleBtn = e.target.closest('.js-open-schedule');
  if (scheduleBtn) {
    document.getElementById('fitInMode').value = 'normal';
    document.querySelector('#fitInModal .modal-title').textContent = 'Novo Agendamento';
    document.querySelector('#fitInForm button[type="submit"]').textContent = 'Salvar Agendamento';

    const barberId = scheduleBtn.dataset.barber;
    const date = scheduleBtn.dataset.date;
    const time = scheduleBtn.dataset.time;

    const openBtn = document.getElementById('openFitInBtn');
    if (openBtn) openBtn.click();

    setTimeout(() => {
      document.getElementById('fitInBarber').value = barberId;
      document.getElementById('fitInDate').value = date;
      document.getElementById('fitInTime').value = time;
    }, 200);
  }
});




// Tornando acessível globalmente
window.openActionPanel = openActionPanel;
window.closeActionPanel = closeActionPanel;

document.addEventListener('click', function (e) {
  const panel = document.getElementById('actionPanel');
  if (panel?.classList.contains('show') && !panel.contains(e.target) && !e.target.closest('.js-open-action-panel')) {
    closeActionPanel();
  }
});