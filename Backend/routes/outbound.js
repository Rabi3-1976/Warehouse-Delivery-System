// routes/outbound.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// Get all outbound orders
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                o.*,
                u.username as created_by_name
            FROM outbound_orders o
            LEFT JOIN users u ON o.created_by = u.id
            ORDER BY o.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching outbound orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create outbound order
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { customer_name, customer_phone, customer_address, priority, shipping_date, notes, items, created_by } = req.body;
        
        if (!customer_name || !items || !items.length) {
            return res.status(400).json({ error: 'Customer name and items are required' });
        }

        await client.query('BEGIN');

        const orderNumber = `OUT-${Date.now()}`;

        const orderResult = await client.query(`
            INSERT INTO outbound_orders (
                order_number, customer_name, customer_phone, customer_address,
                priority, shipping_date, notes, created_by, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
            RETURNING *
        `, [orderNumber, customer_name, customer_phone, customer_address, priority || 'normal', shipping_date, notes, created_by]);

        const orderId = orderResult.rows[0].id;

        for (const item of items) {
            await client.query(`
                INSERT INTO outbound_items (outbound_order_id, product_id, quantity, unit_price, total_price)
                VALUES ($1, $2, $3, $4, $5)
            `, [orderId, item.product_id, item.quantity, item.unit_price || 0, (item.quantity * (item.unit_price || 0))]);
        }

        await client.query('COMMIT');

        res.status(201).json(orderResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating outbound order:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get outbound items
router.get('/:id/items', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                i.*,
                p.name as product_name,
                p.sku
            FROM outbound_items i
            LEFT JOIN products p ON i.product_id = p.id
            WHERE i.outbound_order_id = $1
        `, [id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching outbound items:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
