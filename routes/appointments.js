const express = require('express');
const moment = require('moment');
const { Client, Barber, ServiceType, Appointment } = require('../models');
const router = express.Router();

// Criar novo agendamento
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, phone, barberId, serviceTypeId, appointmentDate, appointmentTime } = req.body;
    
    // Validações básicas
    if (!firstName || !lastName || !phone || !barberId || !serviceTypeId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ 
        success: false, 
        error: 'Todos os campos são obrigatórios' 
      });
    }
    
    // Verificar se barbeiro e serviço existem
    const barber = await Barber.findByPk(barberId);
    const serviceType = await ServiceType.findByPk(serviceTypeId);
    
    if (!barber || !serviceType) {
      return res.status(404).json({ 
        success: false, 
        error: 'Barbeiro ou serviço não encontrado' 
      });
    }
    
    // Verificar se horário está disponível
    const existingAppointment = await Appointment.findOne({
      where: {
        barberId,
        appointmentDate,
        appointmentTime
      }
    });
    
    if (existingAppointment) {
      return res.status(409).json({ 
        success: false, 
        error: 'Horário não disponível' 
      });
    }
    
    // Verificar se cliente já existe
    let client = await Client.findOne({
      where: { phone: phone.replace(/\D/g, '') }
    });
    
    // Criar cliente se não existir
    if (!client) {
      client = await Client.create({
        firstName,
        lastName,
        phone: phone.replace(/\D/g, ''),
        isActive: true
      });
    }
    
    // Criar agendamento
    const appointment = await Appointment.create({
      clientId: client.id,
      barberId,
      serviceTypeId,
      appointmentDate,
      appointmentTime,
      status: 'scheduled',
      totalPrice: serviceType.price,
      whatsappSent: false
    });
    
    // Enviar mensagem WhatsApp
    try {
      const { sendWhatsAppMessage } = require('../utils/whatsapp');
      const message = `🎉 *Agendamento Confirmado!*

📅 *Data:* ${moment(appointmentDate).format('DD/MM/YYYY')}
🕐 *Horário:* ${appointmentTime}
✂️ *Serviço:* ${serviceType.name}
👨‍💼 *Barbeiro:* ${barber.name}
👤 *Cliente:* ${firstName} ${lastName}

💰 *Valor:* R$ ${parseFloat(serviceType.price).toFixed(2)}

📍 *${process.env.BARBERSHOP_NAME || 'Barbearia Premium'}*
Obrigado pela preferência!`;

      await sendWhatsAppMessage(client.phone, message);
      
      // Marcar como enviado
      await appointment.update({ whatsappSent: true });
    } catch (whatsappError) {
      console.error('Erro ao enviar WhatsApp:', whatsappError);
      // Não falhar o agendamento por erro no WhatsApp
    }
    
    res.json({ 
      success: true, 
      appointmentId: appointment.id,
      message: 'Agendamento criado com sucesso!' 
    });
    
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Buscar agendamento por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ]
    });
    
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agendamento não encontrado' 
      });
    }
    
    res.json({ 
      success: true, 
      appointment 
    });
    
  } catch (error) {
    console.error('Erro ao buscar agendamento:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Cancelar agendamento
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ]
    });
    
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agendamento não encontrado' 
      });
    }
    
    // Atualizar status para cancelado
    await appointment.update({ status: 'cancelled' });
    
    // Enviar mensagem de cancelamento via WhatsApp
    try {
      const { sendWhatsAppMessage } = require('../utils/whatsapp');
      const message = `❌ *Agendamento Cancelado*

📅 *Data:* ${moment(appointment.appointmentDate).format('DD/MM/YYYY')}
🕐 *Horário:* ${appointment.appointmentTime}
✂️ *Serviço:* ${appointment.serviceType.name}
👨‍💼 *Barbeiro:* ${appointment.barber.name}

📍 *${process.env.BARBERSHOP_NAME || 'Barbearia Premium'}*
Para reagendar, entre em contato conosco.`;

      await sendWhatsAppMessage(appointment.client.phone, message);
    } catch (whatsappError) {
      console.error('Erro ao enviar WhatsApp de cancelamento:', whatsappError);
    }
    
    res.json({ 
      success: true, 
      message: 'Agendamento cancelado com sucesso!' 
    });
    
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;

