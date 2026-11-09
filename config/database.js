const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const dialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase();

let sequelize;

if (dialect === 'sqlite') {
  const storage = process.env.SQLITE_STORAGE || path.join(__dirname, '..', 'data', 'database.sqlite');
  fs.mkdirSync(path.dirname(storage), { recursive: true });
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  });
  console.log('[DB-CONNECT]', { dialect: 'sqlite', storage });
} else {
  const database = process.env.DB_NAME || 'barbeariadoblack_db';
  const username = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || 6543;

  sequelize = new Sequelize(database, username, password, {
    host,
    port,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 20000,
      idle: 10000,
      evict: 10000,
    },
    dialectOptions: {
      keepAlive: true,
      statement_timeout: 15000,
      idle_in_transaction_session_timeout: 15000,
    },
    retry: { max: 2 },
  });

  console.log('[DB-CONNECT]', {
    NODE_ENV: process.env.NODE_ENV,
    DB_DIALECT: 'postgres',
    DB_HOST: host,
    DB_NAME: database,
    DB_USER: username,
  });
}

module.exports = sequelize;
