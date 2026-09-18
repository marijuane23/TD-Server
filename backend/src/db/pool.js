import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

const poolOptions = config.databaseUrl
  ? {
      uri: config.databaseUrl,
      waitForConnections: config.db.waitForConnections,
      connectionLimit: config.db.connectionLimit,
      queueLimit: config.db.queueLimit,
      multipleStatements: config.db.multipleStatements,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      ssl: config.db.ssl,
    }
  : {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: config.db.waitForConnections,
      connectionLimit: config.db.connectionLimit,
      queueLimit: config.db.queueLimit,
      multipleStatements: config.db.multipleStatements,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      ssl: config.db.ssl,
    };

export const pool = mysql.createPool(poolOptions);

export default pool;
