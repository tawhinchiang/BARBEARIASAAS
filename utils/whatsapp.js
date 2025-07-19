const whatsapp = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client = null;
let isReady = false;
let latestQrCode = null;
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
    // client.on('qr', (qr) => {
    //   console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:');
    //   qrcode.generate(qr, { small: true });
    //   console.log('Ou acesse: https://web.whatsapp.com e escaneie o código');
    // });
    client.on('qr', (qr) => {
    latestQrCode = qr;
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
// Enviar mensagem WhatsApp
function formatBrazilianPhone(raw) {
  let cleaned = raw.replace(/\D/g, '');

  if (cleaned.startsWith('55')) {
    cleaned = cleaned.slice(2);
  }

  const ddd = cleaned.slice(0, 2);
  let number = cleaned.slice(2);

  if (number.length === 8) {
    return `55${ddd}${number}`;
  } else if (number.length === 9 && number.startsWith('9')) {
    return `55${ddd}${number}`;
  } else if (number.length === 8 && !number.startsWith('9')) {
    return `55${ddd}9${number}`;
  } else if (number.length === 9 && !number.startsWith('9')) {
    // Exemplo: 92712877 → tenta corrigir
    return `55${ddd}9${number}`;
  } else {
    throw new Error('Número inválido');
  }
}

async function sendWhatsAppMessage(phone, message) {
  try {
    if (!client || !isReady) {
      console.warn('⚠️ WhatsApp não está conectado.');
      return false;
    }

    const trySend = async (formatted) => {
      const chatId = formatted + '@c.us';
      const exists = await client.isRegisteredUser(chatId);
      if (!exists) return false;
      await client.sendMessage(chatId, message);
      console.log(`✅ Mensagem enviada para ${formatted}`);
      return true;
    };

    let raw = phone.replace(/\D/g, '');
    if (!raw.startsWith('55')) raw = '55' + raw;

    let sent = await trySend(raw);

    // Se tiver 13 dígitos, é um número de celular (com 9) — tentar remover
    if (!sent && raw.length === 13) {
      const sem9 = raw.slice(0, 4) + raw.slice(5); // remove o 9 depois do DDD
      if (sem9.length === 12) {
        sent = await trySend(sem9);
      }
    }

    if (!sent) {
      console.warn(`⚠️ Nenhuma tentativa funcionou para ${phone}`);
    }

    return sent;

  } catch (err) {
    console.error('❌ Erro ao enviar WhatsApp:', err);
    return false;
  }
}



    // Enviar mensagem
//     await client.sendMessage(chatId, message);
//     console.log(`✅ Mensagem enviada para ${phone}`);
//     return true;

//   } catch (error) {
//     console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
//     return false;
//   }
// }

// Verificar status da conexão
function getWhatsAppStatus() {
  return {
    isConnected: isReady,
    qrCode: isReady ? null : latestQrCode
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
function getLastQRCode() {
  return latestQrCode;
}

module.exports = {
  initializeWhatsApp,
  sendWhatsAppMessage,
  getWhatsAppStatus,
  getLastQRCode,
  disconnectWhatsApp
};

