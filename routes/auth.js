const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { poolPromise } = require('../db');

router.post('/register', async (req, res) => {
  const { email, name, contact, password } = req.body;

  try {
    const pool = await poolPromise;
    if (!pool) {
      console.error('❌ Database connection is undefined');
      return res.status(500).json({ error: 'Database not connected' });
    }

    const checkUser = await pool
      .request()
      .input('email', email)
      .query('SELECT * FROM Users WHERE email = @email');

    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool
      .request()
      .input('email', email)
      .input('name', name)
      .input('contact', contact)
      .input('password', hashedPassword)
      .query(`
        INSERT INTO Users (email, name, contact, password)
        VALUES (@email, @name, @contact, @password)
      `);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('❌ Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 登录 API
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = await poolPromise;
    if (!pool) {
      console.error('❌ Database connection is undefined');
      return res.status(500).json({ error: 'Database not connected' });
    }

    const result = await pool
      .request()
      .input('email', email)
      .query('SELECT * FROM Users WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = result.recordset[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        contact: user.contact
      }
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新用户资料 API
router.put('/update-profile', async (req, res) => {
  const { id, name, contact, password } = req.body;

  try {
    const pool = await poolPromise;
    if (!pool) {
      console.error('❌ Database connection is undefined');
      return res.status(500).json({ error: 'Database not connected' });
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool
        .request()
        .input('id', id)
        .input('name', name)
        .input('contact', contact)
        .input('password', hashedPassword)
        .query(`
          UPDATE Users
          SET name = @name,
              contact = @contact,
              password = @password
          WHERE id = @id
        `);
    } else {
      await pool
        .request()
        .input('id', id)
        .input('name', name)
        .input('contact', contact)
        .query(`
          UPDATE Users
          SET name = @name,
              contact = @contact
          WHERE id = @id
        `);
    }

    res.status(200).json({ message: 'Profile updated' });
  } catch (err) {
    console.error('❌ Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
