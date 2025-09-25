const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Gerar relatório em PDF
// Substituir toda a função generatePDF por este novo conteúdo:



// ==================================================
// PDF
// ==================================================
async function generatePDF({ appointments, cashier }, reportInfo, filename) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30 });
      const filePath = path.join(__dirname, '..', 'reports', filename);

      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ==================================================
      // TÍTULO
      // ==================================================
      doc.fontSize(22).fillColor('#333').text('Relatório Geral', { align: 'center' });
      doc.moveDown(1.5);

      // ==================================================
      // SEÇÃO 1: AGENDAMENTOS
      // ==================================================
      doc.fontSize(16).fillColor('#000').text('Agendamentos', { align: 'left' });
      doc.moveDown(0.5);

      const leftMargin = 30;
      const tableWidth = 550;
      const colWidths = [60, 50, 95, 80, 150, 60, 55];
      const headers = ['Data', 'Hora', 'Cliente', 'Barbeiro', 'Serviço', 'Status', 'Valor'];
      let currentY = doc.y;
      const rowHeight = 22;

      const formatarValor = (valor) =>
        (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const abreviar = (texto, limite) =>
        texto && texto.length > limite ? texto.slice(0, limite - 3) + '...' : texto || '';

      const drawTableHeader = () => {
        let x = leftMargin;
        doc.fillColor('#e0e0e0').rect(x, currentY, tableWidth, rowHeight).fill();
        headers.forEach((header, i) => {
          doc.fillColor('#000').fontSize(10).text(header, x + 5, currentY + 6, {
            width: colWidths[i] - 10,
            align: 'center',
            lineBreak: false,
          });
          x += colWidths[i];
        });
        currentY += rowHeight;
      };

      const drawRow = (rowData) => {
        let x = leftMargin;
        rowData.forEach((data, i) => {
          doc.rect(x, currentY, colWidths[i], rowHeight).stroke();
          doc.fontSize(9).fillColor('#000').text(data, x + 3, currentY + 6, {
            width: colWidths[i] - 6,
            align: i === colWidths.length - 1 ? 'right' : 'left',
            lineBreak: false,
          });
          x += colWidths[i];
        });
        currentY += rowHeight;
      };

      drawTableHeader();
      let totalValor = 0;

      appointments.forEach((apt) => {
        if (currentY + rowHeight + 30 > doc.page.height - 100) {
          doc.addPage();
          currentY = 50;
          drawTableHeader();
        }

        const valor = parseFloat(apt.totalPrice || 0);
        totalValor += valor;

        drawRow([
          new Date(apt.appointmentDate).toLocaleDateString('pt-BR'),
          apt.appointmentTime || '',
          abreviar(`${apt.client?.firstName || ''} ${apt.client?.lastName || ''}`, 16),
          abreviar(apt.barber?.name, 18),
          abreviar(apt.serviceType?.name, 40),
          getStatusText(apt.status),
          formatarValor(valor),
        ]);
      });

      doc.font('Helvetica-Bold').fontSize(10);
      const totalText = `Total Geral Agendamentos: ${formatarValor(totalValor)}`;
      doc.text(totalText, leftMargin, currentY + 8);
      currentY += 40;

      // ==================================================
      // SEÇÃO 2: CAIXA
      // ==================================================
      doc.addPage();
      doc.fontSize(16).fillColor('#000').text('Relatório de Caixa', { align: 'left' });
      doc.moveDown(0.5);

      const colWidthsC = [90, 90, 70, 70, 70, 70, 70, 70];
      const headersC = [
        'Abertura',
        'Fechamento',
        'Inicial',
        'Entradas',
        'Despesas',
        'Esperado',
        'Contado',
        'Diferença',
      ];
      currentY = doc.y;
      const rowHeightC = 22;

      // header caixa
      let x = leftMargin;
      headersC.forEach((h, i) => {
        doc.rect(x, currentY, colWidthsC[i], rowHeightC).stroke();
        doc.fontSize(9).text(h, x + 2, currentY + 6, { width: colWidthsC[i] - 4, align: 'center' });
        x += colWidthsC[i];
      });
      currentY += rowHeightC;

      const fmt = (v) =>
        v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';

      cashier.forEach((cs) => {
        let x = leftMargin;
        const row = [
          cs.openedAt ? new Date(cs.openedAt).toLocaleString('pt-BR') : '-',
          cs.closedAt ? new Date(cs.closedAt).toLocaleString('pt-BR') : '-',
          fmt(cs.openingAmount),
          fmt(cs.totalEntradas),
          fmt(cs.totalDespesas),
          fmt(cs.saldoEsperado),
          fmt(cs.countedCash),
          fmt(cs.diferenca),
        ];
        row.forEach((cell, i) => {
          doc.rect(x, currentY, colWidthsC[i], rowHeightC).stroke();
          doc.fontSize(8).text(cell, x + 2, currentY + 6, { width: colWidthsC[i] - 4, align: 'center' });
          x += colWidthsC[i];
        });
        currentY += rowHeightC;
      });

      // ==================================================
      // RESUMO DO CAIXA
      // ==================================================
      doc.moveDown(1.5);
      doc.fontSize(12).font('Helvetica-Bold').text('Resumo do Caixa', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica')
        .text(`Total de Entradas: ${fmt(reportInfo.totalEntradas)}`)
        .text(`Total de Despesas: ${fmt(reportInfo.totalDespesas)}`)
        .text(`Saldo Esperado: ${fmt(reportInfo.totalSaldoEsperado)}`)
        .text(`Diferença: ${fmt(reportInfo.totalDiferenca)}`);

      // ==================================================
      // RODAPÉ
      // ==================================================
      doc.fontSize(8).fillColor('gray').text(
        `Relatório gerado em ${new Date().toLocaleString('pt-BR')} pelo Sistema de Gestão de Barbearias.`,
        leftMargin,
        doc.page.height - 40,
        { align: 'center' }
      );

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

