const express = require('express');
const router = express.Router();
const { CashSession, Expense, Payment, Appointment } = require('../models');
const { Op } = require('sequelize');

/**
 * 🔹 Abrir caixa
 * POST /admin/cashier/open
 */
router.post('/admin/cashier/open', async (req, res) => {
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

/**
 * 🔹 Registrar despesa
 * POST /admin/expenses
 */
router.post('/admin/expenses', async (req, res) => {
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

/**
 * 🔹 Fechar caixa
 * POST /admin/cashier/close
 */
router.post('/admin/cashier/close', async (req, res) => {
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

/**
 * 🔹 Sessão atual + resumo
 * GET /admin/cashier/session/current
 */
router.get('/admin/cashier/session/current', async (req, res) => {
  try {
    const session = await CashSession.findOne({
      where: { status: 'open' },
      include: [{ model: Expense, as: 'expenses' }]
    });

    if (!session) {
      return res.json({ success: true, session: null });
    }

    // Entradas de pagamentos vinculadas
    const payments = await Payment.findAll({
      where: { cashSessionId: session.id }
    });

    const resumoPorMetodo = payments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + parseFloat(p.amount);
      return acc;
    }, {});

    const totalEntradas = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalDespesas = session.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    res.json({
      success: true,
      session,
      resumo: {
        entradas: resumoPorMetodo,
        totalEntradas,
        totalDespesas,
        saldoEsperado: parseFloat(session.openingAmount) + totalEntradas - totalDespesas
      }
    });
  } catch (err) {
    console.error('[CAIXA CURRENT ERROR]', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar sessão atual' });
  }
});

/**
 * 🔹 Histórico de sessões
 * GET /admin/cashier/sessions
 */
router.get('/admin/cashier/sessions', async (req, res) => {
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
// Middleware para garantir que só admin acesse
function ensureAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).render('errors/403', { layout: 'main', title: 'Acesso Negado' });
  }
  next();
}

router.get('/admin/cashier', ensureAdmin, async (req, res) => {
  try {
    res.render('cashier', {
      layout: 'admin',    // usa o layout de administrador
      title: 'Caixa',
      user: req.user      // passa o usuário para handlebars
    });
  } catch (err) {
    console.error('[CAIXA VIEW ERROR]', err);
    res.status(500).send('Erro ao carregar tela de caixa');
  }
});


module.exports = router;
