const { Sequelize } = require('sequelize');
require('dotenv').config();

const database = process.env.DB_NAME || 'barbeariadoblack_db';
const username = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD || 'postgres';
const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 6543;

const sequelize = new Sequelize(
  database,
  username,
  password,
  {
    host,
    port,
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
  DB_HOST: host,
  DB_NAME: database,
  DB_USER: username
});

module.exports = sequelize;
