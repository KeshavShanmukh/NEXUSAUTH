const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./database');

function runMigrations(dbInstance = null) {
  const db = dbInstance || getDatabase();
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // SQLite exec can execute multiple statements
  db.exec(schemaSql);
  return true;
}

if (require.main === module) {
  console.log('Running database migrations...');
  runMigrations();
  console.log('Database migrations completed successfully.');
}

module.exports = { runMigrations };
