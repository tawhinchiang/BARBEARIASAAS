console.log('[CASHIER] Página de Caixa carregada');

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

// Helpers
async function apiFetch(url, options = {}) {
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  return resp.json();
}

// Atualizar status e resumo
async function loadCashierStatus() {
  try {
    const data = await apiFetch('/admin/cashier/session/current');
    const statusDiv = document.getElementById('cashierStatus');
    const summaryDiv = document.getElementById('cashierSummary');

    if (!data.session) {
      statusDiv.innerHTML = `<span class="badge bg-secondary">Caixa Fechado</span>`;
      summaryDiv.innerHTML = `<div class="col-12"><p>Nenhum caixa aberto.</p></div>`;
      document.getElementById('btnOpenCashier').disabled = false;
      document.getElementById('btnAddExpense').disabled = true;
      document.getElementById('btnCloseCashier').disabled = true;
      return;
    }

    statusDiv.innerHTML = `
      <span class="badge bg-success">Caixa Aberto</span>
      <small class="text-muted ms-2">Aberto em: ${new Date(data.session.openedAt).toLocaleString()}</small>
    `;

    // Preencher resumo
    let html = `
      <div class="col-md-4">
        <div class="card border-success">
          <div class="card-body">
            <h6 class="card-title">Entradas por método</h6>
            <ul class="list-unstyled mb-0">
    `;

    for (const [method, valor] of Object.entries(data.resumo.entradas)) {
      html += `<li><strong>${method}:</strong> R$ ${valor.toFixed(2)}</li>`;
    }

    html += `
            </ul>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card border-warning">
          <div class="card-body">
            <h6 class="card-title">Despesas</h6>
            <p class="mb-0">R$ ${data.resumo.totalDespesas.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card border-primary">
          <div class="card-body">
            <h6 class="card-title">Saldo Esperado</h6>
            <p class="mb-0">R$ ${data.resumo.saldoEsperado.toFixed(2)}</p>
          </div>
        </div>
      </div>
    `;

    summaryDiv.innerHTML = html;

    document.getElementById('btnOpenCashier').disabled = true;
    document.getElementById('btnAddExpense').disabled = false;
    document.getElementById('btnCloseCashier').disabled = false;

  } catch (err) {
    console.error('[CASHIER LOAD ERROR]', err);
    notify({ type: 'error', message: 'Erro ao carregar status do caixa' });
  }
}

// Ações dos botões
document.getElementById('confirmOpenCashier')?.addEventListener('click', async () => {
  const openingAmount = parseFloat(document.getElementById('openingAmount').value) || 0;

  const data = await apiFetch('/admin/cashier/open', {
    method: 'POST',
    body: JSON.stringify({ openingAmount })
  });

  if (data.success) {
    notify({ type: 'success', message: 'Caixa aberto com sucesso!' });
    bootstrap.Modal.getInstance(document.getElementById('openCashierModal')).hide();
    loadCashierStatus();
  } else {
    notify({ type: 'error', message: data.error || 'Erro ao abrir caixa' });
  }
});

document.getElementById('confirmAddExpense')?.addEventListener('click', async () => {
  const description = document.getElementById('expenseDescription').value.trim();
  const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
  const method = document.getElementById('expenseMethod').value;

  if (!description || amount <= 0) {
    notify({ type: 'warning', message: 'Preencha descrição e valor válido.' });
    return;
  }

  const data = await apiFetch('/admin/cashier/expenses', {
    method: 'POST',
    body: JSON.stringify({ description, amount, method })
  });

  if (data.success) {
    notify({ type: 'success', message: 'Despesa registrada com sucesso!' });
    bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();
    loadCashierStatus();
  } else {
    notify({ type: 'error', message: data.error || 'Erro ao lançar despesa' });
  }
});

document.getElementById('confirmCloseCashier')?.addEventListener('click', async () => {
  const countedCash = parseFloat(document.getElementById('countedCash').value) || 0;
  const notes = document.getElementById('closeNotes').value.trim();

  const data = await apiFetch('/admin/cashier/close', {
    method: 'POST',
    body: JSON.stringify({ countedCash, notes })
  });

  if (data.success) {
    notify({ type: 'success', message: 'Caixa fechado com sucesso!' });
    bootstrap.Modal.getInstance(document.getElementById('closeCashierModal')).hide();
    loadCashierStatus();
  } else {
    notify({ type: 'error', message: data.error || 'Erro ao fechar caixa' });
  }
});

// Carregar ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
  loadCashierStatus();
});
