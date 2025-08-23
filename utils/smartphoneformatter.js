/**
 * Formatador inteligente de números de telefone brasileiros para WhatsApp
 * 
 * Esta função resolve o problema crítico de formatação de números brasileiros
 * onde alguns números foram registrados com o 9º dígito e outros sem.
 * 
 * Baseado na melhor prática identificada na issue #1967 do whatsapp-web.js:
 * https://github.com/pedroslopez/whatsapp-web.js/issues/1967
 */

/**
 * Limpa e normaliza um número de telefone brasileiro
 * @param {string} phone - Número de telefone em qualquer formato
 * @returns {string} - Número limpo com apenas dígitos
 */
function cleanPhone(phone) {
  if (!phone) return '';
  
  // Remove todos os caracteres não numéricos
  let clean = phone.replace(/\D/g, '');
  
  // Remove código do país 55 se presente
  if (clean.startsWith('55') && clean.length > 10) {
    clean = clean.slice(2);
  }
  
  return clean;
}

/**
 * Gera as possíveis variações de um número brasileiro
 * @param {string} cleanNumber - Número limpo (apenas dígitos)
 * @returns {Array<string>} - Array com as variações possíveis no formato internacional
 */
function generatePhoneVariations(cleanNumber) {
  const variations = [];
  
  if (cleanNumber.length === 10) {
    // Número com 10 dígitos (formato antigo)
    // Adiciona versão com 9 e sem 9
    variations.push(`55${cleanNumber}`); // Sem 9
    variations.push(`55${cleanNumber.slice(0, 2)}9${cleanNumber.slice(2)}`); // Com 9
  } else if (cleanNumber.length === 11) {
    // Número com 11 dígitos
    const ddd = cleanNumber.slice(0, 2);
    const number = cleanNumber.slice(2);
    
    if (number.startsWith('9')) {
      // Se já tem 9, tenta com e sem
      variations.push(`55${cleanNumber}`); // Com 9
      variations.push(`55${ddd}${number.slice(1)}`); // Sem 9
    } else {
      // Se não tem 9, tenta sem e com
      variations.push(`55${cleanNumber}`); // Sem 9 (mas isso seria 11 dígitos sem 9, estranho)
      variations.push(`55${ddd}9${number}`); // Com 9 (resultaria em 12 dígitos, inválido)
    }
  } else if (cleanNumber.length === 9) {
    // Número sem DDD, assume DDD padrão (isso não deveria acontecer no sistema)
    console.warn('Número sem DDD detectado:', cleanNumber);
    return variations;
  }
  
  // Remove duplicatas e números inválidos
  return [...new Set(variations)].filter(num => {
    const withoutCountry = num.slice(2);
    return withoutCountry.length === 10 || withoutCountry.length === 11;
  });
}

/**
 * Encontra o ID correto do WhatsApp para um número brasileiro
 * @param {Object} client - Cliente WhatsApp (whatsapp-web.js)
 * @param {string} phone - Número de telefone em qualquer formato
 * @returns {Promise<Object|null>} - Objeto ContactId ou null se não encontrado
 */
async function findWhatsAppContactId(client, phone) {
  try {
    if (!client) {
      console.error('[SMART_FORMATTER] Cliente WhatsApp não fornecido');
      return null;
    }
    
    const cleanNumber = cleanPhone(phone);
    if (!cleanNumber) {
      console.error('[SMART_FORMATTER] Número inválido:', phone);
      return null;
    }
    
    console.log(`[SMART_FORMATTER] Buscando ID para: ${phone} (limpo: ${cleanNumber})`);
    
    const variations = generatePhoneVariations(cleanNumber);
    console.log(`[SMART_FORMATTER] Testando variações:`, variations);
    
    // Testa cada variação até encontrar uma válida
    for (const variation of variations) {
      try {
        console.log(`[SMART_FORMATTER] Testando: ${variation}`);
        const contactId = await client.getNumberId(variation);
        
        if (contactId) {
          console.log(`[SMART_FORMATTER] ✅ Encontrado ID válido: ${contactId._serialized}`);
          return contactId;
        }
      } catch (error) {
        console.log(`[SMART_FORMATTER] ❌ Erro ao testar ${variation}:`, error.message);
        continue;
      }
    }
    
    console.warn(`[SMART_FORMATTER] ⚠️ Nenhuma variação válida encontrada para: ${phone}`);
    return null;
    
  } catch (error) {
    console.error('[SMART_FORMATTER] Erro geral:', error);
    return null;
  }
}

/**
 * Formata um número brasileiro para envio via WhatsApp
 * Esta é a função principal que deve ser usada no lugar das antigas
 * @param {Object} client - Cliente WhatsApp (whatsapp-web.js)
 * @param {string} phone - Número de telefone em qualquer formato
 * @returns {Promise<string|null>} - Número formatado para WhatsApp ou null se inválido
 */
async function formatBrazilianPhoneForWhatsApp(client, phone) {
  try {
    const contactId = await findWhatsAppContactId(client, phone);
    
    if (contactId) {
      // Retorna o número no formato correto para envio
      return contactId._serialized;
    }
    
    return null;
  } catch (error) {
    console.error('[SMART_FORMATTER] Erro ao formatar número:', error);
    return null;
  }
}

/**
 * Versão síncrona para compatibilidade (usa as regras antigas como fallback)
 * ATENÇÃO: Esta função não é recomendada, use a versão assíncrona sempre que possível
 * @param {string} phone - Número de telefone
 * @returns {string} - Número formatado (pode estar incorreto)
 */
function formatBrazilianPhoneSync(phone) {
  console.warn('[SMART_FORMATTER] ⚠️ Usando formatação síncrona (não recomendada)');
  
  const clean = cleanPhone(phone);
  if (!clean) return null;
  
  // Aplica regra básica como fallback
  if (clean.length === 10) {
    return `55${clean}`;
  } else if (clean.length === 11) {
    return `55${clean}`;
  }
  
  return null;
}

module.exports = {
  cleanPhone,
  generatePhoneVariations,
  findWhatsAppContactId,
  formatBrazilianPhoneForWhatsApp,
  formatBrazilianPhoneSync
};

