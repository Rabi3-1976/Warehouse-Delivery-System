// routes/delivery.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// Get all delivery routes
router.get('/', async (req, res) => {
    try {
        const { status, date } = req.query;
        
        let query = `
            SELECT 
                r.*,
                d.name as driver_name,
                d.phone as driver_phone,
                o.order_number,
                o.customer_name,
                o.customer_address,
                u.username as created_by_name
            FROM delivery_routes r
            LEFT JOIN drivers d ON r.driver_id = d.id
            LEFT JOIN outbound_orders o ON r.outbound_order_id = o.id
            LEFT JOIN users u ON r.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ` AND r.status = $${params.length + 1}`;
            params.push(status);
        }

        if (date) {
            query += ` AND r.route_date = $${params.length + 1}`;
            params.push(date);
        }

        query += ` ORDER BY r.route_date DESC, r.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching delivery routes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single delivery route
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                r.*,
                d.name as driver_name,
                d.phone as driver_phone,
                o.order_number,
                o.customer_name,
                o.customer_address,
                u.username as created_by_name
            FROM delivery_routes r
            LEFT JOIN drivers d ON r.driver_id = d.id
            LEFT JOIN outbound_orders o ON r.outbound_order_id = o.id
            LEFT JOIN users u ON r.created_by = u.id
            WHERE r.id = $1
        `, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Delivery route not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching delivery route:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create delivery route
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { driver_id, outbound_order_id, route_date, estimated_duration, notes, created_by } = req.body;

        if (!driver_id || !outbound_order_id) {
            return res.status(400).json({ error: 'Driver and outbound order are required' });
        }

        await client.query('BEGIN');

        // Check driver availability
        const driverCheck = await client.query(
            'SELECT status FROM drivers WHERE id = $1',
            [driver_id]
        );

        if (driverCheck.rowCount === 0) {
            throw new Error('Driver not found');
        }

        if (driverCheck.rows[0].status !== 'available') {
            throw new Error('Driver is not available');
        }

        // Check if outbound order exists and can be delivered
        const orderCheck = await client.query(
            'SELECT status FROM outbound_orders WHERE id = $1',
            [outbound_order_id]
        );

        if (orderCheck.rowCount === 0) {
            throw new Error('Outbound order not found');
        }

        if (!['picked', 'shipped'].includes(orderCheck.rows[0].status)) {
            throw new Error('Order must be picked or shipped before delivery');
        }

        const result = await client.query(`
            INSERT INTO delivery_routes (
                driver_id, outbound_order_id, route_date,
                estimated_duration, status, notes, created_by
            ) VALUES ($1, $2, $3, $4, 'scheduled', $5, $6)
            RETURNING *
        `, [driver_id, outbound_order_id, route_date, estimated_duration, notes, created_by]);

        // Update driver status to busy
        await client.query(
            'UPDATE drivers SET status = $1, updated_at = NOW() WHERE id = $2',
            ['busy', driver_id]
        );

        // Update outbound order status
        await client.query(
            'UPDATE outbound_orders SET status = $1, updated_at = NOW() WHERE id = $2',
            ['in_delivery', outbound_order_id]
        );

        await client.query('COMMIT');

        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating delivery route:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Start delivery (in_progress)
router.put('/:id/start', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        await client.query('BEGIN');

        const result = await client.query(`
            UPDATE delivery_routes 
            SET status = 'in_progress', updated_at = NOW()
            WHERE id = $1 AND status = 'scheduled'
            RETURNING *
        `, [id]);

        if (result.rowCount === 0) {
            throw new Error('Delivery route not found or already started');
        }

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: 'Delivery started successfully',
            data: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error starting delivery:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Complete delivery
router.put('/:id/complete', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { notes } = req.body;

        await client.query('BEGIN');

        const result = await client.query(`
            UPDATE delivery_routes 
            SET status = 'completed', 
                actual_duration = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60,
                notes = COALESCE($1, notes),
                updated_at = NOW()
            WHERE id = $2 AND status IN ('scheduled', 'in_progress')
            RETURNING *
        `, [notes, id]);

        if (result.rowCount === 0) {
            throw new Error('Delivery route not found or cannot be completed');
        }

        // Update outbound order status
        await client.query(`
            UPDATE outbound_orders 
            SET status = 'delivered', delivery_date = NOW(), updated_at = NOW()
            WHERE id = (SELECT outbound_order_id FROM delivery_routes WHERE id = $1)
        `, [id]);

        // Update driver status to available
        await client.query(`
            UPDATE drivers 
            SET status = 'available', updated_at = NOW()
            WHERE id = (SELECT driver_id FROM delivery_routes WHERE id = $1)
        `, [id]);

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: 'Delivery completed successfully',
            data: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error completing delivery:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Cancel delivery
router.put('/:id/cancel', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { reason } = req.body;

        await client.query('BEGIN');

        const result = await client.query(`
            UPDATE delivery_routes 
            SET status = 'cancelled', 
                notes = COALESCE($1, notes),
                updated_at = NOW()
            WHERE id = $2 AND status IN ('scheduled', 'in_progress')
            RETURNING *
        `, [reason, id]);

        if (result.rowCount === 0) {
            throw new Error('Delivery route not found or cannot be cancelled');
        }

        // Update outbound order status back to previous
        await client.query(`
            UPDATE outbound_orders 
            SET status = 'picked', updated_at = NOW()
            WHERE id = (SELECT outbound_order_id FROM delivery_routes WHERE id = $1)
        `, [id]);

        // Update driver status to available
        await client.query(`
            UPDATE drivers 
            SET status = 'available', updated_at = NOW()
            WHERE id = (SELECT driver_id FROM delivery_routes WHERE id = $1)
        `, [id]);

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: 'Delivery cancelled successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error cancelling delivery:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// DRIVER MANAGEMENT
// =====================================================

// Get all drivers
router.get('/drivers', async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = `
            SELECT 
                d.*,
                COUNT(r.id) as total_routes,
                COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_routes
            FROM drivers d
            LEFT JOIN delivery_routes r ON d.id = r.driver_id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ` AND d.status = $${params.length + 1}`;
            params.push(status);
        }

        query += ` GROUP BY d.id ORDER BY d.name`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching drivers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single driver
router.get('/drivers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                d.*,
                COUNT(r.id) as total_routes,
                COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_routes
            FROM drivers d
            LEFT JOIN delivery_routes r ON d.id = r.driver_id
            WHERE d.id = $1
            GROUP BY d.id
        `, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching driver:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add driver
router.post('/drivers', async (req, res) => {
    try {
        const { name, phone, license_number, vehicle_type, vehicle_plate, max_capacity } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Driver name is required' });
        }

        const result = await pool.query(`
            INSERT INTO drivers (
                name, phone, license_number, vehicle_type,
                vehicle_plate, max_capacity, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'available')
            RETURNING *
        `, [name, phone, license_number, vehicle_type, vehicle_plate, max_capacity]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding driver:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update driver
router.put('/drivers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, license_number, vehicle_type, vehicle_plate, max_capacity } = req.body;

        const result = await pool.query(`
            UPDATE drivers 
            SET 
                name = COALESCE($1, name),
                phone = COALESCE($2, phone),
                license_number = COALESCE($3, license_number),
                vehicle_type = COALESCE($4, vehicle_type),
                vehicle_plate = COALESCE($5, vehicle_plate),
                max_capacity = COALESCE($6, max_capacity),
                updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `, [name, phone, license_number, vehicle_type, vehicle_plate, max_capacity, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating driver:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update driver status
router.put('/drivers/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['available', 'busy', 'off-duty'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const result = await pool.query(`
            UPDATE drivers 
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [status, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating driver status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete driver
router.delete('/drivers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if driver has routes
        const check = await pool.query(
            'SELECT COUNT(*) FROM delivery_routes WHERE driver_id = $1',
            [id]
        );

        if (parseInt(check.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete driver with existing delivery routes' 
            });
        }

        const result = await pool.query(
            'DELETE FROM drivers WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json({ success: true, message: 'Driver deleted successfully' });
    } catch (error) {
        console.error('Error deleting driver:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get delivery stats
router.get('/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM delivery_routes WHERE status = 'scheduled') as pending,
                (SELECT COUNT(*) FROM delivery_routes WHERE status = 'in_progress') as in_transit,
                (SELECT COUNT(*) FROM delivery_routes WHERE DATE(route_date) = CURRENT_DATE AND status = 'completed') as delivered_today,
                (SELECT COUNT(*) FROM delivery_routes WHERE status = 'completed') as total_delivered,
                (SELECT COUNT(*) FROM drivers WHERE status = 'available') as active_drivers,
                (SELECT COUNT(*) FROM drivers) as total_drivers
        `);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching delivery stats:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;