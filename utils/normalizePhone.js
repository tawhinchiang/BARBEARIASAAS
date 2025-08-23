/**
 * Versão corrigida da função normalizePhone
 * 
 * IMPORTANTE: Esta função agora apenas limpa o número para armazenamento no banco.
 * Para envio via WhatsApp, use sempre o smartPhoneFormatter.js
 */

const { cleanPhone } = require('./smartphoneformatter');
/**
 * Normaliza um número de telefone brasileiro para armazenamento no banco de dados
 * 
 * Esta função apenas limpa o número, removendo caracteres especiais e o código do país.
 * NÃO aplica mais regras de formatação que podem causar problemas no WhatsApp.
 * 
 * @param {string} phone - Número de telefone em qualquer formato
 * @returns {string} - Número limpo para armazenamento (apenas dígitos, sem código do país)
 */
module.exports = function normalizePhone(phone) {
  console.log(`[NORMALIZE_PHONE] Input: ${phone}`);
  
  const cleaned = cleanPhone(phone);
  
  console.log(`[NORMALIZE_PHONE] Output: ${cleaned}`);
  
  // Retorna apenas o número limpo, sem aplicar regras de formatação
  // que podem causar problemas no WhatsApp
  return cleaned;
};

