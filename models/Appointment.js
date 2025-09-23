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
    allowNull: true,
    references: { model: 'clients', key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  }, isBlock: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  blockReason: {
    type: DataTypes.STRING,
    allowNull: true
  },
  barberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'barbers', key: 'id' },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  },
  serviceTypeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'service_types', key: 'id' },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  },
  reminderSent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indica se o lembrete prévio foi enviado (ACK ≥ 2)'
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
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 20,
    validate: {
      min: 1,
      max: 8 * 60
    }
  },

  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show','blocked'),
    defaultValue: 'pending',
  },
  paymentStatus: {
  type: DataTypes.ENUM('pending', 'partial', 'paid'),
  allowNull: false,
  defaultValue: 'pending'
},

  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  whatsappSent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
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
  isEncaixe: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }, fitInNote: {
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
      name: 'uq_appointments_regular_slot',
      unique: true,
      fields: ['barberId', 'appointmentDate', 'appointmentTime'],
      where: { isEncaixe: false, status: { [sequelize.Sequelize.Op.notIn]: ['cancelled', 'no_show'] },
      isBlock: false }
      
    },
    {
      name: 'idx_appointments_barber_date',
      fields: ['barberId', 'appointmentDate']
    },
    {
      name: 'idx_appointments_status',
      fields: ['status']
    }
  ]
});

module.exports = Appointment;

