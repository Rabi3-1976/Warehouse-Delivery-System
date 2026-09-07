// routes/inbound.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// GET all inbound orders
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                i.*,
                s.name as supplier_name,
                u.username as created_by_name
            FROM inbound_orders i
            LEFT JOIN suppliers s ON i.supplier_id = s.id
            LEFT JOIN users u ON i.created_by = u.id
            ORDER BY i.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching inbound orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET single inbound order
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                i.*,
                s.name as supplier_name,
                u.username as created_by_name
            FROM inbound_orders i
            LEFT JOIN suppliers s ON i.supplier_id = s.id
            LEFT JOIN users u ON i.created_by = u.id
            WHERE i.id = $1
        `, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Inbound order not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching inbound order:', error);
        res.status(500).json({ error: error.message });
    }
});

// CREATE inbound order
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { supplier_id, expected_date, notes, items, created_by } = req.body;
        
        if (!supplier_id || !items || !items.length) {
            return res.status(400).json({ error: 'Supplier and items are required' });
        }

        await client.query('BEGIN');

        const orderNumber = `INB-${Date.now()}`;

        const orderResult = await client.query(`
            INSERT INTO inbound_orders (order_number, supplier_id, expected_date, notes, created_by, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING *
        `, [orderNumber, supplier_id, expected_date, notes, created_by]);

        const orderId = orderResult.rows[0].id;

        for (const item of items) {
            await client.query(`
                INSERT INTO inbound_items (inbound_order_id, product_id, expected_quantity, unit_cost, total_cost)
                VALUES ($1, $2, $3, $4, $5)
            `, [orderId, item.product_id, item.quantity, item.unit_cost || 0, (item.quantity * (item.unit_cost || 0))]);
        }

        await client.query('COMMIT');

        res.status(201).json(orderResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating inbound order:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// RECEIVE INBOUND ORDER - FIXED (Auto-Detect Location)
// =====================================================

/// =====================================================
// UPDATE INBOUND ORDER (Admin Only)
// =====================================================

router.put('/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { supplier_id, expected_date, notes, status, items } = req.body;

        if (!supplier_id) {
            return res.status(400).json({ error: 'Supplier is required' });
        }

        await client.query('BEGIN');

        // Update order
        await client.query(`
            UPDATE inbound_orders 
            SET 
                supplier_id = $1,
                expected_date = $2,
                notes = $3,
                status = $4,
                updated_at = NOW()
            WHERE id = $5
        `, [supplier_id, expected_date, notes, status, id]);

        // Update items if provided
        if (items && items.length > 0) {
            for (const item of items) {
                await client.query(`
                    UPDATE inbound_items 
                    SET 
                        expected_quantity = $1,
                        received_quantity = $2
                    WHERE inbound_order_id = $3 AND product_id = $4
                `, [item.expected_quantity, item.received_quantity, id, item.product_id]);
            }
        }

        await client.query('COMMIT');

        // Get updated order
        const result = await client.query(`
            SELECT * FROM inbound_orders WHERE id = $1
        `, [id]);

        res.json({ 
            success: true, 
            message: 'Order updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating inbound order:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// CANCEL INBOUND ORDER
// =====================================================

router.put('/:id/cancel', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { notes } = req.body;

        await client.query('BEGIN');

        const result = await client.query(`
            UPDATE inbound_orders 
            SET status = 'cancelled', 
                notes = COALESCE($1, notes || 'Cancelled by admin'),
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [notes, id]);

        if (result.rowCount === 0) {
            throw new Error('Order not found');
        }

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: 'Order cancelled successfully',
            data: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error cancelling inbound order:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// GET inbound items
router.get('/:id/items', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                i.*,
                p.name as product_name,
                p.sku,
                l.aisle || '-' || l.rack || '-' || l.shelf || '-' || l.bin as location_name
            FROM inbound_items i
            LEFT JOIN products p ON i.product_id = p.id
            LEFT JOIN warehouse_locations l ON i.location_id = l.id
            WHERE i.inbound_order_id = $1
        `, [id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching inbound items:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE inbound order
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM inbound_orders WHERE id = $1 AND status = $2 RETURNING id',
            [id, 'pending']
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Order not found or cannot be deleted' });
        }
        res.json({ message: 'Inbound order deleted' });
    } catch (error) {
        console.error('Error deleting inbound order:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;