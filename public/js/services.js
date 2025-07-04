document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('serviceForm');
  const modal = new bootstrap.Modal(document.getElementById('serviceModal'));
  const modalTitle = document.getElementById('serviceModalTitle');

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

  form.addEventListener('submit', async function (e) {
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

  window.editService = async function (id) {
    try {
      const res = await fetch(`/admin/services/${id}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Erro ao carregar serviço');

      const s = data.service;

      document.getElementById('serviceId').value = s.id;
      document.getElementById('serviceName').value = s.name;
      document.getElementById('serviceDescription').value = s.description || '';
      document.getElementById('servicePrice').value = s.price;
      document.getElementById('serviceDuration').value = s.duration;
      document.getElementById('serviceActive').checked = s.isActive;
      document.getElementById('servicePromo').checked = s.isPromo;

      modalTitle.textContent = 'Editar Serviço';
      modal.show();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  window.deleteService = async function (id) {
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

  window.toggleService = async function (id) {
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

  window.togglePromo = async function (id) {
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

  // Resetar modal ao fechar
  document.getElementById('serviceModal').addEventListener('hidden.bs.modal', () => {
    form.reset();
    form.serviceId.value = '';
    modalTitle.textContent = 'Novo Serviço';
  });
});