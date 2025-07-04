// public/js/admin/barbers.js

document.addEventListener('DOMContentLoaded', () => {
  maskInputs();
  previewPhoto();
  setupFilters();
  updateStats();

  document.getElementById('barberForm').addEventListener('submit', submitForm);

  document.getElementById('barberModal').addEventListener('hidden.bs.modal', () => {
    document.getElementById('barberForm').reset();
    document.getElementById('barberId').value = '';
    document.getElementById('barberModalTitle').textContent = 'Novo Barbeiro';
    document.getElementById('photoPreview').classList.add('d-none');
  });
});

function maskInputs() {
  const phoneInput = document.getElementById('barberPhone');
  const cpfInput = document.getElementById('barberCpf');

  if (phoneInput) {
    phoneInput.addEventListener('input', e => {
      let value = e.target.value.replace(/\D/g, '');
      value = value.replace(/(\d{2})(\d)/, '($1) $2');
      value = value.replace(/(\d{5})(\d)/, '$1-$2');
      e.target.value = value;
    });
  }

  if (cpfInput) {
    cpfInput.addEventListener('input', e => {
      let value = e.target.value.replace(/\D/g, '');
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      e.target.value = value;
    });
  }
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
  const status = document.getElementById('filterStatus').value.toLowerCase();
  const search = document.getElementById('filterSearch').value.toLowerCase();
  const specialty = document.getElementById('filterSpecialty').value.toLowerCase();

  const rows = document.querySelectorAll('#barbersTable tbody tr');
  rows.forEach(row => {
    const name = row.cells[1].innerText.toLowerCase();
    const contact = row.cells[2].innerText.toLowerCase();
    const cpf = row.cells[3].innerText.toLowerCase();
    const spec = row.cells[4].innerText.toLowerCase();
    const rowStatus = row.querySelector('td:nth-child(7) .badge').innerText.toLowerCase();

    const matchStatus = !status || (status === 'active' && rowStatus.includes('ativo')) || (status === 'inactive' && rowStatus.includes('inativo'));
    const matchSearch = !search || name.includes(search) || contact.includes(search) || cpf.includes(search);
    const matchSpecialty = !specialty || spec.includes(specialty);

    row.style.display = (matchStatus && matchSearch && matchSpecialty) ? '' : 'none';
  });
}

function updateStats() {
  const rows = document.querySelectorAll('#barbersTable tbody tr');
  let active = 0;
  let total = rows.length;
  let thisMonth = 0;

  rows.forEach(row => {
    const status = row.querySelector('td:nth-child(7) .badge')?.innerText.toLowerCase();
    const appointments = parseInt(row.querySelector('td:nth-child(8) .badge')?.innerText) || 0;
    if (status?.includes('ativo')) active++;
    thisMonth += appointments;
  });

  const activeEl = document.getElementById('activeBarbers');
  const totalEl = document.getElementById('totalBarbers');
  const monthEl = document.getElementById('monthAppointments');

  if (activeEl) activeEl.textContent = active;
  if (totalEl) totalEl.textContent = total;
  if (monthEl) monthEl.textContent = thisMonth;
}

function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
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
        document.getElementById('barberId').value = b.id;
        document.getElementById('barberName').value = b.name;
        document.getElementById('barberPhone').value = b.phone;
        document.getElementById('barberEmail').value = b.email || '';
        document.getElementById('barberCpf').value = b.cpf;
        document.getElementById('barberSpecialties').value = b.specialties || '';
        document.getElementById('barberWorkingHours').value = b.workingHours || '';
        document.getElementById('barberIsActive').checked = b.isActive;
        document.getElementById('barberModalTitle').textContent = 'Editar Barbeiro';
        new bootstrap.Modal(document.getElementById('barberModal')).show();
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
          <td>${apt.client}</td>
          <td><span class="badge bg-${apt.status === 'completed' ? 'success' : apt.status === 'cancelled' ? 'danger' : 'warning'}">${apt.status}</span></td>
          <td>R$ ${parseFloat(apt.price || 0).toFixed(2)}</td>
        </tr>`).join('');

      const content = `
        <h4>${report.barber.name}</h4>
        <p class="text-muted">Período: ${report.period.start} a ${report.period.end}</p>
        <div class="row text-center mb-4">
          <div class="col"><div class="card"><div class="card-body"><h3>${report.summary.totalAppointments}</h3><p>Total</p></div></div></div>
          <div class="col"><div class="card"><div class="card-body"><h3>${report.summary.completedAppointments}</h3><p>Concluídos</p></div></div></div>
          <div class="col"><div class="card"><div class="card-body"><h3>R$ ${report.summary.totalRevenue.toFixed(2)}</h3><p>Receita</p></div></div></div>
          <div class="col"><div class="card"><div class="card-body"><h3>${report.summary.averagePerDay.toFixed(1)}</h3><p>Média/Dia</p></div></div></div>
        </div>
        <div class="table-responsive">
          <table class="table table-sm">
            <thead><tr><th>Data</th><th>Hora</th><th>Serviço</th><th>Cliente</th><th>Status</th><th>Valor</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;

      document.getElementById('reportContent').innerHTML = content;
      new bootstrap.Modal(document.getElementById('reportModal')).show();
    });
};

window.printReport = function () {
  window.print();
};
