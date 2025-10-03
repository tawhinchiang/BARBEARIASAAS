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
function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}
function setChecked(id, checked) {
  const el = document.getElementById(id);
  if (el) el.checked = !!checked;
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

// Lançar Despesa (novo: category, date, isFixed, notes)
document.getElementById('exp-submit-btn')?.addEventListener('click', async () => {
  // IDs do novo modal (ajuste se usou outros):
  const description = document.getElementById('exp-desc')?.value?.trim() ||
                      document.getElementById('expenseDescription')?.value?.trim() || '';
  const amount = parseFloat(document.getElementById('exp-amount')?.value ??
                            document.getElementById('expenseAmount')?.value) || 0;
  const method = document.getElementById('exp-method')?.value ??
                 document.getElementById('expenseMethod')?.value ?? 'cash';
  const category = document.getElementById('exp-category')?.value || 'operacional';
  const date = document.getElementById('exp-date')?.value || new Date().toISOString().slice(0,10);
  const isFixed = document.getElementById('exp-fixed')?.checked === true;
  const notes = document.getElementById('exp-notes')?.value?.trim() || '';

  if (!description || !(amount > 0)) {
    notify({ type: 'warning', message: 'Preencha descrição e um valor maior que 0,00.' });
    return;
  }

  const body = { description, amount, method, category, date, isFixed, notes };

  const btn = document.getElementById('exp-submit-btn');
  const html = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Lançando...'; }

  const data = await apiFetch('/admin/cashier/expenses', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (btn) { btn.disabled = false; btn.innerHTML = html; }

  if (data.success) {
    notify({ type: 'success', message: 'Despesa registrada com sucesso!' });
    bootstrap.Modal.getInstance(document.getElementById('expenseModal'))?.hide();
    loadCashierStatus();
  } else {
    notify({ type: 'error', message: data.error || 'Erro ao lançar despesa' });
  }
});


// Fechar Caixa com contagem por método
document.getElementById('cc-submit-btn')?.addEventListener('click', async () => {

  const rows = document.querySelectorAll('#cc-count-tbody tr'); // linhas do modal de fechar
  if (!rows.length) {
    notify({ type: 'warning', message: 'Abra o modal de Fechar Caixa para informar as contagens por método.' });
    return;
  }

  const counted = { cash: 0, credit: 0, debit: 0, pix: 0, other: 0 };
  rows.forEach(tr => {
    const method = tr?.dataset?.method;
    const val = parseFloat(tr.querySelector('.cc-count')?.value) || 0;
    if (method && method in counted) counted[method] = Math.max(0, Math.round(val * 100) / 100);
  });

  const notes = document.getElementById('cc-notes')?.value?.trim() || '';
  const printReceipt = document.getElementById('cc-print')?.checked === true;

  // Compat: soma geral (caso seu back ainda aceite countedCash)
  const countedCash = Object.values(counted).reduce((s, v) => s + v, 0);

  const body = { counted, countedCash, notes, printReceipt };

  const btn = document.getElementById('cc-submit-btn');
  const html = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Fechando...'; }

  const data = await apiFetch('/admin/cashier/close', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (btn) { btn.disabled = false; btn.innerHTML = html; }

  if (data.success) {
    notify({ type: 'success', message: 'Caixa fechado com sucesso!' });
    bootstrap.Modal.getInstance(document.getElementById('closeCashierModal'))?.hide();
    loadCashierStatus();
  } else {
    notify({ type: 'error', message: data.error || 'Erro ao fechar caixa' });
  }
});

// Carregar resumo do caixa aberto (reutiliza a sua rota atual)
async function fetchOpenCashSummary() {
  const data = await apiFetch('/admin/cashier/session/current');
  if (!data?.session) throw new Error('Nenhum caixa aberto.');
  // Normaliza estrutura para o modal:
  const entradas = data?.resumo?.entradas || {};
  const despesas = Number(data?.resumo?.totalDespesas || 0);
  const expectedByMethod = {
    cash:   Number(entradas.cash || 0),
    credit: Number(entradas.credit || 0),
    debit:  Number(entradas.debit || 0),
    pix:    Number(entradas.pix || 0),
    other:  Number(entradas.other || 0)
  };
  const expectedTotal = Object.values(expectedByMethod).reduce((s,v)=>s+Number(v||0),0);
  return { expectedByMethod, expectedTotal, expensesTotal: despesas };
}

// Monta as linhas do modal de fechar caixa e liga os listeners
async function openCloseCashierModal() {
  try {
    const { expectedByMethod, expectedTotal, expensesTotal } = await fetchOpenCashSummary();

    // Cabeçalho do modal
    const elExp = document.getElementById('cc-expected-total');
    const elDes = document.getElementById('cc-expenses-total');
    const elRes = document.getElementById('cc-result-expected');
    if (elExp) elExp.textContent = money(expectedTotal);
    if (elDes) elDes.textContent = money(expensesTotal);
    if (elRes) elRes.textContent = money(expectedTotal - expensesTotal);

    // Linhas por método
    const mapLabels = { cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX', other: 'Outros' };
    const tbody = document.getElementById('cc-count-tbody');
    tbody.innerHTML = '';
    Object.keys(mapLabels).forEach(method => {
      const tr = document.createElement('tr');
      tr.dataset.method = method;
      tr.innerHTML = `
        <td>${mapLabels[method]}</td>
        <td class="text-end" data-expected>${money(expectedByMethod[method])}</td>
        <td>
          <div class="input-group">
            <span class="input-group-text">R$</span>
            <input type="number" class="form-control cc-count" min="0" step="0.01" placeholder="0,00">
          </div>s
        </td>
        <td class="text-end" data-diff>R$ 0,00</td>
      `;
      tbody.appendChild(tr);
    });
    document.getElementById('cc-expected-sum').textContent = money(expectedTotal);
    document.getElementById('cc-counted-sum').value = 'R$ 0,00';
    document.getElementById('cc-diff-sum').textContent = 'R$ 0,00';
    // document.getElementById('cc-notes').value = '';
    // document.getElementById('cc-print').checked = false;
    document.getElementById('cc-diff-alert').classList.add('d-none');

    // Recalcular ao digitar
    const onChange = () => {
      const rows = document.querySelectorAll('#cc-count-tbody tr');
      let sumCounted = 0;
      let sumDiff = 0;
      rows.forEach(row => {
        const expText = row.querySelector('[data-expected]').textContent;
        const expected = parseFloat(expText.replace(/[R$\.\s]/g,'').replace(',', '.')) || 0;
        const val = parseFloat(row.querySelector('.cc-count')?.value) || 0;
        sumCounted += val;
        const diff = Math.round((val - expected) * 100) / 100;
        row.querySelector('[data-diff]').textContent = money(diff);
        sumDiff += diff;
      });
      document.getElementById('cc-counted-sum').value = money(sumCounted);
      document.getElementById('cc-diff-sum').textContent = money(sumDiff);
      document.getElementById('cc-diff-alert').classList.toggle('d-none', Math.abs(sumDiff) < 0.01);
    };
   
    tbody.addEventListener('input', onChange);

    new bootstrap.Modal(document.getElementById('closeCashierModal')).show();
  } catch (e) {
    console.error(e);
    notify({ type: 'error', message: e.message || 'Erro ao preparar fechamento do caixa.' });
  }
}
// Botão principal "Fechar Caixa" abre o modal com linhas e totais preenchidos
document.getElementById('btnCloseCashier')?.addEventListener('click', openCloseCashierModal);

// Botão principal "Lançar Despesa" abre o modal preparado
document.getElementById('btnAddExpense')?.addEventListener('click', () => {
  const d = new Date().toISOString().slice(0,10);
  setVal('exp-desc', '');
  setVal('exp-amount', '');
  setVal('exp-method', 'cash');
  setVal('exp-category', 'operacional');
  setVal('exp-date', d);
  setChecked('exp-fixed', false);
  setVal('exp-notes', '');
  new bootstrap.Modal(document.getElementById('expenseModal')).show();
});

// Carregar ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
  loadCashierStatus();
});
