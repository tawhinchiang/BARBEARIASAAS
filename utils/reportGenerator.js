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
      // Helpers
      // -----------------------------
      const fmtMoney = (v) =>
        Number(v || 0).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });

      const fmtDate = (d) => {
        if (!d) return '—';
        const dt = new Date(d);
        if (isNaN(dt)) return '—';
        return dt.toLocaleDateString('pt-BR');
      };

      const fmtDateTimeShort = (d) => {
        if (!d) return '—';
        const dt = new Date(d);
        if (isNaN(dt)) return '—';
        const data = dt.toLocaleDateString('pt-BR');
        const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${data} ${hora}`;
      };

      const clip = (txt, max) => {
        const s = String(txt ?? '').trim();
        return s.length > max ? s.slice(0, max - 1) + '…' : s;
      };

      const now = new Date();
      const impData = now.toLocaleDateString('pt-BR');
      const impHora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

      // -----------------------------
      // Normalizadores
      // -----------------------------
      function normalizeAppointment(a = {}) {
        const appointmentDate = a.appointmentDate ?? a.appointment_date ?? a.date ?? a.data ?? null;
        const appointmentTime = a.appointmentTime ?? a.appointment_time ?? a.time ?? a.hora ?? '';
        const totalPrice      = a.totalPrice ?? a.total_price ?? a.valor ?? a.price ?? 0;
        const status          = (a.status ?? a.situacao ?? a.estado ?? 'pending') + '';

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

      // Normaliza e filtra o que polui o layout
      const apptsAll = (appointments || []).map(normalizeAppointment);
      const appts = apptsAll.filter(a => (a.status || '').toLowerCase() !== 'blocked'); // opcional
      const cash  = (cashier || []).map(normalizeCashier);

      // -----------------------------
      // Grid e tipografia
      // -----------------------------
      const P = { L: doc.page.margins.left }; // 28
      const WIDTH  = doc.page.width - doc.page.margins.left - doc.page.margins.right; // 539pt
      const LINE_H = 11; // densidade alta

      const setFont = {
        h1()   { doc.font('Helvetica-Bold').fontSize(12); },
        h2()   { doc.font('Helvetica-Bold').fontSize(10); },
        th()   { doc.font('Helvetica-Bold').fontSize(8);  },
        td()   { doc.font('Helvetica').fontSize(8);       },
        small(){ doc.font('Helvetica').fontSize(7);       },
      };

      function hr(y = doc.y, color = '#dddddd', w = 0.5) {
        doc.save()
          .moveTo(P.L, y)
          .lineTo(P.L + WIDTH, y)
          .lineWidth(w)
          .strokeColor(color)
          .stroke()
          .restore();
      }

      // Cabeçalho neutro (4 linhas)
      function addInstitutionalHeader() {
        setFont.h1(); doc.fillColor('#000');
        doc.text((reportInfo.headline1 || 'RELATÓRIO GERAL').toUpperCase(), P.L, doc.y, { width: WIDTH, align: 'center' });

        setFont.h2();
        doc.text((reportInfo.headline2 || 'SISTEMA DE GESTÃO').toUpperCase(), P.L, doc.y, { width: WIDTH, align: 'center' });
        doc.text((reportInfo.headline3 || 'MÓDULO DE AGENDAMENTOS').toUpperCase(), P.L, doc.y, { width: WIDTH, align: 'center' });
        doc.text((reportInfo.headline4 || 'PERÍODO DO RELATÓRIO').toUpperCase(), P.L, doc.y, { width: WIDTH, align: 'center' });

        const sepY = doc.y + 3;
        hr(sepY, '#dddddd', 0.5);
        doc.y = sepY + 6; // sem moveDown; avança manualmente
      }

      // ===============================
      // TABELA: AGENDAMENTOS (colunas fixas)
      // ===============================
      const COL_APT = [
        { key: 'data',     label: 'DATA',         x: P.L + 0,   w: 58,  align: 'left'  },
        { key: 'hora',     label: 'HORA',         x: P.L + 58,  w: 36,  align: 'left'  },
        { key: 'cliente',  label: 'CLIENTE',      x: P.L + 94,  w: 130, align: 'left'  },
        { key: 'barbeiro', label: 'PROFISSIONAL', x: P.L + 224, w: 102, align: 'left'  },
        { key: 'servico',  label: 'SERVIÇO',      x: P.L + 326, w: 126, align: 'left'  },
        { key: 'status',   label: 'STATUS',       x: P.L + 452, w: 57,  align: 'left'  },
        { key: 'valor',    label: 'VALOR',        x: P.L + 509, w: 30,  align: 'right' }
      ]; // soma = 539

      function drawAptHeader() {
        setFont.th(); doc.fillColor('#000');
        COL_APT.forEach(c => {
          doc.text(c.label, c.x, doc.y, { width: c.w, align: c.align || 'left', lineBreak: false, ellipsis: true });
        });
        // linha sob o header
        hr(doc.y + LINE_H - 2, '#dddddd', 0.5);
      }

      function drawAptRow(obj) {
        setFont.td(); doc.fillColor('#111');
        COL_APT.forEach(c => {
          const v = String(obj[c.key] ?? '—');
          doc.text(v, c.x, doc.y, { width: c.w, align: c.align || 'left', lineBreak: false, ellipsis: true });
        });
        // borda inferior da linha
        hr(doc.y + LINE_H - 1, '#e5e5e5', 0.5);
      }

      // ===============================
      // TABELA: CAIXA (colunas fixas)
      // ===============================
      const COL_CASH = [
        { key: 'abertura',  label: 'ABERTURA',   x: P.L + 0,   w: 100, align: 'left'  },
        { key: 'fechamento',label: 'FECHAMENTO', x: P.L + 100, w: 100, align: 'left'  },
        { key: 'inicial',   label: 'INICIAL',    x: P.L + 200, w: 56,  align: 'right' },
        { key: 'entradas',  label: 'ENTRADAS',   x: P.L + 256, w: 56,  align: 'right' },
        { key: 'despesas',  label: 'DESPESAS',   x: P.L + 312, w: 56,  align: 'right' },
        { key: 'esperado',  label: 'ESPERADO',   x: P.L + 368, w: 56,  align: 'right' },
        { key: 'contado',   label: 'CONTADO',    x: P.L + 424, w: 56,  align: 'right' },
        { key: 'diferenca', label: 'DIFERENÇA',  x: P.L + 480, w: 59,  align: 'right' }
      ]; // soma = 539

      function drawCashHeader() {
        setFont.th(); doc.fillColor('#000');
        COL_CASH.forEach(c => {
          doc.text(c.label, c.x, doc.y, { width: c.w, align: c.align || 'left', lineBreak: false, ellipsis: true });
        });
        // linha sob o header
        hr(doc.y + LINE_H - 2, '#dddddd', 0.5);
      }

      function drawCashRow(obj) {
        setFont.td(); doc.fillColor('#111');
        COL_CASH.forEach(c => {
          const v = String(obj[c.key] ?? '—');
          doc.text(v, c.x, doc.y, { width: c.w, align: c.align || 'left', lineBreak: false, ellipsis: true });
        });
        // borda inferior da linha
        hr(doc.y + LINE_H - 1, '#e5e5e5', 0.5);
      }

      // -----------------------------
      // Quebra segura usando APENAS doc.y
      // -----------------------------
      function ensurePage(linesToWrite, headerDrawer) {
        const bottom = doc.page.height - doc.page.margins.bottom;
        const need = linesToWrite * LINE_H + 4; // pequena folga

        if (doc.y + need > bottom) {
          // Proteção contra quebrar no topo imediatamente após o cabeçalho
          const topSafe = doc.page.margins.top + 40;
          if (doc.y <= topSafe) return; // evita loop

          doc.addPage();
          addInstitutionalHeader();
          if (typeof headerDrawer === 'function') {
            headerDrawer();
            doc.y += LINE_H; // avança a linha do cabeçalho de tabela
          }
        }
      }

      // ===============================
      // CONTEÚDO: Cabeçalho + Agendamentos
      // ===============================
      addInstitutionalHeader();

      // Header de agendamentos
      drawAptHeader();
      doc.y += LINE_H;

      if (!appts.length) {
        setFont.td(); doc.fillColor('#444');
        doc.text('Nenhum agendamento no período.', P.L, doc.y, { width: WIDTH, align: 'left', lineBreak: false });
        // borda sob a linha "nenhum"
        hr(doc.y + LINE_H - 1, '#e5e5e5', 0.5);
        doc.y += LINE_H;
      } else {
        let totalApt = 0;

        appts.forEach(apt => {
          const linha = {
            data:     fmtDate(apt.appointmentDate),
            hora:     (apt.appointmentTime || '').slice(0,5),
            cliente:  clip(((apt.client?.firstName || '') + ' ' + (apt.client?.lastName || '')).trim(), 28),
            barbeiro: clip(apt.barber?.name || '', 22),
            servico:  clip(apt.serviceType?.name || '', 28),
            status:   clip(getStatusText(apt.status), 14),
            valor:    fmtMoney(apt.totalPrice)
          };
          if ((apt.status || '').toLowerCase() !== 'cancelled') {
            totalApt += Number(apt.totalPrice || 0);
          }

          ensurePage(1, drawAptHeader);
          drawAptRow(linha);         // imprime e desenha a borda inferior da linha
          doc.y += LINE_H;
        });

        // TOTAL (linha enfatizada com borda acima e abaixo)
        doc.y += 2;
        ensurePage(1, drawAptHeader);
        // borda acima do total (um pouco mais forte)
        hr(doc.y - 2, '#cccccc', 0.8);

        setFont.th(); doc.fillColor('#000');
        doc.text('TOTAL', P.L + 452, doc.y, { width: 57, align: 'left', lineBreak: false });
        doc.text(fmtMoney(totalApt), P.L + 509, doc.y, { width: 30, align: 'right', lineBreak: false });
        // borda abaixo do total
        hr(doc.y + LINE_H - 1, '#e5e5e5', 0.5);
        doc.y += LINE_H;
      }

      // ===============================
      // CONTEÚDO: Caixa (Fluxo)
      // ===============================
      // separador leve entre as tabelas
      doc.y += 4; hr(doc.y, '#dddddd', 0.5); doc.y += 6;

      setFont.h2(); doc.fillColor('#000');
      doc.text('FLUXO DE CAIXA', P.L, doc.y, { width: WIDTH, align: 'left', lineBreak: false });
      doc.y += LINE_H;

      // Header da tabela de caixa
      drawCashHeader();
      doc.y += LINE_H;

      if (!cash.length) {
        setFont.td(); doc.fillColor('#444');
        doc.text('Nenhum registro de caixa no período.', P.L, doc.y, { width: WIDTH, lineBreak: false });
        // borda sob a linha "nenhum"
        hr(doc.y + LINE_H - 1, '#e5e5e5', 0.5);
        doc.y += LINE_H;
      } else {
        let totInicial = 0, totEntradas = 0, totDespesas = 0, totEsperado = 0, totContado = 0, totDif = 0;

        cash.forEach(cs => {
          const row = {
            abertura:   fmtDateTimeShort(cs.openedAt),
            fechamento: fmtDateTimeShort(cs.closedAt),
            inicial:    fmtMoney(cs.openingAmount),
            entradas:   fmtMoney(cs.totalEntradas),
            despesas:   fmtMoney(cs.totalDespesas),
            esperado:   fmtMoney(cs.saldoEsperado),
            contado:    fmtMoney(cs.countedCash),
            diferenca:  fmtMoney(cs.diferenca),
          };

          totInicial  += Number(cs.openingAmount || 0);
          totEntradas += Number(cs.totalEntradas || 0);
          totDespesas += Number(cs.totalDespesas || 0);
          totEsperado += Number(cs.saldoEsperado || 0);
          totContado  += Number(cs.countedCash || 0);
          totDif      += Number(cs.diferenca || 0);

          ensurePage(1, drawCashHeader);
          drawCashRow(row);         // imprime e desenha a borda inferior da linha
          doc.y += LINE_H;
        });

        // Totais do caixa (linha enfatizada com borda acima e abaixo)
        doc.y += 2;
        ensurePage(1, drawCashHeader);
        hr(doc.y - 2, '#cccccc', 0.8); // borda superior do total

        setFont.th(); doc.fillColor('#000');
        doc.text('TOTAIS', P.L + 0,  doc.y, { width: 200, align: 'left',  lineBreak: false });
        doc.text(fmtMoney(totInicial),  P.L + 200, doc.y, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totEntradas), P.L + 256, doc.y, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totDespesas), P.L + 312, doc.y, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totEsperado), P.L + 368, doc.y, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totContado),  P.L + 424, doc.y, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totDif),      P.L + 480, doc.y, { width: 59, align: 'right', lineBreak: false });
        hr(doc.y + LINE_H - 1, '#e5e5e5', 0.5); // borda inferior do total
        doc.y += LINE_H;
      }

      // ===============================
      // Rodapé em TODAS as páginas
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
