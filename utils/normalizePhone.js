module.exports = function normalizePhone(phone) {
  let clean = phone.replace(/\D/g, '');

  // Remover o 9 após o DDD, se houver 11 dígitos (ex: 63992014547 → 6392014547)
  if (clean.length === 11 && clean[2] === '9') {
    clean = clean.slice(0, 2) + clean.slice(3);
  }

  // Remover o 55 do início (caso tenha)
  if (clean.startsWith('55') && clean.length > 10) {
    clean = clean.slice(2);
  }

  return clean;
};
