const express = require('express');
const { sendWhatsAppMessage } = require('../utils/whatsapp');
const moment = require('moment');
const { Client, Barber, ServiceType, Appointment } = require('../models');
const router = express.Router();

// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [APPOINTMENTS] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [APPOINTMENTS] Data:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [APPOINTMENTS ERROR] ${message}`);
  console.error(`[${timestamp}] [APPOINTMENTS ERROR] Stack:`, error.stack);
};

// API para criar novo agendamento - CORRIGIDA
router.post('/api/appointments', async (req, res) => {
  try {
    log('Recebendo novo agendamento', req.body);
    
    const { serviceId, barberId, appointmentDate, appointmentTime, clientData } = req.body;
    
    // Validações básicas
    if (!serviceId || !barberId || !appointmentDate || !appointmentTime || !clientData) {
      log('Dados obrigatórios não fornecidos');
      return res.status(400).json({ 
        success: false, 
        error: 'Todos os campos são obrigatórios',
        received: { serviceId, barberId, appointmentDate, appointmentTime, hasClientData: !!clientData }
      });
    }
    
    const { firstName, lastName, phone } = clientData;
    
    if (!firstName || !lastName || !phone) {
      log('Dados do cliente incompletos');
      return res.status(400).json({ 
        success: false, 
        error: 'Dados do cliente são obrigatórios (nome, sobrenome, telefone)' 
      });
    }
    
    // Verificar se barbeiro e serviço existem
    log('Verificando barbeiro e serviço');
    const barber = await Barber.findByPk(barberId);
    const serviceType = await ServiceType.findByPk(serviceId);
    
    if (!barber || !serviceType) {
      log('Barbeiro ou serviço não encontrado', { barberFound: !!barber, serviceFound: !!serviceType });
      return res.status(404).json({ 
        success: false, 
        error: 'Barbeiro ou serviço não encontrado' 
      });
    }
    
    log('Barbeiro e serviço encontrados', {
      barber: { id: barber.id, name: barber.name },
      service: { id: serviceType.id, name: serviceType.name, price: serviceType.price }
    });
    
    // Verificar se horário está disponível
    log('Verificando disponibilidade do horário');
    const existingAppointment = await Appointment.findOne({
      where: {
        barberId,
        appointmentDate,
        appointmentTime
      }
    });
    
    if (existingAppointment) {
      log('Horário já ocupado', { barberId, appointmentDate, appointmentTime });
      return res.status(409).json({ 
        success: false, 
        error: 'Horário não disponível' 
      });
    }
    
    // Verificar se cliente já existe ou criar novo
    log('Verificando/criando cliente');
    const cleanPhone = phone.replace(/\D/g, '');
    
    let client = await Client.findOne({
      where: { phone: cleanPhone }
    });
    
    if (!client) {
      log('Criando novo cliente');
      client = await Client.create({
        firstName,
        lastName,
        phone: cleanPhone,
        email: clientData.email || null
      });
      log('Cliente criado', { id: client.id, name: `${client.firstName} ${client.lastName}` });
    } else {
      log('Cliente existente encontrado', { id: client.id, name: `${client.firstName} ${client.lastName}` });
      
      // Atualizar dados se necessário
      if (client.firstName !== firstName || client.lastName !== lastName) {
        await client.update({
          firstName,
          lastName,
          email: clientData.email || client.email
        });
        log('Dados do cliente atualizados');
      }
    }
    
    // Criar agendamento
    log('Criando agendamento');
  const appointment = await Appointment.create({
  clientId: client.id,
  barberId,
  serviceTypeId: serviceId,
  appointmentDate,
  appointmentTime,
  serviceDuration: serviceType.duration,   // ← SALVA A DURAÇÃO CORRETA
  totalPrice: serviceType.price,
  status: 'confirmed',
  notes: clientData.notes || null
});

    const fullName = `${client.firstName} ${client.lastName}`;
  // Corrigir aqui: declarar priceFormatted
    const priceNum = Number(serviceType.price);
    const priceFormatted = Number.isNaN(priceNum) ? '0.00' : priceNum.toFixed(2);

    const msg = `Olá, ${fullName}! 👋\n\nSeu agendamento foi confirmado com sucesso:\n🗓️ *Data:* ${appointmentDate}\n⏰ *Horário:* ${appointmentTime}\n✂️ *Serviço:* ${serviceType.name}\n💈 *Barbeiro:* ${barber.name}\n💰 *Valor:* R$ ${priceFormatted}\n\nAgradecemos pela preferência!`;

    const sent = await sendWhatsAppMessage(client.phone, msg);
    if (!sent) {
      logError('❌ Falha ao enviar mensagem pelo WhatsApp', { phone: client.phone });
    }
//  catch (whatsErr) {
//   logError('Erro ao enviar mensagem de WhatsApp', whatsErr);
// }

    log('Agendamento criado com sucesso', {
      id: appointment.id,
      client: `${client.firstName} ${client.lastName}`,
      barber: barber.name,
      service: serviceType.name,
      date: appointmentDate,
      time: appointmentTime,
      price: serviceType.price
    });
    
    // Retornar resposta simples sem buscar agendamento completo (para evitar erro de associação)
 
// Só depois responde ao frontend
res.status(201).json({
  success: true,
  message: 'Agendamento criado com sucesso',
  appointment: {
    id: appointment.id,
    client: {
      name: fullName,
      phone: client.phone,
      email: client.email
    },
    barber: barber.name,
    service: {
      name: serviceType.name,
      duration: serviceType.duration,
      price: priceNum
    },
    date: appointment.appointmentDate,
    time: appointment.appointmentTime,
    totalPrice: priceNum,
    status: appointment.status
  },
  whatsappSent: sent
});


 

    
  } catch (error) {
    logError('Erro ao criar agendamento', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// Rota legacy para compatibilidade
router.post('/', async (req, res) => {
  log('Redirecionando para nova API de agendamentos');
  
  // Transformar dados do formato antigo para o novo
  const { firstName, lastName, phone, barberId, serviceTypeId, appointmentDate, appointmentTime } = req.body;
  
  const newFormat = {
    serviceId: serviceTypeId,
    barberId,
    appointmentDate,
    appointmentTime,
    clientData: {
      firstName,
      lastName,
      phone,
      email: req.body.email
    }
  };
  
  // Redirecionar para nova rota
  req.body = newFormat;
  return router.handle(req, res);
});

// Listar agendamentos (para admin) - CORRIGIDA
// router.get('/', async (req, res) => {
//   try {
//     log('Listando agendamentos');
    
//     const { date, barberId, status, limit = 50, offset = 0 } = req.query;
    
//     const whereClause = {};
    
//     if (date) {
//       whereClause.appointmentDate = date;
//     }
    
//     if (barberId) {
//       whereClause.barberId = barberId;
//     }
    
//     if (status) {
//       whereClause.status = status;
//     }
    
//     const appointments = await Appointment.findAndCountAll({
//       where: whereClause,
//       include: [
//         { model: Client, as: 'client', attributes: ['firstName', 'lastName', 'phone', 'email'] },
//         { model: Barber, as: 'barber', attributes: ['name'] },
//         { model: ServiceType, as: 'serviceType', attributes: ['name', 'duration', 'price'] }
//       ],
//       order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']],
//       limit: parseInt(limit),
//       offset: parseInt(offset)
//     });
    
//     log('Agendamentos encontrados', { count: appointments.count, returned: appointments.rows.length });
    
//     const formattedAppointments = appointments.rows.map(app => {
//       const plain = app.toJSON();
//       let dateFormatted = '';
//       try {
//         const rawDate = plain.appointmentDate;
//         const safeDate = typeof rawDate === 'string'
//           ? new Date(rawDate + 'T03:00:00')
//           : new Date(rawDate);
//         if (!isNaN(safeDate)) {
//           dateFormatted = safeDate.toLocaleDateString('pt-BR');
//         }
//       } catch (err) {
//         console.error('Erro ao formatar appointmentDate:', err);
//       }

//       return {
//         ...plain,
//         appointmentDateFormatted: dateFormatted,
//         appointmentTimeFormatted: plain.appointmentTime?.slice(0, 5)
//       };
//     });




//     res.render('admin/appointments', {
//       title: 'Gerenciar Agendamentos',
//       layout: 'admin',
//       appointments: formattedAppointments,
//       user: req.session.user,
//       barbers: await Barber.findAll({ where: { isActive: true } }),
//       filters: req.query,
//       pagination: {
//         currentPage: 1,
//         totalPages: 1,
//         hasNext: false,
//         hasPrev: false
//       }
//     });

    
//   } catch (error) {
//     logError('Erro ao listar agendamentos', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Erro interno do servidor' 
//     });
//   }
// });



// Buscar agendamento por ID - CORRIGIDA

    
 
    
// router.get('/logout', (req, res) => {
//   log('Realizando logout', { user: req.session.user });
//   req.session.destroy((err) => {
//     if (err) {
//       logError('Erro ao destruir sessão', err);
//     } else {
//       log('Sessão destruída com sucesso');
//     }
//     res.redirect('/admin/login');
//   });
// });    
     


// Atualizar status do agendamento


// Cancelar agendamento



module.exports = router;

