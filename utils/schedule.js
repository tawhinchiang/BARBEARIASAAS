function buildTimeSlots(appointments, barbers, step = 30) {
  // 1) Coletar todos os horários distintos
  const timesSet = new Set(appointments.map(a => a.appointmentTimeFormatted));
  const times = Array.from(timesSet).sort();

  // 2) Para cada horário, montar as células por barbeiro
  const slots = times.map(time => {
    const cells = barbers.map(barber => {
      const appt = appointments.find(
        a => String(a.barberId) === String(barber.id) &&
             a.appointmentTimeFormatted === time
      );
      return {
        barber,
        appointment: appt && appt.status !== 'free' ? appt : null,
        status: appt ? appt.status : 'free'
      };
    });
    return { time, cells };
  });

  return slots;
}
