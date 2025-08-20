const express = require('express');
const { ServiceType, Appointment } = require('../models');
const { isAuthenticated } = require('../middleware/auth');
const { Op } = require('sequelize');
const {
  ACTIVE_STATUSES,
  COMPLETED_STATUSES,
  VALID_FOR_REVENUE
} = require('../constants/appointmentStatuses');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'services');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const router = express.Router();

async function getAppointmentsCount(serviceId) {
  return await Appointment.count({
    where: {
      serviceTypeId: serviceId,
      appointmentDate: {
        [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    }
  });
}

async function getServiceRevenue(serviceId) {
  const completedAppointments = await Appointment.findAll({
    where: {
      serviceTypeId: serviceId,
      status: 'confirmed',
      appointmentDate: {
        [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    },
    attributes: ['totalPrice']
  });

  return completedAppointments.reduce((total, a) => {
    return total + parseFloat(a.totalPrice || 0);
  }, 0);
}

// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [SERVICES] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [SERVICES] Data:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [SERVICES ERROR] ${message}`);
  console.error(`[${timestamp}] [SERVICES ERROR] Stack:`, error.stack);
};

// Middleware de autenticação para todas as rotas
router.use(isAuthenticated);

// ===== PÁGINA PRINCIPAL - LISTAR SERVIÇOS =====
router.get('/', async (req, res) => {
  try {
    log('Carregando página de serviços');
    
const services = await ServiceType.findAll({
  order: [['name', 'ASC']]
});

const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

const servicesWithStats = await Promise.all(services.map(async (service) => {
  const appointments = await Appointment.findAll({
    where: {
      serviceTypeId: service.id,
      appointmentDate: {
        [Op.between]: [startOfMonth, endOfMonth]
      }
    }
  });

  const appointmentsThisMonth = appointments.length;
  const revenueThisMonth = appointments
    .filter(a => ['confirmed', 'completed'].includes(a.status))
    .reduce((acc, a) => acc + parseFloat(a.totalPrice || 0), 0);

  return {
    ...service.toJSON(),
    appointmentsThisMonth,
    revenueThisMonth: revenueThisMonth.toFixed(2)
  };
}));

    
    log(`${services.length} serviços carregados`);
    console.log(servicesWithStats);
    res.render('admin/services', {
      title: 'Gerenciar Serviços',
      services: servicesWithStats,
      layout: 'admin'
    });
  } catch (error) {
    logError('Erro ao carregar serviços', error);
    res.render('admin/services', {

      title: 'Gerenciar Serviços',
      pageTitle: 'Gerenciar Serviços',
    
      services: [],
      error: 'Erro ao carregar serviços',
      layout: 'admin'
    });
  }
});

// ===== CRIAR SERVIÇO =====
router.post('/create', upload.single('photo'), async (req, res) => {
  try {
    log('Criando novo serviço', { body: req.body, file: req.file?.filename });

    const { name, description, price, duration, isActive, isPromo } = req.body;
    const photo = req.file ? '/uploads/services/' + req.file.filename : null;
    if (!name || !price || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Nome, preço e duração são obrigatórios'
      });
    }
    
    const priceParsed = parseFloat(price);
    const durationParsed = parseInt(duration);

    if (isNaN(priceParsed) || priceParsed <= 0) {
      return res.status(400).json({ success: false, error: 'Preço inválido' });
    }

    if (isNaN(durationParsed) || durationParsed <= 0) {
      return res.status(400).json({ success: false, error: 'Duração inválida' });
    }
    // Verificar se nome já existe
    const existingService = await ServiceType.findOne({ 
      where: { name: name.trim() } 
    });
    if (existingService) {
      return res.status(400).json({
        success: false,
        error: 'Já existe um serviço com este nome'
      });
    }
    
    const serviceData = {
      name: name.trim(),
      description: description ? description.trim() : null,
      price: parseFloat(price),
      duration: parseInt(duration),
      isActive: isActive === 'true' || isActive === true,
      isPromo: isPromo === 'true' || isPromo === true,
      photo: photo || null
    };
    console.log('[DEBUG] Dados que vão para o banco:', serviceData); // 👈 Adicione isso aqui
    const service = await ServiceType.create(serviceData);
    
    log('Serviço criado com sucesso', { id: service.id, name: service.name });
    
    res.json({
      success: true,
      message: 'Serviço criado com sucesso',
      service: service
    });
  } catch (error) {
  logError('Erro ao criar serviço', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Erro interno do servidor' // ← Aqui!
  });
}

});

// ===== BUSCAR SERVIÇO POR ID =====
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    log(`Buscando serviço ID: ${id}`);
    
    const service = await ServiceType.findByPk(id, {
      include: [
        {
          model: Appointment,
          as: 'appointments',
          include: [
            { 
              model: require('../models').Barber, 
              as: 'barber',
              attributes: ['name']
            }
          ],
          order: [['appointmentDate', 'DESC']],
          limit: 10
        }
      ]
    });
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Serviço não encontrado'
      });
    }
    
    log('Serviço encontrado', { id: service.id, name: service.name });
    
    res.json({
      success: true,
      service: service
    });
  } catch (error) {
    logError('Erro ao buscar serviço', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== ATUALIZAR SERVIÇO =====
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    log(`Atualizando serviço ID: ${id}`, { body: req.body, file: req.file?.filename });
    
    const service = await ServiceType.findByPk(req.params.id);
    if (!service) return res.status(404).json({ success: false, error: 'Serviço não encontrado' });

    const { name, description, price, duration, isActive, isPromo } = req.body;
    const photo = req.file ? '/uploads/services/' + req.file.filename : service.photo;
    
    if (name && name.trim() !== service.name) {
      const existingService = await ServiceType.findOne({ 
        where: { 
          name: name.trim(),
          id: { [Op.ne]: id }
        }
      });
      if (existingService) {
        return res.status(400).json({
          success: false,
          error: 'Já existe outro serviço com este nome'
        });
      }
    }
    
    // Validar preço se fornecido
    if (price !== undefined && (isNaN(price) || parseFloat(price) <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'Preço deve ser um número válido maior que zero'
      });
    }
    
    // Validar duração se fornecida
    if (duration !== undefined && (isNaN(duration) || parseInt(duration) <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'Duração deve ser um número válido maior que zero'
      });
    }
    
    const updateData = {
      name: name ? name.trim() : service.name,
      description: description !== undefined ? (description ? description.trim() : null) : service.description,
      price: price !== undefined ? parseFloat(price) : service.price,
      duration: duration !== undefined ? parseInt(duration) : service.duration,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : service.isActive,
      isPromo: isPromo !== undefined ? (isPromo === 'true' || isPromo === true) : service.isPromo,
      photo
    };
    
    await service.update(updateData);
    
    log('Serviço atualizado com sucesso', { id: service.id, name: service.name });
    
    res.json({
      success: true,
      message: 'Serviço atualizado com sucesso',
      service: service
    });
  } catch (error) {
    logError('Erro ao atualizar serviço', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== DELETAR SERVIÇO =====
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    log(`Deletando serviço ID: ${id}`);
    
    const service = await ServiceType.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Serviço não encontrado'
      });
    }
    
    // Verificar se tem agendamentos futuros
    const futureAppointments = await Appointment.count({
      where: {
        serviceTypeId: id,
        appointmentDate: {
          [Op.gte]: new Date()
        },
        status: {
          [Op.notIn]: ['cancelled']
        }
      }
    });
    
    if (futureAppointments > 0) {
      return res.status(400).json({
        success: false,
        error: `Não é possível deletar. Serviço tem ${futureAppointments} agendamento(s) futuro(s).`
      });
    }
    
    await service.destroy();
    
    log('Serviço deletado com sucesso', { id, name: service.name });
    
    res.json({
      success: true,
      message: 'Serviço deletado com sucesso'
    });
  } catch (error) {
    logError('Erro ao deletar serviço', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== RELATÓRIO DE SERVIÇO =====
router.get('/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    log(`Gerando relatório para serviço ID: ${id}`, { startDate, endDate });
    
    const service = await ServiceType.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Serviço não encontrado'
      });
    }
    
    // Definir período (padrão: último mês)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getFullYear(), end.getMonth() - 1, 1);
    
    const appointments = await Appointment.findAll({
      where: {
        serviceTypeId: id,
        appointmentDate: {
          [Op.between]: [start, end]
        }
      },
      include: [
        { 
          model: require('../models').Barber, 
          as: 'barber',
          attributes: ['name']
        }
      ],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']]
    });
    
    // Calcular estatísticas
    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(apt => apt.status === 'completed').length;    const cancelledAppointments = appointments.filter(apt => apt.status === 'cancelled').length;
    const totalRevenue = appointments
      .filter(apt => apt.status === 'completed')
      .reduce((sum, apt) => sum + parseFloat(apt.totalPrice || 0), 0);
    
    // Agrupar por barbeiro
    const barberStats = {};
    appointments.forEach(apt => {
      if (apt.barber) {
        const barberName = apt.barber.name;
        if (!barberStats[barberName]) {
          barberStats[barberName] = { count: 0, revenue: 0 };
        }
        barberStats[barberName].count++;
        if (apt.status === 'confirmed') {
          barberStats[barberName].revenue += parseFloat(apt.totalPrice || 0);
        }
      }
    });
    
    // Agrupar por dia da semana
    const weekdayStats = {};
    const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    appointments.forEach(apt => {
      const weekday = weekdays[new Date(apt.appointmentDate).getDay()];
      if (!weekdayStats[weekday]) {
        weekdayStats[weekday] = { count: 0, revenue: 0 };
      }
      weekdayStats[weekday].count++;
      if (apt.status === 'completed') {
        weekdayStats[weekday].revenue += parseFloat(apt.totalPrice || 0);
      }
    });
    
    const report = {
      service: {
        id: service.id,
        name: service.name,
        price: service.price,
        duration: service.duration
      },
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      },
      summary: {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        totalRevenue,
        averagePerDay: totalAppointments / Math.ceil((end - start) / (1000 * 60 * 60 * 24))
      },
      barberStats,
      weekdayStats,
      appointments: appointments.map(apt => ({
        id: apt.id,
        date: apt.appointmentDate,
        time: apt.appointmentTime,
        barber: apt.barber ? apt.barber.name : 'N/A',
        client: `${apt.firstName} ${apt.lastName}`,
        status: apt.status,
        price: apt.totalPrice
      }))
    };
    
    log('Relatório gerado com sucesso', { 
      serviceId: id, 
      totalAppointments, 
      totalRevenue 
    });
    
    res.json({
      success: true,
      report: report
    });
  } catch (error) {
    logError('Erro ao gerar relatório', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== TOGGLE STATUS (ATIVAR/DESATIVAR) =====
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    log(`Alterando status do serviço ID: ${id}`);
    
    const service = await ServiceType.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Serviço não encontrado'
      });
    }
    
    await service.update({ isActive: !service.isActive });
    
    log(`Status alterado para ${service.isActive ? 'ativo' : 'inativo'}`, { 
      id: service.id, 
      name: service.name 
    });
    
    res.json({
      success: true,
      message: `Serviço ${service.isActive ? 'ativado' : 'desativado'} com sucesso`,
      isActive: service.isActive
    });
  } catch (error) {
    logError('Erro ao alterar status', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== TOGGLE PROMOÇÃO =====
router.patch('/:id/toggle-promo', async (req, res) => {
  try {
    const { id } = req.params;
    log(`Alterando promoção do serviço ID: ${id}`);
    
    const service = await ServiceType.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Serviço não encontrado'
      });
    }
    
    await service.update({ isPromo: !service.isPromo });
    
    log(`Promoção alterada para ${service.isPromo ? 'ativa' : 'inativa'}`, { 
      id: service.id, 
      name: service.name 
    });
    
    res.json({
      success: true,
      message: `Promoção ${service.isPromo ? 'ativada' : 'desativada'} com sucesso`,
      isPromo: service.isPromo
    });
  } catch (error) {
    logError('Erro ao alterar promoção', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});
router.get('/:id/partial', async (req, res) => {

  try {
    const id = req.params.id;
    const service = await ServiceType.findByPk(id);
    if (!service) return res.status(404).send('Serviço não encontrado');

    const appointmentsThisMonth = await getAppointmentsCount(id);
    const revenueThisMonth = await getServiceRevenue(id);

    res.render('partials/service-card', {
      layout: false,
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price,
      duration: service.duration,
      isActive: service.isActive,
      isPromo: service.isPromo,
      appointmentsThisMonth,
      revenueThisMonth
    });
  } catch (err) {
    res.status(500).send('Erro ao renderizar serviço');
  }
});

module.exports = router;

