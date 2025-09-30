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
      if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ---------- Helpers ----------
      const fmtMoney = v => Number(v || 0).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
      });
      const fmtDate = d => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR'); };
      const fmtDateTimeShort = d => {
        if (!d) return '—';
        const dt = new Date(d); if (isNaN(dt)) return '—';
        const data = dt.toLocaleDateString('pt-BR');
        const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${data} ${hora}`;
      };
      const clip = (s, max) => { const t = String(s ?? '').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
      const now = new Date();
      const impData = now.toLocaleDateString('pt-BR');
      const impHora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

      const getStatusText = (status => {
        const map = {
          pending: 'Pendente', confirmed: 'Confirmado', in_progress: 'Em atendimento',
          completed: 'Concluído', cancelled: 'Cancelado', no_show: 'Não compareceu'
        };
        return s => map[s] || s || '';
      })();

      // Normaliza método de pagamento para o conjunto fixo
      // 1) ampliar normalizeMethod (apenas troque o bloco de if/return)
      function normalizeMethod(raw) {
        const s = String(raw || '')
          .toLowerCase()
          .normalize('NFD').replace(/\p{Diacritic}/gu, '');

        if (!s) return 'other';
        if (/(dinheiro|cash|money)/.test(s)) return 'cash';
        if (/(credit|credito|cartao.*credito|credit_card|cartao_credito|cc)/.test(s)) return 'credit';
        if (/(debit|debito|cartao.*debito|debit_card|cartao_debito|cd)/.test(s)) return 'debit';
        if (/\bpix\b/.test(s)) return 'pix';
        if (/(voucher|vale|ticket|refeicao|alimentacao)/.test(s)) return 'other'; // mapeamos voucher para 'other' por enquanto
        return 'other';
      }

      // 2) substituir fromAppointments
      function fromAppointments(apts) {
        const acc = { cash: 0, credit: 0, debit: 0, pix: 0, other: 0 };

        apts.forEach(a => {
          const isRevenue = String(a.status || '').toLowerCase() === 'completed';
          if (!isRevenue) return;

          // Caso ideal: temos payments com amount
          if (Array.isArray(a.payments) && a.payments.length) {
            a.payments.forEach(p => {
              if (!p) return;
              const key = normalizeMethod(p.method);
              acc[key] = (acc[key] || 0) + Number(p.amount || 0);
            });
            return;
          }

          // Alternativa: 1 método conhecido sem amount => joga o total inteiro nele
          if (a.paymentMethod) {
            const key = normalizeMethod(a.paymentMethod);
            acc[key] = (acc[key] || 0) + Number(a.totalPrice || 0);
            return;
          }

          // Alternativa: a.payment.method
          if (a.payment && a.payment.method) {
            const key = normalizeMethod(a.payment.method);
            acc[key] = (acc[key] || 0) + Number(a.totalPrice || 0);
            return;
          }

          // Último recurso: se vieram "métodos" múltiplos sem amount, divide igualmente
          if (Array.isArray(a.payments) && a.payments.length) {
            const per = Number(a.totalPrice || 0) / a.payments.length;
            a.payments.forEach(p => {
              const key = normalizeMethod(p.method);
              acc[key] = (acc[key] || 0) + per;
            });
            return;
          }

          // Nada encontrado => 'other'
          acc.other += Number(a.totalPrice || 0);
        });

        return acc;
      }

      function normalizeCashier(c = {}) {
        const openedAt = c.openedAt ?? c.opened_at ?? c.abertura ?? null;
        const closedAt = c.closedAt ?? c.closed_at ?? c.fechamento ?? null;
        const openingAmount = c.openingAmount ?? c.inicial ?? c.valorInicial ?? 0;
        const totalEntradas = c.totalEntradas ?? c.entradas ?? c.total_in ?? c.total_incoming ?? 0;
        const totalDespesas = c.totalDespesas ?? c.despesas ?? c.total_out ?? c.total_expenses ?? 0;
        const saldoEsperado = c.saldoEsperado ?? c.esperado ?? c.expected ?? 0;
        const countedCash = c.countedCash ?? c.contado ?? c.counted ?? 0;
        const diferenca = c.diferenca ?? c.difference ?? c.diff ?? 0;
        return {
          openedAt, closedAt,
          openingAmount: Number(openingAmount || 0),
          totalEntradas: Number(totalEntradas || 0),
          totalDespesas: Number(totalDespesas || 0),
          saldoEsperado: Number(saldoEsperado || 0),
          countedCash: Number(countedCash || 0),
          diferenca: Number(diferenca || 0),
          summary: c.summary || c.resumo // se vier consolidado no item
        };
      }

      const appts = (appointments || []).map(normalizeAppointment).filter(a => (a.status || '').toLowerCase() !== 'blocked');
      const cash = Array.isArray(cashier) ? cashier.map(normalizeCashier)
        : [normalizeCashier(cashier || {})];

      // ---------- Totais por método (coleta robusta) ----------
      function fromCashierSummary(cashArr) {
        // procura no objeto inteiro e/ou no primeiro item
        const root = (cashArr && (cashArr.summary || cashArr.resumo)) ? cashArr
          : (cashArr[0] && (cashArr[0].summary || cashArr[0].resumo)) ? cashArr[0]
            : null;
        if (!root) return null;
        const entradas = (root.summary?.entradas || root.resumo?.entradas);
        if (!entradas) return null;
        const base = { cash: 0, credit: 0, debit: 0, pix: 0, other: 0 };
        for (const k of Object.keys(entradas)) {
          const nk = normalizeMethod(k);
          base[nk] = (base[nk] || 0) + Number(entradas[k] || 0);
        }
        return base;
      }

      function fromAppointments(apts) {
        const acc = { cash: 0, credit: 0, debit: 0, pix: 0, other: 0 };
        apts.forEach(a => {
          const isRevenue = String(a.status || '').toLowerCase() === 'completed';
          if (!isRevenue) return;

          const cands = [];
          if (a.paymentMethod) cands.push(a.paymentMethod);
          if (a.payment && a.payment.method) cands.push(a.payment.method);
          if (Array.isArray(a.payments)) a.payments.forEach(p => p && p.method && cands.push(p.method));

          if (!cands.length) {
            acc.other += Number(a.totalPrice || 0);
            return;
          }
          const per = Number(a.totalPrice || 0) / cands.length;
          cands.forEach(m => {
            const key = normalizeMethod(m);
            acc[key] = (acc[key] || 0) + per;
          });
        });
        return acc;
      }

      const PM_ORDER = ['cash', 'credit', 'debit', 'pix', 'other'];
      const PM_LABEL = { cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX', other: 'Outros' };

      let payTotals = fromCashierSummary(cashier) || fromCashierSummary(cash) || fromAppointments(appts);

      // ---------- Grid/Tipografia ----------
      const P = { L: doc.page.margins.left };
      const WIDTH = doc.page.width - doc.page.margins.left - doc.page.margins.right; // 539pt
      const LINE_H = 12; // compacto e consistente

      const setFont = {
        h1() { doc.font('Helvetica-Bold').fontSize(12); },
        h2() { doc.font('Helvetica-Bold').fontSize(10); },
        th() { doc.font('Helvetica-Bold').fontSize(8); },
        td() { doc.font('Helvetica').fontSize(8); },
        small() { doc.font('Helvetica').fontSize(7); },
      };
      const hr = (y, color = '#dddddd', w = 0.8) => {
        doc.save().moveTo(P.L, y).lineTo(P.L + WIDTH, y).lineWidth(w).strokeColor(color).stroke().restore();
      };

      // ---------- Header medindo altura real ----------
      function addInstitutionalHeader() {
        const l1 = (reportInfo.headline1 || 'RELATÓRIO GERAL').toUpperCase();
        const l2 = (reportInfo.headline2 || 'SISTEMA DE GESTÃO').toUpperCase();
        const l3 = (reportInfo.headline3 || 'MÓDULO DE AGENDAMENTOS').toUpperCase();
        const l4 = (reportInfo.headline4 || 'PERÍODO DO RELATÓRIO').toUpperCase();

        setFont.h1(); doc.fillColor('#000');
        let y = doc.y;
        const h1h = doc.heightOfString(l1, { width: WIDTH, align: 'center' });
        doc.text(l1, P.L, y, { width: WIDTH, align: 'center', lineBreak: false });
        y += h1h;

        setFont.h2();
        const h2a = doc.heightOfString(l2, { width: WIDTH, align: 'center' });
        doc.text(l2, P.L, y, { width: WIDTH, align: 'center', lineBreak: false });
        y += h2a;

        const h2b = doc.heightOfString(l3, { width: WIDTH, align: 'center' });
        doc.text(l3, P.L, y, { width: WIDTH, align: 'center', lineBreak: false });
        y += h2b;

        const h2c = doc.heightOfString(l4, { width: WIDTH, align: 'center' });
        doc.text(l4, P.L, y, { width: WIDTH, align: 'center', lineBreak: false });
        y += h2c + 3;

        hr(y, '#dddddd', 0.5);
        doc.y = y + 6; // começa a tabela abaixo da régua
      }

      // ---------- Tabela: Agendamentos ----------
      const COL_APT = [
        { key: 'data', label: 'DATA', x: P.L + 0, w: 58, align: 'left' },
        { key: 'hora', label: 'HORA', x: P.L + 58, w: 36, align: 'left' },
        { key: 'cliente', label: 'CLIENTE', x: P.L + 94, w: 120, align: 'left' },
        { key: 'barbeiro', label: 'PROFISSIONAL', x: P.L + 214, w: 92, align: 'left' },
        { key: 'servico', label: 'SERVIÇO', x: P.L + 306, w: 116, align: 'left' },
        { key: 'status', label: 'STATUS', x: P.L + 422, w: 57, align: 'left' },
        { key: 'valor', label: 'VALOR', x: P.L + 479, w: 60, align: 'right' }
      ]; // soma 539

      const drawAptHeader = () => {
        const y0 = doc.y;
        setFont.th(); doc.fillColor('#000');
        COL_APT.forEach(c => doc.text(c.label, c.x, y0, { width: c.w, align: c.align, lineBreak: false }));
        hr(y0 + LINE_H - 2, '#dddddd', 0.5);
      };
      const drawAptRow = (obj) => {
        const y0 = doc.y;
        setFont.td(); doc.fillColor('#111');
        COL_APT.forEach(c => doc.text(String(obj[c.key] ?? '—'), c.x, y0, { width: c.w, align: c.align, lineBreak: false }));
        hr(y0 + LINE_H - 1, '#e5e5e5', 0.5);
      };

      // ---------- Tabela: Caixa ----------
      const COL_CASH = [
        { key: 'abertura', label: 'ABERTURA', x: P.L + 0, w: 100, align: 'left' },
        { key: 'fechamento', label: 'FECHAMENTO', x: P.L + 100, w: 100, align: 'left' },
        { key: 'inicial', label: 'INICIAL', x: P.L + 200, w: 56, align: 'right' },
        { key: 'entradas', label: 'ENTRADAS', x: P.L + 256, w: 56, align: 'right' },
        { key: 'despesas', label: 'DESPESAS', x: P.L + 312, w: 56, align: 'right' },
        { key: 'esperado', label: 'ESPERADO', x: P.L + 368, w: 56, align: 'right' },
        { key: 'contado', label: 'CONTADO', x: P.L + 424, w: 56, align: 'right' },
        { key: 'diferenca', label: 'DIFERENÇA', x: P.L + 480, w: 59, align: 'right' }
      ];
      const drawCashHeader = () => {
        const y0 = doc.y;
        setFont.th(); doc.fillColor('#000');
        COL_CASH.forEach(c => doc.text(c.label, c.x, y0, { width: c.w, align: c.align, lineBreak: false }));
        hr(y0 + LINE_H - 2, '#dddddd', 0.5);
      };
      const drawCashRow = (obj) => {
        const y0 = doc.y;
        setFont.td(); doc.fillColor('#111');
        COL_CASH.forEach(c => doc.text(String(obj[c.key] ?? '—'), c.x, y0, { width: c.w, align: c.align, lineBreak: false }));
        hr(y0 + LINE_H - 1, '#e5e5e5', 0.5);
      };

      // ---------- Quebra segura ----------
      function ensurePage(linesToWrite, headerDrawer) {
        const bottom = doc.page.height - doc.page.margins.bottom;
        const need = linesToWrite * LINE_H + 4;
        if (doc.y + need > bottom) {
          doc.addPage();
          addInstitutionalHeader();
          if (typeof headerDrawer === 'function') {
            headerDrawer();
            doc.y += LINE_H;
          }
        }
      }

      // ---------- Render ----------
      addInstitutionalHeader();

      // Agendamentos
      drawAptHeader();
      doc.y += LINE_H;

      const isRevenue = s => String(s).toLowerCase() === 'completed';

      if (!appts.length) {
        const y0 = doc.y;
        setFont.td(); doc.fillColor('#444');
        doc.text('Nenhum agendamento no período.', P.L, y0, { width: WIDTH, align: 'left', lineBreak: false });
        hr(y0 + LINE_H - 1, '#e5e5e5', 0.5);
        doc.y += LINE_H;
      } else {
        let totalApt = 0;
        appts.forEach(apt => {
          const linha = {
            data: fmtDate(apt.appointmentDate),
            hora: (apt.appointmentTime || '').slice(0, 5),
            cliente: clip(((apt.client?.firstName || '') + ' ' + (apt.client?.lastName || '')).trim(), 28),
            barbeiro: clip(apt.barber?.name || '', 22),
            servico: clip(apt.serviceType?.name || '', 28),
            status: clip(getStatusText(apt.status), 14),
            valor: fmtMoney(apt.totalPrice)
          };
          if (isRevenue(apt.status)) totalApt += Number(apt.totalPrice || 0);

          ensurePage(1, drawAptHeader);
          drawAptRow(linha);
          doc.y += LINE_H;
        });

        // TOTAL agendamentos
        doc.y += 1;
        ensurePage(1, drawAptHeader);
        hr(doc.y - 2, '#cccccc', 0.8);
        setFont.th(); doc.fillColor('#000');
        const yTot = doc.y;
        doc.text('TOTAL', P.L + 422, yTot, { width: 57, align: 'left', lineBreak: false });
        doc.text(fmtMoney(totalApt), P.L + 479, yTot, { width: 60, align: 'right', lineBreak: false });
        hr(yTot + LINE_H - 1, '#e5e5e5', 0.5);
        doc.y += LINE_H;
      }

      // --- Totais por forma de pagamento (mini-tabela) ---
      {
        doc.y += 2;
        ensurePage(2, drawAptHeader);
        setFont.h2(); doc.fillColor('#000');
        doc.text('TOTAIS POR FORMA DE PAGAMENTO', P.L, doc.y, { width: WIDTH, align: 'left', lineBreak: false });
        doc.y += LINE_H;

        const colW = Math.floor(WIDTH / 5); // 5 colunas
        const yHdr = doc.y;
        setFont.th(); doc.fillColor('#000');
        PM_ORDER.forEach((k, i) => {
          doc.text(PM_LABEL[k], P.L + (i * colW), yHdr, { width: colW, align: 'center', lineBreak: false });
        });
        hr(yHdr + LINE_H - 2, '#dddddd', 0.5);

        doc.y += LINE_H;
        const yRow = doc.y;
        setFont.td(); doc.fillColor('#111');
        PM_ORDER.forEach((k, i) => {
          doc.text(fmtMoney((payTotals && payTotals[k]) || 0), P.L + (i * colW), yRow, { width: colW, align: 'center', lineBreak: false });
        });
        hr(yRow + LINE_H - 1, '#e5e5e5', 0.5);
        doc.y += LINE_H + 4;
      }

      // Caixa
      doc.y += 4; hr(doc.y, '#dddddd', 0.5); doc.y += 6;
      setFont.h2(); doc.fillColor('#000');
      doc.text('FLUXO DE CAIXA', P.L, doc.y, { width: WIDTH, align: 'left', lineBreak: false });
      doc.y += LINE_H;

      drawCashHeader();
      doc.y += LINE_H;

      if (!cash.length || (cash.length === 1 && !cash[0].openedAt && !cash[0].closedAt && !cash[0].totalEntradas && !cash[0].totalDespesas)) {
        const y0 = doc.y;
        setFont.td(); doc.fillColor('#444');
        doc.text('Nenhum registro de caixa no período.', P.L, y0, { width: WIDTH, lineBreak: false });
        hr(y0 + LINE_H - 1, '#e5e5e5', 0.5);
        doc.y += LINE_H;
      } else {
        let totInicial = 0, totEntradas = 0, totDespesas = 0, totEsperado = 0, totContado = 0, totDif = 0;
        cash.forEach(cs => {
          const row = {
            abertura: fmtDateTimeShort(cs.openedAt),
            fechamento: fmtDateTimeShort(cs.closedAt),
            inicial: fmtMoney(cs.openingAmount),
            entradas: fmtMoney(cs.totalEntradas),
            despesas: fmtMoney(cs.totalDespesas),
            esperado: fmtMoney(cs.saldoEsperado),
            contado: fmtMoney(cs.countedCash),
            diferenca: fmtMoney(cs.diferenca),
          };
          totInicial += Number(cs.openingAmount || 0);
          totEntradas += Number(cs.totalEntradas || 0);
          totDespesas += Number(cs.totalDespesas || 0);
          totEsperado += Number(cs.saldoEsperado || 0);
          totContado += Number(cs.countedCash || 0);
          totDif += Number(cs.diferenca || 0);

          ensurePage(1, drawCashHeader);
          drawCashRow(row);
          doc.y += LINE_H;
        });

        // Totais do caixa
        doc.y += 1;
        ensurePage(2, drawCashHeader);
        hr(doc.y - 2, '#cccccc', 0.8);
        setFont.th(); doc.fillColor('#000');
        const yTot = doc.y;
        doc.text('TOTAIS', P.L + 0, yTot, { width: 200, align: 'left', lineBreak: false });
        doc.text(fmtMoney(totInicial), P.L + 200, yTot, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totEntradas), P.L + 256, yTot, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totDespesas), P.L + 312, yTot, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totEsperado), P.L + 368, yTot, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totContado), P.L + 424, yTot, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totDif), P.L + 480, yTot, { width: 59, align: 'right', lineBreak: false });
        hr(yTot + LINE_H - 1, '#e5e5e5', 0.5);
        doc.y += LINE_H;

        // Resumos abaixo da tabela
        const resultadoPeriodo = totEntradas - totDespesas;
        const sobraFalta = totDif;

        setFont.td(); doc.fillColor('#000');
        const yRes = doc.y + 2;
        doc.text(`Resultado (Entradas - Despesas): ${fmtMoney(resultadoPeriodo)}`, P.L, yRes, { width: WIDTH / 2, align: 'left', lineBreak: false });
        doc.text(`Sobra/Falta (Diferença total): ${fmtMoney(sobraFalta)}`, P.L + WIDTH / 2, yRes, { width: WIDTH / 2, align: 'right', lineBreak: false });
        hr(yRes + LINE_H, '#e5e5e5', 0.5);
        doc.y = yRes + LINE_H + 2;
      }

      // ---------- Rodapé (todas as páginas) ----------
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const num = i - range.start + 1;
        const total = range.count;
        const footerY = doc.page.height - doc.page.margins.bottom - 10;
        setFont.small(); doc.fillColor('#000');
        doc.text(`Data da impressão ${impData} as ${impHora}`, P.L, footerY, { width: WIDTH / 2, align: 'left', lineBreak: false });
        doc.text(`PÁGINA: ${num}/${total}`, P.L + WIDTH / 2, footerY, { width: WIDTH / 2, align: 'right', lineBreak: false });
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
