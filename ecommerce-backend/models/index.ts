import { Sequelize } from 'sequelize';
import sqlJsAsSqlite3 from 'sql.js-as-sqlite3';
import fs from 'fs';

function connectToPostgres(databaseUrl: string) {
  // A Postgres on this machine, like the one the tests run against in CI, has no SSL
  const isLocal = ['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname);
  return new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
      // Supabase signs its certificate with its own CA, which Node doesn't trust by default
      ssl: isLocal ? false : { require: true, rejectUnauthorized: false }
    },
    logging: false
  });
}

function openSqlite() {
  const db = new Sequelize({
    dialect: 'sqlite',
    dialectModule: sqlJsAsSqlite3,
    logging: false
  });

  // Save database to file after write operations.
  db.addHook('afterCreate', saveDatabaseToFile);
  db.addHook('afterDestroy', saveDatabaseToFile);
  db.addHook('afterUpdate', saveDatabaseToFile);
  db.addHook('afterSave', saveDatabaseToFile);
  db.addHook('afterUpsert', saveDatabaseToFile);
  db.addHook('afterBulkCreate', saveDatabaseToFile);
  db.addHook('afterBulkDestroy', saveDatabaseToFile);
  db.addHook('afterBulkUpdate', saveDatabaseToFile);
  return db;
}

export const sequelize = process.env.DATABASE_URL ? connectToPostgres(process.env.DATABASE_URL) : openSqlite();

// The connection sql.js-as-sqlite3 hands out, which wraps the in-memory sql.js database
interface SqlJsConnection {
  database: { export(): Uint8Array };
}

async function saveDatabaseToFile() {
  const dbInstance = await sequelize.connectionManager.getConnection({ type: 'write' }) as unknown as SqlJsConnection;
  const binaryArray = dbInstance.database.export();
  const buffer = Buffer.from(binaryArray);
  fs.writeFileSync('database.sqlite', buffer);
}
