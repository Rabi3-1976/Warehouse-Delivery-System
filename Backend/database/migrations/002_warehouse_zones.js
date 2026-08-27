// 002_warehouse_zones.js
module.exports = {
    up: async (pool) => {
        console.log('📦 Creating warehouse zones and locations...');

        // Warehouse zones
        await pool.query(`
            CREATE TABLE IF NOT EXISTS warehouse_zones (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(50) UNIQUE NOT NULL,
                description TEXT,
                location VARCHAR(100),
                capacity INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Warehouse locations (rack/bin)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS warehouse_locations (
                id SERIAL PRIMARY KEY,
                zone_id INTEGER REFERENCES warehouse_zones(id) ON DELETE CASCADE,
                aisle VARCHAR(50),
                rack VARCHAR(50),
                shelf VARCHAR(50),
                bin VARCHAR(50),
                barcode VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(zone_id, aisle, rack, shelf, bin)
            )
        `);

        console.log('✅ Warehouse zones and locations created');
    },
    down: async (pool) => {
        console.log('⬇️ Dropping warehouse zones and locations...');
        await pool.query(`DROP TABLE IF EXISTS warehouse_locations CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS warehouse_zones CASCADE`);
        console.log('✅ Dropped');
    }
};