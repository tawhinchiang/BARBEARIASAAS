// public/js/appointments-schedule.js
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.js-open-fitin');
  if (!btn) return;

  const td = btn.closest('.slot-cell');
  const barberId = td?.dataset.barber;
  const time = td?.dataset.time;
  const url = new URL(window.location.href);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0,10);

  // Abra o modal existente do "Encaixe"
  const openBtn = document.getElementById('openFitInBtn');
  if (openBtn) openBtn.click(); // reusa o gatilho atual do modal

  // Preencha seus inputs do modal
  // Ajuste os IDs/nomes abaixo conforme seu modal (ex.: select de barbeiro, campo data/hora do encaixe)
  setTimeout(() => {
    const barberSelect = document.querySelector('#fitInModal select[name="barberId"]');
    const dateInput = document.querySelector('#fitInModal input[name="appointmentDate"]');
    const timeInput = document.querySelector('#fitInModal input[name="appointmentTime"]');

    if (barberSelect) barberSelect.value = String(barberId);
    if (dateInput) dateInput.value = date;
    if (timeInput) timeInput.value = time;
  }, 200);
});
