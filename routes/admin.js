const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(requireAdmin);

// ─── GET /api/admin/dashboard ──────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [dashboard] = await pool.query('SELECT * FROM DashboardView');

    // Recent orders
    const [recentOrders] = await pool.query(
      `SELECT o.OrderID, o.ReceiverName, o.TotalAmount, o.OrderStatus,
              o.PaymentStatus, o.CreatedAt
       FROM Orders o
       ORDER BY o.CreatedAt DESC
       LIMIT 5`
    );

    // Low stock products
    const [lowStock] = await pool.query(
      `SELECT ProductID, ProductName, StockQuantity, Image
       FROM Products
       WHERE Status = TRUE AND StockQuantity <= 5
       ORDER BY StockQuantity ASC`
    );

    res.json({
      stats: dashboard[0],
      recentOrders,
      lowStock
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── GET /api/admin/orders ─────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const { status, page = 1, limit = 15 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 15));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE 1=1';
    const params = [];

    if (status) {
      where += ' AND o.OrderStatus = ?';
      params.push(status);
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM Orders o ${where}`, params
    );
    const total = countResult[0].total;

    const [orders] = await pool.query(
      `SELECT o.OrderID, o.UserID, o.ReceiverName, o.Phone, o.ShippingAddress,
              o.TotalAmount, o.OrderStatus, o.PaymentStatus, o.Note,
              o.CreatedAt, o.UpdatedAt,
              u.FullName AS CustomerName, u.Email AS CustomerEmail,
              p.Method AS PaymentMethod
       FROM Orders o
       JOIN Users u ON o.UserID = u.UserID
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
    console.error('Admin get orders error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── GET /api/admin/orders/:id ─────────────────────────────
router.get('/orders/:id', async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, u.FullName AS CustomerName, u.Email AS CustomerEmail,
              p.Method AS PaymentMethod, p.Status AS PaymentProcessStatus, p.PaidAt
       FROM Orders o
       JOIN Users u ON o.UserID = u.UserID
       LEFT JOIN Payments p ON o.OrderID = p.OrderID
       WHERE o.OrderID = ?`,
      [req.params.id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

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
    console.error('Admin get order detail error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── PUT /api/admin/orders/:id/status ──────────────────────
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['Pending', 'Confirmed', 'Shipping', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
    }

    const [result] = await pool.query(
      'CALL SP_UpdateOrderStatus(?, ?, @result); SELECT @result AS result;',
      [req.params.id, status]
    );

    const spResult = result[1]?.[0]?.result || result[result.length - 1]?.[0]?.result;

    if (spResult === 'SUCCESS') {
      // If completed and COD, mark payment as success
      if (status === 'Completed') {
        await pool.query(
          `UPDATE Payments SET Status = 'Success', PaidAt = CURRENT_TIMESTAMP
           WHERE OrderID = ? AND Status = 'Pending'`,
          [req.params.id]
        );
      }
      res.json({ message: 'Cập nhật trạng thái thành công' });
    } else if (spResult === 'ORDER_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    } else if (spResult === 'INVALID_TRANSITION') {
      res.status(400).json({ error: 'Không thể chuyển sang trạng thái này' });
    } else {
      res.status(400).json({ error: 'Cập nhật thất bại' });
    }
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── GET /api/admin/products ───────────────────────────────
router.get('/products', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [countResult] = await pool.query('SELECT COUNT(*) AS total FROM Products');
    const total = countResult[0].total;

    const [products] = await pool.query(
      `SELECT p.ProductID, p.ProductName, p.Description, p.Price, p.StockQuantity,
              p.Image, p.Status, p.CreatedAt, p.UpdatedAt,
              c.CategoryID, c.CategoryName
       FROM Products p
       JOIN Categories c ON p.CategoryID = c.CategoryID
       ORDER BY p.ProductID ASC
       LIMIT ? OFFSET ?`,
      [limitNum, offset]
    );

    res.json({
      products,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (err) {
    console.error('Admin get products error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── POST /api/admin/products ──────────────────────────────
router.post('/products', async (req, res) => {
  try {
    const { categoryId, productName, description, price, stockQuantity, image } = req.body;

    if (!categoryId || !productName || price === undefined) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
    }

    const [result] = await pool.query(
      `INSERT INTO Products (CategoryID, ProductName, Description, Price, StockQuantity, Image)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [categoryId, productName, description || null, price, stockQuantity || 0, image || null]
    );

    res.status(201).json({
      message: 'Thêm sản phẩm thành công',
      productId: result.insertId
    });
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── PUT /api/admin/products/:id ───────────────────────────
router.put('/products/:id', async (req, res) => {
  try {
    const { categoryId, productName, description, price, stockQuantity, image, status } = req.body;

    const updates = [];
    const values = [];

    if (categoryId !== undefined) { updates.push('CategoryID = ?'); values.push(categoryId); }
    if (productName !== undefined) { updates.push('ProductName = ?'); values.push(productName); }
    if (description !== undefined) { updates.push('Description = ?'); values.push(description); }
    if (price !== undefined) { updates.push('Price = ?'); values.push(price); }
    if (stockQuantity !== undefined) { updates.push('StockQuantity = ?'); values.push(stockQuantity); }
    if (image !== undefined) { updates.push('Image = ?'); values.push(image); }
    if (status !== undefined) { updates.push('Status = ?'); values.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Không có thông tin cần cập nhật' });
    }

    values.push(req.params.id);
    const [result] = await pool.query(
      `UPDATE Products SET ${updates.join(', ')} WHERE ProductID = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    }

    res.json({ message: 'Cập nhật sản phẩm thành công' });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── GET /api/admin/users ──────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.UserID, u.FullName, u.Email, u.Phone, u.Status, u.LastLogin,
              u.CreatedAt, r.RoleName,
              COUNT(o.OrderID) AS OrderCount,
              COALESCE(SUM(CASE WHEN o.OrderStatus = 'Completed' THEN o.TotalAmount ELSE 0 END), 0) AS TotalSpent
       FROM Users u
       JOIN Roles r ON u.RoleID = r.RoleID
       LEFT JOIN Orders o ON u.UserID = o.UserID
       GROUP BY u.UserID
       ORDER BY u.CreatedAt DESC`
    );

    res.json(users);
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── PUT /api/admin/users/:id/status ───────────────────────
router.put('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    // Don't allow locking yourself
    if (parseInt(req.params.id) === req.user.userId) {
      return res.status(400).json({ error: 'Không thể thay đổi trạng thái của chính mình' });
    }

    const [result] = await pool.query(
      'UPDATE Users SET Status = ? WHERE UserID = ?',
      [status ? 1 : 0, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    res.json({ message: status ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản' });
  } catch (err) {
    console.error('Update user status error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── GET /api/admin/revenue ────────────────────────────────
router.get('/revenue', async (req, res) => {
  try {
    const [revenue] = await pool.query('SELECT * FROM RevenueReport');

    // Calculate summary
    const totalRevenue = revenue.reduce((sum, r) => sum + parseFloat(r.TotalRevenue || 0), 0);
    const totalOrders = revenue.reduce((sum, r) => sum + r.TotalOrders, 0);
    const totalItems = revenue.reduce((sum, r) => sum + r.TotalItemsSold, 0);

    res.json({
      report: revenue,
      summary: { totalRevenue, totalOrders, totalItems }
    });
  } catch (err) {
    console.error('Revenue error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── GET /api/admin/categories ─────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const [categories] = await pool.query(
      `SELECT c.CategoryID, c.CategoryName, c.Description, c.Status,
              COUNT(p.ProductID) AS ProductCount
       FROM Categories c
       LEFT JOIN Products p ON c.CategoryID = p.CategoryID
       GROUP BY c.CategoryID
       ORDER BY c.CategoryID ASC`
    );
    res.json(categories);
  } catch (err) {
    console.error('Admin get categories error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
