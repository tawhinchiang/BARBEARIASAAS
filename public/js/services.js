// public/js/admin/services.js

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('serviceForm');
  const modalElement = document.getElementById('serviceModal');
  const modal = new bootstrap.Modal(modalElement);
  const modalTitle = document.getElementById('serviceModalTitle');

  // ================= NOTIFICAÇÃO ================= //
  function showNotification(message, type = 'success') {
    const div = document.createElement('div');
    div.className = `notification ${type}`;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => {
      div.classList.add('show');
      setTimeout(() => {
        div.classList.remove('show');
        setTimeout(() => div.remove(), 300);
      }, 3000);
    }, 50);
  }

  // ================= ENVIO DO FORMULÁRIO ================= //
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const id = formData.get('serviceId');
    const url = id ? `/admin/services/${id}` : '/admin/services/create';
    const method = id ? 'PUT' : 'POST';

    const payload = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price')),
      duration: parseInt(formData.get('duration')),
      isActive: formData.get('isActive') === 'on',
      isPromo: formData.get('isPromo') === 'on'
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showNotification(data.message || 'Serviço salvo com sucesso');
        setTimeout(() => location.reload(), 800);
      } else {
        showNotification(data.error || 'Erro ao salvar serviço', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Erro interno', 'error');
    }
  });

  // ================= FUNÇÕES GLOBAIS ================= //
  window.editService = async (id) => {
    try {
      const res = await fetch(`/admin/services/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erro ao carregar serviço');

      const s = data.service;
      form.serviceId.value = s.id;
      form.name.value = s.name;
      form.description.value = s.description || '';
      form.price.value = s.price;
      form.duration.value = s.duration;
      form.isActive.checked = s.isActive;
      form.isPromo.checked = s.isPromo;

      modalTitle.textContent = 'Editar Serviço';
      modal.show();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  window.deleteService = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;

    try {
      const res = await fetch(`/admin/services/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message || 'Serviço excluído com sucesso');
        setTimeout(() => location.reload(), 800);
      } else {
        showNotification(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Erro ao excluir serviço', 'error');
    }
  };

  window.toggleService = async (id) => {
    try {
      const res = await fetch(`/admin/services/${id}/toggle`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message || 'Status atualizado');
        setTimeout(() => location.reload(), 800);
      } else {
        showNotification(data.error, 'error');
      }
    } catch (err) {
      showNotification('Erro ao alternar status', 'error');
    }
  };

  window.togglePromo = async (id) => {
    try {
      const res = await fetch(`/admin/services/${id}/toggle-promo`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message || 'Promoção atualizada');
        setTimeout(() => location.reload(), 800);
      } else {
        showNotification(data.error, 'error');
      }
    } catch (err) {
      showNotification('Erro ao alternar promoção', 'error');
    }
  };

  // ================= RESET MODAL ================= //
  modalElement.addEventListener('hidden.bs.modal', () => {
    form.reset();
    form.serviceId.value = '';
    modalTitle.textContent = 'Novo Serviço';
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('serviceSearch');
  if (searchInput) {
    searchInput.addEventListener('input', filterServices);
  }
});

function filterServices() {
  const searchValue = document.getElementById('serviceSearch').value.toLowerCase().trim();
  const cards = document.querySelectorAll('#servicesContainer .service-card');

  cards.forEach(card => {
    const name = card.dataset.name?.toLowerCase() || '';
    const description = card.dataset.description?.toLowerCase() || '';
    const match = name.includes(searchValue) || description.includes(searchValue);
    card.style.display = match ? '' : 'none';
  });
}


  // ==============================
  // EXPORTAÇÃO GLOBAL PARA HTML
  // ==============================
  window.editService = editService;
  window.deleteService = deleteService;
  window.toggleService = toggleService;
  window.togglePromo = togglePromo;
;
