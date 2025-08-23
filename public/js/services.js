// Atualizado: public/js/services.js

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('serviceForm');
  const modalElement = document.getElementById('serviceModal');
  const modal = new bootstrap.Modal(modalElement);
  const modalTitle = document.getElementById('serviceModalTitle');
  const container = document.getElementById('servicesContainer');

  // ================= NOTIFICAÇÃO ================= //
 const servicePhotoInput = document.getElementById('servicePhoto');
const photoPreviewContainer = document.getElementById('photoPreview');
const photoPreviewImg = photoPreviewContainer.querySelector('img');

servicePhotoInput.addEventListener('change', () => {
  const file = servicePhotoInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      photoPreviewImg.src = e.target.result;
      photoPreviewContainer.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else {
    photoPreviewImg.src = '';
    photoPreviewContainer.style.display = 'none';
  }
});

  // ================= ENVIO DO FORMULÁRIO ================= //
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
  const formData = new FormData(form);
  const id = formData.get('serviceId');
  const url = id ? `/admin/services/${id}` : '/admin/services/create';
  const method = id ? 'PUT' : 'POST';

 try {
  const res = await fetch(url, {
    method,
    body: formData // 👈 envia o FormData direto
  });

    if (!res.ok) throw new Error('Erro ao salvar serviço');

    const result = await res.json();
    const newId = result.service.id;

    await refreshServiceCard(newId);

    bootstrap.Modal.getInstance(modalElement)?.hide();
    form.reset();
    form.serviceId.value = '';
    modalTitle.textContent = 'Novo Serviço';
    showNotification('Serviço salvo com sucesso');

  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Erro interno', 'error');
  }
  });

  const searchInput = document.getElementById('serviceSearch');
  const statusSelect = document.getElementById('serviceStatus');
  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        filterServices();
      }, 200);
    });
  }
  if (statusSelect) {
    statusSelect.addEventListener('change', filterServices);
  }

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
      if (s.photo) {
        photoPreviewImg.src = s.photo;
        photoPreviewContainer.style.display = 'block';
      } else {
        photoPreviewImg.src = '';
        photoPreviewContainer.style.display = 'none';
      }

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
        document.querySelector(`[data-service-id="${id}"]`)?.remove();
        showNotification('Serviço removido');
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
        await refreshServiceCard(id);
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
        await refreshServiceCard(id);
      } else {
        showNotification(data.error, 'error');
      }
    } catch (err) {
      showNotification('Erro ao alternar promoção', 'error');
    }
  };

modalElement.addEventListener('hidden.bs.modal', () => {
  form.reset();
  form.serviceId.value = '';
  modalTitle.textContent = 'Novo Serviço';
  photoPreviewImg.src = '';
  photoPreviewContainer.style.display = 'none';
});
});


 function showNotification(message, type = 'success') {
    const div = document.createElement('div');
    div.className = `notification ${type}`;
    div.textContent = message;
    document.body.appendChild(div);
    void div.offsetWidth;
    div.classList.add('show');
    setTimeout(() => {
      div.classList.remove('show');
      setTimeout(() => div.remove(), 300);
    }, 3000);
  }
function filterServices() {
  const searchValue = document.getElementById('serviceSearch').value.toLowerCase().trim();
  const statusValue = document.getElementById('serviceStatus').value;
  const cards = document.querySelectorAll('#servicesContainer > .col');

  cards.forEach(card => {
    const cardEl = card.querySelector('.admin-card');
    if (!cardEl) return;
    const name = cardEl.querySelector('.card-title')?.textContent.toLowerCase() || '';
    const description = cardEl.querySelector('p.text-muted')?.textContent.toLowerCase() || '';
    const statusBadge = cardEl.querySelector('.status-badge');
    let isActive = '';
    if (statusBadge) {
      isActive = statusBadge.classList.contains('status-confirmed') ? 'ativo' : 'inativo';
    }
    const matchText = name.includes(searchValue) || description.includes(searchValue);
    const matchStatus = !statusValue || isActive === statusValue;
    if (matchText && matchStatus) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

async function refreshServiceCard(id) {
  try {
    const res = await fetch(`/admin/services/${id}/partial`);
    const html = await res.text();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();

    const updatedCard = wrapper.querySelector(`[data-service-id="${id}"]`);
    const currentCard = document.querySelector(`[data-service-id="${id}"]`);
    if (currentCard && updatedCard) {
      currentCard.replaceWith(updatedCard);
    }
  } catch (err) {
    console.error('Erro ao atualizar card:', err);
    showNotification('Erro ao atualizar card', 'error');
  }
}
