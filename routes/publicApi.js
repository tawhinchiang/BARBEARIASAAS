const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const { Barber, ServiceType, Appointment, Client } = require('../models');

router.get('/barbers', async (req, res) => {
  try {
    const barbers = await Barber.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    res.json({
      count: barbers.length,
      barbers: barbers.map(b => ({
        id: b.id,
        name: b.name,
        photo: b.photo || null,
        specialties: b.specialties || 'Especialista',
        workingHours: b.workingHours || {},
        isActive: b.isActive
      }))
    });
  } catch (error) {
    console.error('[PUBLIC API] Erro ao buscar barbeiros:', error);
    res.status(500).json({ error: 'Erro interno ao buscar barbeiros' });
  }
});

router.get('/services', async (req, res) => {
  try {
    const services = await ServiceType.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'price', 'duration', 'photo', 'description'],
      order: [['name', 'ASC']]
    });
    res.json({ services });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao buscar serviços' });
  }
});

router.get('/dashboard-summary', async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const monthStart = startOfMonth.toLocaleDateString('en-CA');

    const [barbersCount, servicesCount, todayAppointments, monthAppointments, recent, revenueRows] = await Promise.all([
      Barber.count({ where: { isActive: true } }),
      ServiceType.count({ where: { isActive: true } }),
      Appointment.count({ where: { appointmentDate: today, status: { [Op.notIn]: ['cancelled', 'no_show'] } } }),
      Appointment.findAll({
        where: { appointmentDate: { [Op.gte]: monthStart } },
        attributes: ['status', 'totalPrice', 'appointmentDate']
      }),
      Appointment.findAll({
        include: [
          { model: Client, as: 'client', attributes: ['firstName', 'lastName'] },
          { model: Barber, as: 'barber', attributes: ['name'] },
          { model: ServiceType, as: 'serviceType', attributes: ['name'] }
        ],
        order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']],
        limit: 8
      }),
      Appointment.findAll({
        where: { appointmentDate: { [Op.gte]: monthStart }, status: 'completed' },
        attributes: ['totalPrice']
      })
    ]);

    const monthRevenue = revenueRows.reduce((s, r) => s + Number(r.totalPrice || 0), 0);
    const statusCounts = monthAppointments.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      today,
      kpis: {
        activeBarbers: barbersCount,
        activeServices: servicesCount,
        todayAppointments,
        monthAppointments: monthAppointments.length,
        monthRevenue
      },
      statusCounts,
      recent: recent.map(a => ({
        id: a.id,
        date: a.appointmentDate,
        time: String(a.appointmentTime || '').slice(0, 5),
        status: a.status,
        totalPrice: Number(a.totalPrice || 0),
        client: a.client ? `${a.client.firstName || ''} ${a.client.lastName || ''}`.trim() : (a.isBlock ? 'Bloqueio' : 'Cliente'),
        barber: a.barber?.name || '-',
        service: a.serviceType?.name || (a.isBlock ? 'Horário bloqueado' : 'Serviço')
      }))
    });
  } catch (error) {
    console.error('[PUBLIC API] dashboard-summary:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
