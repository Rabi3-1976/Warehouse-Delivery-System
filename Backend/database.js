// database.js
const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test connection
pool.on('connect', () => {
    console.log('✅ PostgreSQL connected successfully');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL connection error:', err);
});

// Initialize database
async function initDatabase() {
    try {
        const client = await pool.connect();
        console.log('📦 Database connection established');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        return false;
    }
}

// Setup function to run migrations
async function setupDatabase() {
    try {
        const { setupDatabase } = require('./database/setup');
        await setupDatabase();
        console.log('✅ Database setup completed');
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        throw error;
    }
}

// Export pool and functions
module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
    initDatabase,
    setupDatabase,
    databaseReady: initDatabase(),
};