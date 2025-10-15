console.log('[CASHIER] Página de Caixa carregada');

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

async function apiFetch(url, options = {}) {
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options.headers || {})
    },
    signal: options.signal, 
  });
  return resp.json();
}


// Constantes/UI helpers
const METHOD_ORDER = ['cash', 'credit', 'debit', 'pix', 'other'];
const LABELS = { cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX', other: 'Outros' };
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function renderPaymentList(obj = {}) {
  return METHOD_ORDER.map(key => {
    const valor = Number(obj[key] || 0);
    return `<li><strong>${LABELS[key]}:</strong> ${money(valor)}</li>`;
  }).join('');
}
const setVal = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
const setChecked = (id, checked) => { const el = document.getElementById(id); if (el) el.checked = !!checked; };

// ===== Status / Resumo =====
async function loadCashierStatus() {
  try {
    const data = await apiFetch('/admin/cashier/session/current');
    const statusDiv = document.getElementById('cashierStatus');
    const summaryDiv = document.getElementById('cashierSummary');

    if (!data?.session) {
      statusDiv.innerHTML = `<span class="badge bg-secondary">Caixa Fechado</span>`;
      summaryDiv.innerHTML = `<div class="col-12"><p>Nenhum caixa aberto.</p></div>`;
      document.getElementById('btnOpenCashier').disabled = false;
      document.getElementById('btnAddExpense').disabled = true;
      document.getElementById('btnCloseCashier').disabled = true;
      return;
    }

    const openedAt = new Date(data.session.openedAt).toLocaleString('pt-BR');
    statusDiv.innerHTML = `
      <span class="badge bg-success">Caixa Aberto</span>
      <small class="text-muted ms-2">Aberto em: ${openedAt}</small>
    `;

    const resumo = data.resumo || {};
    const entradasByMeth = resumo.entradas || {};
    const despesasByMeth = resumo.despesasByMethod || null;
    const totalEntradas = Number(resumo.totalEntradas || 0);
    const totalDespesas = Number(resumo.totalDespesas || 0);
    const saldoEsperado = Number(resumo.saldoEsperado || 0);
    const resultado = totalEntradas - totalDespesas;

    let html = `
      <div class="col-md-4">
        <div class="card border-success h-100">
          <div class="card-body">
            <h6 class="card-title">Entradas por método</h6>
            <ul class="list-unstyled mb-0">${renderPaymentList(entradasByMeth)}</ul>
          </div>
        </div>
      </div>
    `;

    html += despesasByMeth ? `
      <div class="col-md-4">
        <div class="card border-warning h-100">
          <div class="card-body">
            <h6 class="card-title">Despesas por método</h6>
            <ul class="list-unstyled mb-0">${renderPaymentList(despesasByMeth)}</ul>
          </div>
        </div>
      </div>
    ` : `
      <div class="col-md-4">
        <div class="card border-warning h-100">
          <div class="card-body">
            <h6 class="card-title">Despesas</h6>
            <p class="mb-0">${money(totalDespesas)}</p>
          </div>
        </div>
      </div>
    `;

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

    document.getElementById('btnOpenCashier').disabled = true;
    document.getElementById('btnAddExpense').disabled = false;
    document.getElementById('btnCloseCashier').disabled = false;

  } catch (err) {
    console.error('[CASHIER LOAD ERROR]', err);
    notify?.({ type: 'error', message: 'Erro ao carregar status do caixa' });
  }
}

// ===== Abrir Caixa =====
document.getElementById('confirmOpenCashier')?.addEventListener('click', async () => {
  const openingAmount = parseFloat(document.getElementById('openingAmount').value) || 0;
  const data = await apiFetch('/admin/cashier/open', { method: 'POST', body: JSON.stringify({ openingAmount }) });

  if (data.success) {
    notify?.({ type: 'success', message: 'Caixa aberto com sucesso!' });
    bootstrap.Modal.getInstance(document.getElementById('openCashierModal'))?.hide();
    loadCashierStatus();
  } else {
    notify?.({ type: 'error', message: data.error || 'Erro ao abrir caixa' });
  }
});

// ===== Despesa =====
document.getElementById('btnAddExpense')?.addEventListener('click', () => {
  const d = new Date().toISOString().slice(0, 10);
  setVal('exp-desc', ''); setVal('exp-amount', ''); setVal('exp-method', 'cash'); setVal('exp-category', 'operacional'); setVal('exp-date', d);
  const el = document.getElementById('expenseModal');
  bootstrap.Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true }).show();
});

document.getElementById('exp-submit-btn')?.addEventListener('click', async () => {
  const description = document.getElementById('exp-desc')?.value?.trim() || '';
  const amount = parseFloat(document.getElementById('exp-amount')?.value) || 0;
  const method = document.getElementById('exp-method')?.value || 'cash';
  const category = document.getElementById('exp-category')?.value || 'operacional';
  const date = document.getElementById('exp-date')?.value || new Date().toISOString().slice(0, 10);

  if (!description || !(amount > 0)) { notify?.({ type: 'warning', message: 'Preencha descrição e um valor maior que 0,00.' }); return; }

  const btn = document.getElementById('exp-submit-btn'); const html = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Lançando...';

  const data = await apiFetch('/admin/cashier/expenses', { method: 'POST', body: JSON.stringify({ description, amount, method, category, date }) });

  btn.disabled = false; btn.innerHTML = html;

  if (data.success) {
    notify?.({ type: 'success', message: 'Despesa registrada com sucesso!' });
    bootstrap.Modal.getInstance(document.getElementById('expenseModal'))?.hide();
    loadCashierStatus();
  } else {
    notify?.({ type: 'error', message: data.error || 'Erro ao lançar despesa' });
  }
});

// ===== Fechar Caixa =====
async function fetchOpenCashSummary() {
  const data = await apiFetch('/admin/cashier/session/current');
  if (!data?.session) throw new Error('Nenhum caixa aberto.');
  const entradas = data?.resumo?.entradas || {};
  const despesas = Number(data?.resumo?.totalDespesas || 0);
  const expectedByMethod = {
    cash: Number(entradas.cash || 0),
    credit: Number(entradas.credit || 0),
    debit: Number(entradas.debit || 0),
    pix: Number(entradas.pix || 0),
    other: Number(entradas.other || 0)
  };
  const expectedTotal = Object.values(expectedByMethod).reduce((s, v) => s + Number(v || 0), 0);
  return { expectedByMethod, expectedTotal, expensesTotal: despesas };
}

async function openCloseCashierModal() {
  try {
    const { expectedByMethod, expectedTotal, expensesTotal } = await fetchOpenCashSummary();

    document.getElementById('cc-expected-total').textContent = money(expectedTotal);
    document.getElementById('cc-expenses-total').textContent = money(expensesTotal);
    document.getElementById('cc-result-expected').textContent = money(expectedTotal - expensesTotal);

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
          </div>
        </td>
        <td class="text-end" data-diff>R$ 0,00</td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById('cc-expected-sum').textContent = money(expectedTotal);
    document.getElementById('cc-counted-sum').value = 'R$ 0,00';
    document.getElementById('cc-diff-sum').textContent = 'R$ 0,00';
    document.getElementById('cc-diff-alert').classList.add('d-none');

    const onChange = () => {
      const rows = document.querySelectorAll('#cc-count-tbody tr');
      let sumCounted = 0, sumDiff = 0;
      rows.forEach(row => {
        const expText = row.querySelector('[data-expected]').textContent;
        const expected = parseFloat(expText.replace(/[R$\.\s]/g, '').replace(',', '.')) || 0;
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

    const el = document.getElementById('closeCashierModal');
    // descarta instância antiga (evita backdrop “preso”)
    const old = bootstrap.Modal.getInstance(el);
    if (old) old.dispose();
    bootstrap.Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true }).show();

  } catch (e) {
    console.error(e);
    notify?.({ type: 'error', message: e.message || 'Erro ao preparar fechamento do caixa.' });
  }
}
document.getElementById('btnCloseCashier')?.addEventListener('click', openCloseCashierModal);

document.getElementById('cc-submit-btn')?.addEventListener('click', async () => {
  const rows = document.querySelectorAll('#cc-count-tbody tr');
  if (!rows.length) { notify?.({ type: 'warning', message: 'Abra o modal de Fechar Caixa para informar as contagens por método.' }); return; }

  const counted = { cash: 0, credit: 0, debit: 0, pix: 0, other: 0 };
  rows.forEach(tr => {
    const method = tr.dataset.method; const val = parseFloat(tr.querySelector('.cc-count')?.value) || 0;
    if (method in counted) counted[method] = Math.max(0, Math.round(val * 100) / 100);
  });

  const btn = document.getElementById('cc-submit-btn'); const html = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Fechando...';

  const data = await apiFetch('/admin/cashier/close', { method: 'POST', body: JSON.stringify({ counted, countedCash: counted.cash }) });

  btn.disabled = false; btn.innerHTML = html;

  if (data.success) {
    notify?.({ type: 'success', message: 'Caixa fechado com sucesso!' });
    bootstrap.Modal.getInstance(document.getElementById('closeCashierModal'))?.hide();
    loadCashierStatus();
  } else {
    notify?.({ type: 'error', message: data.error || 'Erro ao fechar caixa' });
  }
});

// ===== Histórico =====
const hist = { page: 1, pageSize: 20, from: null, to: null };
let histAbortController = null;   
let histSeq = 0;   
document.getElementById('histSearchBtn')?.addEventListener('click', () => {
  hist.from = document.getElementById('histFrom').value || null;
  hist.to = document.getElementById('histTo').value || null;
  hist.pageSize = parseInt(document.getElementById('histPageSize').value) || 20;
  loadCashierHistory();
});
['histFrom', 'histTo', 'histPageSize'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => { hist.page = 1; });
});

document.querySelectorAll('#cashierHistoryCard [data-range]')?.forEach(btn => {
  btn.addEventListener('click', () => { 
    hist.page = 1; 
    applyQuickRange(btn.dataset.range); 
    document.getElementById('histSearchBtn').click(); 
  });
});

async function loadCashierHistory() {
  // cancela requisição anterior, se existir
  if (histAbortController) histAbortController.abort();
  histAbortController = new AbortController();

  // versão desta chamada
  const seq = ++histSeq;

  // (opcional) feedback visual de carregando
  const ul = document.getElementById('histPagination');
  if (ul) ul.innerHTML = '<li class="page-item disabled"><span class="page-link">Carregando...</span></li>';

  const params = new URLSearchParams();
  if (hist.from) params.set('from', hist.from);
  if (hist.to) params.set('to', hist.to);
  params.set('page', hist.page);
  params.set('pageSize', hist.pageSize);

  try {
    const data = await apiFetch(`/admin/cashier/sessions?${params.toString()}`, {
      signal: histAbortController.signal
    });

    // se outra busca mais nova foi feita, ignore esta resposta
    if (seq !== histSeq) return;

    if (!data?.success) {
      notify?.({ type: 'error', message: data?.error || 'Erro ao carregar histórico' });
      return;
    }
    renderHistTable(data.sessions);
    renderHistPagination(data.pagination);
    renderHistSummary(data.pagination);
  } catch (err) {
    // aborts são esperados ao trocar de página rapidamente
    if (err?.name !== 'AbortError') {
      console.error('[HIST LOAD ERROR]', err);
      notify?.({ type: 'error', message: 'Erro ao carregar histórico' });
    }
  }
}

function renderHistTable(list = []) {
  const tbody = document.getElementById('histTbody'); if (!tbody) return;

  tbody.innerHTML = list.map(s => {
    const entradas = fmtBRL(Number(s.entradasTotal || 0));
    const despesas = fmtBRL(Number(s.despesasTotal || 0));
    const resultado = fmtBRL(Number(s.resultado || 0));
    const diffCash = fmtBRL(Number(s.diffCash || 0));
    const statusBadge = s.status === 'closed'
      ? '<span class="badge text-bg-success">fechado</span>'
      : '<span class="badge text-bg-warning">aberto</span>';

    return `
      <tr>
        <td class="text-nowrap">${fmtDateTime(s.openedAt)}</td>
        <td class="text-nowrap">${s.closedAt ? fmtDateTime(s.closedAt) : '—'}</td>
        <td>${statusBadge}</td>
        <td class="text-end">${entradas}</td>
        <td class="text-end d-none d-sm-table-cell">${despesas}</td>
        <td class="text-end d-none d-sm-table-cell">${resultado}</td>
        <td class="text-end d-none d-sm-table-cell">${diffCash}</td>
        <td>
          <button class="btn btn-outline-light w-100 mb-2" data-view-session="${s.id}" title="Ver detalhes">
           <i class="fas fa-eye me-2"></i>
          </button>
      </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-view-session]')?.forEach(btn => {
    btn.addEventListener('click', () => openSessionDetail(btn.dataset.viewSession));
  });
}

function renderHistPagination(p) {
  const ul = document.getElementById('histPagination'); if (!ul) return;
  const { page, totalPages } = p; const pages = []; const max = Math.max(1, totalPages);

  const pushPage = (n, label = n, active = false, disabled = false) => {
    pages.push(`
      <li class="page-item ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${disabled ? '' : n}">${label}</a>
      </li>
    `);
  };

  pushPage(page - 1, '&laquo;', false, page <= 1);
  for (let i = Math.max(1, page - 2); i <= Math.min(max, page + 2); i++) pushPage(i, i, i === page, false);
  pushPage(page + 1, '&raquo;', false, page >= max);

  ul.innerHTML = pages.join('');
  ul.querySelectorAll('a[data-page]')?.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const n = parseInt(a.dataset.page);
      if (!n || n === hist.page) return;
      hist.page = n;
      loadCashierHistory();
    });
  });
}

function renderHistSummary(p) {
  const el = document.getElementById('histSummary'); if (!el) return;
  el.textContent = `Página ${p.page} de ${p.totalPages} — ${p.total} registros`;
}

async function openSessionDetail(id) {
  const data = await apiFetch(`/admin/cashier/sessions/${id}`);
  if (!data?.success) { notify?.({ type: 'error', message: data?.error || 'Erro ao carregar sessão' }); return; }
  const s = data.session;
  const body = document.getElementById('sessionDetailBody');

  const labels = { cash: 'Dinheiro', credit_card: 'Crédito', debit_card: 'Débito', pix: 'PIX', voucher: 'Voucher', other: 'Outros' };
  const methods = ['cash', 'credit_card', 'debit_card', 'pix', 'voucher', 'other'];
  const byMethod = s.entradasByMethod || {};
  body.innerHTML = `
    <div class="row g-2 mb-3">
      <div class="col-md-3"><div class="border rounded p-2"><div class="small text-muted">Abertura</div><div class="fw-bold">${fmtDateTime(s.openedAt)}</div></div></div>
      <div class="col-md-3"><div class="border rounded p-2"><div class="small text-muted">Fechamento</div><div class="fw-bold">${s.closedAt ? fmtDateTime(s.closedAt) : '—'}</div></div></div>
      <div class="col-md-3"><div class="border rounded p-2"><div class="small text-muted">Entradas</div><div class="fw-bold">${fmtBRL(s.entradasTotal || 0)}</div></div></div>
      <div class="col-md-3"><div class="border rounded p-2"><div class="small text-muted">Despesas</div><div class="fw-bold">${fmtBRL(s.despesasTotal || 0)}</div></div></div>
    </div>
    <div class="table-responsive">
      <table class="table table-sm">
        <thead><tr><th>Método</th><th class="text-end">Valor</th></tr></thead>
        <tbody>
          ${methods.map(k => `<tr><td>${labels[k]}</td><td class="text-end">${fmtBRL(byMethod[k] || 0)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="mt-2 small text-muted">Diferença (Dinheiro): <strong>${fmtBRL(s.diffCash || 0)}</strong></div>
  `;

  const el = document.getElementById('sessionDetailModal');
  const old = bootstrap.Modal.getInstance(el);
  if (old) old.dispose();
  bootstrap.Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true }).show();
}

// Helpers
function fmtBRL(n) { return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtDateTime(d) {
  const dt = new Date(d); const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function applyQuickRange(type) {
  const today = new Date(); const pad = (n) => String(n).padStart(2, '0');
  const fmt = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  let from, to;
  if (type === 'today') { from = to = fmt(today); }
  else if (type === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); from = to = fmt(y); }
  else if (type === 'week') { const start = new Date(today); start.setDate(today.getDate() - 6); from = fmt(start); to = fmt(today); }
  else if (type === 'month') { const start = new Date(today.getFullYear(), today.getMonth(), 1); from = fmt(start); to = fmt(today); }
  document.getElementById('histFrom').value = from || '';
  document.getElementById('histTo').value = to || '';
}

// Inicializações
document.addEventListener('DOMContentLoaded', () => {
  loadCashierStatus();
  if (document.getElementById('cashierHistoryCard')) {
    applyQuickRange('month');
    document.getElementById('histSearchBtn')?.click();
  }
});
