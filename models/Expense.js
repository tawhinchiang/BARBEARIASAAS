// models/Expense.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  cashSessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'cash_sessions', key: 'id' },
    onDelete: 'CASCADE'
  },

  description: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  method: {
    type: DataTypes.ENUM('cash', 'pix', 'card', 'other'),
    allowNull: false,
    defaultValue: 'cash'
  },
  createdByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'expenses',
  timestamps: true
});

module.exports = Expense;
