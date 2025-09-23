// models/CashSession.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CashSession = sequelize.define('CashSession', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  openedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  openedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  openingAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },

  closedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  closedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  countedCash: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  status: {
    type: DataTypes.ENUM('open', 'closed'),
    allowNull: false,
    defaultValue: 'open'
  }
}, {
  tableName: 'cash_sessions',
  timestamps: true
});

module.exports = CashSession;
