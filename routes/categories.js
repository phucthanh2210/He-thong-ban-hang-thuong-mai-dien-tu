const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// ─── GET /api/categories ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [categories] = await pool.query(
      `SELECT c.CategoryID, c.CategoryName, c.Description,
              COUNT(p.ProductID) AS ProductCount
       FROM Categories c
       LEFT JOIN Products p ON c.CategoryID = p.CategoryID AND p.Status = TRUE
       WHERE c.Status = TRUE
       GROUP BY c.CategoryID
       ORDER BY c.CategoryName ASC`
    );

    res.json(categories);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
