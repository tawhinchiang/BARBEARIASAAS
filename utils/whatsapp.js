const whatsapp = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const SafeLocalAuth = require('./CustomLocalAuth');
const { formatBrazilianPhoneForWhatsApp, generatePhoneVariations, cleanPhone } = require('./smartphoneformatter');
const deleteSession = require('../utils/deleteSession');
const { exec } = require('child_process');
const fs = require('fs');
const path = require("path");
const puppeteer = require('puppeteer');
const chromiumPath = puppeteer.executablePath();
const DEBUG = process.env.DEBUG_WHATSAPP === 'true';
const TIMEOUTS = {
  send: parseInt(process.env.WHATSAPP_SEND_TIMEOUT || '10000', 10),
  ack: parseInt(process.env.WHATSAPP_ACK_TIMEOUT || '12000', 10),
  retryBase: parseInt(process.env.WHATSAPP_RETRY_BASE || '800', 10),
  debugDelay: 10000
};
let watchdogTimer = null;
function toAckCode(ackMsg, ack) {
  if (typeof ack === 'number') return ack;
  if (ack && typeof ack === 'object') {
    if (typeof ack.ack === 'number') return ack.ack;
    if (typeof ack.status === 'number') return ack.status;
    if (typeof ack.value === 'number') return ack.value;
  }
  if (typeof ackMsg?.ack === 'number') return ackMsg.ack;
  const n = Number(ack);
  return Number.isFinite(n) ? n : 0;
}

function ackLabel(ack) {
  const code = toAckCode(null, ack);
  return ({ 0: 'pending', 1: 'server', 2: 'device', 3: 'read', 4: 'played' })[code] ?? String(code);
}

const ACK_SUCCESS_LEVEL = parseInt(process.env.ACK_SUCCESS_LEVEL || "1", 10);
let client = null;
let isReady = false;
let latestQrCode = null;
let initializing = false; // trava para não inicializar múltiplas vezes
let reinitTimer = null;
let initializingStartedAt = 0;
let lastDisconnectWasManual = false;
let lastState = 'UNLAUNCHED'; // rastreia o último estado do client
let lastInitAt = 0;
async function waitUntilConnected(label = 'post-auth') {
  // evita erro se client não existe
  if (!client) return false;
  for (let i = 0; i < 45; i++) { // ~45s
    try {
      const s = await client.getState();
      if (s === 'CONNECTED') {
        lastState = 'CONNECTED';
        if (!isReady) {
          isReady = true;
          latestQrCode = null;
          initializing = false;
          console.log(`[WA] ✅ Estado CONNECTED (${label}) — marcando isReady=true`);
        }
        return true;
      } else {
        lastState = s || lastState;
      }
    } catch (e) {
      // ignora exceção momentânea de getState durante boot
    }
    await delay(1000);
  }
  console.warn('[WA] ⏳ Timeout aguardando CONNECTED em', label);
  return false;
}
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
  lastInitAt = Date.now();


  try {
    console.log('[WHATSAPP] Criando instância do cliente...');

    function clearStaleLocks(sessionDir) {
  try {
    const files = fs.readdirSync(sessionDir);
    files.forEach(file => {
      if (file.startsWith("Singleton")) {
        fs.rmSync(path.join(sessionDir, file), { force: true });
        console.log(`[WHATSAPP] 🔐 Removido lock órfão: ${file}`);
      }
    });
  } catch (e) {
    console.warn("[WHATSAPP] Erro ao limpar locks:", e.message);
  }
}

const sessionPath = path.resolve(__dirname, "..", ".wwebjs_auth", "session-barbershop_session");
clearStaleLocks(sessionPath);

    client = new whatsapp.Client({
      authStrategy: new SafeLocalAuth({
        clientId: process.env.WHATSAPP_SESSION_NAME || 'barbershop_session'
      }),
      puppeteer: {
        handleSIGINT: false,
        handleSIGHUP: false,
        handleSIGTERM: false,
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
      lastState = state || lastState;
      console.log(`[WA] change_state: ${state}`);
      if (state === 'CONNECTED') {
        if (!isReady) {
          isReady = true;
          latestQrCode = null;
          initializing = false;
          console.log('🚀 WhatsApp conectado via change_state!');
        }
      }
    });
    client.on('qr', (qr) => {
      latestQrCode = qr;
      console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', async () => {
      console.log('✅ WhatsApp autenticado com sucesso!');
      // Novo: força uma checagem por CONNECTED caso o 'ready' não venha
      waitUntilConnected('authenticated');
    });

    client.on('ready', async () => {
      initializing = false;
      isReady = true;
      latestQrCode = null;
      lastState = 'CONNECTED'; // Novo
      console.log('🚀 WhatsApp conectado e pronto para uso!');
    });

    // Usar ONCE para não acumular listeners
    client.once('disconnected', async (reason) => {
      lastState = 'DISCONNECTED';
      console.log('❌ WhatsApp desconectado:', reason);
      isReady = false;

      try { await disconnectWhatsApp({ keepSession: true, internal: true }); } catch { }

      // Evita re-inits concorrentes
      if (reinitTimer) clearTimeout(reinitTimer);

      // Se NÃO foi logout manual, agenda re-init
      if (!lastDisconnectWasManual) {
        reinitTimer = setTimeout(() => {
          initializeWhatsApp().catch(() => { });
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
      try { await disconnectWhatsApp({ keepSession: false, manual: true }); } catch { }
      setTimeout(() => { initializeWhatsApp().catch(() => { }); }, 3000);
    });


    console.log('🔄 Inicializando WhatsApp...');
    await client.initialize();
   if (!watchdogTimer) {
   watchdogTimer = setInterval(async () => {
     try {
       if (!client) return;
       const s = await client.getState().catch(() => null);
      
      // janela de graça de 120s após init; e não reinicia se estiver abrindo/pareando
      const grace = Date.now() - (lastInitAt || 0) < 120000;
      const opening = s === 'OPENING' || s === 'PAIRING' || s === 'UNLAUNCHED';
      if (s !== 'CONNECTED' && !grace && !opening) {
         console.warn('[WA] Watchdog detectou estado não conectado — reinicializando...');
         await disconnectWhatsApp({ keepSession: true, internal: true });
         initializeWhatsApp().catch(() => {});
       }
     } catch (_) { /* ignore */ }
   }, 60000);
 }

    console.log('✅ Inicialização do WhatsApp finalizada.');

  } catch (error) {
    console.error('❌ Erro ao inicializar WhatsApp:', error);
    try { await client?.destroy(); } catch (_) { }
    client = null;
    isReady = false;
    initializing = false;
    // Backoff curto para context destroyed / navegação
    setTimeout(() => { initializeWhatsApp().catch(() => { }); }, 3000);
  }
}
// Aguarda confirmação de entrega (ACK) da mensagem específica.
// 0=pending, 1=server, 2=device, 3=read, 4=played
function waitForAck(msg, { minAck = ACK_SUCCESS_LEVEL, timeoutMs = TIMEOUTS.ack } = {}) {
  return new Promise((resolve) => {
    let done = false;
    let latest = 0;

    const finish = (result) => {
      if (!done) {
        done = true;
        try { client.removeListener('message_ack', onAck); } catch (_) { }
        clearTimeout(timer);
        resolve(result);
      }
    };

    const onAck = (ackMsg, ackRaw) => {
      try {
        const same = ackMsg?.id?.id && msg?.id?.id && (ackMsg.id.id === msg.id.id);
        if (!same) return;
        const code = toAckCode(ackMsg, ackRaw);
        latest = code;
        if (code >= minAck) {
          finish({ delivered: true, ack: code });
        }
      } catch (_) { /* ignore */ }
    };

    const timer = setTimeout(() => {
      finish({ delivered: false, ack: latest, reason: 'timeout' });
    }, timeoutMs);

    client.on('message_ack', onAck);
  });
}


// Desconectar WhatsApp corretamente
async function disconnectWhatsApp(options = { keepSession: false, manual: false, internal: false }) {
  try {
    if (client) {
      console.log('🔌 Desconectando WhatsApp...');

      // Tenta logout "limpo" primeiro (invalida do lado do servidor)
      if (!options.keepSession) {
        try { await client.logout(); } catch (_) { }
      }

      // Fecha o navegador atrelado (se houver)
      try {
        const browser = client.pupBrowser;
        const proc = browser && browser.process ? browser.process() : null;
        if (proc?.pid) {
          console.log(`🧹 Encerrando navegador PID=${proc.pid}...`);
          try {
            proc.kill('SIGTERM');
            // pequeno grace period
            await new Promise(r => setTimeout(r, 500));
            if (!proc.killed) proc.kill('SIGKILL');
          } catch (_) {}
        }
      } catch (_) { }

      // Destrói o cliente
      try { await client.destroy(); } catch (_) { }

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
      if (process.env.ALLOW_GLOBAL_CHROME_KILL === 'true') {
        exec("pkill -f '(chrome|chromium)'", (err) => {
          if (err) {
            console.error('⚠️ Erro ao matar processos chrome:', err.message);
          } else {
            console.log('🧹 Processos Chrome/Chromium encerrados.');
          }
        });
      }
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
    const msg = String(error?.message || '');
    if (/Session closed|Target closed|Browser is closed|Protocol error/i.test(msg)) {
      console.warn('[WA] Cliente desconectado durante getState — tentando reinicializar...');
      try { await disconnectWhatsApp({ keepSession: true, internal: true }); } catch { }
      setTimeout(() => { initializeWhatsApp().catch(() => { }); }, 1000);
    
    }
    throw new Error(`Erro ao verificar estado do cliente: ${msg}`);
  }
  return true;
}

async function sendMessageWithTimeout(numberId, message, timeoutMs = TIMEOUTS.send) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('⏱ Timeout no envio da mensagem')); }, timeoutMs); client.sendMessage(numberId, message)
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      }).catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function sendWhatsAppMessage(phone, message) {
  console.log(`[WHATSAPP] 🚀 Enviando para: ${phone}`);

  await ensureClientReady();
  await waitWhatsAppReady(30000);

  try {
    const cleaned = cleanPhone(phone);
    const numberId = await client.getNumberId(cleaned);

    if (!numberId) {
      console.warn(`[WHATSAPP] ⚠️ Número não registrado no WhatsApp: ${cleaned}`);
      return { ok: false, delivered: false, error: 'not-registered' };
    }

    const jid = numberId._serialized;
    console.log(`[WHATSAPP] ✅ JID resolvido: ${jid}`);

    const msgObj = await sendMessageWithTimeout(jid, message, TIMEOUTS.send);
    console.log(`[WHATSAPP] 📤 Enviado para ${jid}`);

    const ackInfo = await waitForAck(msgObj, {
      minAck: ACK_SUCCESS_LEVEL,
      timeoutMs: TIMEOUTS.ack
    });

    const ackCode = toAckCode(msgObj, ackInfo);
    const delivered = !!(ackInfo && (ackInfo.delivered || ackCode >= ACK_SUCCESS_LEVEL));

    console.log(`[WHATSAPP] 📨 ACK ${ackLabel(ackCode)} (${ackCode}) | delivered=${delivered}`);

    return { ok: true, delivered, ack: ackCode, used: jid };

  } catch (err) {
    const msg = String(err.message || '').toLowerCase();
    console.error(`[WHATSAPP] ❌ Erro ao enviar: ${msg}`);

    if (msg.includes('timeout no envio')) {
      return { ok: false, delivered: false, error: 'send-timeout' };
    }

    if (msg.includes('timeout')) {
      console.warn(`[WHATSAPP] ⚠️ Timeout esperando ACK para ${phone}, possivelmente enviado sem confirmação`);
      return { ok: true, delivered: false, ack: 0, used: phone, note: 'timeout-but-sent' };
    }

    return { ok: false, delivered: false, error: msg };
  }
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
          const ackInfo = await waitForAck(msg, { minAck: ACK_SUCCESS_LEVEL, timeoutMs: TIMEOUTS.ack });
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
    state: lastState,           // Novo: vizualização do estado (CONNECTED/OPENING/etc.)
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

['SIGINT', 'SIGTERM'].forEach(sig => {
  process.on(sig, async () => {
    console.log(`[WHATSAPP] Sinal ${sig} recebido — encerrando sessão (keepSession=true)`);
    try { await disconnectWhatsApp({ keepSession: true }); } catch { }
    if (!isPM2) process.exit(0);
  });
});


process.on('SIGHUP', () => {
  console.log('[WHATSAPP] SIGHUP recebido — ignorando para manter sessão WhatsApp ativa.');
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
