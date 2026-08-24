// routes/warehouse.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// Get all warehouse zones
router.get('/zones', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                z.*,
                COUNT(l.id) as location_count
            FROM warehouse_zones z
            LEFT JOIN warehouse_locations l ON z.id = l.zone_id
            GROUP BY z.id
            ORDER BY z.name
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching zones:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create warehouse zone
router.post('/zones', async (req, res) => {
    try {
        const { name, code, description, location, capacity } = req.body;

        if (!name || !code) {
            return res.status(400).json({ error: 'Name and code are required' });
        }

        const result = await pool.query(`
            INSERT INTO warehouse_zones (name, code, description, location, capacity)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [name, code, description, location, capacity]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating zone:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get locations by zone
router.get('/zones/:zoneId/locations', async (req, res) => {
    try {
        const { zoneId } = req.params;
        const result = await pool.query(`
            SELECT 
                l.*,
                z.name as zone_name
            FROM warehouse_locations l
            LEFT JOIN warehouse_zones z ON l.zone_id = z.id
            WHERE l.zone_id = $1
            ORDER BY l.aisle, l.rack, l.shelf, l.bin
        `, [zoneId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create warehouse location
router.post('/locations', async (req, res) => {
    try {
        const { zone_id, aisle, rack, shelf, bin, barcode } = req.body;

        if (!zone_id) {
            return res.status(400).json({ error: 'Zone ID is required' });
        }

        const result = await pool.query(`
            INSERT INTO warehouse_locations (zone_id, aisle, rack, shelf, bin, barcode)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [zone_id, aisle, rack, shelf, bin, barcode]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating location:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;