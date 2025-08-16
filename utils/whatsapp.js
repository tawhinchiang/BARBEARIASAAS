const whatsapp = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const SafeLocalAuth = require('../utils/CustomLocalAuth');
const { formatBrazilianPhoneForWhatsApp } = require('./smartphoneformatter');

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
 * Enviar mensagem WhatsApp com formatação inteligente
 * Esta é a versão corrigida que resolve o problema dos números brasileiros
 */
async function sendWhatsAppMessage(phone, message) {
  try {
    if (!client || !isReady) {
      console.warn('⚠️ WhatsApp não está conectado.');
      return false;
    }

    console.log(`[WHATSAPP] Iniciando envio para: ${phone}`);
    
    // Usa o formatador inteligente para encontrar o ID correto
    const formattedPhone = await formatBrazilianPhoneForWhatsApp(client, phone);
    
    if (!formattedPhone) {
      console.warn(`⚠️ Não foi possível encontrar um ID válido para: ${phone}`);
      return false;
    }
    
    // Envia a mensagem usando o ID correto
    await client.sendMessage(formattedPhone, message);
    console.log(`✅ Mensagem enviada com sucesso para ${formattedPhone}`);
    return true;

  } catch (err) {
    console.error('❌ Erro ao enviar WhatsApp:', err);
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
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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
  getWhatsAppStatus,
  getLastQRCode,
  disconnectWhatsApp,
  isWhatsAppReady,      
  waitWhatsAppReady
};

