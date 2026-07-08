const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// ─── GET /api/products ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12, sort } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE p.Status = TRUE AND c.Status = TRUE';
    const params = [];

    if (category) {
      where += ' AND p.CategoryID = ?';
      params.push(parseInt(category));
    }

    if (search) {
      where += ' AND (p.ProductName LIKE ? OR p.Description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Sort
    let orderBy = 'ORDER BY p.CreatedAt DESC';
    if (sort === 'price_asc') orderBy = 'ORDER BY p.Price ASC';
    else if (sort === 'price_desc') orderBy = 'ORDER BY p.Price DESC';
    else if (sort === 'name') orderBy = 'ORDER BY p.ProductName ASC';

    // Count total
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM Products p
       JOIN Categories c ON p.CategoryID = c.CategoryID
       ${where}`,
      params
    );
    const total = countResult[0].total;

    // Fetch products
    const [products] = await pool.query(
      `SELECT p.ProductID, p.ProductName, p.Description, p.Price, p.StockQuantity,
              p.Image, p.CreatedAt, c.CategoryID, c.CategoryName
       FROM Products p
       JOIN Categories c ON p.CategoryID = c.CategoryID
       ${where}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── GET /api/products/:id ─────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [products] = await pool.query(
      `SELECT p.ProductID, p.ProductName, p.Description, p.Price, p.StockQuantity,
              p.Image, p.Status, p.CreatedAt, c.CategoryID, c.CategoryName
       FROM Products p
       JOIN Categories c ON p.CategoryID = c.CategoryID
       WHERE p.ProductID = ?`,
      [req.params.id]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    }

    res.json(products[0]);
  } catch (err) {
    console.error('Get product detail error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
