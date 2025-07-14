// utils/normalizePhone.js
module.exports = function normalizePhone(phone) {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('55') && clean.length > 11) {
    clean = clean.slice(2);
  }
  return clean;
};