const express = require('express');
const router = express.Router();
const { CashSession, Expense, Payment, Appointment } = require('../models');
const { Op } = require('sequelize');
const { isAuthenticated } = require('../middleware/auth'); 


// Middleware de admin
function ensureAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/admin/login');
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).send('Acesso negado: apenas administradores');
  }
  next();
}


router.use(isAuthenticated);
router.use(ensureAdmin);
// --- Normalização de métodos de pagamento (use em todo o app) ---
function normalizeMethod(raw) {
  const s = String(raw || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (!s) return 'other';
  if (/(dinheiro|cash|money)/.test(s)) return 'cash';
  if (/(credito|credit|cc|cartao.*credito)/.test(s)) return 'credit';
  if (/(debito|debit|cd|cartao.*debito)/.test(s)) return 'debit';
  if (/\bpix\b/.test(s)) return 'pix';
  return 'other';
}

router.get('/', async (req, res) => {
  try {
    res.render('cashier', { 
      layout: 'admin',     
      title: 'Caixa' 
    });
  } catch (err) {
    console.error('[CAIXA VIEW ERROR]', err);
    res.status(500).send('Erro ao carregar tela de caixa');
  }
});


router.post('/open', async (req, res) => {
  try {
    const { openingAmount, userId } = req.body;

    // Verifica se já existe sessão aberta
    const existing = await CashSession.findOne({ where: { status: 'open' } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Já existe um caixa aberto.' });
    }

    const session = await CashSession.create({
      openingAmount,
      openedByUserId: userId || null
    });

    res.json({ success: true, session });
  } catch (err) {
    console.error('[CAIXA OPEN ERROR]', err);
    res.status(500).json({ success: false, error: 'Erro ao abrir caixa' });
  }
});


router.post('/expenses', async (req, res) => {
  try {
    const { description, amount, method, userId } = req.body;

    // Verifica sessão aberta
    const session = await CashSession.findOne({ where: { status: 'open' } });
    if (!session) {
      return res.status(400).json({ success: false, error: 'Não há caixa aberto.' });
    }

    const expense = await Expense.create({
      cashSessionId: session.id,
      description,
      amount,
      method: method || 'cash',
      createdByUserId: userId || null
    });

    res.json({ success: true, expense });
  } catch (err) {
    console.error('[CAIXA EXPENSE ERROR]', err);
    res.status(500).json({ success: false, error: 'Erro ao registrar despesa' });
  }
});


router.post('/close', async (req, res) => {
  try {
    const { countedCash, notes, userId } = req.body;

    const session = await CashSession.findOne({ where: { status: 'open' } });
    if (!session) {
      return res.status(400).json({ success: false, error: 'Não há caixa aberto.' });
    }

    await session.update({
      closedAt: new Date(),
      closedByUserId: userId || null,
      countedCash,
      notes,
      status: 'closed'
    });

    res.json({ success: true, session });
  } catch (err) {
    console.error('[CAIXA CLOSE ERROR]', err);
    res.status(500).json({ success: false, error: 'Erro ao fechar caixa' });
  }
});


router.get('/session/current', async (req, res) => {
  try {
    const session = await CashSession.findOne({
      where: { status: 'open' },
      include: [{ model: Expense, as: 'expenses' }]
    });

    if (!session) {
      return res.json({ success: true, session: null });
    }

    // Entradas de pagamentos vinculadas ao caixa
    const payments = await Payment.findAll({ where: { cashSessionId: session.id } });

    // Entradas "brutas" (chaves como estão no banco)
    const entradasRaw = payments.reduce((acc, p) => {
      const k = p.method || 'other';
      acc[k] = (acc[k] || 0) + parseFloat(p.amount || 0);
      return acc;
    }, {});

    // Entradas normalizadas p/ conjunto fixo
    const entradas = payments.reduce((acc, p) => {
      const m = normalizeMethod(p.method);
      acc[m] = (acc[m] || 0) + parseFloat(p.amount || 0);
      return acc;
    }, { cash: 0, credit: 0, debit: 0, pix: 0, other: 0 });

    // Despesas por método (opcional), também normalizadas
    const despesasByMethod = (session.expenses || []).reduce((acc, e) => {
      const m = normalizeMethod(e.method || 'other');
      acc[m] = (acc[m] || 0) + parseFloat(e.amount || 0);
      return acc;
    }, { cash: 0, credit: 0, debit: 0, pix: 0, other: 0 });

    const totalEntradas = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalDespesas = (session.expenses || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const saldoEsperado = parseFloat(session.openingAmount || 0) + totalEntradas - totalDespesas;

    res.json({
      success: true,
      session,
      resumo: {
        entradasRaw,            // como está no banco (diagnóstico)
        entradas,               // normalizado (use no front e relatório)
        despesasByMethod,       // opcional: despesas por método
        totalEntradas,
        totalDespesas,
        saldoEsperado
      }
    });
  } catch (err) {
    console.error('[CAIXA CURRENT ERROR]', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar sessão atual' });
  }
});


function normalizeRange(from, to) {
  // YYYY-MM-DD -> Date 00:00:00 e 23:59:59
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end   = to   ? new Date(`${to}T23:59:59`) : null;
  return { start, end };
}

// GET /admin/cashier/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&pageSize=20
router.get('/sessions', async (req, res) => {
  try {
    const { from, to, page = 1, pageSize = 20 } = req.query;
    const { start, end } = normalizeRange(from, to);

    const where = {};
    if (start || end) {
      // Filtra por data de abertura (mais estável)
      where.openedAt = {};
      if (start) where.openedAt[Op.gte] = start;
      if (end)   where.openedAt[Op.lte] = end;
    }

    const limit = Math.max(1, Math.min(parseInt(pageSize) || 20, 100));
    const offset = (Math.max(1, parseInt(page) || 1) - 1) * limit;

  const { rows, count } = await CashSession.findAndCountAll({
  where,
  order: [['openedAt', 'DESC']],
  limit,
  offset,
  distinct: true,      
  subQuery: false,     
  include: [
    { model: Payment, as: 'payments', attributes: ['id','amount','method'] },
    { model: Expense, as: 'expenses', attributes: ['id','amount'] }
  ]
});


    const sessions = rows.map(s => {
      const entradasTotal = (s.payments || []).reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const despesasTotal = (s.expenses || []).reduce((acc, e) => acc + Number(e.amount || 0), 0);
      const resultado = entradasTotal - despesasTotal;
      const cashExpected = (s.payments || [])
        .filter(p => p.method === 'cash')
        .reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const countedCash = Number(s.countedCash || 0);
      const diffCash = countedCash - cashExpected; // diferença só de dinheiro

      return {
        id: s.id,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        status: s.status,
        openingAmount: Number(s.openingAmount || 0),
        entradasTotal,
        despesasTotal,
        resultado,
        countedCash,
        diffCash
      };
    });

    res.json({
      success: true,
      pagination: {
        page: Number(page),
        pageSize: limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      },
      sessions
    });
  } catch (err) {
    console.error('[History] list error', err);
    res.status(500).json({ success: false, error: 'Erro ao listar sessões.' });
  }
});

// GET /admin/cashier/sessions/:id
router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const s = await CashSession.findByPk(id, {
      include: [
        { model: Payment, as: 'payments', attributes: ['id','amount','method','receivedAt'] },
        { model: Expense, as: 'expenses', attributes: ['id','amount','method','description','createdAt'] }
      ]
    });
    if (!s) return res.status(404).json({ success: false, error: 'Sessão não encontrada.' });

    const byMethod = { cash:0, credit_card:0, debit_card:0, pix:0, voucher:0, other:0 };
    for (const p of (s.payments || [])) {
      const k = byMethod.hasOwnProperty(p.method) ? p.method : 'other';
      byMethod[k] += Number(p.amount || 0);
    }
    const entradasTotal = Object.values(byMethod).reduce((a,b)=>a+b,0);
    const despesasTotal = (s.expenses || []).reduce((a,e)=>a + Number(e.amount||0), 0);
    const resultado = entradasTotal - despesasTotal;
    const cashExpected = byMethod.cash || 0;
    const countedCash = Number(s.countedCash || 0);
    const diffCash = countedCash - cashExpected;

    res.json({
      success: true,
      session: {
        id: s.id,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        status: s.status,
        openingAmount: Number(s.openingAmount || 0),
        countedCash,
        entradasByMethod: byMethod,
        entradasTotal,
        despesasTotal,
        resultado,
        diffCash,
        payments: s.payments,
        expenses: s.expenses
      }
    });
  } catch (err) {
    console.error('[History] detail error', err);
    res.status(500).json({ success: false, error: 'Erro ao detalhar sessão.' });
  }
});


module.exports = router;
