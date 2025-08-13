const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Barber, Appointment, ServiceType, Client } = require('../models');
const { isAuthenticated } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [BARBERS] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [BARBERS] Data:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [BARBERS ERROR] ${message}`);
  console.error(`[${timestamp}] [BARBERS ERROR] Stack:`, error.stack);
};

// Configuração do multer para upload de fotos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../public/uploads/barbers');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'barber-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (JPEG, JPG, PNG, GIF)'));
    }
  }
});

// Middleware de autenticação para todas as rotas
router.use((req, res, next) => {
  if (req.path.startsWith('/api/barbers')) {
    return next(); // Rota pública - não exige autenticação
  }
  return isAuthenticated(req, res, next); // Resto precisa de login
});

// ===== PÁGINA PRINCIPAL - LISTAR BARBEIROS =====
router.get('/', async (req, res) => {
  try {
    log('Carregando página de barbeiros');

    const barbers = await Barber.findAll({
      order: [['name', 'ASC']],
      include: [
        {
          model: Appointment,
          as: 'appointments',
          attributes: ['id'],
          where: {
            appointmentDate: {
              [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          },
          required: false
        }
      ]
    });

    // Calcular estatísticas para cada barbeiro
    const barbersWithStats = barbers.map(barber => {
      const appointmentsCount = barber.appointments ? barber.appointments.length : 0;
      return {
        ...barber.toJSON(),
        appointmentsThisMonth: appointmentsCount
      };
    });

    log(`${barbers.length} barbeiros carregados`);
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    res.render('admin/barbers', {

      title: 'Gerenciar Barbeiros',
      pageTitle: 'Gerenciar Barbeiros',
      barbers: barbersWithStats,
      layout: 'admin'
    });
  } catch (error) {
    logError('Erro ao carregar barbeiros', error);
    res.render('admin/barbers', {
      title: 'Gerenciar Barbeiros',
      barbers: [],
      error: 'Erro ao carregar barbeiros',
      layout: 'admin'
    });
  }
});

// ===== CRIAR BARBEIRO =====
router.post('/create', upload.single('photo'), async (req, res) => {
  try {
    log('Criando novo barbeiro', req.body);

    const { name, phone, email, cpf, specialties, workingHours, isActive } = req.body;

    // Validações
    if (!name || !phone || !cpf) {
      return res.status(400).json({
        success: false,
        error: 'Nome, telefone e CPF são obrigatórios'
      });
    }

    // Verificar se CPF já existe
    let existingBarber = null;
    try {
      existingBarber = await Barber.findOne({ where: { cpf } });
    } catch (error) {
      logError('Erro ao verificar CPF duplicado', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar CPF duplicado'
      });
    }

    if (existingBarber) {
      return res.status(400).json({
        success: false,
        error: 'CPF já cadastrado'
      });
    }


    const barberData = {
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : null,
      cpf: cpf.trim(),
      specialties: specialties ? specialties.trim() : null,
      workingHours: typeof workingHours === 'object' ? workingHours : barber.workingHours,
      isActive: isActive === 'true' || isActive === true || isActive === 'on',
      photo: req.file ? `/uploads/barbers/${req.file.filename}` : null
    };

    const barber = await Barber.create(barberData);

    log('Barbeiro criado com sucesso', { id: barber.id, name: barber.name, photo: barber.photo });
    console.log('Barbeiro criado:', barber.toJSON()); // <-- Adicione isso
    res.json({
      success: true,
      message: 'Barbeiro criado com sucesso',
      barber: barber
    });

  } catch (error) {
    logError('Erro ao criar barbeiro', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== BUSCAR BARBEIRO POR ID =====
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    log(`Buscando barbeiro ID: ${id}`);

    const barber = await Barber.findByPk(id, {
      include: [
        {
          model: Appointment,
          as: 'appointments',
          include: [
            { model: ServiceType, as: 'serviceType' }
          ],
          order: [['appointmentDate', 'DESC']],
          limit: 10
        }
      ]
    });

    if (!barber) {
      return res.status(404).json({
        success: false,
        error: 'Barbeiro não encontrado'
      });
    }

    log('Barbeiro encontrado', { id: barber.id, name: barber.name });

    res.json({
      success: true,
      barber: barber
    });
  } catch (error) {
    logError('Erro ao buscar barbeiro', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== ATUALIZAR BARBEIRO =====
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    log(`Atualizando barbeiro ID: ${id}`, req.body);

    const barber = await Barber.findByPk(id);
    if (!barber) {
      return res.status(404).json({
        success: false,
        error: 'Barbeiro não encontrado'
      });
    }

    const { name, phone, email, cpf, specialties, workingHours, isActive } = req.body;

    // Verificar se CPF já existe em outro barbeiro
    if (cpf && cpf !== barber.cpf) {
      const existingBarber = await Barber.findOne({
        where: {
          cpf,
          id: { [Op.ne]: id }
        }
      });
      if (existingBarber) {
        return res.status(400).json({
          success: false,
          error: 'CPF já cadastrado para outro barbeiro'
        });
      }
    }

    const updateData = {
      name: name ? name.trim() : barber.name,
      phone: phone ? phone.trim() : barber.phone,
      email: email ? email.trim() : barber.email,
      cpf: cpf ? cpf.trim() : barber.cpf,
      specialties: specialties ? specialties.trim() : barber.specialties,
      workingHours: typeof workingHours === 'object' ? workingHours : null,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : barber.isActive
    };

    // Se nova foto foi enviada
    if (req.file) {
      // Remover foto antiga se existir
      if (barber.photo) {
        const oldPhotoPath = path.join(__dirname, '../public', barber.photo);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      updateData.photo = `/uploads/barbers/${req.file.filename}`;
    }

    await barber.update(updateData);

    log('Barbeiro atualizado com sucesso', { id: barber.id, name: barber.name });

    res.json({
      success: true,
      message: 'Barbeiro atualizado com sucesso',
      barber: barber
    });
  } catch (error) {
    logError('Erro ao atualizar barbeiro', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== DELETAR BARBEIRO =====
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    log(`Deletando barbeiro ID: ${id}`);

    const barber = await Barber.findByPk(id);
    if (!barber) {
      return res.status(404).json({
        success: false,
        error: 'Barbeiro não encontrado'
      });
    }

    // Verificar se tem agendamentos futuros
    const futureAppointments = await Appointment.count({
      where: {
        barberId: id,
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
        error: `Não é possível deletar. Barbeiro tem ${futureAppointments} agendamento(s) futuro(s).`
      });
    }

    // Remover foto se existir
    if (barber.photo) {
      const photoPath = path.join(__dirname, '../public', barber.photo);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    await barber.destroy();

    log('Barbeiro deletado com sucesso', { id, name: barber.name });

    res.json({
      success: true,
      message: 'Barbeiro deletado com sucesso'
    });
  } catch (error) {
    logError('Erro ao deletar barbeiro', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== RELATÓRIO DE BARBEIRO =====
router.get('/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    log(`Gerando relatório para barbeiro ID: ${id}`, { startDate, endDate });

    const barber = await Barber.findByPk(id);
    if (!barber) {
      return res.status(404).json({
        success: false,
        error: 'Barbeiro não encontrado'
      });
    }

    // Definir período (padrão: último mês)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getFullYear(), end.getMonth() - 1, 1);

    const appointments = await Appointment.findAll({
      where: { barberId: id, appointmentDate: { [Op.between]: [start, end] } },
      include: [
        { model: ServiceType, as: 'serviceType' },
        { model: Client, as: 'client', attributes: ['firstName', 'lastName'] } // ← essencial
      ],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']]
    });

    // Calcular estatísticas
    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(apt => apt.status === 'completed').length;
    const cancelledAppointments = appointments.filter(apt => apt.status === 'cancelled').length;
    const totalRevenue = appointments
      .filter(apt => apt.status === 'completed')
      .reduce((sum, apt) => sum + parseFloat(apt.totalPrice || 0), 0);

    // Agrupar por serviço
    const serviceStats = {};
    appointments.forEach(apt => {
      if (apt.serviceType) {
        const serviceName = apt.serviceType.name;
        if (!serviceStats[serviceName]) {
          serviceStats[serviceName] = { count: 0, revenue: 0 };
        }
        serviceStats[serviceName].count++;
        if (apt.status === 'completed') {
          serviceStats[serviceName].revenue += parseFloat(apt.totalPrice || 0);
        }
      }
    });

    const report = {
      barber: {
        id: barber.id,
        name: barber.name,
        photo: barber.photo
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
      serviceStats,
      appointments: appointments.map(apt => ({
        id: apt.id,
        date: apt.appointmentDate,
        time: apt.appointmentTime,
        service: apt.serviceType ? apt.serviceType.name : 'N/A',
        client: apt.client ? {
          firstName: apt.client.firstName,
          lastName: apt.client.lastName
        } : null,
        status: apt.status,
        price: apt.totalPrice
      }))

    };

    log('Relatório gerado com sucesso', {
      barberId: id,
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
    log(`Alterando status do barbeiro ID: ${id}`);

    const barber = await Barber.findByPk(id);
    if (!barber) {
      return res.status(404).json({
        success: false,
        error: 'Barbeiro não encontrado'
      });
    }

    await barber.update({ isActive: !barber.isActive });

    log(`Status alterado para ${barber.isActive ? 'ativo' : 'inativo'}`, {
      id: barber.id,
      name: barber.name
    });

    res.json({
      success: true,
      message: `Barbeiro ${barber.isActive ? 'ativado' : 'desativado'} com sucesso`,
      isActive: barber.isActive
    });
  } catch (error) {
    logError('Erro ao alterar status', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;

