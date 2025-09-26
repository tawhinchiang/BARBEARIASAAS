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
      // Helpers de formatação (sem alterações)
      // -----------------------------
      const fmtMoney = (v) =>
        Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
      const fmtDateTime = (d) => d ? new Date(d).toLocaleString('pt-BR') : '—';
      const clip = (txt, max) => {
        const s = String(txt ?? '').trim();
        return s.length > max ? s.slice(0, max - 1) + '…' : s;
      };

      // Simplesmente para o exemplo, substitua por sua lógica real se tiver
      const getStatusText = (status) => {
        const map = { pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' };
        return map[status] || status;
      };

      // -----------------------------
      // Normalizadores (sem alterações)
      // -----------------------------
      function normalizeAppointment(a = {}) {
        const appointmentDate = a.appointmentDate ?? a.appointment_date ?? a.date ?? a.data ?? null;
        const appointmentTime = a.appointmentTime ?? a.appointment_time ?? a.time ?? a.hora ?? '';
        const totalPrice = a.totalPrice ?? a.total_price ?? a.valor ?? a.price ?? 0;
        const status = a.status ?? a.situacao ?? a.estado ?? 'pending';
        const client = a.client ?? a.cliente ?? {};
        const firstName = client.firstName ?? client.nome ?? a.clientName ?? a.cliente_nome ?? '';
        const lastName  = client.lastName  ?? client.sobrenome ?? '';
        const barberObj = a.barber ?? a.barbeiro ?? {};
        const barberName = barberObj.name ?? a.barberName ?? a.barbeiro_nome ?? '';
        const svcObj = a.serviceType ?? a.servico ?? {};
        const serviceName = svcObj.name ?? a.serviceName ?? a.servico_nome ?? '';
        return { appointmentDate, appointmentTime, totalPrice: Number(totalPrice || 0), status, client: { firstName, lastName }, barber: { name: barberName }, serviceType: { name: serviceName } };
      }

      function normalizeCashier(c = {}) {
        const openedAt    = c.openedAt    ?? c.opened_at    ?? c.abertura    ?? null;
        const closedAt    = c.closedAt    ?? c.closed_at    ?? c.fechamento ?? null;
        const openingAmount = c.openingAmount ?? c.inicial ?? c.valorInicial ?? 0;
        const totalEntradas = c.totalEntradas ?? c.entradas ?? c.total_in ?? c.total_incoming ?? 0;
        const totalDespesas = c.totalDespesas ?? c.despesas ?? c.total_out ?? c.total_expenses ?? 0;
        const saldoEsperado = c.saldoEsperado ?? c.esperado ?? c.expected ?? 0;
        const countedCash   = c.countedCash   ?? c.contado   ?? c.counted   ?? 0;
        const diferenca     = c.diferenca     ?? c.difference ?? c.diff ?? 0;
        return { openedAt, closedAt, openingAmount: Number(openingAmount || 0), totalEntradas: Number(totalEntradas || 0), totalDespesas: Number(totalDespesas || 0), saldoEsperado: Number(saldoEsperado || 0), countedCash: Number(countedCash || 0), diferenca: Number(diferenca || 0) };
      }

      const appts = (appointments || []).map(normalizeAppointment);
      const cash  = (cashier || []).map(normalizeCashier);

      // -----------------------------
      // Grid e tipografia (P e setFont foram ATUALIZADOS)
      // -----------------------------
      const P = {
        L: 28, C1: 28, C2: 150, C3: 330, C4: 470,
        // NOVAS posições para a tabela de agendamentos
        T_CLIENTE: 30,
        T_DATA: 160,
        T_SERVICO: 230,
        T_BARBEIRO: 360,
        T_STATUS: 440,
        T_VALOR: 500,
      };
      const WIDTH = 540;
      const LINE_H = 14;
      let pageNumber = 1;

      const setFont = {
        h0() { doc.font('Helvetica-Bold').fontSize(16); }, // Para o título principal
        h1() { doc.font('Helvetica-Bold').fontSize(12); },
        h2() { doc.font('Helvetica-Bold').fontSize(9); },
        label() { doc.font('Helvetica').fontSize(8); },
        bold() { doc.font('Helvetica-Bold').fontSize(8); },
        small() { doc.font('Helvetica').fontSize(7); },
      };

      // -----------------------------
      // Funções de Desenho (addHeader e addFooter ATUALIZADOS)
      // -----------------------------

      function hr(y = doc.y, padTop = 6, padBottom = 6) {
        doc.moveTo(P.L, y + padTop).lineTo(P.L + WIDTH, y + padTop).lineWidth(0.5).strokeColor('#cccccc').stroke();
        doc.moveDown((padBottom + padTop) / LINE_H);
      }

      function ensureSpace(lines = 1) {
        const need = lines * LINE_H + 20;
        if (doc.y + need > doc.page.height - doc.page.margins.bottom) {
          addFooter();
          doc.addPage();
          pageNumber++;
          addHeader();
        }
      }

      // ## FUNÇÃO ATUALIZADA ##
      function addHeader() {
        const startY = doc.y;
        // Bloco Esquerdo
        setFont.h1(); doc.fillColor('#000');
        doc.text('SUA BARBEARIA', P.L, startY);
        setFont.label(); doc.fillColor('#333');
        doc.text('CNPJ: 00.000.000/0001-00', P.L, doc.y);

        // Bloco Direito (Slogan)
        setFont.h2(); doc.fillColor('#555');
        doc.text('O seu estilo é a nossa arte.', 0, startY + 8, { width: WIDTH, align: 'right' });

        // Bloco Central - Títulos
        const centerX = P.L + (WIDTH / 2);
        setFont.h0(); doc.fillColor('#000');
        doc.text('Relatório Administrativo', P.L, startY + 40, { width: WIDTH, align: 'center' });
        
        setFont.h2(); doc.fillColor('#333');
        const mainTitle = clip(reportInfo?.title || 'Relatório Geral', 70);
        doc.text(mainTitle, P.L, doc.y, { width: WIDTH, align: 'center' });
        doc.moveDown(0.5);

        hr(doc.y, 8, 8);
      }

      // ## FUNÇÃO ATUALIZADA ##
      function addFooter() {
        const footerY = doc.page.height - doc.page.margins.bottom + 10;
        doc.font('Helvetica').fontSize(7).fillColor('#666');
        doc.text(`Data da impressão: ${new Date().toLocaleString('pt-BR')}`, P.L, footerY, { width: WIDTH, align: 'left' });
        doc.text(`PÁGINA: ${pageNumber}`, P.L, footerY, { width: WIDTH, align: 'right' });
      }

      function row(label, value, y = doc.y, colLabel = P.C1, colValue = P.C2) {
        ensureSpace(1);
        setFont.label(); doc.fillColor('#111'); doc.text(clip(label, 30), colLabel, y, { width: colValue - colLabel - 6 });
        setFont.bold(); doc.fillColor('#000'); doc.text(String(value ?? '—'), colValue, y, { width: P.C3 - colValue - 6 });
        doc.moveDown(1);
      }

      function row3(l1, v1, l2, v2, l3, v3) {
        // ... (sua função row3 original, sem alterações)
      }

      function section(title) {
        ensureSpace(2);
        setFont.h1(); doc.fillColor('#000'); doc.text(title, P.L, doc.y, { width: WIDTH });
        hr(doc.y, 4, 2);
      }

      // ## NOVA FUNÇÃO PARA A TABELA DE AGENDAMENTOS ##
      function renderAppointmentsTable(appointments) {
        if (!appointments.length) {
          setFont.small(); doc.fillColor('#444');
          doc.text('Nenhum agendamento no período.', P.L, doc.y, { width: WIDTH });
          doc.moveDown(1.2);
          return;
        }

        // Cabeçalho da Tabela
        ensureSpace(2);
        setFont.bold(); doc.fillColor('#000');
        const headerY = doc.y;
        doc.text('Cliente', P.T_CLIENTE, headerY);
        doc.text('Data', P.T_DATA, headerY);
        doc.text('Serviço', P.T_SERVICO, headerY);
        doc.text('Barbeiro', P.T_BARBEIRO, headerY);
        doc.text('Status', P.T_STATUS, headerY);
        doc.text('Valor', P.T_VALOR, headerY, { width: 60, align: 'right' });
        doc.moveDown(0.5);
        hr(doc.y, 2, 4);

        // Linhas da Tabela
        let totalReceita = 0;
        appointments.forEach(apt => {
          ensureSpace(1);
          const rowY = doc.y;
          const isCancelled = apt.status === 'cancelled';
          totalReceita += isCancelled ? 0 : apt.totalPrice;

          setFont.label(); doc.fillColor(isCancelled ? '#999' : '#000');
          
          doc.text(clip(`${apt.client.firstName} ${apt.client.lastName}`, 25), P.T_CLIENTE, rowY);
          doc.text(fmtDate(apt.appointmentDate), P.T_DATA, rowY);
          doc.text(clip(apt.serviceType.name, 20), P.T_SERVICO, rowY);
          doc.text(clip(apt.barber.name, 15), P.T_BARBEIRO, rowY);
          doc.text(getStatusText(apt.status), P.T_STATUS, rowY);
          doc.text(fmtMoney(apt.totalPrice), P.T_VALOR, rowY, { width: 60, align: 'right' });
          doc.moveDown(1);
        });

        // Linha de Total
        hr(doc.y, 4, 4);
        ensureSpace(1);
        setFont.bold(); doc.fillColor('#000');
        const totalY = doc.y;
        doc.text('Receita Total (não cancelados):', P.T_STATUS - 100, totalY, { width: 150, align: 'right' });
        doc.text(fmtMoney(totalReceita), P.T_VALOR, totalY, { width: 60, align: 'right' });
      }

      // ===============================
      // INÍCIO DA GERAÇÃO DO DOCUMENTO
      // ===============================
      
      addHeader();
      
      // Bloco de informações gerais (análogo ao bloco "Contribuinte")
      section('Resumo do Período');
      row('Período do Relatório:', reportInfo.period || 'Não especificado');
      if (reportInfo.barber) {
        row('Barbeiro Selecionado:', reportInfo.barber);
      }
      row('Total de Agendamentos:', appts.length);
      doc.moveDown(1);

      // SEÇÃO: AGENDAMENTOS (agora como tabela)
      section('Detalhes dos Agendamentos');
      renderAppointmentsTable(appts); // Chamando a nova função de tabela

      doc.moveDown(2);

      // SEÇÃO: CAIXA (mantido o formato original)
      section('Relatório de Caixa');
      if (!cash.length) {
          setFont.small(); doc.fillColor('#444');
          doc.text('Nenhum registro de caixa no período.', P.L, doc.y, { width: WIDTH });
      } else {
        const sum = (arr, key) => arr.reduce((acc, it) => acc + Number(it?.[key] || 0), 0);
        const totalEntradas  = sum(cash, 'totalEntradas');
        const totalDespesas  = sum(cash, 'totalDespesas');
        const totalEsperado  = sum(cash, 'saldoEsperado');
        
        row('Total de Entradas:', fmtMoney(totalEntradas));
        row('Total de Despesas:', fmtMoney(totalDespesas));
        setFont.bold();
        row('Saldo Esperado Final:', fmtMoney(totalEsperado));
      }

      // Rodapé final
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
