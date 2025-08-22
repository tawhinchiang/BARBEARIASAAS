const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,

    pool: {
      max: 5,            
      min: 0,
      acquire: 20000,    
      idle: 10000,      
      evict: 10000       
    },

    dialectOptions: {
      keepAlive: true,
      statement_timeout: 15000,                 
      idle_in_transaction_session_timeout: 15000 
    },

    retry: { max: 2 }   
  }
);
console.log('[DB-CONNECT]', {
  NODE_ENV: process.env.NODE_ENV,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER
});

module.exports = sequelize;