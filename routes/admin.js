const express = require('express');
const bcrypt = require('bcryptjs');
const { User, Appointment, Client, Barber, ServiceType } = require('../models');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Middleware para todas as rotas admin (exceto login)
router.use('/dashboard', isAuthenticated);
router.use('/appointments', isAuthenticated);
router.use('/reports', isAuthenticated);

// Página de login administrativo
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
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
    
    const user = await User.findOne({ where: { username, isActive: true } });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.redirect('/admin/login?error=Credenciais inválidas');
    }
    
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Erro no login:', error);
    res.redirect('/admin/login?error=Erro interno do servidor');
  }
});

// Logout administrativo
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Dashboard administrativo
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    // Estatísticas do mês
    const monthlyStats = await Appointment.count({
      where: {
        appointmentDate: {
          [require('sequelize').Op.between]: [startOfMonth, endOfMonth]
        }
      }
    });
    
    // Receita do mês
    const monthlyRevenue = await Appointment.sum('totalPrice', {
      where: {
        appointmentDate: {
          [require('sequelize').Op.between]: [startOfMonth, endOfMonth]
        },
        status: 'completed'
      }
    }) || 0;
    
    // Agendamentos de hoje
    const todayAppointments = await Appointment.findAll({
      where: {
        appointmentDate: today.toISOString().split('T')[0]
      },
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order: [['appointmentTime', 'ASC']]
    });
    
    // Estatísticas por status
    const statusStats = await Appointment.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('status')), 'count']
      ],
      where: {
        appointmentDate: {
          [require('sequelize').Op.between]: [startOfMonth, endOfMonth]
        }
      },
      group: ['status'],
      raw: true
    });
    
    res.render('admin/dashboard', {
      title: 'Dashboard Administrativo',
      layout: 'admin',
      user: req.session.user,
      monthlyStats,
      monthlyRevenue,
      todayAppointments,
      statusStats
    });
  } catch (error) {
    console.error('Erro no dashboard:', error);
    res.render('admin/dashboard', {
      title: 'Dashboard Administrativo',
      layout: 'admin',
      user: req.session.user,
      error: 'Erro ao carregar dados'
    });
  }
});

// Listagem e gerenciamento de agendamentos
router.get('/appointments', async (req, res) => {
  try {
    const { date, barberId, status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    let whereClause = {};
    
    if (date) {
      whereClause.appointmentDate = date;
    }
    if (barberId) {
      whereClause.barberId = barberId;
    }
    if (status) {
      whereClause.status = status;
    }
    
    const { count, rows: appointments } = await Appointment.findAndCountAll({
      where: whereClause,
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'ASC']],
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
      filters: { date, barberId, status },
      pagination: {
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
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
    
    await Appointment.update(
      { status },
      { where: { id } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// Relatórios administrativos
router.get('/reports', async (req, res) => {
  try {
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
    
    const appointments = await Appointment.findAll({
      where: whereClause,
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order: [['appointmentDate', 'DESC']]
    });
    
    const barbers = await Barber.findAll({ where: { isActive: true } });
    
    // Estatísticas para relatórios
    const stats = {
      total: appointments.length,
      byStatus: {},
      byBarber: {},
      totalRevenue: 0
    };
    
    appointments.forEach(apt => {
      // Por status
      stats.byStatus[apt.status] = (stats.byStatus[apt.status] || 0) + 1;
      
      // Por barbeiro
      const barberName = apt.barber.name;
      stats.byBarber[barberName] = (stats.byBarber[barberName] || 0) + 1;
      
      // Receita total
      if (apt.totalPrice) {
        stats.totalRevenue += parseFloat(apt.totalPrice);
      }
    });
    
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
    console.error('Erro ao gerar relatórios:', error);
    res.render('admin/reports', {
      title: 'Relatórios',
      layout: 'admin',
      user: req.session.user,
      error: 'Erro ao carregar relatórios'
    });
  }
});

// Exportar relatórios (PDF/CSV)
router.post('/reports/export', async (req, res) => {
  try {
    const { startDate, endDate, barberId, format } = req.body;
    
    // Validar formato
    if (!['pdf', 'csv'].includes(format)) {
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
    
    if (appointments.length === 0) {
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
        } catch (error) {
          console.error('Erro ao remover arquivo temporário:', error);
        }
      }, 5000);
    });
    
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

