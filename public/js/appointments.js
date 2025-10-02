
// Variáveis globais
let selectedBarberId = '';
let openMenuId = null;
let viewAppointmentModal = null;
let editModal;
const FILTER_KEY = `adminFilters:${window.location.pathname}`;
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

document.addEventListener('DOMContentLoaded', function () {
  console.log('[ADMIN] Página de agendamentos carregada');

  const filterBtn = document.getElementById('filterToggleBtn');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      const collapseEl = document.getElementById('filtersCollapse');
      const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false });
      bsCollapse.toggle();
    });
  }


  document.addEventListener('click', e => {
    const cell = e.target.closest('.js-appointment-cell[data-id]');
    if (!cell) return;


    if (cell.querySelector('.slot-blocked') || cell.querySelector('.slot-free')) return;

    const id = cell.dataset.id;



    openActionPanel(id);
  });





  document.querySelectorAll('.prevDay').forEach(btn => {
    btn.addEventListener('click', () => changeDay(-1));
  });

  document.querySelectorAll('.nextDay').forEach(btn => {
    btn.addEventListener('click', () => changeDay(1));
  });

  function changeDay(offset) {
    const url = new URL(window.location.href);

    // pega startDate atual ou hoje
    const currentDate = url.searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + offset);

    const formatted = newDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // atualiza a querystring
    url.searchParams.set('startDate', formatted);
    url.searchParams.delete('endDate'); // garante que não trave em intervalo

    window.location.href = url.toString();
  }


  const fitInForm = document.getElementById('fitInForm');
  if (fitInForm) {
    fitInForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const submitBtn = fitInForm.querySelector('button[type="submit"]');
      const originalHtml = submitBtn.innerHTML;

      
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
          await new Promise(r => setTimeout(r, 150));
          
          document.body.classList.remove('modal-open');
          document.body.style.removeProperty('padding-right');
          document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());

          // agora pode atualizar a tabela
          await refreshAppointmentsTable(Date.now());
          try { closeActionPanel(); } catch {}
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
  // iOS-safe: delegação por click para slots livres/bloqueados + fallback no <td>
  (function wireSlotClicks() {
    const handleFree = (el) => {
      openActionPanelForEmptySlot({
        barberId: el.dataset.barber,
        date: el.dataset.date,
        time: el.dataset.time
      });
    };

    const handleBlocked = (el) => {
      const appointmentId = el.dataset.id;
      if (appointmentId) openActionPanelForBlockedSlot(appointmentId);
    };

    document.addEventListener('click', (e) => {
      // 1) clique direto no slot livre
      const free = e.target.closest('.slot-free.js-open-schedule');
      if (free) {
        handleFree(free);
        return;
      }

      // 2) clique direto no slot bloqueado
      const blocked = e.target.closest('.slot-blocked.js-open-blocked');
      if (blocked) {
        handleBlocked(blocked);
        return;
      }

      // 3) fallback: clique no <td> que contenha um dos slots
      const td = e.target.closest('td');
      if (!td) return;

      const freeInside = td.querySelector('.slot-free.js-open-schedule');
      if (freeInside) {
        handleFree(freeInside);
        return;
      }

      const blockedInside = td.querySelector('.slot-blocked.js-open-blocked');
      if (blockedInside) {
        handleBlocked(blockedInside);
      }
    }, { passive: true });
  })();


  // Executa tarefas mais leves logo
  requestIdleCallback(() => {

    setDefaultDates();
    restoreFilters();




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
          headers: {
            'Content-Type': 'application/json',

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
          notify({ type: 'error', message: result.error || 'Erro ao atualizar status.' });

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
      if (!window.__justCreated) {
        notify({ type: 'success', message: `Novo agendamento: <strong>${data.client}</strong> (${data.time})` });
      }
      window.__justCreated = false;
      requestIdleCallback(() => refreshAppointmentsTable());
    });

    socket.on('appointment_cancelled', async (data) => {

      if (window.__justCancelledId && Number(window.__justCancelledId) === Number(data.id)) {
        window.__justCancelledId = undefined;
      } else {

        notify({
          type: 'info',
          message: `Agendamento cancelado: <strong>${data.client}</strong> (${data.time})`
        });
      }

      requestIdleCallback(() => refreshAppointmentsTable());
    });


  }


});

function abrirModalAgendamento(scheduleBtn) {
  document.getElementById('fitInMode').value = 'normal';
  document.querySelector('#fitInModal .modal-title').textContent = 'Novo Agendamento';
  document.querySelector('#fitInForm button[type="submit"]').textContent = 'Salvar Agendamento';

  const barberId = scheduleBtn.dataset.barber;
  const date = scheduleBtn.dataset.date;
  const time = scheduleBtn.dataset.time;

const fitInModalEl = document.getElementById('fitInModal');
const fitInModal = bootstrap.Modal.getOrCreateInstance(fitInModalEl);
fitInModal.show();

  setTimeout(() => {
    document.getElementById('fitInBarber').value = barberId;
    document.getElementById('fitInDate').value = date;
    document.getElementById('fitInTime').value = time;
  }, 200);
}

function ensureActionPanelSkeleton() {
  const panel = document.getElementById('actionPanel');
  if (!panel) return null;

  // tenta achar estrutura existente
  let header = panel.querySelector('.action-slideout-header');
  let titleEl = panel.querySelector('.action-slideout-header h5');
  let body = panel.querySelector('#actionPanelBody');

  // se já existe, reutiliza
  if (header && titleEl && body) {
    return { panel, header, titleEl, body };
  }

  // (re)cria estrutura mínima
  panel.innerHTML = `
    <div class="action-slideout-header">
      <h5></h5>
      <button type="button" class="btn-close" aria-label="Fechar"></button>
    </div>
    <div id="actionPanelBody" class="action-slideout-body"></div>
  `;

  panel.querySelector('.btn-close').addEventListener('click', () => {
    panel.classList.remove('show');
  });

  header = panel.querySelector('.action-slideout-header');
  titleEl = header.querySelector('h5');
  body = panel.querySelector('#actionPanelBody');

  return { panel, header, titleEl, body };
}

function openActionPanelForEmptySlot({ barberId, date, time }) {
  console.log('[DEBUG] Abrindo painel slot livre:', { barberId, date, time });

  closeAllMenus?.();
  const s = ensureActionPanelSkeleton();
  if (!s) return;
  const { panel, titleEl, body } = s;

  titleEl.textContent = `Ações para ${time}`;
  body.innerHTML = `
    <button class="btn btn-primary w-100 mb-2" id="actionNewAppointment">
      <i class="fa fa-calendar-plus"></i> Agendar horário
    </button>
    <button class="btn btn-danger w-100" id="actionBlockSlot">
      <i class="fa fa-ban"></i> Bloquear horário
    </button>
  `;

  body.querySelector('#actionNewAppointment').addEventListener('click', () => {
    panel.classList.remove('show');

    const free = document.querySelector(
      `.slot-free[data-barber="${barberId}"][data-date="${date}"][data-time="${time}"]`
    );
    if (free) {
      abrirModalAgendamento(free);
    } else {
      const fakeBtn = document.createElement('div');
      fakeBtn.dataset.barber = barberId;
      fakeBtn.dataset.date = date;
      fakeBtn.dataset.time = time;
      abrirModalAgendamento(fakeBtn);
    }
  });

  body.querySelector('#actionBlockSlot').addEventListener('click', async () => {
    panel.classList.remove('show');
    const ok = await confirmDialog({
      title: 'Bloquear horário',
      message: `Deseja bloquear o horário <b>${time}</b> em ${date}?`,
      confirmText: 'Bloquear',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      const res = await fetch('/admin/api/appointments/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(ADMIN_CSRF ? { 'X-CSRF-Token': ADMIN_CSRF } : {}) },
        credentials: 'include',
        body: JSON.stringify({ barberId, appointmentDate: date, appointmentTime: time })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        notify({ type: 'success', message: 'Horário bloqueado com sucesso!' });
        window.__justBlocked = true;

        await refreshAppointmentsTable(Date.now());
      } else {
        notify({ type: 'error', message: result.error || 'Erro ao bloquear horário' });
      }
    } catch (err) {
      console.error(err);
      notify({ type: 'error', message: 'Falha na requisição de bloqueio' });
    }
  });

  panel.classList.add('show');
}

async function openActionPanelForBlockedSlot(appointmentId) {
  console.log('[DEBUG] Abrindo painel slot bloqueado:', appointmentId);

  const s = ensureActionPanelSkeleton();
  if (!s) return;
  const { panel, titleEl, body } = s;

  titleEl.textContent = 'Horário bloqueado';
  body.innerHTML = `
    <button class="btn btn-warning w-100" id="actionUnblockSlot">
      <i class="fa fa-unlock"></i> Desbloquear horário
    </button>
  `;

  body.querySelector('#actionUnblockSlot').addEventListener('click', async () => {
    closeActionPanel?.(); // fecha antes do dialog
    await new Promise(requestAnimationFrame);

    const ok = await confirmDialog({
      title: 'Desbloquear horário',
      message: 'Deseja liberar este horário para novos agendamentos?',
      confirmText: 'Desbloquear',
      variant: 'warning'
    });
    if (!ok) return;

    try {
      const res = await fetch(`/admin/api/appointments/${appointmentId}/unblock`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
        credentials: 'include'
      });
      const result = await res.json();
      if (res.ok && result.success) {
        notify({ type: 'success', message: 'Horário desbloqueado com sucesso!' });
        window.__justUnblocked = true;
        await refreshAppointmentsTable(Date.now());
      } else {
        notify({ type: 'error', message: result.error || 'Erro ao desbloquear horário' });
      }
    } catch (err) {
      console.error('[ERRO] Desbloquear slot:', err);
      notify({ type: 'error', message: 'Falha ao desbloquear horário' });
    }
  });

  panel.classList.add('show');
}

function populateFitInSelects() {
  loadSelectOptions('fitInService', '/api/services');
  loadSelectOptions('fitInBarber', '/api/barbers');
}

function initModals() {
  const modalElement = document.getElementById('viewModal');
  viewAppointmentModal = modalElement ? new bootstrap.Modal(modalElement) : null;

  const editModalElement = document.getElementById('editModal');
  if (editModalElement) {

    if (editModalElement.parentElement !== document.body) {
      document.body.appendChild(editModalElement);
      console.log('[DEBUG] #editModal movido para <body>');
    }


    editModalElement.addEventListener('show.bs.modal', () => {
      try { closeActionPanel(); } catch (_) { }
    });

    editModal = new bootstrap.Modal(editModalElement);
  }


  modalElement?.querySelector('.btn-close')?.addEventListener('click', () => viewAppointmentModal.hide());
  modalElement?.addEventListener('click', (e) => {
    if (e.target === modalElement) viewAppointmentModal.hide();
  });

  const fitInModalEl = document.getElementById('fitInModal');
if (fitInModalEl) {
  if (fitInModalEl.parentElement !== document.body) {
    document.body.appendChild(fitInModalEl);
  }

  // garanta uma única instância
  const fitInModal = bootstrap.Modal.getOrCreateInstance(fitInModalEl);

  // limpeza robusta quando o modal fecha
  const cleanupBackdrops = () => {
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
  };
  fitInModalEl.addEventListener('hidden.bs.modal', cleanupBackdrops);
    fitInModalEl.addEventListener('show.bs.modal', () => {
      populateFitInSelects();

      const timeInput = document.getElementById('fitInTime');
      const dateInput = document.getElementById('fitInDate');

      // Força abrir picker no clique
      timeInput.addEventListener('click', () => {
        timeInput.showPicker?.();
      });

      const updateMinTime = () => {
        const hoje = new Date();
        const dataSelecionada = new Date(dateInput.value + 'T00:00:00');

        const isHoje =
          dataSelecionada.getFullYear() === hoje.getFullYear() &&
          dataSelecionada.getMonth() === hoje.getMonth() &&
          dataSelecionada.getDate() === hoje.getDate();

        if (isHoje) {
          const horas = String(hoje.getHours()).padStart(2, '0');
          const minutos = String(hoje.getMinutes()).padStart(2, '0');
          timeInput.min = `${horas}:${minutos}`;
        } else {
          timeInput.min = "00:00"; // libera todos os horários se não for hoje
        }
      };


      // Atualiza quando abrir o modal
      updateMinTime();

      // Atualiza quando trocar a data
      dateInput.addEventListener('change', updateMinTime);
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

    const collapseEl = document.getElementById('filtersCollapse');
    if (collapseEl && collapseEl.classList.contains('show')) {
      bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false }).hide();
    }

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
    localStorage.getItem('adminFilters') || '{}');
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
    modalContent.innerHTML = '';

    if (typeof closeActionPanel === 'function') {
      closeActionPanel();
      await new Promise(requestAnimationFrame);
    }
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

    notify({ type: 'error', message: 'Erro ao carregar detalhes do agendamento' });
  }
}
async function editAppointment(appointmentId) {
  closeAllMenus();

  const globalLoader = document.getElementById('global-loading');
  const modalEl = document.getElementById('editModal');
  const loadingEl = modalEl?.querySelector('#edit-loading');
  const fieldsEl = modalEl?.querySelector('#edit-fields');


  loadingEl?.classList.remove('d-none');
  loadingEl?.classList.add('d-flex');
  fieldsEl?.classList.add('d-none');


  if (typeof closeActionPanel === 'function') closeActionPanel();


  globalLoader?.classList.remove('d-none');

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


    loadingEl?.classList.add('d-none');
    loadingEl?.classList.remove('d-flex');
    fieldsEl?.classList.remove('d-none');


    const editModalElement = document.getElementById('editModal');
    if (editModalElement && editModalElement.parentElement !== document.body) {
      document.body.appendChild(editModalElement);
    }


    editModal.show();
  } catch (err) {
    console.error('[ADMIN ERROR] Erro ao carregar agendamento:', err);
    notify({ type: 'error', message: 'Erro ao carregar dados do agendamento' });


    loadingEl?.classList.add('d-none');
    loadingEl?.classList.remove('d-flex');
  } finally {
    globalLoader?.classList.add('d-none');
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

      notify({ type: 'success', message: 'Agendamento confirmado com sucesso!', });
     await refreshAppointmentsTable(Date.now());
    } else {
      throw new Error('Erro ao confirmar agendamento');
    }
  } catch (error) {
    console.error('[ADMIN ERROR] Erro ao confirmar:', error);
    notify({ type: 'error', message: 'Erro ao confirmar agendamento' });

  }

}


async function completeAppointment(appointmentId) {
  // console.log('[ADMIN] Concluindo agendamento:', appointmentId);
  closeAllMenus();
  if (typeof closeActionPanel === 'function') closeActionPanel();
  await new Promise(requestAnimationFrame)
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
      notify({ type: 'success', message: 'Agendamento concluído com sucesso!' });

      await refreshAppointmentsTable(Date.now());
    } else {
      throw new Error('Erro ao concluir agendamento');
    }
  } catch (error) {
    console.error('[ADMIN ERROR] Erro ao concluir:', error);
    notify({ type: 'error', message: 'Erro ao concluir agendamento' });

  }
}


async function cancelAppointment(appointmentId) {
  closeAllMenus();
  if (typeof closeActionPanel === 'function') closeActionPanel();
  await new Promise(requestAnimationFrame)
  const textareaId = 'cancel-reason-input';
  const ok = await confirmDialog({
    title: 'Deseja Cancelar agendamento?',
    message: `
      <label class="form-label">Motivo do cancelamento (opcional):</label>
      <textarea id="${textareaId}" class="form-control" rows="3" placeholder="Ex.: cliente solicitou"></textarea>
    `,
    confirmText: 'SIM',
    cancelText: 'Não',
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

      window.__justCancelledId = Number(appointmentId);

      notify({ type: 'success', message: 'Agendamento cancelado com sucesso!' });
      await refreshAppointmentsTable(Date.now());
    } else {
      notify({ type: 'error', message: 'Erro ao cancelar agendamento' });
    }
  } catch (err) {
    console.error(err);
    notify({ type: 'error', message: 'Erro ao cancelar agendamento' });
  }
}

async function deleteAppointment(appointmentId) {
  // console.log('[ADMIN] Excluindo agendamento:', appointmentId);
  closeAllMenus();
  if (typeof closeActionPanel === 'function') closeActionPanel();
  await new Promise(requestAnimationFrame)
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
      notify({ type: 'success', message: 'Agendamento excluído com sucesso!' });
      setTimeout(() => refreshAppointmentsTable(), 300);
    } else {
      throw new Error('Erro ao excluir agendamento');
    }
  } catch (error) {
    console.error('[ADMIN ERROR] Erro ao excluir:', error);
    notify({ type: 'error', message: 'Erro ao excluir agendamento' });
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

      notify({ type: 'success', message: 'Mensagem WhatsApp enviada com sucesso!' });
      setTimeout(() => refreshAppointmentsTable(), 300);
    } else {
      throw new Error('Erro ao enviar WhatsApp');
    }
  } catch (error) {
    console.error('[ADMIN ERROR] Erro ao enviar WhatsApp:', error);
    notify({ type: 'error', message: 'Erro ao enviar mensagem WhatsApp' });
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
    notify({ type: 'error', message: `Erro ao carregar opções para ${selectId}` });
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
      notify({ type: 'success', message: 'Agendamento atualizado com sucesso' });

      setTimeout(() => refreshAppointmentsTable(), 300);
    } catch (err) {
      console.error('[ADMIN ERROR] Falha ao atualizar agendamento:', err);
      notify({ type: 'error', message: 'Erro ao atualizar agendamento' });

    }
  });
}


async function refreshAppointmentsTable(ts = Date.now()) {
  const params = new URLSearchParams(window.location.search);
  params.set('_ts', String(ts));

  const tableEl = document.querySelector('#appointmentsTableView .admin-table');
  if (tableEl) {
    try {
      const res = await fetch(`/admin/appointments/partial?${params.toString()}`, {
        cache: 'no-store'
      });
      const ct = res.headers.get('content-type') || '';

      if (ct.includes('application/json')) {
        const { html } = await res.json();
        tableEl.innerHTML = html || '';
      } else {
        const html = await res.text();
        tableEl.innerHTML = html || '';
      }

    } catch (err) {
      console.error('[ADMIN] Erro ao atualizar a TABELA:', err);
    }
  }



  initTableListeners();
  attachActionPanelListeners();
}


function limitarLinhasDaTabela(qtd = 10) {
  const linhas = document.querySelectorAll('#appointmentsTableView table tbody tr');
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
  const s = ensureActionPanelSkeleton();
  if (!s) return;
  const { panel, titleEl, body } = s;

  try {
    const res = await fetch(`/admin/appointments/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar agendamento');
    const { appointment } = await res.json();
    const status = appointment.status;
    const paymentStatus = appointment.paymentStatus || 'pending'; // <- novo


    titleEl.textContent = 'Ações do agendamento';

    let html = `
      <button class="btn btn-outline-light w-100 mb-2" onclick="viewAppointment(${id})">
        <i class="fas fa-eye me-2"></i> Ver Detalhes
      </button>
      <button class="btn btn-outline-primary w-100 mb-2" onclick="editAppointment(${id})">
        <i class="fas fa-pen me-2"></i> Editar
      </button>
    `;

    if (status === 'pending') {
      html += `
        <button class="btn btn-outline-success w-100 mb-2" onclick="confirmAppointment(${id})">
          <i class="fas fa-check-circle me-2"></i> Confirmar
        </button>
      `;
    }

    const canCheckout =
      paymentStatus !== 'paid' &&
      !['cancelled', 'no_show', 'blocked'].includes(status);

    if (canCheckout) {
      html += `
        <button class="btn btn-success w-100 mb-2" onclick="openCheckoutModal(${id})">
          <i class="fas fa-cash-register me-2"></i> Finalizar e Receber
        </button>
      `;
    }
    if (status !== 'cancelled') {
      html += `
        <button class="btn btn-outline-danger w-100 mb-2" onclick="cancelAppointment(${id})">
          <i class="fas fa-times-circle me-2"></i> Cancelar
        </button>
      `;
    }

    body.innerHTML = html;
    panel.classList.add('show');
  } catch (err) {
    console.error('[PAINEL] Erro:', err);
    notify({ type: 'error', message: 'Erro ao carregar detalhes do agendamento' });
  }
}

//Finalizar e Receber
// Métodos permitidos no front (o back normaliza também)
const ALLOWED_METHODS = new Set(['cash', 'pix', 'credit_card', 'debit_card', 'voucher', 'other']);

// Util: arredonda para 2 casas, garantindo número válido
function toMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return NaN;
  return Math.round(v * 100) / 100;
}

// ---- Finalizar e Receber ----

async function submitCheckout(appointmentId) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const rows = document.querySelectorAll('#checkoutPaymentsTable tbody tr');

  const rawPayments = Array.from(rows).map(row => {
    const methodEl = row.querySelector('.method-select');
    const amountEl = row.querySelector('.amount-input');
    const notesEl = row.querySelector('.notes-input');
    const method = (methodEl?.value || '').trim();
    const amount = toMoney(amountEl?.value?.trim());
    const notes = (notesEl?.value || '').trim();
    return { method, amount, notes };
  });

  const payments = rawPayments
    .filter(p => ALLOWED_METHODS.has(p.method || ''))
    .filter(p => Number.isFinite(p.amount) && p.amount > 0);

  if (payments.length === 0) {
    notify({ type: 'warning', message: 'Informe pelo menos um pagamento com valor maior que 0,00.' });
    return;
  }

  payments.forEach(p => { if (p.notes.length > 200) p.notes = p.notes.slice(0, 200); });

  const btn = document.getElementById('finalizarCheckoutBtn');
  const originalBtnHtml = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registrando...';
  }

  try {
    const resp = await fetch(`/admin/appointments/${appointmentId}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
      },
      body: JSON.stringify({ payments })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success) {
      notify({ type: 'error', message: data?.error || 'Falha ao registrar pagamento.' });
      return;
    }

    notify({ type: 'success', message: 'Pagamento registrado com sucesso!' });

    const modalEl = document.getElementById('checkoutModal');
    if (modalEl) {
      let modal = bootstrap.Modal.getInstance(modalEl);
      if (!modal) modal = new bootstrap.Modal(modalEl);
      modal.hide();
    }


    const nodes = document.querySelectorAll(
      `[data-appointment-id="${appointmentId}"], [data-id="${appointmentId}"]`
    );
    nodes.forEach(node => {
      node.dataset.paymentStatus = 'paid';
      node.querySelectorAll('.badge, .badge-status, .status-badge').forEach(b => {
        const txt = (b.textContent || '').trim().toLowerCase();
        if (txt.includes('pendente') || txt.includes('pending')) {
          b.textContent = 'Pago';
          b.classList.remove('bg-warning', 'text-dark');
          b.classList.add('bg-success');
        }
      });
    });


    document.dispatchEvent(new CustomEvent('appointment:paid', { detail: { id: appointmentId } }));


    const doRefresh = async () => {
      if (typeof refreshAppointmentsTable === 'function') {
        const maybe = refreshAppointmentsTable(Date.now());
        if (maybe && typeof maybe.then === 'function') await maybe;
      }
    };
    if ('requestIdleCallback' in window) requestIdleCallback(() => { doRefresh(); });
    else setTimeout(() => { doRefresh(); }, 50);

  } catch (err) {
    console.error(err);
    notify({ type: 'error', message: 'Erro de rede ao registrar pagamento.' });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml;
    }
  }
}



function openCheckoutModal(appointmentId) {
  const modal = document.getElementById('checkoutModal');
  if (!modal) {
    notify({ type: 'error', message: 'Modal de checkout não encontrado!' });
    return;
  }

  // Preencher hidden field com o ID do agendamento
  const hidden = document.getElementById('checkoutAppointmentId');
  if (hidden) hidden.value = appointmentId;

  // Resetar corpo da tabela (tbody) com 1 linha padrão
  const tbody = document.querySelector('#checkoutPaymentsTable tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td>
          <select class="form-select method-select">
            <option value="cash">Dinheiro</option>
            <option value="pix">Pix</option>
            <option value="credit_card">Cartão Crédito</option>
            <option value="debit_card">Cartão Débito</option>
            <option value="voucher">Voucher</option>
            <option value="other">Outros</option>
          </select>
        </td>
        <td>
          <!-- use placeholder ao invés de default 0.00 para evitar envio acidental -->
          <input type="number" class="form-control amount-input" min="0.01" step="0.01" placeholder="0,00">
        </td>
        <td>
          <input type="text" class="form-control notes-input" placeholder="Obs. opcional">
        </td>
      </tr>
    `;
  }

  // Abrir modal
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
}

// Adicionar nova linha de pagamento
document.getElementById('addPaymentRow')?.addEventListener('click', () => {
  const tbody = document.querySelector('#checkoutPaymentsTable tbody');
  if (!tbody) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>
      <select class="form-select method-select">
        <option value="cash">Dinheiro</option>
        <option value="pix">Pix</option>
        <option value="credit_card">Cartão Crédito</option>
        <option value="debit_card">Cartão Débito</option>
        <option value="voucher">Voucher</option>
        <option value="other">Outros</option>
      </select>
    </td>
    <td>
      <input type="number" class="form-control amount-input" min="0.01" step="0.01" placeholder="0,00">
    </td>
    <td>
      <input type="text" class="form-control notes-input" placeholder="Obs. opcional">
    </td>
  `;
  tbody.appendChild(row);
});

// Finalizar checkout
document.getElementById('finalizarCheckoutBtn')?.addEventListener('click', async () => {
  const appointmentId = document.getElementById('checkoutAppointmentId')?.value;
  if (!appointmentId) {
    notify({ type: 'warning', message: 'Agendamento inválido.' });
    return;
  }
  // NÃO fecha o modal aqui — deixa o submit decidir após sucesso
  await submitCheckout(appointmentId);
});


window.openActionPanel = openActionPanel;




// Função para fechar
function closeActionPanel() {
  const panel = document.getElementById('actionPanel');
  panel.classList.remove('show');
}






(function fixMobileVh() {
  const set = () =>
    document.documentElement.style.setProperty('--screen-vh', `${window.innerHeight}px`);
  set();
  window.addEventListener('resize', set);
  window.addEventListener('orientationchange', set);
})();

// Tornando acessível globalmente
window.openActionPanel = openActionPanel;
window.closeActionPanel = closeActionPanel;

document.addEventListener('click', function (e) {
  const panel = document.getElementById('actionPanel');
  if (!panel || !panel.classList.contains('show')) return;


  if (panel.contains(e.target)) return;


  const isOpenTrigger =
    e.target.closest('.js-open-action-panel') ||
    e.target.closest('.slot-free.js-open-schedule') ||
    e.target.closest('.slot-blocked.js-open-blocked') ||
    e.target.closest('.js-appointment-cell[data-id]');

  if (isOpenTrigger) return;

  closeActionPanel();
});
