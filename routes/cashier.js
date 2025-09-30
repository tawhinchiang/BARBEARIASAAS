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



router.get('/sessions', async (req, res) => {
  try {
    const sessions = await CashSession.findAll({
      order: [['openedAt', 'DESC']],
      include: [{ model: Expense, as: 'expenses' }]
    });

    res.json({ success: true, sessions });
  } catch (err) {
    console.error('[CAIXA SESSIONS ERROR]', err);
    res.status(500).json({ success: false, error: 'Erro ao listar sessões' });
  }
});




module.exports = router;
