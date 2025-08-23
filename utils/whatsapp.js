const whatsapp = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const SafeLocalAuth = require('../utils/CustomLocalAuth');
const { formatBrazilianPhoneForWhatsApp } = require('./smartphoneformatter');
const { generatePhoneVariations, cleanPhone } = require('./smartphoneformatter');
const deleteSession = require('../utils/deleteSession');
const { exec } = require('child_process');
const fs = require('fs');

const DEBUG = process.env.DEBUG_WHATSAPP === 'true';
const TIMEOUTS = {
  send: 10000,
  ack: 20000,
  retryBase: 1000,
  debugDelay: 10000
};

let client = null;
let isReady = false;
let latestQrCode = null;
let initializing = false; // trava para não inicializar múltiplas vezes

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Inicializar cliente WhatsApp
async function initializeWhatsApp() {
  if (initializing || client) {
    console.log('[WHATSAPP] Ignorado: já existe uma instância ativa ou em inicialização');
    return;
  }

  initializing = true;
  try {
    console.log('[WHATSAPP] Criando instância do cliente...');
    function resolveChromePath() {
  const fromEnv = process.env.WHATSAPP_CHROME_BIN
               || process.env.CHROMIUM_PATH
               || process.env.CHROME_BIN
               || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null; 
    }
    const chromePath = resolveChromePath();
    console.log('[WHATSAPP] Browser detectado em:', chromePath || '(auto/puppeteer)');

client = new whatsapp.Client({
  authStrategy: new SafeLocalAuth({
    clientId: process.env.WHATSAPP_SESSION_NAME || 'barbershop_session'
  }),
puppeteer: {
  headless: 'new',
  executablePath: chromePath || process.env.WHATSAPP_CHROME_BIN || '/usr/bin/google-chrome-stable',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-extensions',
    '--mute-audio',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-software-rasterizer'
  ]
}
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
      console.log('🔄 Reinicializando em 5s...');

      await disconnectWhatsApp({ keepSession: true });

      setTimeout(async () => {
        await initializeWhatsApp();
      }, 5000);
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
try { await disconnectWhatsApp({ keepSession: false }); } catch {}
  setTimeout(() => { initializeWhatsApp().catch(()=>{}); }, 3000);
});

    console.log('🔄 Inicializando WhatsApp...');
    await client.initialize();
    console.log('✅ Inicialização do WhatsApp finalizada.');

  } catch (error) {
    console.error('❌ Erro ao inicializar WhatsApp:', error);
    initializing = false;
  }
}

// Desconectar WhatsApp corretamente
async function disconnectWhatsApp(options = { keepSession: false }) {
  try {
    if (client) {
      console.log('🔌 Desconectando WhatsApp...');
      await client.destroy();
      await delay(2000);
      client = null;
      isReady = false;


      // Força matar processos Chrome/Chromium que ficarem abertos
      exec("pkill -f '(chrome|chromium)'", (err) => {
        if (err) {
          console.error('⚠️ Erro ao matar processos chrome:', err.message);
        } else {
          console.log('🧹 Processos Chrome/Chromium encerrados.');
        }
      });
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

async function sendMessageWithTimeout(numberId, message, timeoutMs = 10000) {
  return Promise.race([
    client.sendMessage(numberId, message),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("⏱ Timeout no envio da mensagem")), timeoutMs)
    )
  ]);
}

async function sendWhatsAppMessage(phone, message, maxRetries = 3) {
  console.log(`[WHATSAPP] 🚀 Enviando para: ${phone}`);
  await ensureClientReady();

  const baseFormatted = await formatBrazilianPhoneForWhatsApp(client, phone);
  const variations = [baseFormatted, ...generatePhoneVariations(cleanPhone(phone))];

  for (const variation of variations) {
    if (!variation) continue;
    console.log(`[WHATSAPP] 🔍 Testando variação: ${variation}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const numberId = await client.getNumberId(variation);
        if (!numberId) throw new Error(`Número inválido no WhatsApp: ${variation}`);

        const msg = await sendMessageWithTimeout(numberId._serialized, message, TIMEOUTS.send);
        console.log(`[WHATSAPP] ✅ Envio aceito pelo WhatsApp (tentativa ${attempt})`);

        client.on("message_ack", (ackMsg, ack) => {
          if (ackMsg.id.id === msg.id.id) {
            console.log(`[WHATSAPP] 📬 ACK recebido (${ack}) para ${variation}`);
          }
        });

        return true;
      } catch (err) {
        console.error(`[WHATSAPP] ❌ Falha com ${variation} (tentativa ${attempt}): ${err.message}`);
        if (attempt < maxRetries) {
          const waitTime = attempt * TIMEOUTS.retryBase;
          console.log(`[WHATSAPP] ⏳ Retentando em ${waitTime}ms...`);
          await delay(waitTime);
        }
      }
    }
  }

  console.error(`[WHATSAPP] 💥 Todas as variações falharam para ${phone}`);
  return false;
}

async function sendWhatsAppMessageDebug(phone, message) {
  console.log(`[DEBUG] 🔬 Debug ativado para: ${phone}`);
  try {
    await ensureClientReady();
    const variations = generatePhoneVariations(cleanPhone(phone));
    if (DEBUG) console.log(`[DEBUG] Variações geradas:`, variations);

    for (const variation of variations) {
      try {
        const contactId = await client.getNumberId(variation);
        if (contactId) {
          await sendMessageWithTimeout(contactId._serialized, message);
          console.log(`[DEBUG] ✅ Sucesso com ${variation}`);
          await delay(10000);
          return true;
        }
      } catch (err) {
        console.log(`[DEBUG] ❌ Falhou com ${variation}: ${err.message}`);
      }
    }

    console.log(`[DEBUG] 💥 Nenhuma variação funcionou`);
    return false;
  } catch (err) {
    console.error(`[DEBUG] 💥 Erro geral:`, err.message);
    return false;
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
