// server.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const pool = require("./database");

console.log('🚀 Starting Warehouse & Delivery System...');

// =====================================================
// IMPORT ROUTES
// =====================================================
const inboundRoutes = require('./routes/inbound');
const outboundRoutes = require('./routes/outbound');
const inventoryRoutes = require('./routes/inventory');
const deliveryRoutes = require('./routes/delivery');
const warehouseRoutes = require('./routes/warehouse');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = "warehouse_secret_key_2024";

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// REGISTER API ROUTES
// =====================================================
console.log('📋 Registering API routes...');

app.use('/api/inbound', inboundRoutes);
console.log('✅ /api/inbound registered');

app.use('/api/outbound', outboundRoutes);
console.log('✅ /api/outbound registered');

app.use('/api/inventory', inventoryRoutes);
console.log('✅ /api/inventory registered');

app.use('/api/delivery', deliveryRoutes);
console.log('✅ /api/delivery registered');

app.use('/api/warehouse', warehouseRoutes);
console.log('✅ /api/warehouse registered');

app.use('/api/reports', reportsRoutes);
console.log('✅ /api/reports registered');

// =====================================================
// AUTH ENDPOINTS
// =====================================================

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );
        const user = result.rows[0];
        if (!user) return res.status(400).json({ error: "Invalid credentials" });
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user.id, role: user.role }, SECRET);
        res.json({ 
            token, 
            role: user.role,
            user: { id: user.id, username: user.username, full_name: user.full_name }
        });
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ error: "Login failed" });
    }
});

// =====================================================
// SUPPLIERS ROUTES
// =====================================================

app.get('/api/suppliers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM suppliers ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/suppliers', async (req, res) => {
    try {
        const { name, contact_person, phone, email, address } = req.body;
        const result = await pool.query(`
            INSERT INTO suppliers (name, contact_person, phone, email, address, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `, [name, contact_person, phone, email, address]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// PRODUCTS ROUTES
// =====================================================

app.get('/api/products', async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT id, name, sku, barcode, description, unit, min_stock, max_stock, created_at
            FROM products WHERE 1=1
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
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { name, sku, barcode, description, unit, min_stock, max_stock } = req.body;
        const result = await pool.query(`
            UPDATE products 
            SET name = COALESCE($1, name), sku = COALESCE($2, sku),
                barcode = COALESCE($3, barcode), description = COALESCE($4, description),
                unit = COALESCE($5, unit), min_stock = COALESCE($6, min_stock),
                max_stock = COALESCE($7, max_stock), updated_at = NOW()
            WHERE id = $8 RETURNING *
        `, [name, sku, barcode, description, unit, min_stock, max_stock, req.params.id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Product not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Product not found' });
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

app.get('/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime() });
});

// =====================================================
// 404 HANDLER - MUST BE LAST!
// =====================================================

app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`
    });
});

// =====================================================
// START SERVER
// =====================================================

const startServer = async () => {
    try {
        await pool.query('SELECT 1');
        console.log('✅ Database connected');
        
        app.listen(PORT, () => {
            console.log(`\n✅ Server running on port ${PORT}`);
            console.log(`🌐 Visit http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();