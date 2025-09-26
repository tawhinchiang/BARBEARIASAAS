const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ==================================================
// PDF (template "extrato"): 4 linhas de cabeçalho, colunas fixas,
// 1 linha por item, alta densidade, rodapé "PÁGINA: X/Y".
// ==================================================
async function generatePDF({ appointments = [], cashier = [] }, reportInfo = {}, filename) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 28, left: 28, right: 28, bottom: 32 },
        bufferPages: true
      });

      const filePath = path.join(__dirname, '..', 'reports', filename);
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // -----------------------------
      // Helpers de formatação
      // -----------------------------
      const fmtMoney = (v) =>
        Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
      const fmtDateTime = (d) => d ? new Date(d).toLocaleString('pt-BR') : '—';
      const clip = (txt, max) => {
        const s = String(txt ?? '').trim();
        return s.length > max ? s.slice(0, max - 1) + '…' : s;
      };
      const now = new Date();
      const impData = now.toLocaleDateString('pt-BR');
      const impHora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

      // -----------------------------
      // Normalizadores (evitam campos em branco)
      // -----------------------------
      function normalizeAppointment(a = {}) {
        const appointmentDate = a.appointmentDate ?? a.appointment_date ?? a.date ?? a.data ?? null;
        const appointmentTime = a.appointmentTime ?? a.appointment_time ?? a.time ?? a.hora ?? '';
        const totalPrice      = a.totalPrice ?? a.total_price ?? a.valor ?? a.price ?? 0;
        const status          = a.status ?? a.situacao ?? a.estado ?? 'pending';

        const client = a.client ?? a.cliente ?? {};
        const firstName = client.firstName ?? client.nome ?? a.clientName ?? a.cliente_nome ?? '';
        const lastName  = client.lastName  ?? client.sobrenome ?? '';

        const barberObj  = a.barber ?? a.barbeiro ?? {};
        const barberName = barberObj.name ?? a.barberName ?? a.barbeiro_nome ?? '';

        const svcObj     = a.serviceType ?? a.servico ?? {};
        const serviceName= svcObj.name ?? a.serviceName ?? a.servico_nome ?? '';

        return {
          appointmentDate,
          appointmentTime,
          totalPrice: Number(totalPrice || 0),
          status,
          client: { firstName, lastName },
          barber: { name: barberName },
          serviceType: { name: serviceName }
        };
      }

      function normalizeCashier(c = {}) {
        const openedAt       = c.openedAt ?? c.opened_at ?? c.abertura ?? null;
        const closedAt       = c.closedAt ?? c.closed_at ?? c.fechamento ?? null;
        const openingAmount  = c.openingAmount ?? c.inicial ?? c.valorInicial ?? 0;
        const totalEntradas  = c.totalEntradas ?? c.entradas ?? c.total_in ?? c.total_incoming ?? 0;
        const totalDespesas  = c.totalDespesas ?? c.despesas ?? c.total_out ?? c.total_expenses ?? 0;
        const saldoEsperado  = c.saldoEsperado ?? c.esperado ?? c.expected ?? 0;
        const countedCash    = c.countedCash ?? c.contado ?? c.counted ?? 0;
        const diferenca      = c.diferenca ?? c.difference ?? c.diff ?? 0;

        return {
          openedAt, closedAt,
          openingAmount: Number(openingAmount || 0),
          totalEntradas: Number(totalEntradas || 0),
          totalDespesas: Number(totalDespesas || 0),
          saldoEsperado: Number(saldoEsperado || 0),
          countedCash: Number(countedCash || 0),
          diferenca: Number(diferenca || 0)
        };
      }

      const appts = (appointments || []).map(normalizeAppointment);
      const cash  = (cashier || []).map(normalizeCashier);

      // -----------------------------
      // Grid e tipografia
      // -----------------------------
      const P = { L: doc.page.margins.left }; // 28
      const WIDTH  = doc.page.width - doc.page.margins.left - doc.page.margins.right; // 539pt
      const LINE_H = 12; // alta densidade

      const setFont = {
        h1()   { doc.font('Helvetica-Bold').fontSize(12); },
        h2()   { doc.font('Helvetica-Bold').fontSize(10); },
        th()   { doc.font('Helvetica-Bold').fontSize(8);  },
        td()   { doc.font('Helvetica').fontSize(8);       },
        small(){ doc.font('Helvetica').fontSize(7);       },
      };

      function hr(y = doc.y) {
        doc.moveTo(P.L, y).lineTo(P.L + WIDTH, y).lineWidth(0.5).strokeColor('#dddddd').stroke();
      }

      // Cabeçalho institucional neutro (4 linhas)
      function addInstitutionalHeader() {
        setFont.h1(); doc.fillColor('#000');
        doc.text((reportInfo.headline1 || 'RELATÓRIO GERAL').toUpperCase(), P.L, doc.y, { width: WIDTH, align: 'center' });

        setFont.h2();
        doc.text((reportInfo.headline2 || 'SISTEMA DE GESTÃO').toUpperCase(), P.L, doc.y, { width: WIDTH, align: 'center' });
        doc.text((reportInfo.headline3 || 'MÓDULO DE AGENDAMENTOS').toUpperCase(), P.L, doc.y, { width: WIDTH, align: 'center' });
        doc.text((reportInfo.headline4 || 'PERÍODO DO RELATÓRIO').toUpperCase(), P.L, doc.y, { width: WIDTH, align: 'center' });

        const y = doc.y + 4;
        hr(y);
        doc.moveDown(0.5);
      }

      // ===============================
      // TABELA: AGENDAMENTOS (colunas fixas)
      // ===============================
      const COL_APT = [
        { key: 'data',     label: 'DATA',     x: P.L + 0,   w: 58,  align: 'left'  },
        { key: 'hora',     label: 'HORA',     x: P.L + 58,  w: 36,  align: 'left'  },
        { key: 'cliente',  label: 'CLIENTE',  x: P.L + 94,  w: 130, align: 'left'  },
        { key: 'barbeiro', label: 'BARBEIRO', x: P.L + 224, w: 100, align: 'left'  },
        { key: 'servico',  label: 'SERVIÇO',  x: P.L + 324, w: 130, align: 'left'  },
        { key: 'status',   label: 'STATUS',   x: P.L + 454, w: 55,  align: 'left'  },
        { key: 'valor',    label: 'VALOR',    x: P.L + 509, w: 30,  align: 'right' }
      ]; // soma = 539

      function drawAptHeader(y) {
        setFont.th(); doc.fillColor('#000');
        COL_APT.forEach(c => {
          doc.text(c.label, c.x, y, { width: c.w, align: c.align || 'left', lineBreak: false, ellipsis: true });
        });
        doc.moveTo(P.L, y + LINE_H - 2).lineTo(P.L + WIDTH, y + LINE_H - 2)
           .lineWidth(0.5).strokeColor('#dddddd').stroke();
      }

      function drawAptRow(y, obj) {
        setFont.td(); doc.fillColor('#111');
        COL_APT.forEach(c => {
          const v = String(obj[c.key] ?? '—');
          doc.text(v, c.x, y, { width: c.w, align: c.align || 'left', lineBreak: false, ellipsis: true });
        });
      }

      // ===============================
      // TABELA: CAIXA (colunas fixas)
      // ===============================
      const COL_CASH = [
        { key: 'abertura',  label: 'ABERTURA',  x: P.L + 0,   w: 95, align: 'left'  },
        { key: 'fechamento',label: 'FECHAMENTO',x: P.L + 95,  w: 95, align: 'left'  },
        { key: 'inicial',   label: 'INICIAL',   x: P.L + 190, w: 50, align: 'right' },
        { key: 'entradas',  label: 'ENTRADAS',  x: P.L + 240, w: 55, align: 'right' },
        { key: 'despesas',  label: 'DESPESAS',  x: P.L + 295, w: 55, align: 'right' },
        { key: 'esperado',  label: 'ESPERADO',  x: P.L + 350, w: 60, align: 'right' },
        { key: 'contado',   label: 'CONTADO',   x: P.L + 410, w: 60, align: 'right' },
        { key: 'diferenca', label: 'DIFERENÇA', x: P.L + 470, w: 69, align: 'right' }
      ]; // soma = 539

      function drawCashHeader(y) {
        setFont.th(); doc.fillColor('#000');
        COL_CASH.forEach(c => {
          doc.text(c.label, c.x, y, { width: c.w, align: c.align || 'left', lineBreak: false, ellipsis: true });
        });
        doc.moveTo(P.L, y + LINE_H - 2).lineTo(P.L + WIDTH, y + LINE_H - 2)
           .lineWidth(0.5).strokeColor('#dddddd').stroke();
      }

      function drawCashRow(y, obj) {
        setFont.td(); doc.fillColor('#111');
        COL_CASH.forEach(c => {
          const v = String(obj[c.key] ?? '—');
          doc.text(v, c.x, y, { width: c.w, align: c.align || 'left', lineBreak: false, ellipsis: true });
        });
      }

      // quebra segura com reimpressão de header
      function ensurePage(y, headerDrawer) {
        const bottom = doc.page.height - doc.page.margins.bottom;
        const need = LINE_H + 12;
        if (y + need > bottom) {
          doc.addPage();
          addInstitutionalHeader();
          y = doc.y + 2;
          if (typeof headerDrawer === 'function') {
            headerDrawer(y);
            y += LINE_H;
          }
        }
        return y;
      }

      // ===============================
      // CONTEÚDO: Cabeçalho + Agendamentos
      // ===============================
      addInstitutionalHeader();

      let y = doc.y + 2;

      if (!appts.length) {
        setFont.td(); doc.fillColor('#444');
        doc.text('Nenhum agendamento no período.', P.L, y, { width: WIDTH, align: 'left', lineBreak: false });
        y += LINE_H * 2;
      } else {
        // Header de agendamentos
        drawAptHeader(y);
        y += LINE_H;

        // Linhas
        let totalApt = 0;
        appts.forEach(apt => {
          const linha = {
            data:     fmtDate(apt.appointmentDate),
            hora:     (apt.appointmentTime || '').slice(0,5),
            cliente:  clip(((apt.client?.firstName || '') + ' ' + (apt.client?.lastName || '')).trim(), 28),
            barbeiro: clip(apt.barber?.name || '', 22),
            servico:  clip(apt.serviceType?.name || '', 28),
            status:   clip(getStatusText(apt.status), 12),
            valor:    fmtMoney(apt.totalPrice)
          };
          if (apt.status !== 'cancelled') totalApt += Number(apt.totalPrice || 0);

          y = ensurePage(y, drawAptHeader);
          drawAptRow(y, linha);
          y += LINE_H;
        });

        // Linha de total
        y = ensurePage(y, drawAptHeader);
        setFont.th(); doc.fillColor('#000');
        doc.text('TOTAL', P.L + 454, y, { width: 55, align: 'left', lineBreak: false });
        doc.text(fmtMoney(totalApt), P.L + 509, y, { width: 30, align: 'right', lineBreak: false });
        y += LINE_H + 6;
      }

      // ===============================
      // CONTEÚDO: Caixa (fluxo organizado)
      // ===============================
      // (separador visual leve entre as tabelas)
      hr(y);
      y += 6;

      setFont.h2(); doc.fillColor('#000');
      doc.text('FLUXO DE CAIXA', P.L, y, { width: WIDTH, align: 'left', lineBreak: false });
      y += LINE_H;

      // Header da tabela de caixa
      drawCashHeader(y);
      y += LINE_H;

      if (!cash.length) {
        setFont.td(); doc.fillColor('#444');
        doc.text('Nenhum registro de caixa no período.', P.L, y, { width: WIDTH, lineBreak: false });
        y += LINE_H * 2;
      } else {
        let totInicial = 0, totEntradas = 0, totDespesas = 0, totEsperado = 0, totContado = 0, totDif = 0;

        cash.forEach(cs => {
          const row = {
            abertura:  fmtDateTime(cs.openedAt),
            fechamento:fmtDateTime(cs.closedAt),
            inicial:   fmtMoney(cs.openingAmount),
            entradas:  fmtMoney(cs.totalEntradas),
            despesas:  fmtMoney(cs.totalDespesas),
            esperado:  fmtMoney(cs.saldoEsperado),
            contado:   fmtMoney(cs.countedCash),
            diferenca: fmtMoney(cs.diferenca),
          };

          totInicial  += Number(cs.openingAmount || 0);
          totEntradas += Number(cs.totalEntradas || 0);
          totDespesas += Number(cs.totalDespesas || 0);
          totEsperado += Number(cs.saldoEsperado || 0);
          totContado  += Number(cs.countedCash || 0);
          totDif      += Number(cs.diferenca || 0);

          y = ensurePage(y, drawCashHeader);
          drawCashRow(y, row);
          y += LINE_H;
        });

        // Totais do caixa
        y = ensurePage(y, drawCashHeader);
        setFont.th(); doc.fillColor('#000');
        // células em branco para colunas de datas
        doc.text('TOTAIS', P.L + 0,  y, { width: 190, align: 'left',  lineBreak: false });
        doc.text(fmtMoney(totInicial),  P.L + 190, y, { width: 50, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totEntradas), P.L + 240, y, { width: 55, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totDespesas), P.L + 295, y, { width: 55, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totEsperado), P.L + 350, y, { width: 60, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totContado),  P.L + 410, y, { width: 60, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totDif),      P.L + 470, y, { width: 69, align: 'right', lineBreak: false });
        y += LINE_H;
      }

      // ===============================
      // Rodapé em TODAS as páginas: "Data da impressão ... as ..." + "PÁGINA: X/Y"
      // ===============================
      const range = doc.bufferedPageRange(); // { start, count }
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const num = i - range.start + 1;
        const total = range.count;

        const footerY = doc.page.height - doc.page.margins.bottom + 6;
        setFont.small(); doc.fillColor('#000');
        doc.text(`Data da impressão ${impData} as ${impHora}`, P.L, footerY, { width: WIDTH/2, align: 'left' });
        doc.text(`PÁGINA: ${num}/${total}`, P.L + WIDTH/2, footerY, { width: WIDTH/2, align: 'right' });
      }

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ==================================================
// CSV (mantido)
// ==================================================
function escapeCSV(text) {
  if (typeof text !== 'string') text = String(text || '');
  return `"${text.replace(/"/g, '""')}"`;
}

function generateCSV({ appointments, cashier }, filename) {
  try {
    const filePath = path.join(__dirname, '..', 'reports', filename);
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    const aptHeaders = ['Data', 'Hora', 'Cliente', 'Telefone', 'Barbeiro', 'Serviço', 'Status', 'Valor'];
    const aptRows = (appointments || []).map(apt => [
      new Date(apt.appointmentDate ?? apt.appointment_date ?? apt.date ?? apt.data ?? null).toLocaleDateString('pt-BR'),
      (apt.appointmentTime ?? apt.appointment_time ?? apt.time ?? apt.hora ?? '') || '',
      escapeCSV(`${(apt.client?.firstName ?? apt.client?.nome ?? apt.clientName ?? apt.cliente_nome ?? '')} ${(apt.client?.lastName ?? apt.client?.sobrenome ?? '')}`.trim()),
      escapeCSV(apt.client?.phone ?? apt.cliente?.telefone ?? ''),
      escapeCSV(apt.barber?.name ?? apt.barbeiro?.nome ?? apt.barberName ?? apt.barbeiro_nome ?? ''),
      escapeCSV(apt.serviceType?.name ?? apt.servico?.nome ?? apt.serviceName ?? apt.servico_nome ?? ''),
      getStatusText(apt.status),
      parseFloat(apt.totalPrice ?? apt.total_price ?? apt.valor ?? 0).toFixed(2)
    ]);

    const cashierHeaders = ['Abertura', 'Fechamento', 'Inicial', 'Entradas', 'Despesas', 'Esperado', 'Contado', 'Diferença'];
    const fmt = v => (v != null ? Number(v).toFixed(2) : '');
    const cashierRows = (cashier || []).map(cs => [
      (cs.openedAt ?? cs.opened_at ?? cs.abertura ?? '') || '',
      (cs.closedAt ?? cs.closed_at ?? cs.fechamento ?? '') || '',
      fmt(cs.openingAmount ?? cs.inicial ?? cs.valorInicial),
      fmt(cs.totalEntradas ?? cs.entradas ?? cs.total_in ?? cs.total_incoming),
      fmt(cs.totalDespesas ?? cs.despesas ?? cs.total_out ?? cs.total_expenses),
      fmt(cs.saldoEsperado ?? cs.esperado ?? cs.expected),
      fmt(cs.countedCash ?? cs.contado ?? cs.counted),
      fmt(cs.diferenca ?? cs.difference ?? cs.diff)
    ]);

    const csvContent = [
      '--- AGENDAMENTOS ---',
      aptHeaders.join(';'),
      ...aptRows.map(r => r.join(';')),
      '',
      '--- CAIXA ---',
      cashierHeaders.join(';'),
      ...cashierRows.map(r => r.join(';'))
    ].join('\n');

    fs.writeFileSync(filePath, csvContent, 'utf8');
    return filePath;
  } catch (error) {
    throw error;
  }
}

// ==================================================
// Resumo (mantido)
// ==================================================
function gerarResumoDoRelatorio(appointments, cashier, startDate, endDate, barberId) {
  const resumo = {
    startDate,
    endDate,
    barbeiroSelecionado: 'Todos',
    dataGeracao: new Date().toLocaleDateString('pt-BR'),

    // Agendamentos
    totalAgendamentos: appointments.length,
    receitaTotal: 0,
    mediaValor: 0,
    statusCounts: {},
    receitaPorStatus: {},
    receitaPorBarbeiro: {},

    // Caixa
    totalEntradas: 0,
    totalDespesas: 0,
    totalSaldoEsperado: 0,
    totalDiferenca: 0
  };

  (appointments || []).forEach(apt => {
    const status = apt.status;
    resumo.statusCounts[status] = (resumo.statusCounts[status] || 0) + 1;

    const valor = parseFloat(apt.totalPrice || 0);
    resumo.receitaPorStatus[status] = (resumo.receitaPorStatus[status] || 0) + valor;

    if (apt.status !== 'cancelled') resumo.receitaTotal += valor;

    const barberName = apt.barber?.name || 'Desconhecido';
    resumo.receitaPorBarbeiro[barberName] =
      (resumo.receitaPorBarbeiro[barberName] || 0) + valor;
  });

  if (appointments.length > 0) {
    resumo.mediaValor = (resumo.receitaTotal / appointments.length).toFixed(2);
  }

  if (barberId) {
    const selectedBarber = appointments[0]?.barber?.name || 'Selecionado';
    resumo.barbeiroSelecionado = selectedBarber;
  }

  (cashier || []).forEach(cs => {
    resumo.totalEntradas += Number(cs.totalEntradas ?? cs.entradas ?? 0) || 0;
    resumo.totalDespesas += Number(cs.totalDespesas ?? cs.despesas ?? 0) || 0;
    resumo.totalSaldoEsperado += Number(cs.saldoEsperado ?? cs.esperado ?? 0) || 0;
    resumo.totalDiferenca += Number(cs.diferenca ?? cs.difference ?? 0) || 0;
  });

  resumo.periodo = `${startDate || 'início'} até ${endDate || 'hoje'}`;

  return resumo;
}

// ==================================================
// Util
// ==================================================
function getStatusText(status) {
  const statusMap = {
    'pending': 'Pendente',
    'confirmed': 'Confirmado',
    'in_progress': 'Em atendimento',
    'completed': 'Concluído',
    'cancelled': 'Cancelado',
    'no_show': 'Não compareceu'
  };
  return statusMap[status] || status;
}

module.exports = {
  generatePDF,
  generateCSV,
  gerarResumoDoRelatorio
};
