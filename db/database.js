const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure database directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

function getDatabase(customPath = null) {
  if (db && !customPath) {
    return db;
  }

  const targetPath = customPath || config.dbPath;
  const instance = new Database(targetPath, {
    // verbose: config.nodeEnv === 'development' ? console.log : null,
    timeout: 10000 // 10s wait for lock in concurrency
  });

  // Enable WAL mode for high concurrency read/writes
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  instance.pragma('synchronous = NORMAL');
  instance.pragma('busy_timeout = 10000');

  if (!customPath) {
    db = instance;
  }
  return instance;
}

function closeDatabase() {
  if (db) {
    try {
      db.close();
    } catch (e) {
      // ignore
    }
    db = null;
  }
}

module.exports = {
  getDatabase,
  closeDatabase
};
