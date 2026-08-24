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