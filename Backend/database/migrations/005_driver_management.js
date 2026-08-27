// 005_driver_management.js
module.exports = {
    up: async (pool) => {
        console.log('📦 Creating driver management tables...');

        // Drivers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS drivers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                phone VARCHAR(50),
                license_number VARCHAR(100),
                vehicle_type VARCHAR(50),
                vehicle_plate VARCHAR(50),
                max_capacity INTEGER,
                status VARCHAR(50) DEFAULT 'available',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('✅ Driver management tables created');
    },
    down: async (pool) => {
        console.log('⬇️ Dropping driver management tables...');
        await pool.query(`DROP TABLE IF EXISTS drivers CASCADE`);
        console.log('✅ Dropped');
    }
};