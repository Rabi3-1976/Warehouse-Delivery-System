// 004_delivery_management.js
module.exports = {
    up: async (pool) => {
        console.log('📦 Creating delivery management tables...');

        // Delivery routes
        await pool.query(`
            CREATE TABLE IF NOT EXISTS delivery_routes (
                id SERIAL PRIMARY KEY,
                driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
                outbound_order_id INTEGER REFERENCES outbound_orders(id) ON DELETE CASCADE,
                route_date DATE,
                estimated_duration INTEGER,
                actual_duration INTEGER,
                status VARCHAR(50) DEFAULT 'scheduled',
                notes TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Delivery stops
        await pool.query(`
            CREATE TABLE IF NOT EXISTS delivery_stops (
                id SERIAL PRIMARY KEY,
                delivery_route_id INTEGER REFERENCES delivery_routes(id) ON DELETE CASCADE,
                stop_order INTEGER,
                address TEXT,
                customer_name VARCHAR(200),
                customer_phone VARCHAR(50),
                status VARCHAR(50) DEFAULT 'pending',
                signature BYTEA,
                notes TEXT,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('✅ Delivery management tables created');
    },
    down: async (pool) => {
        console.log('⬇️ Dropping delivery management tables...');
        await pool.query(`DROP TABLE IF EXISTS delivery_stops CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS delivery_routes CASCADE`);
        console.log('✅ Dropped');
    }
};