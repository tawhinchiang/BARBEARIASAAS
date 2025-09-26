const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Gerar relatório em PDF
// Substituir toda a função generatePDF por este novo conteúdo:



// ==================================================
// PDF
// ==================================================
// ==================================================
// PDF (layout 100% em LINHAS, colunas fixas)
// ==================================================
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
      // Grid e tipografia
      // -----------------------------
      const P = { // posições horizontais “fixas” (colunas)
        L: 28,    // margem esquerda
        C1: 28,   // Label principal
        C2: 190,  // Valor 1
        C3: 330,  // Valor 2
        C4: 470   // Valor 3 (quando necessário)
      };
      const WIDTH = 540; // largura útil aproximada
      const LINE_H = 14; // altura de cada linha
      const SEP_Y = 8;   // espaço extra entre blocos

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
        doc.moveDown( (padBottom + padTop) / LINE_H );
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
      // Cabeçalho (título geral)
      // ===============================
      addHeader();

      // ===============================
      // SEÇÃO: AGENDAMENTOS (LINHAS)
      // ===============================
      section('Agendamentos');

      if (!appointments.length) {
        setFont.small(); doc.fillColor('#444');
        doc.text('Nenhum agendamento no período.', P.L, doc.y, { width: WIDTH });
        doc.moveDown(1.2);
      } else {
        // Totais
        let totalApt = 0;
        let qtPorStatus = {};
        appointments.forEach(a => {
          const valor = Number(a.totalPrice || 0);
          totalApt += (a.status !== 'cancelled') ? valor : 0;
          qtPorStatus[a.status] = (qtPorStatus[a.status] || 0) + 1;
        });

        // Resumo de topo (em linhas)
        row('Total de Agendamentos', appointments.length);
        row('Receita (não cancelados)', fmtMoney(totalApt));
        row('Distribuição por Status', Object.entries(qtPorStatus).map(([s,q])=>`${getStatusText(s)}: ${q}`).join('  ·  '));
        doc.moveDown(0.6);

        // Listagem em linhas (não tabela)
        appointments.forEach((apt, idx) => {
          ensureSpace(3);
          const data  = apt.appointmentDate ? new Date(apt.appointmentDate) : null;
          const dataBR = fmtDate(apt.appointmentDate);
          const hora = (apt.appointmentTime || '').slice(0,5);

          setFont.bold(); doc.fillColor('#000');
          doc.text(`${idx+1}. ${clip(apt.client?.firstName + ' ' + apt.client?.lastName, 46)}  ·  ${clip(apt.serviceType?.name, 40)}`, P.L, doc.y, { width: WIDTH });
          setFont.small(); doc.fillColor('#333');
          doc.text(`${clip(apt.barber?.name, 36)}  ·  ${getStatusText(apt.status)}  ·  ${dataBR} ${hora ? ('às ' + hora) : ''}  ·  ${fmtMoney(apt.totalPrice)}`,
                   P.L, doc.y, { width: WIDTH });
          doc.moveDown(0.6);
          hr(doc.y - 8, 2, 4);
        });
      }

      // ===============================
      // SEÇÃO: CAIXA (LINHAS)
      // ===============================
      section('Relatório de Caixa');

      // Agregados corretos (corrige variáveis indefinidas do código antigo)
      const sum = (arr, key) => arr.reduce((acc, it) => acc + Number(it?.[key] || 0), 0);
      const totalEntradas  = sum(cashier, 'totalEntradas');
      const totalDespesas  = sum(cashier, 'totalDespesas');
      const totalEsperado  = sum(cashier, 'saldoEsperado');
      const totalContado   = sum(cashier, 'countedCash');
      const totalDiferenca = sum(cashier, 'diferenca');
      const aberturaPrim   = cashier[0]?.openedAt;
      const fechamentoUlt  = cashier[cashier.length - 1]?.closedAt;

      // Resumo do caixa em linhas
      row('Abertura (primeira)', fmtDateTime(aberturaPrim));
      row('Fechamento (última)', fmtDateTime(fechamentoUlt));
      row3('Entradas', fmtMoney(totalEntradas), 'Despesas', fmtMoney(totalDespesas), 'Saldo Esperado', fmtMoney(totalEsperado));
      row3('Contado', fmtMoney(totalContado), 'Diferença', fmtMoney(totalDiferenca));

      doc.moveDown(0.6);
      hr();

      // Detalhamento de cada fechamento de caixa (em linhas)
      cashier.forEach((cs, i) => {
        ensureSpace(4);
        setFont.bold(); doc.fillColor('#000');
        doc.text(`#${String(i+1).padStart(2,'0')} Caixa`, P.L, doc.y, { width: WIDTH });
        setFont.small(); doc.fillColor('#444');
        doc.text(`Período: ${fmtDateTime(cs.openedAt)}  →  ${fmtDateTime(cs.closedAt)}`, P.L, doc.y, { width: WIDTH });
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
    const aptRows = appointments.map(apt => [
      new Date(apt.appointmentDate).toLocaleDateString('pt-BR'),
      apt.appointmentTime || '',
      escapeCSV(`${apt.client?.firstName || ''} ${apt.client?.lastName || ''}`),
      escapeCSV(apt.client?.phone || ''),
      escapeCSV(apt.barber?.name || ''),
      escapeCSV(apt.serviceType?.name || ''),
      getStatusText(apt.status),
      parseFloat(apt.totalPrice || 0).toFixed(2)
    ]);

    const cashierHeaders = ['Abertura', 'Fechamento', 'Inicial', 'Entradas', 'Despesas', 'Esperado', 'Contado', 'Diferença'];
    const fmt = v => (v != null ? Number(v).toFixed(2) : '');
    const cashierRows = cashier.map(cs => [
      cs.openedAt || '',
      cs.closedAt || '',
      fmt(cs.openingAmount),
      fmt(cs.totalEntradas),
      fmt(cs.totalDespesas),
      fmt(cs.saldoEsperado),
      fmt(cs.countedCash),
      fmt(cs.diferenca)
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
  appointments.forEach(apt => {
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
  cashier.forEach(cs => {
    resumo.totalEntradas += Number(cs.totalEntradas) || 0;
    resumo.totalDespesas += Number(cs.totalDespesas) || 0;
    resumo.totalSaldoEsperado += Number(cs.saldoEsperado) || 0;
    resumo.totalDiferenca += Number(cs.diferenca) || 0;
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

