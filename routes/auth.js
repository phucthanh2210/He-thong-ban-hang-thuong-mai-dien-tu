const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ─── POST /api/auth/register ───────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;

    // Validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Check email exists
    const [existing] = await pool.query('SELECT UserID FROM Users WHERE Email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email đã được sử dụng' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user (RoleID = 2 = Customer)
    const [result] = await pool.query(
      `INSERT INTO Users (RoleID, FullName, Email, PasswordHash, Phone)
       VALUES (2, ?, ?, ?, ?)`,
      [fullName, email, passwordHash, phone || null]
    );

    // Generate token
    const token = jwt.sign(
      { userId: result.insertId, role: 'Customer', fullName },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      user: { userId: result.insertId, fullName, email, role: 'Customer' }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
    }

    // Find user
    const [users] = await pool.query(
      `SELECT u.UserID, u.FullName, u.Email, u.PasswordHash, u.Phone, u.Avatar, u.Status,
              r.RoleName
       FROM Users u
       JOIN Roles r ON u.RoleID = r.RoleID
       WHERE u.Email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const user = users[0];

    if (!user.Status) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    // Update LastLogin
    await pool.query('UPDATE Users SET LastLogin = CURRENT_TIMESTAMP WHERE UserID = ?', [user.UserID]);

    // Insert login log
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;
    await pool.query(
      'INSERT INTO LoginLogs (UserID, IPAddress) VALUES (?, ?)',
      [user.UserID, ip]
    );

    // Generate token
    const token = jwt.sign(
      { userId: user.UserID, role: user.RoleName, fullName: user.FullName },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        userId: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        phone: user.Phone,
        avatar: user.Avatar,
        role: user.RoleName
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── GET /api/auth/profile ─────────────────────────────────
router.get('/profile', authenticate, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.UserID, u.FullName, u.Email, u.Phone, u.Avatar, u.Status, u.CreatedAt,
              r.RoleName
       FROM Users u
       JOIN Roles r ON u.RoleID = r.RoleID
       WHERE u.UserID = ?`,
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const user = users[0];
    res.json({
      userId: user.UserID,
      fullName: user.FullName,
      email: user.Email,
      phone: user.Phone,
      avatar: user.Avatar,
      role: user.RoleName,
      createdAt: user.CreatedAt
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─── PUT /api/auth/profile ─────────────────────────────────
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { fullName, phone, currentPassword, newPassword } = req.body;

    // Build update fields
    const updates = [];
    const values = [];

    if (fullName) {
      updates.push('FullName = ?');
      values.push(fullName);
    }
    if (phone !== undefined) {
      updates.push('Phone = ?');
      values.push(phone || null);
    }

    // Change password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại' });
      }

      const [users] = await pool.query('SELECT PasswordHash FROM Users WHERE UserID = ?', [req.user.userId]);
      const isMatch = await bcrypt.compare(currentPassword, users[0].PasswordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      }

      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(newPassword, salt);
      updates.push('PasswordHash = ?');
      values.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Không có thông tin cần cập nhật' });
    }

    values.push(req.user.userId);
    await pool.query(`UPDATE Users SET ${updates.join(', ')} WHERE UserID = ?`, values);

    res.json({ message: 'Cập nhật thông tin thành công' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
