const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'clients',
      key: 'id'
    }
  },
  barberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'barbers',
      key: 'id'
    }
  },
  serviceTypeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'service_types',
      key: 'id'
    }
  },
  appointmentDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  appointmentTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  serviceDuration: {
  type: DataTypes.INTEGER, // duração em minutos
  allowNull: false,
  defaultValue: 20
},

  status: {
  type: DataTypes.ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'),
  defaultValue: 'pending',
},

  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  whatsappSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }, 
  followUpSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  cancelReason: {
  type: DataTypes.STRING,
  allowNull: true
},
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  }
}, {
  tableName: 'appointments',
  timestamps: true,
  indexes: [
    {
      fields: ['appointmentDate', 'appointmentTime', 'barberId'],
      unique: true
    }
  ]
});

module.exports = Appointment;

