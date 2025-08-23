// utils/cleanupCodes.js
const { VerificationCode } = require('../models');
const { Op } = require('sequelize');

async function cleanupExpiredCodes() {
  const result = await VerificationCode.destroy({
    where: {
      expiresAt: { [Op.lt]: new Date() }
    }
  });

  if (result > 0) {
    console.log(`[CRON] 🧹 Removidos ${result} códigos expirados`);
  }
}

module.exports = cleanupExpiredCodes;
