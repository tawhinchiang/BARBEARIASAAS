const whatsapp = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client = null;
let isReady = false;

// Inicializar cliente WhatsApp
async function initializeWhatsApp() {
  try {
    client = new whatsapp.Client({
      authStrategy: new whatsapp.LocalAuth({
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

    // Evento QR Code
    client.on('qr', (qr) => {
      console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:');
      qrcode.generate(qr, { small: true });
      console.log('Ou acesse: https://web.whatsapp.com e escaneie o código');
    });

    // Evento de autenticação
    client.on('authenticated', () => {
      console.log('✅ WhatsApp autenticado com sucesso!');
    });

    // Evento de conexão
    client.on('ready', () => {
      console.log('🚀 WhatsApp conectado e pronto para uso!');
      isReady = true;
    });

    // Evento de desconexão
    client.on('disconnected', (reason) => {
      console.log('❌ WhatsApp desconectado:', reason);
      isReady = false;
    });

    // Evento de erro
    client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação WhatsApp:', msg);
    });

    // Inicializar cliente
    await client.initialize();
    
    console.log('🔄 Inicializando WhatsApp...');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar WhatsApp:', error);
  }
}

// Enviar mensagem WhatsApp
async function sendWhatsAppMessage(phone, message) {
  try {
    if (!client || !isReady) {
      console.warn('⚠️ WhatsApp não está conectado. Mensagem não enviada.');
      return false;
    }

    // Formatar número (remover caracteres especiais e adicionar código do país)
    let formattedPhone = phone.replace(/\D/g, '');
    
    // Adicionar código do Brasil se não tiver
    if (formattedPhone.length === 11 && formattedPhone.startsWith('11')) {
      formattedPhone = '55' + formattedPhone;
    } else if (formattedPhone.length === 10) {
      formattedPhone = '5511' + formattedPhone;
    } else if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    const chatId = formattedPhone + '@c.us';

    // Verificar se o número existe no WhatsApp
    const numberExists = await client.isRegisteredUser(chatId);
    if (!numberExists) {
      console.warn(`⚠️ Número ${phone} não está registrado no WhatsApp`);
      return false;
    }

    // Enviar mensagem
    await client.sendMessage(chatId, message);
    console.log(`✅ Mensagem enviada para ${phone}`);
    return true;

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
    return false;
  }
}

// Verificar status da conexão
function getWhatsAppStatus() {
  return {
    isConnected: isReady,
    client: client ? 'Inicializado' : 'Não inicializado'
  };
}

// Desconectar WhatsApp
async function disconnectWhatsApp() {
  try {
    if (client) {
      await client.destroy();
      client = null;
      isReady = false;
      console.log('📱 WhatsApp desconectado');
    }
  } catch (error) {
    console.error('❌ Erro ao desconectar WhatsApp:', error);
  }
}

module.exports = {
  initializeWhatsApp,
  sendWhatsAppMessage,
  getWhatsAppStatus,
  disconnectWhatsApp
};

