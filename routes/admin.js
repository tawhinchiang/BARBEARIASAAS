const express = require('express');
const bcrypt = require('bcryptjs');
const { User, Appointment, Client, Barber, ServiceType } = require('../models');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();
const { Op } = require('sequelize');

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
      where: { appointmentDate: formatDateYYYYMMDD(today) },
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
      where: { appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] } },
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
      where: { appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] } },
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

    res.render('admin/appointments', {
      title: 'Gerenciar Agendamentos',
      layout: 'admin',
      user: req.session.user,
      appointments,
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
    
    const { startDate, endDate, barberId } = req.query;
    
    let whereClause = {};
    
    if (startDate && endDate) {
      whereClause.appointmentDate = {
        [require('sequelize').Op.between]: [startDate, endDate]
      };
    }
    
    if (barberId) {
      whereClause.barberId = barberId;
    }
    
    log('Filtros de relatório aplicados', { whereClause });
    
    const appointments = await Appointment.findAll({
      where: whereClause,
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order: [['appointmentDate', 'DESC']]
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
      const barberName = apt.barber.name;
      stats.byBarber[barberName] = (stats.byBarber[barberName] || 0) + 1;
      
      // Receita total
      // Receita total - ignorar agendamentos cancelados
      if (apt.totalPrice && apt.status !== 'cancelled') {
        stats.totalRevenue += parseFloat(apt.totalPrice);
      }

    });
    
    log('Estatísticas do relatório calculadas', { stats });
    
    res.render('admin/reports', {
      title: 'Relatórios',
      layout: 'admin',
      user: req.session.user,
      appointments,
      barbers,
      stats,
      filters: { startDate, endDate, barberId }
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
router.post('/reports/export', async (req, res) => {
  try {
    log('Iniciando exportação de relatório', { body: req.body, user: req.session.user });
    
    const { startDate, endDate, barberId, format } = req.body;
    
    // Validar formato
    if (!['pdf', 'csv'].includes(format)) {
      log('Formato de exportação inválido', { format });
      return res.status(400).json({ error: 'Formato inválido' });
    }
    
    // Construir filtros
    let whereClause = {};
    
    if (startDate && endDate) {
      whereClause.appointmentDate = {
        [require('sequelize').Op.between]: [startDate, endDate]
      };
    }
    
    if (barberId && barberId !== 'all') {
      whereClause.barberId = barberId;
    }
    
    log('Filtros de exportação aplicados', { whereClause });
    
    // Buscar dados
    const appointments = await Appointment.findAll({
      where: whereClause,
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'ASC']]
    });
    
    log('Dados para exportação carregados', { appointmentsCount: appointments.length });
    
    if (appointments.length === 0) {
      log('Nenhum agendamento encontrado para exportação');
      return res.status(404).json({ error: 'Nenhum agendamento encontrado para os filtros selecionados' });
    }
    
    // Calcular estatísticas
    const totalAppointments = appointments.length;
    const totalRevenue = appointments.reduce((sum, apt) => sum + parseFloat(apt.totalPrice || 0), 0);
    const completedAppointments = appointments.filter(apt => apt.status === 'completed').length;
    const cancelledAppointments = appointments.filter(apt => apt.status === 'cancelled').length;
    
    const reportInfo = {
      startDate: startDate || 'Início',
      endDate: endDate || 'Fim',
      barber: barberId === 'all' ? 'Todos os barbeiros' : 
              (appointments[0]?.barber?.name || 'Não especificado'),
      totalAppointments,
      totalRevenue,
      completedAppointments,
      cancelledAppointments
    };
    
    log('Informações do relatório calculadas', { reportInfo });
    
    const reportGenerator = require('../utils/reportGenerator');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    let filePath;
    let filename;
    let contentType;
    
    if (format === 'pdf') {
      filename = `relatorio-agendamentos-${timestamp}.pdf`;
      filePath = await reportGenerator.generatePDF(appointments, reportInfo, filename);
      contentType = 'application/pdf';
    } else {
      filename = `relatorio-agendamentos-${timestamp}.csv`;
      filePath = reportGenerator.generateCSV(appointments, filename);
      contentType = 'text/csv';
    }
   

    log('Arquivo de relatório gerado', { filename, filePath, contentType });
    
    // Enviar arquivo
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fs = require('fs');
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // Limpar arquivo após envio
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
          log('Arquivo temporário removido', { filePath });
        } catch (error) {
          logError('Erro ao remover arquivo temporário', error);
        }
      }, 5000);
    });
    
  } catch (error) {
    logError('Erro ao gerar relatório', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
 // ===== ROTAS DE BARBEIROS =====
    router.use('/barbers', require('./barbers'));

    
    // ===== ROTAS DE SERVIÇOS =====
    router.use('/services', require('./services'));
module.exports = router;

