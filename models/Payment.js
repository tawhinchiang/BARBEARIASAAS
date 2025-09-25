// models/Payment.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  appointmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'appointments', key: 'id' },
    onDelete: 'CASCADE'
  },

  method: {
    type: DataTypes.ENUM('cash', 'credit_card', 'debit_card', 'pix', 'voucher', 'other'),
    allowNull: false
  },

  amount: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  },

  transactionFee: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  receivedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // 👇 aqui está a ligação com o caixa
  cashSessionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'cashSessionId', // força o Sequelize a usar o mesmo nome que está no banco
    references: { model: 'cash_sessions', key: 'id' }
  }

}, {
  tableName: 'payments',
  timestamps: true
});

module.exports = Payment;
