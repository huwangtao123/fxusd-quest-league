const { Pool } = require('pg');
require('dotenv').config();

// Railway sets DATABASE_URL automatically
// SSL is required for Railway PostgreSQL
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isRailway || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};