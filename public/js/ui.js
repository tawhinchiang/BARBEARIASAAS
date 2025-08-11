// UI util: Toasts + Modal de confirmação (Bootstrap 5 + Font Awesome)
(() => {
  // notify({ type, message, title, delay })
  window.notify = function ({ type = 'info', message = '', title = '', delay = 5000 } = {}) {
    const stack = document.getElementById('toastStack');
    if (!stack) return console.warn('toastStack não encontrado');
    const typeToBg = { success: 'text-bg-success', error: 'text-bg-danger', warning: 'text-bg-warning', info: 'text-bg-info' };
    const typeToIcon = { success: 'fa-circle-check', error: 'fa-triangle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const bgClass = typeToBg[type] || typeToBg.info;
    const icon = typeToIcon[type] || typeToIcon.info;

    while (stack.children.length >= 5) stack.removeChild(stack.firstElementChild);

    const el = document.createElement('div');
    el.className = `toast admin-toast ${type}`;
    el.setAttribute('role','alert'); el.setAttribute('aria-live','assertive'); el.setAttribute('aria-atomic','true');
    el.innerHTML = `
      <div class="toast-header ${bgClass} text-white border-0">
        <i class="fa-solid ${icon} me-2"></i>
        <strong class="me-auto">${title || type.toUpperCase()}</strong>
        <small class="text-white-50">agora</small>
        <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="toast" aria-label="Fechar"></button>
      </div>
      <div class="toast-body">${message}</div>
    `;
    stack.appendChild(el);
    const t = new bootstrap.Toast(el, { delay, autohide: true });
    t.show(); el.addEventListener('hidden.bs.toast', () => { t.dispose(); el.remove(); });
  };

  // Compat: showAlert(message, type)
  window.showAlert = function (message, type = 'info') {
    const map = { danger: 'error', error: 'error', success: 'success', warning: 'warning', info: 'info' };
    notify({ type: map[type] || 'info', message });
  };

  // confirmDialog(opts) -> Promise<boolean>
  window.confirmDialog = function ({
    title = 'Confirmar ação', message = 'Tem certeza?', confirmText = 'Confirmar',
    cancelText = 'Cancelar', variant = 'primary'
  } = {}) {
    return new Promise(resolve => {
      const modalEl = document.getElementById('confirmDialogModal');
      if (!modalEl) return resolve(false);
      modalEl.querySelector('#confirmDialogLabel').textContent = title;
      modalEl.querySelector('#confirmDialogMessage').innerHTML = message;
      const btnOk = modalEl.querySelector('#confirmDialogOk');
      const btnCancel = modalEl.querySelector('#confirmDialogCancel');
      btnOk.className = 'btn'; btnOk.classList.add(`btn-${variant}`); btnOk.textContent = confirmText;
      btnCancel.textContent = cancelText;

      const modal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: 'static' });
      const cleanup = (r) => { btnOk.removeEventListener('click', onOk); modalEl.removeEventListener('hidden.bs.modal', onHide); resolve(r); };
      const onOk = () => { modal.hide(); cleanup(true); };
      const onHide = () => cleanup(false);

      btnOk.addEventListener('click', onOk, { once: true });
      modalEl.addEventListener('hidden.bs.modal', onHide, { once: true });
      modal.show();
    });
  };
})();
