// routes/reports.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// Dashboard statistics
router.get('/dashboard-stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM inbound_orders WHERE status IN ('pending', 'partial')) as pending_inbound,
                (SELECT COUNT(*) FROM outbound_orders WHERE status IN ('pending', 'partial', 'picked')) as pending_outbound,
                (SELECT COUNT(*) FROM delivery_routes WHERE status = 'scheduled') as pending_deliveries,
                (SELECT COUNT(*) FROM inventory WHERE quantity <= min_stock) as low_stock_items,
                (SELECT COALESCE(SUM(quantity * (SELECT unit_cost FROM products WHERE id = inventory.product_id)), 0) FROM inventory) as inventory_value
        `);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Inbound report
router.get('/inbound', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        let query = `
            SELECT 
                DATE(i.created_at) as date,
                COUNT(i.id) as order_count,
                COALESCE(SUM(ii.expected_quantity), 0) as total_expected,
                COALESCE(SUM(ii.received_quantity), 0) as total_received
            FROM inbound_orders i
            LEFT JOIN inbound_items ii ON i.id = ii.inbound_order_id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND i.created_at >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND i.created_at <= $${params.length + 1}`;
            params.push(end_date);
        }

        query += ` GROUP BY DATE(i.created_at) ORDER BY DATE(i.created_at) DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error generating inbound report:', error);
        res.status(500).json({ error: error.message });
    }
});

// Outbound report
router.get('/outbound', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        let query = `
            SELECT 
                DATE(o.created_at) as date,
                COUNT(o.id) as order_count,
                COALESCE(SUM(oi.quantity), 0) as total_items
            FROM outbound_orders o
            LEFT JOIN outbound_items oi ON o.id = oi.outbound_order_id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND o.created_at >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND o.created_at <= $${params.length + 1}`;
            params.push(end_date);
        }

        query += ` GROUP BY DATE(o.created_at) ORDER BY DATE(o.created_at) DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error generating outbound report:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delivery report
router.get('/delivery', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        let query = `
            SELECT 
                d.name as driver_name,
                COUNT(r.id) as route_count,
                COALESCE(SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END), 0) as completed,
                COALESCE(AVG(r.actual_duration), 0) as avg_duration
            FROM drivers d
            LEFT JOIN delivery_routes r ON d.id = r.driver_id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND r.route_date >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND r.route_date <= $${params.length + 1}`;
            params.push(end_date);
        }

        query += ` GROUP BY d.id, d.name ORDER BY completed DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error generating delivery report:', error);
        res.status(500).json({ error: error.message });
    }
});

// Inventory valuation report
router.get('/inventory-valuation', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.name as product_name,
                p.sku,
                i.quantity,
                p.unit_cost,
                (i.quantity * p.unit_cost) as total_value,
                l.aisle || '-' || l.rack || '-' || l.shelf as location
            FROM inventory i
            LEFT JOIN products p ON i.product_id = p.id
            LEFT JOIN warehouse_locations l ON i.location_id = l.id
            ORDER BY (i.quantity * p.unit_cost) DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error generating inventory valuation:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;