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
        layout: 'landscape',
        margins: { top: 28, left: 28, right: 28, bottom: 32 },
        bufferPages: true
      });

      const filePath = path.join(__dirname, '..', 'reports', filename);
      if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ---------------- Helpers ----------------
      const fmtMoney = v => Number(v || 0).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
      });
      // Substituir a função atual:
      const fmtDate = d => {
        if (!d) return '—';

        // Se já for Date válido
        if (d instanceof Date && !isNaN(d)) {
          return d.toLocaleDateString('pt-BR');
        }

        const s = String(d);

        // Caso 'YYYY-MM-DD' (DATA PURA, sem fuso) -> NÃO usar new Date()
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
          const [, yy, mm, dd] = m;
          return `${dd}/${mm}/${yy}`;
        }

        // Caso ISO com hora -> pode usar Date normalmente
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
          const dt = new Date(s);
          return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR');
        }

        // Fallback seguro
        const dt = new Date(s);
        return isNaN(dt) ? s : dt.toLocaleDateString('pt-BR');
      };

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

      // -------------- Normalizadores --------------
      function normalizeAppointment(a = {}) {
        const appointmentDate = a.appointmentDate ?? a.appointment_date ?? a.date ?? a.data ?? null;
        const appointmentTime = a.appointmentTime ?? a.appointment_time ?? a.time ?? a.hora ?? '';
        const totalPrice = a.totalPrice ?? a.total_price ?? a.valor ?? a.price ?? 0;
        const status = (a.status ?? a.situacao ?? a.estado ?? 'pending') + '';
        const client = a.client ?? a.cliente ?? {};
        const firstName = client.firstName ?? client.nome ?? a.clientName ?? a.cliente_nome ?? '';
        const lastName = client.lastName ?? client.sobrenome ?? '';
        const barberObj = a.barber ?? a.barbeiro ?? {};
        const barberName = barberObj.name ?? a.barberName ?? a.barbeiro_nome ?? '';
        const svcObj = a.serviceType ?? a.servico ?? {};
        const serviceName = svcObj.name ?? a.serviceName ?? a.servico_nome ?? '';
        return {
          appointmentDate, appointmentTime, totalPrice: Number(totalPrice || 0), status,
          client: { firstName, lastName }, barber: { name: barberName }, serviceType: { name: serviceName },
          // campos possíveis de pagamento
          paymentMethod: a.paymentMethod ?? a.method ?? a.metodo ?? a.formaPagamento,
          payment: a.payment,
          payments: Array.isArray(a.payments) ? a.payments : (Array.isArray(a.pagamentos) ? a.pagamentos : undefined)
        };
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
      const cashArray = Array.isArray(cashier) ? cashier : (cashier ? [cashier] : []);
      const cash = cashArray.map(normalizeCashier);

      // -------------- Totais por método --------------
      function fromCashierSummary(objOrArr) {
        const root = Array.isArray(objOrArr)
          ? (objOrArr.find(x => x && (x.summary || x.resumo)) || null)
          : (objOrArr && (objOrArr.summary || objOrArr.resumo) ? objOrArr : null);
        if (!root) return null;
        const entradas = root.summary?.entradas || root.resumo?.entradas;
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

      const PM_ORDER = ['cash', 'credit', 'debit', 'pix', 'other'];
      const PM_LABEL = { cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX', other: 'Outros' };

      let payTotals = fromCashierSummary(cashArray) || fromAppointments(appts) || { cash: 0, credit: 0, debit: 0, pix: 0, other: 0 };
      const payGrand = PM_ORDER.reduce((s, k) => s + Number(payTotals[k] || 0), 0);
      const allZeroPayments = payGrand === 0;

      // -------------- Grid/Tipografia --------------
      const P = { L: doc.page.margins.left };
      const WIDTH = doc.page.width - doc.page.margins.left - doc.page.margins.right; // 539pt
      const LINE_H = 12;

      const setFont = {
        h1() { doc.font('Helvetica-Bold').fontSize(12); },
        h2() { doc.font('Helvetica-Bold').fontSize(10); },
        th() { doc.font('Helvetica-Bold').fontSize(8); },
        td() { doc.font('Helvetica').fontSize(8); },
        small() { doc.font('Helvetica').fontSize(7); },
      };
      // Linha horizontal padrão: mais escura e um pouco mais grossa
      const hr = (y, color = '#333333', w = 0.8) => {
        doc.save()
          .moveTo(P.L, y)
          .lineTo(P.L + WIDTH, y)
          .lineWidth(w)
          .strokeColor(color)
          .stroke()
          .restore();
      };


      // -------------- Cabeçalho --------------
      // ---------- Cabeçalho com logo e nome do estabelecimento ----------
      function addInstitutionalHeader() {
        // Nome do negócio (várias chaves suportadas)
        const businessName =
          reportInfo.businessName || reportInfo.companyName || reportInfo.studioName ||
          reportInfo.tenant?.name || reportInfo.estabelecimento || 'RELATÓRIO GERAL';

        // Subtítulo (opcional)
        const subtitle =
          reportInfo.subtitle || reportInfo.headline2 || 'SISTEMA DE GESTÃO';

        // Logo (caminho local, buffer ou dataURL base64)
        const logoInput = reportInfo.logoPath || reportInfo.logo || reportInfo.tenant?.logoPath;

        // Espaços/layout
        const topY = doc.y;
        const logoBoxW = 140;          // área reservada para o logo à esquerda
        const logoFit = [120, 48];     // tamanho máx. do logo

        // Tenta desenhar o logo, se existir
        let usedLogoHeight = 0;
        try {
          if (logoInput) {
            if (typeof logoInput === 'string' && /^data:image\//.test(logoInput)) {
              // dataURL -> Buffer
              const b64 = logoInput.split(',')[1] || '';
              const buf = Buffer.from(b64, 'base64');
              doc.image(buf, P.L, topY, { fit: logoFit, align: 'left' });
            } else {
              // caminho local/absoluto
              doc.image(logoInput, P.L, topY, { fit: logoFit, align: 'left' });
            }
            usedLogoHeight = logoFit[1];
          }
        } catch { /* se falhar, só segue sem logo */ }

        // Bloco central de títulos ocupa toda a largura (logo não atrapalha)
        const titleY = topY;
        setFont.h1(); doc.fillColor('#000');
        const h1h = doc.heightOfString(businessName.toUpperCase(), { width: WIDTH, align: 'center' });
        doc.text(businessName.toUpperCase(), P.L, titleY, { width: WIDTH, align: 'center', lineBreak: false });

        setFont.h2();
        const h2h = doc.heightOfString(String(subtitle).toUpperCase(), { width: WIDTH, align: 'center' });
        doc.text(String(subtitle).toUpperCase(), P.L, titleY + h1h, { width: WIDTH, align: 'center', lineBreak: false });

        // Avança Y considerando o maior entre título e logo
        const blockH = Math.max(h1h + h2h, usedLogoHeight);
        let y = titleY + blockH + 3;

        hr(y);
        doc.y = y + 6;
      }


      // -------------- Tabela: Agendamentos --------------
     // Larguras pensadas para A4 landscape + suas margens
      const COL_APT = [
        { key: 'data',    label: 'DATA',        x: P.L +   0, w:  72, align: 'left'  },
        { key: 'hora',    label: 'HORA',        x: P.L +  72, w:  44, align: 'left'  },
        { key: 'cliente', label: 'CLIENTE',     x: P.L + 116, w: 188, align: 'left'  },
        { key: 'barbeiro',label: 'PROFISSIONAL',x: P.L + 304, w: 170, align: 'left'  },
        { key: 'servico', label: 'SERVIÇO',     x: P.L + 474, w: 240, align: 'left'  },
        { key: 'status',  label: 'STATUS',      x: P.L + 714, w:  86, align: 'left'  },
        { key: 'valor',   label: 'VALOR',       x: P.L + 800, w:  90, align: 'right' }
      ];

      const drawAptHeader = () => {
        const y0 = doc.y;
        setFont.th(); doc.fillColor('#000');
        COL_APT.forEach(c => doc.text(c.label, c.x, y0, { width: c.w, align: c.align, lineBreak: false }));
        hr(y0 + LINE_H - 2);
      };
      const drawAptRow = (obj) => {
        const y0 = doc.y;
        setFont.td(); doc.fillColor('#111');
        COL_APT.forEach(c => doc.text(String(obj[c.key] ?? '—'), c.x, y0, { width: c.w, align: c.align, lineBreak: false }));
        hr(y0 + LINE_H - 1)
      };

      // -------------- Tabela: Caixa --------------
      const COL_CASH = [
        { key: 'abertura',  label: 'ABERTURA',  x: P.L +   0, w: 150, align: 'left'  },
        { key: 'fechamento',label: 'FECHAMENTO',x: P.L + 150, w: 150, align: 'left'  },
        { key: 'inicial',   label: 'INICIAL',   x: P.L + 300, w:  90, align: 'right' },
        { key: 'entradas',  label: 'ENTRADAS',  x: P.L + 390, w:  90, align: 'right' },
        { key: 'despesas',  label: 'DESPESAS',  x: P.L + 480, w:  90, align: 'right' },
        { key: 'esperado',  label: 'ESPERADO',  x: P.L + 570, w:  90, align: 'right' },
        { key: 'contado',   label: 'CONTADO',   x: P.L + 660, w:  90, align: 'right' },
        { key: 'diferenca',  label: 'DIFERENÇA', x: P.L + 750, w:  90, align: 'right' }
      ];

      const drawCashHeader = () => {
        const y0 = doc.y;
        setFont.th(); doc.fillColor('#000');
        COL_CASH.forEach(c => doc.text(c.label, c.x, y0, { width: c.w, align: c.align, lineBreak: false }));
        hr(y0 + LINE_H - 2);
      };
      const drawCashRow = (obj) => {
        const y0 = doc.y;
        setFont.td(); doc.fillColor('#111');
        COL_CASH.forEach(c => doc.text(String(obj[c.key] ?? '—'), c.x, y0, { width: c.w, align: c.align, lineBreak: false }));
        hr(y0 + LINE_H - 1);
      };

      // -------------- Quebra segura --------------
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
      function renderFiltersHeader() {
        const F = reportInfo.filters || reportInfo.filtros || {};

        // --- PERÍODO ---
        // Se vier label pronto, usa ele. Senão, monta via start/end.
        const periodLabel = F.periodLabel || F.period || reportInfo.periodLabel || reportInfo.periodo || reportInfo.period;
        const pStart =
          F.start || F.startDate || F.from || F.dateFrom || F.inicio || F.dataInicio ||
          reportInfo.periodStart || reportInfo.startDate || reportInfo.from || reportInfo.inicio || reportInfo.dataInicio;
        const pEnd =
          F.end || F.endDate || F.to || F.dateTo || F.fim || F.dataFim ||
          reportInfo.periodEnd || reportInfo.endDate || reportInfo.to || reportInfo.fim || reportInfo.dataFim;

        const periodoStr = periodLabel
          ? String(periodLabel)
          : ((pStart || pEnd) ? `${fmtDate(pStart)} - ${fmtDate(pEnd)}` : 'Todos');

        // --- PROFISSIONAIS ---
        let barbersRaw =
          F.barbers || F.profissionais || F.barbeiros || F.barberNames ||
          reportInfo.barbers || reportInfo.profissionais || reportInfo.barbeiros || reportInfo.barberNames;

        let profStr = 'Todos';
        if (barbersRaw) {
          let arr;
          if (typeof barbersRaw === 'string') {
            arr = barbersRaw.split(',').map(s => s.trim()).filter(Boolean);
          } else if (Array.isArray(barbersRaw)) {
            arr = barbersRaw.map(b => {
              if (b && typeof b === 'object') return b.name || b.nome || b.fullName || b.label || b.text || '';
              return String(b || '');
            }).filter(Boolean);
          }
          if (arr && arr.length) profStr = arr.join(', ');
        }
        // Fallback: deduz dos agendamentos
        if (profStr === 'Todos') {
          const setNames = new Set();
          (appointments || []).forEach(a => {
            const n = a?.barber?.name || a?.barbeiro?.name || a?.barberName || '';
            if (n) setNames.add(n);
          });
          if (setNames.size === 1) profStr = [...setNames][0];
          if (setNames.size > 1 && setNames.size <= 4) profStr = [...setNames].join(', ');
        }

        // --- STATUS ---
        const statusLabel = F.statusLabel || reportInfo.statusLabel;
        let statusRaw =
          statusLabel ||
          F.status || F.statuses || F.statusFilter || F.statusFilters ||
          reportInfo.status || reportInfo.statuses || reportInfo.filtrosStatus || reportInfo.statusFilter;

        let arrStatus = [];
        if (typeof statusRaw === 'string') {
          const s = statusRaw.trim();
          if (s && !/^todos?|todas?|all$/i.test(s)) {
            arrStatus = s.split(',').map(x => getStatusText(x.trim().toLowerCase()));
          }
        } else if (Array.isArray(statusRaw)) {
          arrStatus = statusRaw
            .map(s => String(s || '').trim())
            .filter(s => s && !/^todos?|todas?|all$/i.test(s))
            .map(s => getStatusText(s.toLowerCase()));
        }
        if (!arrStatus.length) {
          // INFERÊNCIA pelos itens impressos
          const set = new Set(
            (appointments || [])
              .map(a => String(a?.status || '').toLowerCase())
              .filter(Boolean)
          );
          if (set.size) arrStatus = [...set].map(s => getStatusText(s));
        }
        const statusStr = arrStatus.length ? arrStatus.join(', ') : 'Todos';

        // --- LAYOUT (sem linhas por item – removendo as setas da imagem) ---
        ensurePage(4, null);
        setFont.h2(); doc.fillColor('#000');
        doc.text('FILTROS APLICADOS', P.L, doc.y, { width: WIDTH, align: 'left', lineBreak: false });
        // linha só abaixo do título
        hr(doc.y + LINE_H - 2);
        doc.y += LINE_H;

        const labelW = 90;
        const valueW = WIDTH - labelW;

        const row = (label, value, drawLine = false) => {
          ensurePage(1, null);
          const y0 = doc.y;
          setFont.th(); doc.fillColor('#000');
          doc.text(label, P.L, y0, { width: labelW, align: 'left', lineBreak: false });
          setFont.td(); doc.fillColor('#111');
          doc.text(String(value || '—'), P.L + labelW, y0, { width: valueW, align: 'left', lineBreak: false });
          if (drawLine) hr(y0 + LINE_H - 1); // <— só se pedir
          doc.y += LINE_H;
        };

        // desenha SEM a linha inferior em cada item (remove as setas)
        row('Período', periodoStr, false);
        row('Profissionais', profStr, false);
        row('Status', statusStr, false);

        doc.y += 6; // respiro antes da tabela de agendamentos
      }


      // ============== RENDER ==============
      addInstitutionalHeader();
      renderFiltersHeader();
      // ---- Agendamentos ----
      drawAptHeader();
      doc.y += LINE_H;

      const isRevenue = s => String(s).toLowerCase() === 'completed';

      if (!appts.length) {
        const y0 = doc.y;
        setFont.td(); doc.fillColor('#444');
        doc.text('Nenhum agendamento no período.', P.L, y0, { width: WIDTH, align: 'left', lineBreak: false });
        hr(y0 + LINE_H - 1);
        doc.y += LINE_H;
      } else {
        let totalApt = 0;
        appts.forEach(apt => {
          const linha = {
            data: fmtDate(apt.appointmentDate),
            hora: (apt.appointmentTime || '').slice(0, 5),
            cliente: clip(((apt.client?.firstName || '') + ' ' + (apt.client?.lastName || '')).trim(), 48),
            barbeiro: clip(apt.barber?.name || '', 28),
            servico: clip(apt.serviceType?.name || '', 40),
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
        hr(yTot + LINE_H - 1);
        doc.y += LINE_H;
      }

      // ---- Totais por forma de pagamento (SEM reimprimir header de agendamentos) ----
      doc.y += 4; // pequeno respiro
      ensurePage(6, null); // 1 título + 1 header + 5 linhas + total

      setFont.h2(); doc.fillColor('#000');
      doc.text('TOTAIS POR FORMA DE PAGAMENTO', P.L, doc.y, { width: WIDTH, align: 'left', lineBreak: false });
      doc.y += LINE_H;

      // Tabela (uma coluna de método + uma coluna de valor)
      const colLabelW = Math.floor(WIDTH * 0.75); // 75% para o nome
      const colValueW = WIDTH - colLabelW;        // 25% para o valor

      // Cabeçalho (sem linha embaixo)
      setFont.th(); doc.fillColor('#000');
      doc.text('MÉTODO', P.L, doc.y, { width: colLabelW, align: 'left', lineBreak: false });
      doc.text('VALOR', P.L + colLabelW, doc.y, { width: colValueW, align: 'right', lineBreak: false });
      doc.y += LINE_H;

      // Linhas (só traço ENTRE linhas, não depois da última)
      setFont.td(); doc.fillColor('#111');
      PM_ORDER.forEach((k, idx) => {
        ensurePage(1, null);
        const y0 = doc.y;
        doc.text(PM_LABEL[k], P.L, y0, { width: colLabelW, align: 'left', lineBreak: false });
        doc.text(fmtMoney(Number(payTotals[k] || 0)), P.L + colLabelW, y0, { width: colValueW, align: 'right', lineBreak: false });
        if (idx < PM_ORDER.length - 1) hr(y0 + LINE_H - 1); // só entre linhas
        doc.y += LINE_H;
      });


      // Total geral recebido (soma das formas)
      ensurePage(1, null);
      hr(doc.y - 2); // linha acima do total
      setFont.th(); doc.fillColor('#000');
      const yTG = doc.y;
      doc.text('TOTAL RECEBIDO', P.L, yTG, { width: colLabelW, align: 'left', lineBreak: false });
      doc.text(fmtMoney(payGrand), P.L + colLabelW, yTG, { width: colValueW, align: 'right', lineBreak: false });
      hr(yTG + LINE_H - 1);
      doc.y += LINE_H + 4;

      // ---- Caixa ----
      doc.y += 2; hr(doc.y); doc.y += 6;
      setFont.h2(); doc.fillColor('#000');
      doc.text('FLUXO DE CAIXA', P.L, doc.y, { width: WIDTH, align: 'left', lineBreak: false });
      doc.y += LINE_H;

      drawCashHeader();
      doc.y += LINE_H;

      const noCashData = !cash.length || (cash.length === 1 && !cash[0].openedAt && !cash[0].closedAt && !cash[0].totalEntradas && !cash[0].totalDespesas);

      if (noCashData) {
        const y0 = doc.y;
        setFont.td(); doc.fillColor('#444');
        doc.text('Nenhum registro de caixa no período.', P.L, y0, { width: WIDTH, lineBreak: false });
        hr(y0 + LINE_H - 1);
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
        // hr(doc.y - 2);
        setFont.th(); doc.fillColor('#000');
        const yTot = doc.y;
        doc.text('TOTAIS', P.L + 0, yTot, { width: 200, align: 'left', lineBreak: false });
        doc.text(fmtMoney(totInicial), P.L + 200, yTot, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totEntradas), P.L + 256, yTot, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totDespesas), P.L + 312, yTot, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totEsperado), P.L + 368, yTot, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totContado), P.L + 424, yTot, { width: 56, align: 'right', lineBreak: false });
        doc.text(fmtMoney(totDif), P.L + 480, yTot, { width: 59, align: 'right', lineBreak: false });
        hr(yTot + LINE_H - 1);
        doc.y += LINE_H;

        // Resumo final do caixa
        const resultadoPeriodo = totEntradas - totDespesas;   // "lucro" operacional simples no período
        const sobraFalta = totDif;                      // soma das diferenças (contado - esperado)

        setFont.td(); doc.fillColor('#000');
        const yRes = doc.y + 2;
        doc.text(`Resultado (Entradas - Despesas): ${fmtMoney(resultadoPeriodo)}`, P.L, yRes, { width: WIDTH / 2, align: 'left', lineBreak: false });
        doc.text(`Sobra/Falta (Diferença total): ${fmtMoney(sobraFalta)}`, P.L + WIDTH / 2, yRes, { width: WIDTH / 2, align: 'right', lineBreak: false });
        hr(yRes + LINE_H);
        doc.y = yRes + LINE_H + 2;
      }

      // -------------- Rodapé (todas as páginas) --------------
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
