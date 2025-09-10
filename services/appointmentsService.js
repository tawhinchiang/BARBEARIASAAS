// services/appointmentsService.js
const { Op } = require('sequelize');
const { Appointment, Barber, Client, ServiceType } = require('../models');

// Normaliza 'date' para 'YYYY-MM-DD' se vier Date/ISO
function normalizeDate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (typeof d === 'string') {
    // já vem 'YYYY-MM-DD' no seu admin (ex: where: { appointmentDate: '2025-09-10' })
    return d.length >= 10 ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
  }
  return new Date(d).toISOString().slice(0, 10);
}

function addMinutes(hhmm, minutes) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  const total = (h * 60 + m) + (Number(minutes) || 0);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Retorna barbeiros ativos com campos necessários para montar a grade
 * [{ id, name, workingHours }]
 */
async function getBarbers() {
  const rows = await Barber.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'workingHours']
  });
  return rows.map(b => b.toJSON());
}

/**
 * Retorna TODOS os agendamentos do dia para marcar os slots ocupados
 * Saída simplificada para a grade:
 * [{ id, barberId, status, startTime, endTime, clientName, serviceName }]
 */
async function getAppointmentsByDate(date) {
  const day = normalizeDate(date);

  const rows = await Appointment.findAll({
    where: { appointmentDate: day },
    attributes: [
      'id',
      'barberId',
      'appointmentTime',
      'serviceDuration',   // você já mantém no registro ao editar
      'status'
    ],
    include: [
      { model: Client, as: 'client', attributes: ['firstName', 'lastName'] },
      { model: ServiceType, as: 'serviceType', attributes: ['name', 'duration'] }
    ],
    order: [['appointmentTime', 'ASC']]
  });

  return rows.map(r => {
    const j = r.toJSON();
    const start = (j.appointmentTime || '').slice(0, 5);
    const duration =
      Number(j.serviceDuration) ||
      Number(j.serviceType?.duration) ||
      30; // fallback: 30 min

    return {
      id: j.id,
      barberId: j.barberId,
      status: j.status,
      startTime: start,
      endTime: addMinutes(start, duration),
      clientName: [j.client?.firstName, j.client?.lastName].filter(Boolean).join(' ') || '',
      serviceName: j.serviceType?.name || ''
    };
  });
}

module.exports = {
  getBarbers,
  getAppointmentsByDate
};
