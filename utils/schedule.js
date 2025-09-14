function buildTimeSlots(appointments, barbers, step = 30) {
  const timesSet = new Set(appointments.map(a => a.appointmentTimeFormatted));
  const times = Array.from(timesSet).sort();

  return times.map(time => {
    const cells = barbers.map(barber => {
      const appt = appointments.find(
        a => String(a.barberId) === String(barber.id) &&
             a.appointmentTimeFormatted === time
      );
      return {
        barber,
        appointment: appt && appt.status !== 'free' ? appt : null,
        status: appt ? appt.status : 'free',
        time
      };
    });
    return { time, cells };
  });
}

module.exports = { buildTimeSlots };   // ✅ named export
