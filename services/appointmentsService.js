// services/appointmentsService.js
const { Appointment, Barber, Client, ServiceType } = require('../models');
const { Op } = require('sequelize');

function normalizeDate(date) {
  return typeof date === 'string'
    ? date.slice(0, 10)
    : new Date(date).toISOString().slice(0, 10);
}

function addMinutes(hhmm, mins) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  const t = h * 60 + m + (Number(mins) || 0);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// 🔹 pega barbeiros ativos com workingHours
async function getBarbers() {
  const rows = await Barber.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'workingHours', 'photo']
  });
  return rows.map(b => b.toJSON());
}

// 🔹 pega agendamentos do dia
async function getAppointmentsByDate(date) {
  const day = normalizeDate(date);

  const rows = await Appointment.findAll({
    where: { appointmentDate: day },
    attributes: [
      'id', 'barberId', 'appointmentTime',
      'serviceDuration', 'status', 'totalPrice'
    ],
    include: [
      { model: Client, as: 'client', attributes: ['firstName', 'lastName', 'phone'] },
      { model: ServiceType, as: 'serviceType', attributes: ['name', 'duration'] },
      { model: Barber, as: 'barber', attributes: ['name', 'photo'] }
    ],
    order: [['appointmentTime', 'ASC']]
  });

  return rows.map(r => {
    const j = r.toJSON();
    const start = (j.appointmentTime || '').slice(0, 5);
    const duration = Number(j.serviceDuration) || Number(j.serviceType?.duration) || 30;

    return {
      id: j.id,
      barberId: j.barberId,
      barberName: j.barber?.name || '',
      barberPhoto: j.barber?.photo || '/images/default-barber.png',
      status: j.status,
      startTime: start,
      endTime: addMinutes(start, duration),
      clientName: [j.client?.firstName, j.client?.lastName].filter(Boolean).join(' ') || '',
      clientPhone: j.client?.phone || '',
      serviceName: j.serviceType?.name || '',
      totalPrice: j.totalPrice || 0
    };
  });
}

module.exports = { getBarbers, getAppointmentsByDate };
