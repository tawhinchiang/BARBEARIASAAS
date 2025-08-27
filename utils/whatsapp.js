const whatsapp = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const SafeLocalAuth = require('../utils/CustomLocalAuth');
const { formatBrazilianPhoneForWhatsApp } = require('./smartphoneformatter');
const { generatePhoneVariations, cleanPhone } = require('./smartphoneformatter');
const deleteSession = require('../utils/deleteSession');
const { exec } = require('child_process');
const fs = require('fs');
const puppeteer = require('puppeteer');
const chromiumPath = puppeteer.executablePath();
const DEBUG = process.env.DEBUG_WHATSAPP === 'true';
const TIMEOUTS = {
  send: 10000,
  ack: 45000,
  retryBase: 1000,
  debugDelay: 10000
};

function ackLabel(ack) {
  return ({0:'pending',1:'server',2:'device',3:'read',4:'played'})[ack] ?? String(ack);
}
const ACK_SUCCESS_LEVEL = parseInt(process.env.ACK_SUCCESS_LEVEL || "1", 10);
let client = null;
let isReady = false;
let latestQrCode = null;
let initializing = false; // trava para não inicializar múltiplas vezes
let reinitTimer = null;
let initializingStartedAt = 0;
let lastDisconnectWasManual = false;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Inicializar cliente WhatsApp
async function initializeWhatsApp() {
// Destrava lock 'fantasma': initializing=true sem client por > 15s
if (initializing && !client) {
  const elapsed = Date.now() - (initializingStartedAt || 0);
  if (elapsed > 15000) {
    console.warn('[WHATSAPP] Inicialização travada; resetando lock.');
    initializing = false;
  }
}

// Evita reentrada
if (initializing || client) {
  console.log('[WHATSAPP] Ignorado: já existe instância ativa ou em inicialização');
  return;
}

// Marca início e zera QR antigo
initializing = true;
initializingStartedAt = Date.now();
latestQrCode = null;


 
  try {
    console.log('[WHATSAPP] Criando instância do cliente...');
  
   

client = new whatsapp.Client({
  authStrategy: new SafeLocalAuth({
    clientId: process.env.WHATSAPP_SESSION_NAME || 'barbershop_session'
  }),
puppeteer: {
headless: 'new',
protocolTimeout: 120000,
 timeout: 60000,
  executablePath: chromiumPath,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-software-rasterizer',
    '--lang=pt-BR',
    '--mute-audio',
    '--window-size=800,600'
  ]
},
 qrTimeoutMs: 0
});


    console.log('[WHATSAPP] Registrando eventos...');
      client.on('loading_screen', (percent, message) => {
        console.log(`[WA] loading_screen: ${percent}% - ${message}`);
      });
      client.on('change_state', (state) => {
        console.log(`[WA] change_state: ${state}`);
      });
    client.on('qr', (qr) => {
      latestQrCode = qr;
      console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', () => {
      console.log('✅ WhatsApp autenticado com sucesso!');
    });

    client.on('ready', () => {
      console.log('🚀 WhatsApp conectado e pronto para uso!');
      isReady = true;
       latestQrCode = null;
      initializing = false; // libera lock só quando estiver pronto
    });

    // Usar ONCE para não acumular listeners
   client.once('disconnected', async (reason) => {
  console.log('❌ WhatsApp desconectado:', reason);
  isReady = false;

  try { await disconnectWhatsApp({ keepSession: true, internal: true }); } catch {}

  // Evita re-inits concorrentes
  if (reinitTimer) clearTimeout(reinitTimer);

  // Se NÃO foi logout manual, agenda re-init
  if (!lastDisconnectWasManual) {
    reinitTimer = setTimeout(() => {
      initializeWhatsApp().catch(() => {});
    }, 3000);
  }

  // Limpa a marca manual (se houver)
  lastDisconnectWasManual = false;
});

  client.on('auth_failure', async (msg) => {
  console.error('❌ Falha na autenticação WhatsApp:', msg);
  try {
    const sessionId = process.env.WHATSAPP_SESSION_NAME || 'barbershop_session';
    await deleteSession(sessionId);
    console.log('🧹 Sessão WhatsApp apagada após auth_failure');
  } catch (e) {
    console.error('⚠️ Erro ao limpar sessão após auth_failure:', e.message);
  }
  try { await disconnectWhatsApp({ keepSession: false, manual: true }); } catch {}
  setTimeout(() => { initializeWhatsApp().catch(()=>{}); }, 3000);
});


    console.log('🔄 Inicializando WhatsApp...');
    await client.initialize();
    console.log('✅ Inicialização do WhatsApp finalizada.');

  } catch (error) {console.error('❌ Erro ao inicializar WhatsApp:', error);
 try { await client?.destroy(); } catch (_) {}
 client = null;
 isReady = false;
 initializing = false;
 // Backoff curto para context destroyed / navegação
 setTimeout(() => { initializeWhatsApp().catch(()=>{}); }, 3000);
  }
}
// Aguarda confirmação de entrega (ACK) da mensagem específica.
// ack: 0=pending, 1=servidor, 2=entregue no aparelho, 3=lido, 4=áudio reproduzido
function waitForAck(msg, { minAck = 1, timeoutMs = TIMEOUTS.ack } = {}) {
  return new Promise((resolve) => {
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        try { client.removeListener('message_ack', onAck); } catch (_) {}
        resolve({ delivered: false, ack: 0, reason: 'timeout' });
      }
    }, timeoutMs);

    const onAck = (ackMsg, ack) => {
      try {
        // Garante que é o mesmo messageId
        const same = ackMsg?.id?.id && msg?.id?.id && (ackMsg.id.id === msg.id.id);
        if (same && ack >= minAck && !done) {
          done = true;
          clearTimeout(timer);
          client.removeListener('message_ack', onAck);
          resolve({ delivered: true, ack });
        }
      } catch (_) { /* ignora */ }
    };

    client.on('message_ack', onAck);
  });
}

// Desconectar WhatsApp corretamente
async function disconnectWhatsApp(options = { keepSession: false, manual: false, internal: false }) {
  try {
    if (client) {
      console.log('🔌 Desconectando WhatsApp...');

      // Tenta logout "limpo" primeiro (invalida do lado do servidor)
      try { await client.logout(); } catch (_) {}

      // Fecha o navegador atrelado (se houver)
      try {
        const browser = client.pupBrowser;
        const proc = browser && browser.process ? browser.process() : null;
        if (proc?.pid) {
          console.log(`🧹 Encerrando navegador PID=${proc.pid}...`);
          proc.kill('SIGKILL');
        }
      } catch (_) {}

      // Destrói o cliente
      try { await client.destroy(); } catch (_) {}

      // Reseta estado — ESSENCIAL
      client = null;
      isReady = false;
      initializing = false;     // desbloqueia inicializações futuras
      latestQrCode = null;      // previne exibir QR antigo

      // Evita múltiplos re-inits concorrentes
      if (reinitTimer) { clearTimeout(reinitTimer); reinitTimer = null; }

      // Marca que foi logout manual (a rota controla re-init)
      if (options.manual) lastDisconnectWasManual = true;

      // Limpeza de processos Chrome/Chromium órfãos
      exec("pkill -f '(chrome|chromium)'", (err) => {
        if (err) {
          console.error('⚠️ Erro ao matar processos chrome:', err.message);
        } else {
          console.log('🧹 Processos Chrome/Chromium encerrados.');
        }
      });

      // Remoção da sessão local (se não preservar)
      if (!options.keepSession) {
        const sessionId = process.env.WHATSAPP_SESSION_NAME || 'barbershop_session';
        await deleteSession(sessionId);
        console.log('📱 Sessão WhatsApp removida (keepSession = false)');
      } else {
        console.log('ℹ️ Sessão preservada (keepSession = true)');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao desconectar WhatsApp:', error);
  }
}

// === Funções de envio === //
async function ensureClientReady() {
  if (!client) throw new Error('Cliente WhatsApp não inicializado');
  if (!isReady) throw new Error('Cliente WhatsApp não está pronto');

  try {
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      throw new Error(`Cliente em estado inválido: ${state}`);
    }
  } catch (error) {
    throw new Error(`Erro ao verificar estado do cliente: ${error.message}`);
  }
  return true;
}

async function sendMessageWithTimeout(numberId, message, timeoutMs = TIMEOUTS.send) {
 return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {      reject(new Error('⏱ Timeout no envio da mensagem'));    }, timeoutMs);  client.sendMessage(numberId, message)
     .then(res => {
       clearTimeout(timer);
       resolve(res);
      })     .catch(err => {
       clearTimeout(timer);
        reject(err);
      });
  });
}

async function sendWhatsAppMessage(phone, message, maxRetries = 3) {
  console.log(`[WHATSAPP] 🚀 Enviando para: ${phone}`);
  await ensureClientReady();
  await waitWhatsAppReady(30000);
  // 1) Base format + variações (inclui versões com '+' para E.164)
  const baseFormatted = await formatBrazilianPhoneForWhatsApp(client, phone);
  const rawVars = [baseFormatted, ...generatePhoneVariations(cleanPhone(phone))].filter(Boolean);

  // Inclui a mesma variação com e sem '+' e remove duplicadas
  const variations = Array.from(new Set(
    rawVars.flatMap(v => (v.startsWith('+') ? [v, v.slice(1)] : [v, `+${v}`]))
  ));

  for (const variation of variations) {
    console.log(`[WHATSAPP] 🔍 Testando variação: ${variation}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const numberId = await client.getNumberId(variation);
        if (!numberId) throw new Error(`Número inválido no WhatsApp: ${variation}`);

        // 2) Envia com timeout
        const msg = await sendMessageWithTimeout(numberId._serialized, message, TIMEOUTS.send);
        console.log(`[WHATSAPP] ✅ Envio ACEITO (tentativa ${attempt})`);

        // 3) Aguarda ACK ≥ 2 (entregue no aparelho)
         const ackInfo = await waitForAck(msg, { minAck: ACK_SUCCESS_LEVEL, timeoutMs: TIMEOUTS.ack });

        if (ackInfo.delivered) {
          console.log(`[WHATSAPP] 📬 ENTREGUE (ack=${ackInfo.ack}=${ackLabel(ackInfo.ack)}) via ${variation}`);
          // Retorno "rico" (retrocompatível: será truthy onde esperam boolean)
          return { ok: true, delivered: true, ack: ackInfo.ack, used: variation };
        } else {
  console.warn(`[WHATSAPP] ⚠️ Enviado, mas sem confirmação (timeout/ack=0).`);
  return { ok: true, delivered: false, ack: 0, used: variation };
   // Considere retorno "ok" (aceito pelo servidor), apenas sem confirmação
        }
      } catch (err) {
        console.error(`[WHATSAPP] ❌ Falha ${variation} (tentativa ${attempt}): ${err.message}`);
        if (attempt < maxRetries) {
          const waitTime = attempt * TIMEOUTS.retryBase;
          console.log(`[WHATSAPP] ⏳ Retentando em ${waitTime}ms...`);
          await delay(waitTime);
        }
      }
    }
  }

  console.error(`[WHATSAPP] 💥 Todas as variações falharam para ${phone}`);
  return { ok: false, delivered: false };
}

async function sendWhatsAppMessageDebug(phone, message) {
  console.log(`[DEBUG] 🔬 Debug ativado para: ${phone}`);
  try {
    await ensureClientReady();
    await waitWhatsAppReady(30000);
    const baseFormatted = await formatBrazilianPhoneForWhatsApp(client, phone);
    const rawVars = [baseFormatted, ...generatePhoneVariations(cleanPhone(phone))].filter(Boolean);
    const variations = Array.from(new Set(
      rawVars.flatMap(v => (v.startsWith('+') ? [v, v.slice(1)] : [v, `+${v}`]))
    ));

    if (DEBUG) console.log(`[DEBUG] Variações geradas:`, variations);

    for (const variation of variations) {
      try {
        const contactId = await client.getNumberId(variation);
        if (contactId) {
          const msg = await sendMessageWithTimeout(contactId._serialized, message, TIMEOUTS.send);
          const ackInfo = await waitForAck(msg, { minAck: 2, timeoutMs: TIMEOUTS.ack });
          if (ackInfo.delivered) {
            console.log(`[DEBUG] ✅ ENTREGUE (ack=${ackInfo.ack}) com ${variation}`);
            return { ok: true, delivered: true, ack: ackInfo.ack, used: variation };
          } else {
            console.warn(`[DEBUG] ⚠️ Sem ACK de entrega (ack=${ackInfo.ack}) com ${variation}`);
          }
        }
      } catch (err) {
        console.log(`[DEBUG] ❌ Falhou com ${variation}: ${err.message}`);
      }
    }

    console.log(`[DEBUG] 💥 Nenhuma variação funcionou`);
    return { ok: false, delivered: false };
  } catch (err) {
    console.error(`[DEBUG] 💥 Erro geral:`, err.message);
    return { ok: false, delivered: false };
  }
}



function getWhatsAppStatus() {
  return {
    isConnected: isReady,
    qrCode: isReady ? null : latestQrCode
  };
}

function isWhatsAppReady() {
  return isReady;
}

async function waitWhatsAppReady(timeoutMs = 20000) {
  if (isReady) return true;
  const started = Date.now();
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      if (isReady || (Date.now() - started) > timeoutMs) {
        clearInterval(iv);
        resolve(isReady);
      }
    }, 500);
  });
}

function getLastQRCode() {
  return latestQrCode;
}
const isPM2 = !!process.env.pm_id;
['SIGINT','SIGTERM','SIGHUP'].forEach(sig => {
  process.on(sig, async () => {
    console.log(`[WHATSAPP] Sinal ${sig} recebido, encerrando sessão com keepSession=true`);
    try { await disconnectWhatsApp({ keepSession: true }); } catch {}
    // Sob PM2, NÃO finalize manualmente; deixe o PM2 orquestrar.
    if (!isPM2) process.exit(0);
  });
});

module.exports = {
  initializeWhatsApp,
  sendWhatsAppMessage,
  sendWhatsAppMessageDebug,
  getWhatsAppStatus,
  getLastQRCode,
  disconnectWhatsApp,
  isWhatsAppReady,
  waitWhatsAppReady
};
