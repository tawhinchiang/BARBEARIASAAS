const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Gerar relatório em PDF
async function generatePDF(appointments, reportInfo, filename) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filePath = path.join(__dirname, '..', 'reports', filename);
      
      // Criar diretório se não existir
      const reportsDir = path.dirname(filePath);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      
      // Cabeçalho
      doc.fontSize(20).text('Relatório de Agendamentos', { align: 'center' });
      doc.moveDown();
      
      // Informações do relatório
      doc.fontSize(12);
      doc.text(`Período: ${reportInfo.startDate} até ${reportInfo.endDate}`);
      doc.text(`Barbeiro: ${reportInfo.barbeiroSelecionado}`);
      doc.text(`Data de geração: ${new Date().toLocaleDateString('pt-BR')}`);
      doc.moveDown();
      
      // Estatísticas
        doc.fontSize(14).text('Resumo do Relatório:', { underline: true });
        doc.fontSize(12);
        doc.text(`Período: ${reportInfo.periodo}`);
        doc.text(`Barbeiro: ${reportInfo.barbeiroSelecionado}`);
        doc.text(`Data de Geração: ${reportInfo.dataGeracao}`);
        doc.text(`Total de Agendamentos: ${reportInfo.totalAgendamentos}`);
        doc.text(`Receita Total: R$ ${reportInfo.receitaTotal}`);
        doc.text(`Valor Médio por Agendamento: R$ ${reportInfo.mediaValor}`);
        doc.moveDown();

        // Estatísticas por status
        doc.fontSize(13).text('Estatísticas por Status:', { underline: true });
        Object.entries(reportInfo.statusCounts).forEach(([status, count]) => {
          const receita = reportInfo.receitaPorStatus[status]?.toFixed(2) || '0.00';
          doc.text(`${getStatusText(status)}: ${count} agendamentos - R$ ${receita}`);
        });
        doc.moveDown();

        // Estatísticas por barbeiro
        doc.fontSize(13).text('Receita por Barbeiro:', { underline: true });
        Object.entries(reportInfo.receitaPorBarbeiro).forEach(([barber, total]) => {
          doc.text(`${barber}: R$ ${total.toFixed(2)}`);
        });
        doc.moveDown();

      
      // Tabela de agendamentos
      doc.fontSize(14).text('Detalhes dos Agendamentos:', { underline: true });
      doc.moveDown();
      
      // Cabeçalho da tabela
      const tableTop = doc.y;
      const tableLeft = 50;
      const colWidths = [80, 60, 100, 80, 60, 80, 60];
      const headers = ['Data', 'Hora', 'Cliente', 'Barbeiro', 'Serviço', 'Status', 'Valor'];
      
      doc.fontSize(10);
      let currentX = tableLeft;
      headers.forEach((header, i) => {
        doc.text(header, currentX, tableTop, { width: colWidths[i], align: 'center' });
        currentX += colWidths[i];
      });
      
      // Linha separadora
      doc.moveTo(tableLeft, tableTop + 15)
         .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
         .stroke();
      
      // Dados da tabela
      let currentY = tableTop + 25;
      appointments.forEach((apt, index) => {
        if (currentY > 700) { // Nova página se necessário
          doc.addPage();
          currentY = 50;
        }
        
        currentX = tableLeft;
        const rowData = [
          new Date(apt.appointmentDate).toLocaleDateString('pt-BR'),
          apt.appointmentTime,
          `${apt.client.firstName} ${apt.client.lastName}`,
          apt.barber.name,
          apt.serviceType.name,
          getStatusText(apt.status),
          `R$ ${parseFloat(apt.totalPrice || 0).toFixed(2)}`
        ];
        
        rowData.forEach((data, i) => {
          doc.text(data, currentX, currentY, { width: colWidths[i], align: 'center' });
          currentX += colWidths[i];
        });
        
        currentY += 20;
      });
      
      // Rodapé
      doc.fontSize(8).text(
        `Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')} pelo Sistema de Gestão de Barbearias.`,
        50,
        doc.page.height - 40,
        { align: 'center' }
      );

      
      doc.end();
      
      stream.on('finish', () => {
        resolve(filePath);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Gerar relatório em CSV
function generateCSV(appointments, filename) {
  try {
    const filePath = path.join(__dirname, '..', 'reports', filename);
    
    // Criar diretório se não existir
    const reportsDir = path.dirname(filePath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Cabeçalho CSV
   const headers = [
  'Data',
  'Hora',
  'Cliente',
  'Telefone',
  'Barbeiro',
  'Serviço',
  'Status',
  'Valor',
  'WhatsApp Enviado',
  'Criado em',
  'Status Code',
  'Barbeiro ID'
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

    
    // Montar conteúdo CSV
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    
    // Escrever arquivo
    fs.writeFileSync(filePath, csvContent, 'utf8');
    
    return filePath;
    
  } catch (error) {
    throw error;
  }
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
  generateCSV
};

