// routes/inbound.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// =====================================================
// GET ALL INBOUND ORDERS
// =====================================================

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

// =====================================================
// GET SINGLE INBOUND ORDER
// =====================================================

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

// =====================================================
// CREATE INBOUND ORDER
// =====================================================

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
// RECEIVE INBOUND ORDER - FIXED
// =====================================================

router.put('/:id/receive', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { items, received_by } = req.body;

        if (!items || !items.length) {
            return res.status(400).json({ error: 'Items are required' });
        }

        await client.query('BEGIN');

        // Check if order exists and is pending
        const orderCheck = await client.query(
            'SELECT * FROM inbound_orders WHERE id = $1 AND status = $2',
            [id, 'pending']
        );
        if (orderCheck.rowCount === 0) {
            throw new Error('Order not found or already received');
        }

        let allReceived = true;

        for (const item of items) {
            // Update received quantity
            const updateResult = await client.query(`
                UPDATE inbound_items 
                SET received_quantity = received_quantity + $1
                WHERE inbound_order_id = $2 AND product_id = $3
                RETURNING *
            `, [item.quantity_received, id, item.product_id]);

            if (updateResult.rowCount === 0) {
                throw new Error(`Product ${item.product_id} not found in order`);
            }

            // Get the product details
            const productResult = await client.query(
                'SELECT * FROM products WHERE id = $1',
                [item.product_id]
            );
            const product = productResult.rows[0];

            // Find a location for this product (or use a default one)
            let locationId = item.location_id || 1; // Default location ID

            // If location doesn't exist, create one
            const locationCheck = await client.query(
                'SELECT id FROM warehouse_locations WHERE id = $1',
                [locationId]
            );

            if (locationCheck.rowCount === 0) {
                // Use the first available location
                const defaultLocation = await client.query(
                    'SELECT id FROM warehouse_locations LIMIT 1'
                );
                if (defaultLocation.rowCount > 0) {
                    locationId = defaultLocation.rows[0].id;
                } else {
                    // Create a default location if none exists
                    const newLocation = await client.query(`
                        INSERT INTO warehouse_locations (zone_id, aisle, rack, shelf, bin)
                        VALUES (1, 'A', '1', '1', '1')
                        RETURNING id
                    `);
                    locationId = newLocation.rows[0].id;
                }
            }

            // Update inventory
            const inventoryCheck = await client.query(
                'SELECT * FROM inventory WHERE product_id = $1 AND location_id = $2',
                [item.product_id, locationId]
            );

            if (inventoryCheck.rowCount === 0) {
                await client.query(`
                    INSERT INTO inventory (product_id, location_id, quantity)
                    VALUES ($1, $2, $3)
                `, [item.product_id, locationId, item.quantity_received]);
            } else {
                await client.query(`
                    UPDATE inventory 
                    SET quantity = quantity + $1, updated_at = NOW()
                    WHERE product_id = $2 AND location_id = $3
                `, [item.quantity_received, item.product_id, locationId]);
            }

            // Record transaction
            await client.query(`
                INSERT INTO inventory_transactions (
                    product_id, location_id, transaction_type, 
                    quantity, reference_type, reference_id, notes, created_by
                ) VALUES ($1, $2, 'inbound', $3, 'inbound_order', $4, $5, $6)
            `, [item.product_id, locationId, item.quantity_received, id, 'Received from inbound order', received_by]);

            // Check if all items received
            const remainingCheck = await client.query(`
                SELECT COUNT(*) as count FROM inbound_items 
                WHERE inbound_order_id = $1 AND expected_quantity > received_quantity
            `, [id]);

            if (parseInt(remainingCheck.rows[0].count) > 0) {
                allReceived = false;
            }
        }

        // Update order status
        const newStatus = allReceived ? 'completed' : 'partial';
        await client.query(`
            UPDATE inbound_orders 
            SET status = $1, received_date = NOW(), updated_at = NOW()
            WHERE id = $2
        `, [newStatus, id]);

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: 'Items received successfully',
            status: newStatus
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error receiving inbound order:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// GET INBOUND ITEMS
// =====================================================

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

// =====================================================
// DELETE INBOUND ORDER
// =====================================================

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