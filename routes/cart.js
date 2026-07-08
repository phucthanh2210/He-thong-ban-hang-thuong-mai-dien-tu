const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All cart routes require authentication
router.use(authenticate);

// ─── GET /api/cart ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT ci.CartItemID, ci.Quantity, ci.UnitPrice,
              p.ProductID, p.ProductName, p.Image, p.Price AS CurrentPrice,
              p.StockQuantity, p.Status AS ProductStatus
       FROM Cart c
       JOIN CartItems ci ON c.CartID = ci.CartID
       JOIN Products p ON ci.ProductID = p.ProductID
       WHERE c.UserID = ?
       ORDER BY ci.CartItemID DESC`,
      [req.user.userId]
    );

    const total = items.reduce((sum, item) => sum + item.Quantity * item.UnitPrice, 0);

    res.json({ items, total, itemCount: items.length });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── POST /api/cart/add ────────────────────────────────────
router.post('/add', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId || quantity < 1) {
      return res.status(400).json({ error: 'Thông tin không hợp lệ' });
    }

    // Call stored procedure SP_AddToCart
    const [result] = await pool.query(
      'CALL SP_AddToCart(?, ?, ?, @result); SELECT @result AS result;',
      [req.user.userId, productId, quantity]
    );

    // Get the OUT parameter from the second result set
    const spResult = result[1]?.[0]?.result || result[result.length - 1]?.[0]?.result;

    if (spResult === 'SUCCESS') {
      res.json({ message: 'Đã thêm vào giỏ hàng' });
    } else if (spResult === 'INSUFFICIENT_STOCK') {
      res.status(400).json({ error: 'Số lượng tồn kho không đủ' });
    } else if (spResult === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    } else if (spResult === 'PRODUCT_INACTIVE') {
      res.status(400).json({ error: 'Sản phẩm đã ngừng kinh doanh' });
    } else {
      res.status(400).json({ error: 'Không thể thêm vào giỏ hàng' });
    }
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── PUT /api/cart/:cartItemId ─────────────────────────────
router.put('/:cartItemId', async (req, res) => {
  try {
    const { quantity } = req.body;
    const { cartItemId } = req.params;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Số lượng không hợp lệ' });
    }

    // Verify ownership and check stock
    const [items] = await pool.query(
      `SELECT ci.CartItemID, ci.ProductID, p.StockQuantity, p.Price
       FROM CartItems ci
       JOIN Cart c ON ci.CartID = c.CartID
       JOIN Products p ON ci.ProductID = p.ProductID
       WHERE ci.CartItemID = ? AND c.UserID = ?`,
      [cartItemId, req.user.userId]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ' });
    }

    if (quantity > items[0].StockQuantity) {
      return res.status(400).json({ error: `Chỉ còn ${items[0].StockQuantity} sản phẩm trong kho` });
    }

    await pool.query(
      'UPDATE CartItems SET Quantity = ?, UnitPrice = ? WHERE CartItemID = ?',
      [quantity, items[0].Price, cartItemId]
    );

    res.json({ message: 'Cập nhật giỏ hàng thành công' });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── DELETE /api/cart/:cartItemId ──────────────────────────
router.delete('/:cartItemId', async (req, res) => {
  try {
    const { cartItemId } = req.params;

    // Verify ownership
    const [items] = await pool.query(
      `SELECT ci.CartItemID
       FROM CartItems ci
       JOIN Cart c ON ci.CartID = c.CartID
       WHERE ci.CartItemID = ? AND c.UserID = ?`,
      [cartItemId, req.user.userId]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ' });
    }

    await pool.query('DELETE FROM CartItems WHERE CartItemID = ?', [cartItemId]);

    res.json({ message: 'Đã xóa sản phẩm khỏi giỏ hàng' });
  } catch (err) {
    console.error('Delete cart item error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
