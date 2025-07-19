// utils/whatsapp-status.js
let whatsappReady = false;
let latestQr = null;

module.exports = {
  setReady: (ready) => whatsappReady = ready,
  isReady: () => whatsappReady,
  setQr: (qr) => latestQr = qr,
  getQr: () => latestQr
};