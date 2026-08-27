// 003_inventory_tracking.js
module.exports = {
    up: async (pool) => {
        console.log('📦 Creating inventory tracking tables...');

        // Inventory table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL,
                quantity INTEGER DEFAULT 0,
                reserved_quantity INTEGER DEFAULT 0,
                min_stock INTEGER DEFAULT 0,
                max_stock INTEGER DEFAULT 9999,
                last_counted_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(product_id, location_id)
            )
        `);

        // Inventory transactions history
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory_transactions (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL,
                transaction_type VARCHAR(50),
                quantity INTEGER,
                reference_type VARCHAR(50),
                reference_id INTEGER,
                notes TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('✅ Inventory tracking tables created');
    },
    down: async (pool) => {
        console.log('⬇️ Dropping inventory tracking tables...');
        await pool.query(`DROP TABLE IF EXISTS inventory_transactions CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS inventory CASCADE`);
        console.log('✅ Dropped');
    }
};