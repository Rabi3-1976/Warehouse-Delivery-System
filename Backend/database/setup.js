// database/setup.js
const pool = require('../database');
const fs = require('fs');
const path = require('path');
const { seedDatabase } = require('./seed');

async function runMigrations() {
    console.log('📦 Running database migrations...');
    
    // Create schema_migrations table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(100) UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT NOW()
        )
    `);

    const applied = await pool.query('SELECT migration_name FROM schema_migrations');
    const appliedNames = applied.rows.map(r => r.migration_name);

    const migrationsPath = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsPath)) {
        fs.mkdirSync(migrationsPath, { recursive: true });
    }
    const files = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.js')).sort();

    for (const file of files) {
        if (appliedNames.includes(file)) {
            console.log(`⏭️ Migration ${file} already applied`);
            continue;
        }

        console.log(`🔄 Applying migration ${file}...`);
        const migration = require(path.join(migrationsPath, file));
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await migration.up(client);
            await client.query(
                'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
                [file]
            );
            await client.query('COMMIT');
            console.log(`✅ Migration ${file} applied successfully`);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ Migration ${file} failed:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    console.log('✅ All migrations completed');
}

async function setupDatabase() {
    try {
        console.log('🏗️ Setting up Warehouse & Delivery System database...');
        await runMigrations();
        await seedDatabase();
        console.log('✅ Database setup completed!');
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { runMigrations, seedDatabase, setupDatabase };