const express = require('express');
const db = require('../config/database');
const redis = require('../config/redis');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const { lat, lng, radius, amenities, capacity } = req.query;

    let query;
    let params = [];

    if (lat && lng) {
      query = `
        SELECT f.*, 
               ST_Distance(
                 ST_SetSRID(ST_MakePoint(f.longitude, f.latitude), 4326)::geography,
                 ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
               ) as distance
        FROM facilities f
        WHERE ST_DWithin(
          ST_SetSRID(ST_MakePoint(f.longitude, f.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      `;
      params = [lng, lat, radius || 5000];
    } else {
      query = `SELECT f.*, 0 as distance FROM facilities f WHERE 1=1`;
    }

    if (amenities) {
      query += ` AND f.amenities @> $${params.length + 1}::jsonb`;
      params.push(JSON.stringify(amenities.split(',')));
    }

    if (lat && lng) {
      query += ` ORDER BY distance LIMIT 50`;
    } else {
      query += ` ORDER BY f.created_at DESC LIMIT 50`;
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Search facilities error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/my-facilities', authMiddleware, roleMiddleware('SahaSahibi', 'Admin'), async (req, res) => {
  try {
    const ownerId = req.user.id;
    const result = await db.query(
      'SELECT * FROM facilities WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get my facilities error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `facility:${id}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    const facilityResult = await db.query(
      'SELECT * FROM facilities WHERE id = $1',
      [id]
    );

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tesis bulunamadı' });
    }

    const pitchesResult = await db.query(
      'SELECT * FROM pitches WHERE facility_id = $1 ORDER BY name',
      [id]
    );

    const reviewsResult = await db.query(
      `SELECT r.*, u.full_name as user_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.facility_id = $1
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [id]
    );

    const data = {
      ...facilityResult.rows[0],
      pitches: pitchesResult.rows,
      reviews: reviewsResult.rows,
    };

    await redis.set(cacheKey, JSON.stringify(data), 'EX', 300);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get facility error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post(
  '/',
  authMiddleware,
  roleMiddleware('SahaSahibi', 'Admin'),
  async (req, res) => {
    try {
      const { name, address, latitude, longitude, amenities, customAmenities, description, image_url, iban, account_holder_name } = req.body;
      const ownerId = req.user.id;

      const result = await db.query(
        `INSERT INTO facilities (name, address, latitude, longitude, amenities, custom_amenities, description, image_url, iban, account_holder_name, owner_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         RETURNING *`,
        [name, address, latitude, longitude, amenities, customAmenities || [], description, image_url || null, iban || null, account_holder_name || null, ownerId]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Create facility error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('SahaSahibi', 'Admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const facility = await db.query(
        'SELECT owner_id FROM facilities WHERE id = $1',
        [id]
      );

      if (facility.rows.length === 0) {
        return res.status(404).json({ error: 'Tesis bulunamadı' });
      }

      if (facility.rows[0].owner_id !== req.user.id && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Bu tesisi düzenleme yetkiniz yok' });
      }

      const fieldMapping = {
        customAmenities: 'custom_amenities'
      };

      const fields = Object.keys(updates)
        .map((key, index) => {
          const dbField = fieldMapping[key] || key;
          return `${dbField} = $${index + 2}`;
        })
        .join(', ');

      const values = Object.values(updates);

      const result = await db.query(
        `UPDATE facilities SET ${fields} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );

      await redis.del(`facility:${id}`);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Update facility error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
