const whatsapp = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const SafeLocalAuth = require('../utils/CustomLocalAuth');
const { formatBrazilianPhoneForWhatsApp } = require('./smartphoneformatter');
const { generatePhoneVariations, cleanPhone } = require('./smartphoneformatter');
const DEBUG = process.env.DEBUG_WHATSAPP === 'true';

let client = null;
let isReady = false;
let latestQrCode = null;

// Função de timeout para evitar travamentos
function timeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('⏱ Timeout ao inicializar WhatsApp')), ms);
  });
}

// Inicializar cliente WhatsApp
async function initializeWhatsApp() {
  try {
    console.log('[WHATSAPP] Criando instância do cliente...');

    client = new whatsapp.Client({
      authStrategy: new SafeLocalAuth({
        clientId: process.env.WHATSAPP_SESSION_NAME || 'barbershop_session'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    console.log('[WHATSAPP] Registrando eventos...');

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
    });

    client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp desconectado:', reason);
    isReady = false;
    console.log('🔄 Tentando reinicializar em 5s...');
    setTimeout(() => initializeWhatsApp(), 5000);
  });

    client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação WhatsApp:', msg);
    });

    console.log('🔄 Inicializando WhatsApp...');
    client.initialize();
    console.log('✅ Inicialização do WhatsApp finalizada.');

  } catch (error) {
    console.error('❌ Erro ao inicializar WhatsApp:', error);
  }
}

/**
 * Função auxiliar para aguardar um tempo específico
 */
function delay(ms) {

  return new Promise(resolve => setTimeout(resolve, ms));
}
async function sendMessageWithTimeout(numberId, message, timeoutMs = 10000) {
  return Promise.race([
    client.sendMessage(numberId, message),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("⏱ Timeout no envio da mensagem")), timeoutMs)
    )
  ]);
}
/**
 * Verifica se o cliente está realmente pronto para envio
 */
async function ensureClientReady() {
  if (!client) {
    throw new Error('Cliente WhatsApp não inicializado');
  }
  
  if (!isReady) {
    throw new Error('Cliente WhatsApp não está pronto');
  }
  
  // Verificação adicional do estado interno
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

/**
 * Envio normal e rápido (sem delay fixo)
 */
async function sendWhatsAppMessage(phone, message, maxRetries = 3) {
  console.log(`[WHATSAPP] 🚀 Enviando para: ${phone}`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await ensureClientReady();

      const formattedPhone = await formatBrazilianPhoneForWhatsApp(client, phone);
      if (!formattedPhone) throw new Error("Falha no formatador");

      // Validação oficial do número
      const numberId = await client.getNumberId(formattedPhone);
      if (!numberId) throw new Error(`Número não existe no WhatsApp: ${formattedPhone}`);

      await sendMessageWithTimeout(numberId._serialized, message);

      console.log(`[WHATSAPP] ✅ Sucesso na tentativa ${attempt}`);
      return true;

    } catch (err) {
      console.error(`[WHATSAPP] ❌ Tentativa ${attempt} falhou: ${err.message}`);
      if (attempt < maxRetries) {
        const waitTime = attempt * 1000; // 1s, 2s, 3s...
        console.log(`[WHATSAPP] ⏳ Retentando em ${waitTime}ms...`);
        await delay(waitTime);
      }
    }
  }

  console.error(`[WHATSAPP] 💥 Todas as ${maxRetries} tentativas falharam para ${phone}`);
  return false;
}

/**
 * Versão debug (testa variações do número, com delay maior)
 */
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
          await delay(10000); // mais longo no debug
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


// Verificar status da conexão
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

// Desconectar WhatsApp
const deleteSession = require('../utils/deleteSession');

async function disconnectWhatsApp() {
  try {
    if (client) {
      console.log('🔌 Desconectando WhatsApp...');
      await client.destroy();
      await delay(3000);
      client = null;
      isReady = false;
      latestQrCode = null;
      const sessionId = process.env.WHATSAPP_SESSION_NAME || 'barbershop_session';
      await deleteSession(sessionId);
      console.log('📱 WhatsApp desconectado e sessão removida com segurança');
    }
  } catch (error) {
    console.error('❌ Erro ao desconectar WhatsApp:', error);
  }
}

function getLastQRCode() {
  return latestQrCode;
}

module.exports = {
  initializeWhatsApp,
  sendWhatsAppMessage,
  sendWhatsAppMessageDebug, // Função específica para debugging
  getWhatsAppStatus,
  getLastQRCode,
  disconnectWhatsApp,
  isWhatsAppReady,      
  waitWhatsAppReady
};

