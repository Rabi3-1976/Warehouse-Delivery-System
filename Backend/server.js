// server.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const pool = require("./database");

console.log('🏗️ Starting Warehouse & Delivery System...');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = "warehouse_secret_key";

// Import routes
const inboundRoutes = require('./routes/inbound');
const outboundRoutes = require('./routes/outbound');
const inventoryRoutes = require('./routes/inventory');
const deliveryRoutes = require('./routes/delivery');
const warehouseRoutes = require('./routes/warehouse');
const reportRoutes = require('./routes/reports');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// API ROUTES
// =====================================================

app.use('/api/inbound', inboundRoutes);
app.use('/api/outbound', outboundRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/reports', reportRoutes);

// =====================================================
// PRODUCT ROUTES
// =====================================================

// GET all products
app.get('/api/products', async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT id, name, sku, barcode, description, unit, min_stock, max_stock, created_at
            FROM products 
            WHERE 1=1
        `;
        const params = [];
        
        if (search) {
            query += ` AND (name ILIKE $1 OR sku ILIKE $1)`;
            params.push(`%${search}%`);
        }
        
        query += ` ORDER BY name`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET single product
app.get('/api/products/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST create product
app.post('/api/products', async (req, res) => {
    try {
        const { name, sku, barcode, description, unit, min_stock, max_stock } = req.body;
        
        if (!name || !sku) {
            return res.status(400).json({ error: 'Name and SKU are required' });
        }

        const result = await pool.query(`
            INSERT INTO products (name, sku, barcode, description, unit, min_stock, max_stock, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *
        `, [name, sku, barcode, description, unit || 'pcs', min_stock || 0, max_stock || 9999]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT update product
app.put('/api/products/:id', async (req, res) => {
    try {
        const { name, sku, barcode, description, unit, min_stock, max_stock } = req.body;
        
        const result = await pool.query(`
            UPDATE products 
            SET 
                name = COALESCE($1, name),
                sku = COALESCE($2, sku),
                barcode = COALESCE($3, barcode),
                description = COALESCE($4, description),
                unit = COALESCE($5, unit),
                min_stock = COALESCE($6, min_stock),
                max_stock = COALESCE($7, max_stock),
                updated_at = NOW()
            WHERE id = $8
            RETURNING *
        `, [name, sku, barcode, description, unit, min_stock, max_stock, req.params.id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// AUTHENTICATION
// =====================================================

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(" ")[1];
    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
}

// =====================================================
// AUTH ENDPOINTS
// =====================================================

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    console.log('🔐 Login attempt for:', username);

    try {
        // Check if users table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            )
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.error('❌ Users table does not exist!');
            return res.status(500).json({ error: 'Database not initialized' });
        }

        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );

        console.log('📊 User found:', result.rows.length > 0);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Invalid username or password" });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password);
        console.log('🔑 Password valid:', valid);

        if (!valid) {
            return res.status(400).json({ error: "Invalid username or password" });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, username: user.username },
            SECRET,
            { expiresIn: '24h' }
        );

        console.log('✅ Login successful for:', username);

        res.json({
            token,
            role: user.role,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name
            }
        });
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ 
            error: "Login failed", 
            details: err.message,
            stack: err.stack 
        });
    }
});

// Update the reports route in server.js
app.get('/api/reports/dashboard-stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM inbound_orders WHERE status IN ('pending', 'partial')) as pending_inbound,
                (SELECT COUNT(*) FROM outbound_orders WHERE status IN ('pending', 'partial', 'picked')) as pending_outbound,
                (SELECT COUNT(*) FROM delivery_routes WHERE status = 'scheduled') as pending_deliveries,
                (SELECT COUNT(*) FROM inventory WHERE quantity <= min_stock) as low_stock_items,
                (SELECT COALESCE(SUM(quantity * 0), 0) FROM inventory) as inventory_value
            FROM (SELECT 1) dummy
        `);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create user (admin only)
app.post("/create-user", verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Admin only" });
    }
    const { username, password, role, full_name, email, phone } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        await pool.query(
            "INSERT INTO users (username, password, role, full_name, email, phone) VALUES ($1, $2, $3, $4, $5, $6)",
            [username, hashed, role, full_name, email, phone]
        );
        res.json({ message: "User created" });
    } catch (err) {
        res.status(400).json({ error: "User already exists" });
    }
});

app.get("/users", verifyToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, username, role, full_name, email, phone FROM users ORDER BY id");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// ROOT ENDPOINTS
// =====================================================

app.get('/', (req, res) => {
    res.json({
        name: 'Warehouse & Delivery Management System',
        version: '1.0.0',
        status: 'running'
    });
});

app.get('/api', (req, res) => {
    res.json({
        name: 'Warehouse & Delivery Management System API',
        version: '1.0.0',
        endpoints: {
            '/api/inbound': 'Inbound operations',
            '/api/outbound': 'Outbound operations',
            '/api/inventory': 'Inventory management',
            '/api/delivery': 'Delivery management',
            '/api/warehouse': 'Warehouse management',
            '/api/reports': 'Reports & analytics'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Add these endpoints if they don't exist

// Get all suppliers
app.get('/api/suppliers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM suppliers ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// PRODUCTS ROUTE
// =====================================================

app.get('/api/products', async (req, res) => {
    try {
        console.log('📦 Fetching products...');
        const result = await pool.query(`
            SELECT id, name, sku, unit_cost 
            FROM products 
            ORDER BY name
        `);
        console.log('✅ Products found:', result.rows.length);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`
    });
});

// =====================================================
// ERROR HANDLER
// =====================================================

app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// =====================================================
// START SERVER
// =====================================================

const startServer = async () => {
    try {
        await pool.databaseReady;
        app.listen(PORT, () => {
            console.log(`\n✅ Server running on port ${PORT}`);
            console.log(`🌐 Visit http://localhost:${PORT}`);
            console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};


startServer();