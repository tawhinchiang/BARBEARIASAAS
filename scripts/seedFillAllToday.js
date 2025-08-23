// scripts/seedFillAllToday.js
require('dotenv').config();

const { Appointment, Client, Barber, ServiceType } = require('../models');

const TIMEZONE = process.env.TIMEZONE || 'America/Araguaina';

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}
function weekdayKey(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: TIMEZONE });
  return fmt.format(d).toLowerCase(); // monday..sunday
}

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function toHHMM(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function parseRange(range) {
  // "08:00-12:00" -> [480, 720]
  const [a, b] = range.split('-');
  return [toMin(a), toMin(b)];
}
const isClosed = (v) => !v || v === 'closed';

/** Normaliza workingHours do dia (retorna lista de [start,end] em minutos) */
function dayIntervals(daySchedule) {
  const res = [];
  if (daySchedule?.morning && !isClosed(daySchedule.morning)) res.push(parseRange(daySchedule.morning));
  if (daySchedule?.afternoon && !isClosed(daySchedule.afternoon)) res.push(parseRange(daySchedule.afternoon));
  // garante ordenação
  return res.sort((a, b) => a[0] - b[0]);
}

/** Mescla intervalos ocupados sobrepostos */
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    const last = merged[merged.length - 1];
    if (s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }
  return merged;
}

/** Subtrai ocupados de permitidos: retorna lista de livres [s,e] */
function subtractIntervals(allowed, occupied) {
  const occ = mergeIntervals(occupied);
  const free = [];
  for (const [aStart, aEnd] of allowed) {
    let cursor = aStart;
    for (const [oStart, oEnd] of occ) {
      if (oEnd <= cursor) continue;         // ocupado antes
      if (oStart >= aEnd) break;             // ocupado depois
      if (oStart > cursor) free.push([cursor, Math.min(oStart, aEnd)]);
      cursor = Math.max(cursor, oEnd);
      if (cursor >= aEnd) break;
    }
    if (cursor < aEnd) free.push([cursor, aEnd]);
  }
  // remove vazios
  return free.filter(([s, e]) => e - s >= 5);
}

/** Tenta cobrir exatamente um intervalo com as durações disponíveis (em minutos). Retorna array de durações ou null */
function exactCover(total, durations) {
  // DP em unidades de 5 min para eficiência
  const step = 5;
  const T = Math.floor(total / step);
  const D = durations.map(d => Math.floor(d / step)).filter(x => x > 0);
  const prev = Array(T + 1).fill(-1); // guarda qual duração foi usada
  prev[0] = 0;
  for (let t = 1; t <= T; t++) {
    for (let i = 0; i < D.length; i++) {
      const d = D[i];
      if (t - d >= 0 && prev[t - d] !== -1) {
        prev[t] = i; // usamos D[i]
        break;
      }
    }
  }
  if (prev[T] === -1) return null;
  // reconstrói
  const out = [];
  let t = T;
  while (t > 0) {
    const i = prev[t];
    const d = D[i];
    out.push(d * step);
    t -= d;
  }
  return out.reverse();
}

/** Gera um plano de atendimentos [ {startMin, duration, serviceType} ... ] que cobre ao máximo [s,e] */
function planInterval(s, e, durations, durationToServices) {
  const total = e - s;
  // 1) tenta cobertura exata
  let seq = exactCover(total, durations);
  if (!seq) {
    // 2) ganancioso: menor duração até não caber mais
    const minD = Math.min(...durations);
    const out = [];
    let cur = s;
    while (cur + minD <= e) {
      out.push(minD);
      cur += minD;
    }
    seq = out;
  }
  // mapeia durações -> serviços concretos alternando entre opções
  const plan = [];
  let cur = s;
  const counters = new Map(); // duração -> índice
  for (const d of seq) {
    const list = durationToServices.get(d) || [];
    if (!list.length) continue; // pulo se não existir serviço com essa duração
    const idx = counters.get(d) || 0;
    const srv = list[idx % list.length];
    counters.set(d, idx + 1);
    plan.push({ startMin: cur, duration: d, serviceType: srv });
    cur += d;
  }
  return plan;
}

function normalizeWorkingHours(wh) {
  if (!wh) return null;
  if (typeof wh === 'string') {
    try { return JSON.parse(wh); } catch { return null; }
  }
  return wh;
}

async function getOrCreateClient(i) {
  const firstName = 'CLIENTE';
  const lastName = String(i).padStart(5, '0');
  const phone = `629991${String(1000 + i).slice(-4)}`;
  let client = await Client.findOne({ where: { phone } });
  if (!client) {
    client = await Client.create({ firstName, lastName, phone, email: null });
  }
  return client;
}

async function main() {
  const argv = process.argv.slice(2);
  const statusArg = argv.find(a => a.startsWith('--status=')) || '--status=completed';
  const onlyServiceNameArg = argv.find(a => a.startsWith('--serviceName='));
  const onlyServiceIdArg = argv.find(a => a.startsWith('--serviceId='));
  const STATUS = statusArg.split('=')[1];

  const date = todayStr();
  const weekday = weekdayKey(date);

  console.log(`➡️  Preenchendo TODOS os horários livres de ${date} (${weekday}) para barbeiros ativos. Status=${STATUS}`);

  const barbers = await Barber.findAll({ where: { isActive: true } });
  const servicesRaw = await ServiceType.findAll({ where: { isActive: true } });

  if (!barbers.length) throw new Error('Não há barbeiros ativos.');
  if (!servicesRaw.length) throw new Error('Não há serviços ativos.');

  // Filtra serviço único, se solicitado
  let services = servicesRaw;
  if (onlyServiceIdArg) {
    const id = parseInt(onlyServiceIdArg.split('=')[1], 10);
    services = servicesRaw.filter(s => s.id === id);
    if (!services.length) throw new Error(`serviceId=${id} não encontrado ou inativo.`);
  } else if (onlyServiceNameArg) {
    const name = decodeURIComponent(onlyServiceNameArg.split('=')[1]).toLowerCase();
    services = servicesRaw.filter(s => (s.name || '').toLowerCase().includes(name));
    if (!services.length) throw new Error(`Nenhum serviço com nome contendo "${name}".`);
  }

  // Mapa: duração -> [services...]
  const durationToServices = new Map();
  for (const s of services) {
    const d = parseInt(s.duration || 30, 10);
    if (!durationToServices.has(d)) durationToServices.set(d, []);
    durationToServices.get(d).push(s);
  }
  const durations = Array.from(durationToServices.keys()).sort((a, b) => a - b);
  if (!durations.length) throw new Error('Não há durações válidas nos serviços selecionados.');

  // Pré-carrega agendamentos do dia (qualquer status) para evitar colisões
  const existingToday = await Appointment.findAll({
    where: { appointmentDate: date },
    attributes: ['id', 'barberId', 'appointmentTime', 'serviceDuration'],
    raw: true
  });

  let created = 0;
  let clientCounter = 1;

  for (const b of barbers) {
    const wh = normalizeWorkingHours(b.workingHours);
    const day = wh?.[weekday];
    const allowed = dayIntervals(day);
    if (!allowed.length) {
      console.log(`- ${b.name}: sem expediente hoje -> pulando`);
      continue;
    }

    // Ocupados existentes deste barbeiro
    const occ = existingToday
      .filter(a => a.barberId === b.id)
      .map(a => [toMin(a.appointmentTime), toMin(a.appointmentTime) + parseInt(a.serviceDuration || 30, 10)]);

    // Livres = permitido - ocupado
    const free = subtractIntervals(allowed, occ);
    if (!free.length) {
      console.log(`- ${b.name}: já está 100% ocupado -> nada a fazer`);
      continue;
    }

    // Para cada intervalo livre, planeja e cria atendimentos
    for (const [s, e] of free) {
      const plan = planInterval(s, e, durations, durationToServices);
      for (const item of plan) {
        const client = await getOrCreateClient(clientCounter++);
        const srv = item.serviceType;
        await Appointment.create({
          clientId: client.id,
          barberId: b.id,
          serviceTypeId: srv.id,
          appointmentDate: date,
          appointmentTime: toHHMM(item.startMin),
          serviceDuration: item.duration,
          totalPrice: srv.price,
          status: STATUS,
          isEncaixe: false,
          notes: 'Seed fill-all (auto)'
        });
        created++;
        if (created % 25 === 0) {
          console.log(`  • Criados ${created} (último ${b.name} às ${toHHMM(item.startMin)} – ${srv.name})`);
        }
      }
    }

    console.log(`- ${b.name}: preenchimento concluído.`);
  }

  console.log(`\n🎉 Concluído. Agendamentos criados hoje: ${created}. Status=${STATUS}.`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Erro:', err); process.exit(1); });
