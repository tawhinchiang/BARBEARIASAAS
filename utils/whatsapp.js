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
 * Função auxiliar para aguardar um tempo específico
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * Enviar mensagem WhatsApp com correção de timing e retry
 * CORREÇÃO ESPECÍFICA para o problema do número 63992271206
 */
async function sendWhatsAppMessage(phone, message, maxRetries = 3) {
  console.log(`[WHATSAPP] 🚀 Iniciando envio para: ${phone}`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[WHATSAPP] 📤 Tentativa ${attempt}/${maxRetries}`);
      
      // PASSO 1: Verificar se cliente está pronto
      await ensureClientReady();
      console.log(`[WHATSAPP] ✅ Cliente verificado e pronto`);
      
      // PASSO 2: Obter ID válido usando formatador inteligente
      console.log(`[WHATSAPP] 🔍 Buscando ID válido para: ${phone}`);
      const formattedPhone = await formatBrazilianPhoneForWhatsApp(client, phone);
      
      if (!formattedPhone) {
        throw new Error(`Não foi possível encontrar ID válido para: ${phone}`);
      }
      
      console.log(`[WHATSAPP] ✅ ID válido encontrado: ${formattedPhone}`);
      
      // PASSO 3: Enviar mensagem
      console.log(`[WHATSAPP] 📨 Enviando mensagem...`);
      await client.sendMessage(formattedPhone, message);
      console.log(`[WHATSAPP] ✅ Comando sendMessage executado`);
      
      // PASSO 4: CORREÇÃO CRÍTICA - Aguardar processamento completo
      // Esta é a correção principal baseada na Issue #1529
      console.log(`[WHATSAPP] ⏳ Aguardando processamento completo (5 segundos)...`);
      await delay(5000); // 5 segundos para garantir processamento
      
      // PASSO 5: Verificação adicional (opcional)
      console.log(`[WHATSAPP] ✅ Processamento concluído`);
      
      console.log(`[WHATSAPP] 🎉 Mensagem enviada com sucesso para ${formattedPhone} (tentativa ${attempt})`);
      return true;
      
    } catch (error) {
      console.error(`[WHATSAPP] ❌ Tentativa ${attempt} falhou:`, error.message);
      
      // Se não é a última tentativa, aguardar antes de tentar novamente
      if (attempt < maxRetries) {
        const waitTime = 2000 * attempt; // Aumenta o tempo de espera a cada tentativa
        console.log(`[WHATSAPP] ⏳ Aguardando ${waitTime}ms antes da próxima tentativa...`);
        await delay(waitTime);
      }
    }
  }
  
  console.error(`[WHATSAPP] 💥 Todas as ${maxRetries} tentativas falharam para: ${phone}`);
  return false;
}

/**
 * Versão específica para debugging do número problemático
 */
async function sendWhatsAppMessageDebug(phone, message) {
  console.log(`[DEBUG] 🔬 Modo debug ativado para: ${phone}`);
  
  try {
    // Log detalhado de cada passo
    console.log(`[DEBUG] 1. Verificando cliente...`);
    await ensureClientReady();
    
    console.log(`[DEBUG] 2. Buscando variações do número...`);
    const { generatePhoneVariations, cleanPhone } = require('./smartphoneformatter');
    const cleanNumber = cleanPhone(phone);
    const variations = generatePhoneVariations(cleanNumber);
    console.log(`[DEBUG] Variações geradas:`, variations);
    
    console.log(`[DEBUG] 3. Testando cada variação...`);
    for (const variation of variations) {
      try {
        console.log(`[DEBUG] Testando: ${variation}`);
        const contactId = await client.getNumberId(variation);
        
        if (contactId) {
          console.log(`[DEBUG] ✅ ID encontrado: ${contactId._serialized}`);
          
          console.log(`[DEBUG] 4. Enviando mensagem para ID válido...`);
          await client.sendMessage(contactId._serialized, message);
          
          console.log(`[DEBUG] 5. Aguardando processamento (10 segundos para debug)...`);
          await delay(10000); // Mais tempo no modo debug
          
          console.log(`[DEBUG] ✅ Sucesso com variação: ${variation}`);
          return true;
        }
      } catch (error) {
        console.log(`[DEBUG] ❌ Falha com ${variation}:`, error.message);
      }
    }
    
    console.log(`[DEBUG] 💥 Nenhuma variação funcionou`);
    return false;
    
  } catch (error) {
    console.error(`[DEBUG] 💥 Erro geral:`, error);
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

