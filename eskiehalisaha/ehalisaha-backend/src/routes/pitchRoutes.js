const express = require('express');
const db = require('../config/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

// Bir facility'nin sahalarını getir
router.get('/facility/:facilityId', authMiddleware, async (req, res) => {
  try {
    const { facilityId } = req.params;
    const userId = req.user.id;

    // Owner kontrolü
    const facilityCheck = await db.query(
      'SELECT id FROM facilities WHERE id = $1 AND owner_id = $2',
      [facilityId, userId]
    );

    if (facilityCheck.rows.length === 0 && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Bu tesise erişim yetkiniz yok' });
    }

    const result = await db.query(
      'SELECT * FROM pitches WHERE facility_id = $1 ORDER BY created_at',
      [facilityId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get pitches error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Yeni saha ekle
router.post(
  '/',
  authMiddleware,
  roleMiddleware('SahaSahibi', 'Admin'),
  async (req, res) => {
    try {
      const {
        facilityId,
        name,
        type,
        capacity,
        hourlyPrice,
        depositPrice,
        nightStartHour,
        nightHourlyPrice,
        nightDepositPrice,
        openingHour,
        closingHour,
        slotDuration,
      } = req.body;
      const userId = req.user.id;

      // Owner kontrolü
      const facilityCheck = await db.query(
        'SELECT id FROM facilities WHERE id = $1 AND owner_id = $2',
        [facilityId, userId]
      );

      if (facilityCheck.rows.length === 0 && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Bu tesise saha ekleyemezsiniz' });
      }

      const result = await db.query(
        `INSERT INTO pitches 
         (facility_id, name, type, capacity, hourly_price, deposit_price, 
          night_start_hour, night_hourly_price, night_deposit_price,
          opening_hour, closing_hour, slot_duration, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW())
         RETURNING *`,
        [
          facilityId,
          name,
          type,
          capacity,
          hourlyPrice,
          depositPrice,
          nightStartHour || 18,
          nightHourlyPrice || hourlyPrice * 1.5,
          nightDepositPrice || depositPrice * 1.5,
          openingHour || 8,
          closingHour || 23,
          slotDuration || 60,
        ]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Create pitch error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Saha güncelle
router.put(
  '/:pitchId',
  authMiddleware,
  roleMiddleware('SahaSahibi', 'Admin'),
  async (req, res) => {
    try {
      const { pitchId } = req.params;
      const {
        name,
        type,
        capacity,
        hourlyPrice,
        depositPrice,
        nightStartHour,
        nightHourlyPrice,
        nightDepositPrice,
        openingHour,
        closingHour,
        slotDuration,
        isActive,
      } = req.body;
      const userId = req.user.id;

      // Owner kontrolü
      const pitchCheck = await db.query(
        `SELECT p.* FROM pitches p
         JOIN facilities f ON p.facility_id = f.id
         WHERE p.id = $1 AND f.owner_id = $2`,
        [pitchId, userId]
      );

      if (pitchCheck.rows.length === 0 && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Bu sahayı düzenleyemezsiniz' });
      }

      const result = await db.query(
        `UPDATE pitches 
         SET name = $1, type = $2, capacity = $3, hourly_price = $4, 
             deposit_price = $5, night_start_hour = $6, night_hourly_price = $7,
             night_deposit_price = $8, opening_hour = $9, closing_hour = $10, 
             slot_duration = $11, is_active = $12
         WHERE id = $13
         RETURNING *`,
        [
          name,
          type,
          capacity,
          hourlyPrice,
          depositPrice,
          nightStartHour,
          nightHourlyPrice,
          nightDepositPrice,
          openingHour,
          closingHour,
          slotDuration,
          isActive,
          pitchId,
        ]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Update pitch error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Saha sil
router.delete(
  '/:pitchId',
  authMiddleware,
  roleMiddleware('SahaSahibi', 'Admin'),
  async (req, res) => {
    try {
      const { pitchId } = req.params;
      const userId = req.user.id;

      // Owner kontrolü
      const pitchCheck = await db.query(
        `SELECT p.* FROM pitches p
         JOIN facilities f ON p.facility_id = f.id
         WHERE p.id = $1 AND f.owner_id = $2`,
        [pitchId, userId]
      );

      if (pitchCheck.rows.length === 0 && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Bu sahayı silemezsiniz' });
      }

      await db.query('DELETE FROM pitches WHERE id = $1', [pitchId]);

      res.json({ success: true, message: 'Saha silindi' });
    } catch (error) {
      console.error('Delete pitch error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
