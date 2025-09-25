const express = require('express');
const bcrypt = require('bcryptjs');
const { User, Appointment, Client, Barber, ServiceType, CashSession, Expense, Payment } = require('../models');
const { generatePDF, generateCSV, gerarResumoDoRelatorio } = require('../utils/reportGenerator');
const { buildTimeSlots } = require('../utils/schedule.js')
const {
  disconnectWhatsApp,
  initializeWhatsApp,
  getWhatsAppStatus,
  getLastQRCode,
  sendWhatsAppMessage
} = require('../utils/whatsapp');
const { isAuthenticated, isAuthenticatedApi } = require('../middleware/auth');
const router = express.Router();

const { Op, literal } = require('sequelize');
const fs = require('fs'); // se ainda não tiver no topo
const todayStr = new Date().toLocaleDateString('en-CA');
const { generateTimeSlots, getBlockedTimesWithDuration } = require('../utils/timeSlots');
// ajuste conforme o banco usado

// admin.js (rotas admin) – helper no topo do arquivo
function buildOrder(sort) {
  const statusOrder = `CASE "Appointment"."status"
                         WHEN 'in_progress' THEN 1
                         WHEN 'confirmed'   THEN 2
                         WHEN 'completed'   THEN 3
                         ELSE 99
                       END`;
  switch (sort) {
    case 'date_asc': return [['appointmentDate', 'ASC'], ['appointmentTime', 'ASC'], [literal(statusOrder), 'ASC']];
    case 'date_desc': return [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC'], [literal(statusOrder), 'ASC']];
    case 'value_asc': return [['totalPrice', 'ASC']];
    case 'value_desc': return [['totalPrice', 'DESC']];
    case 'barber_asc': return [[literal('"barber"."name"'), 'ASC']];
    case 'barber_desc': return [[literal('"barber"."name"'), 'DESC']];
    default: return [['appointmentDate', 'ASC'], ['appointmentTime', 'ASC'], [literal(statusOrder), 'ASC']];
  }
}
// Helper para paginação numerada com "…"
function buildPages(current, total) {
  const pages = [];
  const delta = 2;
  const left = Math.max(1, current - delta);
  const right = Math.min(total, current + delta);
  if (left > 1) pages.push(1);
  if (left > 2) pages.push('...');     // ← aqui
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < total - 1) pages.push('...'); // ← e aqui
  if (right < total) pages.push(total);
  return pages;
}


// Middleware de autenticação para todas as rotas do admin (exceto login e logout)
router.use((req, res, next) => {
  const publicRoutes = ['/login', '/logout'];
  const isPublic = publicRoutes.some(p => req.path.startsWith(p));
  if (isPublic) return next();
  return isAuthenticated(req, res, next);
});

// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ADMIN] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [ADMIN] Data:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ADMIN ERROR] ${message}`);
  console.error(`[${timestamp}] [ADMIN ERROR] Stack:`, error.stack);
};

// Middleware para todas as rotas admin (exceto login)
router.use('/dashboard', isAuthenticated);
router.use('/appointments', isAuthenticated);
router.use('/reports', isAuthenticated);

// Página de login administrativo
router.get('/login', (req, res) => {
  log('Acessando página de login administrativo');

  if (req.session.user) {
    log('Usuário já logado, redirecionando para dashboard', { user: req.session.user });
    return res.redirect('/admin/dashboard');
  }

  log('Renderizando página de login');
  res.render('admin/login', {
    hideNavbar: true,
    title: 'Login Administrativo',
    layout: 'admin',
    error: req.query.error
  });
});

// Processar login administrativo
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    log('Tentativa de login', { username, passwordLength: password ? password.length : 0 });

    if (!username || !password) {
      log('Login falhou: campos obrigatórios não preenchidos');
      return res.redirect('/admin/login?error=Usuário e senha são obrigatórios');
    }

    log('Buscando usuário no banco de dados', { username });
    const user = await User.findOne({
      where: { username, isActive: true },
      attributes: ['id', 'username', 'password', 'role', 'isActive']
    });

    if (!user) {
      log('Login falhou: usuário não encontrado ou inativo', { username });
      return res.redirect('/admin/login?error=Credenciais inválidas');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    log('Resultado da verificação de senha', { passwordMatch });

    if (!passwordMatch) {
      log('Login falhou: senha incorreta', { username });
      return res.redirect('/admin/login?error=Credenciais inválidas');
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    log('Login realizado com sucesso', {
      sessionUser: req.session.user,
      sessionId: req.sessionID
    });

    res.redirect('/admin/dashboard');
  } catch (error) {
    logError('Erro no processo de login', error);
    res.redirect('/admin/login?error=Erro interno do servidor');
  }
});

router.get('/logout', (req, res) => {
  log('Realizando logout', { user: req.session.user });
  req.session.destroy((err) => {
    if (err) {
      logError('Erro ao destruir sessão', err);
    } else {
      log('Sessão destruída com sucesso');
    }
    res.redirect('/admin/login');
  });
});

// Dashboard administrativo

router.get('/dashboard', async (req, res) => {
  try {
    log('Acessando dashboard', { user: req.session.user });

    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDateYYYYMMDD = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const monthlyStats = await Appointment.count({
      where: { appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] } }
    });

    const monthlyRevenue = await Appointment.sum('totalPrice', {
      where: {
        appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] },
        status: 'completed'
      }
    }) || 0;

    const todayAppointments = await Appointment.findAll({
      where: {
        appointmentDate: formatDateYYYYMMDD(today),
        status: 'completed'
      },
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order: [['appointmentTime', 'ASC']]
    });

    const statusStats = await Appointment.findAll({
      attributes: ['status', [require('sequelize').fn('COUNT', require('sequelize').col('status')), 'count']],
      where: { appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] } },
      group: ['status'],
      raw: true
    });
    const inProgressCount = await Appointment.count({
      where: { status: 'in_progress' }
    });

    const activeBarbersCount = await Barber.count({
      where: { isActive: true }
    });
    // Receita dos últimos 7 dias
    const fromYMDLocal = (s) => {
      const [y, m, d] = String(s).split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    // ===== Receita dos últimos 7 dias (corrigido fuso horário/local) =====
    const baseLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    baseLocal.setDate(baseLocal.getDate() - 6);

    // Gera as 7 datas em 'YYYY-MM-DD' SEM usar new Date('YYYY-MM-DD')
    const datesToTrack = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseLocal.getFullYear(), baseLocal.getMonth(), baseLocal.getDate() + i);
      return formatDateYYYYMMDD(d);
    });

    const appointmentsForRevenue = await Appointment.findAll({
      attributes: ['appointmentDate', 'totalPrice'],
      where: {
        appointmentDate: { [Op.in]: datesToTrack },
        status: { [Op.in]: ['completed'] }
      },
      raw: true
    });

    // Labels por dia da semana, calculados em "local time"
    const revenueChartLabels = datesToTrack.map(dateStr => {
      const dayName = diasSemana[fromYMDLocal(dateStr).getDay()];
      return dayName;
    });

    // Dados iniciam em zero
    const revenueChartData = datesToTrack.map(() => 0);

    // Soma por dia SEM reparsear como UTC
    appointmentsForRevenue.forEach(({ appointmentDate, totalPrice }) => {
      let key;
      if (typeof appointmentDate === 'string') {
        key = appointmentDate;
      } else {
        // força conversão em local time
        key = formatDateYYYYMMDD(new Date(
          appointmentDate.getFullYear(),
          appointmentDate.getMonth(),
          appointmentDate.getDate()
        ));
      }


      const idx = datesToTrack.indexOf(key);
      if (idx !== -1) {
        revenueChartData[idx] += Number(totalPrice || 0);
      }
    });


    // Bloco Novo e Corrigido
    // Substitua pelo Bloco Novo e Mais Robusto
    const topBarbersRaw = await Appointment.findAll({
      attributes: [
        [require('sequelize').col('barber.id'), 'barberId'], // Seleciona o ID do barbeiro diretamente
        [require('sequelize').fn('COUNT', require('sequelize').col('Appointment.id')), 'appointmentCount'],
        [require('sequelize').fn('SUM', require('sequelize').col('totalPrice')), 'totalRevenue']
      ],
      where: {
        appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] },
        status: { [Op.in]: ['completed'] }
      },
      include: [{
        model: Barber,
        as: 'barber',
        attributes: ['name'] // Apenas o nome é necessário para o resultado
      }],
      group: [
        require('sequelize').col('barber.id'), // Agrupa pelo ID e nome do barbeiro
        require('sequelize').col('barber.name')
      ],
      order: [
        [require('sequelize').fn('COUNT', require('sequelize').col('Appointment.id')), 'DESC']
      ],
      limit: 5,
      raw: true,
      nest: true
    });


    const topBarbers = topBarbersRaw.map(item => ({
      name: item.barber?.name || 'Barbeiro Desconhecido', // <-- Usa o nome do barbeiro da inclusão
      appointmentCount: item.appointmentCount,
      totalRevenue: item.totalRevenue
    }));

    // Substitua pelo Bloco Novo e Mais Robusto
    const topServicesRaw = await Appointment.findAll({
      attributes: [
        [require('sequelize').col('serviceType.id'), 'serviceTypeId'], // Seleciona o ID do serviço
        [require('sequelize').fn('COUNT', require('sequelize').col('Appointment.id')), 'appointmentCount'],
        [require('sequelize').fn('SUM', require('sequelize').col('totalPrice')), 'totalRevenue']
      ],
      where: {
        appointmentDate: { [Op.between]: [startOfMonth, endOfMonth] },
        status: 'completed'
      },
      include: [{
        model: ServiceType,
        as: 'serviceType',
        attributes: ['name', 'duration', 'price'] // Atributos necessários
      }],
      group: [
        require('sequelize').col('serviceType.id'), // Agrupa por todas as colunas não agregadas
        require('sequelize').col('serviceType.name'),
        require('sequelize').col('serviceType.duration'),
        require('sequelize').col('serviceType.price')
      ],
      order: [
        [require('sequelize').fn('COUNT', require('sequelize').col('Appointment.id')), 'DESC']
      ],
      limit: 5,
      raw: true,
      nest: true
    });

    const topServices = topServicesRaw.map(item => ({
      name: item.serviceType?.name || 'Serviço Desconhecido', // <-- Usa o nome do serviço da inclusão
      duration: item.serviceType?.duration || 0,
      price: item.serviceType?.price || '0.00',
      appointmentCount: item.appointmentCount,
      totalRevenue: item.totalRevenue,
      percentage: 0
    }));
    const formattedRecentAppointments = todayAppointments.map(app => {
      const [year, month, day] = app.appointmentDate.split('-');
      const localDate = new Date(year, month - 1, day);
      const serviceType = app.serviceType || {};

      return {
        ...app.toJSON(),
        appointmentDateFormatted: localDate.toLocaleDateString('pt-BR'),
        appointmentTimeFormatted: app.appointmentTime?.slice(0, 5),
        serviceType: {
          name: serviceType.name || 'Não informado',
          duration: serviceType.duration || 'n/d'
        }
      };
    });

    res.render('admin/dashboard', {
      title: 'Dashboard Administrativo',
      pageTitle: 'Dashboard Administrativo',
      adminFavicon: process.env.ADMIN_FAVICON || '/images/favicon-admin.png',
      layout: 'admin',
      user: req.session.user,
      todayAppointmentsCount: todayAppointments.length,
      monthlyRevenue,
      monthlyStats,
      statusStatsCount: statusStats.length,
      recentAppointments: formattedRecentAppointments,
      topBarbers,
      topServices,
      revenueChartLabels,
      inProgressCount,
      activeBarbersCount,
      revenueChartData
    });
  } catch (error) {
    logError('Erro no dashboard', error);
    res.render('admin/dashboard', {
      layout: 'admin',
      title: 'Dashboard',
      todayAppointmentsCount: 0,
      monthlyRevenue: 0,
      recentAppointments: [],
      topBarbers: [],
      topServices: [],
      inProgressCount: 0,
      activeBarbersCount: 0
    });
  }
});


// Listagem e gerenciamento de agendamentos - CORRIGIDA
// Listagem e gerenciamento de agendamentos - COM ORDENAÇÃO E FILTROS COMPLETOS
router.get('/appointments', async (req, res) => {
  try {
    log('Acessando listagem de agendamentos', {
      user: req.session.user,
      query: req.query
    });
    const { startDate, endDate, barberId, status, sort } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 5), 100); // 5–100 itens por página
    const offset = (page - 1) * limit;
    const todayStr = new Date().toLocaleDateString('en-CA');
    const DEFAULT_STATUSES = ['in_progress', 'confirmed', 'completed', 'blocked'];
    let whereClause = {};

    // ✅ Data inicial: hoje (se não vier na query)
    if (startDate && endDate) {
      whereClause.appointmentDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      // força mostrar só aquele dia
      whereClause.appointmentDate = startDate;
    } else if (endDate) {
      // idem: só aquele dia
      whereClause.appointmentDate = endDate;
    } else {
      whereClause.appointmentDate = todayStr;
    }


    if (barberId) whereClause.barberId = Number(barberId);


    // ✅ Status padrão quando não vier filtro explícito
    if (status) {
      whereClause.status = status;
    } else {
      whereClause.status = { [Op.in]: DEFAULT_STATUSES };
    }

    // ✅ Ordenação: data/hora e depois status nessa ordem
    const statusOrder = `CASE "Appointment"."status"
                           WHEN 'in_progress' THEN 1
                           WHEN 'confirmed'   THEN 2
                           WHEN 'completed'   THEN 3
                           ELSE 99
                         END`;

    const order = buildOrder(sort);


    const { count, rows: appointments } = await Appointment.findAndCountAll({
      where: whereClause,
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order,
      limit,
      offset
    });
    const totalPages = Math.max(1, Math.ceil(count / limit));
    const pages = buildPages(page, totalPages);
    const prevPage = page > 1 ? page - 1 : 1;
    const nextPage = page < totalPages ? page + 1 : totalPages;

    const barbers = await Barber.findAll({
      where: { isActive: true, ...(barberId && { id: barberId }) }
    });
    const formattedAppointments = appointments.map(app => {
      const plain = app.toJSON();
      const serviceType = plain.serviceType || {};

      let dateFormatted = '';
      try {
        const rawDate = plain.appointmentDate;
        const safeDate = typeof rawDate === 'string'
          ? new Date(rawDate + 'T03:00:00')
          : new Date(rawDate);
        if (!isNaN(safeDate)) {
          dateFormatted = safeDate.toLocaleDateString('pt-BR');
        }
      } catch (err) {
        console.error('Erro ao formatar appointmentDate:', err);
      }

      return {
        ...plain,
        appointmentDateFormatted: dateFormatted,
        appointmentTimeFormatted: plain.appointmentTime?.slice(0, 5),
        serviceType: {
          name: serviceType.name || 'Não informado',
          duration: serviceType.duration || 'n/d'
        }
      };
    });



    let freeSlots = [];
    for (const barber of barbers) {
      // Determinar data base (ou intervalo se quiser mais dias)
      const date = startDate || todayStr;

      // Parse do workingHours do barbeiro
      let parsed = {};
      try {
        parsed = typeof barber.workingHours === 'string'
          ? JSON.parse(barber.workingHours)
          : barber.workingHours || {};
      } catch (err) {
        parsed = {};
      }

      const selectedDate = new Date(date + 'T00:00:00');
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];

      const workingPeriods = [];
      if (parsed[dayOfWeek]) {
        const cfg = parsed[dayOfWeek];
        if (cfg.morning && cfg.morning !== 'closed') workingPeriods.push(cfg.morning);
        if (cfg.afternoon && cfg.afternoon !== 'closed') workingPeriods.push(cfg.afternoon);
      }

      // Agendamentos do barbeiro nesta data
      const barberAppointments = appointments.filter(a => a.barberId === barber.id);
      const bookedTimes = getBlockedTimesWithDuration(barberAppointments);

      // Gerar slots livres
      workingPeriods.forEach(period => {
        const [start, end] = period.split('-');
        const slots = generateTimeSlots(start, end, bookedTimes, date, 30); // step 30 min ou service.duration
        slots.forEach(slot => {
          freeSlots.push({
            id: null,
            barber,
            barberId: barber.id,
            appointmentDate: date,
            appointmentTime: slot.time,
            appointmentDateFormatted: formatDateYYYYMMDD(date),
            appointmentTimeFormatted: slot.time,
            client: { firstName: '', lastName: '' },
            serviceType: { name: 'Livre', duration: '' },
            totalPrice: 0,
            status: 'free'
          });


        });
      });
    }

    // Mesclar
    const merged = [...formattedAppointments, ...freeSlots];
    // Ordenar pela hora
    merged.sort((a, b) => a.appointmentTimeFormatted.localeCompare(b.appointmentTimeFormatted));
    const timeSlots = buildTimeSlots(merged, barbers, 30);
    const currentDate = startDate || todayStr;
    res.render('admin/appointments', {
      title: 'Gerenciar Agendamentos',
      pageTitle: 'Agendamentos',
      adminFavicon: process.env.ADMIN_FAVICON || '/images/favicon-admin.png',
      layout: 'admin',
      user: req.session.user,
      appointments: merged,
      timeSlots,
      barbers,
      currentDateRaw: currentDate,
      filters: { startDate, endDate, barberId, status, sort, limit },
      selectedLimit: limit,
      pagination: {
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage,
        prevPage,
        pages
      }
    });
  } catch (error) {
    console.error('[DEBUG ERRO]', error);
    logError('Erro ao listar agendamentos', error);
    res.render('admin/appointments', {
      title: 'Gerenciar Agendamentos',
      layout: 'admin',
      user: req.session.user,
      error: 'Erro ao carregar agendamentos'
    });
  }
});
function formatDateYYYYMMDD(str) {
  if (!str) return '';
  const [y, m, d] = String(str).split('-');
  return `${y}-${m}-${d}`;
}



router.get('/appointments/partial', async (req, res) => {
  try {
    const { startDate, endDate, barberId, status, sort, page = 1, limit = 10 } = req.query;
    const p = Math.max(parseInt(page) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

    const DEFAULT_STATUSES = ['in_progress', 'confirmed', 'completed', 'blocked'];
    const todayStr = new Date().toLocaleDateString('en-CA');
    const currentDate = startDate || todayStr;
    const where = {};
    if (startDate && endDate) where.appointmentDate = { [Op.between]: [startDate, endDate] };
    else if (startDate) where.appointmentDate = { [Op.gte]: startDate };
    else if (endDate) where.appointmentDate = { [Op.lte]: endDate };
    else where.appointmentDate = currentDate;

    if (barberId) where.barberId = Number(barberId);
    where.status = status ? status : { [Op.in]: DEFAULT_STATUSES };

    const order = buildOrder(sort);

    const { count, rows } = await Appointment.findAndCountAll({
      where,
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order,
      limit: l,
      offset: (p - 1) * l
    });

    const formatted = rows.map(a => {
      const j = a.toJSON();
      const d = new Date((typeof j.appointmentDate === 'string' ? j.appointmentDate + 'T03:00:00' : j.appointmentDate));
      return {
        ...j,
        appointmentDateFormatted: isNaN(d) ? '' : d.toLocaleDateString('pt-BR'),
        appointmentTimeFormatted: j.appointmentTime?.slice(0, 5)
      };
    });


    const barbers = await Barber.findAll({
      where: { isActive: true, ...(barberId && { id: barberId }) }
    });

    let freeSlots = [];
    for (const barber of barbers) {
      // Determinar data base (ou intervalo se quiser mais dias)
      const date = startDate || todayStr;

      // Parse do workingHours do barbeiro
      let parsed = {};
      try {
        parsed = typeof barber.workingHours === 'string'
          ? JSON.parse(barber.workingHours)
          : barber.workingHours || {};
      } catch (err) {
        parsed = {};
      }

      const selectedDate = new Date(date + 'T00:00:00');
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];

      const workingPeriods = [];
      if (parsed[dayOfWeek]) {
        const cfg = parsed[dayOfWeek];
        if (cfg.morning && cfg.morning !== 'closed') workingPeriods.push(cfg.morning);
        if (cfg.afternoon && cfg.afternoon !== 'closed') workingPeriods.push(cfg.afternoon);
      }

      // Agendamentos do barbeiro nesta data
      const barberAppointments = rows.filter(a => a.barberId === barber.id);
      const bookedTimes = getBlockedTimesWithDuration(barberAppointments);

      // Gerar slots livres
      workingPeriods.forEach(period => {
        const [start, end] = period.split('-');
        const slots = generateTimeSlots(start, end, bookedTimes, date, 30); // step 30 min ou service.duration
        slots.forEach(slot => {
          freeSlots.push({
            id: null,
            barber,
            barberId: barber.id,
            appointmentDate: date,
            appointmentTime: slot.time,
            appointmentDateFormatted: formatDateYYYYMMDD(date),
            appointmentTimeFormatted: slot.time,
            client: { firstName: '', lastName: '' },
            serviceType: { name: 'Livre', duration: '' },
            totalPrice: 0,
            status: 'free'
          });


        });
      });
    }

    // Mesclar
    const merged = [...formattedAppointments, ...freeSlots];
    // Ordenar pela hora
    merged.sort((a, b) => a.appointmentTimeFormatted.localeCompare(b.appointmentTimeFormatted));
    const timeSlots = buildTimeSlots(merged, barbers, 30);

    // Renderiza partial em string
    res.render('partials/appointments-table-rows', { layout: false, appointments: merged, timeSlots }, (err, html) => {
      if (err) return res.status(500).json({ error: 'Erro ao renderizar partial' });
      const hasNext = (p * l) < count;
      res.json({ html, hasNext, nextPage: p + 1 });
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao paginar agendamentos' });
  }
});


router.get('/appointments/partial-cards', async (req, res) => {
  try {
    const { startDate, endDate, barberId, status, sort, page = 1, limit = 10 } = req.query;
    const p = Math.max(parseInt(page) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

    const DEFAULT_STATUSES = ['in_progress', 'confirmed', 'completed', 'blocked'];
    const todayStr = new Date().toLocaleDateString('en-CA');
    const currentDate = startDate || todayStr;
    const where = {};
    if (startDate && endDate) where.appointmentDate = { [Op.between]: [startDate, endDate] };
    else if (startDate) where.appointmentDate = { [Op.gte]: startDate };
    else if (endDate) where.appointmentDate = { [Op.lte]: endDate };
    else where.appointmentDate = currentDate;

    if (barberId) where.barberId = Number(barberId);
    where.status = status ? status : { [Op.in]: DEFAULT_STATUSES };

    const order = buildOrder(sort);

    const { count, rows } = await Appointment.findAndCountAll({
      where,
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order,
      limit: l,
      offset: (p - 1) * l
    });

    const formatted = rows.map(a => {
      const j = a.toJSON();
      const d = new Date((typeof j.appointmentDate === 'string' ? j.appointmentDate + 'T03:00:00' : j.appointmentDate));
      return {
        ...j,
        appointmentDateFormatted: isNaN(d) ? '' : d.toLocaleDateString('pt-BR'),
        appointmentTimeFormatted: j.appointmentTime?.slice(0, 5)
      };
    });

    res.render('partials/appointments-cards-grouped', { layout: false, appointments: formatted }, (err, html) => {
      if (err) return res.status(500).json({ error: 'Erro ao renderizar partial' });
      const hasNext = (p * l) < count;
      res.json({ html, hasNext, nextPage: p + 1 });
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao paginar agendamentos (cards)' });
  }
});

// Atualizar status do agendamento
router.post('/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    log('Atualizando status do agendamento', { id, status, user: req.session.user });

    const result = await Appointment.update(
      { status },
      { where: { id } }
    );

    log('Status atualizado', { id, status, affectedRows: result[0] });

    res.json({ success: true });
  } catch (error) {
    logError('Erro ao atualizar status', error);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// Relatórios administrativos - CORRIGIDA
// /admin/reports – LISTAGEM COM PAGINAÇÃO + VIEW MODE
// -------------------- RELATÓRIOS ADMINISTRATIVOS --------------------

// /admin/reports – LISTAGEM COM PAGINAÇÃO + VIEW MODE
router.get('/reports', async (req, res) => {
  try {
    const { startDate, endDate, barberId, status, sort } = req.query;

    // paginação
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 5), 100);
    const offset = (page - 1) * limit;

    // view mode (table|cards)
    const view = (req.query.view === 'cards') ? 'cards' : 'table';

    const todayStr = new Date().toLocaleDateString('en-CA');
    const whereClause = {};

    if (startDate && endDate) whereClause.appointmentDate = { [Op.between]: [startDate, endDate] };
    else if (startDate) whereClause.appointmentDate = { [Op.gte]: startDate };
    else if (endDate) whereClause.appointmentDate = { [Op.lte]: endDate };
    else whereClause.appointmentDate = { [Op.gte]: todayStr };

    if (barberId) whereClause.barberId = Number(barberId);
    if (status) whereClause.status = status;

    const order = buildOrder(sort);

    // Buscar agendamentos
    const { count, rows } = await Appointment.findAndCountAll({
      where: whereClause,
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ],
      order,
      limit,
      offset
    });

    const totalPages = Math.max(1, Math.ceil(count / limit));
    const pages = buildPages(page, totalPages);
    const prevPage = page > 1 ? page - 1 : 1;
    const nextPage = page < totalPages ? page + 1 : totalPages;

    const formatted = rows.map(app => {
      const j = app.toJSON();
      const d = new Date((typeof j.appointmentDate === 'string' ? j.appointmentDate + 'T03:00:00' : j.appointmentDate));
      return {
        ...j,
        appointmentDateFormatted: isNaN(d) ? '' : d.toLocaleDateString('pt-BR'),
        appointmentTimeFormatted: j.appointmentTime?.slice(0, 5),
        serviceType: {
          name: j.serviceType?.name || 'Não informado',
          duration: j.serviceType?.duration || 'n/d'
        }
      };
    });

    // Caixa: filtro por período
    const cashierWhere = {};
    if (startDate && endDate) {
      cashierWhere.openedAt = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      cashierWhere.openedAt = { [Op.gte]: startDate };
    } else if (endDate) {
      cashierWhere.openedAt = { [Op.lte]: endDate };
    }

    const cashierSessions = await CashSession.findAll({
      where: cashierWhere,
      include: [
        { model: Expense, as: 'expenses' },
        { model: Payment, as: 'payments' }
      ],
      order: [['openedAt', 'ASC']]
    });

    const cashierFormatted = cashierSessions.map(cs => {
      const totalEntradas = cs.payments.reduce((s, p) => s + Number(p.amount), 0);
      const totalDespesas = cs.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const saldoEsperado = Number(cs.openingAmount) + totalEntradas - totalDespesas;
      const diferenca = cs.countedCash !== null ? Number(cs.countedCash) - saldoEsperado : null;

      return {
        ...cs.toJSON(),
        totalEntradas,
        totalDespesas,
        saldoEsperado,
        diferenca
      };
    });

    // barbeiros para filtro
    const barbers = await Barber.findAll({ where: { isActive: true } });

    // Estatísticas para gráficos
    let stats = {
      total: count,
      totalRevenue: 0,
      byStatus: {
        pending: 0,
        confirmed: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0
      },
      byBarber: {}
    };

    rows.forEach(a => {
      stats.totalRevenue += Number(a.totalPrice) || 0;
      if (stats.byStatus[a.status] !== undefined) stats.byStatus[a.status]++;
      const barberName = a.barber?.name || 'Não informado';
      stats.byBarber[barberName] = (stats.byBarber[barberName] || 0) + 1;
    });

    res.render('admin/reports', {
      title: 'Relatórios',
      pageTitle: 'Relatórios',
      adminFavicon: process.env.ADMIN_FAVICON || '/images/favicon-admin.png',
      layout: 'admin',
      user: req.session.user,
      appointments: formatted,
      cashierSessions: cashierFormatted,   // 👈 adicionado
      barbers,
      view,
      stats,
      filters: { startDate, endDate, barberId, status, sort, limit },
      selectedLimit: limit,
      pagination: {
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage,
        prevPage,
        pages
      }
    });

  } catch (error) {
    console.error('[ADMIN][REPORTS] Erro:', error);
    res.render('admin/reports', {
      title: 'Relatórios',
      layout: 'admin',
      user: req.session.user,
      error: 'Erro ao carregar relatórios'
    });
  }
});


// /admin/reports/export – Exportar relatórios (PDF/CSV)
router.post('/reports/export', isAuthenticated, async (req, res) => {
  try {
    const { format, startDate, endDate, barberId, status, sort } = req.body;

    // Filtro agendamentos
    const where = {};
    if (startDate && endDate) where.appointmentDate = { [Op.between]: [startDate, endDate] };
    else if (startDate) where.appointmentDate = { [Op.gte]: startDate };
    else if (endDate) where.appointmentDate = { [Op.lte]: endDate };

    if (status) where.status = status;
    if (barberId) where.barberId = Number(barberId);

    // Ordem
    const statusOrder = `CASE "Appointment"."status"
                           WHEN 'in_progress' THEN 1
                           WHEN 'confirmed'   THEN 2
                           WHEN 'completed'   THEN 3
                           ELSE 99
                         END`;
    let order = [['appointmentDate', 'ASC'], ['appointmentTime', 'ASC'], [literal(statusOrder), 'ASC']];
    if (sort === 'date_desc') order = [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC'], [literal(statusOrder), 'ASC']];
    else if (sort === 'value_desc') order = [['totalPrice', 'DESC']];
    else if (sort === 'value_asc') order = [['totalPrice', 'ASC']];
    else if (sort === 'barber_asc') order = [[{ model: Barber, as: 'barber' }, 'name', 'ASC']];
    else if (sort === 'barber_desc') order = [[{ model: Barber, as: 'barber' }, 'name', 'DESC']];

    // Buscar agendamentos
    const appointments = await Appointment.findAll({
      where,
      order,
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber', attributes: ['id', 'name'], required: !!barberId },
        { model: ServiceType, as: 'serviceType' }
      ]
    });

    // Filtro caixa
    const cashierWhere = {};
    if (startDate && endDate) cashierWhere.openedAt = { [Op.between]: [startDate, endDate] };
    else if (startDate) cashierWhere.openedAt = { [Op.gte]: startDate };
    else if (endDate) cashierWhere.openedAt = { [Op.lte]: endDate };

    const cashierSessions = await CashSession.findAll({
      where: cashierWhere,
      include: [
        { model: Expense, as: 'expenses' },
        { model: Payment, as: 'payments' }
      ],
      order: [['openedAt', 'ASC']]
    });

    const cashierFormatted = cashierSessions.map(cs => {
      const totalEntradas = cs.payments.reduce((s, p) => s + Number(p.amount), 0);
      const totalDespesas = cs.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const saldoEsperado = Number(cs.openingAmount) + totalEntradas - totalDespesas;
      const diferenca = cs.countedCash !== null ? Number(cs.countedCash) - saldoEsperado : null;

      return {
        ...cs.toJSON(),
        totalEntradas,
        totalDespesas,
        saldoEsperado,
        diferenca
      };
    });

    // Resumo simples
    const reportInfo = {
      periodo: `${startDate || '...'} até ${endDate || '...'}`,
      barbeiro: barberId || 'Todos',
      totalAgendamentos: appointments.length,
      totalReceita: appointments.reduce((s, a) => s + Number(a.totalPrice || 0), 0),
      totalEntradasCaixa: cashierFormatted.reduce((s, cs) => s + cs.totalEntradas, 0),
      totalDespesasCaixa: cashierFormatted.reduce((s, cs) => s + cs.totalDespesas, 0)
    };

    const filename = `relatorio-${Date.now()}.${format}`;

    if (format === 'pdf') {
      const filePath = await generatePDF({ appointments, cashier: cashierFormatted }, reportInfo, filename);
      return res.download(filePath, filename, err => {
        if (err) console.error('Erro ao enviar PDF:', err);
        fs.unlink(filePath, err => { if (err) console.error('Erro ao excluir PDF temporário:', err); });
      });
    } else if (format === 'csv') {
      const filePath = await generateCSV({ appointments, cashier: cashierFormatted }, filename);
      return res.download(filePath, filename, err => {
        if (err) console.error('Erro ao enviar CSV:', err);
        fs.unlink(filePath, err => { if (err) console.error('Erro ao excluir CSV temporário:', err); });
      });
    } else {
      return res.status(400).json({ error: 'Formato inválido.' });
    }

  } catch (error) {
    console.error('[EXPORT ERROR]', error);
    res.status(500).json({ error: 'Erro ao gerar relatório.' });
  }
});



router.get('/appointments/:id', async (req, res) => {
  // const { id } = req.params;

  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      log('ID inválido fornecido', { id: req.params.id });
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    log('Buscando agendamento por ID', { id });

    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Client, as: 'client', attributes: ['firstName', 'lastName', 'phone', 'email'] },
        { model: Barber, as: 'barber', attributes: ['name'] },
        { model: ServiceType, as: 'serviceType', attributes: ['name', 'duration', 'price'] }
      ]
    });

    if (!appointment) {
      log('Agendamento não encontrado', { id });
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    }

    log('Agendamento encontrado', { id, client: `${appointment.client.firstName} ${appointment.client.lastName}` });

    res.json({ success: true, appointment });

  } catch (error) {
    logError('Erro ao buscar agendamento', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});


router.patch('/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    log('Atualizando status do agendamento', { id, status });

    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido',
        validStatuses
      });
    }

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      log('Agendamento não encontrado', { id });
      return res.status(404).json({
        success: false,
        error: 'Agendamento não encontrado'
      });
    }

    await appointment.update({ status });
    const updatedAppointment = await Appointment.findByPk(id); // recarrega

    log('Status atualizado com sucesso', { id, oldStatus: appointment.status, newStatus: updatedAppointment.status });

    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      appointment: {
        id: updatedAppointment.id,
        status: updatedAppointment.status
      }
    });


  } catch (error) {
    logError('Erro ao atualizar status', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});


router.delete('/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    log('Cancelando agendamento', { id });

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      log('Agendamento não encontrado', { id });
      return res.status(404).json({
        success: false,
        error: 'Agendamento não encontrado'
      });
    }

    await appointment.update({ status: 'cancelled' });

    log('Agendamento cancelado com sucesso', { id });

    res.json({
      success: true,
      message: 'Agendamento cancelado com sucesso'
    });

  } catch (error) {
    logError('Erro ao cancelar agendamento', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Confirmar agendamento
router.post('/api/appointments/:id/confirm', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });

    await appointment.update({ status: 'confirmed' });
    res.json({ success: true });
  } catch (error) {
    logError('Erro ao confirmar agendamento', error);
    res.status(500).json({ error: 'Erro ao confirmar agendamento' });
  }
});


// Marcar como concluído
router.post('/appointments/:id/complete', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });

    await appointment.update({ status: 'completed' });
    res.json({ success: true });
  } catch (error) {
    logError('Erro ao concluir agendamento', error);
    res.status(500).json({ error: 'Erro ao concluir agendamento' });
  }
});


// Cancelar agendamento com motivo
router.post('/api/appointments/:id/cancel', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });

    const { reason } = req.body; // Motivo opcional
    await appointment.update({
      status: 'cancelled',
      cancelReason: reason || null,
      cancelledAt: new Date()
    });
    res.json({ success: true, reason });
  } catch (error) {
    logError('Erro ao cancelar agendamento', error);
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});


router.post('/api/appointments/:id/whatsapp', async (req, res) => {
  try {
    const id = req.params.id;
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ]
    });

    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });

    const msg = `Olá, ${appointment.client.firstName}! Seu agendamento em nossa barbearia está confirmado para o dia ${appointment.appointmentDate} às ${appointment.appointmentTime}.`;
    const sent = await sendWhatsAppMessage(appointment.client.phone, msg);

    if (!sent) throw new Error('Erro ao enviar WhatsApp');

    await appointment.update({ whatsappSent: true });

    res.json({ success: true });
  } catch (err) {
    console.error('[WHATSAPP ERROR]', err);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});


router.get('/appointments/:id/edit', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Client, as: 'client' },
        { model: Barber, as: 'barber' },
        { model: ServiceType, as: 'serviceType' }
      ]
    });

    const barbers = await Barber.findAll({ where: { isActive: true } });
    const services = await ServiceType.findAll({ where: { isActive: true } });

    res.render('admin/appointments-edit', {
      title: 'Editar Agendamento',
      layout: 'admin',
      appointment: appointment.toJSON(),
      barbers,
      services
    });
  } catch (err) {
    res.status(500).send('Erro ao carregar agendamento');
  }
});


router.put('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  const { serviceTypeId, barberId, appointmentDate, appointmentTime } = req.body;

  try {
    const appointment = await Appointment.findByPk(id);
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });

    // atualiza campos básicos
    appointment.serviceTypeId = serviceTypeId;
    appointment.barberId = barberId;
    appointment.appointmentDate = appointmentDate;
    appointment.appointmentTime = appointmentTime;

    // garante que o PREÇO e a DURAÇÃO acompanhem o serviço selecionado
    const service = await ServiceType.findByPk(serviceTypeId);
    if (service) {
      appointment.totalPrice = service.price;
      appointment.serviceDuration = service.duration;
    }

    await appointment.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao editar agendamento:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ===== ROTAS DE BARBEIROS =====
router.use('/barbers', require('./barbers'));
// ===== ROTAS DE caixa =====
router.use('/cashier', require('./cashier'));
// ===== ROTAS DE SERVIÇOS =====
router.use('/services', require('./services'));

// ===== ROTAS DE CONFIGURAÇÃO DO SISTEMA =====
router.use('/config', require('./admin-config'));

router.get('/whatsapp/status', isAuthenticatedApi, (req, res) => {
  const status = getWhatsAppStatus();
  res.json(status);
});

router.get('/whatsapp/qr', isAuthenticatedApi, (req, res) => {
  try {
    const qr = getLastQRCode();
    if (!qr) return res.status(204).json({ message: 'QR ainda não gerado' });
    res.json({ qr });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar QR' });
  }
});


router.post('/whatsapp/disconnect', async (req, res) => {
  try {
    await disconnectWhatsApp();

    // Força uma nova sessão após desconexão
    await initializeWhatsApp();

    req.session.message = 'WhatsApp desconectado e reinicializado';
    res.redirect('/admin/config');
  } catch (error) {
    console.error('[WHATSAPP DISCONNECT ERROR]', error);
    res.redirect('/admin/config?error=Erro ao desconectar WhatsApp');
  }
});

function toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function fromMin(min) { const h = String(Math.floor(min / 60)).padStart(2, '0'); const m = String(min % 60).padStart(2, '0'); return `${h}:${m}`; }
function parsePeriod(str) { // "08:00-12:00" -> [480,720]
  if (!str || !str.includes('-')) return null;
  const [a, b] = str.split('-').map(toMin);
  return [Math.min(a, b), Math.max(a, b)];
}
function dayKey(dateStr) {
  const d = new Date(dateStr);
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
}
function getDayPeriods(workingHours, dateStr) {
  const wk = workingHours || {};
  const dk = dayKey(dateStr);
  const day = wk[dk] || {};
  const out = [];
  const m = parsePeriod(day.morning);
  const a = parsePeriod(day.afternoon);
  if (m) out.push(m);
  if (a) out.push(a);
  return out; // array de [start,end] em minutos
}
function inAnyPeriod(min, periods) {
  return periods.some(([s, e]) => min >= s && min < e);
}
function overlaps([s1, e1], [s2, e2]) {
  return s1 < e2 && s2 < e1;
}

/**
 * GET /admin/appointments/schedule
 * Query: date=YYYY-MM-DD&barberId=opcional&step=30
 */



module.exports = router;

