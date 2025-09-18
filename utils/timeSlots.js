function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}



function generateTimeSlots(startTime, endTime, bookedTimes = [], selectedDateStr = null, requiredDuration = 20) {
  const slots = [];
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime) + 1;
  const now = new Date();

  for (let t = start; t + requiredDuration <= end; t += 20) { // continua de 20 em 20
    let blocked = false;

    // percorre todos os pedaços da duração
    for (let dt = 0; dt < requiredDuration; dt += 10) {
      const candidate = minutesToTime(t + dt);
      if (bookedTimes.includes(candidate)) {
        blocked = true;
        break;
      }
    }

    // garante que o final do serviço não invade outro bloqueio
    const lastMinute = minutesToTime(t + requiredDuration - 10);
    if (bookedTimes.includes(lastMinute)) {
      blocked = true;
    }

    if (blocked) continue;

    const slot = minutesToTime(t);

    // não exibir horários já passados no dia atual
    if (selectedDateStr === now.toISOString().slice(0, 10)) {
      const slotDate = new Date(`${selectedDateStr}T${slot}:00`);
      if (slotDate < now) continue;
    }

     slots.push({
      time: slot,
      date: selectedDateStr 
    });
  }

  return slots;
}
function getBlockedTimesWithDuration(appointments) {
  const blocked = new Set();

  appointments.forEach(({ appointmentTime, serviceDuration, status }) => {
    if (status === 'cancelled' || status === 'no_show') {
      return;
    }

    const start = timeToMinutes(appointmentTime.slice(0, 5));
    const duration = parseInt(serviceDuration, 10) || 20;
    const buffer = 10; // 👈 tempo extra entre serviços
    const end = start + duration + buffer;

    for (let t = start; t < end; t += 10) {
      blocked.add(minutesToTime(t));
    }
  });

  return Array.from(blocked);
}
module.exports = {
  generateTimeSlots,
  getBlockedTimesWithDuration
};
