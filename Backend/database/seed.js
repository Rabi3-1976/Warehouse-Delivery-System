// database/seed.js
const pool = require('../database');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
    console.log('🌱 Seeding database...');

    try {
        // Check if admin user exists
        const adminCheck = await pool.query("SELECT * FROM users WHERE username = 'admin'");
        
        if (adminCheck.rowCount === 0) {
            const hashed = bcrypt.hashSync('admin123', 10);
            await pool.query(`
                INSERT INTO users (username, password, role, full_name, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            `, ['admin', hashed, 'admin', 'System Administrator']);
            console.log('✅ Admin user created (username: admin, password: admin123)');
        } else {
            console.log('ℹ️ Admin user already exists');
        }

        console.log('✅ Seeding completed');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    seedDatabase()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { seedDatabase };