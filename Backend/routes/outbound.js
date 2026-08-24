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

// Get single outbound order
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                o.*,
                u.username as created_by_name
            FROM outbound_orders o
            LEFT JOIN users u ON o.created_by = u.id
            WHERE o.id = $1
        `, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Outbound order not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching outbound order:', error);
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

// Pick outbound order items
router.put('/:id/pick', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { items, picked_by } = req.body;

        if (!items || !items.length) {
            return res.status(400).json({ error: 'Items are required' });
        }

        await client.query('BEGIN');

        const orderCheck = await client.query(
            'SELECT * FROM outbound_orders WHERE id = $1 AND status = $2',
            [id, 'pending']
        );
        if (orderCheck.rowCount === 0) {
            throw new Error('Order not found or already picked');
        }

        let allPicked = true;

        for (const item of items) {
            const updateResult = await client.query(`
                UPDATE outbound_items 
                SET picked_quantity = picked_quantity + $1
                WHERE outbound_order_id = $2 AND product_id = $3
                RETURNING *
            `, [item.quantity_picked, id, item.product_id]);

            if (updateResult.rowCount === 0) {
                throw new Error(`Product ${item.product_id} not found in order`);
            }

            const inventoryCheck = await client.query(
                'SELECT * FROM inventory WHERE product_id = $1 AND location_id = $2',
                [item.product_id, item.location_id]
            );

            if (inventoryCheck.rowCount > 0) {
                await client.query(`
                    UPDATE inventory 
                    SET reserved_quantity = reserved_quantity + $1, updated_at = NOW()
                    WHERE product_id = $2 AND location_id = $3
                `, [item.quantity_picked, item.product_id, item.location_id]);
            }

            const remainingCheck = await client.query(`
                SELECT COUNT(*) as count FROM outbound_items 
                WHERE outbound_order_id = $1 AND quantity > picked_quantity
            `, [id]);

            if (parseInt(remainingCheck.rows[0].count) > 0) {
                allPicked = false;
            }
        }

        const newStatus = allPicked ? 'picked' : 'partial';
        await client.query(`
            UPDATE outbound_orders 
            SET status = $1, updated_at = NOW()
            WHERE id = $2
        `, [newStatus, id]);

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: 'Items picked successfully',
            status: newStatus
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error picking outbound items:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Ship outbound order
router.put('/:id/ship', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { shipped_by } = req.body;

        await client.query('BEGIN');

        const orderCheck = await client.query(
            'SELECT * FROM outbound_orders WHERE id = $1 AND status IN ($2, $3)',
            [id, 'picked', 'partial']
        );
        if (orderCheck.rowCount === 0) {
            throw new Error('Order not found or cannot be shipped');
        }

        await client.query(`
            UPDATE outbound_orders 
            SET status = 'shipped', shipping_date = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [id]);

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: 'Order shipped successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error shipping outbound order:', error);
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
                p.sku,
                l.aisle || '-' || l.rack || '-' || l.shelf || '-' || l.bin as location_name
            FROM outbound_items i
            LEFT JOIN products p ON i.product_id = p.id
            LEFT JOIN warehouse_locations l ON i.location_id = l.id
            WHERE i.outbound_order_id = $1
        `, [id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching outbound items:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;