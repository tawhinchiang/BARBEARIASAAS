const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ServiceType = sequelize.define('ServiceType', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Duração em minutos'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isPromo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }, photo: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL ou caminho da foto do serviço'
  }
},
 {
  tableName: 'service_types',
  timestamps: true
});


module.exports = ServiceType;

