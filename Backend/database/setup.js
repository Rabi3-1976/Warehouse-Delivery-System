// database/setup.js
const pool = require('../database');
const fs = require('fs');
const path = require('path');

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

    // Get applied migrations
    const applied = await pool.query('SELECT migration_name FROM schema_migrations');
    const appliedNames = applied.rows.map(r => r.migration_name);

    // Get migration files
    const migrationsPath = path.join(__dirname, 'migrations');
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

async function seedDatabase() {
    console.log('🌱 Seeding database...');

    // Check if admin user exists
    const adminCheck = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminCheck.rowCount === 0) {
        const hashed = require('bcryptjs').hashSync('admin123', 10);
        await pool.query(`
            INSERT INTO users (username, password, role, full_name) 
            VALUES ('admin', $1, 'admin', 'System Administrator')
        `, [hashed]);
        console.log('✅ Admin user created (username: admin, password: admin123)');
    }

    // Check if warehouse zones exist
    const zonesCheck = await pool.query("SELECT * FROM warehouse_zones");
    if (zonesCheck.rowCount === 0) {
        const zones = [
            { name: 'Receiving Bay', code: 'R-001', description: 'Main receiving area' },
            { name: 'Storage A', code: 'S-A', description: 'General storage zone A' },
            { name: 'Storage B', code: 'S-B', description: 'General storage zone B' },
            { name: 'Packing Area', code: 'P-001', description: 'Order packing and preparation' },
            { name: 'Loading Dock', code: 'L-001', description: 'Shipping and loading area' }
        ];
        for (const zone of zones) {
            await pool.query(`
                INSERT INTO warehouse_zones (name, code, description) 
                VALUES ($1, $2, $3)
            `, [zone.name, zone.code, zone.description]);
        }
        console.log('✅ Warehouse zones created');
    }

    console.log('✅ Seeding completed');
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

// Run setup
setupDatabase();

module.exports = { runMigrations, seedDatabase };