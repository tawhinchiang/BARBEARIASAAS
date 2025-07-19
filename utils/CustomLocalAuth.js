// utils/CustomLocalAuth.js
const { LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

class SafeLocalAuth extends LocalAuth {
  async logout() {
    console.warn('⚠️ SafeLocalAuth.logout() bloqueado para evitar EBUSY');
    // Ignora logout para evitar o erro
    return;
  }
}

module.exports = SafeLocalAuth;
