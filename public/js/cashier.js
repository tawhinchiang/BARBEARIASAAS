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
// Ordem fixa e labels amigáveis
const METHOD_ORDER = ['cash', 'credit', 'debit', 'pix', 'other'];
const LABELS = { cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX', other: 'Outros' };

// Formatador de moeda (evita NaN)
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Renderiza <li> para métodos de pagamento em ordem fixa
function renderPaymentList(obj = {}) {
  return METHOD_ORDER.map(key => {
    const valor = Number(obj[key] || 0);
    return `<li><strong>${LABELS[key]}:</strong> ${money(valor)}</li>`;
  }).join('');
}

// Atualizar status e resumo
async function loadCashierStatus() {
  try {
    const data = await apiFetch('/admin/cashier/session/current'); // { success, session, resumo }
    const statusDiv  = document.getElementById('cashierStatus');
    const summaryDiv = document.getElementById('cashierSummary');

    // Sem sessão aberta
    if (!data?.session) {
      statusDiv.innerHTML = `<span class="badge bg-secondary">Caixa Fechado</span>`;
      summaryDiv.innerHTML = `<div class="col-12"><p>Nenhum caixa aberto.</p></div>`;
      document.getElementById('btnOpenCashier').disabled  = false;
      document.getElementById('btnAddExpense').disabled   = true;
      document.getElementById('btnCloseCashier').disabled = true;
      return;
    }

    // Cabeçalho do status
    const openedAt = new Date(data.session.openedAt).toLocaleString('pt-BR');
    statusDiv.innerHTML = `
      <span class="badge bg-success">Caixa Aberto</span>
      <small class="text-muted ms-2">Aberto em: ${openedAt}</small>
    `;

    // Resumo seguro (sempre números)
    const resumo          = data.resumo || {};
    const entradasByMeth  = resumo.entradas || {};             // normalizado pelo back
    const despesasByMeth  = resumo.despesasByMethod || null;   // opcional
    const totalEntradas   = Number(resumo.totalEntradas || 0);
    const totalDespesas   = Number(resumo.totalDespesas || 0);
    const saldoEsperado   = Number(resumo.saldoEsperado || 0);
    const resultado       = totalEntradas - totalDespesas;

    // Montagem dos cards
    let html = `
      <div class="col-md-4">
        <div class="card border-success h-100">
          <div class="card-body">
            <h6 class="card-title">Entradas por método</h6>
            <ul class="list-unstyled mb-0">
              ${renderPaymentList(entradasByMeth)}
            </ul>
          </div>
        </div>
      </div>
    `;

    // Card de Despesas por método (se existir breakdown)
    if (despesasByMeth) {
      html += `
        <div class="col-md-4">
          <div class="card border-warning h-100">
            <div class="card-body">
              <h6 class="card-title">Despesas por método</h6>
              <ul class="list-unstyled mb-0">
                ${renderPaymentList(despesasByMeth)}
              </ul>
            </div>
          </div>
        </div>
      `;
    } else {
      // Caso não tenha breakdown, mostra total de despesas
      html += `
        <div class="col-md-4">
          <div class="card border-warning h-100">
            <div class="card-body">
              <h6 class="card-title">Despesas</h6>
              <p class="mb-0">${money(totalDespesas)}</p>
            </div>
          </div>
        </div>
      `;
    }

    // Card de Saldo/Resumo rápido
    html += `
      <div class="col-md-4">
        <div class="card border-primary h-100">
          <div class="card-body">
            <h6 class="card-title">Resumo</h6>
            <ul class="list-unstyled mb-2">
              <li><strong>Total de Entradas:</strong> ${money(totalEntradas)}</li>
              <li><strong>Total de Despesas:</strong> ${money(totalDespesas)}</li>
              <li><strong>Resultado (E - D):</strong> ${money(resultado)}</li>
            </ul>
            <h6 class="card-subtitle text-muted">Saldo Esperado</h6>
            <p class="mb-0">${money(saldoEsperado)}</p>
          </div>
        </div>
      </div>
    `;

    summaryDiv.innerHTML = html;

    // Botões
    document.getElementById('btnOpenCashier').disabled  = true;
    document.getElementById('btnAddExpense').disabled   = false;
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
