const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VerificationCode = sequelize.define('VerificationCode', {
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(4),
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  }
}, {
  timestamps: true
});

module.exports = VerificationCode;
