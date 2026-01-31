const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function initDatabase() {
    try {
        console.log('Initializing database...');

        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        await pool.query(schema);

        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database initialization failed:', err);
        throw err;
    }
}

module.exports = { initDatabase };

// Run directly if called from command line
if (require.main === module) {
    initDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}