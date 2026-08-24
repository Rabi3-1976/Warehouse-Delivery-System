// database/migrations/001_initial_schema.js
module.exports = {
    up: async (pool) => {
        console.log('📦 Creating initial warehouse schema...');
        
        // Users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'staff',
                full_name VARCHAR(200),
                email VARCHAR(200),
                phone VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Suppliers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                contact_person VARCHAR(200),
                phone VARCHAR(50),
                email VARCHAR(200),
                address TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Products table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                sku VARCHAR(100) UNIQUE NOT NULL,
                barcode VARCHAR(100),
                description TEXT,
                unit VARCHAR(50) DEFAULT 'pcs',
                weight DECIMAL(10,2),
                dimensions VARCHAR(100),
                min_stock INTEGER DEFAULT 0,
                max_stock INTEGER DEFAULT 9999,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

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
                zone_id INTEGER REFERENCES warehouse_zones(id),
                aisle VARCHAR(50),
                rack VARCHAR(50),
                shelf VARCHAR(50),
                bin VARCHAR(50),
                barcode VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(zone_id, aisle, rack, shelf, bin)
            )
        `);

        // Inventory table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id),
                location_id INTEGER REFERENCES warehouse_locations(id),
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

        // Inbound orders
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inbound_orders (
                id SERIAL PRIMARY KEY,
                order_number VARCHAR(50) UNIQUE NOT NULL,
                supplier_id INTEGER REFERENCES suppliers(id),
                expected_date DATE,
                received_date DATE,
                status VARCHAR(50) DEFAULT 'pending',
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Inbound items
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inbound_items (
                id SERIAL PRIMARY KEY,
                inbound_order_id INTEGER REFERENCES inbound_orders(id),
                product_id INTEGER REFERENCES products(id),
                expected_quantity INTEGER NOT NULL,
                received_quantity INTEGER DEFAULT 0,
                unit_cost DECIMAL(10,2),
                total_cost DECIMAL(10,2),
                location_id INTEGER REFERENCES warehouse_locations(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Outbound orders
        await pool.query(`
            CREATE TABLE IF NOT EXISTS outbound_orders (
                id SERIAL PRIMARY KEY,
                order_number VARCHAR(50) UNIQUE NOT NULL,
                customer_name VARCHAR(200),
                customer_phone VARCHAR(50),
                customer_address TEXT,
                priority VARCHAR(50) DEFAULT 'normal',
                status VARCHAR(50) DEFAULT 'pending',
                shipping_date DATE,
                delivery_date DATE,
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Outbound items
        await pool.query(`
            CREATE TABLE IF NOT EXISTS outbound_items (
                id SERIAL PRIMARY KEY,
                outbound_order_id INTEGER REFERENCES outbound_orders(id),
                product_id INTEGER REFERENCES products(id),
                quantity INTEGER NOT NULL,
                picked_quantity INTEGER DEFAULT 0,
                unit_price DECIMAL(10,2),
                total_price DECIMAL(10,2),
                location_id INTEGER REFERENCES warehouse_locations(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Delivery drivers
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

        // Delivery routes
        await pool.query(`
            CREATE TABLE IF NOT EXISTS delivery_routes (
                id SERIAL PRIMARY KEY,
                driver_id INTEGER REFERENCES drivers(id),
                outbound_order_id INTEGER REFERENCES outbound_orders(id),
                route_date DATE,
                estimated_duration INTEGER,
                actual_duration INTEGER,
                status VARCHAR(50) DEFAULT 'scheduled',
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Delivery stops
        await pool.query(`
            CREATE TABLE IF NOT EXISTS delivery_stops (
                id SERIAL PRIMARY KEY,
                delivery_route_id INTEGER REFERENCES delivery_routes(id),
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

        // Inventory transactions history
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory_transactions (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id),
                location_id INTEGER REFERENCES warehouse_locations(id),
                transaction_type VARCHAR(50),
                quantity INTEGER,
                reference_type VARCHAR(50),
                reference_id INTEGER,
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('✅ Initial warehouse schema created');
    },
    down: async (pool) => {
        console.log('⬇️ Dropping warehouse schema...');
        const tables = [
            'delivery_stops', 'delivery_routes', 'drivers',
            'outbound_items', 'outbound_orders', 'inbound_items',
            'inbound_orders', 'inventory_transactions', 'inventory',
            'warehouse_locations', 'warehouse_zones', 'products',
            'suppliers', 'users'
        ];
        for (const table of tables) {
            await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        }
        console.log('✅ Warehouse schema dropped');
    }
};