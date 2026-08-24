// routes/inventory.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// Get all inventory with optional search
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        
        let query = `
            SELECT 
                i.*,
                p.name as product_name,
                p.sku,
                p.min_stock,
                p.max_stock,
                l.aisle || '-' || l.rack || '-' || l.shelf || '-' || l.bin as location
            FROM inventory i
            LEFT JOIN products p ON i.product_id = p.id
            LEFT JOIN warehouse_locations l ON i.location_id = l.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (p.name ILIKE $${params.length + 1} OR p.sku ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY p.name`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single inventory item
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                i.*,
                p.name as product_name,
                p.sku,
                p.min_stock,
                l.aisle || '-' || l.rack || '-' || l.shelf || '-' || l.bin as location
            FROM inventory i
            LEFT JOIN products p ON i.product_id = p.id
            LEFT JOIN warehouse_locations l ON i.location_id = l.id
            WHERE i.id = $1
        `, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching inventory item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get low stock items
router.get('/low-stock', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                i.*,
                p.name as product_name,
                p.sku,
                p.min_stock,
                l.aisle || '-' || l.rack || '-' || l.shelf || '-' || l.bin as location
            FROM inventory i
            LEFT JOIN products p ON i.product_id = p.id
            LEFT JOIN warehouse_locations l ON i.location_id = l.id
            WHERE i.quantity <= p.min_stock
            ORDER BY (i.quantity - p.min_stock) ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching low stock:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get inventory transactions
router.get('/transactions', async (req, res) => {
    try {
        const { limit = 50, product_id } = req.query;
        
        let query = `
            SELECT 
                t.*,
                p.name as product_name,
                p.sku,
                u.username as created_by_name,
                l.aisle || '-' || l.rack || '-' || l.shelf || '-' || l.bin as location
            FROM inventory_transactions t
            LEFT JOIN products p ON t.product_id = p.id
            LEFT JOIN users u ON t.created_by = u.id
            LEFT JOIN warehouse_locations l ON t.location_id = l.id
            WHERE 1=1
        `;
        const params = [];

        if (product_id) {
            query += ` AND t.product_id = $${params.length + 1}`;
            params.push(product_id);
        }

        query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Adjust inventory
router.put('/adjust', async (req, res) => {
    const client = await pool.connect();
    try {
        const { product_id, location_id, new_quantity, notes, adjusted_by } = req.body;

        if (!product_id || !location_id || new_quantity === undefined) {
            return res.status(400).json({ error: 'Product, location, and quantity are required' });
        }

        await client.query('BEGIN');

        // Check if inventory record exists
        const current = await client.query(
            'SELECT * FROM inventory WHERE product_id = $1 AND location_id = $2',
            [product_id, location_id]
        );

        if (current.rowCount === 0) {
            // Create new inventory record
            await client.query(`
                INSERT INTO inventory (product_id, location_id, quantity, min_stock, max_stock)
                VALUES ($1, $2, $3, 0, 9999)
            `, [product_id, location_id, new_quantity]);
            
            await client.query(`
                INSERT INTO inventory_transactions (
                    product_id, location_id, transaction_type, 
                    quantity, notes, created_by
                ) VALUES ($1, $2, 'initial', $3, $4, $5)
            `, [product_id, location_id, new_quantity, notes || 'Initial stock setup', adjusted_by]);
        } else {
            const difference = new_quantity - current.rows[0].quantity;

            await client.query(`
                UPDATE inventory 
                SET quantity = $1, updated_at = NOW()
                WHERE product_id = $2 AND location_id = $3
            `, [new_quantity, product_id, location_id]);

            if (difference !== 0) {
                await client.query(`
                    INSERT INTO inventory_transactions (
                        product_id, location_id, transaction_type, 
                        quantity, notes, created_by
                    ) VALUES ($1, $2, 'adjustment', $3, $4, $5)
                `, [product_id, location_id, difference, notes || 'Manual adjustment', adjusted_by]);
            }
        }

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: 'Inventory adjusted successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adjusting inventory:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Move inventory between locations
router.put('/move', async (req, res) => {
    const client = await pool.connect();
    try {
        const { product_id, from_location_id, to_location_id, quantity, moved_by } = req.body;

        if (!product_id || !from_location_id || !to_location_id || !quantity) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        await client.query('BEGIN');

        // Check source inventory
        const sourceCheck = await client.query(
            'SELECT quantity FROM inventory WHERE product_id = $1 AND location_id = $2',
            [product_id, from_location_id]
        );

        if (sourceCheck.rowCount === 0 || sourceCheck.rows[0].quantity < quantity) {
            throw new Error('Insufficient stock at source location');
        }

        // Deduct from source
        await client.query(`
            UPDATE inventory 
            SET quantity = quantity - $1, updated_at = NOW()
            WHERE product_id = $2 AND location_id = $3
        `, [quantity, product_id, from_location_id]);

        // Add to destination
        const destCheck = await client.query(
            'SELECT * FROM inventory WHERE product_id = $1 AND location_id = $2',
            [product_id, to_location_id]
        );

        if (destCheck.rowCount === 0) {
            await client.query(`
                INSERT INTO inventory (product_id, location_id, quantity)
                VALUES ($1, $2, $3)
            `, [product_id, to_location_id, quantity]);
        } else {
            await client.query(`
                UPDATE inventory 
                SET quantity = quantity + $1, updated_at = NOW()
                WHERE product_id = $2 AND location_id = $3
            `, [quantity, product_id, to_location_id]);
        }

        // Record transactions
        await client.query(`
            INSERT INTO inventory_transactions (
                product_id, location_id, transaction_type, 
                quantity, notes, created_by
            ) VALUES ($1, $2, 'move_out', $3, $4, $5)
        `, [product_id, from_location_id, -quantity, `Moved to location ${to_location_id}`, moved_by]);

        await client.query(`
            INSERT INTO inventory_transactions (
                product_id, location_id, transaction_type, 
                quantity, notes, created_by
            ) VALUES ($1, $2, 'move_in', $3, $4, $5)
        `, [product_id, to_location_id, quantity, `Moved from location ${from_location_id}`, moved_by]);

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: 'Inventory moved successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error moving inventory:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get inventory summary
router.get('/summary', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(DISTINCT product_id) as total_products,
                SUM(quantity) as total_quantity,
                SUM(quantity * p.unit_cost) as total_value,
                COUNT(CASE WHEN quantity <= min_stock THEN 1 END) as low_stock_count,
                COUNT(CASE WHEN quantity <= 0 THEN 1 END) as out_of_stock_count
            FROM inventory i
            LEFT JOIN products p ON i.product_id = p.id
        `);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching inventory summary:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;