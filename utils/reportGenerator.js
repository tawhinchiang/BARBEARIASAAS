const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Gerar relatório em PDF
// Substituir toda a função generatePDF por este novo conteúdo:


async function generatePDF(appointments, reportInfo, filename) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30 });
      const filePath = path.join(__dirname, '..', 'reports', filename);

      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(22).fillColor('#333').text('Relatório de Agendamentos', { align: 'center' });
      doc.moveDown(1.5);

      const leftMargin = 30;
      const tableWidth = 550;
      const colWidths = [60, 50, 95, 80, 150, 60, 55];
      const headers = ['Data', 'Hora', 'Cliente', 'Barbeiro', 'Serviço', 'Status', 'Valor'];
      let currentY = doc.y;
      const rowHeight = 26;

      const formatarValor = (valor) => {
        return (valor || 0).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        });
      };

      const abreviar = (texto, limite) =>
        texto && texto.length > limite ? texto.slice(0, limite - 3) + '...' : texto || '';

      const drawTableHeader = () => {
        let x = leftMargin;
        doc.fillColor('#e0e0e0').rect(x, currentY, tableWidth, rowHeight).fill();
        headers.forEach((header, i) => {
          doc.fillColor('#000').fontSize(10).text(header, x + 5, currentY + 7, {
            width: colWidths[i] - 10,
            align: 'center',
            lineBreak: false
          });
          x += colWidths[i];
        });
        currentY += rowHeight;
      };

      const drawRow = (rowData) => {
        let x = leftMargin;
        rowData.forEach((data, i) => {
          doc.rect(x, currentY, colWidths[i], rowHeight).stroke();
          doc.fontSize(9).fillColor('#000').text(data, x + 5, currentY + 7, {
            width: colWidths[i] - 10,
            align: i === colWidths.length - 1 ? 'right' : 'left',
            lineBreak: false
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
          apt.appointmentTime,
          abreviar(apt.client?.firstName || '', 16),
          abreviar(apt.barber?.name, 18),
          abreviar(apt.serviceType?.name, 42),
          getStatusText(apt.status),
          formatarValor(valor)
        ]);
      });

        doc.font('Helvetica-Bold').fontSize(10); // aplicar antes de medir

        const totalText = `Total  Geral: ${formatarValor(totalValor)}`;
        const totalTextWidth = doc.widthOfString(totalText);
        const maxX = leftMargin + tableWidth - 5; // margem direita da tabela
        let totalX = maxX - totalTextWidth;

        if (totalX < leftMargin) {
          totalX = leftMargin; // evita ultrapassar esquerda
        }

        doc.text(totalText, totalX, currentY + 6, {
          lineBreak: false,
          width: tableWidth - (totalX - leftMargin),
          align: 'left'
        });


      currentY += 40;

      // Bloco Resumo
      const resumoData = [
        ['Período', reportInfo.periodo],
        ['Barbeiro', reportInfo.barbeiroSelecionado],
        ['Total', reportInfo.totalAgendamentos],
        ['Receita', formatarValor(reportInfo.receitaTotal)],
        ['Média', formatarValor(reportInfo.mediaValor)]
      ];
      const resumoBoxWidth = tableWidth / resumoData.length;
      const resumoStartY = currentY;
      doc.fillColor('#f0f0f0').rect(leftMargin, resumoStartY, tableWidth, 50).fill();
      resumoData.forEach(([label, value], i) => {
        const x = leftMargin + i * resumoBoxWidth;
        doc.fillColor('#000').fontSize(10).text(`${label}:`, x + 5, resumoStartY + 8, {
          width: resumoBoxWidth - 10
        });
        doc.font('Helvetica-Bold').text(value, x + 5, resumoStartY + 25, {
          width: resumoBoxWidth - 10
        }).font('Helvetica');
      });

      currentY = resumoStartY + 70;

      // Estatísticas
      const col1 = leftMargin, col2 = col1 + 100, col3 = col2 + 80;
      const col4 = col3 + 80, col5 = col4 + 140;

      doc.fillColor('#ddd').rect(col1, currentY, tableWidth, 18).fill();
      doc.fontSize(11).fillColor('#000').font('Helvetica-Bold');
      doc.text('Estatísticas por Status', col1 + 5, currentY + 3);
      doc.text('Receita por Barbeiro', col4, currentY + 3);
      currentY += 20;

      doc.fillColor('#eee').rect(col1, currentY, tableWidth, 18).fill();
      doc.fontSize(9).fillColor('#000').font('Helvetica-Bold');
      doc.text('Status', col1 + 5, currentY + 4);
      doc.text('Qtde', col2, currentY + 4);
      doc.text('Receita', col3, currentY + 4);
      doc.text('Barbeiro', col4, currentY + 4);
      doc.text('Receita', col5, currentY + 4);
      currentY += 18;

      const statusEntries = Object.entries(reportInfo.statusCounts);
      const barberEntries = Object.entries(reportInfo.receitaPorBarbeiro);
      const maxRows = Math.max(statusEntries.length, barberEntries.length);

      for (let i = 0; i < maxRows; i++) {
        const y = currentY;
        doc.lineWidth(0.8).strokeColor('#666').rect(col1, y, tableWidth, 18).stroke();

        const status = statusEntries[i];
        const barber = barberEntries[i];

        doc.font('Helvetica').fontSize(9).fillColor('#000');
        if (status) {
          const [k, c] = status;
          const r = formatarValor(reportInfo.receitaPorStatus[k]);
          doc.text(getStatusText(k), col1 + 5, y + 4);
          doc.text(c.toString(), col2, y + 4);
          doc.text(r, col3, y + 4);
        }
        if (barber) {
          const [name, total] = barber;
          doc.text(name, col4, y + 4, { width: 140 });
          doc.text(formatarValor(total), col5, y + 4);
        }

        currentY += 18;
      }

      doc.fontSize(8).fillColor('gray').text(
        `Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')} pelo Sistema de Gestão de Barbearias.`,
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









// Gerar relatório em CSV
function generateCSV(appointments, filename) {
  try {
    const filePath = path.join(__dirname, '..', 'reports', filename);

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    const headers = [
      'Data', 'Hora', 'Cliente', 'Telefone', 'Barbeiro', 'Serviço',
      'Status', 'Valor', 'WhatsApp Enviado', 'Criado em', 'Status Code', 'Barbeiro ID'
    ];

 const csvData = appointments.map(apt => [
  new Date(apt.appointmentDate).toLocaleDateString('pt-BR'),
  apt.appointmentTime || '',
  `"${(apt.client?.firstName || '')} ${(apt.client?.lastName || '')}"`,
  apt.client?.phone || '',
  `"${apt.barber?.name || ''}"`,
  `"${apt.serviceType?.name || ''}"`,
  getStatusText(apt.status),
  parseFloat(apt.totalPrice || 0).toFixed(2),
  apt.whatsappSent ? 'Sim' : 'Não',
  new Date(apt.createdAt).toLocaleString('pt-BR'),
  apt.status || '',
  apt.barber?.id || ''
]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    fs.writeFileSync(filePath, csvContent, 'utf8');
    return filePath;
  } catch (error) {
    throw error;
  }
}

function gerarResumoDoRelatorio(appointments, startDate, endDate, barberId) {
  const resumo = {
    startDate,
    endDate,
    barbeiroSelecionado: 'Todos',
    dataGeracao: new Date().toLocaleDateString('pt-BR'),
    totalAgendamentos: appointments.length,
    receitaTotal: 0,
    mediaValor: 0,
    statusCounts: {},
    receitaPorStatus: {},
    receitaPorBarbeiro: {}
  };

  appointments.forEach(apt => {
    // Status
    const status = apt.status;
    resumo.statusCounts[status] = (resumo.statusCounts[status] || 0) + 1;

    // Receita por status
    const valor = parseFloat(apt.totalPrice || 0);
    resumo.receitaPorStatus[status] = (resumo.receitaPorStatus[status] || 0) + valor;

    // Receita total
    if (apt.status !== 'cancelled') {
      resumo.receitaTotal += valor;
    }

    // Receita por barbeiro
    const barberName = apt.barber?.name || 'Desconhecido';
    resumo.receitaPorBarbeiro[barberName] = (resumo.receitaPorBarbeiro[barberName] || 0) + valor;
  });

  if (appointments.length > 0) {
    resumo.mediaValor = (resumo.receitaTotal / appointments.length).toFixed(2);
  }

  if (barberId) {
    const selectedBarber = appointments[0]?.barber?.name || 'Selecionado';
    resumo.barbeiroSelecionado = selectedBarber;
  }

  resumo.periodo = `${startDate || 'início'} até ${endDate || 'hoje'}`;

  return resumo;
}


// Função auxiliar para traduzir status
// Função auxiliar para traduzir status
function getStatusText(status) {
  const statusMap = {
    'scheduled': 'Agendado',
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