const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All order routes require authentication
router.use(authenticate);

// ─── POST /api/orders/checkout ─────────────────────────────
router.post('/checkout', async (req, res) => {
  try {
    const { receiverName, phone, shippingAddress, paymentMethod = 'COD', note } = req.body;

    if (!receiverName || !phone || !shippingAddress) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin giao hàng' });
    }

    // Call stored procedure SP_Checkout
    const [result] = await pool.query(
      `CALL SP_Checkout(?, ?, ?, ?, ?, ?, @orderId, @result);
       SELECT @orderId AS orderId, @result AS result;`,
      [req.user.userId, receiverName, phone, shippingAddress, paymentMethod, note || null]
    );

    const spData = result[1]?.[0] || result[result.length - 1]?.[0];
    const spResult = spData?.result;
    const orderId = spData?.orderId;

    if (spResult === 'SUCCESS') {
      res.status(201).json({
        message: 'Đặt hàng thành công',
        orderId
      });
    } else if (spResult === 'CART_NOT_FOUND') {
      res.status(400).json({ error: 'Không tìm thấy giỏ hàng' });
    } else if (spResult === 'CART_EMPTY') {
      res.status(400).json({ error: 'Giỏ hàng trống' });
    } else {
      res.status(400).json({ error: 'Không thể đặt hàng. Vui lòng thử lại' });
    }
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── GET /api/orders ───────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE o.UserID = ?';
    const params = [req.user.userId];

    if (status) {
      where += ' AND o.OrderStatus = ?';
      params.push(status);
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM Orders o ${where}`, params
    );
    const total = countResult[0].total;

    const [orders] = await pool.query(
      `SELECT o.OrderID, o.ReceiverName, o.Phone, o.ShippingAddress,
              o.TotalAmount, o.OrderStatus, o.PaymentStatus, o.Note,
              o.CreatedAt, o.UpdatedAt,
              p.Method AS PaymentMethod
       FROM Orders o
       LEFT JOIN Payments p ON o.OrderID = p.OrderID
       ${where}
       ORDER BY o.CreatedAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      orders,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── GET /api/orders/:id ───────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.OrderID, o.ReceiverName, o.Phone, o.ShippingAddress,
              o.TotalAmount, o.OrderStatus, o.PaymentStatus, o.Note,
              o.CreatedAt, o.UpdatedAt,
              p.Method AS PaymentMethod, p.Status AS PaymentProcessStatus, p.PaidAt
       FROM Orders o
       LEFT JOIN Payments p ON o.OrderID = p.OrderID
       WHERE o.OrderID = ? AND o.UserID = ?`,
      [req.params.id, req.user.userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    // Get order details
    const [details] = await pool.query(
      `SELECT od.OrderDetailID, od.Quantity, od.UnitPrice, od.SubTotal,
              pr.ProductID, pr.ProductName, pr.Image
       FROM OrderDetails od
       JOIN Products pr ON od.ProductID = pr.ProductID
       WHERE od.OrderID = ?`,
      [req.params.id]
    );

    res.json({ ...orders[0], items: details });
  } catch (err) {
    console.error('Get order detail error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── PUT /api/orders/:id/cancel ────────────────────────────
router.put('/:id/cancel', async (req, res) => {
  try {
    // Verify ownership
    const [orders] = await pool.query(
      'SELECT OrderID, OrderStatus FROM Orders WHERE OrderID = ? AND UserID = ?',
      [req.params.id, req.user.userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    const order = orders[0];
    if (!['Pending', 'Confirmed'].includes(order.OrderStatus)) {
      return res.status(400).json({ error: 'Không thể hủy đơn hàng ở trạng thái này' });
    }

    // Call SP_UpdateOrderStatus
    const [result] = await pool.query(
      'CALL SP_UpdateOrderStatus(?, ?, @result); SELECT @result AS result;',
      [req.params.id, 'Cancelled']
    );

    const spResult = result[1]?.[0]?.result || result[result.length - 1]?.[0]?.result;

    if (spResult === 'SUCCESS') {
      // Update payment status to Failed
      await pool.query(
        "UPDATE Payments SET Status = 'Failed' WHERE OrderID = ? AND Status = 'Pending'",
        [req.params.id]
      );
      res.json({ message: 'Đã hủy đơn hàng thành công' });
    } else {
      res.status(400).json({ error: 'Không thể hủy đơn hàng' });
    }
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── POST /api/orders/:id/pay ──────────────────────────────
// Mock payment — simulates online banking
router.post('/:id/pay', async (req, res) => {
  try {
    // Verify ownership
    const [orders] = await pool.query(
      'SELECT OrderID, PaymentStatus, OrderStatus FROM Orders WHERE OrderID = ? AND UserID = ?',
      [req.params.id, req.user.userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (orders[0].PaymentStatus === 'Paid') {
      return res.status(400).json({ error: 'Đơn hàng đã được thanh toán' });
    }

    if (orders[0].OrderStatus === 'Cancelled') {
      return res.status(400).json({ error: 'Không thể thanh toán đơn hàng đã hủy' });
    }

    // Update payment to Success (trigger will update Orders.PaymentStatus)
    await pool.query(
      "UPDATE Payments SET Status = 'Success', PaidAt = CURRENT_TIMESTAMP WHERE OrderID = ?",
      [req.params.id]
    );

    res.json({ message: 'Thanh toán thành công' });
  } catch (err) {
    console.error('Pay order error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
