const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED !== 'false';

const noopStatus = () => ({
  isEnabled: false,
  isConnected: false,
  state: 'DISABLED',
  qrCode: null
});

let impl = null;

function getImpl() {
  if (!WHATSAPP_ENABLED) return null;
  if (impl) return impl;

  try {
    const whatsapp = require('whatsapp-web.js');
    const qrcode = require('qrcode-terminal');
    const puppeteer = require('puppeteer');
    const { cleanPhone, findWhatsAppContactId } = require('./smartphoneformatter');
    const deleteSession = require('./deleteSession');

    let SafeLocalAuth;
    try {
      SafeLocalAuth = require('./CustomLocalAuth');
    } catch {
      SafeLocalAuth = whatsapp.LocalAuth;
    }

    const DEBUG = process.env.DEBUG_WHATSAPP === 'true';
    const TIMEOUTS = {
      send: parseInt(process.env.WHATSAPP_SEND_TIMEOUT || '10000', 10),
      ack: parseInt(process.env.WHATSAPP_ACK_TIMEOUT || '12000', 10),
    };
    const ACK_SUCCESS_LEVEL = parseInt(process.env.ACK_SUCCESS_LEVEL || '1', 10);

    let client = null;
    let isReady = false;
    let latestQrCode = null;
    let initializing = false;

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    function toAckCode(ackMsg, ack) {
      if (typeof ack === 'number') return ack;
      if (ack && typeof ack === 'object') {
        if (typeof ack.ack === 'number') return ack.ack;
        if (typeof ack.status === 'number') return ack.status;
      }
      if (typeof ackMsg?.ack === 'number') return ackMsg.ack;
      const n = Number(ack);
      return Number.isFinite(n) ? n : 0;
    }

    function ackLabel(ack) {
      const code = toAckCode(null, ack);
      return ({ 0: 'pending', 1: 'server', 2: 'device', 3: 'read', 4: 'played' })[code] ?? String(code);
    }

    async function ensureClientReady() {
      if (!client) throw new Error('Cliente WhatsApp não inicializado');
      if (!isReady) throw new Error('Cliente WhatsApp não está pronto');
      const state = await client.getState();
      if (state !== 'CONNECTED') throw new Error(`Cliente em estado inválido: ${state}`);
      return true;
    }

    async function sendMessageWithTimeout(numberId, message, timeoutMs = TIMEOUTS.send) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout no envio da mensagem')), timeoutMs);
        client.sendMessage(numberId, message).then(res => { clearTimeout(timer); resolve(res); }).catch(err => { clearTimeout(timer); reject(err); });
      });
    }

    function waitForAck(msg, { minAck = ACK_SUCCESS_LEVEL, timeoutMs = TIMEOUTS.ack } = {}) {
      return new Promise((resolve) => {
        let done = false;
        let latest = 0;
        const finish = (result) => {
          if (done) return;
          done = true;
          try { client.removeListener('message_ack', onAck); } catch {}
          clearTimeout(timer);
          resolve(result);
        };
        const onAck = (ackMsg, ackRaw) => {
          try {
            const same = ackMsg?.id?.id && msg?.id?.id && (ackMsg.id.id === msg.id.id);
            if (!same) return;
            const code = toAckCode(ackMsg, ackRaw);
            latest = code;
            if (code >= minAck) finish({ delivered: true, ack: code });
          } catch {}
        };
        const timer = setTimeout(() => finish({ delivered: false, ack: latest, reason: 'timeout' }), timeoutMs);
        client.on('message_ack', onAck);
      });
    }

    async function initializeWhatsApp() {
      if (initializing || client) return;
      initializing = true;
      latestQrCode = null;
      try {
        const sessionPath = require('path').resolve(__dirname, '..', '.wwebjs_auth', 'session-' + (process.env.WHATSAPP_SESSION_NAME || 'barbershop_session'));
        try {
          const fs = require('fs');
          if (fs.existsSync(sessionPath)) {
            for (const file of fs.readdirSync(sessionPath)) {
              if (file.startsWith('Singleton')) fs.rmSync(require('path').join(sessionPath, file), { force: true });
            }
          }
        } catch {}

        client = new whatsapp.Client({
          authStrategy: new SafeLocalAuth({ clientId: process.env.WHATSAPP_SESSION_NAME || 'barbershop_session' }),
          puppeteer: {
            headless: 'new',
            executablePath: puppeteer.executablePath(),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
          }
        });

        client.on('qr', (qr) => { latestQrCode = qr; console.log('[WHATSAPP] QR Code recebido.'); try { qrcode.generate(qr, { small: true }); } catch {} });
        client.on('authenticated', () => console.log('[WHATSAPP] Autenticado.'));
        client.on('ready', () => { isReady = true; latestQrCode = null; initializing = false; console.log('[WHATSAPP] Pronto.'); });
        client.once('disconnected', async (reason) => {
          console.log('[WHATSAPP] Desconectado:', reason);
          isReady = false;
          try { await client?.destroy(); } catch {}
          client = null;
          initializing = false;
        });
        client.on('auth_failure', async (msg) => {
          console.error('[WHATSAPP] Falha de autenticação:', msg);
          isReady = false;
          try { await client?.destroy(); } catch {}
          client = null;
          initializing = false;
        });

        await client.initialize();
      } catch (error) {
        console.error('[WHATSAPP] Erro ao inicializar:', error?.message || error);
        try { await client?.destroy(); } catch {}
        client = null;
        isReady = false;
        initializing = false;
      }
    }

    async function disconnectWhatsApp(options = {}) {
      try {
        if (!client) return;
        if (!options.keepSession) { try { await client.logout(); } catch {} }
        try { await client.destroy(); } catch {}
      } finally {
        client = null;
        isReady = false;
        initializing = false;
        latestQrCode = null;
        if (!options.keepSession) {
          try { deleteSession(process.env.WHATSAPP_SESSION_NAME || 'barbershop_session'); } catch {}
        }
      }
    }

    async function sendWhatsAppMessage(phone, message) {
      try {
        if (!client) return { ok: false, delivered: false, error: 'not-initialized' };
        if (!isReady) return { ok: false, delivered: false, error: 'not-ready' };
        await ensureClientReady();
        const cleaned = cleanPhone(phone);
        const numberId = await findWhatsAppContactId(client, cleaned);
        if (!numberId) return { ok: false, delivered: false, error: 'not-registered' };
        const jid = numberId._serialized || numberId;
        const msgObj = await sendMessageWithTimeout(jid, message, TIMEOUTS.send);
        const ackInfo = await waitForAck(msgObj);
        const ackCode = toAckCode(msgObj, ackInfo);
        const delivered = !!(ackInfo?.delivered || ackCode >= ACK_SUCCESS_LEVEL);
        return { ok: true, delivered, ack: ackCode, used: jid };
      } catch (err) {
        return { ok: false, delivered: false, error: String(err?.message || err) };
      }
    }

    async function sendWhatsAppMessageDebug(phone, message) {
      if (DEBUG) console.log('[WHATSAPP DEBUG]', phone);
      return sendWhatsAppMessage(phone, message);
    }

    function getWhatsAppStatus() {
      return { isEnabled: true, isConnected: isReady, state: isReady ? 'CONNECTED' : (initializing ? 'OPENING' : 'DISCONNECTED'), qrCode: isReady ? null : latestQrCode };
    }
    function isWhatsAppEnabled() { return true; }
    function isWhatsAppReady() { return !!(isReady && client); }
    async function waitWhatsAppReady(timeoutMs = 20000) {
      if (isReady) return true;
      const started = Date.now();
      while (Date.now() - started < timeoutMs) { await delay(500); if (isReady) return true; }
      return isReady;
    }
    function getLastQRCode() { return latestQrCode; }

    impl = {
      initializeWhatsApp, sendWhatsAppMessage, sendWhatsAppMessageDebug, getWhatsAppStatus,
      getLastQRCode, disconnectWhatsApp, isWhatsAppEnabled, isWhatsAppReady, waitWhatsAppReady
    };
    return impl;
  } catch (err) {
    console.warn('[WHATSAPP] Dependências do WhatsApp indisponíveis. A integração ficará desativada.', err?.message || err);
    return null;
  }
}

function disabled(name) {
  return async (..._args) => {
    if (name === 'sendWhatsAppMessage' || name === 'sendWhatsAppMessageDebug') return { ok: false, delivered: false, error: 'disabled' };
    if (name === 'waitWhatsAppReady') return false;
    if (name === 'getLastQRCode') return null;
    if (name === 'getWhatsAppStatus') return noopStatus();
    return undefined;
  };
}

module.exports = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'isWhatsAppEnabled') return () => WHATSAPP_ENABLED;
    if (prop === 'isWhatsAppReady') return () => { const i = getImpl(); return i ? i.isWhatsAppReady() : false; };
    if (prop === 'getWhatsAppStatus') return () => { const i = getImpl(); return i ? i.getWhatsAppStatus() : noopStatus(); };
    if (prop === 'getLastQRCode') return () => { const i = getImpl(); return i ? i.getLastQRCode() : null; };
    if (prop === 'waitWhatsAppReady') return async (ms) => { const i = getImpl(); return i ? i.waitWhatsAppReady(ms) : false; };
    if (prop === 'initializeWhatsApp') return async (...a) => { const i = getImpl(); return i ? i.initializeWhatsApp(...a) : undefined; };
    if (prop === 'disconnectWhatsApp') return async (...a) => { const i = getImpl(); return i ? i.disconnectWhatsApp(...a) : undefined; };
    if (prop === 'sendWhatsAppMessage') return async (...a) => { const i = getImpl(); return i ? i.sendWhatsAppMessage(...a) : { ok: false, delivered: false, error: 'disabled' }; };
    if (prop === 'sendWhatsAppMessageDebug') return async (...a) => { const i = getImpl(); return i ? i.sendWhatsAppMessageDebug(...a) : { ok: false, delivered: false, error: 'disabled' }; };
    const i = getImpl();
    if (i && typeof i[prop] === 'function') return i[prop];
    return disabled(String(prop));
  }
});
