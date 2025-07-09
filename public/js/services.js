// public/js/admin/services.js

function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('serviceForm');
  const modalElement = document.getElementById('serviceModal');
  const modalTitle = document.getElementById('serviceModalTitle');
  const servicesContainer = document.getElementById('servicesContainer');
  const searchInput = document.getElementById('serviceSearch');

  if (!form || !modalElement || !modalTitle || !servicesContainer) return;

  const modal = new bootstrap.Modal(modalElement);

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

  servicesContainer.addEventListener('click', (e) => {
    const target = e.target.closest('button[data-action]');
    if (!target) return;

    const id = target.dataset.id;
    const action = target.dataset.action;

    if (!id || !action) return;

    if (action === 'edit') return editService(id);
    if (action === 'delete') return deleteService(id);
    if (action === 'toggle') return toggleService(id);
    if (action === 'promo') return togglePromo(id);
  });

  async function editService(id) {
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
  }

  async function deleteService(id) {
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
  }

  async function toggleService(id) {
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
  }

  async function togglePromo(id) {
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
  }

  modalElement.addEventListener('hidden.bs.modal', () => {
    form.reset();
    form.serviceId.value = '';
    modalTitle.textContent = 'Novo Serviço';
  });

  if (searchInput) {
    const handleSearch = debounce(() => {
      const searchValue = searchInput.value.toLowerCase().trim();
      const cards = document.querySelectorAll('#servicesContainer .service-card');

      requestAnimationFrame(() => {
        cards.forEach(card => {
          const name = card.querySelector('.service-name')?.textContent.toLowerCase() || '';
          const description = card.querySelector('.service-description')?.textContent.toLowerCase() || '';
          const match = name.includes(searchValue) || description.includes(searchValue);
          card.classList.toggle('hidden', !match);
        });
      });
    }, 150);

    searchInput.addEventListener('input', handleSearch);
  }
});
