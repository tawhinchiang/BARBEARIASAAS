const express = require('express');
const bcrypt = require('bcryptjs');
const { User, Appointment, Client, Barber, ServiceType } = require('../models');
const { generatePDF, generateCSV, gerarResumoDoRelatorio } = require('../utils/reportGenerator');

const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();
const { Op } = require('sequelize');
// Middleware de autenticação para todas as rotas do admin (exceto login e logout)
router.use((req, res, next) => {
  const publicRoutes = ['/login', '/logout'];
  const isPublic = publicRoutes.some(p => req.path.startsWith(p));
  if (isPublic) return next();
  return isAuthenticated(req, res, next);
});

// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ADMIN] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [ADMIN] Data:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ADMIN ERROR] ${message}`);
  console.error(`[${timestamp}] [ADMIN ERROR] Stack:`, error.stack);
};

// Middleware para todas as rotas admin (exceto login)
router.use('/dashboard', isAuthenticated);
router.use('/appointments', isAuthenticated);
router.use('/reports', isAuthenticated);

// Página de login administrativo
router.get('/login', (req, res) => {
  log('Acessando página de login administrativo');

  if (req.session.user) {
    log('Usuário já logado, redirecionando para dashboard', { user: req.session.user });
    return res.redirect('/admin/dashboard');
  }

  log('Renderizando página de login');
  res.render('admin/login', {
    title: 'Login Administrativo',
    layout: 'admin',
    error: req.query.error
  });
});

// Processar login administrativo
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    log('Tentativa de login', { username, passwordLength: password ? password.length : 0 });

    if (!username || !password) {
      log('Login falhou: campos obrigatórios não preenchidos');
      return res.redirect('/admin/login?error=Usuário e senha são obrigatórios');
    }

    log('Buscando usuário no banco de dados', { username });
    const user = await User.findOne({
      where: { username, isActive: true },
      attributes: ['id', 'username', 'password', 'role', 'isActive']
    });

    if (!user) {
      log('Login falhou: usuário não encontrado ou inativo', { username });
      return res.redirect('/admin/login?error=Credenciais inválidas');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    log('Resultado da verificação de senha', { passwordMatch });

    if (!passwordMatch) {
      log('Login falhou: senha incorreta', { username });
      return res.redirect('/admin/login?error=Credenciais inválidas');
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    log('Login realizado com sucesso', {
      sessionUser: req.session.user,
      sessionId: req.sessionID
    });

    res.redirect('/admin/dashboard');
  } catch (error) {
    logError('Erro no processo de login', error);
    res.redirect('/admin/login?error=Erro interno do servidor');
  }
});

router.get('/logout', (req, res) => {
  log('Realizando logout', { user: req.session.user });
  req.session.destroy((err) => {
    if (err) {
      logError('Erro ao destruir sessão', err);
    } else {
      log('Sessão destruída com sucesso');
    }
    res.redirect('/admin/login');
  });
});

// Dashboard administrativo

router.get('/dashboard', async (req, res) => {
  try {
    log('Acessando dashboard', { user: req.session.user });

    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDateYYYYMMDD = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const monthlyStats = await Appointment.count({
      where: { appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] } }
    });

    const monthlyRevenue = await Appointment.sum('totalPrice', {
      where: {
        appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] },
        status: 'confirmed'
      }
    }) || 0;

    const todayAppointments = await Appointment.findAll({
      where: {
      appointmentDate: formatDateYYYYMMDD(today),
      status: 'confirmed'
  },
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order: [['appointmentTime', 'ASC']]
    });

    const statusStats = await Appointment.findAll({
      attributes: ['status', [require('sequelize').fn('COUNT', require('sequelize').col('status')), 'count']],
      where: { appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] } },
      group: ['status'],
      raw: true
    });

    // Receita dos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);

    const datesToTrack = [];
    for (let i = 0; i < 7; i++) {
      const temp = new Date(sevenDaysAgo);
      temp.setDate(sevenDaysAgo.getDate() + i);
      datesToTrack.push(formatDateYYYYMMDD(temp));
    }

    const appointmentsForRevenue = await Appointment.findAll({
      attributes: ['appointmentDate', 'totalPrice'],
      where: {
        appointmentDate: { [Op.in]: datesToTrack },
        status: { [Op.in]: ['confirmed', 'completed'] }
      },
      raw: true
    });

    const revenueChartLabels = [];
    const revenueChartData = [];
    datesToTrack.forEach(dateStr => {
      const dayName = diasSemana[new Date(dateStr).getDay()];
      revenueChartLabels.push(dayName);
      revenueChartData.push(0);
    });

    appointmentsForRevenue.forEach(item => {
      const index = datesToTrack.indexOf(formatDateYYYYMMDD(new Date(item.appointmentDate)));
      if (index !== -1) {
        revenueChartData[index] += parseFloat(item.totalPrice || 0);
      }
    });

    const topBarbersRaw = await Appointment.findAll({
      attributes: [
        'barberId',
        [require('sequelize').fn('COUNT', require('sequelize').col('barberId')), 'appointmentCount'],
        [require('sequelize').fn('SUM', require('sequelize').col('totalPrice')), 'totalRevenue']
      ],
      where: {appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] },
      status: { [Op.in]: ['confirmed'] }
},
      include: [{ model: Barber, as: 'barber', attributes: ['name'] }],
      group: ['barberId', 'barber.id'],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('barberId')), 'DESC']],
      limit: 5,
      raw: true,
      nest: true
    });

    const topBarbers = topBarbersRaw.map(item => ({
      name: item.barber.name,
      appointmentCount: item.appointmentCount,
      totalRevenue: item.totalRevenue
    }));

      const topServicesRaw = await Appointment.findAll({
      attributes: [
        'serviceTypeId',
        [require('sequelize').fn('COUNT', require('sequelize').col('serviceTypeId')), 'appointmentCount'],
        [require('sequelize').fn('SUM', require('sequelize').col('totalPrice')), 'totalRevenue']
      ],
       where: {
      appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] },
      status: 'confirmed'
     },
      include: [{ model: ServiceType, as: 'serviceType', attributes: ['name', 'duration', 'price'] }],
      group: ['serviceTypeId', 'serviceType.id'],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('serviceTypeId')), 'DESC']],
      limit: 5,
      raw: true,
      nest: true
    });

    const topServices = topServicesRaw.map(item => ({
      name: item.serviceType.name,
      duration: item.serviceType.duration,
      price: item.serviceType.price,
      appointmentCount: item.appointmentCount,
      totalRevenue: item.totalRevenue,
      percentage: 0
    }));

    const formattedRecentAppointments = todayAppointments.map(app => {
      const [year, month, day] = app.appointmentDate.split('-');
      const localDate = new Date(year, month - 1, day);
      return {
        ...app.toJSON(),
        appointmentDateFormatted: localDate.toLocaleDateString('pt-BR'),
        appointmentTimeFormatted: app.appointmentTime.slice(0, 5)
      };
    });

    res.render('admin/dashboard', {
      title: 'Dashboard Administrativo',
      layout: 'admin',
      user: req.session.user,
      todayAppointmentsCount: todayAppointments.length,
      monthlyRevenue,
      monthlyStats,
      statusStatsCount: statusStats.length,
      recentAppointments: formattedRecentAppointments,
      topBarbers,
      topServices,
      revenueChartLabels,
      revenueChartData
    });
  } catch (error) {
    logError('Erro no dashboard', error);
    res.render('admin/dashboard', {
      title: 'Dashboard Administrativo',
      layout: 'admin',
      user: req.session.user,
      error: 'Erro ao carregar dados'
    });
  }
});


// Listagem e gerenciamento de agendamentos - CORRIGIDA
// Listagem e gerenciamento de agendamentos - COM ORDENAÇÃO E FILTROS COMPLETOS
router.get('/appointments', async (req, res) => {
  try {
    log('Acessando listagem de agendamentos', {
      user: req.session.user,
      query: req.query
    });

    const { startDate, endDate, barberId, status, sort } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    let whereClause = {};

    if (startDate && endDate) {
      whereClause.appointmentDate = {
        [require('sequelize').Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.appointmentDate = {
        [require('sequelize').Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.appointmentDate = {
        [require('sequelize').Op.lte]: endDate
      };
    }

    if (barberId) {
      whereClause.barberId = barberId;
    }

    if (status) {
      whereClause.status = status;
    }

    // Define ordenação dinâmica
    let order = [];
    switch (sort) {
      case 'date_asc':
        order = [['appointmentDate', 'ASC'], ['appointmentTime', 'ASC']];
        break;
      case 'date_desc':
        order = [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']];
        break;
      case 'value_asc':
        order = [['totalPrice', 'ASC']];
        break;
      case 'value_desc':
        order = [['totalPrice', 'DESC']];
        break;
      case 'barber_asc':
        order = [[require('sequelize').literal('"barber"."name"'), 'ASC']];
        break;
      case 'barber_desc':
        order = [[require('sequelize').literal('"barber"."name"'), 'DESC']];
        break;
      default:
        order = [['appointmentDate', 'DESC'], ['appointmentTime', 'ASC']];
    }

    log('Filtros aplicados', { whereClause, sort, order, page, limit, offset });

    const { count, rows: appointments } = await Appointment.findAndCountAll({
      where: whereClause,
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order,
      limit,
      offset
    });

    const barbers = await Barber.findAll({ where: { isActive: true } });
    const totalPages = Math.ceil(count / limit);
    const formattedAppointments = appointments.map(app => {
    const plain = app.toJSON();
    let dateFormatted = '';
    try {
      const rawDate = plain.appointmentDate;
      const safeDate = typeof rawDate === 'string'
        ? new Date(rawDate + 'T03:00:00')
        : new Date(rawDate);
      if (!isNaN(safeDate)) {
        dateFormatted = safeDate.toLocaleDateString('pt-BR');
      }
    } catch (err) {
      console.error('Erro ao formatar appointmentDate:', err);
    }

    return {
      ...plain,
      appointmentDateFormatted: dateFormatted,
      appointmentTimeFormatted: plain.appointmentTime?.slice(0, 5)
    };
  });

    res.render('admin/appointments', {
      title: 'Gerenciar Agendamentos',
      layout: 'admin',
      user: req.session.user,
      appointments:formattedAppointments,
      barbers,
      filters: { startDate, endDate, barberId, status, sort },
      pagination: {
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('[DEBUG ERRO]', error);
    logError('Erro ao listar agendamentos', error);
    res.render('admin/appointments', {
      title: 'Gerenciar Agendamentos',
      layout: 'admin',
      user: req.session.user,
      error: 'Erro ao carregar agendamentos'
    });
  }
});


// Atualizar status do agendamento
router.post('/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    log('Atualizando status do agendamento', { id, status, user: req.session.user });
    
    const result = await Appointment.update(
      { status },
      { where: { id } }
    );
    
    log('Status atualizado', { id, status, affectedRows: result[0] });
    
    res.json({ success: true });
  } catch (error) {
    logError('Erro ao atualizar status', error);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// Relatórios administrativos - CORRIGIDA
router.get('/reports', async (req, res) => {
  try {
    log('Acessando relatórios', { user: req.session.user, query: req.query });
    
    const { startDate, endDate, barberId, status, sort } = req.query;

    
    let whereClause = {};
    
    if (startDate && endDate) {
      whereClause.appointmentDate = {
        [require('sequelize').Op.between]: [startDate, endDate]
      };
    }

    if (status) {whereClause.status = status;}

    if (barberId) {whereClause.barberId = barberId;}
    
    log('Filtros de relatório aplicados', { whereClause });
    // 🔄 DEFINIR ORDENAMENTO ANTES DO findAll
      let order = [['appointmentDate', 'DESC']]; // padrão
  
      switch (sort) {
      case 'date_asc':
        order = [['appointmentDate', 'ASC']];
        break;
      case 'value_desc':
        order = [['totalPrice', 'DESC']];
        break;
      case 'value_asc':
        order = [['totalPrice', 'ASC']];
        break;
      case 'barber_asc':
        order = [[{ model: Barber, as: 'barber' }, 'name', 'ASC']];
        break;
      case 'barber_desc':
        order = [[{ model: Barber, as: 'barber' }, 'name', 'DESC']];
        break;
      }

      const appointments = await Appointment.findAll({
        where: whereClause,
        include: [
          { model: Client, as: 'client' },
          { model: Barber, as: 'barber', attributes: ['id', 'name'], required: true },
          { model: ServiceType, as: 'serviceType' }
        ],

        order
      }); // padrão

    const formattedAppointments = appointments.map(app => {
      const plain = app.toJSON();
      const date = new Date(plain.appointmentDate + 'T03:00:00');
      return {
        ...plain,
        appointmentDateFormatted: !isNaN(date) ? date.toLocaleDateString('pt-BR') : '',
        appointmentTimeFormatted: plain.appointmentTime?.slice(0, 5)
          };
    });



    log('Dados do relatório carregados', { appointmentsCount: appointments.length });
    
    const barbers = await Barber.findAll({ where: { isActive: true } });
    
    // Estatísticas para relatórios
    const stats = {
      total: appointments.length,
      byStatus: {},
      byBarber: {},
      totalRevenue: 0
    };
    
    appointments.forEach(apt => {
      // Contagem Por status
      console.log(`Status: ${apt.status} - Preço: ${apt.totalPrice}`);
      stats.byStatus[apt.status] = (stats.byStatus[apt.status] || 0) + 1;
      
      // Contagem Por barbeiro
      const barberKey = `${apt.barber?.id} - ${apt.barber?.name || 'Desconhecido'}`;
      stats.byBarber[barberKey] = (stats.byBarber[barberKey] || 0) + 1;

      
      // Receita total
      // Receita total - ignorar agendamentos cancelados
      if (apt.totalPrice && apt.status !== 'cancelled') {
        stats.totalRevenue += parseFloat(apt.totalPrice);
      }

    });
    
    log('Estatísticas do relatório calculadas', { stats });
    console.log('[DEBUG] formattedAppointments:', formattedAppointments);

    res.render('admin/reports', {
      title: 'Relatórios',
      layout: 'admin',
      user: req.session.user,
      appointments: formattedAppointments,
      barbers,
      stats,
      filters: { startDate, endDate, barberId, status, sort }

    });

  } catch (error) {
    logError('Erro ao gerar relatórios', error);
    res.render('admin/reports', {
      title: 'Relatórios',
      layout: 'admin',
      user: req.session.user,
      error: 'Erro ao carregar relatórios'
    });
  }
});

// Exportar relatórios (PDF/CSV) - CORRIGIDA
// Exemplo da rota corrigida
router.post('/reports/export', isAuthenticated, async (req, res) => {
  try {
    const { format, startDate, endDate, barberId, status, sort } = req.body;

    // Construção do filtro base
    const where = {};

    if (startDate && endDate) {
      where.appointmentDate = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      where.appointmentDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.appointmentDate = { [Op.lte]: endDate };
    }
    
    if (typeof status === 'string' && status.trim() !== '') {
      where.status = status;
    }
    
    if (typeof barberId === 'string' && barberId.trim() !== '') {
      where.barberId = barberId;
    }
    

    // Ordenação
    let order = [['appointmentDate', 'DESC']];
    if (sort === 'date_asc') order = [['appointmentDate', 'ASC']];
    else if (sort === 'value_desc') order = [['totalPrice', 'DESC']];
    else if (sort === 'value_asc') order = [['totalPrice', 'ASC']];
    else if (sort === 'barber_asc') order = [[{ model: Barber }, 'name', 'ASC']];
    else if (sort === 'barber_desc') order = [[{ model: Barber }, 'name', 'DESC']];

    // Buscar dados com Sequelize
    const appointments = await Appointment.findAll({
      where,
      order,
      include: [
        { model: Client, as: 'client' },
        {
          model: Barber,
          as: 'barber',
          attributes: ['id', 'name'],
          required: !!barberId  // Só força o JOIN se estiver filtrando por barbeiro
        },
        { model: ServiceType, as: 'serviceType' }
      ]
    });

    // Gerar relatório com os filtros aplicados
    const filename = `relatorio-${Date.now()}.${format}`;
    const reportInfo = gerarResumoDoRelatorio(appointments, startDate, endDate, barberId); // você precisa montar esse resumo

    if (format === 'pdf') {
      const filePath = await generatePDF(appointments, reportInfo, filename);
      return res.download(filePath);
    } else if (format === 'csv') {
      const filePath = await generateCSV(appointments, filename);
      return res.download(filePath);
    } else {
      return res.status(400).json({ error: 'Formato inválido.' });
    }
  } catch (error) {
    console.error('[EXPORT ERROR]', error);
    res.status(500).json({ error: 'Erro ao gerar relatório.' });
  }
});



router.get('/appointments/:id', async (req, res) => {
    // const { id } = req.params;

  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      log('ID inválido fornecido', { id: req.params.id });
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    log('Buscando agendamento por ID', { id });
    
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Client, as: 'client', attributes: ['firstName', 'lastName', 'phone', 'email'] },
        { model: Barber, as: 'barber', attributes: ['name'] },
        { model: ServiceType, as: 'serviceType', attributes: ['name', 'duration', 'price'] }
      ]
    });

    if (!appointment) {
      log('Agendamento não encontrado', { id });
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    }

    log('Agendamento encontrado', { id, client: `${appointment.client.firstName} ${appointment.client.lastName}` });
    
    res.json({ success: true, appointment });

  } catch (error) {
    logError('Erro ao buscar agendamento', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});


router.patch('/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    log('Atualizando status do agendamento', { id, status });
    
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status inválido',
        validStatuses
      });
    }
    
    const appointment = await Appointment.findByPk(id);
    
    if (!appointment) {
      log('Agendamento não encontrado', { id });
      return res.status(404).json({ 
        success: false, 
        error: 'Agendamento não encontrado' 
      });
    }
    
    await appointment.update({ status });
    
    log('Status atualizado com sucesso', { id, oldStatus: appointment.status, newStatus: status });
    
    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      appointment: {
        id: appointment.id,
        status: appointment.status
      }
    });
    
  } catch (error) {
    logError('Erro ao atualizar status', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});


router.delete('/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    log('Cancelando agendamento', { id });
    
    const appointment = await Appointment.findByPk(id);
    
    if (!appointment) {
      log('Agendamento não encontrado', { id });
      return res.status(404).json({ 
        success: false, 
        error: 'Agendamento não encontrado' 
      });
    }
    
    await appointment.update({ status: 'cancelled' });
    
    log('Agendamento cancelado com sucesso', { id });
    
    res.json({
      success: true,
      message: 'Agendamento cancelado com sucesso'
    });
    
  } catch (error) {
    logError('Erro ao cancelar agendamento', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Confirmar agendamento
router.post('/api/appointments/:id/confirm', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });

    await appointment.update({ status: 'confirmed' });
    res.json({ success: true });
  } catch (error) {
    logError('Erro ao confirmar agendamento', error);
    res.status(500).json({ error: 'Erro ao confirmar agendamento' });
  }
});


// Marcar como concluído
router.post('/appointments/:id/complete', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });

    await appointment.update({ status: 'completed' });
    res.json({ success: true });
  } catch (error) {
    logError('Erro ao concluir agendamento', error);
    res.status(500).json({ error: 'Erro ao concluir agendamento' });
  }
});


// Cancelar agendamento com motivo
router.post('/api/appointments/:id/cancel', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });

    const { reason } = req.body; // Motivo opcional
    await appointment.update({ status: 'cancelled' });
    res.json({ success: true, reason });
  } catch (error) {
    logError('Erro ao cancelar agendamento', error);
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});


router.post('/api/appointments/:id/whatsapp', async (req, res) => {
  try {
    const id = req.params.id;
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ]
    });

    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });

    const msg = `Olá, ${appointment.client.firstName}! Seu agendamento em nossa barbearia está confirmado para o dia ${appointment.appointmentDate} às ${appointment.appointmentTime}.`;
    const sent = await sendWhatsAppMessage(appointment.client.phone, msg);

    if (!sent) throw new Error('Erro ao enviar WhatsApp');

    await appointment.update({ whatsappSent: true });

    res.json({ success: true });
  } catch (err) {
    console.error('[WHATSAPP ERROR]', err);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});


router.get('/appointments/:id/edit', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ]
    });

    const barbers = await Barber.findAll({ where: { isActive: true } });
    const services = await ServiceType.findAll({ where: { isActive: true } });

    res.render('admin/appointments-edit', {
      title: 'Editar Agendamento',
      layout: 'admin',
      appointment: appointment.toJSON(),
      barbers,
      services
    });
  } catch (err) {
    res.status(500).send('Erro ao carregar agendamento');
  }
});


router.put('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  const { serviceTypeId, barberId, appointmentDate, appointmentTime } = req.body;

  try {
    const updated = await Appointment.update(
      { serviceTypeId, barberId, appointmentDate, appointmentTime },
      { where: { id } }
    );

    if (updated[0] === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao editar agendamento:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

 // ===== ROTAS DE BARBEIROS =====
    router.use('/barbers', require('./barbers'));
  
    
    // ===== ROTAS DE SERVIÇOS =====
    router.use('/services', require('./services'));
module.exports = router;

