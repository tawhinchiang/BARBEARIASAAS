// public/js/barbers.js
document.addEventListener('DOMContentLoaded', () => {
  maskInputs();
  previewPhoto();
  setupFilters();
  maskTimeRangeInputs();

  const form = document.getElementById('barberForm');
  const modalElement = document.getElementById('barberModal');
  const modalTitle = document.getElementById('barberModalTitle');

  if (form && modalElement && modalTitle) {
  const modal = new bootstrap.Modal(modalElement);
  form.addEventListener('submit', submitForm);

  modalElement.addEventListener('hidden.bs.modal', () => {
    form.reset();
    form.barberId.value = '';
    modalTitle.textContent = 'Novo Barbeiro';
    document.getElementById('photoPreview').classList.add('d-none');
  });
  modalElement.addEventListener('shown.bs.modal', () => {
  // Garante que a máscara seja aplicada mesmo que o modal tenha sido aberto depois
  maskInputs();
});
  window._barberModal = modal;
  window._barberForm = form;
  window._barberModalTitle = modalTitle;
}
});
function isValidTimeRange(value) {
  const regex = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(value);
}

// function maskInputs() {
//   const phoneInput = document.getElementById('barberPhone');
//   const cpfInput = document.getElementById('barberCpf');

//   if (phoneInput) {
//     phoneInput.addEventListener('input', e => {
//       let value = e.target.value.replace(/\D/g, '');
//       value = value.replace(/(\d{2})(\d)/, '($1) $2');
//       value = value.replace(/(\d{5})(\d)/, '$1-$2');
//       e.target.value = value;
//     });
//   }

//   if (cpfInput) {
//     cpfInput.addEventListener('input', e => {
//       let value = e.target.value.replace(/\D/g, '');
//       value = value.replace(/(\d{3})(\d)/, '$1.$2');
//       value = value.replace(/(\d{3})(\d)/, '$1.$2');
//       value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
//       e.target.value = value;
//     });
//   }
// }
function maskInputs() {
  if (window.Inputmask) {
    Inputmask({ mask: "(99) 99999-9999" }).mask("#barberPhone");
    Inputmask({ mask: "999.999.999-99" }).mask("#barberCpf");

    // Máscaras dos novos campos de horário padrão
    Inputmask({ mask: "99:99-99:99" }).mask("#defaultMorningHour");
    Inputmask({ mask: "99:99-99:99" }).mask("#defaultAfternoonHour");

    // Máscaras dos campos de cada dia
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(day => {
      Inputmask({ mask: "99:99-99:99" }).mask(`#workingHours${day}Morning`);
      Inputmask({ mask: "99:99-99:99" }).mask(`#workingHours${day}Afternoon`);
    });
  }
}


function maskTimeRangeInputs() {
  const inputs = [
  'defaultMorningHour', 'defaultAfternoonHour', // ← adicionados
  'workingHoursMondayMorning', 'workingHoursMondayAfternoon',
  'workingHoursTuesdayMorning', 'workingHoursTuesdayAfternoon',
  'workingHoursWednesdayMorning', 'workingHoursWednesdayAfternoon',
  'workingHoursThursdayMorning', 'workingHoursThursdayAfternoon',
  'workingHoursFridayMorning', 'workingHoursFridayAfternoon',
  'workingHoursSaturdayMorning', 'workingHoursSaturdayAfternoon'
];

  inputs.forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener('input', () => {
      let value = input.value.replace(/\D/g, '');

      if (value.length > 8) value = value.slice(0, 8);

      if (value.length >= 7) {
        value = `${value.slice(0, 2)}:${value.slice(2, 4)}-${value.slice(4, 6)}:${value.slice(6, 8)}`;
      } else if (value.length >= 5) {
        value = `${value.slice(0, 2)}:${value.slice(2, 4)}-${value.slice(4)}`;
      } else if (value.length >= 3) {
        value = `${value.slice(0, 2)}:${value.slice(2)}`;
      }

      input.value = value;
    });

    input.addEventListener('keydown', e => {
      // Permitir teclas de navegação e controle
      const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
      if (allowedKeys.includes(e.key)) return;

      // Bloqueia letras e espaços
      if (!/[0-9]/.test(e.key)) {
        e.preventDefault();
      }
    });
  });
}



function previewPhoto() {
  const photoInput = document.getElementById('barberPhoto');
  if (!photoInput) return;

  photoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        document.getElementById('photoPreviewImg').src = e.target.result;
        document.getElementById('photoPreview').classList.remove('d-none');
      };
      reader.readAsDataURL(file);
    } else {
      document.getElementById('photoPreview').classList.add('d-none');
    }
  });
}

function setupFilters() {
  ['filterStatus', 'filterSearch', 'filterSpecialty'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', applyFilters);
  });
}

function applyFilters() {
  const status = document.getElementById('filterStatus')?.value.toLowerCase();
  const search = document.getElementById('filterSearch')?.value.toLowerCase();
  const specialty = document.getElementById('filterSpecialty')?.value.toLowerCase();

  const cards = document.querySelectorAll('.barber-card');

  cards.forEach(card => {
    const name = card.dataset.name.toLowerCase();
    const phone = card.dataset.phone.toLowerCase();
    const cpf = card.dataset.cpf.toLowerCase();
    const spec = card.dataset.specialties.toLowerCase();
    const cardStatus = card.dataset.status.toLowerCase();

    const matchStatus = !status || cardStatus === status;
    const matchSearch = !search || name.includes(search) || phone.includes(search) || cpf.includes(search);
    const matchSpecialty = !specialty || spec.includes(specialty);

    card.style.display = (matchStatus && matchSearch && matchSpecialty) ? '' : 'none';
  });
}

// function updateStats() {
//   // desativado pois não é utilizado com os cards
// }

function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  // Validação dos horários
  const hourFields = [
    'defaultWorkingHour',
    'workingHoursMonday',
    'workingHoursTuesday',
    'workingHoursWednesday',
    'workingHoursThursday',
    'workingHoursFriday',
    'workingHoursSaturday'
  ];

  for (const id of hourFields) {
    const input = document.getElementById(id);
    if (input && input.value.trim() !== '' && !isValidTimeRange(input.value.trim())) {
      alert(`Horário inválido em "${input.previousElementSibling?.innerText || id}". Use o formato HH:MM-HH:MM (ex: 09:00-18:00)`);
      input.focus();
      return;
    }
  }

  const id = document.getElementById('barberId').value;
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/admin/barbers/${id}` : '/admin/barbers/create';

  fetch(url, {
    method,
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) location.reload();
      else alert(data.error || 'Erro ao salvar barbeiro');
    })
    .catch(err => {
      console.error('Erro:', err);
      alert('Erro interno ao salvar');
    });
}


// CRUD helpers
window.editBarber = function (id) {
  fetch(`/admin/barbers/${id}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const b = data.barber;
        const form = window._barberForm;
        const modal = window._barberModal;
        const modalTitle = window._barberModalTitle;

        form.barberId.value = b.id;
        form.name.value = b.name;
        form.phone.value = b.phone;
        form.email.value = b.email || '';
        form.cpf.value = b.cpf;
        form.specialties.value = b.specialties || '';

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        days.forEach(day => {
          const input = document.querySelector(`[name="workingHours[${day}]"]`);
          if (input) input.value = b.workingHours?.[day] || '';
        });

        form.isActive.checked = b.isActive;
        modalTitle.textContent = 'Editar Barbeiro';
        modal.show();
      } else {
        alert(data.error || 'Erro ao carregar barbeiro');
      }
    });
};



window.toggleBarber = function (id) {
  if (!confirm('Deseja alternar o status deste barbeiro?')) return;
  fetch(`/admin/barbers/${id}/toggle`, { method: 'PATCH' })
    .then(res => res.json())
    .then(data => data.success ? location.reload() : alert(data.error || 'Erro ao atualizar'));
};

window.deleteBarber = function (id) {
  if (!confirm('Excluir este barbeiro? Essa ação é irreversível.')) return;
  fetch(`/admin/barbers/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => data.success ? location.reload() : alert(data.error || 'Erro ao excluir'));
};

window.viewBarber = function (id) {
  window.editBarber(id);
};

window.barberReport = function (id) {
  fetch(`/admin/barbers/${id}/report`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) return alert(data.error);
      const report = data.report;
      const rows = report.appointments.map(apt => `
        <tr>
          <td>${new Date(apt.date).toLocaleDateString('pt-BR')}</td>
          <td>${apt.time}</td>
          <td>${apt.service}</td>
          <td>${apt.client?.firstName || ''} ${apt.client?.lastName || ''}</td>
          <td>
        <span class="badge ${
        apt.status === 'completed'
          ? 'bg-primary'
          : apt.status === 'confirmed'
          ? 'bg-success'
          : apt.status === 'in_progress'
          ? 'bg-info'
          : apt.status === 'cancelled'
          ? 'bg-danger'
          : apt.status === 'no_show'
          ? 'bg-dark'
          : 'bg-warning'
      }">
      ${apt.status === 'confirmed'
      ? 'Confirmado'
      : apt.status === 'cancelled'
      ? 'Cancelado'
      : apt.status === 'completed'
      ? 'Concluído'
      : apt.status === 'scheduled'
      ? 'Agendado'
      : apt.status === 'in_progress'
      ? 'Em Atendimento'
      : apt.status === 'no_show'
      ? 'Não Compareceu'
      : apt.status}
  </span>
</td>
          <td>R$ ${parseFloat(apt.price || 0).toFixed(2)}</td>
        </tr>`).join('');

        const content = `
        <div class="admin-card mb-3">
          <h4 class="fw-bold mb-0">${report.barber.name}</h4>
          <p class="text-muted mb-2">Período: ${report.period.start} a ${report.period.end}</p>
          <div class="row text-center">
            <div class="col"><div class="admin-card shadow-sm"><div class="card-body"><h3>${report.summary.totalAppointments}</h3><p>Total</p></div></div></div>
            <div class="col"><div class="admin-card shadow-sm"><div class="card-body"><h3>${report.summary.completedAppointments}</h3><p>Concluídos</p></div></div></div>
            <div class="col"><div class="admin-card shadow-sm"><div class="card-body"><h3>R$ ${report.summary.totalRevenue.toFixed(2)}</h3><p>Receita</p></div></div></div>
            <div class="col"><div class="admin-card shadow-sm"><div class="card-body"><h3>${report.summary.averagePerDay.toFixed(1)}</h3><p>Média/Dia</p></div></div></div>
          </div>
        </div>
        <div class="admin-card">
          <h5 class="fw-bold">Agendamentos</h5>
          <div class="table-responsive">
            <table class="table table-sm text-center align-middle">
              <thead class="table-light"><tr><th>Data</th><th>Hora</th><th>Serviço</th><th>Cliente</th><th>Status</th><th>Valor</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
      

      document.getElementById('reportContent').innerHTML = content;
      new bootstrap.Modal(document.getElementById('reportModal')).show();
    });
};
function applyDefaultWorkingHour() {
  const morning = document.getElementById('defaultMorningHour').value.trim();
  const afternoon = document.getElementById('defaultAfternoonHour').value.trim();

  // Validar formato mínimo dos horários
  if ((!morning || !morning.includes(':')) && (!afternoon || !afternoon.includes(':'))) {
    alert('Digite pelo menos um horário válido em manhã ou tarde (Ex: 08:00-12:00)');
    return;
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  days.forEach(day => {
    const morningInput = document.getElementById(`workingHours${day}Morning`);
    const afternoonInput = document.getElementById(`workingHours${day}Afternoon`);

    if (morningInput && morning) morningInput.value = morning;
    if (afternoonInput && afternoon) afternoonInput.value = afternoon;
  });
}


window.printReport = function () {
  window.print();
};
