const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // ✅ Certifique-se que essa linha exista

const Barber = sequelize.define('Barber', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  cpf: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  specialties: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  workingHours: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      monday: '08:00-18:00',
      tuesday: '08:00-18:00',
      wednesday: '08:00-18:00',
      thursday: '08:00-18:00',
      friday: '08:00-18:00',
      saturday: '08:00-16:00',
      sunday: 'closed'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  photo: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'barbers',
  timestamps: true
});

module.exports = Barber;
