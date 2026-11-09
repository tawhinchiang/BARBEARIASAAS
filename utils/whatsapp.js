const WHATSAPP_ENABLED_ENV = process.env.WHATSAPP_ENABLED !== 'false';
const PROVIDER = String(process.env.WHATSAPP_PROVIDER || 'wwebjs').toLowerCase();
const CLOUD_TOKEN = process.env.WHATSAPP_TOKEN || process.env.META_WHATSAPP_TOKEN || '';
const CLOUD_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || '';
const CLOUD_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const DEFAULT_COUNTRY_CODE = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '55').replace(/\D/g, '') || '55';

const isCloudConfigured = () => PROVIDER === 'cloud' || PROVIDER === 'meta' || PROVIDER === 'cloudapi' || (!!CLOUD_TOKEN && !!CLOUD_PHONE_NUMBER_ID && PROVIDER !== 'wwebjs');
const useCloud = () => isCloudConfigured() && !!CLOUD_TOKEN && !!CLOUD_PHONE_NUMBER_ID && process.env.WHATSAPP_ENABLED !== 'false';

function noopStatus() {
  if (useCloud()) return { isEnabled: true, isConnected: true, state: 'CONNECTED', qrCode: null, provider: 'cloud' };
  return { isEnabled: false, isConnected: false, state: 'DISABLED', qrCode: null, provider: PROVIDER };
}

function normalizeCloudPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  // BR common cases: DDD+8/9 digits (10-11) => prefix country code
  if (digits.length === 10 || digits.length === 11) digits = DEFAULT_COUNTRY_CODE + digits;
  // If someone passed 55 + DDD + 8 (missing 9th digit) keep as-is; Cloud API may still deliver depending on number.
  return digits;
}

async function sendCloudMessage(phone, message) {
  if (!CLOUD_TOKEN || !CLOUD_PHONE_NUMBER_ID) {
    return { ok: false, delivered: false, error: 'cloud-misconfigured' };
  }
  const to = normalizeCloudPhone(phone);
  if (!to) return { ok: false, delivered: false, error: 'invalid-phone' };
  const url = `https://graph.facebook.com/${CLOUD_API_VERSION}/${CLOUD_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: String(message || '') }
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUD_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.error?.message || data?.error?.error_user_msg || `HTTP ${res.status}`;
      console.error('[WHATSAPP CLOUD] Falha no envio:', res.status, errMsg);
      return { ok: false, delivered: false, error: errMsg, provider: 'cloud', status: res.status, details: data?.error };
    }
    const messageId = data?.messages?.[0]?.id || null;
    console.log('[WHATSAPP CLOUD] Mensagem aceita pela API.', { to, messageId });
    return { ok: true, delivered: true, provider: 'cloud', messageId, to };
  } catch (err) {
    console.error('[WHATSAPP CLOUD] Erro de rede:', err?.message || err);
    return { ok: false, delivered: false, error: String(err?.message || err), provider: 'cloud' };
  }
}

function createCloudImpl() {
  const configured = !!CLOUD_TOKEN && !!CLOUD_PHONE_NUMBER_ID;
  const status = () => ({
    isEnabled: configured,
    isConnected: configured,
    state: configured ? 'CONNECTED' : 'MISCONFIGURED',
    qrCode: null,
    provider: 'cloud',
    phoneNumberId: configured ? String(CLOUD_PHONE_NUMBER_ID).slice(0, 4) + '…' : null
  });
  return {
    initializeWhatsApp: async () => {
      if (!configured) console.warn('[WHATSAPP CLOUD] WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID ausente.');
      else console.log('[WHATSAPP CLOUD] Provider configurado (Graph API).');
      return status();
    },
    sendWhatsAppMessage: async (phone, message) => sendCloudMessage(phone, message),
    sendWhatsAppMessageDebug: async (phone, message) => sendCloudMessage(phone, message),
    getWhatsAppStatus: () => status(),
    getLastQRCode: () => null,
    disconnectWhatsApp: async () => undefined,
    isWhatsAppEnabled: () => configured,
    isWhatsAppReady: () => configured,
    waitWhatsAppReady: async () => configured
  };
}

let wwebjsImpl = null;
let wwebjsTried = false;

function getWWebImpl() {
  if (!WHATSAPP_ENABLED_ENV) return null;
  if (wwebjsImpl) return wwebjsImpl;
  if (wwebjsTried) return null;
  wwebjsTried = true;

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
        if (!client) return { ok: false, delivered: false, error: 'not-initialized', provider: 'wwebjs' };
        if (!isReady) return { ok: false, delivered: false, error: 'not-ready', provider: 'wwebjs' };
        await ensureClientReady();
        const cleaned = cleanPhone(phone);
        const numberId = await findWhatsAppContactId(client, cleaned);
        if (!numberId) return { ok: false, delivered: false, error: 'not-registered', provider: 'wwebjs' };
        const jid = numberId._serialized || numberId;
        const msgObj = await sendMessageWithTimeout(jid, message, TIMEOUTS.send);
        const ackInfo = await waitForAck(msgObj);
        const ackCode = toAckCode(msgObj, ackInfo);
        const delivered = !!(ackInfo?.delivered || ackCode >= ACK_SUCCESS_LEVEL);
        return { ok: true, delivered, ack: ackCode, used: jid, provider: 'wwebjs' };
      } catch (err) {
        return { ok: false, delivered: false, error: String(err?.message || err), provider: 'wwebjs' };
      }
    }

    async function sendWhatsAppMessageDebug(phone, message) {
      if (DEBUG) console.log('[WHATSAPP DEBUG]', phone);
      return sendWhatsAppMessage(phone, message);
    }

    function getWhatsAppStatus() {
      return { isEnabled: true, isConnected: isReady, state: isReady ? 'CONNECTED' : (initializing ? 'OPENING' : 'DISCONNECTED'), qrCode: isReady ? null : latestQrCode, provider: 'wwebjs' };
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

    wwebjsImpl = {
      initializeWhatsApp, sendWhatsAppMessage, sendWhatsAppMessageDebug, getWhatsAppStatus,
      getLastQRCode, disconnectWhatsApp, isWhatsAppEnabled, isWhatsAppReady, waitWhatsAppReady
    };
    return wwebjsImpl;
  } catch (err) {
    console.warn('[WHATSAPP] Dependências do whatsapp-web.js indisponíveis. Provider wwebjs desativado.', err?.message || err);
    return null;
  }
}

function getImpl() {
  if (useCloud()) return createCloudImpl();
  // Provider explicitly set to cloud but missing credentials: report misconfiguration clearly.
  if ((PROVIDER === 'cloud' || PROVIDER === 'meta' || PROVIDER === 'cloudapi') && process.env.WHATSAPP_ENABLED !== 'false') {
    return createCloudImpl();
  }
  if (WHATSAPP_ENABLED_ENV) return getWWebImpl();
  return null;
}

module.exports = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'isWhatsAppEnabled') return () => { const i = getImpl(); return i ? i.isWhatsAppEnabled() : false; };
    if (prop === 'isWhatsAppReady') return () => { const i = getImpl(); return i ? i.isWhatsAppReady() : false; };
    if (prop === 'getWhatsAppStatus') return () => { const i = getImpl(); return i ? i.getWhatsAppStatus() : noopStatus(); };
    if (prop === 'getLastQRCode') return () => { const i = getImpl(); return i ? i.getLastQRCode() : null; };
    if (prop === 'waitWhatsAppReady') return async (ms) => { const i = getImpl(); return i ? i.waitWhatsAppReady(ms) : false; };
    if (prop === 'initializeWhatsApp') return async (...a) => { const i = getImpl(); return i ? i.initializeWhatsApp(...a) : undefined; };
    if (prop === 'disconnectWhatsApp') return async (...a) => { const i = getImpl(); return i ? i.disconnectWhatsApp(...a) : undefined; };
    if (prop === 'sendWhatsAppMessage') return async (...a) => { const i = getImpl(); return i ? i.sendWhatsAppMessage(...a) : { ok: false, delivered: false, error: 'disabled' }; };
    if (prop === 'sendWhatsAppMessageDebug') return async (...a) => { const i = getImpl(); return i ? i.sendWhatsAppMessageDebug(...a) : { ok: false, delivered: false, error: 'disabled' }; };
    const i = getImpl();
    if (i && typeof i[prop] === 'function') return i[prop].bind(i);
    return async () => undefined;
  }
});
