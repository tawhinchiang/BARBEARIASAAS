const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Gerar relatório em PDF
async function generatePDF(appointments, reportInfo, filename) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filePath = path.join(__dirname, '..', 'reports', filename);
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Título
      doc.fontSize(22).fillColor('#333').text('Relatório de Agendamentos', { align: 'center' });
      doc.moveDown(1.5);

      // Bloco Resumo
      doc.fontSize(10).fillColor('#000');
      const resumoData = [
        ['Período', reportInfo.periodo],
        ['Barbeiro', reportInfo.barbeiroSelecionado],
        ['Total', reportInfo.totalAgendamentos],
        ['Receita', `R$ ${reportInfo.receitaTotal}`],
        ['Média', `R$ ${reportInfo.mediaValor}`]
      ];

      const resumoBoxWidth = (doc.page.width - 100) / resumoData.length;
      const resumoStartY = doc.y;
      doc.fillColor('#f0f0f0').rect(50, resumoStartY, doc.page.width - 100, 50).fill();
      resumoData.forEach(([label, value], i) => {
        const x = 50 + i * resumoBoxWidth;
        doc.fillColor('#000').fontSize(10).text(`${label}:`, x + 5, resumoStartY + 8, {
          width: resumoBoxWidth - 10
        });
        doc.font('Helvetica-Bold').text(value, x + 5, resumoStartY + 25, {
          width: resumoBoxWidth - 10
        }).font('Helvetica');
      });
      doc.moveDown(4);

      // Tabela de Agendamentos
      doc.font('Helvetica-Bold').fontSize(14).text('Detalhes dos Agendamentos', { underline: true });
      doc.font('Helvetica');
      const tableLeft = 50;
      const colWidths = [60, 50, 100, 80, 120, 70, 60];
      const headers = ['Data', 'Hora', 'Cliente', 'Barbeiro', 'Serviço', 'Status', 'Valor'];
      let currentY = doc.y;

      const abreviar = (texto, limite) => texto && texto.length > limite ? texto.slice(0, limite - 3) + '...' : texto || '';

      const drawTableHeader = () => {
        let x = tableLeft;
        doc.fillColor('#e0e0e0').rect(x, currentY, colWidths.reduce((a, b) => a + b, 0), 20).fill();
        headers.forEach((header, i) => {
          doc.fillColor('#000').fontSize(10).text(header, x + 5, currentY + 5, {
            width: colWidths[i] - 10
          });
          x += colWidths[i];
        });
        currentY += 20;
      };

      const drawRow = (rowData) => {
        let x = tableLeft;
        rowData.forEach((data, i) => {
          doc.rect(x, currentY, colWidths[i], 20).stroke();
          doc.fontSize(9).fillColor('#000').text(data, x + 5, currentY + 5, {
            width: colWidths[i] - 10,
            align: i === colWidths.length - 1 ? 'right' : 'left',
            lineBreak: false
          });
          x += colWidths[i];
        });
        currentY += 20;
      };

      drawTableHeader();

      let totalValor = 0;
      appointments.forEach((apt) => {
        if (currentY + 30 > doc.page.height - 60) {
          doc.addPage();
          currentY = 50;
          drawTableHeader();
        }

        const valor = parseFloat(apt.totalPrice || 0);
        totalValor += valor;

        drawRow([
          new Date(apt.appointmentDate).toLocaleDateString('pt-BR'),
          apt.appointmentTime,
          abreviar(`${apt.client?.firstName} ${apt.client?.lastName}`, 20),
          abreviar(apt.barber?.name, 18),
          abreviar(apt.serviceType?.name, 30),
          getStatusText(apt.status),
          `R$ ${valor.toFixed(2)}`
        ]);
      });

      // Rodapé Total
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Total Geral:', tableLeft + colWidths.slice(0, -1).reduce((a, b) => a + b, 0) + 5, currentY + 5, {
        width: colWidths[colWidths.length - 1] - 10
      });
      doc.text(`R$ ${totalValor.toFixed(2)}`, tableLeft + colWidths.slice(0, -1).reduce((a, b) => a + b, 0) + 5, currentY + 20, {
        width: colWidths[colWidths.length - 1] - 10,
        align: 'right'
      });

      doc.moveDown(2);

      // Tabelas lado a lado
      const colWidth = (doc.page.width - 100) / 2;
      const leftX = 50;
      const rightX = leftX + colWidth;

      const statusEntries = Object.entries(reportInfo.statusCounts);
      const barberEntries = Object.entries(reportInfo.receitaPorBarbeiro);
      const maxLines = Math.max(statusEntries.length, barberEntries.length);

      let statsY = doc.y;
      const estimatedHeight = 18 + maxLines * 15;
      if (statsY + estimatedHeight > doc.page.height - 60) {
        doc.addPage();
        statsY = 50;
      }

      doc.fontSize(13).text('Estatísticas por Status', leftX, statsY, { underline: true });
      doc.fontSize(13).text('Receita por Barbeiro', rightX, statsY, { underline: true });

      statsY += 18;

      for (let i = 0; i < maxLines; i++) {
        const statusEntry = statusEntries[i];
        const barberEntry = barberEntries[i];

        if (statusEntry) {
          const [statusKey, count] = statusEntry;
          const receita = reportInfo.receitaPorStatus[statusKey]?.toFixed(2) || '0.00';
          doc.fontSize(10).text(`- ${getStatusText(statusKey)}: ${count} agendamento(s) - R$ ${receita}`, leftX, statsY, {
            width: colWidth
          });
        }

        if (barberEntry) {
          const [barberKey, total] = barberEntry;
          doc.fontSize(10).text(`- ${barberKey}: R$ ${parseFloat(total).toFixed(2)}`, rightX, statsY, {
            width: colWidth
          });
        }

        statsY += 15;
      }

      // Rodapé com data
      doc.fontSize(8).fillColor('gray').text(
        `Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')} pelo Sistema de Gestão de Barbearias.`,
        50,
        doc.page.height - 40,
        { align: 'center' }
      );

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
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
      apt.appointmentTime,
      `"${apt.client.firstName} ${apt.client.lastName}"`,
      apt.client.phone,
      `"${apt.barber.name}"`,
      `"${apt.serviceType.name}"`,
      getStatusText(apt.status),
      parseFloat(apt.totalPrice || 0).toFixed(2),
      apt.whatsappSent ? 'Sim' : 'Não',
      new Date(apt.createdAt).toLocaleString('pt-BR'),
      apt.status,
      apt.barber.id
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
function getStatusText(status) {
  const statusMap = {
    'scheduled': 'Agendado',
    'confirmed': 'Confirmado',
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