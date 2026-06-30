const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const schemaPath = path.resolve(__dirname, '..', 'database', 'schema-from-backup.sql');

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let singleQuote = false;
  let doubleQuote = false;
  let lineComment = false;
  let blockComment = false;
  let dollarQuoteTag = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      current += char;
      if (char === '\n') {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (dollarQuoteTag) {
      current += char;
      if (sql.startsWith(dollarQuoteTag, index)) {
        current += dollarQuoteTag.slice(1);
        index += dollarQuoteTag.length - 1;
        dollarQuoteTag = null;
      }
      continue;
    }

    if (!singleQuote && !doubleQuote && char === '-' && next === '-') {
      current += char + next;
      index += 1;
      lineComment = true;
      continue;
    }

    if (!singleQuote && !doubleQuote && char === '/' && next === '*') {
      current += char + next;
      index += 1;
      blockComment = true;
      continue;
    }

    if (!singleQuote && !doubleQuote && char === '$') {
      const match = sql.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarQuoteTag = match[0];
        current += dollarQuoteTag;
        index += dollarQuoteTag.length - 1;
        continue;
      }
    }

    if (!doubleQuote && char === "'" && sql[index - 1] !== '\\') {
      singleQuote = !singleQuote;
      current += char;
      continue;
    }

    if (!singleQuote && char === '"') {
      doubleQuote = !doubleQuote;
      current += char;
      continue;
    }

    if (!singleQuote && !doubleQuote && char === ';') {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

async function applySchema() {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 6543),
    database: process.env.DB_NAME || 'barbeariadoblack_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  const sql = fs.readFileSync(schemaPath, 'utf8');
  const statements = splitSqlStatements(sql);

  await client.connect();

  try {
    for (const statement of statements) {
      await client.query(statement);
    }
  } finally {
    await client.end();
  }

  console.log(`Schema applied from ${path.relative(process.cwd(), schemaPath)}.`);
  console.log(`Statements executed: ${statements.length}.`);
}

if (require.main === module) {
  applySchema().catch((error) => {
    console.error('Failed to apply schema:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  applySchema,
  splitSqlStatements
};
