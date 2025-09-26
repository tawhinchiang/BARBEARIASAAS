const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ==================================================
// PDF (layout 100% em LINHAS, colunas fixas)
// ==================================================
// console.log('[REPORT] appointments:', appointments?.length, 'cashier:', cashier?.length);

async function generatePDF({ appointments = [], cashier = [] }, reportInfo = {}, filename) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 28, left: 28, right: 28, bottom: 32 }
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

      // -----------------------------
      // Normalizadores (evitam campos em branco por chaves diferentes)
      // -----------------------------
      function normalizeAppointment(a = {}) {
        const appointmentDate =
          a.appointmentDate ?? a.appointment_date ?? a.date ?? a.data ?? null;
        const appointmentTime =
          a.appointmentTime ?? a.appointment_time ?? a.time ?? a.hora ?? '';

        const totalPrice =
          a.totalPrice ?? a.total_price ?? a.valor ?? a.price ?? 0;

        const status = a.status ?? a.situacao ?? a.estado ?? 'pending';

        const client = a.client ?? a.cliente ?? {};
        const firstName = client.firstName ?? client.nome ?? a.clientName ?? a.cliente_nome ?? '';
        const lastName  = client.lastName  ?? client.sobrenome ?? '';

        const barberObj = a.barber ?? a.barbeiro ?? {};
        const barberName = barberObj.name ?? a.barberName ?? a.barbeiro_nome ?? '';

        const svcObj = a.serviceType ?? a.servico ?? {};
        const serviceName = svcObj.name ?? a.serviceName ?? a.servico_nome ?? '';

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
        const openedAt   = c.openedAt   ?? c.opened_at   ?? c.abertura   ?? null;
        const closedAt   = c.closedAt   ?? c.closed_at   ?? c.fechamento ?? null;
        const openingAmount = c.openingAmount ?? c.inicial ?? c.valorInicial ?? 0;

        const totalEntradas = c.totalEntradas ?? c.entradas ?? c.total_in ?? c.total_incoming ?? 0;
        const totalDespesas = c.totalDespesas ?? c.despesas ?? c.total_out ?? c.total_expenses ?? 0;
        const saldoEsperado = c.saldoEsperado ?? c.esperado ?? c.expected ?? 0;
        const countedCash   = c.countedCash   ?? c.contado  ?? c.counted  ?? 0;
        const diferenca     = c.diferenca     ?? c.difference ?? c.diff ?? 0;

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

      // Aplica normalização
      const appts = (appointments || []).map(normalizeAppointment);
      const cash  = (cashier || []).map(normalizeCashier);

      // -----------------------------
      // Grid e tipografia
      // -----------------------------
      const P = { // posições horizontais “fixas” (colunas)
        L: 28,    // margem esquerda
        C1: 28,   // Label principal
        C2: 190,  // Valor 1
        C3: 330,  // Valor 2
        C4: 470   // Valor 3 (quando necessário)
      };
     const WIDTH = doc.page.width - doc.page.margins.left - doc.page.margins.right; // 100% da área útil
 
      const LINE_H = 14; // altura de cada linha

      let pageNumber = 1;

      const setFont = {
        h1() { doc.font('Helvetica-Bold').fontSize(14); },
        h2() { doc.font('Helvetica-Bold').fontSize(10); },
        label() { doc.font('Helvetica').fontSize(8); },
        bold() { doc.font('Helvetica-Bold').fontSize(8); },
        small() { doc.font('Helvetica').fontSize(7); },
      };

      function hr(y = doc.y, padTop = 6, padBottom = 6) {
        doc.moveTo(P.L, y + padTop).lineTo(P.L + WIDTH, y + padTop).lineWidth(0.5).strokeColor('#dddddd').stroke();
        doc.moveDown((padBottom + padTop) / LINE_H);
      }

      function ensureSpace(lines = 1) {
        const need = lines * LINE_H + 20; // margem de segurança
        if (doc.y + need > doc.page.height - doc.page.margins.bottom) {
          addFooter(); // footer antes de quebrar
          doc.addPage();
          pageNumber++;
          addHeader(); // header após quebrar
        }
      }

      function addHeader() {
        const titulo = clip(reportInfo?.title || 'Relatório Geral', 70);
        const periodo = reportInfo?.period || '';
        const barber = reportInfo?.barber || '';

        setFont.h1();
        doc.fillColor('#111').text(titulo, P.L, doc.y, { width: WIDTH, align: 'left' });
        setFont.small();
        const meta = [
          periodo ? `Período: ${periodo}` : null,
          barber ? `Barbeiro: ${barber}` : null
        ].filter(Boolean).join('   |   ');
        if (meta) doc.fillColor('#444').text(meta, P.L, doc.y, { width: WIDTH, align: 'left' });
        hr(doc.y, 6, 6);
      }

      function addFooter() {
        const footerY = doc.page.height - doc.page.margins.bottom + 8;
        doc.font('Helvetica').fontSize(7).fillColor('#666');
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, P.L, footerY, { width: WIDTH, align: 'left' });
        doc.text(`Página ${pageNumber}`, P.L, footerY, { width: WIDTH, align: 'right' });
      }

      // Linha Label: Valor (coluna fixa)
      function row(label, value, y = doc.y, colLabel = P.C1, colValue = P.C2) {
        ensureSpace(1);
        setFont.label(); doc.fillColor('#111'); doc.text(clip(label, 44), colLabel, y, { width: P.C2 - colLabel - 6, align: 'left' });
        setFont.bold(); doc.fillColor('#000'); doc.text(String(value ?? '—'), colValue, y, { width: P.C3 - colValue - 6, align: 'left' });
        doc.moveDown(1);
      }

      // Linha com múltiplos valores (até 3 colunas)
      function row3(l1, v1, l2, v2, l3, v3) {
        ensureSpace(1);
        const baseY = doc.y;
        setFont.label(); doc.fillColor('#111'); doc.text(clip(l1, 28), P.C1, baseY, { width: P.C2 - P.C1 - 6 });
        setFont.bold();  doc.text(String(v1 ?? '—'), P.C2, baseY, { width: P.C3 - P.C2 - 6 });

        setFont.label(); doc.text(clip(l2, 28), P.C3, baseY, { width: P.C4 - P.C3 - 6 });
        setFont.bold();  doc.text(String(v2 ?? '—'), P.C4 - 95, baseY, { width: 95 });

        if (l3) {
          doc.moveDown(1);
          ensureSpace(1);
          const y2 = baseY + LINE_H; // próxima linha
          setFont.label(); doc.text(clip(l3, 28), P.C1, y2, { width: P.C2 - P.C1 - 6 });
          setFont.bold();  doc.text(String(v3 ?? '—'), P.C2, y2, { width: P.C3 - P.C2 - 6 });
          doc.moveDown(1);
        } else {
          doc.moveDown(1);
        }
      }

      function section(title) {
        ensureSpace(2);
        setFont.h2(); doc.fillColor('#000'); doc.text(title, P.L, doc.y, { width: WIDTH });
        hr(doc.y, 4, 2);
      }
      // ===============================
// Layout fixo (colunas) para AGENDAMENTOS
// ===============================
const AG_COLS = [
  { key: 'data',     label: 'Data',     x: P.L + 0,   w: 58,  align: 'left'  },
  { key: 'hora',     label: 'Hora',     x: P.L + 58,  w: 36,  align: 'left'  },
  { key: 'cliente',  label: 'Cliente',  x: P.L + 94,  w: 130, align: 'left'  },
  { key: 'barbeiro', label: 'Barbeiro', x: P.L + 224, w: 100, align: 'left'  },
  { key: 'servico',  label: 'Serviço',  x: P.L + 324, w: 130, align: 'left'  },
  { key: 'status',   label: 'Status',   x: P.L + 454, w: 55,  align: 'left'  },
  { key: 'valor',    label: 'Valor',    x: P.L + 509, w: 30,  align: 'right' }
];
// Soma = 58+36+130+100+130+55+30 = 539 (bate com WIDTH de A4 com margens 28)

function drawAgHeader(y) {
  setFont.label(); doc.fillColor('#666');
  AG_COLS.forEach(c => {
    doc.text(c.label, c.x, y, {
      width: c.w,
      align: c.align,
      lineBreak: false,
      ellipsis: true
    });
  });
  // linha fina abaixo do header
  doc.moveTo(P.L, y + LINE_H - 2).lineTo(P.L + WIDTH, y + LINE_H - 2)
     .lineWidth(0.5).strokeColor('#dddddd').stroke();
}

function drawAgRow(y, rowObj) {
  setFont.small(); doc.fillColor('#111');
  AG_COLS.forEach(c => {
    const v = String(rowObj[c.key] ?? '—');
    doc.text(v, c.x, y, {
      width: c.w,
      align: c.align,
      lineBreak: false,   // não quebrar linha
      ellipsis: true      // cortar com reticências
    });
  });
  // separador discreto por linha
  doc.moveTo(P.L, y + LINE_H - 3).lineTo(P.L + WIDTH, y + LINE_H - 3)
     .lineWidth(0.3).strokeColor('#efefef').stroke();
}

      // ===============================
      // Cabeçalho (título geral)
      // ===============================
      addHeader();

      // ——————————————————————————————————————————
      // DEBUG opcional (remova após validar)
      // setFont.small(); doc.fillColor('#666');
      // doc.text(`DEBUG · agendamentos: ${appts.length}  |  caixa: ${cash.length}`, P.L, doc.y, { width: WIDTH });
      // doc.moveDown(0.6);
      // ——————————————————————————————————————————

      // ===============================
      // SEÇÃO: AGENDAMENTOS (LINHAS)
      // ===============================
section('Agendamentos');

let y = doc.y; // base da seção
const TOP_PAD = 2;
y += TOP_PAD;

// quebra segura com reimpressão do header das colunas
function ensurePageFor(lines = 1) {
  const need = lines * LINE_H + 20;
  if (y + need > doc.page.height - doc.page.margins.bottom) {
    addFooter();
    doc.addPage();
    pageNumber++;
    addHeader();
    section('Agendamentos');
    y = doc.y + TOP_PAD;
    drawAgHeader(y);  // reimprime header na nova página
    y += LINE_H;
  }
}

if (!appts.length) {
  setFont.small(); doc.fillColor('#444');
  doc.text('Nenhum agendamento no período.', P.L, y, { width: WIDTH });
  y += LINE_H * 2;
} else {
  // Resumo compacto no topo
  setFont.label(); doc.fillColor('#111');
  doc.text('Total de Agendamentos', P.C1, y, { width: 150, lineBreak: false });
  setFont.bold();  doc.text(String(appts.length), P.C2, y, { width: 100, lineBreak: false }); 
  y += LINE_H;

  setFont.label(); doc.text('Receita (não cancelados)', P.C1, y, { width: 150, lineBreak: false });
  const totalApt = appts.reduce((acc, a) => acc + (a.status !== 'cancelled' ? Number(a.totalPrice||0) : 0), 0);
  setFont.bold();  doc.text(fmtMoney(totalApt), P.C2, y, { width: 100, lineBreak: false }); 
  y += LINE_H;

  const qtPorStatus = appts.reduce((acc, a) => (acc[a.status]=(acc[a.status]||0)+1, acc), {});
  setFont.label(); doc.text('Distribuição por Status', P.C1, y, { width: 150, lineBreak: false });
  setFont.bold();  doc.text(
    Object.entries(qtPorStatus).map(([s,q])=>`${getStatusText(s)}: ${q}`).join('  ·  '),
    P.C2, y, { width: WIDTH - (P.C2 - P.L), lineBreak: false, ellipsis: true }
  );
  y += LINE_H + 4;

  // Cabeçalho de colunas
  drawAgHeader(y);
  y += LINE_H;

  // Uma linha por agendamento
  appts.forEach((apt) => {
    ensurePageFor(1);

    const linha = {
      data:     fmtDate(apt.appointmentDate),
      hora:     (apt.appointmentTime || '').slice(0,5),
      cliente:  ((apt.client?.firstName || '') + ' ' + (apt.client?.lastName || '')).trim(),
      barbeiro: apt.barber?.name || '',
      servico:  apt.serviceType?.name || '',
      status:   getStatusText(apt.status),
      valor:    fmtMoney(apt.totalPrice)
    };

    drawAgRow(y, linha);
    y += LINE_H; // avança exata altura da linha
  });

  y += 6; // pequeno respiro
}
doc.moveDown(0.2);


      // ===============================
      // SEÇÃO: CAIXA (LINHAS)
      // ===============================
      section('Relatório de Caixa');

      // Agregados corretos (em cima dos dados normalizados)
      const sum = (arr, key) => arr.reduce((acc, it) => acc + Number(it?.[key] || 0), 0);
      const totalEntradas  = sum(cash, 'totalEntradas');
      const totalDespesas  = sum(cash, 'totalDespesas');
      const totalEsperado  = sum(cash, 'saldoEsperado');
      const totalContado   = sum(cash, 'countedCash');
      const totalDiferenca = sum(cash, 'diferenca');
      const aberturaPrim   = cash[0]?.openedAt;
      const fechamentoUlt  = cash[cash.length - 1]?.closedAt;

      // Resumo do caixa em linhas
      row('Abertura (primeira)', fmtDateTime(aberturaPrim));
      row('Fechamento (última)', fmtDateTime(fechamentoUlt));
      row3('Entradas', fmtMoney(totalEntradas), 'Despesas', fmtMoney(totalDespesas), 'Saldo Esperado', fmtMoney(totalEsperado));
      row3('Contado', fmtMoney(totalContado), 'Diferença', fmtMoney(totalDiferenca));

      doc.moveDown(0.6);
      hr();

      // Detalhamento de cada fechamento de caixa (em linhas)
      cash.forEach((cs, i) => {
        ensureSpace(4);
        setFont.bold(); doc.fillColor('#000');
        doc.text(`#${String(i+1).padStart(2,'0')} Caixa`, P.L, doc.y, { width: WIDTH });
        setFont.small(); doc.fillColor('#444');
        doc.text(`Período: ${fmtDateTime(cs.openedAt)}  -  ${fmtDateTime(cs.closedAt)}`, P.L, doc.y, { width: WIDTH });
        doc.moveDown(0.3);

        row3('Inicial', fmtMoney(cs.openingAmount), 'Entradas', fmtMoney(cs.totalEntradas), 'Despesas', fmtMoney(cs.totalDespesas));
        row3('Esperado', fmtMoney(cs.saldoEsperado), 'Contado', fmtMoney(cs.countedCash), 'Diferença', fmtMoney(cs.diferenca));
        doc.moveDown(0.2);
        hr(doc.y - 6, 2, 6);
      });

      // ===============================
      // Rodapé final
      // ===============================
      addFooter();
      doc.end();

      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ==================================================
// CSV
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
// Resumo
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

  // ===============================
  // Resumo dos agendamentos
  // ===============================
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

  // ===============================
  // Resumo do caixa
  // ===============================
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
